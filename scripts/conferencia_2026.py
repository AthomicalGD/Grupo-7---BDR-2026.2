"""Conferência da eleição de 2026 no banco: o que o TSE já publicou bate consigo mesmo e com as vagas?

O TSE publica 2026 aos poucos (candidaturas, bens e o 1º turno primeiro; o 2º turno e a prestação de contas
final depois). Este script mede o que está completo e aponta as divergências, para decidir em quais perguntas
2026 entra e o que dizer na Metodologia.

Conferências:
  1. votos dos candidatos x votos válidos do detalhe (comparecimento − brancos − nulos), por cargo e UF;
     nos cargos majoritários (sem voto de legenda) os dois têm de ser iguais;
  2. eleitos x vagas, por cargo;
  3. candidaturas sem situação final (#NULO: indeferidas, renunciadas ou pendentes) que receberam votos;
  4. partidos com votos em 2026 e sem viés (ficam fora do mapa do viés);
  5. candidatos de 2026 que já estavam no banco (ligados pelo título, CPF ou nome e nascimento);
  6. disputas que foram ao 2º turno e o que já há delas.

Uso: python scripts/conferencia_2026.py [ANO]   (padrão: 2026)
Saída: respostas/conferencia_<ANO>.txt
"""
import sys

from comum import conectar, consultar, gravar_txt


