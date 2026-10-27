"""API do Voto Aberto: viés político de UFs e municípios, indicadores e carreira dos políticos.

Uso (da pasta do projeto): python -m uvicorn api.app:app --port 8000

Os dados só mudam com uma nova carga e ficam em cache no processo: reinicie a API depois de
carregar UFs (python -m loader ...).

Viés como em scripts/07_vies_politico_municipio.py, sobre a view vies_votos_cargo (migração 006):
em cada cargo, média do viés dos partidos naquela eleição (artigo, -100 esquerda a +100 direita)
ponderada pelos votos válidos do 1º turno das eleições ordinárias; depois, média dos cargos com peso
igual. Partido sem viés fica fora da conta e entra em sem_vies_pct. UF e região intermediária: a
mesma conta sobre os votos de todos os seus municípios. O alinhamento (SVD da Câmara) segue a mesma
conta, com outro rótulo: acompanha a coalizão de governo, não a ideologia.
"""
import bisect
import csv
import gzip
import hashlib
import json
import math
import os
import pickle
import random
import shutil
import statistics
import struct
import threading
import traceback
import unicodedata
import zlib
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from functools import lru_cache, wraps
from pathlib import Path

import zipfile

import psycopg2
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from crawler.fotos import PASTA as PASTA_FOTOS, chave as chave_foto, indice as indice_fotos

DADOS = Path(__file__).resolve().parent.parent / "dados"
IBGE = DADOS / "ibge"
BANCO_PADRAO = "postgresql://eleicoes:eleicoes@127.0.0.1:5432/eleicoes"
SEM_BANCO = "Banco de dados indisponível. Suba o PostgreSQL com `docker compose up -d` na pasta do projeto."

ANOS = [2018, 2020, 2022, 2024, 2026]   # 2026: o 1º turno (o 2º ainda não foi publicado pelo TSE)
PRESIDENTE, SENADOR, PREFEITO = 1, 5, 11   # cargo.cod_cargo
VAZIO = {"vies": {}, "sem_vies_pct": {}, "alinhamento": {}, "sem_alinhamento_pct": {}}


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()


# ───────── Território (IBGE): todos os 5570 municípios, carregados ou não ─────────

with open(IBGE / "territorio" / "municipios.csv", encoding="utf-8-sig", newline="") as f:
    MUNICIPIOS = {int(r["cod_ibge"]): r for r in csv.DictReader(f, delimiter=";")}

_por_uf = Counter(m["sg_uf"] for m in MUNICIPIOS.values())
UFS = {m["sg_uf"]: {"sigla": m["sg_uf"], "cd_ibge": ibge // 100_000, "nome": m["uf"], "regiao": m["regiao"],
                    "municipios": _por_uf[m["sg_uf"]]} for ibge, m in MUNICIPIOS.items()}

BUSCA = sorted((sem_acento(m["municipio"]), ibge) for ibge, m in MUNICIPIOS.items())

# Questão extra: a exploração colonial de cada município (0 a 100: metade o ciclo econômico mais forte, metade o trabalho
# escravizado), gerada por scripts/11_exploracao_colonial.py a partir de dados abertos (ver o cabeçalho do script)
_COLONIAL_CSV = Path(__file__).resolve().parent.parent / "respostas" / "11_exploracao_colonial" / "municipios.csv"
COLONIAL: dict[int, dict] = {}
if _COLONIAL_CSV.exists():
    with open(_COLONIAL_CSV, encoding="utf-8", newline="") as f:
        COLONIAL = {int(r["ibge"]): {"indice": float(r["indice"]), "economia": float(r["economia"]), "escravidao": float(r["escravidao"]),
                                     "ciclos": [float(r[k]) for k in ("acucar", "mineracao", "gado", "norte")]}
                    for r in csv.DictReader(f) if r["indice"]}


def uf_de(sigla: str) -> dict:
    uf = UFS.get(sigla.upper())
    if uf is None:
        raise HTTPException(404, f"UF desconhecida: {sigla}")
    return uf


# ───────── Banco ─────────

_POOL: ThreadedConnectionPool | None = None
_TRAVA_POOL = threading.Lock()


def pool() -> ThreadedConnectionPool:
    # um só pool para todas as threads: com o lru_cache, os dois aquecimentos que sobem juntos criavam
    # dois pools e devolviam a conexão ao errado ("trying to put unkeyed connection")
    global _POOL
    if _POOL is None:
        with _TRAVA_POOL:
            if _POOL is None:
                # 127.0.0.1, não localhost: no Windows o localhost tenta antes o IPv6 (::1), que o Docker não
                # atende, e cada conexão nova esperava 2 s. E 6 conexões ficam abertas: com 1, dois pedidos ao
                # mesmo tempo abriam e fechavam conexões novas (e pagavam esses 2 s) a todo momento.
                url = os.environ.get("DATABASE_URL", BANCO_PADRAO).replace("@localhost:", "@127.0.0.1:")
                _POOL = ThreadedConnectionPool(6, 20, url)
    return _POOL


def consultar(sql: str, params=None) -> list[dict]:
    conn = pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        pool().putconn(conn, close=bool(conn.closed))   # descarta conexões quebradas (banco reiniciado)


# ───────── Cache em disco ─────────
# As contas pesadas (P10a de todas as UFs ~28 s, P2 panorama ~18 s, P4 de 2022 ~17 s...) ficam guardadas em
# dados/cache_api/<versão>/, e a API reiniciada não as refaz. A versão junta o que muda os resultados: a
# carga de cada UF (carga_uf), a classificação de viés dos partidos e VERSAO_CONTAS. Carregar um
# estado, reclassificar o viés ou aumentar VERSAO_CONTAS gera outra versão; as pastas antigas são apagadas.
CACHE_API = DADOS / "cache_api"
# Aumente ao mudar uma conta ou consulta (o que muda um resultado); mudanças que não mudam resultados
# (tamanho dos caches, textos de erro) não precisam, e assim não obrigam a refazer tudo.
VERSAO_CONTAS = 1


@lru_cache(maxsize=1)
def versao_cache() -> str:
    dados = consultar("""
        SELECT md5(COALESCE((SELECT string_agg(sg_uf || carregada_em::text, ',' ORDER BY sg_uf) FROM carga_uf), '')
                || COALESCE((SELECT string_agg(t::text, ',' ORDER BY t::text) FROM vies_partido_onda t), '')) AS v""")[0]["v"]
    versao = f"{dados[:10]}-{VERSAO_CONTAS}"
    if CACHE_API.exists():
        for velha in CACHE_API.iterdir():
            if velha.is_dir() and "-" in velha.name and velha.name != versao:   # "fotos" fica
                shutil.rmtree(velha, ignore_errors=True)
    return versao


# Com o disco por baixo, a memória guarda poucos resultados das contas que devolvem listas grandes
# (candidatos de cada partido, campanhas de um cargo inteiro): ler do disco leva milissegundos.
def em_disco(f):
    """Guarda o resultado de f(*args) em disco (ver versao_cache). Vai por baixo do lru_cache: a memória
    responde primeiro, o disco depois de reiniciar, a conta só na primeira vez de cada versão."""
    @wraps(f)
    def g(*args, **kw):
        chave = hashlib.sha1(repr((args, sorted(kw.items()))).encode()).hexdigest()[:20]
        arquivo = CACHE_API / versao_cache() / f.__name__ / f"{chave}.pkl"
        try:
            return pickle.loads(arquivo.read_bytes())
        except (OSError, pickle.UnpicklingError, EOFError):
            pass
        valor = f(*args, **kw)
        try:
            arquivo.parent.mkdir(parents=True, exist_ok=True)
            temp = arquivo.with_suffix(f".{threading.get_ident()}.tmp")
            temp.write_bytes(pickle.dumps(valor, protocol=pickle.HIGHEST_PROTOCOL))
            temp.replace(arquivo)
        except OSError:   # sem espaço ou sem permissão: segue só com a memória
            pass
        return valor
    return g


SQL_CARREGADAS = "SELECT u.sigla FROM carga_uf c JOIN uf u ON u.sigla = c.sg_uf ORDER BY 1"


@lru_cache(maxsize=1)
def carregadas() -> frozenset[str]:
    return frozenset(r["sigla"] for r in consultar(SQL_CARREGADAS))


SOMAS_VIES = ("votos", "votos_com_vies", "votos_x_vies", "votos_com_alinhamento", "votos_x_alinhamento")


@lru_cache(maxsize=1)
def carga_nacional() -> bool:
    return bool(consultar("SELECT 1 FROM carga_uf WHERE sg_uf = 'BR'"))


# O deputado distrital (8, só o DF) conta como deputado estadual (7) em todo o site. Nos filtros, o cargo 7
# vira a lista [7, 8] (e.cod_cargo = ANY(...), que usa o índice; um CASE sobre a coluna não usaria); nas
# colunas devolvidas, CASE e.cod_cargo WHEN 8 THEN 7.
def sem_municipal(uf: str, municipal: bool) -> None:
    """O DF não tem municípios nem eleição municipal: prefeito e vereador lá são um recorte vazio."""
    if municipal and uf.upper() == "DF":
        raise HTTPException(404, "O Distrito Federal não tem eleição municipal: não elege prefeito nem vereador.")


@lru_cache(maxsize=2)
@em_disco
def votos_vies(turno: int = 1) -> list[dict]:
    """Votos válidos por município, ano e cargo, com as somas ponderadas do viés e do alinhamento. No 2º turno,
    os votos nominais dos finalistas (vies_votos_cargo_t2, migração 018), só onde houve 2º turno."""
    return consultar(f"""
        SELECT m.cd_uf, m.cd_ibge, v.ano, CASE v.cod_cargo WHEN 8 THEN 7 ELSE v.cod_cargo END AS cod_cargo,
               v.votos, v.votos_com_vies, v.votos_x_vies::float AS votos_x_vies,
               v.votos_com_alinhamento, v.votos_x_alinhamento::float AS votos_x_alinhamento
        FROM {"vies_votos_cargo_t2" if turno == 2 else "vies_votos_cargo"} v
        JOIN municipio m ON m.cd_municipio = v.cd_municipio
        WHERE v.ano = ANY(%s)""", (ANOS,))


def _media_dos_cargos(cargos: dict, x: int, com: int) -> float | None:
    """Média, com peso igual por cargo, de soma ponderada / votos com valor."""
    valores = [s[x] / s[com] for s in cargos.values() if s[com]]
    return round(sum(valores) / len(valores), 1) if valores else None


def vies(linhas: list[dict], chave) -> dict:
    """{chave: {"vies", "sem_vies_pct", "alinhamento", "sem_alinhamento_pct": {ano: valor}}}.

    Viés e alinhamento: média dos cargos com peso igual; os percentuais são dos votos válidos dos cargos
    em partidos sem valor (que ficam fora da média)."""
    soma = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0.0] * 5)))
    for r in linhas:
        s = soma[chave(r)][r["ano"]][r["cod_cargo"]]
        for i, campo in enumerate(SOMAS_VIES):
            s[i] += float(r[campo])
    saida = {}
    for k, anos in soma.items():
        d = {campo: {} for campo in VAZIO}
        for a, cargos in sorted(anos.items()):
            votos = sum(s[0] for s in cargos.values())
            if not votos:
                continue
            for nome, x, com in (("vies", 2, 1), ("alinhamento", 4, 3)):
                valor = _media_dos_cargos(cargos, x, com)
                if valor is not None:
                    d[nome][str(a)] = valor
                d[f"sem_{nome}_pct"][str(a)] = round(100 * (votos - sum(s[com] for s in cargos.values())) / votos, 1)
        saida[k] = d
    return saida


# Cargos do filtro do atlas (#10): os de eleicao_referencia. O deputado distrital (8, só o DF) conta como
# deputado estadual (7) em todo o site: é a assembleia do DF.
CARGOS_VIES = {1: "Presidente", 3: "Governador", 5: "Senador", 6: "Deputado federal", 7: "Deputado estadual",
               11: "Prefeito", 13: "Vereador"}


def linhas_vies(cargo: int | None = None, turno: int = 1) -> list[dict]:
    """As linhas de votos_vies de um cargo só, ou de todos (cargo=None)."""
    return votos_vies(turno) if cargo is None else [r for r in votos_vies(turno) if r["cod_cargo"] == cargo]


@lru_cache(maxsize=2)
def indice_vies(turno: int = 1) -> tuple[dict, dict]:
    """As linhas de votos_vies agrupadas por UF e por município, para não varrer as ~80 mil a cada pedido."""
    por_uf, por_municipio = defaultdict(list), defaultdict(list)
    for r in votos_vies(turno):
        por_uf[r["cd_uf"]].append(r)
        por_municipio[r["cd_ibge"]].append(r)
    return por_uf, por_municipio


def so_do_cargo(linhas: list[dict], cargo: int | None) -> list[dict]:
    return linhas if cargo is None else [r for r in linhas if r["cod_cargo"] == cargo]


def cargo_de(cargo: int | None) -> int | None:
    if cargo is not None and cargo not in CARGOS_VIES:
        raise HTTPException(404, f"Cargo fora do filtro do viés: {cargo}")
    return cargo


@lru_cache(maxsize=16)
@em_disco
def vies_ufs(cargo: int | None = None, turno: int = 1) -> dict:
    return vies(linhas_vies(cargo, turno), lambda r: r["cd_uf"])


def turno_de(turno: int) -> int:
    if turno not in (1, 2):
        raise HTTPException(422, "turno: 1 ou 2")
    return turno


# ───────── App ─────────

@asynccontextmanager
async def _ciclo_de_vida(_app):
    # a P10a de todas as UFs é a conta mais lenta (~7 s na primeira vez): começa a ser feita ao subir,
    # em segundo plano, para a primeira visita à Reeleição já achar o cache pronto
    threading.Thread(target=_aquecer, daemon=True).start()
    # a P2 de cada estado leva ~3 s na primeira vez (14 recortes): idem
    threading.Thread(target=_aquecer_patrimonio, daemon=True).start()
    yield


