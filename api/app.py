"""API do Voto Aberto: viés político de UFs e municípios, indicadores e carreira dos políticos.

Uso (da pasta do projeto): python -m uvicorn api.app:app --port 8000

Os dados só mudam com uma nova carga e ficam em cache no processo: reinicie a API depois de
carregar UFs (python -m loader ...).

Viés como em scripts/07_vies_politico_municipio.py: média do viés dos partidos (-100 esquerda,
+100 direita) ponderada pelos votos válidos de todos os cargos no 1º turno das eleições ordinárias;
UF e região intermediária, a mesma média sobre os votos de todos os seus municípios.
"""
import csv
import gzip
import json
import math
import os
import random
import unicodedata
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import zipfile

import psycopg2
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from crawler.fotos import PASTA as PASTA_FOTOS, chave as chave_foto, indice as indice_fotos

DADOS = Path(__file__).resolve().parent.parent / "dados"
IBGE = DADOS / "ibge"
BANCO_PADRAO = "postgresql://eleicoes:eleicoes@localhost:5432/eleicoes"
SEM_BANCO = "Banco de dados indisponível. Suba o PostgreSQL com `docker compose up -d` na pasta do projeto."

ANOS = [2018, 2020, 2022, 2024]
PRESIDENTE, SENADOR, PREFEITO = 1, 5, 11   # cargo.cod_cargo
VAZIO = {"vies": {}, "sem_vies_pct": {}}


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()


# ───────── Território (IBGE): todos os 5570 municípios, carregados ou não ─────────

with open(IBGE / "territorio" / "municipios.csv", encoding="utf-8-sig", newline="") as f:
    MUNICIPIOS = {int(r["cod_ibge"]): r for r in csv.DictReader(f, delimiter=";")}

_por_uf = Counter(m["sg_uf"] for m in MUNICIPIOS.values())
UFS = {m["sg_uf"]: {"sigla": m["sg_uf"], "cd_ibge": ibge // 100_000, "nome": m["uf"], "regiao": m["regiao"],
                    "municipios": _por_uf[m["sg_uf"]]} for ibge, m in MUNICIPIOS.items()}

BUSCA = sorted((sem_acento(m["municipio"]), ibge) for ibge, m in MUNICIPIOS.items())


def uf_de(sigla: str) -> dict:
    uf = UFS.get(sigla.upper())
    if uf is None:
        raise HTTPException(404, f"UF desconhecida: {sigla}")
    return uf


# ───────── Banco ─────────

@lru_cache(maxsize=1)
def pool() -> ThreadedConnectionPool:
    return ThreadedConnectionPool(1, 20, os.environ.get("DATABASE_URL", BANCO_PADRAO))


def consultar(sql: str, params=None) -> list[dict]:
    conn = pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        pool().putconn(conn, close=bool(conn.closed))   # descarta conexões quebradas (banco reiniciado)


SQL_CARREGADAS = "SELECT u.sigla FROM carga_uf c JOIN uf u ON u.sigla = c.sg_uf ORDER BY 1"


@lru_cache(maxsize=1)
def carregadas() -> frozenset[str]:
    return frozenset(r["sigla"] for r in consultar(SQL_CARREGADAS))


@lru_cache(maxsize=1)
def votos_vies() -> list[dict]:
    """Votos válidos por município e ano, somados sobre partidos e cargos."""
    return consultar("""
        SELECT m.cd_uf, m.cd_ibge, v.ano_eleicao AS ano,
               sum(v.qt_votos_validos * p.vies_politico) AS votos_x_vies,
               sum(v.qt_votos_validos) AS votos,
               COALESCE(sum(v.qt_votos_validos) FILTER (WHERE p.vies_politico = 0), 0) AS votos_sem_vies
        FROM votacao_partido_municipio v
        JOIN partido p ON p.id_partido = v.id_partido
        JOIN municipio m ON m.cd_municipio = v.cd_municipio
        WHERE v.ano_eleicao = ANY(%s)
        GROUP BY 1, 2, 3
        HAVING sum(v.qt_votos_validos) > 0""", (ANOS,))