def main() -> None:
    ano = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    p = {"ano": ano}
    with conectar() as conn:
        validos = consultar(conn, """
            WITH cand AS (
                SELECT e.id_eleicao, sum(v.qtd_votos_nominais) AS nominais
                FROM eleicao e JOIN votacao_candidato_munzona v ON v.id_eleicao = e.id_eleicao
                WHERE e.ano = %(ano)s AND e.turno = 1 GROUP BY 1
            ), det AS (
                -- com duas cadeiras de senador cada eleitor vota duas vezes: brancos e nulos já vêm em votos
                SELECT vm.id_eleicao, sum(CASE WHEN e.cod_cargo = 5 THEN e.quantidade_de_vagas ELSE 1 END * vm.qt_comparecimento
                                          - vm.qt_brancos - vm.qt_nulos) AS validos
                FROM votacao_municipio vm JOIN eleicao e ON e.id_eleicao = vm.id_eleicao GROUP BY 1
            )
            SELECT c.nome AS cargo, COALESCE(u.sigla, 'BR') AS uf, cand.nominais, det.validos
            FROM eleicao e JOIN cargo c ON c.cod_cargo = e.cod_cargo LEFT JOIN uf u ON u.cd_ibge = e.cd_uf
            JOIN cand ON cand.id_eleicao = e.id_eleicao LEFT JOIN det ON det.id_eleicao = e.id_eleicao
            WHERE e.ano = %(ano)s AND e.turno = 1 ORDER BY 1, 2""", p)
        eleitos = consultar(conn, """
            SELECT c.nome AS cargo, sum(e.quantidade_de_vagas) AS vagas,
                   sum((SELECT count(*) FROM politico_eleicao pe JOIN mandato m ON m.id_politico_eleicao = pe.id_politico_eleicao
                        WHERE pe.id_eleicao = e.id_eleicao)) AS eleitos, count(*) AS disputas
            FROM eleicao e JOIN cargo c ON c.cod_cargo = e.cod_cargo
            WHERE e.ano = %(ano)s AND e.turno = 1 GROUP BY 1 ORDER BY 1""", p)
        sem_situacao = consultar(conn, """
            SELECT c.nome AS cargo, count(*) AS candidaturas, count(*) FILTER (WHERE v.votos > 0) AS com_votos,
                   COALESCE(sum(v.votos), 0) AS votos
            FROM politico_eleicao pe JOIN eleicao e ON e.id_eleicao = pe.id_eleicao JOIN cargo c ON c.cod_cargo = e.cod_cargo
            LEFT JOIN (SELECT id_politico_eleicao, sum(qtd_votos_nominais) AS votos FROM votacao_candidato_munzona GROUP BY 1) v
                   ON v.id_politico_eleicao = pe.id_politico_eleicao
            WHERE e.ano = %(ano)s AND e.turno = 1 AND pe.ds_sit_tot_turno IS NULL GROUP BY 1 ORDER BY 2 DESC""", p)
        sem_vies = consultar(conn, """
            SELECT pa.sigla, pa.numero, sum(v.qt_votos_validos) AS votos
            FROM votacao_partido_municipio v JOIN partido pa ON pa.id_partido = v.id_partido
            WHERE v.ano_eleicao = %(ano)s AND pa.vies_politico IS NULL GROUP BY 1, 2 ORDER BY 3 DESC""", p)
        total_partido = consultar(conn, "SELECT sum(qt_votos_validos) AS votos FROM votacao_partido_municipio WHERE ano_eleicao = %(ano)s", p)
        ligados = consultar(conn, """
            SELECT count(*) AS candidaturas,
                   count(*) FILTER (WHERE EXISTS (SELECT 1 FROM politico_eleicao o JOIN eleicao eo ON eo.id_eleicao = o.id_eleicao
                                                  WHERE o.id_politico = pe.id_politico AND eo.ano < %(ano)s)) AS ja_concorreram
            FROM politico_eleicao pe JOIN eleicao e ON e.id_eleicao = pe.id_eleicao WHERE e.ano = %(ano)s AND e.turno = 1""", p)
        segundo = consultar(conn, """
            SELECT c.nome AS cargo, COALESCE(u.sigla, 'BR') AS uf,
                   count(*) FILTER (WHERE pe.ds_sit_tot_turno = '2º TURNO') AS finalistas,
                   (SELECT count(*) FROM eleicao e2 JOIN votacao_candidato_munzona v ON v.id_eleicao = e2.id_eleicao
                    WHERE e2.ano = e.ano AND e2.turno = 2 AND e2.cod_cargo = e.cod_cargo AND e2.cd_uf IS NOT DISTINCT FROM e.cd_uf) AS linhas_votos_t2
            FROM eleicao e JOIN cargo c ON c.cod_cargo = e.cod_cargo LEFT JOIN uf u ON u.cd_ibge = e.cd_uf
            JOIN politico_eleicao pe ON pe.id_eleicao = e.id_eleicao
            WHERE e.ano = %(ano)s AND e.turno = 1 GROUP BY e.ano, e.cod_cargo, e.cd_uf, c.nome, u.sigla
            HAVING count(*) FILTER (WHERE pe.ds_sit_tot_turno = '2º TURNO') > 0 ORDER BY 1, 2""", p)

    t = [f"Conferência da eleição de {ano} no banco", ""]
    t.append("1. Votos dos candidatos x votos válidos do detalhe (1º turno)")
    t.append("   Nos cargos majoritários (presidente, governador, senador) têm de ser iguais; nos proporcionais, a")
    t.append("   diferença é o voto de legenda.")
    validos["dif"] = validos.validos - validos.nominais
    for cargo, g in validos.groupby("cargo"):
        major = cargo in ("PRESIDENTE", "GOVERNADOR", "SENADOR")
        ruins = g[g.dif.abs() > (0 if major else g.validos * 0.5)] if major else g[g.validos.isna()]
        t.append(f"   {cargo:<20} {len(g):>3} disputas; nominais {int(g.nominais.sum()):>12,}; válidos {int(g.validos.fillna(0).sum()):>12,}"
                 + (f"; divergem em {len(ruins)}: " + ", ".join(f"{r.uf} ({int(r.dif):+,})" for r in ruins.itertuples()) if len(ruins) else "; sem divergência"))
    t.append("")
    t.append("2. Eleitos x vagas (1º turno; quem foi ao 2º turno ainda não tem mandato)")
    for r in eleitos.itertuples():
        t.append(f"   {r.cargo:<20} vagas {int(r.vagas or 0):>5}  eleitos {int(r.eleitos):>5}  disputas {int(r.disputas):>4}"
                 + ("" if int(r.vagas or 0) == int(r.eleitos) else f"   <- faltam {int(r.vagas or 0) - int(r.eleitos)}"))
    t.append("")
    t.append("3. Candidaturas sem situação final (#NULO: indeferidas, renunciadas ou pendentes)")
    for r in sem_situacao.itertuples():
        t.append(f"   {r.cargo:<20} {int(r.candidaturas):>6} candidaturas; {int(r.com_votos):>5} com votos ({int(r.votos):,} votos)")
    t.append("")
    total = int(total_partido.votos.iloc[0] or 0)
    t.append(f"4. Partidos com votos em {ano} e sem viés (ficam fora do mapa): {len(sem_vies)}")
    for r in sem_vies.itertuples():
        t.append(f"   {r.sigla:<16} nº {int(r.numero):>3}  {int(r.votos):>12,} votos ({100 * int(r.votos) / total:.2f}% dos válidos)" if total else f"   {r.sigla}")
    t.append("")
    lig = ligados.iloc[0]
    t.append(f"5. Candidatos de {ano} que já estavam no banco: {int(lig.ja_concorreram):,} de {int(lig.candidaturas):,} "
             f"({100 * int(lig.ja_concorreram) / max(1, int(lig.candidaturas)):.1f}%)")
    t.append("")
    t.append("6. Disputas que foram ao 2º turno")
    for r in segundo.itertuples():
        t.append(f"   {r.cargo:<12} {r.uf:<3} finalistas {int(r.finalistas)}; linhas de votos do 2º turno no banco: {int(r.linhas_votos_t2):,}")
    caminho = gravar_txt(f"conferencia_{ano}.txt", "\n".join(t) + "\n")
    print("\n".join(t))
    print(f"\n-> {caminho}")


if __name__ == "__main__":
    main()