app = FastAPI(title="Voto Aberto", lifespan=_ciclo_de_vida)
app.add_middleware(GZipMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET", "PUT"])


@app.exception_handler(psycopg2.OperationalError)
def banco_fora(_request, _exc):
    return JSONResponse({"detail": SEM_BANCO}, status_code=503)


@app.get("/api/saude")
def saude():
    return {"banco": True, "ufs_carregadas": [r["sigla"] for r in consultar(SQL_CARREGADAS)]}


@app.get("/api/vies/cargos")
def cargos_vies():
    """Os cargos do filtro do atlas e os anos em que cada um foi disputado (eleicao_referencia)."""
    anos = defaultdict(list)
    for r in consultar("SELECT ano_eleitoral, cargos FROM eleicao_referencia ORDER BY 1"):
        for c in r["cargos"]:
            if c in CARGOS_VIES:
                anos[c].append(r["ano_eleitoral"])
    return [{"cod": c, "nome": nome, "anos": anos.get(c, []), "municipal": c in (11, 13)} for c, nome in CARGOS_VIES.items()]


@app.get("/api/ufs")
def listar_ufs(cargo: int | None = None, turno: int = 1):
    por_uf = vies_ufs(cargo_de(cargo), turno_de(turno))
    return [{**uf, "carregada": s in carregadas(), "vies": por_uf.get(uf["cd_ibge"], VAZIO)["vies"],
             "alinhamento": por_uf.get(uf["cd_ibge"], VAZIO)["alinhamento"]}
            for s, uf in sorted(UFS.items())]


@app.get("/api/ufs/{sigla}")
def detalhar_uf(sigla: str, cargo: int | None = None, turno: int = 1):
    return detalhe_uf(uf_de(sigla)["sigla"], cargo_de(cargo), turno_de(turno))


@lru_cache(maxsize=48)
@em_disco
def detalhe_uf(sigla: str, cargo: int | None = None, turno: int = 1) -> dict:
    uf = UFS[sigla]
    linhas = so_do_cargo(indice_vies(turno)[0].get(uf["cd_ibge"], []), cargo)
    estado = vies(linhas, lambda r: 0).get(0, VAZIO)
    por_regiao = vies(linhas, lambda r: MUNICIPIOS.get(r["cd_ibge"], {}).get("regiao_intermediaria"))
    por_municipio = vies(linhas, lambda r: r["cd_ibge"])
    aptos = defaultdict(dict)
    for r in consultar("""
            SELECT m.cd_ibge, e.ano, max(v.qt_aptos) AS aptos
            FROM votacao_municipio v
            JOIN eleicao e ON e.id_eleicao = v.id_eleicao
            JOIN municipio m ON m.cd_municipio = v.cd_municipio
            WHERE m.cd_uf = %s AND e.turno = 1 AND e.tipo <> 1
            GROUP BY 1, 2""", (uf["cd_ibge"],)):
        aptos[r["cd_ibge"]][str(r["ano"])] = r["aptos"]
    municipios = {ibge: m for ibge, m in MUNICIPIOS.items() if m["sg_uf"] == sigla}
    regioes = sorted({m["regiao_intermediaria"] for m in municipios.values()}, key=sem_acento)
    return {
        "sigla": sigla, "cd_ibge": uf["cd_ibge"], "nome": uf["nome"], "regiao": uf["regiao"], "cargo": cargo, "turno": turno,
        "carregada": sigla in carregadas(), "vies": estado["vies"], "sem_vies_pct": estado["sem_vies_pct"],
        "alinhamento": estado["alinhamento"], "sem_alinhamento_pct": estado["sem_alinhamento_pct"],
        "regioes": [{"nome": r, "vies": por_regiao.get(r, VAZIO)["vies"]} for r in regioes],
        "municipios": [{"ibge": ibge, "nome": m["municipio"], "regiao": m["regiao_intermediaria"],
                        "vies": por_municipio.get(ibge, VAZIO)["vies"],
                        "alinhamento": por_municipio.get(ibge, VAZIO)["alinhamento"], "aptos": aptos.get(ibge, {})}
                       for ibge, m in municipios.items()],
    }


# De onde vem o viés de uma UF num ano (P7): cada partido com os votos válidos que recebeu no estado
# (nominais + legenda, cargos de eleicao_referencia, 1º turno), o viés naquela eleição e quanto ele
# puxa a média; e, dentro de cada partido, os candidatos mais votados no estado.
SQL_COMPOSICAO_PARTIDOS = """
SELECT p.sigla, max(p.nome) AS nome, CASE v.cod_cargo WHEN 8 THEN 7 ELSE v.cod_cargo END AS cod_cargo, sum(v.qt_votos_validos) AS votos, max(o.vies)::float AS vies
FROM votacao_partido_municipio v
JOIN eleicao_referencia r ON r.ano_eleitoral = v.ano_eleicao AND v.cod_cargo = ANY (r.cargos)
JOIN partido p   ON p.id_partido = v.id_partido
JOIN municipio m ON m.cd_municipio = v.cd_municipio
LEFT JOIN vies_partido_onda o ON o.ano_eleitoral = v.ano_eleicao AND o.numero = p.numero AND o.sigla = p.sigla
WHERE m.cd_uf = %(cd_uf)s AND v.ano_eleicao = %(ano)s AND (%(cargo)s::int IS NULL OR v.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END))
GROUP BY p.sigla, 3
HAVING sum(v.qt_votos_validos) > 0
"""
SQL_COMPOSICAO_CANDIDATOS = """
SELECT pe.id_politico AS id, po.nome, pa.sigla AS partido, c.nome AS cargo, sum(v.votos)::bigint AS votos,
       bool_or(ma.id_mandato IS NOT NULL) AS eleito, max(pe.sq_candidato) AS sq, max(e.cd_municipio) AS cd_mun,
       COALESCE(max(u.sigla), max(um.sigla), 'BR') AS uf, max(mm.nm_municipio) AS local
FROM votos_candidato_uf v                     -- pré-somado por UF (migração 012)
JOIN politico_eleicao pe ON pe.id_politico_eleicao = v.id_politico_eleicao
JOIN eleicao e           ON e.id_eleicao = pe.id_eleicao
JOIN politico po         ON po.id_politico = pe.id_politico
JOIN cargo c             ON c.cod_cargo = e.cod_cargo
LEFT JOIN partido pa     ON pa.id_partido = pe.id_partido
LEFT JOIN mandato ma     ON ma.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN uf u           ON u.cd_ibge = e.cd_uf
LEFT JOIN municipio mm   ON mm.cd_municipio = e.cd_municipio
LEFT JOIN uf um          ON um.cd_ibge = mm.cd_uf
WHERE v.cd_uf = %(cd_uf)s AND v.ano = %(ano)s AND (%(cargo)s::int IS NULL OR e.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END))
GROUP BY pe.id_politico_eleicao, pe.id_politico, po.nome, pa.sigla, c.nome
"""
CANDIDATOS_POR_PARTIDO = 6


def candidato_composicao(c: dict, ano: int) -> dict:
    return {"id": c["id"], "nome": c["nome"], "cargo": c["cargo"], "local": c["local"], "votos": c["votos"],
            "eleito": c["eleito"], "foto": foto_url(ano, c["uf"], c["sq"], c["cd_mun"])}


@lru_cache(maxsize=8)
@em_disco
def candidatos_por_partido(sigla: str, ano: int, cargo: int | None) -> dict[str, list]:
    """Os candidatos de cada partido no estado, os mais votados primeiro (para a lista e a busca de #11)."""
    candidatos: dict[str, list] = defaultdict(list)
    for c in consultar(SQL_COMPOSICAO_CANDIDATOS, {"cd_uf": UFS[sigla]["cd_ibge"], "ano": ano, "cargo": cargo}):
        candidatos[c["partido"]].append({**c, "busca": sem_acento(c["nome"])})
    return {p: sorted(lista, key=lambda c: -c["votos"]) for p, lista in candidatos.items()}


@lru_cache(maxsize=32)
@em_disco
def composicao_vies(sigla: str, ano: int, cargo: int | None = None) -> dict:
    cd_uf = UFS[sigla]["cd_ibge"]
    linhas = consultar(SQL_COMPOSICAO_PARTIDOS, {"cd_uf": cd_uf, "ano": ano, "cargo": cargo})
    # cargos com peso igual: o partido puxa, em cada cargo, viés x sua fatia dos votos com viés daquele cargo
    com_vies: dict[int, int] = defaultdict(int)
    for r in linhas:
        if r["vies"] is not None:
            com_vies[r["cod_cargo"]] += r["votos"]
    n_cargos = sum(1 for v in com_vies.values() if v)
    partidos: dict[str, dict] = {}
    for r in linhas:
        p = partidos.setdefault(r["sigla"], {"sigla": r["sigla"], "nome": r["nome"], "vies": r["vies"],
                                             "votos": 0, "contribuicao": 0.0})
        p["votos"] += r["votos"]
        if r["vies"] is not None and com_vies[r["cod_cargo"]]:
            p["contribuicao"] += r["vies"] * r["votos"] / com_vies[r["cod_cargo"]] / n_cargos
    total = sum(p["votos"] for p in partidos.values())
    candidatos = candidatos_por_partido(sigla, ano, cargo)
    saida = []
    for p in sorted(partidos.values(), key=lambda p: -p["votos"]):
        lista = candidatos.get(p["sigla"], [])
        nominais = sum(c["votos"] for c in lista)
        saida.append({
            "sigla": p["sigla"], "nome": p["nome"], "vies": round(p["vies"], 1) if p["vies"] is not None else None,
            "votos": p["votos"], "pct": round(100 * p["votos"] / total, 2),
            "contribuicao": round(p["contribuicao"], 2),   # pontos que o partido soma ao viés (0 se sem viés)
            "nominais": nominais, "legenda": max(0, p["votos"] - nominais), "candidatos_total": len(lista),
            "candidatos": [candidato_composicao(c, ano) for c in lista[:CANDIDATOS_POR_PARTIDO]],
        })
    vies_uf = sum(p["contribuicao"] for p in partidos.values()) if n_cargos else None
    return {"uf": sigla, "ano": ano, "cargo": cargo, "votos": total,
            "vies": round(vies_uf, 1) if vies_uf is not None else None, "partidos": saida}


def _uf_ano(sigla: str, ano: int) -> str:
    uf = uf_de(sigla)["sigla"]
    if uf not in carregadas():
        raise HTTPException(404, f"UF sem dados: {uf}")
    if ano not in ANOS:
        raise HTTPException(404, f"Ano fora da P7: {ano}")
    return uf


@app.get("/api/ufs/{sigla}/composicao")
def composicao(sigla: str, ano: int, cargo: int | None = None):
    return composicao_vies(_uf_ano(sigla, ano), ano, cargo_de(cargo))


@app.get("/api/ufs/{sigla}/composicao/{partido}")
def candidatos_do_partido(sigla: str, partido: str, ano: int, cargo: int | None = None, q: str = "",
                          desde: int = Query(0, ge=0), limite: int = Query(6, ge=1, le=60)):
    """#11: os candidatos de um partido no estado, os mais votados primeiro, com busca pelo nome (sem acento)."""
    lista = candidatos_por_partido(_uf_ano(sigla, ano), ano, cargo_de(cargo)).get(partido.upper(), [])
    termo = sem_acento(q.strip())
    achados = [c for c in lista if termo in c["busca"]] if termo else lista
    return {"partido": partido.upper(), "total": len(lista), "achados": len(achados), "desde": desde,
            "candidatos": [candidato_composicao(c, ano) for c in achados[desde:desde + limite]]}


@app.get("/api/municipios")
def buscar_municipios(q: str = "", uf: str = "", limite: int = Query(8, ge=1, le=100)):
    q, uf = sem_acento(q.strip()), uf.upper()
    if len(q) < 2:
        return []
    achados = sorted((not nome.startswith(q), nome, ibge) for nome, ibge in BUSCA
                     if q in nome and (not uf or MUNICIPIOS[ibge]["sg_uf"] == uf))
    return [{"ibge": ibge, "nome": MUNICIPIOS[ibge]["municipio"], "uf": MUNICIPIOS[ibge]["sg_uf"],
             "carregada": MUNICIPIOS[ibge]["sg_uf"] in carregadas()} for _, _, ibge in achados[:limite]]


@app.get("/api/municipios/{ibge}")
def detalhar_municipio(ibge: int, cargo: int | None = None, turno: int = 1):
    if ibge not in MUNICIPIOS:
        raise HTTPException(404, f"Município desconhecido: {ibge}")
    return detalhe_municipio(ibge, cargo_de(cargo), turno_de(turno))


# As zonas eleitorais do município: o eleitorado, quem foi votar e o mais votado (prefeito nos anos municipais,
# presidente nos gerais). O TSE não publica a seção de cada eleitor em dados abertos: a página leva à consulta oficial.
SQL_ZONAS = """
WITH z AS (SELECT id_zona, numero FROM zona_eleitoral WHERE cd_municipio = %(cd)s),
perfil AS (
    SELECT id_zona, sum(qtd_eleitores)::int AS aptos, sum(qtd_comparecimento)::int AS foram,
           (sum(qtd_comparecimento) FILTER (WHERE ds_grau_escolaridade = 'SUPERIOR COMPLETO'))::int AS superior
    FROM perfil_eleitorado_munzona
    WHERE id_zona IN (SELECT id_zona FROM z) AND ano_eleicao = %(ano)s
    GROUP BY id_zona
),
votos AS (
    SELECT v.id_zona, pe.id_politico, pe.nm_urna, pa.sigla, v.qtd_votos_nominais AS votos,
           sum(v.qtd_votos_nominais) OVER (PARTITION BY v.id_zona) AS total,
           row_number() OVER (PARTITION BY v.id_zona ORDER BY v.qtd_votos_nominais DESC) AS r
    FROM votacao_candidato_munzona v
    JOIN eleicao e           ON e.id_eleicao = v.id_eleicao
    JOIN politico_eleicao pe ON pe.id_politico_eleicao = v.id_politico_eleicao
    LEFT JOIN partido pa     ON pa.id_partido = pe.id_partido
    WHERE v.id_zona IN (SELECT id_zona FROM z) AND e.ano = %(ano)s AND e.turno = 1 AND e.tipo = 2 AND e.cod_cargo = %(cargo)s
)
SELECT z.numero, p.aptos, p.foram, p.superior, vt.id_politico, vt.nm_urna, vt.sigla, vt.votos, vt.total::int AS total
FROM z
LEFT JOIN perfil p ON p.id_zona = z.id_zona
LEFT JOIN votos vt ON vt.id_zona = z.id_zona AND vt.r = 1
ORDER BY z.numero
"""


@app.get("/api/municipios/{ibge}/zonas")
def zonas_municipio(ibge: int, ano: int):
    if ibge not in MUNICIPIOS:
        raise HTTPException(404, f"Município desconhecido: {ibge}")
    if ano not in ANOS:
        raise HTTPException(404, f"Sem eleição em {ano}")
    cd = consultar("SELECT cd_municipio FROM municipio WHERE cd_ibge = %s", (ibge,))[0]["cd_municipio"]
    cargo = 11 if ano % 4 == 0 else 1
    return {"ano": ano, "cargo": CARGOS_P1.get(cargo, "Presidente"), "zonas": consultar(SQL_ZONAS, {"cd": cd, "ano": ano, "cargo": cargo})}


# Partidos votados no município em cada ano, com o viés daquela eleição (NULL = sem viés, vão para o fim).
SQL_ESPECTRO = """
SELECT v.ano_eleicao AS ano, p.sigla, p.nome, p.numero, round(max(o.vies), 1)::float AS vies,
       sum(v.qt_votos_validos) AS votos
FROM votacao_partido_municipio v
JOIN eleicao_referencia r ON r.ano_eleitoral = v.ano_eleicao AND v.cod_cargo = ANY (r.cargos)
JOIN partido p ON p.id_partido = v.id_partido
LEFT JOIN vies_partido_onda o ON o.ano_eleitoral = v.ano_eleicao AND o.numero = p.numero AND o.sigla = p.sigla
WHERE v.cd_municipio = %s AND v.ano_eleicao = ANY(%s) AND (%s::int IS NULL OR v.cod_cargo = %s)
GROUP BY v.ano_eleicao, p.id_partido
HAVING sum(v.qt_votos_validos) > 0
ORDER BY 1, vies NULLS LAST, votos DESC
"""

# Presidente nos anos gerais, prefeito nos municipais; 1º turno das eleições ordinárias.
SQL_COMPARECIMENTO = f"""
SELECT e.ano, v.qt_aptos AS aptos, v.qt_comparecimento AS comparecimento, v.qt_brancos AS brancos,
       v.qt_nulos AS nulos, v.qt_abstencoes AS abstencoes
FROM votacao_municipio v
JOIN eleicao e ON e.id_eleicao = v.id_eleicao
WHERE v.cd_municipio = %s AND e.turno = 1 AND e.tipo <> 1 AND e.cod_cargo IN ({PRESIDENTE}, {PREFEITO})
ORDER BY e.ano
"""

SQL_PREFEITOS = f"""
SELECT e.ano, p.nome, p.id_politico, pa.sigla AS partido, es.turno, pe.sq_candidato AS sq, e.cd_municipio
FROM eleicao e
JOIN politico_eleicao pe ON pe.id_eleicao = e.id_eleicao
JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
JOIN eleicao es ON es.id_eleicao = ma.id_eleicao
JOIN politico p ON p.id_politico = pe.id_politico
JOIN partido pa ON pa.id_partido = ma.id_partido
WHERE e.cd_municipio = %s AND e.cod_cargo = {PREFEITO} AND e.tipo <> 1
ORDER BY e.ano
"""


@lru_cache(maxsize=128)
@em_disco
def detalhe_municipio(ibge: int, cargo: int | None = None, turno: int = 1) -> dict:
    m = MUNICIPIOS[ibge]
    uf = UFS[m["sg_uf"]]
    base = {"ibge": ibge, "nome": m["municipio"], "uf": m["sg_uf"], "uf_nome": m["uf"],
            "regiao_intermediaria": m["regiao_intermediaria"], "regiao_imediata": m["regiao_imediata"],
            "carregada": m["sg_uf"] in carregadas(), "cargo": cargo, "turno": turno}
    cd = base["carregada"] and consultar("SELECT cd_municipio FROM municipio WHERE cd_ibge = %s", (ibge,))
    if not cd:
        return {**base, "vies": {}, "vies_uf": {}, "sem_vies_pct": {}, "alinhamento": {}, "alinhamento_uf": {},
                "espectro": {}, "indicadores": {}, "comparecimento": {}, "prefeitos": [], "cadeiras": []}
    cd = cd[0]["cd_municipio"]

    v = vies(so_do_cargo(indice_vies(turno)[1].get(ibge, []), cargo), lambda r: 0).get(0, VAZIO)
    espectro = defaultdict(list)
    for r in consultar(SQL_ESPECTRO, (cd, ANOS, cargo, cargo)):
        espectro[str(r.pop("ano"))].append(r)
    for partidos in espectro.values():
        total = sum(p["votos"] for p in partidos)
        for p in partidos:
            p["pct"] = round(100 * p["votos"] / total, 1)

    comparecimento = {}
    for r in consultar(SQL_COMPARECIMENTO, (cd,)):
        ano = str(r.pop("ano"))
        comparecimento[ano] = {**r, "isentos_pct": round(100 * (r["brancos"] + r["nulos"] + r["abstencoes"])
                                                         / r["aptos"], 1) if r["aptos"] else None}

    do_uf = vies_ufs(cargo, turno).get(uf["cd_ibge"], VAZIO)
    return {**base, "vies": v["vies"], "vies_uf": do_uf["vies"], "sem_vies_pct": v["sem_vies_pct"],
            "alinhamento": v["alinhamento"], "alinhamento_uf": do_uf["alinhamento"], "espectro": espectro,
            "indicadores": indicadores(cd, comparecimento), "comparecimento": comparecimento,
            "prefeitos": prefeitos(cd, m["sg_uf"]), "cadeiras": cadeiras_municipio(ibge, m["sg_uf"])}


def cadeiras_municipio(ibge: int, uf: str) -> list[dict]:
    """P1 no boletim: custo da cadeira de prefeito e de vereador no município."""
    out = []
    for ano in (2020, 2024):
        for cargo in (11, 13):
            r = resumo_cadeira(campanhas(ano, cargo, (uf,), ibge))
            if r["cadeiras"]:
                out.append({"ano": ano, "cod_cargo": cargo, "cargo": CARGOS_P1[cargo], "fator_ipca": ipca()[ano], **r})
    return out


def prefeitos(cd_municipio: int, uf: str) -> list[dict]:
    linhas = consultar(SQL_PREFEITOS, (cd_municipio,))
    for r in linhas:
        r["foto"] = foto_url(r["ano"], uf, r.pop("sq"), r.pop("cd_municipio"))
    return linhas


def indicadores(cd_municipio: int, comparecimento: dict) -> dict:
    anos = consultar("SELECT ano, idhm, pib, populacao FROM indices_municipio WHERE cd_municipio = %s ORDER BY ano",
                     (cd_municipio,))
    pop = {r["ano"]: r["populacao"] for r in anos if r["populacao"]}
    pib = [r for r in anos if r["pib"] is not None]
    idhm = [r for r in anos if r["idhm"] is not None]
    out = {"pib_per_capita": None, "idhm": None, "populacao": None, "eleitores_populacao": None, "isentos": None}
    if pib and pop:
        # Ano mais recente com PIB e população; sem nenhum, o PIB mais recente com a população do ano mais próximo.
        r = max(pib, key=lambda r: (r["ano"] in pop, r["ano"]))
        perto = min(pop, key=lambda a: (abs(a - r["ano"]), a))
        out["pib_per_capita"] = {"valor": round(float(r["pib"]) * 1000 / pop[perto], 2), "ano": r["ano"]}
    if idhm:
        out["idhm"] = {"valor": float(idhm[-1]["idhm"]), "ano": idhm[-1]["ano"]}
    if pop:
        ano = max(pop)
        out["populacao"] = {"valor": pop[ano], "ano": ano}
    eleicoes = [int(a) for a, c in comparecimento.items() if int(a) in pop and c["aptos"]]
    if eleicoes:
        ano = max(eleicoes)
        out["eleitores_populacao"] = {"valor": round(100 * comparecimento[str(ano)]["aptos"] / pop[ano], 1), "ano": ano}
    if comparecimento:
        ano = max(comparecimento)
        out["isentos"] = {"valor": comparecimento[ano]["isentos_pct"], "ano": int(ano)}
    return out


# ───────── Fotos dos candidatos (python -m crawler --fotos) ─────────
# Ficam nos zips do TSE, um por eleição e UF; cada foto é lida do zip pelo SQ_CANDIDATO.

# Abrir um zip municipal grande (SP 2020: ~90 mil fotos, 2 GB) lê o diretório inteiro dele: ~0,5 s cada,
# e um boletim passa por vários anos. O índice de cada zip (chave -> onde a foto está dentro dele) fica em
# dados/cache_api/fotos, pelo tamanho e data do zip; a foto é lida direto da posição, sem abrir o zip.
def _zip_fotos(ano: int, uf: str) -> Path:
    return DADOS / PASTA_FOTOS / str(ano) / f"foto_cand{ano}_{uf}_div.zip"


@lru_cache(maxsize=48)
def indice_zip(ano: int, uf: str) -> dict[str, tuple[int, int, int, str]] | None:
    """chave da foto -> (posição do cabeçalho local, tamanho comprimido, método, extensão)."""
    caminho = _zip_fotos(ano, uf)
    if not caminho.exists():
        return None
    st = caminho.stat()
    guardado = CACHE_API / "fotos" / f"{ano}_{uf}_{st.st_size}_{st.st_mtime_ns}.pkl"
    try:
        return pickle.loads(guardado.read_bytes())
    except (OSError, pickle.UnpicklingError, EOFError):
        pass
    with zipfile.ZipFile(caminho) as z:
        onde = {i.filename: (i.header_offset, i.compress_size, i.compress_type) for i in z.infolist()}
    indice = {chave: (*onde[nome], nome.rsplit(".", 1)[-1].lower()) for chave, nome in indice_fotos(list(onde)).items()}
    try:
        guardado.parent.mkdir(parents=True, exist_ok=True)
        for velho in guardado.parent.glob(f"{ano}_{uf}_*.pkl"):
            velho.unlink()
        guardado.write_bytes(pickle.dumps(indice, protocol=pickle.HIGHEST_PROTOCOL))
    except OSError:
        pass
    return indice


def ler_foto(caminho: Path, posicao: int, tamanho: int, metodo: int) -> bytes:
    """Lê uma foto do zip pela posição: cabeçalho local (30 bytes + nome + extra) e os dados."""
    with open(caminho, "rb") as f:
        f.seek(posicao)
        cabecalho = f.read(30)
        if cabecalho[:4] != b"PK":
            raise HTTPException(500, "Zip de fotos corrompido")
        nome, extra = struct.unpack("<HH", cabecalho[26:30])
        f.seek(posicao + 30 + nome + extra)
        dados = f.read(tamanho)
    if metodo == zipfile.ZIP_STORED:
        return dados
    if metodo == zipfile.ZIP_DEFLATED:
        return zlib.decompress(dados, -15)
    raise HTTPException(500, f"Compressão não suportada no zip de fotos: {metodo}")


def foto_url(ano, uf, sq, cd_municipio=None) -> str | None:
    """URL da foto da candidatura, ou None se o TSE não publicou (antes de 2004) ou não foi baixada.
    Em 2004 o SQ só é único no município, então a chave leva o código TSE do município."""
    if not (ano and sq):
        return None
    uf, ano = uf or "BR", int(ano)   # sem UF: Presidente
    chave = chave_foto(sq, cd_municipio if ano == 2004 else None)
    indice = indice_zip(ano, uf)
    return f"/api/fotos/{ano}/{uf}/{chave}" if indice and chave in indice else None


@app.get("/api/fotos/{ano}/{uf}/{chave}")
def foto(ano: int, uf: str, chave: str):
    uf = uf.upper()
    indice = indice_zip(ano, uf)
    achado = indice and indice.get(chave)
    if not achado:
        raise HTTPException(404, "Foto não encontrada")
    posicao, tamanho, metodo, ext = achado
    tipo = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "bmp": "image/bmp", "gif": "image/gif"}[ext]
    return Response(ler_foto(_zip_fotos(ano, uf), posicao, tamanho, metodo), media_type=tipo,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


# ───────── Políticos (nunca expõe CPF, título eleitoral nem data de nascimento completa) ─────────

# Filtra pelos trigramas do nome sem acento (índice politico_nome_trgm, migração 010). A ordem vem de
# `ordem` (ORDENS): por relevância, word_similarity primeiro; entre os empatados, quem disputou o cargo mais
# alto (menor código: presidente, governador, senador...) e depois quem tem mais candidaturas. Sem o cargo,
# "dilma" punha a Dilma Rousseff (2 candidaturas a presidente) atrás de vereadoras com 3 a 6. As outras
# ordens põem antes quem tem uma palavra começando pelo texto buscado ("dilma" acha DILMA, não ADILMA).
# ponytail: nomes genéricos ("jose", "maria") casam dezenas de milhares de linhas e levam ~0,7-0,9 s.
SQL_RESUMO_ACHADOS = """
SELECT a.id_politico AS id, a.nome, extract(year FROM a.dt_nascimento)::int AS nascimento_ano,
       array_remove(array_agg(DISTINCT COALESCE(u.sigla, um.sigla)), NULL) AS ufs,
       min(e.ano) AS primeiro_ano, max(e.ano) AS ultimo_ano,
       count(DISTINCT pe.id_eleicao) AS candidaturas,
       count(DISTINCT pe.id_eleicao) FILTER (WHERE ma.id_mandato IS NOT NULL) AS vitorias,
       (array_agg(e.ano || '|' || COALESCE(u.sigla, um.sigla, 'BR') || '|' || pe.sq_candidato || '|' || COALESCE(e.cd_municipio, 0)
                  ORDER BY e.ano DESC))[1] AS ultima
FROM achados a
JOIN politico_eleicao pe ON pe.id_politico = a.id_politico
JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
LEFT JOIN uf um ON um.cd_ibge = m.cd_uf
LEFT JOIN uf u ON u.cd_ibge = e.cd_uf
LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
GROUP BY a.id_politico, a.nome, a.dt_nascimento, a.pos
ORDER BY a.pos
"""

# Colunas de `base` usadas aqui: contem, nome, ws, sim, topo (menor cod_cargo), ultimo (ano mais recente),
# n (candidaturas) e v (vitórias; só na busca com filtros, onde a relevância sem nome é "quem mais venceu").
ORDENS = {
    "nome": "contem DESC, nome, id_politico",
    "eleicao": "contem DESC, ultimo DESC, ws DESC, topo, n DESC, id_politico",
    "cargo": "contem DESC, topo, ultimo DESC, n DESC, id_politico",
}
RELEVANCIA = "ws DESC, topo, n DESC, sim DESC, id_politico"
RELEVANCIA_FILTRADA = "ws DESC, v DESC, n DESC, nome, id_politico"

ACHADOS = """
achados AS (
    SELECT id_politico, nome, dt_nascimento, row_number() OVER (ORDER BY {ordem}) AS pos
    FROM base ORDER BY pos LIMIT %(limite)s
)
"""

SQL_BUSCA_POLITICOS = """
WITH busca AS (SELECT f_unaccent(upper(%(q)s)) AS q),
base AS (            -- politico_busca (migração 019): o resumo de cada político já contado
    SELECT id_politico, nome, dt_nascimento, topo, n, ultimo,
           word_similarity(busca.q, nome_busca) AS ws,
           similarity(nome_busca, busca.q) AS sim,
           ' ' || nome_busca LIKE '%% ' || busca.q || '%%' AS contem
    FROM politico_busca, busca
    WHERE nome_busca %% busca.q OR nome_busca LIKE '%%' || busca.q || '%%'
),""" + ACHADOS + SQL_RESUMO_ACHADOS

# Atalho para nomes comuns: quem tem o termo como palavra inteira no nome tem word_similarity 1, o máximo; se
# eles já enchem a página, a ordem é a da relevância sem calcular a semelhança de ~370 mil nomes ("SILVA":
# de 2,2 s para ~0,15 s). Sem achados suficientes, vale a busca completa, que com poucos achados é rápida.
SQL_BUSCA_PALAVRA = """
WITH busca AS (SELECT f_unaccent(upper(%(q)s)) AS q),
base AS (
    SELECT id_politico, nome, dt_nascimento, topo, n, ultimo
    FROM politico_busca, busca
    WHERE nome_busca LIKE '%%' || busca.q || '%%' AND ' ' || nome_busca || ' ' LIKE '%% ' || busca.q || ' %%'
),""" + ACHADOS.format(ordem="topo, n DESC, ultimo DESC, id_politico") + SQL_RESUMO_ACHADOS


# Busca com filtros (P10): a pessoa entra se tiver ao menos uma candidatura que bata com todos os
# filtros ao mesmo tempo ("candidatou-se a senador, em 2022, no PI, pelo PT, e foi eleita"). O nome
# é opcional; sem ele, por relevância vêm primeiro os que mais venceram nas candidaturas que batem.
# Cargo e eleição, aqui, olham só as candidaturas que batem com os filtros.
FILTROS_CANDIDATURA = {
    "uf": "COALESCE(u.sigla, um.sigla) = %(uf)s",
    "cargo": "e.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END)",
    "ano": "e.ano = %(ano)s",
    "partido": "pa.sigla = %(partido)s",
    "resultado": "(ma.id_mandato IS NOT NULL) = %(resultado)s",
}
CARGOS_BUSCA = {1: "Presidente", 3: "Governador", 5: "Senador", 6: "Deputado federal", 7: "Deputado estadual",
                11: "Prefeito", 13: "Vereador"}

SQL_BUSCA_FILTRADA = """
WITH cand AS (
    SELECT pe.id_politico, count(*) AS n, count(ma.id_mandato) AS v, min(e.cod_cargo) AS topo, max(e.ano) AS ultimo
    FROM politico_eleicao pe
    JOIN eleicao e        ON e.id_eleicao = pe.id_eleicao
    LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
    LEFT JOIN uf um       ON um.cd_ibge = m.cd_uf
    LEFT JOIN uf u        ON u.cd_ibge = e.cd_uf
    LEFT JOIN mandato ma  ON ma.id_politico_eleicao = pe.id_politico_eleicao
    LEFT JOIN partido pa  ON pa.id_partido = pe.id_partido
    WHERE e.tipo <> 1 AND {condicoes}
    GROUP BY pe.id_politico
),
base AS (
    SELECT p.id_politico, p.nome, p.dt_nascimento, {ws} AS ws, {contem} AS contem, c.n, c.v, c.topo, c.ultimo
    FROM cand c
    JOIN politico p ON p.id_politico = c.id_politico
    {nome}
),""" + ACHADOS + SQL_RESUMO_ACHADOS
NOME_FILTRO = """WHERE f_unaccent(upper(p.nome)) %% f_unaccent(upper(%(q)s))
       OR f_unaccent(upper(p.nome)) LIKE '%%' || f_unaccent(upper(%(q)s)) || '%%'"""
NOME_WS = "word_similarity(f_unaccent(upper(%(q)s)), f_unaccent(upper(p.nome)))"
NOME_CONTEM = "' ' || f_unaccent(upper(p.nome)) LIKE '%% ' || f_unaccent(upper(%(q)s)) || '%%'"


def _com_foto(achados: list[dict]) -> list[dict]:
    for r in achados:
        r["foto"] = foto_url(*r.pop("ultima").split("|"))   # foto da candidatura mais recente
    return achados


@lru_cache(maxsize=512)
def busca_filtrada(q: str, filtros: tuple, limite: int, ordem: str) -> list[dict]:
    f = dict(filtros)
    sql = SQL_BUSCA_FILTRADA.format(
        condicoes=" AND ".join(FILTROS_CANDIDATURA[k] for k in f),
        ws=NOME_WS if q else "0", contem=NOME_CONTEM if q else "true", nome=NOME_FILTRO if q else "",
        ordem=ORDENS.get(ordem, RELEVANCIA_FILTRADA))
    return _com_foto(consultar(sql, {**f, "q": q, "limite": limite}))


@lru_cache(maxsize=1)
def partidos_das_candidaturas() -> list[dict]:
    return consultar("""
        SELECT pa.sigla, count(*) AS candidaturas, round(avg(pa.vies_politico)::numeric, 1)::float AS vies
        FROM politico_eleicao pe JOIN partido pa ON pa.id_partido = pe.id_partido
        GROUP BY pa.sigla ORDER BY pa.sigla""")


@app.get("/api/partidos")
def listar_partidos():
    """Siglas usadas nas candidaturas carregadas (para o filtro da busca)."""
    return partidos_das_candidaturas()


# Uma linha por disputa: o mesmo político às vezes tem duas candidaturas na mesma eleição
# (registro substituído); fica a eleita ou a mais votada. Votos: os nominais do 1º turno.
SQL_CANDIDATURAS = """
SELECT * FROM (
    SELECT DISTINCT ON (pe.id_eleicao)
           pe.id_politico_eleicao AS id_candidatura, e.ano, c.nome AS cargo, e.cod_cargo,
           COALESCE(m.nm_municipio || ' - ' || um.sigla, u.sigla, 'BRASIL') AS local,
           COALESCE(u.sigla, um.sigla) AS uf, m.cd_ibge AS municipio_ibge,
           pa.sigla AS partido, pa.vies_politico AS vies, pe.nr_candidato AS numero, pe.nm_urna AS nome_urna,
           COALESCE(ma.ds_situacao, 'NÃO ELEITO') AS situacao,
           cp.despesa::float AS gasto,
           ma.id_mandato IS NOT NULL AS eleito, es.turno,
           (SELECT sum(v.qtd_votos_nominais) FROM votacao_candidato_munzona v
            WHERE v.id_politico_eleicao = pe.id_politico_eleicao AND v.id_eleicao = pe.id_eleicao) AS votos,
           e.tipo = 1 AS suplementar, COALESCE(e.cd_municipio, -e.cd_uf) AS unidade, pe.sq_candidato AS sq, e.cd_municipio AS cd_mun
    FROM politico_eleicao pe
    JOIN eleicao e        ON e.id_eleicao = pe.id_eleicao
    JOIN cargo c          ON c.cod_cargo = e.cod_cargo
    LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
    LEFT JOIN uf um       ON um.cd_ibge = m.cd_uf
    LEFT JOIN uf u        ON u.cd_ibge = e.cd_uf
    LEFT JOIN mandato ma  ON ma.id_politico_eleicao = pe.id_politico_eleicao
    LEFT JOIN partido pa  ON pa.id_partido = COALESCE(pe.id_partido, ma.id_partido)
    LEFT JOIN eleicao es  ON es.id_eleicao = ma.id_eleicao
    LEFT JOIN campanha cp ON cp.id_politico_eleicao = pe.id_politico_eleicao
    WHERE pe.id_politico = %s
    ORDER BY pe.id_eleicao, eleito DESC, votos DESC NULLS LAST
) c
ORDER BY ano, suplementar, cod_cargo
"""


@app.get("/api/politicos")
def buscar_politicos(q: str = "", uf: str = "", cargo: int | None = None, ano: int | None = None,
                     partido: str = "", resultado: str = "", limite: int = Query(8, ge=1, le=50),
                     ordem: str = "relevancia"):
    q = q.strip()
    filtros = {}
    if uf:
        if uf.upper() not in UFS:
            raise HTTPException(422, f"UF desconhecida: {uf}")
        filtros["uf"] = uf.upper()
    if cargo is not None:
        if cargo not in CARGOS_BUSCA:
            raise HTTPException(422, f"Cargo fora da busca: {cargo}")
        filtros["cargo"] = cargo
    if ano is not None:
        filtros["ano"] = ano
    if partido:
        filtros["partido"] = partido.upper()
    if resultado:
        if resultado not in ("eleito", "nao_eleito"):
            raise HTTPException(422, "resultado: eleito ou nao_eleito")
        filtros["resultado"] = resultado == "eleito"
    if ordem not in ("relevancia", *ORDENS):
        raise HTTPException(422, f"ordem: relevancia, {', '.join(ORDENS)}")
    if filtros:
        return busca_filtrada(q if len(q) >= 3 else "", tuple(sorted(filtros.items())), limite, ordem)
    if len(q) < 3:
        return []
    if ordem == "relevancia":
        achados = consultar(SQL_BUSCA_PALAVRA, {"q": q, "limite": limite})
        if len(achados) >= limite:
            return _com_foto(achados)
    sql = SQL_BUSCA_POLITICOS.format(ordem=ORDENS.get(ordem, RELEVANCIA))
    return _com_foto(consultar(sql, {"q": q, "limite": limite}))


@lru_cache(maxsize=1)
@em_disco
def veteranos() -> list[dict]:
    """Políticos com 5+ candidaturas e 2+ vitórias, sorteados pela tecla BRANCO da urna."""
    return consultar("""
        SELECT p.id_politico AS id, p.nome
        FROM politico p
        JOIN politico_eleicao pe ON pe.id_politico = p.id_politico
        LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
        GROUP BY p.id_politico
        HAVING count(*) >= 5 AND count(ma.id_mandato) >= 2""")


@app.get("/api/politicos/aleatorio")
def politico_aleatorio():
    return random.choice(veteranos())


# Taxa de reeleição (P10a), como em scripts/10a_taxa_reeleicao.py: dos eleitos para o cargo na UF
# (ou em seus municípios), quantos disputaram o mesmo cargo na mesma unidade na eleição ordinária
# seguinte (8 anos depois para senador) e quantos venceram. Só entram ciclos cuja eleição seguinte
# já está no banco.
SQL_REELEICAO = """
WITH cand AS (
    SELECT pe.id_politico, e.ano, COALESCE(e.cd_municipio, -e.cd_uf) AS unidade,
           bool_or(ma.id_mandato IS NOT NULL) AS eleito,
           -- foi ao 2º turno e ele ainda não está no banco (2026, até o TSE publicar): fica fora da conta
           bool_or(pe.ds_sit_tot_turno = '2º TURNO' AND ma.id_mandato IS NULL AND NOT EXISTS (
               SELECT 1 FROM eleicao e2 JOIN votacao_candidato_munzona v2 ON v2.id_eleicao = e2.id_eleicao
               WHERE e2.ano = e.ano AND e2.turno = 2 AND e2.tipo = e.tipo AND e2.cod_cargo = e.cod_cargo
                 AND e2.cd_uf IS NOT DISTINCT FROM e.cd_uf AND e2.cd_municipio IS NOT DISTINCT FROM e.cd_municipio)) AS pendente
    FROM politico_eleicao pe
    JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
    LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
    LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
    WHERE e.tipo <> 1 AND e.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END) AND COALESCE(m.cd_uf, e.cd_uf) = %(cd_uf)s
    GROUP BY 1, 2, 3
)
SELECT count(DISTINCT (a.id_politico, a.ano)) FILTER (WHERE b.id_politico IS NOT NULL AND NOT b.pendente) AS tentaram,
       count(DISTINCT (a.id_politico, a.ano)) FILTER (WHERE b.eleito) AS reeleitos
FROM cand a
LEFT JOIN cand b ON b.id_politico = a.id_politico AND b.unidade = a.unidade AND b.ano = a.ano + %(passo)s
WHERE a.eleito AND a.ano + %(passo)s <= (SELECT max(ano) FROM cand)
"""
CARGOS_TITULARES = {3, 5, 6, 7, 8, 11, 13}   # governador, senador, deputados, prefeito, vereador


@lru_cache(maxsize=256)
@em_disco
def taxa_reeleicao(cod_cargo: int, sigla: str) -> dict | None:
    cod_cargo = 7 if cod_cargo == 8 else cod_cargo   # o distrital (DF) entra como deputado estadual
    r = consultar(SQL_REELEICAO, {"cargo": cod_cargo, "cd_uf": UFS[sigla]["cd_ibge"],
                                  "passo": 8 if cod_cargo == SENADOR else 4})[0]
    if not r["tentaram"]:
        return None
    return {"tentaram": r["tentaram"], "reeleitos": r["reeleitos"], "taxa": round(100 * r["reeleitos"] / r["tentaram"], 1)}


# P10a completa, igual a scripts/10a_taxa_reeleicao.py (respostas/10a_taxa_reeleicao.txt): por cargo e
# ciclo (eleitos em Y, disputa em Y+4; senador, Y+8), quantos eleitos tentaram e quantos voltaram.
# Em 1994 e 1996 metade das candidaturas não tem título: o eleito sem título também se liga, na
# eleição seguinte, ao candidato do mesmo cargo e lugar com o mesmo nome normalizado ou com a mesma
# data de nascimento e o mesmo primeiro nome. Somado por município, para a média das taxas municipais.
CARGOS_P10 = {3: "Governador", 5: "Senador", 6: "Deputado federal", 7: "Deputado estadual", 11: "Prefeito", 13: "Vereador"}
MUNICIPAIS_P10 = {PREFEITO, 13}
NOME_P10 = ("regexp_replace(translate(upper(p.nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑZY', "
            "'AAAAAEEEEIIIIOOOOOUUUUCNSI'), '[^A-Z]', '', 'g')")
SQL_REELEICAO_UF = f"""
WITH cand AS (
    SELECT pe.id_politico, e.ano, (CASE e.cod_cargo WHEN 8 THEN 7 ELSE e.cod_cargo END) AS cod_cargo, e.cd_municipio,
           COALESCE(e.cd_municipio, -e.cd_uf) AS unidade,
           p.nr_titulo_eleitoral IS NULL AS sem_titulo, p.dt_nascimento,
           {NOME_P10} AS nome, split_part(upper(p.nome), ' ', 1) AS primeiro_nome,
           bool_or(ma.id_mandato IS NOT NULL) AS eleito,
           -- foi ao 2º turno e ele ainda não está no banco (2026, até o TSE publicar): nem venceu nem perdeu
           bool_or(pe.ds_sit_tot_turno = '2º TURNO' AND ma.id_mandato IS NULL AND NOT EXISTS (
               SELECT 1 FROM eleicao e2 JOIN votacao_candidato_munzona v2 ON v2.id_eleicao = e2.id_eleicao
               WHERE e2.ano = e.ano AND e2.turno = 2 AND e2.tipo = e.tipo AND e2.cod_cargo = e.cod_cargo
                 AND e2.cd_uf IS NOT DISTINCT FROM e.cd_uf AND e2.cd_municipio IS NOT DISTINCT FROM e.cd_municipio)) AS pendente
    FROM politico_eleicao pe
    JOIN politico p ON p.id_politico = pe.id_politico
    JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
    LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
    LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
    WHERE e.tipo <> 1 AND e.cod_cargo = ANY(%(cargos)s::int[] || CASE WHEN 7 = ANY(%(cargos)s::int[]) THEN ARRAY[8] ELSE ARRAY[]::int[] END) AND COALESCE(m.cd_uf, e.cd_uf) = %(cd_uf)s
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
),
proximo AS (
    SELECT DISTINCT cod_cargo, ano FROM cand
),
eleito AS (
    SELECT a.cod_cargo, a.ano AS ano_eleito, a.cd_municipio,
           a.ano + CASE WHEN a.cod_cargo = 5 THEN 8 ELSE 4 END AS ano_disputa,
           bool_or(b.id_politico IS NOT NULL) AS tentou, COALESCE(bool_or(b.eleito), false) AS reeleito,
           COALESCE(bool_or(b.pendente), false) AS pendente,
           COALESCE(bool_or(b.id_politico <> a.id_politico), false) AS ligado_por_nome,
           EXISTS (SELECT 1 FROM proximo x WHERE x.cod_cargo = a.cod_cargo
                     AND x.ano = a.ano + CASE WHEN a.cod_cargo = 5 THEN 8 ELSE 4 END) AS ha_proxima
    FROM cand a
    LEFT JOIN cand b ON b.cod_cargo = a.cod_cargo AND b.unidade = a.unidade
                    AND b.ano = a.ano + CASE WHEN a.cod_cargo = 5 THEN 8 ELSE 4 END
                    AND (b.id_politico = a.id_politico
                         OR (a.sem_titulo AND (b.nome = a.nome
                             OR (b.dt_nascimento = a.dt_nascimento AND b.primeiro_nome = a.primeiro_nome))))
    WHERE a.eleito
    GROUP BY a.id_politico, a.cod_cargo, a.ano, a.cd_municipio, a.unidade
)
SELECT cod_cargo, ano_eleito, ano_disputa, cd_municipio, ha_proxima,
       count(*) AS eleitos, count(*) FILTER (WHERE tentou AND NOT pendente) AS tentaram,
       count(*) FILTER (WHERE reeleito) AS reeleitos, count(*) FILTER (WHERE ligado_por_nome) AS ligados,
       count(*) FILTER (WHERE tentou AND pendente) AS pendentes
FROM eleito
GROUP BY 1, 2, 3, 4, 5
"""


def _soma_reeleicao(linhas: list[dict]) -> dict:
    eleitos, tentaram, reeleitos = (sum(r[k] for r in linhas) for k in ("eleitos", "tentaram", "reeleitos"))
    return {"eleitos": eleitos, "tentaram": tentaram, "reeleitos": reeleitos, "pendentes": sum(r["pendentes"] for r in linhas),
            "taxa": round(100 * reeleitos / tentaram, 1) if tentaram else None}


def _media_municipal(linhas: list[dict]) -> float | None:
    """Média simples das taxas dos municípios (só os municípios em que alguém tentou a reeleição)."""
    por = defaultdict(lambda: [0, 0])
    for r in linhas:
        por[r["cd_municipio"]][0] += r["tentaram"]
        por[r["cd_municipio"]][1] += r["reeleitos"]
    taxas = [re / te for te, re in por.values() if te]
    return round(100 * sum(taxas) / len(taxas), 1) if taxas else None


@lru_cache(maxsize=32)
@em_disco
def linhas_reeleicao(sigla: str) -> tuple[dict, ...]:
    return tuple(consultar(SQL_REELEICAO_UF, {"cargos": list(CARGOS_P10), "cd_uf": UFS[sigla]["cd_ibge"]}))


TODOS = "TODOS"   # todas as UFs carregadas, somadas (as linhas de cada uma já ficam em cache)


def _ufs_p10(uf: str) -> list[str]:
    """As UFs de um pedido da P10a: uma sigla, ou todas as carregadas para "" / TODOS."""
    if uf.strip().upper() in ("", TODOS):
        return sorted(carregadas() - {"BR"})
    sigla = uf_de(uf)["sigla"]
    if sigla not in carregadas() or sigla == "BR":
        raise HTTPException(404, f"UF sem dados: {sigla}")
    return [sigla]


@lru_cache(maxsize=32)
@em_disco
def reeleicao_uf(sigla: str) -> dict:
    ufs = sorted(carregadas() - {"BR"}) if sigla == TODOS else [sigla]
    linhas = [r for u in ufs for r in linhas_reeleicao(u)]
    validas = [r for r in linhas if r["ha_proxima"]]   # fora: a eleição seguinte ainda não está no banco
    cargos = []
    for cod, nome in CARGOS_P10.items():
        d = [r for r in validas if r["cod_cargo"] == cod]
        if not d:
            continue
        municipal = cod in MUNICIPAIS_P10
        ciclos = []
        for ano in sorted({r["ano_eleito"] for r in d}):
            c = [r for r in d if r["ano_eleito"] == ano]
            ciclos.append({"eleitos_em": ano, "disputa": c[0]["ano_disputa"], **_soma_reeleicao(c),
                           "media_municipios": _media_municipal(c) if municipal else None})
        cargos.append({"cod": cod, "nome": nome, "municipal": municipal, "ciclos": ciclos,
                       "total": {**_soma_reeleicao(d), "media_municipios": _media_municipal(d) if municipal else None}})
    municipais = [r for r in validas if r["cod_cargo"] in MUNICIPAIS_P10]
    fora = sorted({(r["cod_cargo"], r["ano_eleito"]) for r in linhas if not r["ha_proxima"]})
    return {"uf": sigla, "nome": f"{len(ufs)} estados carregados" if sigla == TODOS else UFS[sigla]["nome"], "cargos": cargos,
            "municipais": _soma_reeleicao(municipais) if municipais else None,
            "fora": [{"cod": c, "cargo": CARGOS_P10[c], "eleitos_em": a} for c, a in fora],
            "ligados_por_nome": sum(r["ligados"] for r in validas)}


def _aquecer() -> None:
    """Ao subir, em segundo plano: primeiro o atlas (a tela inicial), depois a P4 e a P10a. O viés de cada cargo,
    as malhas e o detalhe de cada UF carregada já ficam em cache; entrar num estado grande não espera
    mais a malha (segundos em MG) nem as contas do viés."""
    try:
        for cargo in (None, *CARGOS_VIES):
            vies_ufs(cargo)
        indice_vies()
        malha("brasil_ufs.geojson")
        for sigla in sorted(carregadas() & UFS.keys(), key=lambda s: -sum(m["sg_uf"] == s for m in MUNICIPIOS.values())):
            malha(f"municipios_{UFS[sigla]['cd_ibge']}.geojson")
            detalhe_uf(sigla, None)
        for sigla in sorted(carregadas() & UFS.keys()):   # "De onde vem o viés" (~2 s por estado e ano a frio)
            for ano in ANOS:
                composicao_vies(sigla, ano, None)
        for ano in ANOS_ESCOLA:   # a P4 abre em 2022 com todos os estados: ~11 s a frio
            escola_ano(ano, "")
        escola_comparar_tudo()
        custo_cadeira(2022, 6)   # a P1 abre em deputado federal, 2022, todos os estados
        veteranos()              # o BRANCO da urna sorteia daqui
        reeleicao_uf(TODOS)
        for z in sorted((DADOS / PASTA_FOTOS).glob("*/foto_cand*_div.zip"), reverse=True):   # do mais recente
            ano, uf = z.stem.split("_")[1][4:], z.stem.split("_")[2]
            indice_zip(int(ano), uf)
    except Exception:  # noqa: BLE001 - banco fora do ar: as contas são feitas quando a página pedir
        traceback.print_exc()   # mas fica no log: um aquecimento parado no meio deixa telas lentas


@app.get("/api/reeleicao")
def reeleicao(uf: str = TODOS):
    """P10a: taxa de reeleição por cargo na UF (ou em todas as carregadas, uf=TODOS), ciclo a ciclo e somada
    (leva alguns segundos na 1ª vez de cada UF)."""
    ufs = _ufs_p10(uf)
    return reeleicao_uf(TODOS if len(ufs) > 1 or uf.strip().upper() in ("", TODOS) else ufs[0])


# Quem são os eleitos de um ciclo da P10a: a mesma ligação de SQL_REELEICAO_UF (título, ou nome/nascimento
# em 1994-1996), só para um cargo e uma eleição, com o que cada um fez na seguinte. Voltaram e perderam
# primeiro pelos votos (só 2018-2024 têm votação), depois pelo nome.
SQL_REELEICAO_PESSOAS = f"""
WITH cand AS (
    SELECT pe.id_politico, e.ano, e.cd_municipio, COALESCE(e.cd_municipio, -e.cd_uf) AS unidade,
           p.nr_titulo_eleitoral IS NULL AS sem_titulo, p.dt_nascimento,
           {NOME_P10} AS nome, split_part(upper(p.nome), ' ', 1) AS primeiro_nome,
           bool_or(ma.id_mandato IS NOT NULL) AS eleito,
           bool_or(pe.ds_sit_tot_turno = '2º TURNO' AND ma.id_mandato IS NULL AND NOT EXISTS (
               SELECT 1 FROM eleicao e2 JOIN votacao_candidato_munzona v2 ON v2.id_eleicao = e2.id_eleicao
               WHERE e2.ano = e.ano AND e2.turno = 2 AND e2.tipo = e.tipo AND e2.cod_cargo = e.cod_cargo
                 AND e2.cd_uf IS NOT DISTINCT FROM e.cd_uf AND e2.cd_municipio IS NOT DISTINCT FROM e.cd_municipio)) AS pendente
    FROM politico_eleicao pe
    JOIN politico p ON p.id_politico = pe.id_politico
    JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
    LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
    LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
    WHERE e.tipo <> 1 AND e.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END) AND COALESCE(m.cd_uf, e.cd_uf) = %(cd_uf)s
      AND e.ano IN (%(ano)s, %(prox)s)
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
),
eleito AS (
    SELECT a.id_politico, a.cd_municipio, a.unidade,
           bool_or(b.id_politico IS NOT NULL) AS tentou, COALESCE(bool_or(b.eleito), false) AS reeleito,
           COALESCE(bool_or(b.pendente), false) AS pendente
    FROM cand a
    LEFT JOIN cand b ON b.unidade = a.unidade AND b.ano = %(prox)s
                    AND (b.id_politico = a.id_politico
                         OR (a.sem_titulo AND (b.nome = a.nome
                             OR (b.dt_nascimento = a.dt_nascimento AND b.primeiro_nome = a.primeiro_nome))))
    WHERE a.eleito AND a.ano = %(ano)s
    GROUP BY a.id_politico, a.cd_municipio, a.unidade
)
SELECT x.id_politico AS id, p.nome, c.nm_urna AS nome_urna, pa.sigla AS partido, pa.vies_politico::float AS vies,
       mu.nm_municipio AS municipio, c.sq_candidato AS sq, x.cd_municipio,
       CASE WHEN x.reeleito THEN 'voltaram' WHEN x.pendente THEN 'aguardando' WHEN x.tentou THEN 'perderam' ELSE 'nao' END AS grupo,
       (SELECT sum(v.qtd_votos_nominais) FROM votacao_candidato_munzona v
        WHERE v.id_politico_eleicao = c.id_politico_eleicao)::bigint AS votos
FROM eleito x
JOIN politico p ON p.id_politico = x.id_politico
LEFT JOIN municipio mu ON mu.cd_municipio = x.cd_municipio
LEFT JOIN LATERAL (
    SELECT pe.id_politico_eleicao, pe.sq_candidato, pe.nm_urna, pe.id_partido
    FROM politico_eleicao pe JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
    WHERE pe.id_politico = x.id_politico AND e.ano = %(ano)s AND e.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END)
      AND COALESCE(e.cd_municipio, -e.cd_uf) = x.unidade AND e.tipo <> 1
    ORDER BY e.turno LIMIT 1
) c ON true
LEFT JOIN partido pa ON pa.id_partido = c.id_partido
ORDER BY votos DESC NULLS LAST, p.nome
"""
GRUPOS_P10 = ("voltaram", "perderam", "nao", "aguardando")  # aguardando: foi ao 2º turno ainda não publicado (2026)



@lru_cache(maxsize=48)
@em_disco
def pessoas_reeleicao(sigla: str, cargo: int, ano: int) -> list[dict]:
    return consultar(SQL_REELEICAO_PESSOAS, {"cargo": cargo, "cd_uf": UFS[sigla]["cd_ibge"], "ano": ano,
                                             "prox": ano + (8 if cargo == SENADOR else 4)})


@app.get("/api/reeleicao/pessoas")
def reeleicao_pessoas(cargo: int, eleitos_em: int, uf: str = TODOS, grupo: str = "voltaram", q: str = "",
                      limite: int = Query(6, ge=1, le=60), desde: int = Query(0, ge=0)):
    """P10a: os eleitos de um cargo em `eleitos_em` que voltaram, perderam ou não tentaram na eleição seguinte
    (numa UF ou em todas as carregadas, os mais votados primeiro)."""
    ufs = _ufs_p10(uf)
    if cargo not in CARGOS_P10:
        raise HTTPException(422, f"Cargo fora da P10a: {cargo}")
    if grupo not in GRUPOS_P10:
        raise HTTPException(422, f"grupo: {', '.join(GRUPOS_P10)}")
    todos = [r | {"uf": u} for u in ufs for r in pessoas_reeleicao(u, cargo, eleitos_em)]
    if len(ufs) > 1:
        todos.sort(key=lambda r: (r["votos"] is None, -(r["votos"] or 0), r["nome"]))
    if q.strip():   # busca pelo nome civil ou de urna, sem acento e sem caixa
        alvo = sem_acento(q.strip())
        todos = [r for r in todos if alvo in sem_acento(r["nome"]) or alvo in sem_acento(r["nome_urna"] or "")]
    do_grupo = [r for r in todos if r["grupo"] == grupo]
    pagina = [{k: v for k, v in r.items() if k not in ("sq", "cd_municipio", "grupo")}
              | {"foto": foto_url(eleitos_em, r["uf"], r["sq"], r["cd_municipio"])}
              for r in do_grupo[desde:desde + limite]]
    return {"uf": ufs[0] if len(ufs) == 1 else TODOS, "cargo": cargo, "eleitos_em": eleitos_em,
            "disputa": eleitos_em + (8 if cargo == SENADOR else 4), "grupo": grupo,
            "contagem": {g: sum(r["grupo"] == g for r in todos) for g in GRUPOS_P10},
            "total": len(do_grupo), "pessoas": pagina}


# ───────── A roupa do bonequinho (migração 017) ─────────
# Fora dos caches: muda a qualquer momento, por quem estiver no armário.

PECA = Field(pattern=r"^[a-z]{1,20}$")


class Visual(BaseModel):
    rosto: str = PECA
    chapeu: str = PECA
    oculos: str = PECA
    roupa: str = PECA
    mao: str = PECA
    animacao: str = PECA
    faixa: bool | None = None
    bigode: bool = False
    chuva: bool = False


@app.get("/api/politicos/{id_politico}/visual")
def ler_visual(id_politico: int, response: Response):
    response.headers["Cache-Control"] = "no-store"
    r = consultar("SELECT visual FROM politico_visual WHERE id_politico = %s", (id_politico,))
    return r[0]["visual"] if r else None


@app.put("/api/politicos/{id_politico}/visual")
def salvar_visual(id_politico: int, visual: Visual):
    r = consultar("""INSERT INTO politico_visual (id_politico, visual) SELECT id_politico, %s FROM politico WHERE id_politico = %s
                     ON CONFLICT (id_politico) DO UPDATE SET visual = EXCLUDED.visual, atualizado_em = now()
                     RETURNING visual""", (json.dumps(visual.model_dump()), id_politico))
    if not r:
        raise HTTPException(404, "Político não encontrado")
    return r[0]["visual"]


@app.get("/api/politicos/{id_politico}")
def detalhar_politico(id_politico: int):
    p = consultar("SELECT id_politico AS id, nome, extract(year FROM dt_nascimento)::int AS nascimento_ano, "
                  "lower(ds_genero) AS genero FROM politico WHERE id_politico = %s", (id_politico,))
    if not p:
        raise HTTPException(404, f"Político desconhecido: {id_politico}")
    cands = consultar(SQL_CANDIDATURAS, (id_politico,))
    # Reeleito: eleito para o mesmo cargo, na mesma UF/município, na eleição ordinária anterior
    # (4 anos antes; 8 para senador), como em scripts/10a_taxa_reeleicao.py.
    eleitos = {(c["ano"], c["cod_cargo"], c["unidade"]) for c in cands if c["eleito"] and not c["suplementar"]}
    for c in cands:
        anterior = (c["ano"] - (8 if c["cod_cargo"] == SENADOR else 4), c["cod_cargo"], c.pop("unidade"))
        c["reeleito"] = c["eleito"] and anterior in eleitos
        c["foto"] = foto_url(c["ano"], c["uf"], c.pop("sq"), c.pop("cd_mun"))
    vitorias = sum(c["eleito"] for c in cands)
    fotos = [c["foto"] for c in cands if c["foto"]]
    # contexto da P10a: a taxa de reeleição do cargo mais recente disputado (titular, com UF carregada)
    ultima = next((c for c in reversed(cands) if c["cod_cargo"] in CARGOS_TITULARES and c["uf"] in carregadas()), None)
    taxa = ultima and taxa_reeleicao(ultima["cod_cargo"], ultima["uf"])
    contexto = {"cargo": ultima["cargo"], "uf": ultima["uf"], **taxa} if taxa else None
    return {**p[0], "foto": fotos[-1] if fotos else None, "ufs": sorted({c["uf"] for c in cands if c["uf"]}), "candidaturas": cands,
            "resumo": {"candidaturas": len(cands), "vitorias": vitorias, "derrotas": len(cands) - vitorias,
                       "reeleicoes": sum(c["reeleito"] for c in cands),
                       "primeiro_ano": cands[0]["ano"] if cands else None,
                       "ultimo_ano": cands[-1]["ano"] if cands else None},
            "contexto_reeleicao": contexto}


# ───────── Raio-x do político (político contra político) ─────────
# Para cada candidatura: patrimônio declarado, de onde veio o dinheiro (view campanha), a fatia dos votos
# nominais da disputa no 1º turno e a posição entre os concorrentes; e os municípios que mais votaram nele
# na eleição mais recente com votos.
SQL_RAIO_X = """
WITH minhas AS (
    SELECT pe.id_politico_eleicao, pe.id_eleicao FROM politico_eleicao pe WHERE pe.id_politico = %(id)s
), votos AS (
    SELECT v.id_eleicao, v.id_politico_eleicao, sum(v.qtd_votos_nominais) AS votos
    FROM votacao_candidato_munzona v
    WHERE v.id_eleicao IN (SELECT id_eleicao FROM minhas)
    GROUP BY 1, 2
), posicao AS (
    SELECT *, rank() OVER w AS posicao, count(*) OVER (PARTITION BY id_eleicao) AS concorrentes,
           sum(votos) OVER (PARTITION BY id_eleicao) AS total
    FROM votos WINDOW w AS (PARTITION BY id_eleicao ORDER BY votos DESC)
)
SELECT m.id_politico_eleicao AS id_candidatura, p.posicao, p.concorrentes,
       round(100 * p.votos / NULLIF(p.total, 0), 2)::float AS pct,
       (SELECT sum(b.vr_bem_candidato) FROM bem b WHERE b.id_politico_eleicao = m.id_politico_eleicao)::float AS patrimonio,
       c.fundo_eleitoral::float, c.fundo_partidario::float, c.pessoas_fisicas::float, c.proprios::float, c.outros::float
FROM minhas m
LEFT JOIN posicao p  ON p.id_politico_eleicao = m.id_politico_eleicao
LEFT JOIN campanha c ON c.id_politico_eleicao = m.id_politico_eleicao
"""
SQL_REDUTOS = """
SELECT m.cd_ibge AS ibge, m.nm_municipio AS nome, u.sigla AS uf, sum(v.qtd_votos_nominais)::bigint AS votos
FROM votacao_candidato_munzona v
JOIN zona_eleitoral z ON z.id_zona = v.id_zona
JOIN municipio m      ON m.cd_municipio = z.cd_municipio
JOIN uf u             ON u.cd_ibge = m.cd_uf
WHERE v.id_politico_eleicao = %s
GROUP BY 1, 2, 3
ORDER BY 4 DESC
"""


@lru_cache(maxsize=256)
@em_disco
def raio_x(id_politico: int) -> dict:
    linhas = consultar(SQL_RAIO_X, {"id": id_politico})
    por_cand = {r.pop("id_candidatura"): r for r in linhas}
    # os redutos: a candidatura mais recente com votos
    com_votos = [c for c in consultar(SQL_CANDIDATURAS, (id_politico,)) if c["votos"]]
    redutos = None
    if com_votos:
        c = max(com_votos, key=lambda c: (c["ano"], c["votos"]))
        municipios = consultar(SQL_REDUTOS, (c["id_candidatura"],))
        total = sum(m["votos"] for m in municipios)
        redutos = {"ano": c["ano"], "cargo": c["cargo"], "municipios": len(municipios), "total": total,
                   "top": [{**m, "pct": round(100 * m["votos"] / total, 1)} for m in municipios[:8]],
                   # quantos municípios somam metade dos votos: concentrado (poucos) ou espalhado (muitos)
                   "metade": next(i + 1 for i, acc in enumerate(_acumulado(m["votos"] for m in municipios)) if acc >= total / 2)}
    return {"candidaturas": por_cand, "redutos": redutos}


def _acumulado(valores):
    soma = 0
    for v in valores:
        soma += v
        yield soma


@app.get("/api/politicos/{id_politico}/raio-x")
def raio_x_politico(id_politico: int):
    if not consultar("SELECT 1 FROM politico WHERE id_politico = %s", (id_politico,)):
        raise HTTPException(404, f"Político desconhecido: {id_politico}")
    return raio_x(id_politico)


# ───────── Quanto custa uma cadeira? (P1), como em scripts/01_custo_cadeira.py ─────────
# Custo da cadeira = despesa contratada de todos os candidatos ao cargo ÷ cadeiras preenchidas.
# Contas e votos por candidatura vêm da view campanha (migração 011); valores nominais, com o
# fator do IPCA de outubro para reais de out/2024 ao lado, para o front alternar.

CARGOS_P1 = {6: "Deputado federal", 7: "Deputado estadual", 5: "Senador", 3: "Governador",
             11: "Prefeito", 13: "Vereador"}
MUNICIPAIS = {11, 13}

SQL_CAMPANHAS = """
SELECT pe.id_politico_eleicao, pe.id_eleicao, pe.id_politico AS id, p.nome, pe.sq_candidato AS sq,
       e.cd_municipio, m.cd_ibge AS municipio_ibge, m.nm_municipio, COALESCE(u.sigla, um.sigla) AS uf,
       c.despesa, c.votos, c.fundo_eleitoral, c.fundo_partidario, c.pessoas_fisicas, c.proprios, c.outros,
       ma.id_mandato IS NOT NULL AS eleito, pa.sigla AS partido, pa.numero, pa.vies_politico AS vies
FROM campanha c
JOIN politico_eleicao pe ON pe.id_politico_eleicao = c.id_politico_eleicao
JOIN politico p          ON p.id_politico = pe.id_politico
JOIN eleicao e           ON e.id_eleicao = pe.id_eleicao
LEFT JOIN municipio m    ON m.cd_municipio = e.cd_municipio
LEFT JOIN uf um          ON um.cd_ibge = m.cd_uf
LEFT JOIN uf u           ON u.cd_ibge = e.cd_uf
LEFT JOIN mandato ma     ON ma.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN partido pa     ON pa.id_partido = COALESCE(pe.id_partido, ma.id_partido)
WHERE e.ano = %(ano)s AND e.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END) AND e.tipo <> 1
  AND COALESCE(u.sigla, um.sigla) = ANY(%(ufs)s)
  AND (%(municipio)s::int IS NULL OR m.cd_ibge = %(municipio)s::int)
"""


@lru_cache(maxsize=1)
def ipca() -> dict[int, float]:
    """Fator para levar reais de outubro de cada ano a reais de outubro de 2024."""
    idx = {r["ano"]: float(r["indice"]) for r in consultar("SELECT ano, indice FROM ipca_outubro")}
    return {a: round(idx[2024] / i, 4) for a, i in idx.items()}


@lru_cache(maxsize=8)
@em_disco
def campanhas(ano: int, cargo: int, ufs: tuple[str, ...], municipio: int | None) -> list[dict]:
    linhas = consultar(SQL_CAMPANHAS, {"ano": ano, "cargo": cargo, "ufs": list(ufs), "municipio": municipio})
    for r in linhas:
        for k in ("despesa", "fundo_eleitoral", "fundo_partidario", "pessoas_fisicas", "proprios", "outros"):
            r[k] = float(r[k])
        r["votos"] = int(r["votos"])
    return linhas


def mediana(valores: list[float]) -> float | None:
    v = sorted(valores)
    if not v:
        return None
    meio = len(v) // 2
    return v[meio] if len(v) % 2 else (v[meio - 1] + v[meio]) / 2


def resumo_cadeira(linhas: list[dict]) -> dict:
    """Custo da cadeira: gasto médio dos eleitos. Gasto por cadeira: o da disputa inteira (todos os
    candidatos, eleitos ou não) ÷ cadeiras, o da prestação de contas."""
    eleitos = [r for r in linhas if r["eleito"]]
    total = sum(r["despesa"] for r in linhas)
    return {"candidatos": len(linhas), "cadeiras": len(eleitos), "gasto_total": round(total, 2),
            "custo_cadeira": round(sum(r["despesa"] for r in eleitos) / len(eleitos), 2) if eleitos else None,
            "gasto_por_cadeira": round(total / len(eleitos), 2) if eleitos else None,
            "mediana_eleito": mediana([r["despesa"] for r in eleitos]),
            "mediana_nao_eleito": mediana([r["despesa"] for r in linhas if not r["eleito"]])}


def curva_vitoria(linhas: list[dict]) -> list[dict]:
    """Chance de vitória por faixa de gasto: faixas em escala log (cada uma ~1,78x a anterior,
    4 por potência de 10) a partir de R$ 100; quem declarou menos que isso fica na primeira."""
    faixas: dict[int, list[int]] = {}
    for r in linhas:
        k = max(0, math.floor(4 * math.log10(max(r["despesa"], 1)) - 8))   # 0 = até R$ 177
        f = faixas.setdefault(k, [0, 0])
        f[0] += 1
        f[1] += r["eleito"]
    return [{"de": 0 if k == 0 else round(10 ** ((k + 8) / 4), 2), "ate": round(10 ** ((k + 9) / 4), 2),
             "candidatos": n, "eleitos": e} for k, (n, e) in sorted(faixas.items())]


def _escopo_cadeira(ano: int, cargo: int, uf: str, municipio: int | None) -> tuple[str, ...]:
    """Confere o recorte da P1 (cargo, ano, UF, município) e devolve as UFs dele."""
    if cargo not in CARGOS_P1:
        raise HTTPException(404, f"Cargo fora da P1: {cargo}")
    if ano not in ipca() or (ano % 4 == 0) != (cargo in MUNICIPAIS):
        raise HTTPException(404, f"Não houve eleição para {CARGOS_P1[cargo].lower()} em {ano}")
    ufs = tuple(sorted(carregadas()))
    if uf:
        if uf.upper() not in ufs:
            raise HTTPException(404, f"UF sem dados: {uf}")
        ufs = (uf.upper(),)
        sem_municipal(uf, cargo in MUNICIPAIS)
    if cargo == 13 and municipio is None:
        raise HTTPException(422, "Para vereador, escolha um município")
    if municipio is not None:
        if municipio not in MUNICIPIOS or MUNICIPIOS[municipio]["sg_uf"] not in ufs:
            raise HTTPException(404, f"Município sem dados: {municipio}")
        ufs = (MUNICIPIOS[municipio]["sg_uf"],)
    return ufs


@app.get("/api/cadeira")
def custo_cadeira(ano: int, cargo: int, uf: str = "", municipio: int | None = None):
    return cadeira(ano, cargo, _escopo_cadeira(ano, cargo, uf, municipio), municipio)


@lru_cache(maxsize=32)
@em_disco
def nao_eleitos(ano: int, cargo: int, ufs: tuple[str, ...], municipio: int | None) -> list[dict]:
    """Quem disputou e não se elegeu, do maior ao menor gasto: a galeria do plenário."""
    linhas = sorted((r for r in campanhas(ano, cargo, ufs, municipio) if not r["eleito"]), key=lambda r: -r["despesa"])
    return [{"id": r["id"], "nome": r["nome"], "partido": r["partido"], "vies": r["vies"], "uf": r["uf"],
             "local": r["nm_municipio"] if cargo == 11 else None, "gasto": r["despesa"], "votos": r["votos"],
             "foto": foto_url(ano, r["uf"], r["sq"], r["cd_municipio"])} for r in linhas]


@app.get("/api/cadeira/nao-eleitos")
def cadeira_nao_eleitos(ano: int, cargo: int, uf: str = "", municipio: int | None = None):
    return nao_eleitos(ano, cargo, _escopo_cadeira(ano, cargo, uf, municipio), municipio)


@lru_cache(maxsize=32)
@em_disco
def cadeira(ano: int, cargo: int, ufs: tuple[str, ...], municipio: int | None) -> dict:
    linhas = campanhas(ano, cargo, ufs, municipio)
    # A curva de vitória do vereador usa a UF toda: um município sozinho tem poucos candidatos.
    curva = curva_vitoria(campanhas(ano, cargo, ufs, None) if municipio else linhas)
    eleitos = sorted((r for r in linhas if r["eleito"]), key=lambda r: -r["despesa"])
    cadeiras = [{"id": r["id"], "nome": r["nome"], "partido": r["partido"], "vies": r["vies"], "uf": r["uf"],
                 "local": r["nm_municipio"] if cargo == 11 else None, "gasto": r["despesa"], "votos": r["votos"],
                 "foto": foto_url(ano, r["uf"], r["sq"], r["cd_municipio"])} for r in eleitos]

    partidos: dict[str, dict] = {}
    for r in linhas:
        p = partidos.setdefault(r["partido"] or "?", {"sigla": r["partido"] or "Sem partido", "numero": r["numero"],
                                                     "vies": r["vies"], "candidatos": 0, "cadeiras": 0, "gasto": 0.0})
        p["candidatos"] += 1
        p["cadeiras"] += r["eleito"]
        p["gasto"] = round(p["gasto"] + r["despesa"], 2)

    fontes = ("fundo_eleitoral", "fundo_partidario", "pessoas_fisicas", "proprios", "outros")
    despesas = consultar("SELECT categoria, sum(valor)::float AS valor FROM despesa_por_eleicao "
                         "WHERE id_eleicao = ANY(%s) GROUP BY 1 ORDER BY 2 DESC",
                         (sorted({r["id_eleicao"] for r in linhas}),))
    outras = sum(d["valor"] for d in despesas[8:])
    tipo = [a for a in ipca() if (a % 4 == 0) == (cargo in MUNICIPAIS)]
    m = MUNICIPIOS.get(municipio) if municipio else None
    return {
        "ano": ano, "cargo": {"cod": cargo, "nome": CARGOS_P1[cargo]},
        "escopo": {"ufs": list(ufs), "municipio": {"ibge": municipio, "nome": m["municipio"]} if m else None},
        "ipca": {str(a): f for a, f in ipca().items()},
        "resumo": resumo_cadeira(linhas),
        "anos": {str(a): resumo_cadeira(campanhas(a, cargo, ufs, municipio)) for a in tipo},
        "cadeiras": cadeiras,
        "partidos": sorted(partidos.values(), key=lambda p: (-p["cadeiras"], -p["gasto"])),
        "curva": curva,
        "despesas": despesas[:8] + ([{"categoria": "Outras", "valor": outras}] if outras else []),
        "receitas": {f: round(sum(r[f] for r in linhas), 2) for f in fontes},
    }


# ───────── Patrimônio declarado (P2) ─────────
# A ausência de uma linha em `bem` não vira zero: o front mostra os dois casos separados.
CARGOS_P2 = {1: "Presidente", 3: "Governador", 5: "Senador", 6: "Deputado federal",
             7: "Deputado estadual", 11: "Prefeito", 13: "Vereador"}
MUNICIPAIS_P2 = {11, 13}
ANOS_P2 = set(ANOS)

SQL_PATRIMONIO = """
WITH bens AS (
    SELECT id_politico_eleicao, sum(vr_bem_candidato)::double precision AS patrimonio
    FROM bem
    GROUP BY id_politico_eleicao
)
SELECT e.ano, (CASE e.cod_cargo WHEN 8 THEN 7 ELSE e.cod_cargo END) AS cod_cargo, b.patrimonio, ma.id_mandato IS NOT NULL AS eleito
FROM politico_eleicao pe
JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
LEFT JOIN municipio mu ON mu.cd_municipio = e.cd_municipio
LEFT JOIN uf um ON um.cd_ibge = mu.cd_uf
LEFT JOIN uf u ON u.cd_ibge = e.cd_uf
LEFT JOIN bens b ON b.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.ano = %(ano)s AND e.tipo = 2 AND e.turno = 1 AND e.cod_cargo = ANY(CASE %(cargo)s::int WHEN 7 THEN ARRAY[7, 8] ELSE ARRAY[%(cargo)s::int] END)
  AND pe.ds_sit_tot_turno IS NOT NULL
  -- quem foi a um 2º turno ainda não publicado (2026) nem venceu nem perdeu: fica fora até o TSE publicar
  AND NOT (pe.ds_sit_tot_turno = '2º TURNO' AND ma.id_mandato IS NULL AND NOT EXISTS (
      SELECT 1 FROM eleicao e2 JOIN votacao_candidato_munzona v2 ON v2.id_eleicao = e2.id_eleicao
      WHERE e2.ano = e.ano AND e2.turno = 2 AND e2.tipo = e.tipo AND e2.cod_cargo = e.cod_cargo
        AND e2.cd_uf IS NOT DISTINCT FROM e.cd_uf AND e2.cd_municipio IS NOT DISTINCT FROM e.cd_municipio))
  AND ((e.cod_cargo = 1 AND e.cd_uf IS NULL AND e.cd_municipio IS NULL)
       OR COALESCE(u.sigla, um.sigla) = ANY(%(ufs)s))
"""


def _quantil(valores: list[float], proporcao: float) -> float:
    """Quantil linear, igual ao padrão do pandas usado pelo script da P2."""
    pos = (len(valores) - 1) * proporcao
    baixo, acima = math.floor(pos), math.ceil(pos)
    if baixo == acima:
        return valores[baixo]
    return valores[baixo] + (valores[acima] - valores[baixo]) * (pos - baixo)


def _grupo_patrimonio(identificador: str, rotulo: str, tipo: str, linhas: list[dict]) -> dict:
    candidatos = len(linhas)
    eleitos = sum(bool(l["eleito"]) for l in linhas)
    valores = [l["patrimonio"] for l in linhas if l["patrimonio"] is not None]
    return {"id": identificador, "rotulo": rotulo, "tipo": tipo,
            "de": round(min(valores), 2) if valores else None,
            "ate": round(max(valores), 2) if valores else None,
            # o candidato do meio do grupo: mais fácil de ler que os limites, que pegam os extremos
            "mediana": round(statistics.median(valores), 2) if valores else None,
            "candidatos": candidatos, "eleitos": eleitos,
            "taxa": round(100 * eleitos / candidatos, 1) if candidatos else 0}


def _grupos_patrimonio(linhas: list[dict]) -> list[dict]:
    grupos = []
    sem_bens = [l for l in linhas if l["patrimonio"] is None]
    zeros = [l for l in linhas if l["patrimonio"] == 0]
    positivos = [l for l in linhas if l["patrimonio"] is not None and l["patrimonio"] > 0]
    if sem_bens:
        grupos.append(_grupo_patrimonio("sem_bens", "Sem registro de bens", "sem_bens", sem_bens))
    if zeros:
        grupos.append(_grupo_patrimonio("zero", "Total declarado igual a zero", "zero", zeros))
    if positivos:
        valores = sorted(l["patrimonio"] for l in positivos)
        limites = sorted({_quantil(valores, p) for p in (0, 0.25, 0.5, 0.75, 1)})
        faixas = [[] for _ in range(max(1, len(limites) - 1))]
        for linha in positivos:
            indice = bisect.bisect_left(limites[1:], linha["patrimonio"])
            faixas[min(indice, len(faixas) - 1)].append(linha)
        faixas = [f for f in faixas if f]
        quatro = len(faixas) == 4
        for i, faixa in enumerate(faixas, 1):
            rotulo = f"Q{i}" if quatro else f"Faixa {i}/{len(faixas)}"
            grupos.append(_grupo_patrimonio(f"q{i}", rotulo, "quartil" if quatro else "faixa", faixa))
    return grupos


@lru_cache(maxsize=64)
@em_disco
def patrimonio(ano: int, cargo: int, uf: str) -> dict:
    nacional = cargo == PRESIDENTE
    ufs = ("BR",) if nacional else ((uf,) if uf else tuple(sorted(s for s in carregadas() if s != "BR")))
    linhas = consultar(SQL_PATRIMONIO, {"ano": ano, "cargo": cargo, "ufs": list(ufs)})
    for linha in linhas:
        linha["patrimonio"] = float(linha["patrimonio"]) if linha["patrimonio"] is not None else None
    grupos = _grupos_patrimonio(linhas)
    quartis = [g for g in grupos if g["tipo"] == "quartil"]
    primeiro, ultimo = (quartis[0], quartis[-1]) if len(quartis) >= 2 else (None, None)
    sem = next((g for g in grupos if g["tipo"] == "sem_bens"), None)
    zero = next((g for g in grupos if g["tipo"] == "zero"), None)
    total = len(linhas)
    eleitos = sum(bool(l["eleito"]) for l in linhas)
    sem_count = sum(l["patrimonio"] is None for l in linhas)
    # a fila dos que declararam bens, em 100 passos: o valor de quem está em cada 1% da fila (para desenhá-la)
    positivos = sorted(l["patrimonio"] for l in linhas if l["patrimonio"] is not None and l["patrimonio"] > 0)
    fila = [round(_quantil(positivos, (i + 0.5) / 100), 2) for i in range(100)] if positivos else []
    return {
        "ano": ano, "cargo": {"cod": cargo, "nome": CARGOS_P2[cargo]},
        "escopo": {"uf": None if nacional else (uf or None), "ufs": list(ufs), "nacional": nacional},
        "resumo": {"candidatos": total, "eleitos": eleitos,
                   "sem_bens": sem_count,
                   "zero_declarado": zero["candidatos"] if zero else 0,
                   "com_bens": total - (sem["candidatos"] if sem else 0),
                   "cobertura_pct": round(100 * (total - (sem["candidatos"] if sem else 0)) / total, 1) if total else 0},
        "grupos": grupos,
        "fila": fila,
        "sintese": {"quartis": len(quartis),
                    "maior_supera_menor": bool(primeiro and ultimo and ultimo["taxa"] > primeiro["taxa"]),
                    "diferenca_pp": round(ultimo["taxa"] - primeiro["taxa"], 1) if primeiro and ultimo else None},
    }


@app.get("/api/patrimonio")
def patrimonio_endpoint(ano: int = 2024, cargo: int = 13, uf: str = ""):
    if cargo not in CARGOS_P2:
        raise HTTPException(404, f"Cargo fora da P2: {cargo}")
    if ano not in ANOS_P2 or (cargo in MUNICIPAIS_P2) != (ano % 4 == 0):
        raise HTTPException(404, f"Não houve eleição para {CARGOS_P2[cargo].lower()} em {ano}")
    if cargo == PRESIDENTE:
        if uf:
            raise HTTPException(422, "Presidente é uma disputa nacional e não usa UF")
        if not carga_nacional():
            raise HTTPException(404, "A carga nacional BR não está disponível")
        return patrimonio(ano, cargo, "")
    carregados = tuple(sorted(s for s in carregadas() if s != "BR"))
    escolhida = uf.upper()
    if escolhida and escolhida not in carregados:
        raise HTTPException(404, f"UF sem dados: {uf}")
    sem_municipal(escolhida, cargo in MUNICIPAIS_P2)
    return patrimonio(ano, cargo, escolhida)


def _aquecer_patrimonio() -> None:
    try:
        patrimonio_panorama()
        for sigla in sorted(s for s in carregadas() if s != "BR"):
            patrimonio_panorama(sigla)
    except Exception:  # noqa: BLE001 - banco fora do ar: a conta é feita quando a página pedir
        pass


@app.get("/api/patrimonio/panorama")
def patrimonio_panorama(uf: str = ""):
    """P2 em todos os cargos e anos de uma vez: a taxa de cada faixa por recorte (Presidente sempre nacional)."""
    carregados = tuple(sorted(s for s in carregadas() if s != "BR"))
    escolhida = uf.upper()
    if escolhida and escolhida not in carregados:
        raise HTTPException(404, f"UF sem dados: {uf}")
    recortes = []
    for ano in sorted(ANOS_P2):
        for cargo in CARGOS_P2:
            if (cargo in MUNICIPAIS_P2) != (ano % 4 == 0) or (cargo == PRESIDENTE and not carga_nacional()):
                continue
            d = patrimonio(ano, cargo, "" if cargo == PRESIDENTE else escolhida)
            if not d["resumo"]["candidatos"]:
                continue
            recortes.append({
                "ano": ano, "cargo": d["cargo"], "nacional": d["escopo"]["nacional"],
                "candidatos": d["resumo"]["candidatos"], "eleitos": d["resumo"]["eleitos"],
                "cobertura_pct": d["resumo"]["cobertura_pct"],
                "grupos": [{k: g[k] for k in ("id", "tipo", "taxa", "candidatos", "eleitos", "mediana")} for g in d["grupos"]],
                "sintese": d["sintese"],
            })
    quatro = [r for r in recortes if r["sintese"]["quartis"] == 4]
    return {"uf": escolhida or None, "recortes": recortes,
            "com_quartis": len(quatro), "maior_supera": sum(r["sintese"]["maior_supera_menor"] for r in quatro)}


# ───────── P9: onde a candidatura gasta (nuvem de santinhos) ─────────
# A classificação é a de scripts/09_nuvem_despesas.py, importada sem cópia: o tipo do TSE primeiro, a
# descrição só nas categorias genéricas, nunca o fornecedor. O peso de cada tipo é a soma das despesas
# contratadas em reais do ano da eleição, sem as doações a outras campanhas.
@lru_cache(maxsize=1)
def p9():
    import importlib.util
    import sys
    pasta = Path(__file__).resolve().parent.parent / "scripts"
    sys.path.insert(0, str(pasta))   # o script importa comum.py da própria pasta
    try:
        spec = importlib.util.spec_from_file_location("p9_nuvem_despesas", pasta / "09_nuvem_despesas.py")
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
    finally:
        sys.path.remove(str(pasta))
    return modulo

# Os tipos do script que são propaganda ou comunicação da campanha (a pergunta da P9)
PROPAGANDA_P9 = {"Propaganda digital", "Propaganda audiovisual", "Propaganda sonora", "Propaganda impressa",
                 "Outras propagandas", "Comunicação digital", "Comunicação e assessoria",
                 "Produção e gestão de conteúdo", "Marketing de campanha"}

SQL_CANDIDATURA_P9 = """
SELECT {colunas}pe.id_politico_eleicao AS id, pe.id_politico, p.nome, pe.nm_urna AS nome_urna, e.ano, e.tipo,
       c.nome AS cargo, e.cod_cargo, COALESCE(m.nm_municipio || ' - ' || um.sigla, u.sigla, 'BRASIL') AS local,
       COALESCE(u.sigla, um.sigla, 'BR') AS uf, pa.sigla AS partido, pa.vies_politico AS vies,
       pe.sq_candidato AS sq, e.cd_municipio AS cd_mun, ma.id_mandato IS NOT NULL AS eleito
FROM politico_eleicao pe
JOIN politico p       ON p.id_politico = pe.id_politico
JOIN eleicao e        ON e.id_eleicao = pe.id_eleicao
JOIN cargo c          ON c.cod_cargo = e.cod_cargo
LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
LEFT JOIN uf um       ON um.cd_ibge = m.cd_uf
LEFT JOIN uf u        ON u.cd_ibge = e.cd_uf
LEFT JOIN mandato ma  ON ma.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN partido pa  ON pa.id_partido = COALESCE(pe.id_partido, ma.id_partido){juncoes}
WHERE {filtro} AND e.ano = ANY(%(anos)s) AND e.tipo <> 1
"""


def _candidatura_p9(r: dict) -> dict:
    r = dict(r)
    r["foto"] = foto_url(r["ano"], r["uf"], r.pop("sq"), r.pop("cd_mun"))
    r.pop("tipo", None)
    return r


@lru_cache(maxsize=256)
@em_disco
def gastos_candidatura(id_candidatura: int) -> dict:
    P9 = p9()
    cand = consultar(SQL_CANDIDATURA_P9.format(colunas="", juncoes="", filtro="pe.id_politico_eleicao = %(id)s"),
                     {"id": id_candidatura, "anos": list(P9.ANOS)})
    if not cand:
        raise HTTPException(404, "Candidatura não encontrada, ou fora das eleições ordinárias de 2018 a 2024")
    conn = pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(P9.SQL_DESPESAS, (id_candidatura, P9.DOACAO))
            grupos, zeradas, sem_fornecedor, cobertura = P9.calcular(cur.fetchall())
    finally:
        pool().putconn(conn, close=bool(conn.closed))
    total = float(sum(g["valor"] for g in grupos.values()))
    tipos = []
    for rotulo, g in sorted(grupos.items(), key=lambda i: (-i[1]["valor"], i[0])):
        fornecedores = sorted(g["fornecedores"].items(), key=lambda i: (-i[1][0], i[0][1]))
        tipos.append({
            "rotulo": rotulo, "valor": float(g["valor"]), "quantidade": g["quantidade"], "inferidas": g["inferidas"],
            "propaganda": rotulo in PROPAGANDA_P9,
            "fornecedores": [{"nome": nome, "valor": float(v), "quantidade": q} for (_, nome), (v, q) in fornecedores[:3]],
            "n_fornecedores": len(fornecedores),
            "origens": [o for o, _ in sorted(g["origens"].items(), key=lambda i: -i[1])[:3]],
            "descricoes": [d for d, _ in sorted(g["descricoes_inferidas"].items(), key=lambda i: -i[1])[:2] if d],
        })
    propaganda = sum(t["valor"] for t in tipos if t["propaganda"])
    return {"candidatura": _candidatura_p9(cand[0]), "total": total,
            "despesas": sum(t["quantidade"] for t in tipos), "zeradas": zeradas, "sem_fornecedor": sem_fornecedor,
            "cobertura": [{"fonte": f, "quantidade": q, "valor": float(v)} for f, (q, v) in cobertura.items()],
            "propaganda": {"valor": propaganda, "pct": 100 * propaganda / total if total else 0},
            "tipos": tipos}


@app.get("/api/gastos")
def gastos(candidatura: int = Query(ge=1)):
    return gastos_candidatura(candidatura)


@lru_cache(maxsize=1)
@em_disco
def destaques_gastos() -> list[dict]:
    """As três campanhas que mais gastaram em cada ano: os exemplos da P9 na Metodologia."""
    linhas = consultar("""
        SELECT id_politico_eleicao FROM (
            SELECT pe.id_politico_eleicao, row_number() OVER (PARTITION BY e.ano ORDER BY c.despesa DESC) AS pos
            FROM campanha c
            JOIN politico_eleicao pe USING (id_politico_eleicao)
            JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
            WHERE e.tipo <> 1 AND e.ano = ANY(%(anos)s) AND c.despesa > 0) x
        WHERE pos <= 3""", {"anos": list(p9().ANOS)})
    ids = [r["id_politico_eleicao"] for r in linhas]
    return _candidaturas_com_gasto("pe.id_politico_eleicao = ANY(%(ids)s)", {"ids": ids})


def _candidaturas_com_gasto(filtro: str, params: dict) -> list[dict]:
    sql = SQL_CANDIDATURA_P9.format(colunas="cp.despesa::float AS gasto, ", filtro=filtro,
                                    juncoes="\nLEFT JOIN campanha cp ON cp.id_politico_eleicao = pe.id_politico_eleicao")
    linhas = consultar(sql + " ORDER BY e.ano DESC, cp.despesa DESC NULLS LAST", {**params, "anos": list(p9().ANOS)})
    return [_candidatura_p9(r) for r in linhas]


@app.get("/api/gastos/destaques")
def gastos_destaques():
    return destaques_gastos()


# ───────── P12: o que muda no 2º turno ─────────
# Cada 2º turno (de 2018 em diante, quando há votos por zona) ligado ao 1º turno da mesma disputa (mesmo ano,
# cargo e lugar). Os votos do 2º turno ficam na candidatura do 1º, então cada finalista tem os dois números.
# Virada = quem venceu o 2º turno não liderou o 1º. A conta é a de web/src/paginas/consultas/p12_segundo_turno.sql.
SQL_P12_DISPUTAS = """
SELECT e2.id_eleicao AS id_t2, e1.id_eleicao AS id_t1, e2.ano, e2.cod_cargo, c.nome AS cargo,
       COALESCE(u.sigla, um.sigla) AS uf, m.nm_municipio AS municipio, m.cd_ibge AS municipio_ibge
FROM eleicao e2
JOIN eleicao e1 ON e1.ano = e2.ano AND e1.tipo = e2.tipo AND e1.cod_cargo = e2.cod_cargo AND e1.turno = 1
               AND e1.cd_uf IS NOT DISTINCT FROM e2.cd_uf AND e1.cd_municipio IS NOT DISTINCT FROM e2.cd_municipio
JOIN cargo c          ON c.cod_cargo = e2.cod_cargo
LEFT JOIN uf u        ON u.cd_ibge = e2.cd_uf
LEFT JOIN municipio m ON m.cd_municipio = e2.cd_municipio
LEFT JOIN uf um       ON um.cd_ibge = m.cd_uf
WHERE e2.turno = 2 AND e2.tipo <> 1 AND e2.ano >= 2018 AND e2.cod_cargo IN (1, 3, 11)   -- sem os vices: vão na chapa
"""
SQL_P12_CANDIDATOS = """
WITH d AS (SELECT unnest(%(t2)s::int[]) AS id_t2, unnest(%(t1)s::int[]) AS id_t1),
votos AS (
    SELECT d.id_t2, v.id_politico_eleicao,
           sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = d.id_t1) AS votos_t1,
           sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = d.id_t2) AS votos_t2
    FROM d JOIN votacao_candidato_munzona v ON v.id_eleicao IN (d.id_t1, d.id_t2)
    GROUP BY 1, 2
)
SELECT v.id_t2, v.votos_t1, v.votos_t2, pe.id_politico_eleicao AS id_candidatura, pe.id_politico, p.nome,
       pe.nm_urna AS nome_urna, pe.sq_candidato AS sq, pa.sigla AS partido, pa.vies_politico AS vies
FROM votos v
JOIN politico_eleicao pe ON pe.id_politico_eleicao = v.id_politico_eleicao
JOIN politico p          ON p.id_politico = pe.id_politico
LEFT JOIN partido pa     ON pa.id_partido = pe.id_partido
"""
# quem foi votar, em branco, nulo e quem faltou, em cada turno (somado nos municípios da disputa)
SQL_P12_COMPARECIMENTO = """
SELECT id_eleicao, sum(qt_aptos) AS aptos, sum(qt_comparecimento) AS comparecimento, sum(qt_brancos) AS brancos,
       sum(qt_nulos) AS nulos, sum(qt_abstencoes) AS abstencoes
FROM votacao_municipio WHERE id_eleicao = ANY(%(ids)s) GROUP BY 1
"""


def _cd_mun_tse(ibge):
    return consultar("SELECT cd_municipio FROM municipio WHERE cd_ibge = %s", (ibge,))[0]["cd_municipio"] if ibge else None


@lru_cache(maxsize=1)
@em_disco
def segundos_turnos() -> dict:
    disputas = consultar(SQL_P12_DISPUTAS)
    if not disputas:
        return {"disputas": [], "incompletas": []}
    cands = consultar(SQL_P12_CANDIDATOS, {"t2": [d["id_t2"] for d in disputas], "t1": [d["id_t1"] for d in disputas]})
    comp = {r["id_eleicao"]: r for r in consultar(SQL_P12_COMPARECIMENTO, {"ids": [i for d in disputas for i in (d["id_t1"], d["id_t2"])]})}
    por_disputa: dict[int, list[dict]] = {}
    for c in cands:
        por_disputa.setdefault(c["id_t2"], []).append(c)
    saida, incompletas = [], []
    for d in disputas:
        cs = sorted(por_disputa.get(d["id_t2"], []), key=lambda c: -(c["votos_t1"] or 0))
        finais = sorted([c for c in cs if c["votos_t2"]], key=lambda c: -c["votos_t2"])
        # sem os dois finalistas votados no 2º turno, ou sem os votos deles no 1º (falha na carga daquela
        # disputa): não dá para comparar os turnos, então a disputa sai da conta e é listada à parte
        if len(finais) != 2 or not all(c["votos_t1"] for c in finais):
            # sem nenhum voto no 2º turno: o TSE ainda não publicou (2026); senão, falta o 1º turno na carga
            motivo = "2º turno não publicado" if not finais else "sem os votos do 1º turno"
            incompletas.append({"ano": d["ano"], "cargo": d["cargo"], "uf": d["uf"], "municipio": d["municipio"], "motivo": motivo})
            continue
        total_t1 = sum(c["votos_t1"] or 0 for c in cs)
        total_t2 = sum(c["votos_t2"] for c in finais)
        lider_t1 = cs[0]["id_candidatura"]
        cd_mun = _cd_mun_tse(d["municipio_ibge"]) if d["municipio_ibge"] else None
        finalistas = []
        for i, c in enumerate(finais):
            v1 = c["votos_t1"] or 0
            finalistas.append({
                "id_candidatura": c["id_candidatura"], "id_politico": c["id_politico"], "nome": c["nome"],
                "nome_urna": c["nome_urna"], "partido": c["partido"], "vies": float(c["vies"]) if c["vies"] is not None else None,
                "foto": foto_url(d["ano"], d["uf"] if d["cod_cargo"] != 1 else None, c["sq"], cd_mun),
                "votos_t1": v1, "votos_t2": c["votos_t2"],
                "pct_t1": 100 * v1 / total_t1 if total_t1 else 0, "pct_t2": 100 * c["votos_t2"] / total_t2 if total_t2 else 0,
                "crescimento": 100 * (c["votos_t2"] - v1) / v1 if v1 else None,
                "lider_t1": c["id_candidatura"] == lider_t1, "venceu": i == 0,
            })
        eliminados = [c for c in cs if not c["votos_t2"]]
        turno = lambda k: {kk: int(vv) for kk, vv in comp[k].items() if kk != "id_eleicao"} if k in comp else None
        saida.append({
            "id": d["id_t2"], "ano": d["ano"], "cod_cargo": d["cod_cargo"], "cargo": d["cargo"], "uf": d["uf"],
            "municipio": d["municipio"], "municipio_ibge": d["municipio_ibge"],
            "virada": not finalistas[0]["lider_t1"], "finalistas": finalistas,
            "eliminados": {"candidatos": len(eliminados), "votos": sum(c["votos_t1"] or 0 for c in eliminados)},
            "turnos": {"t1": turno(d["id_t1"]), "t2": turno(d["id_t2"])},
        })
    return {"disputas": saida, "incompletas": incompletas}


@app.get("/api/segundo-turno")
def segundo_turno():
    """P12: todos os 2º turnos de 2018 em diante, com os finalistas nos dois turnos e se houve virada; em
    `incompletas`, os que ficaram de fora por falta de votos de um dos turnos no banco."""
    return segundos_turnos()


@lru_cache(maxsize=64)
@em_disco
def segundo_turno_lugares(id_t2: int) -> dict:
    disputa = next((d for d in segundos_turnos()["disputas"] if d["id"] == id_t2), None)
    if not disputa:
        raise HTTPException(404, "2º turno não encontrado (ou de antes de 2018)")
    id_t1 = consultar(SQL_P12_DISPUTAS + " AND e2.id_eleicao = %(id)s", {"id": id_t2})[0]["id_t1"]
    a, b = (f["id_candidatura"] for f in disputa["finalistas"])
    # presidente por estado, governador por município, prefeito por zona eleitoral
    chave, nome = {1: ("uf.cd_ibge", "uf.sigla"), 3: ("m.cd_ibge", "m.nm_municipio")}.get(disputa["cod_cargo"], ("z.numero", "'Zona ' || z.numero"))
    linhas = consultar(f"""
        SELECT {chave} AS codigo, {nome} AS nome,
               sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = %(t1)s AND v.id_politico_eleicao = %(a)s) AS a1,
               sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = %(t1)s AND v.id_politico_eleicao = %(b)s) AS b1,
               sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = %(t1)s AND v.id_politico_eleicao NOT IN (%(a)s, %(b)s)) AS outros1,
               sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = %(t2)s AND v.id_politico_eleicao = %(a)s) AS a2,
               sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = %(t2)s AND v.id_politico_eleicao = %(b)s) AS b2
        FROM votacao_candidato_munzona v
        JOIN zona_eleitoral z ON z.id_zona = v.id_zona
        JOIN municipio m      ON m.cd_municipio = z.cd_municipio
        JOIN uf               ON uf.cd_ibge = m.cd_uf
        WHERE v.id_eleicao IN (%(t1)s, %(t2)s)
        GROUP BY 1, 2 ORDER BY 2""", {"t1": id_t1, "t2": id_t2, "a": a, "b": b})
    lugares = []
    for r in linhas:
        a1, b1, a2, b2 = (int(r[k] or 0) for k in ("a1", "b1", "a2", "b2"))
        lugares.append({"codigo": str(r["codigo"]), "nome": r["nome"], "a1": a1, "b1": b1, "outros1": int(r["outros1"] or 0),
                        "a2": a2, "b2": b2, "virou": (a1 > b1) != (a2 > b2) and a1 != b1 and a2 != b2})
    nivel = {1: "uf", 3: "municipio"}.get(disputa["cod_cargo"], "zona")
    return {"disputa": disputa, "nivel": nivel, "lugares": lugares}


@app.get("/api/segundo-turno/{id_t2}")
def segundo_turno_detalhe(id_t2: int):
    """P12: uma disputa de 2º turno pelo território (presidente por estado, governador por município, prefeito por
    zona): quem liderou em cada lugar nos dois turnos e onde virou."""
    return segundo_turno_lugares(id_t2)


# ───────── Malhas (IBGE) ─────────

TOLERANCIA_MALHA = 0.0006   # graus (~66 m)


def _douglas_peucker(pts: list, tol: float) -> list:
    """Douglas-Peucker iterativo; mantém as duas pontas."""
    if len(pts) < 3:
        return pts
    manter = [False] * len(pts)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pts) - 1)]
    while pilha:
        a, b = pilha.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norma = math.hypot(dx, dy) or 1e-12
        pior, ip = -1.0, -1
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / norma
            if d > pior:
                pior, ip = d, i
        if pior > tol:
            manter[ip] = True
            pilha += [(a, ip), (ip, b)]
    return [p for p, m in zip(pts, manter) if m]


