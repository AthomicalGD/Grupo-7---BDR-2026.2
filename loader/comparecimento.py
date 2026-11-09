"""Linha de comando: python -m loader.comparecimento ANO [ANO ...] [--simular]  (rode da pasta do projeto).

Só acrescenta o comparecimento (aptos, comparecimento, brancos, nulos e abstenções por município, a tabela
votacao_municipio) de anos cujas disputas já estão no banco, nas UFs já carregadas. Feito para 2012 e 2016: as
candidaturas desses anos entraram na carga normal (o crawler baixa os candidatos desde 1994), mas o detalhe da
votação só passou a ser baixado depois, para o desempenho municipal dos partidos (P3).

Não apaga nada: ao contrário de python -m loader.ano, não refaz as disputas, as candidaturas nem os mandatos do
ano (refazê-los trocaria os ids e levaria junto, por exemplo, a roupa salva de quem só concorreu naquele ano).
Linhas que já existem ficam como estão. As disputas são ligadas pela mesma chave da carga normal
(CD_ELEICAO, NR_TURNO, CD_CARGO, SG_UE), e as linhas sem disputa no banco são contadas e deixadas de fora.
No fim, marca as UFs que ganharam linhas como recarregadas (carga_uf.carregada_em), o que renova o cache da API.
Uma carga completa futura (python -m loader) lê esses mesmos arquivos e chega às mesmas linhas.
"""
import argparse
import io
import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2

from . import carga, fontes
from .__main__ import BANCO_PADRAO, RAIZ_PADRAO

COLUNAS = ["cd_eleicao", "turno", "cod_cargo", "ue", "cd_municipio", "qt_aptos", "qt_comparecimento",
           "qt_brancos", "qt_nulos", "qt_abstencoes"]


def ler_detalhe(raiz, anos: set[int], ufs: set[str]) -> pd.DataFrame:
    """O detalhe da votação dos anos pedidos, somado por disputa e município."""
    conjunto = next(c for c in fontes.CONJUNTOS if c.nome == "detalhe")
    partes = []
    for arquivo in fontes.arquivos(raiz, conjunto, ufs):
        for bloco in fontes.ler(arquivo, conjunto, ufs):
            bloco = bloco[bloco["ano"].isin(anos)]
            if len(bloco):
                partes.append(bloco[COLUNAS])
    if not partes:
        return pd.DataFrame(columns=COLUNAS)
    df = pd.concat(partes).dropna(subset=["cd_eleicao", "turno", "cod_cargo", "ue", "cd_municipio"])
    return df.groupby(COLUNAS[:5], as_index=False)[COLUNAS[5:]].sum()


