"""P4) Escolaridade do candidato x escolaridade de quem vota (2022 e 2024).

(A) A escolaridade do candidato muda a chance de ser eleito?
    Taxa de eleição (eleitos / candidaturas aptas) por grau de escolaridade, por ano e cargo.
(B) Lugares com eleitores menos escolarizados elegem pessoas menos escolarizadas?
    Por município: % de quem votou (comparecimento do 1º turno) com superior completo contra
    - 2024: % dos candidatos e dos eleitos do próprio município (prefeito + vereadores);
    - 2022 e 2024: % dos votos nominais dados a candidatos com superior (deputados em 2022,
      vereador em 2024), porque deputado é eleito pelo estado e não pelo município.
    Municípios divididos em quintis pela escolaridade de quem votou; correlação entre municípios.
Controle: a escolaridade do eleitor no TSE é a declarada no alistamento e fica abaixo da real;
o Censo 2022 (IBGE, SIDRA 10061, pessoas de 18+ anos) refaz a parte B com a escolaridade da população.

Uso: python scripts/04_escolaridade.py
Saída: respostas/04_escolaridade.txt
"""
import math
import textwrap

import pandas as pd

from comum import RAIZ, conectar, consultar, gravar_txt, ufs_carregadas

CARGOS = {3: "Governador", 5: "Senador", 6: "Deputado Federal", 7: "Deputado Estadual",
          11: "Prefeito", 13: "Vereador"}
CENSO = RAIZ / "dados/ibge/censo2022/nivel_instrucao_18mais_tabela10061.csv"

# (A) Candidaturas aptas de eleições ordinárias, titulares (sem vices e suplentes).
SQL_CHANCE = """
SELECT e.ano, e.cod_cargo, es.nivel, es.rotulo,
       count(*)            AS candidatos,
       count(m.id_mandato) AS eleitos
FROM politico_eleicao pe
JOIN eleicao e       USING (id_eleicao)
JOIN escolaridade es ON es.ds_grau = pe.ds_grau_instrucao
LEFT JOIN mandato m  USING (id_politico_eleicao)
WHERE e.ano IN (2022, 2024) AND e.tipo = 2 AND e.cod_cargo = ANY(%(cargos)s)
  AND pe.ds_sit_tot_turno IS NOT NULL      -- candidatura apta (#NULO = indeferida, renúncia...)
  AND es.nivel IS NOT NULL
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3
"""

# Composição de quem votou (comparecimento do 1º turno) nas UFs carregadas.
SQL_VOTANTES = """
SELECT p.ano_eleicao AS ano, es.nivel, es.rotulo, sum(p.qtd_comparecimento) AS votantes
FROM perfil_eleitorado_munzona p
JOIN escolaridade es ON es.ds_grau = p.ds_grau_escolaridade
WHERE p.ano_eleicao IN (2022, 2024) AND es.nivel IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1, 2
"""