def simplificar(features: list, tol: float) -> None:
    """Simplifica os anéis sem abrir frestas entre vizinhos: cada anel é cortado nos pontos em que
    muda o conjunto de feições que o compartilham (fronteira com A, com B, divisa do estado...), e
    cada trecho é simplificado numa direção canônica. O mesmo trecho de fronteira sai idêntico nos
    dois municípios que o dividem. Altera as coordenadas no lugar."""
    donos: dict[tuple, set] = defaultdict(set)
    aneis = []
    for i, f in enumerate(features):
        g = f["geometry"]
        for poligono in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
            for anel in poligono:
                aneis.append(anel)
                for x, y in anel:
                    donos[(x, y)].add(i)
    for anel in aneis:
        aberto = anel[:-1]   # o anel GeoJSON repete o primeiro ponto no fim
        n = len(aberto)
        if n < 8:
            continue
        chave = [frozenset(donos[(x, y)]) for x, y in aberto]
        cortes = [k for k in range(n) if chave[k] != chave[k - 1] or chave[k] != chave[(k + 1) % n]]
        # começa num corte (ou, sem nenhum, no menor ponto): o vizinho começa no mesmo lugar
        inicio = cortes[0] if cortes else min(range(n), key=lambda k: tuple(aberto[k]))
        aberto = aberto[inicio:] + aberto[:inicio]
        cortes = sorted((k - inicio) % n for k in cortes) or [0]
        limites = [*cortes, n]
        fechado = aberto + [aberto[0]]
        novo = [fechado[0]]
        for a, b in zip(limites, limites[1:]):
            trecho = fechado[a:b + 1]
            # direção canônica: o mesmo trecho, percorrido ao contrário pelo vizinho, dá o mesmo resultado
            invertido = (tuple(trecho[0]), tuple(trecho[1])) > (tuple(trecho[-1]), tuple(trecho[-2]))
            t = _douglas_peucker(trecho[::-1] if invertido else trecho, tol)
            novo += (t[::-1] if invertido else t)[1:]
        if len(novo) >= 4:
            anel[:] = novo


