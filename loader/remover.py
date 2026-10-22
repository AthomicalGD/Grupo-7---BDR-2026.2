"""Linha de comando: python -m loader.remover UF [UF ...] [--simular]  (rode da pasta do projeto).

Desfaz a carga das UFs indicadas: apaga municípios, zonas, disputas, candidaturas, votação, contas e
indicadores da UF, os políticos e fornecedores que ficaram sem nenhuma candidatura e o registro em carga_uf.
Cada UF sai numa única transação; depois, a UF pode ser carregada de novo com python -m loader.
Partidos, cargos e as UFs em si ficam: são compartilhados com o resto do banco.
"""
import argparse
import os
import sys
import time

import psycopg2

from . import carga
from .__main__ import BANCO_PADRAO, _duracao

# Ordem de remoção: filhos antes dos pais. Os conjuntos tmp_* são montados em _alvos().
REMOCOES = [
    ("votacao_candidato_munzona", "id_zona IN (SELECT id_zona FROM tmp_zona)"),
    ("votacao_partido_munzona", "id_zona IN (SELECT id_zona FROM tmp_zona)"),
    ("perfil_eleitorado_munzona", "id_zona IN (SELECT id_zona FROM tmp_zona)"),
    # votação nas zonas de outras UFs não aponta para disputas desta; o que sobrar aqui barra a remoção (FK)
    ("votacao_municipio", "cd_municipio IN (SELECT cd_municipio FROM tmp_mun)"),
    ("votacao_partido_municipio", "cd_municipio IN (SELECT cd_municipio FROM tmp_mun)"),
    ("indices_municipio", "cd_municipio IN (SELECT cd_municipio FROM tmp_mun)"),
    ("vies_municipio", "cd_municipio IN (SELECT cd_municipio FROM tmp_mun)"),
    ("malha_municipio", "cd_municipio IN (SELECT cd_municipio FROM tmp_mun)"),
    ("ibge_censo_municipio", "cd_municipio IN (SELECT cd_municipio FROM tmp_mun)"),
    ("mandato", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_pe)"),
    ("bem", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_pe)"),
    ("receita_de_campanha", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_pe)"),
    ("despesa_de_campanha", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_pe)"),
    ("politico_eleicao", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_pe)"),
    ("eleicao", "id_eleicao IN (SELECT id_eleicao FROM tmp_el)"),
    ("zona_eleitoral", "id_zona IN (SELECT id_zona FROM tmp_zona)"),
    ("municipio", "cd_municipio IN (SELECT cd_municipio FROM tmp_mun)"),
    # ponytail: só apaga quem ficou órfão; nome e ano_ultima_candidatura de quem concorreu em outra UF não voltam atrás
    ("politico", "id_politico IN (SELECT id_politico FROM tmp_pe)"
                 " AND NOT EXISTS (SELECT 1 FROM politico_eleicao pe WHERE pe.id_politico = politico.id_politico)"),
    ("fornecedor", "NOT EXISTS (SELECT 1 FROM despesa_de_campanha d WHERE d.numero_fornecedor = fornecedor.numero)"),
]


def _argumentos(argv):
    p = argparse.ArgumentParser(
        prog="python -m loader.remover",
        description="Remove do PostgreSQL os dados das UFs indicadas. BR só sai depois de todas as outras.",
    )
    p.add_argument("ufs", nargs="+", metavar="UF", help="siglas das UFs a remover (ex.: AC RS)")
    p.add_argument("--simular", action="store_true", help="mostra o que seria apagado e desfaz tudo no fim")
    p.add_argument("--banco", default=os.environ.get("DATABASE_URL", BANCO_PADRAO),
                   help="URL de conexão (padrão: $DATABASE_URL ou o banco do docker-compose.yml)")
    return p.parse_args(argv)


