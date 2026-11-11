"""Preenche perfil_etario_munzona (P6, migração 015) nas UFs já carregadas:
python -m loader.perfil_etario

As cargas novas já gravam a tabela. Este passo relê só os CSVs de perfil do eleitorado
(perfil_comparecimento_abstencao, ~2 GB por ano) das UFs carregadas, soma aptos e comparecimento do
1º turno por zona e faixa etária e regrava a tabela de cada UF numa transação (pode rodar de novo).
"""
import os
import time

import pandas as pd
import psycopg2

from . import carga, fontes
from .__main__ import BANCO_PADRAO, RAIZ_PADRAO, _duracao


def _somar_faixa(df: pd.DataFrame) -> pd.DataFrame:
    df = df[df["turno"].eq(1).fillna(False)]
    chaves = ["sg_uf", "ano", "turno", "cd_municipio", "nr_zona", "faixa"]
    return df.groupby(chaves, dropna=False, as_index=False)[["qt_aptos", "qt_comparecimento"]].sum()


# Só as colunas da faixa etária; o nome "perfil" deixa carga.PERFIL_ETARIO ler a tabela de staging.
PERFIL = fontes.Conjunto("perfil", "tse/comparecimento_abstencao", "perfil_comparecimento_abstencao_*.csv", {
    "ANO_ELEICAO": ("ano", "int"), "NR_TURNO": ("turno", "int"), "CD_MUNICIPIO": ("cd_municipio", "int"),
    "NR_ZONA": ("nr_zona", "int"), "CD_FAIXA_ETARIA": ("faixa", "int"), "QT_APTOS": ("qt_aptos", "int"),
    "QT_COMPARECIMENTO": ("qt_comparecimento", "int"),
}, pos=_somar_faixa)


def main() -> None:
    inicio = time.monotonic()
    conn = psycopg2.connect(os.environ.get("DATABASE_URL", BANCO_PADRAO))
    cur = conn.cursor()
    cur.execute("SELECT to_regclass('public.perfil_etario_munzona') IS NOT NULL")
    if not cur.fetchone()[0]:
        raise SystemExit("Falta a migração 015_perfil_etario.sql: rode docker compose run --rm migracoes")
    ufs = sorted(carga.ufs_carregadas(cur) - {"BR"})
    colunas = ", ".join(f"{nome} {fontes.TIPOS_SQL[tipo]}" for nome, tipo in PERFIL.estrutura)
    for uf in ufs:
        cur.execute(f"CREATE TEMP TABLE stg_{uf.lower()}_perfil ({colunas})")
    for arquivo in fontes.arquivos(RAIZ_PADRAO, PERFIL, set(ufs)):
        print(f"  {arquivo.relative_to(RAIZ_PADRAO)}", flush=True)
        for bloco in fontes.ler(arquivo, PERFIL, set(ufs)):
            carga.gravar_staging(cur, PERFIL, bloco)
    conn.commit()
    zona = "z.cd_municipio = v.cd_municipio AND z.numero = v.nr_zona"
    for uf in ufs:
        cur.execute("SELECT cd_ibge FROM uf WHERE sigla = %s", (uf,))
        x = carga._Execucao(cur, uf, cur.fetchone()[0])
        x.sql("""
            CREATE TEMP TABLE tmp_zona ON COMMIT DROP AS
            SELECT z.id_zona, z.cd_municipio, z.numero
            FROM zona_eleitoral z JOIN municipio m USING (cd_municipio)
            WHERE m.cd_uf = %(cd_uf)s;
            CREATE INDEX ON tmp_zona (cd_municipio, numero);
            ANALYZE tmp_zona;
            ANALYZE {s}perfil;
            DELETE FROM perfil_etario_munzona WHERE id_zona IN (SELECT id_zona FROM tmp_zona)""")
        x.sql(carga.PERFIL_ETARIO.format(zona=zona), "perfil_etario_munzona")
        print(f"  {uf}: {x.inseridas['perfil_etario_munzona']:,} linhas".replace(",", "."), flush=True)
        conn.commit()  # tmp_zona some aqui (ON COMMIT DROP)
    carga.analisar(conn)
    conn.close()
    print(f"Concluído em {_duracao(time.monotonic() - inicio)}.")


if __name__ == "__main__":
    main()