@lru_cache(maxsize=32)
def malha(arquivo: str) -> tuple[bytes, bytes]:
    """A malha pronta (ver _montar_malha), guardada em dados/cache_malhas: montar a de MG leva segundos,
    então só é feita de novo quando o arquivo do IBGE ou a tolerância mudam."""
    origem = IBGE / "malhas" / arquivo
    cache = DADOS / "cache_malhas" / f"{origem.stem}-{origem.stat().st_mtime_ns}-{TOLERANCIA_MALHA}.json"
    if cache.exists() and cache.with_suffix(".json.gz").exists():
        return cache.read_bytes(), cache.with_suffix(".json.gz").read_bytes()
    bruto, comprimido = _montar_malha(arquivo)
    try:
        cache.parent.mkdir(exist_ok=True)
        for antigo in cache.parent.glob(f"{origem.stem}-*"):
            antigo.unlink()
        cache.write_bytes(bruto)
        cache.with_suffix(".json.gz").write_bytes(comprimido)
    except OSError:  # sem permissão de escrita: segue só com o cache em memória
        pass
    return bruto, comprimido


def _montar_malha(arquivo: str) -> tuple[bytes, bytes]:
    """GeoJSON com os anéis invertidos: o IBGE segue a RFC 7946 (exterior anti-horário) e o
    d3-geo exige o exterior no sentido horário. Das propriedades fica só codarea, como inteiro.
    Municípios saem simplificados sem quebrar a topologia (simplificar).
    Guarda também a versão gzip: comprimir a cada pedido levaria segundos nas UFs grandes."""
    dados = json.loads((IBGE / "malhas" / arquivo).read_text(encoding="utf-8"))
    for f in dados["features"]:
        g = f["geometry"]
        for poligono in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
            for anel in poligono:
                anel.reverse()
        f["properties"] = {"codarea": int(f["properties"]["codarea"])}
    if arquivo.startswith("municipios_"):
        # a malha máxima do IBGE tem pontos a cada dezenas de metros: pesada para desenhar e animar.
        # ~66 m de tolerância: menos de 1 px no zoom de um município médio, ~3 px no menor da BA.
        simplificar(dados["features"], TOLERANCIA_MALHA)
    bruto = json.dumps(dados, separators=(",", ":")).encode()
    return bruto, gzip.compress(bruto, 6)