def _alvos(cur, uf: str) -> None:
    """Tabelas temporárias com o que pertence à UF (BR: as disputas nacionais)."""
    cur.execute("SELECT cd_ibge FROM uf WHERE sigla = %s", (uf,))
    linha = cur.fetchone()
    cd_uf = linha[0] if linha else None
    cur.execute("""
        DROP TABLE IF EXISTS tmp_mun, tmp_zona, tmp_el, tmp_pe;
        CREATE TEMP TABLE tmp_mun ON COMMIT DROP AS SELECT cd_municipio FROM municipio WHERE cd_uf = %(cd_uf)s;
        CREATE TEMP TABLE tmp_zona ON COMMIT DROP AS
            SELECT id_zona FROM zona_eleitoral WHERE cd_municipio IN (SELECT cd_municipio FROM tmp_mun);
        CREATE TEMP TABLE tmp_el ON COMMIT DROP AS
            SELECT id_eleicao FROM eleicao
            WHERE CASE WHEN %(br)s THEN cd_uf IS NULL AND cd_municipio IS NULL
                       ELSE cd_uf = %(cd_uf)s OR cd_municipio IN (SELECT cd_municipio FROM tmp_mun) END;
        CREATE TEMP TABLE tmp_pe ON COMMIT DROP AS
            SELECT id_politico_eleicao, id_politico FROM politico_eleicao
            WHERE id_eleicao IN (SELECT id_eleicao FROM tmp_el);
        ANALYZE tmp_mun; ANALYZE tmp_zona; ANALYZE tmp_el; ANALYZE tmp_pe""",
                {"cd_uf": cd_uf, "br": uf == "BR"})


def remover_uf(cur, uf: str) -> dict[str, int]:
    """Apaga a UF das tabelas do modelo e de carga_uf. Não faz commit."""
    _alvos(cur, uf)
    apagadas = {}
    for tabela, condicao in REMOCOES:
        cur.execute(f"DELETE FROM {tabela} WHERE {condicao}")
        apagadas[tabela] = cur.rowcount
    cur.execute("DELETE FROM carga_uf WHERE sg_uf = %s", (uf,))
    return apagadas


def main(argv=None) -> int:
    args = _argumentos(argv)
    pedidas = list(dict.fromkeys(u.strip().upper() for u in args.ufs))

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
            print("Uma carga está em andamento neste banco.", file=sys.stderr)
            return 1

        carregadas = carga.ufs_carregadas(cur)
        fora = [u for u in pedidas if u not in carregadas]
        if fora:
            print(f"Não carregadas (puladas): {' '.join(fora)}")
        pendentes = [u for u in pedidas if u in carregadas]
        # BR guarda as candidaturas a Presidente, usadas pela votação de toda UF: sai por último e sozinho
        if "BR" in pendentes:
            pendentes.remove("BR")
            if carregadas - set(pendentes) - {"BR"}:
                print("BR fica: ainda há UFs carregadas que usam as candidaturas a Presidente.", file=sys.stderr)
            else:
                pendentes.append("BR")
        if not pendentes:
            print("Nada a remover.")
            return 0
        print(f"{'Simulando a remoção de' if args.simular else 'A remover'}: {' '.join(pendentes)}")

        inicio = time.monotonic()
        for uf in pendentes:
            print(f"  {uf} ...", end="", flush=True)
            t0 = time.monotonic()
            try:
                apagadas = remover_uf(cur, uf)
            except Exception:
                conn.rollback()
                print(" falhou; nada desta UF foi apagado.")
                raise
            if not args.simular:
                conn.commit()
            print(f" ok ({_duracao(time.monotonic() - t0)})")
            for tabela, n in apagadas.items():
                if n:
                    print(f"      {tabela:<28}{n:>12,}")
        if args.simular:
            conn.rollback()
            print("\nSimulação: nada foi apagado.")
        else:
            print("\nAtualizando os resumos de campanha ...", end="", flush=True)
            carga.atualizar_resumos(cur)
            conn.commit()
            print(" ok")
            print("Reinicie a API: ela guarda as respostas em cache.")
        print(f"\nConcluído em {_duracao(time.monotonic() - inicio)}.")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