# (B) Uma linha por município e ano.
SQL_MUNICIPIOS = """
WITH votantes AS (
    SELECT p.ano_eleicao AS ano, z.cd_municipio,
           sum(p.qtd_comparecimento) AS votantes,
           100.0 * sum(p.qtd_comparecimento) FILTER (WHERE es.nivel = 8) / sum(p.qtd_comparecimento) AS sup_votantes,
           sum(p.qtd_comparecimento * es.nivel)::float / sum(p.qtd_comparecimento)                  AS nivel_votantes
    FROM perfil_eleitorado_munzona p
    JOIN zona_eleitoral z USING (id_zona)
    JOIN escolaridade es  ON es.ds_grau = p.ds_grau_escolaridade
    WHERE p.ano_eleicao IN (2022, 2024) AND es.nivel IS NOT NULL
    GROUP BY 1, 2
),
disputa AS (                -- 2024: candidatos e eleitos a prefeito e vereador do próprio município
    SELECT e.ano, e.cd_municipio,
           100.0 * avg((es.nivel = 8)::int)                                         AS sup_candidatos,
           100.0 * avg((es.nivel = 8)::int) FILTER (WHERE m.id_mandato IS NOT NULL) AS sup_eleitos,
           avg(es.nivel) FILTER (WHERE m.id_mandato IS NOT NULL)                    AS nivel_eleitos,
           count(m.id_mandato)                                                      AS eleitos
    FROM politico_eleicao pe
    JOIN eleicao e       USING (id_eleicao)
    JOIN escolaridade es ON es.ds_grau = pe.ds_grau_instrucao
    LEFT JOIN mandato m  USING (id_politico_eleicao)
    WHERE e.ano = 2024 AND e.tipo = 2 AND e.cod_cargo IN (11, 13)
      AND pe.ds_sit_tot_turno IS NOT NULL AND es.nivel IS NOT NULL
    GROUP BY 1, 2
),
votos AS (                  -- em quem o município votou: deputados (2022) e vereador (2024)
    SELECT e.ano, z.cd_municipio,
           100.0 * sum(v.qtd_votos_nominais) FILTER (WHERE es.nivel = 8) / sum(v.qtd_votos_nominais) AS sup_votados
    FROM votacao_candidato_munzona v
    JOIN eleicao e           USING (id_eleicao)
    JOIN zona_eleitoral z    USING (id_zona)
    JOIN politico_eleicao pe USING (id_politico_eleicao)
    JOIN escolaridade es     ON es.ds_grau = pe.ds_grau_instrucao
    WHERE e.ano IN (2022, 2024) AND e.turno = 1 AND e.tipo = 2 AND e.cod_cargo IN (6, 7, 13)
      AND es.nivel IS NOT NULL
    GROUP BY 1, 2
)
SELECT vt.ano, u.sigla AS uf, mu.cd_ibge, mu.nm_municipio, vt.votantes, vt.sup_votantes, vt.nivel_votantes,
       d.sup_candidatos, d.sup_eleitos, d.nivel_eleitos, d.eleitos, vo.sup_votados
FROM votantes vt
JOIN municipio mu   USING (cd_municipio)
JOIN uf u           ON u.cd_ibge = mu.cd_uf
LEFT JOIN disputa d ON d.ano = vt.ano AND d.cd_municipio = vt.cd_municipio
LEFT JOIN votos vo  ON vo.ano = vt.ano AND vo.cd_municipio = vt.cd_municipio
"""


def v_de_cramer(d: pd.DataFrame) -> float:
    """Associação escolaridade x eleito (0 = nenhuma, 1 = total), pela tabela nível x {eleito, não eleito}."""
    obs = pd.DataFrame({"sim": d["eleitos"], "nao": d["candidatos"] - d["eleitos"]})
    n = obs.values.sum()
    esperado = pd.DataFrame(obs.sum(axis=1).values[:, None] * obs.sum(axis=0).values[None, :] / n,
                            index=obs.index, columns=obs.columns)
    qui2 = (((obs - esperado) ** 2) / esperado).values.sum()
    return math.sqrt(qui2 / n)   # tabela k x 2: min(k, 2) - 1 = 1


def censo_superior() -> pd.Series:
    """% de pessoas de 18+ anos com superior completo, por código IBGE do município."""
    df = pd.read_csv(CENSO, sep=";", encoding="utf-8")
    df = df[(df["Unidade de Medida"] == "Percentual") & (df["Nível de instrução"] == "Superior completo")]
    return df.set_index("Município (Código)")["Valor"].astype(float).rename("sup_censo")


def p(x: float) -> str:
    return "     -" if pd.isna(x) else f"{x:5.1f}%"


def r(x: float) -> str:
    return "  -" if pd.isna(x) else f"{x:+.2f}"


