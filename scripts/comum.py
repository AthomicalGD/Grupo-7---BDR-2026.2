"""Utilidades compartilhadas pelos scripts de perguntas: conexão, UFs carregadas e saída em respostas/."""
import os
from pathlib import Path

import pandas as pd
import psycopg2

RAIZ = Path(__file__).resolve().parent.parent
RESPOSTAS = RAIZ / "respostas"
BANCO_PADRAO = "postgresql://eleicoes:eleicoes@localhost:5432/eleicoes"


def conectar():
    return psycopg2.connect(os.environ.get("DATABASE_URL", BANCO_PADRAO))


def consultar(conn, sql: str, params=None) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return pd.DataFrame(cur.fetchall(), columns=[c.name for c in cur.description])


def ufs_carregadas(conn) -> list[tuple[str, int]]:
    """(sigla, código IBGE) das UFs já carregadas pelo loader, sem 'BR'."""
    df = consultar(conn, """
        SELECT u.sigla, u.cd_ibge FROM carga_uf c JOIN uf u ON u.sigla = c.sg_uf ORDER BY u.sigla""")
    return list(df.itertuples(index=False, name=None))


def escolher_ufs(conn, pedidas: list[str]) -> list[tuple[str, int]]:
    carregadas = ufs_carregadas(conn)
    if not pedidas:
        return carregadas
    pedidas = {u.upper() for u in pedidas}
    faltando = pedidas - {s for s, _ in carregadas}
    if faltando:
        raise SystemExit(f"UFs não carregadas no banco: {', '.join(sorted(faltando))}")
    return [(s, c) for s, c in carregadas if s in pedidas]


def pct(parte: float, total: float) -> str:
    return f"{100 * parte / total:5.1f}%" if total else "    -"


def gravar_txt(nome: str, texto: str) -> Path:
    RESPOSTAS.mkdir(exist_ok=True)
    caminho = RESPOSTAS / nome
    caminho.write_text(texto, encoding="utf-8")
    return caminho
