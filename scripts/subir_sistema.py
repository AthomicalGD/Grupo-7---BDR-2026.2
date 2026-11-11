"""Sobe o sistema inteiro na ordem certa: Docker, banco, API e site (versão de produção, a leve).

    python scripts/subir_sistema.py                 # tudo, e fica rodando; Ctrl+C derruba a API e o site
    python scripts/subir_sistema.py --sem-site      # só o banco e a API
    python scripts/subir_sistema.py --banco-container meu-db-1 --porta-api 8001

O que ele faz, nesta ordem (e pula o que já estiver de pé):
  1. Docker Desktop: se o motor não responde, abre o programa e espera.
  2. Banco: se nada responde na URL (DATABASE_URL, ou 127.0.0.1:5432 e :5433), liga o container do banco.
  3. Estatísticas: se o Postgres está sem ANALYZE nas tabelas grandes, roda um (10 s); sem elas as consultas viram minutos.
  4. API: numa porta livre (a partir de 8000; a 8000 costuma ser de outro projeto), esperando o /api/saude.
  5. Site: build de produção só se o código mudou, e `vite preview` apontando para essa API.
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"
DOCKER_DESKTOP = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Docker" / "Docker" / "Docker Desktop.exe"
CONTAINERS_PADRAO = ["bdrvies-db-1", "grupo-7---bdr-20262-db-1"]
USUARIO_SENHA_BANCO = "eleicoes:eleicoes@127.0.0.1"


def dizer(msg: str) -> None:
    print(f"[subir] {msg}", flush=True)


def porta_aberta(porta: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", porta)) == 0


def docker_ok() -> bool:
    return subprocess.run(["docker", "info"], capture_output=True).returncode == 0


def garantir_docker() -> None:
    if docker_ok():
        return
    if sys.platform == "win32" and DOCKER_DESKTOP.exists():
        dizer("Docker desligado: abrindo o Docker Desktop...")
        subprocess.Popen([str(DOCKER_DESKTOP)])
    else:
        sys.exit("O Docker não está rodando; ligue-o e rode de novo.")
    for _ in range(40):
        time.sleep(3)
        if docker_ok():
            dizer("Docker pronto.")
            return
    sys.exit("O Docker não respondeu em 2 minutos.")


def url_do_banco(porta: int) -> str:
    return f"postgresql://{USUARIO_SENHA_BANCO}:{porta}/eleicoes"


def achar_banco(containers: list[str]) -> str:
    """A URL do banco que responde; se nenhum, liga o primeiro container existente e espera."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    for p in (5432, 5433):
        if porta_aberta(p):
            return url_do_banco(p)
    garantir_docker()
    existentes = subprocess.run(["docker", "ps", "-a", "--format", "{{.Names}}"], capture_output=True, text=True).stdout.split()
    escolhido = next((c for c in containers if c in existentes), None)
    if not escolhido:
        sys.exit("Nenhum container do banco encontrado; rode `docker compose up -d` na pasta do projeto "
                 "ou passe --banco-container NOME.")
    dizer(f"Ligando o banco ({escolhido})...")
    subprocess.run(["docker", "start", escolhido], capture_output=True)
    for _ in range(40):
        time.sleep(2)
        for p in (5432, 5433):
            if porta_aberta(p):
                time.sleep(2)
                return url_do_banco(p)
    sys.exit("O banco não abriu a porta em 80 s.")


def garantir_estatisticas(url: str) -> None:
    import psycopg2  # só aqui: quem só quer o site não precisa dele
    with psycopg2.connect(url) as conn:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM pg_stats WHERE schemaname = 'public' AND tablename = 'politico_eleicao'")
        if cur.fetchone()[0] == 0:
            dizer("Banco sem estatísticas do planejador: rodando ANALYZE (~10 s)...")
            cur.execute("ANALYZE")


def porta_livre(a_partir_de: int) -> int:
    p = a_partir_de
    while porta_aberta(p):
        p += 1
    return p


def esperar_http(url: str, segundos: int) -> bool:
    for _ in range(segundos):
        try:
            urllib.request.urlopen(url, timeout=2).read()
            return True
        except Exception:  # noqa: BLE001 - ainda subindo
            time.sleep(1)
    return False


def codigo_mudou() -> bool:
    dist = WEB / "dist" / "index.html"
    if not dist.exists():
        return True
    feito = dist.stat().st_mtime
    fontes = [p for d in ("src", "public") for p in (WEB / d).rglob("*") if p.is_file()] + [WEB / "index.html", WEB / "package.json"]
    return any(p.stat().st_mtime > feito for p in fontes)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--banco-container", action="append", help="nome do container do banco (repetível)")
    ap.add_argument("--porta-api", type=int, default=None, help="porta da API (padrão: a primeira livre a partir de 8000)")
    ap.add_argument("--porta-site", type=int, default=4173)
    ap.add_argument("--sem-site", action="store_true")
    ap.add_argument("--sem-build", action="store_true", help="não refaz o build mesmo que o código tenha mudado")
    a = ap.parse_args()

    url = achar_banco(a.banco_container or CONTAINERS_PADRAO)
    dizer(f"Banco: {url.rsplit('@', 1)[-1]}")
    garantir_estatisticas(url)

    porta_api = a.porta_api or porta_livre(8000)
    env = {**os.environ, "DATABASE_URL": url}
    dizer(f"API na porta {porta_api}...")
    api = subprocess.Popen([sys.executable, "-m", "uvicorn", "api.app:app", "--port", str(porta_api)], cwd=RAIZ, env=env)
    filhos = [api]
    try:
        if not esperar_http(f"http://127.0.0.1:{porta_api}/api/saude", 90):
            sys.exit("A API não respondeu em 90 s.")
        dizer("API no ar. (O aquecimento das contas pesadas segue em segundo plano: 1 a 2 min na primeira vez.)")
        if not a.sem_site:
            npm = shutil.which("npm") or "npm"
            if not (WEB / "node_modules").exists():
                dizer("Instalando as dependências do site (npm ci)...")
                subprocess.run([npm, "ci"], cwd=WEB, check=True, shell=sys.platform == "win32")
            if not a.sem_build and codigo_mudou():
                dizer("Código novo: fazendo o build de produção...")
                subprocess.run([npm, "run", "build"], cwd=WEB, check=True, shell=sys.platform == "win32")
            if porta_aberta(a.porta_site):
                sys.exit(f"A porta {a.porta_site} do site já está ocupada.")
            site = subprocess.Popen([npm, "run", "preview"], cwd=WEB, env={**env, "API_ALVO": f"http://127.0.0.1:{porta_api}"},
                                    shell=sys.platform == "win32")
            filhos.append(site)
            if not esperar_http(f"http://127.0.0.1:{a.porta_site}/", 40):
                sys.exit("O site não respondeu em 40 s.")
            dizer(f"Pronto: http://localhost:{a.porta_site}  (API em http://127.0.0.1:{porta_api})")
        dizer("Rodando. Ctrl+C para parar a API e o site (o banco fica ligado).")
        api.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for f in filhos:
            if f.poll() is None:
                f.terminate()


if __name__ == "__main__":
    main()