def geojson(arquivo: str, request: Request) -> Response:
    bruto, comprimido = malha(arquivo)
    headers = {"Cache-Control": "public, max-age=86400", "Vary": "Accept-Encoding"}
    if "gzip" in request.headers.get("accept-encoding", ""):
        return Response(comprimido, media_type="application/geo+json", headers={**headers, "Content-Encoding": "gzip"})
    return Response(bruto, media_type="application/geo+json", headers=headers)


# ───────── P4: escolaridade do candidato x de quem vota (mesma conta de scripts/04_escolaridade.py) ─────────

ANOS_ESCOLA = (2022, 2024, 2026)
# Titulares, do cargo com mais candidatos ao com menos. Em 2022 e 2026 o lugar é medido pelo voto em deputados
# (eleitos pelo estado); em 2024, pelos eleitos do próprio município (prefeito e vereadores).
# Presidente (1) é nacional: entra no recorte de qualquer UF e, no comparativo, fica sob "BR".
# 2026 só com os cargos decididos no 1º turno: governador e presidente esperam o 2º turno, que o TSE ainda não
# publicou (quem foi a ele contaria como não eleito).
CARGOS_ESCOLA = {2022: [7, 6, 5, 3, 1], 2024: [13, 11], 2026: [7, 6, 5]}
VOTO_ESCOLA = {2022: [6, 7], 2024: [13], 2026: [6, 7]}