def vies(linhas: list[dict], chave) -> dict:
    """{chave: {"vies": {ano: viés}, "sem_vies_pct": {ano: % dos votos em partidos de viés 0}}}."""
    soma = defaultdict(lambda: defaultdict(lambda: [0.0, 0, 0]))
    for r in linhas:
        s = soma[chave(r)][r["ano"]]
        s[0] += r["votos_x_vies"]
        s[1] += r["votos"]
        s[2] += r["votos_sem_vies"]
    return {k: {"vies": {str(a): round(x / v, 1) for a, (x, v, _) in sorted(anos.items())},
                "sem_vies_pct": {str(a): round(100 * z / v, 1) for a, (_, v, z) in sorted(anos.items())}}
            for k, anos in soma.items()}


@lru_cache(maxsize=1)
def vies_ufs() -> dict:
    return vies(votos_vies(), lambda r: r["cd_uf"])


# ───────── App ─────────

app = FastAPI(title="Voto Aberto")
app.add_middleware(GZipMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET"])


@app.exception_handler(psycopg2.OperationalError)
def banco_fora(_request, _exc):
    return JSONResponse({"detail": SEM_BANCO}, status_code=503)


@app.get("/api/saude")
def saude():
    return {"banco": True, "ufs_carregadas": [r["sigla"] for r in consultar(SQL_CARREGADAS)]}


@app.get("/api/ufs")
def listar_ufs():
    por_uf = vies_ufs()
    return [{**uf, "carregada": s in carregadas(), "vies": por_uf.get(uf["cd_ibge"], VAZIO)["vies"]}
            for s, uf in sorted(UFS.items())]


@app.get("/api/ufs/{sigla}")
def detalhar_uf(sigla: str):
    return detalhe_uf(uf_de(sigla)["sigla"])


@lru_cache(maxsize=32)
def detalhe_uf(sigla: str) -> dict:
    uf = UFS[sigla]
    linhas = [r for r in votos_vies() if r["cd_uf"] == uf["cd_ibge"]]
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
        "sigla": sigla, "cd_ibge": uf["cd_ibge"], "nome": uf["nome"], "regiao": uf["regiao"],
        "carregada": sigla in carregadas(), "vies": estado["vies"], "sem_vies_pct": estado["sem_vies_pct"],
        "regioes": [{"nome": r, "vies": por_regiao.get(r, VAZIO)["vies"]} for r in regioes],
        "municipios": [{"ibge": ibge, "nome": m["municipio"], "regiao": m["regiao_intermediaria"],
                        "vies": por_municipio.get(ibge, VAZIO)["vies"], "aptos": aptos.get(ibge, {})}
                       for ibge, m in municipios.items()],
    }


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
def detalhar_municipio(ibge: int):
    if ibge not in MUNICIPIOS:
        raise HTTPException(404, f"Município desconhecido: {ibge}")
    return detalhe_municipio(ibge)


