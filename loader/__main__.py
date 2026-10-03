"""Linha de comando: python -m loader UF [UF ...] [opções]  (rode da pasta do projeto)."""
import argparse
import os
import sys
import time
from pathlib import Path

import psycopg2

from . import carga, fontes

RAIZ_PADRAO = Path(__file__).resolve().parent.parent / "dados"
BANCO_PADRAO = "postgresql://eleicoes:eleicoes@localhost:5432/eleicoes"


def _argumentos(argv):
    p = argparse.ArgumentParser(
        prog="python -m loader",
        description="Carrega no PostgreSQL os dados das UFs indicadas. UFs já carregadas são puladas.",
    )
    p.add_argument("ufs", nargs="+", metavar="UF", help="siglas das UFs a carregar (ex.: SP RJ MG)")
    p.add_argument("--dados", type=Path, default=RAIZ_PADRAO, help="pasta com os dados (padrão: ./dados)")
    p.add_argument("--banco", default=os.environ.get("DATABASE_URL", BANCO_PADRAO),
                   help="URL de conexão (padrão: $DATABASE_URL ou o banco do docker-compose.yml)")
    return p.parse_args(argv)


def _duracao(segundos: float) -> str:
    m, s = divmod(int(segundos), 60)
    return f"{m}min{s:02d}s" if m else f"{s}s"


def _preparar(cur, raiz: Path, pendentes: list[str]) -> None:
    """Lê cada arquivo uma única vez e distribui as linhas pelas tabelas de staging de cada UF."""
    print("\nLendo os arquivos:")
    carga.criar_staging(cur, pendentes)
    filtro = set(pendentes)
    for conjunto in fontes.CONJUNTOS:
        lista = fontes.arquivos(raiz, conjunto, filtro)
        if not lista:
            print(f"  aviso: nenhum arquivo {conjunto.padrao} em {raiz / conjunto.pasta}")
        for arquivo in lista:
            print(f"  {arquivo.relative_to(raiz)} ...", end="", flush=True)
            inicio, linhas = time.monotonic(), 0
            for bloco in fontes.ler(arquivo, conjunto, filtro):
                carga.gravar_staging(cur, conjunto, bloco)
                linhas += len(bloco)
            cur.connection.commit()
            print(f" {linhas:,} linhas ({_duracao(time.monotonic() - inicio)})")
    carga.analisar_staging(cur, pendentes)
    cur.connection.commit()


def main(argv=None) -> int:
    args = _argumentos(argv)
    raiz = args.dados.resolve()
    municipios = fontes.municipios(raiz)
    cd_uf = dict(zip(municipios["sg_uf"], municipios["cd_uf"].astype(int)))

    pedidas = list(dict.fromkeys(u.strip().upper() for u in args.ufs))
    invalidas = [u for u in pedidas if u not in cd_uf]
    if invalidas:
        print(f"UF desconhecida: {', '.join(invalidas)}. Válidas: {' '.join(sorted(cd_uf))}", file=sys.stderr)
        return 2

    try:
        conn = psycopg2.connect(args.banco)
    except psycopg2.OperationalError as e:
        print(f"Não consegui conectar ao banco ({e}).\nO container está de pé? docker compose up -d", file=sys.stderr)
        return 1
    with conn:
        cur = conn.cursor()
        if not carga.esquema_ok(cur):
            print("As tabelas não existem. Aplique as migrações: docker compose run --rm migracoes", file=sys.stderr)
            return 1
        if not carga.travar(cur):
            print("Outra carga está em andamento neste banco.", file=sys.stderr)
            return 1

        carregadas = carga.ufs_carregadas(cur)
        ja = [u for u in pedidas if u in carregadas]
        pendentes = [u for u in pedidas if u not in carregadas]
        if ja:
            print(f"Já carregadas (puladas): {' '.join(ja)}")
        if not pendentes:
            print("Nada a carregar.")
            return 0
        if "BR" not in carregadas:
            pendentes.insert(0, "BR")  # candidaturas nacionais (Presidente), usadas pela votação de toda UF
        print(f"A carregar: {' '.join(pendentes)}")

        inicio = time.monotonic()
        carga.preparar_referencias(cur, municipios, fontes.indices(raiz))
        conn.commit()
        _preparar(cur, raiz, pendentes)

        print("\nGravando no modelo:")
        for uf in pendentes:
            print(f"  {uf} ...", end="", flush=True)
            t0 = time.monotonic()
            try:
                resumo = carga.carregar_uf(cur, uf, cd_uf.get(uf))
                carga.registrar(cur, uf, resumo)
                conn.commit()
            except Exception:
                conn.rollback()
                print(" falhou; a UF não foi registrada e pode ser carregada de novo.")
                raise
            carga.descartar_staging(cur, uf)
            conn.commit()
            print(f" ok ({_duracao(time.monotonic() - t0)})")
            for tabela, n in sorted(resumo["inseridas"].items()):
                print(f"      {tabela:<28}{n:>12,}")
            for motivo, n in sorted(resumo["descartadas"].items()):
                print(f"      descartadas: {motivo:<40}{n:>10,}")
        print(f"\nConcluído em {_duracao(time.monotonic() - inicio)}.")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