SQL_ESCOLA_NIVEIS = "SELECT nivel, rotulo FROM escolaridade WHERE nivel IS NOT NULL ORDER BY nivel"

SQL_ESCOLA_CARGOS = """
SELECT (CASE e.cod_cargo WHEN 8 THEN 7 ELSE e.cod_cargo END) AS cargo, c.nome, es.nivel, count(*) AS candidatos, count(m.id_mandato) AS eleitos
FROM politico_eleicao pe
JOIN eleicao e       USING (id_eleicao)
JOIN cargo c         ON c.cod_cargo = (CASE e.cod_cargo WHEN 8 THEN 7 ELSE e.cod_cargo END)
JOIN escolaridade es ON es.ds_grau = pe.ds_grau_instrucao
LEFT JOIN mandato m  USING (id_politico_eleicao)
LEFT JOIN municipio mu ON mu.cd_municipio = e.cd_municipio
WHERE e.ano = %(ano)s AND e.tipo = 2 AND e.cod_cargo = ANY(%(cargos)s::int[] || CASE WHEN 7 = ANY(%(cargos)s::int[]) THEN ARRAY[8] ELSE ARRAY[]::int[] END)
  AND pe.ds_sit_tot_turno IS NOT NULL AND es.nivel IS NOT NULL
  AND (%(cd_uf)s::int IS NULL OR COALESCE(mu.cd_uf, e.cd_uf, %(cd_uf)s) = %(cd_uf)s)
GROUP BY 1, 2, 3
"""