def gravar(cur, df: pd.DataFrame, anos: list[int]) -> dict:
    cur.execute("""
        CREATE TEMP TABLE tmp_detalhe (cd_eleicao int, turno int, cod_cargo int, ue text, cd_municipio int,
            qt_aptos bigint, qt_comparecimento bigint, qt_brancos bigint, qt_nulos bigint, qt_abstencoes bigint)
        ON COMMIT DROP""")
    buf = io.StringIO()
    df.astype({c: "Int64" for c in COLUNAS if c != "ue"}).to_csv(buf, index=False, header=False, na_rep="")
    buf.seek(0)
    cur.copy_expert("COPY tmp_detalhe FROM STDIN WITH (FORMAT csv)", buf)
    # a unidade eleitoral no formato do staging, como em carga._tmp_eleicao
    cur.execute("""
        CREATE TEMP TABLE tmp_el ON COMMIT DROP AS
        SELECT e.id_eleicao, e.cd_eleicao, e.ano, e.turno, e.cod_cargo,
               COALESCE(e.cd_municipio::text, uf.sigla::text, 'BR') AS ue
        FROM eleicao e LEFT JOIN uf ON uf.cd_ibge = e.cd_uf
        WHERE e.ano = ANY(%s)""", (anos,))
    cur.execute(f"""
        SELECT t.ano, count(*) FILTER (WHERE v.id_eleicao IS NULL) AS novas, count(*) AS ligadas
        FROM tmp_detalhe d
        JOIN tmp_el t ON {carga.DISPUTA.format(x='d')}
        JOIN municipio m ON m.cd_municipio = d.cd_municipio
        LEFT JOIN votacao_municipio v ON v.id_eleicao = t.id_eleicao AND v.cd_municipio = d.cd_municipio
        GROUP BY 1 ORDER BY 1""")
    por_ano = {ano: {"novas": novas, "ligadas": ligadas} for ano, novas, ligadas in cur.fetchall()}
    cur.execute(f"""
        SELECT count(*) FROM tmp_detalhe d
        WHERE NOT EXISTS (SELECT 1 FROM tmp_el t WHERE {carga.DISPUTA.format(x='d')})""")
    sem_disputa = cur.fetchone()[0]
    cur.execute(f"""
        WITH novas AS (
            INSERT INTO votacao_municipio (id_eleicao, cd_municipio, qt_aptos, qt_comparecimento,
                                           qt_brancos, qt_nulos, qt_abstencoes)
            SELECT t.id_eleicao, d.cd_municipio, d.qt_aptos, d.qt_comparecimento, d.qt_brancos, d.qt_nulos, d.qt_abstencoes
            FROM tmp_detalhe d
            JOIN tmp_el t ON {carga.DISPUTA.format(x='d')}
            JOIN municipio m ON m.cd_municipio = d.cd_municipio
            ON CONFLICT (id_eleicao, cd_municipio) DO NOTHING
            RETURNING cd_municipio)
        SELECT DISTINCT u.sigla FROM novas JOIN municipio m USING (cd_municipio) JOIN uf u ON u.cd_ibge = m.cd_uf""")
    ufs = sorted(r[0] for r in cur.fetchall())
    if ufs:
        cur.execute("UPDATE carga_uf SET carregada_em = now() WHERE sg_uf = ANY(%s)", (ufs,))
    return {"por_ano": por_ano, "sem_disputa": sem_disputa, "ufs": ufs}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="python -m loader.comparecimento", description=__doc__.split("\n\n")[1])
    p.add_argument("anos", type=int, nargs="+", metavar="ANO")
    p.add_argument("--simular", action="store_true", help="faz a conta e desfaz no fim, sem gravar")
    p.add_argument("--dados", type=Path, default=RAIZ_PADRAO, help="pasta dos dados (padrão: ./dados)")
    p.add_argument("--banco", default=os.environ.get("DATABASE_URL", BANCO_PADRAO))
    args = p.parse_args(argv)

    with psycopg2.connect(args.banco) as conn, conn.cursor() as cur:
        if not carga.travar(cur):
            print("Outra carga está rodando neste banco. Tente de novo quando ela terminar.")
            return 1
        cur.execute("SELECT sg_uf FROM carga_uf WHERE sg_uf <> 'BR'")
        ufs = {r[0] for r in cur.fetchall()}
        if not ufs:
            print("Nenhuma UF carregada: rode antes python -m loader.")
            return 1
        print(f"Lendo o detalhe da votação de {', '.join(map(str, args.anos))} em {', '.join(sorted(ufs))}...")
        df = ler_detalhe(args.dados, set(args.anos), ufs)
        if df.empty:
            print("Nenhuma linha desses anos nos arquivos: baixe antes com python -m crawler --perguntas 3 --anos ...")
            return 1
        r = gravar(cur, df, args.anos)
        for ano in args.anos:
            a = r["por_ano"].get(ano, {"novas": 0, "ligadas": 0})
            print(f"  {ano}: {a['ligadas']} linhas (disputa x município) ligadas a disputas do banco, {a['novas']} novas")
        if r["sem_disputa"]:
            print(f"  {r['sem_disputa']} linhas sem disputa correspondente no banco ficaram de fora")
        if args.simular:
            conn.rollback()
            print("Simulação: nada foi gravado.")
        else:
            conn.commit()
            print(f"Gravado. UFs marcadas como recarregadas (renova o cache da API): {', '.join(r['ufs']) or 'nenhuma'}.")
            print("Reinicie a API.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
