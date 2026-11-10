"""Índices municipais (PIB, população, IDHM, idade do Censo 2022) no banco, sem refazer a carga das UFs:
python -m loader.indices [opções]

A carga de cada UF (python -m loader) grava indices_municipio uma vez e não regrava o que já existe. Quando o crawler
baixa anos novos do IBGE (por exemplo, o PIB e a população desde 2010, para a eleição municipal de 2012 na P3),
este comando lê de novo os arquivos de dados/ibge e dados/ipea_atlas com a mesma leitura da carga
(loader.fontes.indices) e grava os municípios já carregados no banco:

- ano novo: a linha é inserida;
- ano que já existe: cada coluna com valor novo é atualizada; um valor ausente no arquivo não apaga o do banco.

Municípios de UFs não carregadas ficam de fora (entram com a carga da UF). Depois, reinicie a API.
"""
import argparse
import os
import sys
import time
from collections import Counter
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from . import fontes
from .__main__ import BANCO_PADRAO, RAIZ_PADRAO, _duracao

COLUNAS = ("idhm", "pib", "mediana_idade", "indice_envelhecimento", "populacao")

SQL_GRAVAR = f"""
INSERT INTO indices_municipio (cd_municipio, ano, {", ".join(COLUNAS)})
SELECT m.cd_municipio, v.ano::smallint, {", ".join(f"v.{c}::{'integer' if c == 'populacao' else 'numeric'}" for c in COLUNAS)}
FROM (VALUES %s) AS v (cd_ibge, ano, {", ".join(COLUNAS)})
JOIN municipio m ON m.cd_ibge = v.cd_ibge
ON CONFLICT (cd_municipio, ano) DO UPDATE SET
{",".join(f"  {c} = COALESCE(EXCLUDED.{c}, indices_municipio.{c})" for c in COLUNAS)}
"""


def _argumentos(argv):
    p = argparse.ArgumentParser(prog="python -m loader.indices",
                                description="Regrava os índices municipais (indices_municipio) dos municípios já carregados.")
    p.add_argument("--dados", type=Path, default=RAIZ_PADRAO, help="pasta com os dados (padrão: ./dados)")
    p.add_argument("--banco", default=os.environ.get("DATABASE_URL", BANCO_PADRAO),
                   help="URL de conexão (padrão: $DATABASE_URL ou o banco do docker-compose.yml)")
    p.add_argument("--simular", action="store_true", help="só lê os arquivos e mostra o que há por ano, sem gravar")
    return p.parse_args(argv)


def main(argv=None) -> None:
    a = _argumentos(argv)
    inicio = time.monotonic()
    df = fontes.indices(a.dados)
    if df.empty:
        sys.exit(f"Nenhum índice achado em {a.dados / 'ibge'} nem em {a.dados / 'ipea_atlas'}: rode o crawler antes.")

    print("\n  ano  " + "".join(f"{c:>23}" for c in COLUNAS))
    for ano, g in df.groupby("ano"):
        print(f"  {ano}  " + "".join(f"{int(g[c].notna().sum()):>23,}" for c in COLUNAS))
    if a.simular:
        print("\n--simular: nada foi gravado.")
        return

    linhas = [(int(r.cd_ibge), int(r.ano), *(None if pd.isna(getattr(r, c)) else
                                             (int(getattr(r, c)) if c == "populacao" else float(getattr(r, c)))
                                             for c in COLUNAS))
              for r in df.itertuples(index=False)]
    conn = psycopg2.connect(a.banco)
    with conn, conn.cursor() as cur:
        cur.execute("SELECT ano, count(*) FROM indices_municipio GROUP BY 1")
        antes = Counter(dict(cur.fetchall()))
        execute_values(cur, SQL_GRAVAR, linhas, page_size=5000)
        cur.execute("SELECT ano, count(*) FROM indices_municipio GROUP BY 1")
        depois = Counter(dict(cur.fetchall()))
    conn.close()
    novos = {ano: depois[ano] - antes[ano] for ano in sorted(depois) if depois[ano] != antes[ano]}
    print(f"\nindices_municipio gravada em {_duracao(time.monotonic() - inicio)}: "
          f"{sum(novos.values()):,} linhas novas" + (f" ({', '.join(f'{k}: {v:,}' for k, v in novos.items())})" if novos else "")
          + ". Reinicie a API.")


if __name__ == "__main__":
    main()