SQL_ESCOLA_VOTANTES = """
SELECT es.nivel, sum(p.qtd_comparecimento)::bigint AS votantes
FROM perfil_eleitorado_munzona p
JOIN zona_eleitoral z USING (id_zona)
JOIN municipio mu     USING (cd_municipio)
JOIN escolaridade es  ON es.ds_grau = p.ds_grau_escolaridade
WHERE p.ano_eleicao = %(ano)s AND es.nivel IS NOT NULL AND (%(mun)s::int IS NULL OR z.cd_municipio = %(mun)s)
  AND (%(cd_uf)s::int IS NULL OR mu.cd_uf = %(cd_uf)s)
GROUP BY 1
"""

SQL_ESCOLA_MUNICIPIOS = """
WITH votantes AS (
    SELECT z.cd_municipio, sum(p.qtd_comparecimento) AS comparecimento,
           100.0 * sum(p.qtd_comparecimento) FILTER (WHERE es.nivel = 8) / sum(p.qtd_comparecimento) AS votantes
    FROM perfil_eleitorado_munzona p
    JOIN zona_eleitoral z USING (id_zona)
    JOIN escolaridade es  ON es.ds_grau = p.ds_grau_escolaridade
    WHERE p.ano_eleicao = %(ano)s AND es.nivel IS NOT NULL
    GROUP BY 1
),
disputa AS (
    SELECT e.cd_municipio,
           100.0 * avg((es.nivel = 8)::int)                                         AS candidatos,
           100.0 * avg((es.nivel = 8)::int) FILTER (WHERE m.id_mandato IS NOT NULL) AS eleitos,
           count(m.id_mandato)                                                      AS eleitos_n
    FROM politico_eleicao pe
    JOIN eleicao e       USING (id_eleicao)
    JOIN escolaridade es ON es.ds_grau = pe.ds_grau_instrucao
    LEFT JOIN mandato m  USING (id_politico_eleicao)
    WHERE e.ano = %(ano)s AND e.tipo = 2 AND e.cod_cargo IN (11, 13)
      AND pe.ds_sit_tot_turno IS NOT NULL AND es.nivel IS NOT NULL
    GROUP BY 1
),
votos AS (
    SELECT z.cd_municipio,
           100.0 * sum(v.qtd_votos_nominais) FILTER (WHERE es.nivel = 8) / NULLIF(sum(v.qtd_votos_nominais), 0) AS votados
    FROM votacao_candidato_munzona v
    JOIN eleicao e           USING (id_eleicao)
    JOIN zona_eleitoral z    USING (id_zona)
    JOIN politico_eleicao pe USING (id_politico_eleicao)
    JOIN escolaridade es     ON es.ds_grau = pe.ds_grau_instrucao
    WHERE e.ano = %(ano)s AND e.turno = 1 AND e.tipo = 2 AND e.cod_cargo = ANY(%(voto)s::int[] || CASE WHEN 7 = ANY(%(voto)s::int[]) THEN ARRAY[8] ELSE ARRAY[]::int[] END) AND es.nivel IS NOT NULL
    GROUP BY 1
)
SELECT mu.cd_ibge AS ibge, mu.cd_uf, vt.comparecimento::int, vt.votantes::float, d.candidatos::float, d.eleitos::float,
       d.eleitos_n::int, vo.votados::float
FROM votantes vt
JOIN municipio mu   USING (cd_municipio)
LEFT JOIN disputa d USING (cd_municipio)
LEFT JOIN votos vo  USING (cd_municipio)
WHERE mu.cd_ibge IS NOT NULL
"""

