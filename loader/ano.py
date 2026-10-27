"""Linha de comando: python -m loader.ano ANO [UF ...] [--simular]  (rode da pasta do projeto).

Carrega um ano só nas UFs que já estão no banco, sem recarregar os outros anos (a carga normal, python -m
loader, é por UF inteira e pula as que já estão lá). Feito para 2026, que o TSE publica aos poucos: rodar de
novo, depois que o crawler trouxer a versão nova dos arquivos, apaga o ano das UFs e carrega outra vez.

Para cada UF, numa transação só: apaga as disputas do ano na UF e o que pende delas (candidaturas, mandatos,
bens, receitas, despesas, votação, comparecimento), lê só os arquivos do ano, grava com os mesmos passos da
carga normal (carga.carregar_uf) e marca a UF como recarregada (carga_uf.carregada_em, o que também renova o
cache da API). No fim, atualiza os resumos de campanha e o viés dos partidos, como a carga normal.

Sem UF: o BR (as disputas nacionais) e todas as UFs já carregadas. Os votos para presidente ficam nas zonas de
cada UF e apontam para as candidaturas do BR; por isso, quando o BR é refeito, todas as UFs são refeitas juntas.
Com UFs: o BR só entra se ainda não tiver o ano.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import psycopg2

from . import carga, fontes, vies
from .__main__ import BANCO_PADRAO, RAIZ_PADRAO, _duracao

# o que pende das disputas do ano na UF, filhos antes dos pais (tmp_* montados em _alvos)
REMOCOES = [
    ("votacao_candidato_munzona", "id_eleicao IN (SELECT id_eleicao FROM tmp_ano_el_todas) AND {zona}"),
    ("votacao_partido_munzona", "id_eleicao IN (SELECT id_eleicao FROM tmp_ano_el_todas) AND {zona}"),
    ("votacao_municipio", "id_eleicao IN (SELECT id_eleicao FROM tmp_ano_el_todas) AND {mun}"),
    ("perfil_eleitorado_munzona", "ano_eleicao = %(ano)s AND {zona}"),
    ("votacao_partido_municipio", "ano_eleicao = %(ano)s AND {mun}"),
    ("mandato", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_ano_pe)"),
    ("bem", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_ano_pe)"),
    ("receita_de_campanha", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_ano_pe)"),
    ("despesa_de_campanha", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_ano_pe)"),
    # votos que sobraram em outras UFs para estas candidaturas (só acontece com o BR, que refaz todas)
    ("votacao_candidato_munzona", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_ano_pe)"),
    ("politico_eleicao", "id_politico_eleicao IN (SELECT id_politico_eleicao FROM tmp_ano_pe)"),
    ("votacao_partido_munzona", "id_eleicao IN (SELECT id_eleicao FROM tmp_ano_el)"),
    ("votacao_municipio", "id_eleicao IN (SELECT id_eleicao FROM tmp_ano_el)"),
    ("eleicao", "id_eleicao IN (SELECT id_eleicao FROM tmp_ano_el)"),
    # ponytail: só apaga quem ficou órfão; nome, escolaridade e ano_ultima_candidatura atualizados pelo ano
    # não voltam atrás (a carga seguinte do mesmo ano os grava de novo)
    ("politico", "id_politico IN (SELECT id_politico FROM tmp_ano_pe)"
                 " AND NOT EXISTS (SELECT 1 FROM politico_eleicao pe WHERE pe.id_politico = politico.id_politico)"),
    ("fornecedor", "NOT EXISTS (SELECT 1 FROM despesa_de_campanha d WHERE d.numero_fornecedor = fornecedor.numero)"),
]


def _argumentos(argv):
    p = argparse.ArgumentParser(prog="python -m loader.ano",
                                description="Carrega (ou recarrega) um ano nas UFs que já estão no banco.")
    p.add_argument("ano", type=int, help="ano da eleição (ex.: 2026)")
    p.add_argument("ufs", nargs="*", metavar="UF", help="UFs já carregadas (padrão: o BR e todas)")
    p.add_argument("--dados", type=Path, default=RAIZ_PADRAO, help="pasta com os dados (padrão: ./dados)")
    p.add_argument("--banco", default=os.environ.get("DATABASE_URL", BANCO_PADRAO))
    p.add_argument("--simular", action="store_true", help="faz tudo e desfaz no fim (para ver as contagens)")
    return p.parse_args(argv)


def _alvos(cur, uf: str, cd_uf: int | None, ano: int) -> None:
    """tmp_ano_el: disputas do ano na UF (BR: as nacionais); tmp_ano_el_todas: as do ano em qualquer lugar;
    tmp_ano_pe: as candidaturas delas; tmp_ano_zona e tmp_ano_mun: o território da UF."""
    cur.execute("""
        DROP TABLE IF EXISTS tmp_ano_mun, tmp_ano_zona, tmp_ano_el, tmp_ano_el_todas, tmp_ano_pe;
        CREATE TEMP TABLE tmp_ano_mun AS SELECT cd_municipio FROM municipio WHERE cd_uf = %(cd_uf)s;
        CREATE TEMP TABLE tmp_ano_zona AS
            SELECT id_zona FROM zona_eleitoral WHERE cd_municipio IN (SELECT cd_municipio FROM tmp_ano_mun);
        CREATE TEMP TABLE tmp_ano_el_todas AS SELECT id_eleicao FROM eleicao WHERE ano = %(ano)s;
        CREATE TEMP TABLE tmp_ano_el AS
            SELECT id_eleicao FROM eleicao
            WHERE ano = %(ano)s AND CASE WHEN %(br)s THEN cd_uf IS NULL AND cd_municipio IS NULL
                       ELSE cd_uf = %(cd_uf)s OR cd_municipio IN (SELECT cd_municipio FROM tmp_ano_mun) END;
        CREATE TEMP TABLE tmp_ano_pe AS
            SELECT id_politico_eleicao, id_politico FROM politico_eleicao WHERE id_eleicao IN (SELECT id_eleicao FROM tmp_ano_el);
        ANALYZE tmp_ano_mun; ANALYZE tmp_ano_zona; ANALYZE tmp_ano_el; ANALYZE tmp_ano_el_todas; ANALYZE tmp_ano_pe""",
                {"cd_uf": cd_uf, "ano": ano, "br": uf == "BR"})


def apagar_ano(cur, uf: str, cd_uf: int | None, ano: int) -> dict[str, int]:
    """Apaga o ano da UF (não faz commit). No BR, a votação das disputas nacionais sai de todas as zonas."""
    _alvos(cur, uf, cd_uf, ano)
    zona = "TRUE" if uf == "BR" else "id_zona IN (SELECT id_zona FROM tmp_ano_zona)"
    mun = "TRUE" if uf == "BR" else "cd_municipio IN (SELECT cd_municipio FROM tmp_ano_mun)"
    apagadas: dict[str, int] = {}
    for tabela, condicao in REMOCOES:
        # no BR, perfil e votos por partido são das UFs (não há zona do BR): só as linhas das disputas nacionais
        if uf == "BR" and tabela in ("perfil_eleitorado_munzona", "votacao_partido_municipio"):
            continue
        if uf == "BR" and "tmp_ano_el_todas" in condicao:
            condicao = condicao.replace("tmp_ano_el_todas", "tmp_ano_el")
        cur.execute(f"DELETE FROM {tabela} WHERE {condicao.format(zona=zona, mun=mun)}", {"ano": ano})
        apagadas[tabela] = apagadas.get(tabela, 0) + cur.rowcount
    return apagadas


def _preparar_ano(cur, raiz: Path, ufs: list[str], ano: int) -> None:
    """Como o _preparar da carga normal, mas só com os arquivos do ano."""
    print("\nLendo os arquivos do ano:")
    carga.criar_staging(cur, ufs)
    filtro = set(ufs)
    for conjunto in fontes.CONJUNTOS:
        lista = [a for a in fontes.arquivos(raiz, conjunto, filtro) if f"_{ano}" in a.name or a.parent.name == str(ano)]
        if not lista:
            print(f"  aviso: nenhum arquivo de {ano} para {conjunto.padrao} em {raiz / conjunto.pasta}")
        for arquivo in lista:
            print(f"  {arquivo.relative_to(raiz)} ...", end="", flush=True)
            inicio, linhas = time.monotonic(), 0
            for bloco in fontes.ler(arquivo, conjunto, filtro):
                bloco = bloco[bloco["ano"] == ano] if "ano" in bloco else bloco
                if len(bloco):
                    carga.gravar_staging(cur, conjunto, bloco)
                    linhas += len(bloco)
            cur.connection.commit()
            print(f" {linhas:,} linhas ({_duracao(time.monotonic() - inicio)})")
    carga.analisar_staging(cur, ufs)
    cur.connection.commit()


def main(argv=None) -> int:
    args = _argumentos(argv)
    raiz = args.dados.resolve()
    municipios = fontes.municipios(raiz)
    cd_uf = dict(zip(municipios["sg_uf"], municipios["cd_uf"].astype(int)))
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
        cur.execute("SELECT EXISTS (SELECT 1 FROM eleicao WHERE ano = %s AND cd_uf IS NULL AND cd_municipio IS NULL)", (args.ano,))
        br_tem_ano = cur.fetchone()[0]
        if args.ufs:
            pedidas = list(dict.fromkeys(u.strip().upper() for u in args.ufs))
            fora = [u for u in pedidas if u not in carregadas]
            if fora:
                print(f"UFs que ainda não estão no banco (carregue com python -m loader): {' '.join(fora)}", file=sys.stderr)
                return 2
            ufs = (["BR"] if "BR" in pedidas or not br_tem_ano else []) + [u for u in pedidas if u != "BR"]
            if "BR" in ufs and br_tem_ano and len(ufs) < len(carregadas):
                print("Refazer o BR apaga os votos para presidente de todas as UFs: rode sem UFs para refazer todas.", file=sys.stderr)
                return 2
        else:
            ufs = ["BR"] + sorted(carregadas - {"BR"})
        print(f"Ano {args.ano} em: {' '.join(ufs)}")

        inicio = time.monotonic()
        carga.preparar_referencias(cur, municipios, fontes.indices(raiz))
        conn.commit()
        _preparar_ano(cur, raiz, ufs, args.ano)

        print("\nGravando no modelo:")
        for uf in ufs:
            print(f"  {uf} ...", end="", flush=True)
            t0 = time.monotonic()
            try:
                apagadas = apagar_ano(cur, uf, cd_uf.get(uf), args.ano)
                resumo = carga.carregar_uf(cur, uf, cd_uf.get(uf))
                cur.execute("UPDATE carga_uf SET carregada_em = now(), linhas = linhas || %s::jsonb WHERE sg_uf = %s",
                            (json.dumps({f"ano_{args.ano}": {**resumo, "apagadas": {k: v for k, v in apagadas.items() if v}}}), uf))
                if args.simular:
                    conn.rollback()
                else:
                    conn.commit()
            except Exception:
                conn.rollback()
                print(" falhou; o ano desta UF ficou como estava.")
                raise
            carga.descartar_staging(cur, uf)
            conn.commit()
            print(f" ok ({_duracao(time.monotonic() - t0)}){' [simulado]' if args.simular else ''}")
            for motivo, n in sorted({k: v for k, v in apagadas.items() if v}.items()):
                print(f"      apagadas: {motivo:<36}{n:>12,}")
            for tabela, n in sorted(resumo["inseridas"].items()):
                print(f"      {tabela:<38}{n:>12,}")
            for motivo, n in sorted(resumo["descartadas"].items()):
                print(f"      descartadas: {motivo:<40}{n:>10,}")
        if not args.simular:
            print("\nAtualizando os resumos de campanha ...", end="", flush=True)
            carga.atualizar_resumos(cur)
            conn.commit()
            print(" ok")
            print("Atualizando o viés e o alinhamento dos partidos (loader.vies) ...", end="", flush=True)
            cobertura = vies.atualizar(cur, raiz)
            conn.commit()
            print(f" ok. Cobertura dos votos válidos: {vies.resumo(cobertura)}")
        print(f"\nConcluído em {_duracao(time.monotonic() - inicio)}.")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
