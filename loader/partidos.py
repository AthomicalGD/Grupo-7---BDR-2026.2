"""Preenche o partido das candidaturas já carregadas: python -m loader.partidos

A migração 011 criou politico_eleicao.id_partido e as cargas novas já gravam o campo.
Este passo relê só os arquivos de candidatos das UFs carregadas e atualiza as views da P1.
"""
import os
import time

import psycopg2

from . import carga, fontes
from .__main__ import BANCO_PADRAO, RAIZ_PADRAO, _duracao


def main() -> None:
    inicio = time.monotonic()
    conn = psycopg2.connect(os.environ.get("DATABASE_URL", BANCO_PADRAO))
    cur = conn.cursor()
    ufs = sorted(carga.ufs_carregadas(cur))
    cand = next(c for c in fontes.CONJUNTOS if c.nome == "candidato")
    for uf in ufs:
        colunas = ", ".join(f"{nome} {fontes.TIPOS_SQL[tipo]}" for nome, tipo in cand.estrutura)
        cur.execute(f"CREATE TEMP TABLE stg_{uf.lower()}_candidato ({colunas})")
    for arquivo in fontes.arquivos(RAIZ_PADRAO, cand, set(ufs)):
        print(f"  {arquivo.relative_to(RAIZ_PADRAO)}", flush=True)
        for bloco in fontes.ler(arquivo, cand, set(ufs)):
            carga.gravar_staging(cur, cand, bloco)
    conn.commit()
    for uf in ufs:
        cur.execute("SELECT cd_ibge FROM uf WHERE sigla = %s", (uf,))
        linha = cur.fetchone()
        x = carga._Execucao(cur, uf, linha[0] if linha else None)
        cur.execute(f"ANALYZE stg_{uf.lower()}_candidato")
        carga._tmp_eleicao(x)
        carga.partidos_das_candidaturas(x)
        print(f"  {uf}: {cur.rowcount:,} candidaturas com partido")
        conn.commit()  # tmp_eleicao some aqui (ON COMMIT DROP)
    print("Atualizando os resumos de campanha ...", flush=True)
    carga.atualizar_resumos(cur)
    conn.commit()
    conn.close()
    print(f"Concluído em {_duracao(time.monotonic() - inicio)}.")


if __name__ == "__main__":
    main()