SQL_ESCOLA_ELEITOS = """
SELECT po.id_politico AS id, po.nome, pe.nm_urna AS nome_urna, e.cod_cargo AS cargo, pa.sigla AS partido,
       pa.vies_politico AS vies, es.nivel, pe.sq_candidato AS sq, e.cd_municipio
FROM mandato m
JOIN politico_eleicao pe  USING (id_politico_eleicao)
JOIN eleicao e            ON e.id_eleicao = pe.id_eleicao
JOIN politico po          USING (id_politico)
LEFT JOIN partido pa      ON pa.id_partido = COALESCE(pe.id_partido, m.id_partido)
LEFT JOIN escolaridade es ON es.ds_grau = pe.ds_grau_instrucao
WHERE e.ano = %(ano)s AND e.tipo = 2 AND e.cd_municipio = %(mun)s AND e.cod_cargo IN (11, 13)
ORDER BY es.nivel NULLS FIRST, pa.vies_politico NULLS LAST, po.nome
"""

SQL_ESCOLA_VOTADOS = """
SELECT es.nivel, sum(v.qtd_votos_nominais)::bigint AS votos
FROM votacao_candidato_munzona v
JOIN eleicao e           USING (id_eleicao)
JOIN zona_eleitoral z    USING (id_zona)
JOIN politico_eleicao pe USING (id_politico_eleicao)
JOIN escolaridade es     ON es.ds_grau = pe.ds_grau_instrucao
WHERE z.cd_municipio = %(mun)s AND e.ano = %(ano)s AND e.turno = 1 AND e.tipo = 2
  AND e.cod_cargo = ANY(%(voto)s::int[] || CASE WHEN 7 = ANY(%(voto)s::int[]) THEN ARRAY[8] ELSE ARRAY[]::int[] END) AND es.nivel IS NOT NULL
GROUP BY 1
"""


def _por_nivel(linhas: list[dict], campo: str) -> list[int]:
    v = [0] * 8
    for r in linhas:
        v[r["nivel"] - 1] = int(r[campo])
    return v


def _media(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 1) if xs else None


def _correlacao(pares: list[tuple]) -> float | None:
    pares = [(x, y) for x, y in pares if x is not None and y is not None]
    if len(pares) < 3:
        return None
    xs, ys = zip(*pares)
    return round(statistics.correlation(xs, ys), 3)


def _ano_escola(ano: int) -> int:
    if ano not in ANOS_ESCOLA:
        raise HTTPException(404, f"A P4 cobre {ANOS_ESCOLA}, não {ano}")
    return ano


@lru_cache(maxsize=2)
@em_disco
def municipios_escola(ano: int) -> dict[int, dict]:
    """Cada município com a % de superior completo de quem votou, dos candidatos, dos eleitos e dos votos,
    e o quintil pela escolaridade de quem votou (cortes nos quantis, como o pandas.qcut do script)."""
    linhas = consultar(SQL_ESCOLA_MUNICIPIOS, {"ano": ano, "voto": VOTO_ESCOLA[ano]})
    cortes = statistics.quantiles([r["votantes"] for r in linhas], n=5, method="inclusive")
    return {r["ibge"]: {**r, "quintil": bisect.bisect_left(cortes, r["votantes"]) + 1} for r in linhas}


@lru_cache(maxsize=16)
@em_disco
def escola_ano(ano: int, uf: str = "") -> dict:
    """O quadro das UFs carregadas ou de uma só; com UF, os quintos dividem os municípios dela."""
    cd_uf = UFS[uf]["cd_ibge"] if uf else None
    por_cargo: dict[int, dict] = {}
    for r in consultar(SQL_ESCOLA_CARGOS, {"ano": ano, "cargos": CARGOS_ESCOLA[ano], "cd_uf": cd_uf}):
        c = por_cargo.setdefault(r["cargo"], {"cod": r["cargo"], "nome": r["nome"], "candidatos": [0] * 8, "eleitos": [0] * 8})
        c["candidatos"][r["nivel"] - 1] = r["candidatos"]
        c["eleitos"][r["nivel"] - 1] = r["eleitos"]
    mun = municipios_recorte(ano, uf)   # com UF, os quintos dividem os municípios dela
    medida = "eleitos" if ano == 2024 else "votados"   # 2022: deputado é eleito pelo estado

    def resumo(grupo: list[dict]) -> dict:
        return {"municipios": len(grupo),
                "de": round(min(m["votantes"] for m in grupo), 1), "ate": round(max(m["votantes"] for m in grupo), 1),
                **{k: _media([m[k] for m in grupo if m[k] is not None]) for k in ("votantes", "candidatos", "eleitos", "votados")}}

    return {
        "ano": ano, "uf": uf or None, "ufs": [uf] if uf else sorted(carregadas() - {"BR"}), "medida": medida,
        "niveis": consultar(SQL_ESCOLA_NIVEIS),
        "votantes": _por_nivel(consultar(SQL_ESCOLA_VOTANTES, {"ano": ano, "mun": None, "cd_uf": cd_uf}), "votantes"),
        "cargos": [por_cargo[c] for c in CARGOS_ESCOLA[ano] if c in por_cargo],
        "quintis": [{"q": q, **resumo([m for m in mun if m["quintil"] == q])} for q in range(1, 6)],
        "todos": resumo(mun),
        "correlacao": _correlacao([(m["votantes"], m[medida]) for m in mun]),
    }


@app.get("/api/escola")
def escola(ano: int = 2024, uf: str = ""):
    ano, uf = _ano_escola(ano), _uf_escola(uf)
    sem_municipal(uf, ano % 4 == 0)
    d = escola_ano(ano, uf)
    # a questão extra: quanto a escolaridade anda junto com a exploração colonial, município a município
    mun = [m for m in municipios_recorte(ano, uf) if m["ibge"] in COLONIAL]
    col = lambda m: COLONIAL[m["ibge"]]["indice"]
    return {**d, "colonial": {"municipios": len(mun),
                              "votantes": _correlacao([(col(m), m["votantes"]) for m in mun]),
                              "candidatos": _correlacao([(col(m), m["candidatos"]) for m in mun]),
                              d["medida"]: _correlacao([(col(m), m[d["medida"]]) for m in mun])}}


@lru_cache(maxsize=64)
@em_disco
def escola_lugar(ibge: int, ano: int) -> dict:
    m = MUNICIPIOS[ibge]
    if m["sg_uf"] not in carregadas():
        raise HTTPException(404, f"UF sem dados: {m['sg_uf']}")
    cd = consultar("SELECT cd_municipio FROM municipio WHERE cd_ibge = %s", (ibge,))[0]["cd_municipio"]
    eleitos = []
    for r in consultar(SQL_ESCOLA_ELEITOS, {"ano": ano, "mun": cd}) if ano == 2024 else []:
        r["foto"] = foto_url(ano, m["sg_uf"], r.pop("sq"), r.pop("cd_municipio"))
        r["vies"] = float(r["vies"]) if r["vies"] is not None else None
        eleitos.append(r)
    linha = municipios_escola(ano).get(ibge, {})
    return {
        "ibge": ibge, "nome": m["municipio"], "uf": m["sg_uf"], "ano": ano,
        "votantes": _por_nivel(consultar(SQL_ESCOLA_VOTANTES, {"ano": ano, "mun": cd, "cd_uf": None}), "votantes"),
        "votados": _por_nivel(consultar(SQL_ESCOLA_VOTADOS, {"ano": ano, "mun": cd, "voto": VOTO_ESCOLA[ano]}), "votos"),
        "eleitos": eleitos,
        "quintil": linha.get("quintil"),
        "pct": {k: (round(linha[k], 1) if linha.get(k) is not None else None)
                for k in ("votantes", "candidatos", "eleitos", "votados")},
    }


@app.get("/api/escola/municipio/{ibge}")
def escola_municipio(ibge: int, ano: int = 2024):
    if ibge not in MUNICIPIOS:
        raise HTTPException(404, f"Município desconhecido: {ibge}")
    return escola_lugar(ibge, _ano_escola(ano))


SQL_ESCOLA_PARTIDOS = """
SELECT pa.sigla, pa.nome, pa.vies_politico::float AS vies,
       count(*)                                            AS candidatos,
       count(*) FILTER (WHERE es.nivel = 8)                AS candidatos_superior,
       count(m.id_mandato)                                 AS eleitos,
       count(m.id_mandato) FILTER (WHERE es.nivel = 8)     AS eleitos_superior
FROM politico_eleicao pe
JOIN eleicao e         USING (id_eleicao)
JOIN escolaridade es   ON es.ds_grau = pe.ds_grau_instrucao
JOIN partido pa        ON pa.id_partido = pe.id_partido
LEFT JOIN mandato m    USING (id_politico_eleicao)
LEFT JOIN municipio mu ON mu.cd_municipio = e.cd_municipio
WHERE e.ano = %(ano)s AND e.tipo = 2 AND e.cod_cargo = ANY(%(cargos)s::int[] || CASE WHEN 7 = ANY(%(cargos)s::int[]) THEN ARRAY[8] ELSE ARRAY[]::int[] END)
  AND pe.ds_sit_tot_turno IS NOT NULL AND es.nivel IS NOT NULL
  AND (%(cd_uf)s::int IS NULL OR COALESCE(mu.cd_uf, e.cd_uf, %(cd_uf)s) = %(cd_uf)s)
GROUP BY pa.id_partido, 1, 2, 3
"""

SQL_ESCOLA_COMPARAR_CARGOS = """
SELECT e.ano, COALESCE(mu.cd_uf, e.cd_uf) AS cd_uf, (CASE e.cod_cargo WHEN 8 THEN 7 ELSE e.cod_cargo END) AS cargo, es.nivel,
       count(*) AS candidatos, count(m.id_mandato) AS eleitos
FROM politico_eleicao pe
JOIN eleicao e         USING (id_eleicao)
JOIN escolaridade es   ON es.ds_grau = pe.ds_grau_instrucao
LEFT JOIN mandato m    USING (id_politico_eleicao)
LEFT JOIN municipio mu ON mu.cd_municipio = e.cd_municipio
WHERE e.ano IN (2022, 2024, 2026) AND e.tipo = 2 AND e.cod_cargo IN (1, 3, 5, 6, 7, 8, 11, 13)
  AND NOT (e.ano = 2026 AND e.cod_cargo IN (1, 3))   -- 2026: governador e presidente esperam o 2º turno
  AND pe.ds_sit_tot_turno IS NOT NULL AND es.nivel IS NOT NULL
GROUP BY 1, 2, 3, 4
"""

SQL_ESCOLA_COMPARAR_VOTANTES = """
SELECT p.ano_eleicao AS ano, mu.cd_uf, es.nivel, sum(p.qtd_comparecimento)::bigint AS votantes
FROM perfil_eleitorado_munzona p
JOIN zona_eleitoral z USING (id_zona)
JOIN municipio mu     USING (cd_municipio)
JOIN escolaridade es  ON es.ds_grau = p.ds_grau_escolaridade
WHERE p.ano_eleicao IN (2022, 2024, 2026) AND es.nivel IS NOT NULL
GROUP BY 1, 2, 3
"""


def _uf_escola(uf: str) -> str:
    if not uf:
        return ""
    uf = uf_de(uf)["sigla"]
    if uf not in carregadas():
        raise HTTPException(404, f"UF sem dados: {uf}")
    if uf == "DF":   # os quintos dividem os municípios da UF; o DF só tem Brasília
        raise HTTPException(404, "O Distrito Federal tem um só município (Brasília): ele entra no recorte de todos os estados.")
    return uf


@lru_cache(maxsize=16)
def municipios_recorte(ano: int, uf: str = "") -> list[dict]:
    """Os municípios do recorte com o quinto calculado dentro dele (todas as UFs ou só uma)."""
    cd_uf = UFS[uf]["cd_ibge"] if uf else None
    mun = [m for m in municipios_escola(ano).values() if cd_uf is None or m["cd_uf"] == cd_uf]
    if cd_uf is not None:
        cortes = statistics.quantiles([m["votantes"] for m in mun], n=5, method="inclusive")
        mun = [{**m, "quintil": bisect.bisect_left(cortes, m["votantes"]) + 1} for m in mun]
    return mun


@app.get("/api/escola/municipios")
def escola_municipios(ano: int = 2024, uf: str = ""):
    """Cada município do recorte: % com superior de quem votou, dos candidatos, dos eleitos e dos votos."""
    ano, uf = _ano_escola(ano), _uf_escola(uf)
    sem_municipal(uf, ano % 4 == 0)
    return [{"ibge": m["ibge"], "nome": MUNICIPIOS[m["ibge"]]["municipio"], "uf": MUNICIPIOS[m["ibge"]]["sg_uf"],
             "comparecimento": m["comparecimento"], "eleitos_n": m["eleitos_n"], "quintil": m["quintil"],
             **{k: (round(m[k], 1) if m[k] is not None else None) for k in ("votantes", "candidatos", "eleitos", "votados")},
             "colonial": COLONIAL.get(m["ibge"])}
            for m in municipios_recorte(ano, uf) if m["ibge"] in MUNICIPIOS]


@lru_cache(maxsize=16)
@em_disco
def escola_partidos_ano(ano: int, uf: str = "") -> list[dict]:
    cd_uf = UFS[uf]["cd_ibge"] if uf else None
    linhas = consultar(SQL_ESCOLA_PARTIDOS, {"ano": ano, "cargos": CARGOS_ESCOLA[ano], "cd_uf": cd_uf})
    return sorted(linhas, key=lambda p: (p["vies"] if p["vies"] is not None else 0, p["sigla"]))


@app.get("/api/escola/partidos")
def escola_partidos(ano: int = 2024, uf: str = ""):
    """Cada partido do recorte, na ordem do viés: candidatos e eleitos, e quantos deles com superior completo."""
    return escola_partidos_ano(_ano_escola(ano), _uf_escola(uf))


@lru_cache(maxsize=1)
@em_disco
def escola_comparar_tudo() -> dict:
    sigla = {u["cd_ibge"]: s for s, u in UFS.items()}
    anos: dict = {str(a): {} for a in ANOS_ESCOLA}
    for r in consultar(SQL_ESCOLA_COMPARAR_CARGOS):
        u = anos[str(r["ano"])].setdefault(sigla.get(r["cd_uf"], "BR"), {"votantes": [0] * 8, "cargos": {}})
        c = u["cargos"].setdefault(str(r["cargo"]), {"candidatos": [0] * 8, "eleitos": [0] * 8})
        c["candidatos"][r["nivel"] - 1] = r["candidatos"]
        c["eleitos"][r["nivel"] - 1] = r["eleitos"]
    for r in consultar(SQL_ESCOLA_COMPARAR_VOTANTES):
        u = anos[str(r["ano"])].setdefault(sigla[r["cd_uf"]], {"votantes": [0] * 8, "cargos": {}})
        u["votantes"][r["nivel"] - 1] = int(r["votantes"])
    ufs = sorted(carregadas() - {"BR"})
    nomes = {r["cod_cargo"]: r["nome"] for r in consultar("SELECT cod_cargo, nome FROM cargo WHERE cod_cargo IN (1, 3, 5, 6, 7, 11, 13)")}
    return {"ufs": [{"sigla": s, "nome": UFS[s]["nome"]} for s in ufs],
            "cargos": {str(a): [{"cod": c, "nome": nomes[c]} for c in CARGOS_ESCOLA[a]] for a in ANOS_ESCOLA},
            "anos": {a: {s: v for s, v in d.items() if s in ufs or s == "BR"} for a, d in anos.items()}}


@app.get("/api/escola/comparar")
def escola_comparar():
    """2022, 2024 e 2026 lado a lado: por ano, UF e cargo, candidatos e eleitos por grau; por ano e UF, quem votou."""
    return escola_comparar_tudo()


@app.get("/api/geo/brasil")
def geo_brasil(request: Request):
    return geojson("brasil_ufs.geojson", request)


@app.get("/api/geo/uf/{sigla}")
def geo_uf(sigla: str, request: Request):
    return geojson(f"municipios_{uf_de(sigla)['cd_ibge']}.geojson", request)