def parte_a(chance: pd.DataFrame) -> tuple[list[str], dict]:
    out, achados = [], {}
    for (ano, cargo), d in chance.groupby(["ano", "cod_cargo"]):
        d = d.set_index("nivel")
        taxa = 100 * d["eleitos"] / d["candidatos"]
        media = 100 * d["eleitos"].sum() / d["candidatos"].sum()   # taxa do cargo, todos os graus
        out += [f"{ano} · {CARGOS[cargo]} (taxa média do cargo: {media:.1f}%)",
                "  Escolaridade              Candidatos   Eleitos    Taxa   x média do cargo",
                "  " + "-" * 74]
        for nivel, linha in d.iterrows():
            rel = f"{taxa[nivel] / media:5.2f}x" if d.loc[nivel, "candidatos"] >= 30 else "    -"
            out.append(f"  {linha['rotulo']:<24} {linha['candidatos']:>11,} {linha['eleitos']:>9,}  {p(taxa[nivel])}   {rel}"
                       .replace(",", "."))
        sup_c = 100 * d.loc[8, "candidatos"] / d["candidatos"].sum() if 8 in d.index else float("nan")
        sup_e = 100 * d.loc[8, "eleitos"] / d["eleitos"].sum() if 8 in d.index and d["eleitos"].sum() else float("nan")
        out += [f"  Superior completo: {p(sup_c).strip()} dos candidatos e {p(sup_e).strip()} dos eleitos."
                f"  V de Cramér = {v_de_cramer(d):.3f}", ""]
        achados[(ano, cargo)] = (taxa, sup_c, sup_e)
    return out, achados


def funil(chance: pd.DataFrame, votantes: pd.DataFrame) -> tuple[list[str], dict]:
    """Composição por escolaridade de quem votou, dos candidatos e dos eleitos (todos os cargos do ano)."""
    out = ["Quem votou, quem se candidatou e quem se elegeu (% em cada grau; todos os cargos do ano)",
           "  Escolaridade              " + "".join(f"{a}: votou  cand. eleito   " for a in (2022, 2024)),
           "  " + "-" * 92]
    tab = {}
    for ano in (2022, 2024):
        v = votantes[votantes["ano"] == ano].set_index("nivel")["votantes"]
        c = chance[chance["ano"] == ano].groupby("nivel")[["candidatos", "eleitos"]].sum()
        tab[ano] = (100 * v / v.sum(), 100 * c["candidatos"] / c["candidatos"].sum(), 100 * c["eleitos"] / c["eleitos"].sum())
    rotulos = votantes.drop_duplicates("nivel").set_index("nivel")["rotulo"]
    for nivel, rot in rotulos.items():
        cols = "".join(f"     {p(tab[a][0].get(nivel))} {p(tab[a][1].get(nivel))} {p(tab[a][2].get(nivel))}" for a in (2022, 2024))
        out.append(f"  {rot:<24}{cols}")
    return out + [""], {a: tuple(t.get(8) for t in tab[a]) for a in tab}


def quintis(d: pd.DataFrame, x: str, colunas: dict[str, str]) -> list[str]:
    d = d.dropna(subset=[x, *colunas])
    d = d.assign(q=pd.qcut(d[x], 5, labels=[1, 2, 3, 4, 5]))
    g = d.groupby("q", observed=True)
    cab = "".join(f"{nome:>16}" for nome in ["% sup. votou", *colunas.values()])
    out = [f"  Quintil       Municípios{cab}", "  " + "-" * (24 + 16 * (len(colunas) + 1))]
    for q, linha in g:
        vals = "".join(f"{p(linha[c].mean()):>16}" for c in [x, *colunas])
        rot = {1: "1 (menos)", 5: "5 (mais)"}.get(q, str(q))
        out.append(f"  {rot:<12} {len(linha):>11}{vals}")
    vals = "".join(f"{p(d[c].mean()):>16}" for c in [x, *colunas])
    out.append(f"  {'Todos':<12} {len(d):>11}{vals}")
    for c, nome in colunas.items():
        out.append(f"  Correlação entre municípios, {nome.strip()}: Pearson {r(d[x].corr(d[c]))}, "
                   f"Spearman {r(d[x].rank().corr(d[c].rank()))}")   # Pearson dos postos, sem scipy
    return out + [""]