SQL_ESPECTRO = """
SELECT v.ano_eleicao AS ano, p.sigla, p.nome, p.numero, p.vies_politico AS vies, sum(v.qt_votos_validos) AS votos
FROM votacao_partido_municipio v
JOIN partido p ON p.id_partido = v.id_partido
WHERE v.cd_municipio = %s AND v.ano_eleicao = ANY(%s)
GROUP BY v.ano_eleicao, p.id_partido
HAVING sum(v.qt_votos_validos) > 0
ORDER BY 1, vies, votos DESC
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


@lru_cache(maxsize=1024)
def detalhe_municipio(ibge: int) -> dict:
    m = MUNICIPIOS[ibge]
    uf = UFS[m["sg_uf"]]
    base = {"ibge": ibge, "nome": m["municipio"], "uf": m["sg_uf"], "uf_nome": m["uf"],
            "regiao_intermediaria": m["regiao_intermediaria"], "regiao_imediata": m["regiao_imediata"],
            "carregada": m["sg_uf"] in carregadas()}
    cd = base["carregada"] and consultar("SELECT cd_municipio FROM municipio WHERE cd_ibge = %s", (ibge,))
    if not cd:
        return {**base, "vies": {}, "vies_uf": {}, "sem_vies_pct": {}, "espectro": {},
                "indicadores": {}, "comparecimento": {}, "prefeitos": [], "cadeiras": []}
    cd = cd[0]["cd_municipio"]

    v = vies([r for r in votos_vies() if r["cd_ibge"] == ibge], lambda r: 0).get(0, VAZIO)
    espectro = defaultdict(list)
    for r in consultar(SQL_ESPECTRO, (cd, ANOS)):
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

    return {**base, "vies": v["vies"], "vies_uf": vies_ufs().get(uf["cd_ibge"], VAZIO)["vies"],
            "sem_vies_pct": v["sem_vies_pct"], "espectro": espectro,
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

@lru_cache(maxsize=64)
def zip_fotos(ano: int, uf: str) -> tuple[zipfile.ZipFile, dict[str, str]] | None:
    caminho = DADOS / PASTA_FOTOS / str(ano) / f"foto_cand{ano}_{uf}_div.zip"
    if not caminho.exists():
        return None
    z = zipfile.ZipFile(caminho)
    return z, indice_fotos(z.namelist())


def foto_url(ano, uf, sq, cd_municipio=None) -> str | None:
    """URL da foto da candidatura, ou None se o TSE não publicou (antes de 2004) ou não foi baixada.
    Em 2004 o SQ só é único no município, então a chave leva o código TSE do município."""
    if not (ano and sq):
        return None
    uf, ano = uf or "BR", int(ano)   # sem UF: Presidente
    chave = chave_foto(sq, cd_municipio if ano == 2004 else None)
    achado = zip_fotos(ano, uf)
    return f"/api/fotos/{ano}/{uf}/{chave}" if achado and chave in achado[1] else None


@app.get("/api/fotos/{ano}/{uf}/{chave}")
def foto(ano: int, uf: str, chave: str):
    achado = zip_fotos(ano, uf.upper())
    nome = achado and achado[1].get(chave)
    if not nome:
        raise HTTPException(404, "Foto não encontrada")
    ext = nome.rsplit(".", 1)[-1].lower()
    tipo = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "bmp": "image/bmp", "gif": "image/gif"}[ext]
    return Response(achado[0].read(nome), media_type=tipo, headers={"Cache-Control": "public, max-age=31536000, immutable"})


# ───────── Políticos (nunca expõe CPF, título eleitoral nem data de nascimento completa) ─────────

# Filtra pelos trigramas do nome sem acento (índice politico_nome_trgm, migração 010) e ordena por
# word_similarity: quem contém o texto buscado vem primeiro, e entre eles quem tem mais candidaturas.
# ponytail: nomes genéricos ("jose", "maria") casam dezenas de milhares de linhas e levam ~0,5 s.
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
GROUP BY a.id_politico, a.nome, a.dt_nascimento, a.ws, a.n, a.sim
ORDER BY a.ws DESC, a.n DESC, a.sim DESC
"""

SQL_BUSCA_POLITICOS = """
WITH achados AS (
    SELECT id_politico, nome, dt_nascimento,
           word_similarity(f_unaccent(upper(%(q)s)), f_unaccent(upper(nome))) AS ws,
           similarity(f_unaccent(upper(nome)), f_unaccent(upper(%(q)s))) AS sim,
           (SELECT count(*) FROM politico_eleicao pe WHERE pe.id_politico = politico.id_politico) AS n
    FROM politico
    WHERE f_unaccent(upper(nome)) %% f_unaccent(upper(%(q)s))
       OR f_unaccent(upper(nome)) LIKE '%%' || f_unaccent(upper(%(q)s)) || '%%'
    ORDER BY ws DESC, n DESC, sim DESC
    LIMIT %(limite)s
)
""" + SQL_RESUMO_ACHADOS