def parte_b(mun: pd.DataFrame) -> tuple[list[str], dict]:
    m24 = mun[mun["ano"] == 2024]
    out = ["B1. 2024: quem o município elegeu (prefeito + vereadores do próprio município)",
           *quintis(m24, "sup_votantes", {"sup_candidatos": "% sup. candid.", "sup_eleitos": "% sup. eleitos"})]
    d = m24.dropna(subset=["sup_eleitos", "sup_candidatos"])
    q = d.assign(q=pd.qcut(d["sup_votantes"], 5, labels=False)).groupby("q")
    gap = (q["sup_eleitos"].mean() - q["sup_candidatos"].mean())
    out += [f"  Os eleitos têm mais superior completo que os candidatos do próprio município em todos os quintis:",
            "  " + ", ".join(f"{v:+.1f} p.p." for v in gap) + " (do menos ao mais escolarizado).",
            f"  Em nível médio (1 a 8): quem votou {m24['nivel_votantes'].mean():.2f}, eleitos {m24['nivel_eleitos'].mean():.2f}; "
            f"Pearson {r(m24['nivel_votantes'].corr(m24['nivel_eleitos']))}.", ""]
    out += ["  Por UF (correlação entre os municípios de cada UF, % sup. votou x % sup. eleitos):"]
    for uf, g in m24.dropna(subset=["sup_eleitos"]).groupby("uf"):
        out.append(f"    {uf}: {len(g):>4} municípios, Pearson {r(g['sup_votantes'].corr(g['sup_eleitos']))}")
    out.append("")
    out += ["B2. Em quem o município votou: % dos votos nominais para candidatos com superior completo",
            "    (2022: deputados federal e estadual; 2024: vereador)"]
    achados = {"gap": gap}
    for ano in (2022, 2024):
        dd = mun[mun["ano"] == ano]
        out += [f"  {ano}", *quintis(dd, "sup_votantes", {"sup_votados": "% votos sup."})]
        achados[ano] = dd["sup_votantes"].corr(dd["sup_votados"])
    achados["eleitos24"] = m24["sup_votantes"].corr(m24["sup_eleitos"])
    return out, achados


def controle_censo(mun: pd.DataFrame) -> list[str]:
    mun = mun.join(censo_superior(), on="cd_ibge")
    m22 = mun[mun["ano"] == 2022]
    m24 = mun[mun["ano"] == 2024]
    return [
        "C. Controle com o Censo 2022 (% de pessoas de 18+ anos com superior completo)",
        f"  TSE x Censo, por município: quem votou em 2022 tem {m22['sup_votantes'].mean():.1f}% com superior no TSE e a",
        f"  população adulta {m22['sup_censo'].mean():.1f}% no Censo (média dos municípios); correlação {r(m22['sup_votantes'].corr(m22['sup_censo']))}.",
        "  O TSE subestima o nível, mas ordena os municípios quase do mesmo jeito. Refazendo a parte B com o Censo:",
        f"    2024, % sup. eleitos:      Pearson {r(m24['sup_censo'].corr(m24['sup_eleitos']))} (TSE: {r(m24['sup_votantes'].corr(m24['sup_eleitos']))})",
        f"    2024, % votos em superior: Pearson {r(m24['sup_censo'].corr(m24['sup_votados']))} (TSE: {r(m24['sup_votantes'].corr(m24['sup_votados']))})",
        f"    2022, % votos em superior: Pearson {r(m22['sup_censo'].corr(m22['sup_votados']))} (TSE: {r(m22['sup_votantes'].corr(m22['sup_votados']))})",
        "",
    ]


def conclusao(a: dict, b: dict, votou: dict) -> list[str]:
    v24, sup_cv, sup_ev = a[(2024, 13)]
    p24 = a[(2024, 11)][0]
    de, df = a[(2022, 7)][0], a[(2022, 6)][0]
    paragrafos = [
        "(A) Sim. Em todos os cargos quem tem superior completo é quem mais se elege, mas o peso muda com o cargo. "
        f"Para deputado (2022) é forte: com superior completo se elegeram {de[8]:.1f}% dos candidatos a deputado "
        f"estadual e {df[8]:.1f}% a federal, contra {de[6]:.1f}% e {df[6]:.1f}% com médio completo; governador e "
        f"senador eleitos têm todos superior. Para vereador (2024) é moderado: {v24[8]:.1f}% com superior, "
        f"{v24[6]:.1f}% com médio e {v24[2]:.1f}% entre os que só leem e escrevem. Para prefeito quase não "
        f"existe ({p24[8]:.1f}% x {p24[6]:.1f}%). O V de Cramér fica entre 0,05 e 0,16: a escolaridade ajuda, "
        "não decide.",
        "A filtragem aparece na composição: superior completo é "
        f"{votou[2022][0]:.0f}% de quem votou em 2022, {votou[2022][1]:.0f}% dos candidatos e {votou[2022][2]:.0f}% dos "
        f"eleitos; em 2024, {votou[2024][0]:.0f}%, {votou[2024][1]:.0f}% e {votou[2024][2]:.0f}% "
        f"(vereador: {sup_cv:.0f}% dos candidatos e {sup_ev:.0f}% dos eleitos).",
        "(B) Sim na direção, não no nível. Os municípios em que quem vota é menos escolarizado elegem menos gente "
        f"com superior (correlação {b['eleitos24']:+.2f} em 2024, igual com o Censo), mas mesmo neles os eleitos "
        "são muito mais escolarizados que o eleitorado. Não é só porque os candidatos locais se parecem com o "
        "eleitor: os eleitos superam os candidatos do próprio município em todos os quintis, e a distância "
        f"cresce com a escolaridade do lugar ({b['gap'].iloc[0]:+.1f} -> {b['gap'].iloc[-1]:+.1f} p.p.).",
        f"No voto para deputado (2022) a relação é fraca ({b[2022]:+.2f}) e no voto para vereador (2024) é "
        f"moderada ({b[2024]:+.2f}): na eleição local o eleitor escolhe entre vizinhos parecidos com ele; na "
        "estadual, quase todos os candidatos com voto têm diploma, em qualquer lugar.",
    ]
    return ["CONCLUSÃO", *[l for t in paragrafos for l in (*textwrap.wrap(t, 96), "")]]


CABECALHO = """\
P4) Escolaridade do candidato x escolaridade de quem vota (2022 e 2024)
(A) Existe relação entre a escolaridade do candidato e sua chance de ser eleito?
(B) Locais com menor escolaridade costumam eleger pessoas de escolaridade semelhante?

Fontes: candidaturas e eleitos (TSE, DS_GRAU_INSTRUCAO e DS_SIT_TOT_TURNO de cada candidatura);
escolaridade de quem compareceu no 1º turno (TSE, perfil_comparecimento_abstencao, por zona);
votos nominais por zona (TSE); Censo 2022 (IBGE, SIDRA 10061) como controle.
UFs: {ufs}. Os números valem para essas UFs, não para o Brasil.

Observações:
- Escolaridade da candidatura (a de cada eleição), em 8 graus do TSE; "não divulgável" fica de fora.
- Candidaturas aptas: sem as que terminaram sem situação (#NULO: indeferidas, renúncias, cassadas).
- Titulares de eleições ordinárias; sem Presidente (disputa nacional), vices e suplentes.
- Quem votou = comparecimento do 1º turno (não o eleitorado apto). A escolaridade do eleitor é a
  declarada no alistamento e raramente é atualizada, por isso fica abaixo da real (ver C).
- Quintis: os municípios em 5 grupos de mesmo tamanho pela % de quem votou com superior completo;
  as colunas são médias simples dos municípios do grupo.
"""


def main() -> None:
    with conectar() as conn:
        ufs = ", ".join(s for s, _ in ufs_carregadas(conn))
        chance = consultar(conn, SQL_CHANCE, {"cargos": list(CARGOS)})
        votantes = consultar(conn, SQL_VOTANTES)
        mun = consultar(conn, SQL_MUNICIPIOS)
    for col in ["sup_votantes", "nivel_votantes", "sup_candidatos", "sup_eleitos", "nivel_eleitos", "sup_votados"]:
        mun[col] = mun[col].astype(float)
    texto_a, achados_a = parte_a(chance)
    texto_b, achados_b = parte_b(mun)
    texto_funil, votou = funil(chance, votantes)
    linha = "=" * 96
    texto = [CABECALHO.format(ufs=ufs),
             linha, "PARTE A: escolaridade do candidato e chance de ser eleito", linha, "", *texto_a,
             *texto_funil,
             linha, "PARTE B: a escolaridade do lugar e a de quem ele elege", linha, "", *texto_b,
             *controle_censo(mun),
             linha, *conclusao(achados_a, achados_b, votou)]
    caminho = gravar_txt("04_escolaridade.txt", "\n".join(texto))
    print(f"gravado: {caminho}")


if __name__ == "__main__":
    main()