# Busca com filtros (P10): a pessoa entra se tiver ao menos uma candidatura que bata com todos os
# filtros ao mesmo tempo ("candidatou-se a senador, em 2022, no PI, pelo PT, e foi eleita"). O nome
# é opcional; sem ele, vêm primeiro os que mais venceram nas candidaturas que batem com os filtros.
FILTROS_CANDIDATURA = {
    "uf": "COALESCE(u.sigla, um.sigla) = %(uf)s",
    "cargo": "e.cod_cargo = %(cargo)s",
    "ano": "e.ano = %(ano)s",
    "partido": "pa.sigla = %(partido)s",
    "resultado": "(ma.id_mandato IS NOT NULL) = %(resultado)s",
}
CARGOS_BUSCA = {1: "Presidente", 3: "Governador", 5: "Senador", 6: "Deputado federal", 7: "Deputado estadual",
                11: "Prefeito", 13: "Vereador"}

SQL_BUSCA_FILTRADA = """
WITH cand AS (
    SELECT pe.id_politico, count(*) AS n, count(ma.id_mandato) AS v
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
achados AS (
    SELECT p.id_politico, p.nome, p.dt_nascimento, {ws} AS ws, c.n, 0 AS sim
    FROM cand c
    JOIN politico p ON p.id_politico = c.id_politico
    {nome}
    ORDER BY ws DESC, c.v DESC, c.n DESC, p.nome
    LIMIT %(limite)s
)
""" + SQL_RESUMO_ACHADOS
NOME_FILTRO = """WHERE f_unaccent(upper(p.nome)) %% f_unaccent(upper(%(q)s))
       OR f_unaccent(upper(p.nome)) LIKE '%%' || f_unaccent(upper(%(q)s)) || '%%'"""
NOME_WS = "word_similarity(f_unaccent(upper(%(q)s)), f_unaccent(upper(p.nome)))"


@lru_cache(maxsize=512)
def busca_filtrada(q: str, filtros: tuple, limite: int) -> list[dict]:
    f = dict(filtros)
    sql = SQL_BUSCA_FILTRADA.format(
        condicoes=" AND ".join(FILTROS_CANDIDATURA[k] for k in f),
        ws=NOME_WS if q else "0", nome=NOME_FILTRO if q else "")
    achados = consultar(sql, {**f, "q": q, "limite": limite})
    for r in achados:
        r["foto"] = foto_url(*r.pop("ultima").split("|"))
    return achados


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
           e.ano, c.nome AS cargo, e.cod_cargo,
           COALESCE(m.nm_municipio || ' - ' || um.sigla, u.sigla, 'BRASIL') AS local,
           COALESCE(u.sigla, um.sigla) AS uf, m.cd_ibge AS municipio_ibge,
           pa.sigla AS partido, COALESCE(ma.ds_situacao, 'NÃO ELEITO') AS situacao,
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
                     partido: str = "", resultado: str = "", limite: int = Query(8, ge=1, le=50)):
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
    if filtros:
        return busca_filtrada(q if len(q) >= 3 else "", tuple(sorted(filtros.items())), limite)
    if len(q) < 3:
        return []
    achados = consultar(SQL_BUSCA_POLITICOS, {"q": q, "limite": limite})
    for r in achados:
        r["foto"] = foto_url(*r.pop("ultima").split("|"))   # foto da candidatura mais recente
    return achados


@lru_cache(maxsize=1)
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
           bool_or(ma.id_mandato IS NOT NULL) AS eleito
    FROM politico_eleicao pe
    JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
    LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
    LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
    WHERE e.tipo <> 1 AND e.cod_cargo = %(cargo)s AND COALESCE(m.cd_uf, e.cd_uf) = %(cd_uf)s
    GROUP BY 1, 2, 3
)
SELECT count(DISTINCT (a.id_politico, a.ano)) FILTER (WHERE b.id_politico IS NOT NULL) AS tentaram,
       count(DISTINCT (a.id_politico, a.ano)) FILTER (WHERE b.eleito) AS reeleitos
FROM cand a
LEFT JOIN cand b ON b.id_politico = a.id_politico AND b.unidade = a.unidade AND b.ano = a.ano + %(passo)s
WHERE a.eleito AND a.ano + %(passo)s <= (SELECT max(ano) FROM cand)
"""
CARGOS_TITULARES = {3, 5, 6, 7, 8, 11, 13}   # governador, senador, deputados, prefeito, vereador


@lru_cache(maxsize=256)
def taxa_reeleicao(cod_cargo: int, sigla: str) -> dict | None:
    r = consultar(SQL_REELEICAO, {"cargo": cod_cargo, "cd_uf": UFS[sigla]["cd_ibge"],
                                  "passo": 8 if cod_cargo == SENADOR else 4})[0]
    if not r["tentaram"]:
        return None
    return {"tentaram": r["tentaram"], "reeleitos": r["reeleitos"], "taxa": round(100 * r["reeleitos"] / r["tentaram"], 1)}


@app.get("/api/politicos/{id_politico}")
def detalhar_politico(id_politico: int):
    p = consultar("SELECT id_politico AS id, nome, extract(year FROM dt_nascimento)::int AS nascimento_ano "
                  "FROM politico WHERE id_politico = %s", (id_politico,))
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
WHERE e.ano = %(ano)s AND e.cod_cargo = %(cargo)s AND e.tipo <> 1
  AND COALESCE(u.sigla, um.sigla) = ANY(%(ufs)s)
  AND (%(municipio)s::int IS NULL OR m.cd_ibge = %(municipio)s::int)
"""


@lru_cache(maxsize=1)
def ipca() -> dict[int, float]:
    """Fator para levar reais de outubro de cada ano a reais de outubro de 2024."""
    idx = {r["ano"]: float(r["indice"]) for r in consultar("SELECT ano, indice FROM ipca_outubro")}
    return {a: round(idx[2024] / i, 4) for a, i in idx.items()}


@lru_cache(maxsize=256)
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
    eleitos = [r for r in linhas if r["eleito"]]
    total = sum(r["despesa"] for r in linhas)
    return {"candidatos": len(linhas), "cadeiras": len(eleitos), "gasto_total": round(total, 2),
            "custo_cadeira": round(total / len(eleitos), 2) if eleitos else None,
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


@app.get("/api/cadeira")
def custo_cadeira(ano: int, cargo: int, uf: str = "", municipio: int | None = None):
    if cargo not in CARGOS_P1:
        raise HTTPException(404, f"Cargo fora da P1: {cargo}")
    if ano not in ipca() or (ano % 4 == 0) != (cargo in MUNICIPAIS):
        raise HTTPException(404, f"Não houve eleição para {CARGOS_P1[cargo].lower()} em {ano}")
    ufs = tuple(sorted(carregadas()))
    if uf:
        if uf.upper() not in ufs:
            raise HTTPException(404, f"UF sem dados: {uf}")
        ufs = (uf.upper(),)
    if cargo == 13 and municipio is None:
        raise HTTPException(422, "Para vereador, escolha um município")
    if municipio is not None:
        if municipio not in MUNICIPIOS or MUNICIPIOS[municipio]["sg_uf"] not in ufs:
            raise HTTPException(404, f"Município sem dados: {municipio}")
        ufs = (MUNICIPIOS[municipio]["sg_uf"],)
    return cadeira(ano, cargo, ufs, municipio)


@lru_cache(maxsize=256)
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


@app.get("/api/geo/brasil")
def geo_brasil(request: Request):
    return geojson("brasil_ufs.geojson", request)


@app.get("/api/geo/uf/{sigla}")
def geo_uf(sigla: str, request: Request):
    return geojson(f"municipios_{uf_de(sigla)['cd_ibge']}.geojson", request)
