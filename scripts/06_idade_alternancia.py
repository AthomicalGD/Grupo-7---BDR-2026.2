"""P6) Idade do município x alternância de poder e idade dos eleitos: jovem vota no jovem?

(A) Perfil etário de cada município, por três medidas:
    - idade média de quem votou no 1º turno (TSE, perfil de comparecimento por faixa etária; muda a cada eleição);
    - idade média da população (Censo 2022, SIDRA 9514, idade simples), gravada em ibge_censo_municipio;
    - idade mediana e índice de envelhecimento (Censo 2022, SIDRA 9515, já em indices_municipio), como conferência.
    Os municípios são divididos em três terços (mais jovem, intermediário, mais velho) pela idade de quem votou,
    no país e dentro de cada UF.
(B) Alternância de poder na prefeitura, 1996 a 2024 (8 eleições ordinárias, 7 passagens de mandato). Cada passagem
    é marcada como "mesmo partido" (renomeações contam como o mesmo partido), "troca de partido" ou "troca com
    ressalva" (o partido do prefeito anterior foi incorporado ao do novo entre as duas eleições), e também pela
    pessoa (reeleição ou não). O índice sai nas duas leituras da fusão e é comparado entre os terços de idade.
(C) Idade dos eleitos (prefeito e vereadores, 2020 e 2024) contra a dos candidatos e a de quem votou.
(D) Jovem vota no jovem? O voto é secreto: a resposta vem do perfil de cada zona eleitoral (inferência ecológica).
    - Deputados federal e estadual (2018 e 2022): todas as zonas da UF têm os mesmos candidatos, então a diferença
      entre zonas mais jovens e mais velhas vem do eleitor, e não da oferta de candidatos;
    - vereador e prefeito (2020 e 2024) e, como controle, deputados: entre as zonas do mesmo município
      (municípios com 2 zonas ou mais).
    Nas cidades, as zonas mais velhas são também as mais escolarizadas; por isso cada efeito sai também
    descontada a escolaridade de quem votou (% com superior completo, perfil_eleitorado_munzona).

Idades em anos completos: a do candidato na data do 1º turno; a de quem votou, ponto médio da faixa do TSE;
a da população, idade simples do Censo.

Uso: python scripts/06_idade_alternancia.py [--refazer-cache]
Saída: respostas/06_idade_alternancia.txt e respostas/06_passagens_prefeitura.csv (uma linha por passagem)
Cache: dados/_derivados/eleitorado_idade_zona.csv (faixa etária de quem votou, lida dos CSVs de perfil do TSE,
       que o loader agrega só por escolaridade).
"""
import csv
import re
import sys
import textwrap
import time
import unicodedata

import numpy as np
import pandas as pd
from psycopg2.extras import execute_values

from comum import RAIZ, RESPOSTAS, conectar, consultar, gravar_txt, ufs_carregadas

sys.path.insert(0, str(RAIZ))
from loader.vies import canonica  # noqa: E402  (mesma normalização de siglas da P7)

PERFIL = RAIZ / "dados" / "tse" / "comparecimento_abstencao"
CACHE = RAIZ / "dados" / "_derivados" / "eleitorado_idade_zona.csv"
CENSO_IDADES = RAIZ / "dados" / "ibge" / "censo2022" / "populacao_idade_simples_tabela9514.csv"
SUCESSAO = RAIZ / "banco" / "referencia" / "sucessao_partidos.csv"
PASSAGENS = RESPOSTAS / "06_passagens_prefeitura.csv"

ANOS_PERFIL = (2018, 2020, 2022, 2024)
COLUNAS_PERFIL = {"ANO_ELEICAO": "ano", "NR_TURNO": "turno", "SG_UF": "sg_uf", "CD_MUNICIPIO": "cd_municipio",
                  "NR_ZONA": "nr_zona", "CD_FAIXA_ETARIA": "cd_faixa", "QT_APTOS": "qt_aptos",
                  "QT_COMPARECIMENTO": "qt_comparecimento"}
# 1º turno de cada eleição (o banco não guarda DT_ELEICAO). Em 2020 a eleição foi adiada pela pandemia.
DATAS = {2018: "2018-10-07", 2020: "2020-11-15", 2022: "2022-10-02", 2024: "2024-10-06"}
CARGOS = {6: "Deputado Federal", 7: "Deputado Estadual", 11: "Prefeito", 13: "Vereador"}
TERCOS = {1: "mais jovem", 2: "intermediário", 3: "mais velho"}
# Faixas de idade comuns a candidatos e a quem votou (as do TSE fecham em 34, 49, 64).
FAIXAS = {1: "18 a 34", 2: "35 a 49", 3: "50 a 64", 4: "65 ou mais"}
PORTES = [(0, 10_000, "até 10 mil"), (10_000, 50_000, "10 a 50 mil"), (50_000, 200_000, "50 a 200 mil"),
          (200_000, 10**9, "mais de 200 mil")]

# Mudanças de partido anteriores a 2018, que o CSV da P7 (feito para 2018-2024) não traz.
# PSD41 é o antigo PSD (número 41), incorporado ao PTB em 2003; o PSD atual (55) é outro partido.
ANTIGAS_RENOMEACOES = [("PTC", "PRN")]                                  # PRN virou PTC (2000)
ANTIGAS_FUSOES = [(2003, "PL", ("PST", "PGT")), (2003, "PTB", ("PSD41",)),
                  (2006, "PR", ("PRONA",)), (2007, "PTB", ("PAN",))]
MESMO, TROCA, FUSAO = "mesmo partido", "troca de partido", "troca com ressalva (partidos fundidos)"


# ───────── Faixa etária de quem votou (cache) ─────────

def montar_cache() -> pd.DataFrame:
    """Lê os CSVs de perfil (≈2 GB por ano) e soma aptos e comparecimento do 1º turno por zona e faixa etária."""
    partes = []
    for ano in ANOS_PERFIL:
        arquivo = next(iter(sorted((PERFIL / str(ano)).glob("perfil_comparecimento_abstencao_*.csv"))), None)
        if arquivo is None:
            raise SystemExit(f"falta o perfil do eleitorado de {ano} em {PERFIL} (python -m crawler --perguntas 6)")
        inicio = time.time()
        soma = None
        leitor = pd.read_csv(arquivo, sep=";", encoding="latin-1", usecols=list(COLUNAS_PERFIL),
                             dtype={"SG_UF": str}, chunksize=2_000_000)
        for bloco in leitor:
            bloco = bloco.rename(columns=COLUNAS_PERFIL)
            bloco = bloco[(bloco["turno"] == 1) & (bloco["sg_uf"] != "ZZ")]
            g = bloco.groupby(["ano", "cd_municipio", "nr_zona", "cd_faixa"])[["qt_aptos", "qt_comparecimento"]].sum()
            soma = g if soma is None else soma.add(g, fill_value=0)
        partes.append(soma.reset_index())
        print(f"  perfil {ano}: {len(soma)} linhas em {time.time() - inicio:.0f} s", flush=True)
    df = pd.concat(partes, ignore_index=True)
    df[["qt_aptos", "qt_comparecimento"]] = df[["qt_aptos", "qt_comparecimento"]].astype("int64")
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(CACHE, index=False)
    return df


def eleitorado_por_faixa(refazer: bool = False) -> pd.DataFrame:
    if refazer or not CACHE.exists():
        print(f"Montando {CACHE.relative_to(RAIZ)} a partir dos CSVs de perfil do TSE (cerca de 1 minuto)...")
        return montar_cache()
    return pd.read_csv(CACHE)


def ponto_medio(cd: int) -> float:
    """CD_FAIXA_ETARIA do TSE -> idade: 1600 = 16 anos; 2124 = 21 a 24 (22,5); 9999 = 100 anos ou mais."""
    if cd == 9999:
        return 100.0
    if cd < 2100:
        return float(cd // 100)
    inicio, fim = divmod(cd, 100)
    return (inicio + fim) / 2


def faixa_do_tse(cd: int) -> int:
    """Faixa comum (FAIXAS) da faixa do TSE; 0 = 16 e 17 anos, que não podem ser candidatos."""
    if cd < 1800:
        return 0
    return 1 if cd <= 3034 else 2 if cd <= 4549 else 3 if cd <= 6064 else 4


def perfil_zonas(faixas: pd.DataFrame) -> pd.DataFrame:
    """Por ano e zona: quem votou (total, × idade, 16-29, 60+, por faixa comum) e aptos (total, × idade)."""
    d = faixas[faixas["cd_faixa"] > 0].copy()                    # -3 = faixa inválida
    idade = d["cd_faixa"].map(ponto_medio)
    comp = d["qt_comparecimento"]
    d["comp"] = comp
    d["comp_x_idade"] = comp * idade
    d["comp_16_29"] = comp.where(d["cd_faixa"] <= 2529, 0)
    d["comp_60"] = comp.where(d["cd_faixa"] >= 6064, 0)
    d["aptos"] = d["qt_aptos"]
    d["aptos_x_idade"] = d["qt_aptos"] * idade
    faixa = d["cd_faixa"].map(faixa_do_tse)
    for f in FAIXAS:
        d[f"comp_f{f}"] = comp.where(faixa == f, 0)
    somas = ["comp", "comp_x_idade", "comp_16_29", "comp_60", "aptos", "aptos_x_idade", *[f"comp_f{f}" for f in FAIXAS]]
    return d.groupby(["ano", "cd_municipio", "nr_zona"], as_index=False)[somas].sum()


def completar(d: pd.DataFrame) -> pd.DataFrame:
    d = d.copy()
    d["idade"] = d["comp_x_idade"] / d["comp"]
    d["idade_aptos"] = d["aptos_x_idade"] / d["aptos"]
    d["pct_16_29"] = 100 * d["comp_16_29"] / d["comp"]
    d["pct_60"] = 100 * d["comp_60"] / d["comp"]
    return d


# ───────── Censo 2022 (SIDRA 9514) ─────────

def censo_idade() -> pd.DataFrame:
    """Por código IBGE: população, idade média e idade média de quem tem 16 anos ou mais."""
    if not CENSO_IDADES.exists():
        raise SystemExit(f"falta {CENSO_IDADES.relative_to(RAIZ)} (python -m crawler --perguntas 6 --fontes ibge)")
    df = pd.read_csv(CENSO_IDADES, sep=";", encoding="utf-8-sig", dtype=str, keep_default_na=False)
    idade = df["Idade"].str.extract(r"^(\d+)")[0].astype(float).fillna(0)   # "Menos de 1 ano" = 0; "100 ou mais" = 100
    n = pd.to_numeric(df["Valor"], errors="coerce").fillna(0)                # "-" = nenhuma pessoa
    t = pd.DataFrame({"cd_ibge": df["Município (Código)"].astype(int), "n": n, "nx": n * idade,
                      "n16": n.where(idade >= 16, 0), "nx16": (n * idade).where(idade >= 16, 0)})
    g = t.groupby("cd_ibge")[["n", "nx", "n16", "nx16"]].sum()
    return pd.DataFrame({"pop_censo": g["n"], "idade_pop": g["nx"] / g["n"], "idade_pop_16": g["nx16"] / g["n16"]})


def gravar_censo(conn, mun: pd.DataFrame) -> int:
    linhas = [(int(c), 2022, round(float(v), 2)) for c, v in mun[["cd_municipio", "idade_pop"]].dropna().values]
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO ibge_censo_municipio (cd_municipio, ano, idade_media_populacao) VALUES %s
            ON CONFLICT (cd_municipio, ano) DO UPDATE SET idade_media_populacao = EXCLUDED.idade_media_populacao""",
                       linhas)
    conn.commit()
    return len(linhas)


# ───────── Consultas ─────────

SQL_MUNICIPIOS = """
SELECT m.cd_municipio, m.nm_municipio, m.cd_ibge, u.sigla AS sg_uf,
       i.populacao, i.mediana_idade, i.indice_envelhecimento
FROM municipio m
JOIN uf u ON u.cd_ibge = m.cd_uf
LEFT JOIN indices_municipio i ON i.cd_municipio = m.cd_municipio AND i.ano = 2022
"""

SQL_ZONAS = "SELECT id_zona, cd_municipio, numero AS nr_zona FROM zona_eleitoral"

# Quem votou com superior completo, por zona e ano (P4, migração 003): controle de nível socioeconômico.
SQL_ESCOLARIDADE = """
SELECT id_zona, ano_eleicao AS ano,
       sum(qtd_comparecimento) FILTER (WHERE ds_grau_escolaridade = 'SUPERIOR COMPLETO') AS comp_sup,
       sum(qtd_comparecimento) FILTER (WHERE ds_grau_escolaridade <> 'NÃO INFORMADO')    AS comp_esc
FROM perfil_eleitorado_munzona
GROUP BY 1, 2
"""

# Prefeitos eleitos nas eleições ordinárias (tipo 2), com o partido pelo qual foram eleitos.
SQL_PREFEITOS = """
SELECT e.cd_municipio, e.ano, pe.id_politico, p.nome, pa.sigla, pa.numero
FROM mandato m
JOIN eleicao e           ON e.id_eleicao = m.id_eleicao
JOIN politico_eleicao pe ON pe.id_politico_eleicao = m.id_politico_eleicao
JOIN politico p          ON p.id_politico = pe.id_politico
JOIN partido pa          ON pa.id_partido = m.id_partido
WHERE e.cod_cargo = 11 AND e.tipo = 2
"""


def _datas(anos) -> str:
    return ", ".join(f"({a}, date '{DATAS[a]}')" for a in anos)


# Candidaturas aptas (sem #NULO: indeferidas, renúncias, cassadas) a prefeito e vereador em 2020 e 2024.
SQL_CANDIDATURAS = f"""
SELECT e.cd_municipio, e.ano, e.cod_cargo,
       date_part('year', age(d.dt, p.dt_nascimento))::int AS idade,
       m.id_mandato IS NOT NULL AS eleito
FROM politico_eleicao pe
JOIN eleicao e  ON e.id_eleicao = pe.id_eleicao
JOIN politico p ON p.id_politico = pe.id_politico
JOIN (VALUES {_datas((2020, 2024))}) d(ano, dt) ON d.ano = e.ano
LEFT JOIN mandato m ON m.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.tipo = 2 AND e.cod_cargo IN (11, 13)
  AND pe.ds_sit_tot_turno IS NOT NULL AND p.dt_nascimento IS NOT NULL
"""

# Votos nominais do 1º turno por zona, somados por faixa de idade do candidato.
SQL_VOTOS = f"""
SELECT v.id_zona, e.ano, e.cod_cargo, a.faixa,
       sum(v.qtd_votos_nominais)::bigint           AS votos,
       sum(v.qtd_votos_nominais * a.idade)::bigint AS votos_x_idade
FROM votacao_candidato_munzona v
JOIN eleicao e           ON e.id_eleicao = v.id_eleicao
JOIN politico_eleicao pe ON pe.id_politico_eleicao = v.id_politico_eleicao
JOIN politico p          ON p.id_politico = pe.id_politico
JOIN (VALUES {_datas(DATAS)}) d(ano, dt) ON d.ano = e.ano
CROSS JOIN LATERAL (
    SELECT i.idade, CASE WHEN i.idade < 35 THEN 1 WHEN i.idade < 50 THEN 2 WHEN i.idade < 65 THEN 3 ELSE 4 END AS faixa
    FROM (SELECT date_part('year', age(d.dt, p.dt_nascimento))::int AS idade) i
) a
WHERE e.tipo = 2 AND e.turno = 1 AND p.dt_nascimento IS NOT NULL AND a.idade BETWEEN 18 AND 100
  AND ((e.ano IN (2018, 2022) AND e.cod_cargo IN (6, 7)) OR (e.ano IN (2020, 2024) AND e.cod_cargo IN (11, 13)))
GROUP BY 1, 2, 3, 4
"""


# ───────── Estatística ─────────

def tercos(df: pd.DataFrame, coluna: str, por: str | None = None, peso: str | None = None) -> pd.Series:
    """1, 2, 3 = terço mais jovem, intermediário e mais velho (dentro de cada grupo `por`, com peso opcional)."""
    out = pd.Series(np.nan, index=df.index)
    grupos = [df.index] if por is None else df.groupby(por).groups.values()
    for idx in grupos:
        g = df.loc[idx].dropna(subset=[coluna]).sort_values(coluna)
        if g.empty:
            continue
        w = g[peso].astype(float) if peso else pd.Series(1.0, index=g.index)
        pos = (w.cumsum() - w / 2) / w.sum()
        out.loc[g.index] = np.clip((pos * 3).astype(int) + 1, 1, 3)
    return out


def efeito(df: pd.DataFrame, y: str, x: str, por: str, peso: str | None = None, controles: tuple = (),
           cluster: str | None = None, reps: int = 500) -> dict:
    """Inclinação de y em x dentro de cada grupo `por` (efeito fixo), descontados os controles.

    IC de 95% por reamostragem dos `cluster` (cada linha, se None) sobre os resíduos.
    """
    d = df.dropna(subset=[y, x, *controles]).copy()
    w = d[peso].astype(float).values if peso else np.ones(len(d))
    r = {}
    for c in (y, x, *controles):
        soma = pd.Series(d[c].values * w).groupby(d[por].values).transform("sum").values
        pesos = pd.Series(w).groupby(d[por].values).transform("sum").values
        r[c] = d[c].values - soma / pesos
    if controles:
        z = np.column_stack([r[c] for c in controles])
        raiz_w = np.sqrt(w)[:, None]
        for c in (y, x):
            beta = np.linalg.lstsq(z * raiz_w, r[c] * raiz_w[:, 0], rcond=None)[0]
            r[c] = r[c] - z @ beta
    xv, yv = r[x], r[y]
    sxy, sxx, syy = w * xv * yv, w * xv * xv, w * yv * yv
    b = sxy.sum() / sxx.sum()
    corr = sxy.sum() / np.sqrt(sxx.sum() * syy.sum())
    _, inv = np.unique(d[cluster].values if cluster else np.arange(len(d)), return_inverse=True)
    cxy, cxx = np.bincount(inv, sxy), np.bincount(inv, sxx)
    rng = np.random.default_rng(6)
    amostras = []
    for _ in range(reps):
        cont = np.bincount(rng.integers(0, len(cxy), len(cxy)), minlength=len(cxy))
        amostras.append(cont @ cxy / (cont @ cxx))
    lo, hi = np.percentile(amostras, [2.5, 97.5]) if amostras else (np.nan, np.nan)
    return {"b": b, "lo": lo, "hi": hi, "r": corr, "n": len(d), "grupos": d[por].nunique()}


def media_p(v: pd.Series, w: pd.Series) -> float:
    ok = v.notna() & w.notna()
    return float((v[ok] * w[ok]).sum() / w[ok].sum()) if w[ok].sum() else float("nan")


# ───────── Formatação ─────────

def n(x) -> str:
    return f"{int(x):,}".replace(",", ".")


def f1(x) -> str:
    return "-" if pd.isna(x) else f"{x:.1f}"


def efeito_txt(e: dict, escala: float, unidade: str) -> str:
    return (f"{e['b'] * escala:+.2f} {unidade} (IC 95%: {e['lo'] * escala:+.2f} a {e['hi'] * escala:+.2f}; "
            f"r parcial = {e['r']:+.2f}; {n(e['n'])} unidades em {n(e['grupos'])} grupos)")


def claro(e: dict) -> int:
    """+1 / -1 se o IC exclui o zero (com o sinal), 0 se não."""
    return 1 if e["lo"] > 0 else -1 if e["hi"] < 0 else 0


def titulo(texto: str) -> list[str]:
    return ["", "=" * 100, texto, "=" * 100, ""]


def paragrafo(texto: str, recuo: str = "") -> list[str]:
    return textwrap.wrap(texto, 98, initial_indent=recuo, subsequent_indent=recuo)


# ───────── (A) Perfil etário ─────────

def municipios_por_ano(zonas: pd.DataFrame, mun_ref: pd.DataFrame, esc: pd.DataFrame) -> pd.DataFrame:
    somas = [c for c in zonas.columns if c.startswith(("comp", "aptos"))]
    m = zonas.groupby(["ano", "cd_municipio"], as_index=False)[somas].sum()
    m = completar(m).merge(mun_ref, on="cd_municipio", how="inner")
    e = esc.groupby(["ano", "cd_municipio"], as_index=False)[["comp_sup", "comp_esc"]].sum()
    e["pct_sup"] = 100 * e["comp_sup"] / e["comp_esc"]
    m = m.merge(e[["ano", "cd_municipio", "pct_sup"]], on=["ano", "cd_municipio"], how="left")
    m["terco"] = 0
    m["terco_uf"] = 0
    for ano in ANOS_PERFIL:
        sel = m["ano"] == ano
        m.loc[sel, "terco"] = tercos(m[sel], "idade").astype(int)
        m.loc[sel, "terco_uf"] = tercos(m[sel], "idade", por="sg_uf").astype(int)
    return m


def parte_a(mun: pd.DataFrame) -> tuple[list[str], dict]:
    s = titulo("PARTE A: perfil etário dos municípios")
    s += ["Por ano, quem votou no 1º turno (média simples dos municípios) e os limites dos terços no país.",
          "'60+ > 16-29' = municípios onde votaram mais pessoas de 60 anos ou mais do que de 16 a 29 anos.", "",
          "   Ano  Municípios  Idade média  Mais jovem até  Mais velho a partir de   % 60+   % 16-29   60+ > 16-29",
          "  " + "-" * 100]
    for ano in ANOS_PERFIL:
        d = mun[mun["ano"] == ano]
        lim1 = d.loc[d["terco"] == 1, "idade"].max()
        lim3 = d.loc[d["terco"] == 3, "idade"].min()
        mais_velhos = (d["comp_60"] > d["comp_16_29"]).sum()
        s.append(f"  {ano}  {n(len(d)):>10}  {d['idade'].mean():>11.1f}  {lim1:>14.1f}  {lim3:>22.1f}"
                 f"  {d['pct_60'].mean():>6.1f}  {d['pct_16_29'].mean():>8.1f}"
                 f"   {n(mais_velhos):>5} ({100 * mais_velhos / len(d):.1f}%)")
    d24 = mun[mun["ano"] == 2024].sort_values("idade")
    s += ["", "2024, os 5 municípios mais jovens e os 5 mais velhos (idade média de quem votou):"]
    for rot, parte in (("mais jovens", d24.head(5)), ("mais velhos", d24.tail(5).iloc[::-1])):
        s.append(f"  {rot}: " + "; ".join(f"{r.nm_municipio.title()}-{r.sg_uf} {r.idade:.1f}" for r in parte.itertuples()))

    # Estabilidade e conferência com o Censo
    t18 = mun[mun["ano"] == 2018].set_index("cd_municipio")["terco"]
    t24 = mun[mun["ano"] == 2024].set_index("cd_municipio")["terco"]
    comum = t18.index.intersection(t24.index)
    estavel = 100 * (t18[comum] == t24[comum]).mean()
    d22 = mun[mun["ano"] == 2022]
    corr = {rot: d22["idade"].corr(d22[c]) for rot, c in (
        ("idade média da população (Censo, 9514)", "idade_pop"),
        ("idade média da população de 16+ (Censo, 9514)", "idade_pop_16"),
        ("idade mediana (Censo, 9515)", "mediana_idade"),
        ("índice de envelhecimento (Censo, 9515)", "indice_envelhecimento"))}
    dif_aptos = (d22["idade_aptos"] - d22["idade_pop_16"]).mean()
    s += ["", f"Estabilidade: {estavel:.1f}% dos municípios estão no mesmo terço em 2018 e em 2024.",
          "", "Conferência com o Censo 2022 (correlação, entre municípios, com a idade média de quem votou em 2022):"]
    s += [f"  {rot:<48} r = {v:+.2f}" for rot, v in corr.items()]
    s += paragrafo(f"Eleitorado apto (TSE) x população de 16+ (Censo): o apto é em média {dif_aptos:+.1f} anos mais "
                   "velho, porque o cadastro do TSE demora a dar baixa em mortos e mudanças, e porque votar é "
                   "facultativo aos 16 e 17 anos (muitos não tiram o título).", "  ")

    s += ["", "Por UF (2024): idade média de quem votou (média dos municípios), % dos municípios no terço mais velho",
          "do país e % com mais votantes de 60+ do que de 16-29.", "",
          "  UF  Municípios  Idade média  % terço mais velho  % 60+ > 16-29", "  " + "-" * 64]
    for uf, d in d24.groupby("sg_uf"):
        s.append(f"  {uf}  {n(len(d)):>10}  {d['idade'].mean():>11.1f}  {100 * (d['terco'] == 3).mean():>18.1f}"
                 f"  {100 * (d['comp_60'] > d['comp_16_29']).mean():>14.1f}")
    resumo = {"amplitude": (d24["idade"].min(), d24["idade"].max()), "estavel": estavel,
              "r_censo": corr["idade média da população (Censo, 9514)"],
              "media": {a: mun.loc[mun["ano"] == a, "idade"].mean() for a in ANOS_PERFIL}}
    return s, resumo


# ───────── (B) Alternância de poder ─────────

class Linhagens:
    """Renomeações (mesmo partido) e fusões do CSV da P7, mais as anteriores a 2018 (ANTIGAS_*)."""

    def __init__(self):
        self.pai: dict[str, str] = {}
        self.fusoes: list[tuple[int, str, tuple[str, ...]]] = []
        with open(SUCESSAO, encoding="utf-8", newline="") as f:
            for linha in csv.DictReader(f, delimiter=";"):
                resultado = canonica(linha["resultado"])
                partes = [canonica(p) for p in linha["origem"].split("+")]
                if linha["tipo"] == "renomeacao":
                    self.unir(resultado, partes[0])
                else:
                    self.fusoes.append((int(linha["ano"]), resultado, tuple(p for p in partes if p != resultado)))
        for a, b in ANTIGAS_RENOMEACOES:
            self.unir(a, b)
        self.fusoes += ANTIGAS_FUSOES

    def raiz(self, s: str) -> str:
        while self.pai.get(s, s) != s:
            s = self.pai[s]
        return s

    def unir(self, a: str, b: str) -> None:
        ra, rb = self.raiz(a), self.raiz(b)
        if ra != rb:
            self.pai[rb] = ra

    def passagem(self, antes: str, depois: str, ano_antes: int, ano_depois: int) -> str:
        """MESMO (inclusive renomeado), FUSAO (o partido anterior foi incorporado ao novo entre as eleições) ou TROCA."""
        if self.raiz(antes) == self.raiz(depois):
            return MESMO
        for ano, resultado, partes in self.fusoes:
            if (ano_antes < ano <= ano_depois and self.raiz(resultado) == self.raiz(depois)
                    and any(self.raiz(p) == self.raiz(antes) for p in partes)):
                return FUSAO
        return TROCA


def chave_partido(sigla: str, numero: int) -> str:
    c = canonica(sigla)
    return "PSD41" if c == "PSD" and numero == 41 else c


def nome_normal(nome: str) -> str:
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().upper().translate(str.maketrans("ZY", "SI"))
    return re.sub(r"[^A-Z]", "", s)


def passagens(pref: pd.DataFrame, mun_ref: pd.DataFrame) -> pd.DataFrame:
    """Uma linha por município e eleição com a eleição ordinária anterior (4 anos antes) também presente.

    Em 2000 o TSE marca dois "eleitos" a prefeito em 30 municípios (o vice, sempre do mesmo partido): a passagem
    compara os conjuntos (há continuidade se algum par é do mesmo partido / da mesma pessoa).
    """
    lin = Linhagens()
    pref = pref.assign(chave=[chave_partido(s, int(x)) for s, x in zip(pref["sigla"], pref["numero"])],
                       nome_n=pref["nome"].map(nome_normal))
    g = pref.groupby(["cd_municipio", "ano"]).agg(
        ids=("id_politico", lambda s: set(s)), nomes=("nome_n", lambda s: set(s)),
        chaves=("chave", lambda s: sorted(set(s))), partido=("sigla", lambda s: "/".join(sorted(set(s))))).reset_index()
    t = g.merge(g.assign(ano=g["ano"] + 4), on=["cd_municipio", "ano"], suffixes=("", "_ant"))
    ordem = {MESMO: 0, FUSAO: 1, TROCA: 2}
    t["passagem"] = [min((lin.passagem(a, b, ano - 4, ano) for a in antes for b in depois), key=ordem.get)
                     for antes, depois, ano in zip(t["chaves_ant"], t["chaves"], t["ano"])]
    t["mesma_pessoa"] = [bool(i & ia) or bool(nm & nma) for i, ia, nm, nma in
                         zip(t["ids"], t["ids_ant"], t["nomes"], t["nomes_ant"])]
    t = t.merge(mun_ref[["cd_municipio", "nm_municipio", "sg_uf"]], on="cd_municipio")
    t["ano_anterior"] = t["ano"] - 4
    return t[["cd_municipio", "nm_municipio", "sg_uf", "ano_anterior", "ano", "partido_ant", "partido",
              "passagem", "mesma_pessoa"]].rename(columns={"partido_ant": "partido_anterior"})


def indice_alternancia(t: pd.DataFrame) -> pd.DataFrame:
    i = t.assign(troca=t["passagem"].eq(TROCA), fusao=t["passagem"].eq(FUSAO)).groupby("cd_municipio").agg(
        passagens=("passagem", "size"), trocas=("troca", "sum"), fusoes=("fusao", "sum"),
        reeleicoes=("mesma_pessoa", "sum"))
    i["alt_estrita"] = 100 * (i["trocas"] + i["fusoes"]) / i["passagens"]   # fusão conta como troca
    i["alt_ampla"] = 100 * i["trocas"] / i["passagens"]                     # fusão conta como continuidade
    i["alt_pessoa"] = 100 * (1 - i["reeleicoes"] / i["passagens"])
    return i.reset_index()


def porte(pop) -> str:
    for lo, hi, rot in PORTES:
        if lo <= pop < hi:
            return rot
    return "-"


def parte_b(t: pd.DataFrame, mun: pd.DataFrame) -> tuple[list[str], dict]:
    s = titulo("PARTE B: alternância de poder na prefeitura (1996 a 2024)")
    s += paragrafo("Cada passagem de mandato (eleição ordinária -> a seguinte, 4 anos depois) recebe uma marca pelo "
                   f"partido: '{MESMO}' (renomeações como PMDB->MDB, PFL->DEM, PR->PL contam como o mesmo partido); "
                   f"'{FUSAO}' (o partido do prefeito anterior foi incorporado ao do novo entre as duas eleições, "
                   f"como PSL->UNIÃO em 2022 e PTB/Patriota->PRD em 2023); '{TROCA}'. E pela pessoa: reeleição ou "
                   "outra pessoa. A lista completa está em respostas/06_passagens_prefeitura.csv.")
    s += ["", "  Passagem    Passagens  Mesmo partido  Troca com ressalva  Troca de partido  Reeleição",
          "  " + "-" * 88]
    for ano, d in t.groupby("ano"):
        c = d["passagem"].value_counts()
        s.append(f"  {ano - 4}->{ano}  {n(len(d)):>9}  {100 * c.get(MESMO, 0) / len(d):>12.1f}%"
                 f"  {n(c.get(FUSAO, 0)):>9} ({100 * c.get(FUSAO, 0) / len(d):>4.1f}%)"
                 f"  {100 * c.get(TROCA, 0) / len(d):>15.1f}%  {100 * d['mesma_pessoa'].mean():>8.1f}%")
    c = t["passagem"].value_counts()
    s.append(f"  {'Total':<10}  {n(len(t)):>9}  {100 * c.get(MESMO, 0) / len(t):>12.1f}%"
             f"  {n(c.get(FUSAO, 0)):>9} ({100 * c.get(FUSAO, 0) / len(t):>4.1f}%)"
             f"  {100 * c.get(TROCA, 0) / len(t):>15.1f}%  {100 * t['mesma_pessoa'].mean():>8.1f}%")
    fus = t[t["passagem"] == FUSAO].groupby(["ano", "partido_anterior", "partido"]).size().sort_values(ascending=False)
    s += ["", "Trocas com ressalva (partidos fundidos), por par:"]
    s += [f"  {a - 4}->{a}  {pa} -> {pn}: {n(q)}" for (a, pa, pn), q in fus.items()]

    # Índice por município x terço de idade (dentro da UF, 2024)
    i = indice_alternancia(t)
    m24 = mun[mun["ano"] == 2024][["cd_municipio", "sg_uf", "idade", "terco_uf", "populacao"]]
    m24 = m24.merge(mun.loc[mun["ano"] == 2024, ["cd_municipio", "pct_sup"]], on="cd_municipio")
    i = i.merge(m24, on="cd_municipio")
    i["log_pop"] = np.log(i["populacao"].astype(float))
    i["porte"] = i["populacao"].map(porte)
    s += ["", "Índice de alternância de cada município = % das suas passagens com troca. Terços de idade de quem",
          "votou em 2024, montados dentro de cada UF (a idade muda muito entre regiões). Médias dos municípios.", "",
          "  Terço (na UF)    Municípios  Idade  Troca (fusão = troca)  Troca (fusão = continuidade)  Outra pessoa",
          "  " + "-" * 98]
    for k, d in i.groupby("terco_uf"):
        s.append(f"  {TERCOS[k]:<15}  {n(len(d)):>10}  {d['idade'].mean():>5.1f}  {d['alt_estrita'].mean():>20.1f}%"
                 f"  {d['alt_ampla'].mean():>27.1f}%  {d['alt_pessoa'].mean():>11.1f}%")
    s += ["", "Por porte (população do Censo 2022), troca de partido com fusão = troca:", "",
          "  Porte              Mais jovem  Intermediário  Mais velho   (municípios)", "  " + "-" * 72]
    for _, _, rot in PORTES:
        d = i[i["porte"] == rot]
        v = d.groupby("terco_uf")["alt_estrita"].mean()
        s.append(f"  {rot:<17}  {v.get(1, np.nan):>9.1f}%  {v.get(2, np.nan):>12.1f}%  {v.get(3, np.nan):>9.1f}%"
                 f"   ({n(len(d))})")
    por_uf = i.groupby(["sg_uf", "terco_uf"])["alt_estrita"].mean().unstack()
    por_uf = por_uf.dropna(subset=[1, 3]) if {1, 3} <= set(por_uf.columns) else por_uf.iloc[0:0]
    velho_mais = int((por_uf[3] > por_uf[1]).sum())
    s += ["", f"Por UF: o terço mais velho alterna mais que o mais jovem em {velho_mais} de {len(por_uf)} UFs "
          f"(diferença mediana: {(por_uf[3] - por_uf[1]).median():+.1f} pontos)."]

    ctrl = ("log_pop", "pct_sup")
    e_estr = efeito(i, "alt_estrita", "idade", "sg_uf", peso="passagens", controles=ctrl)
    e_ampla = efeito(i, "alt_ampla", "idade", "sg_uf", peso="passagens", controles=ctrl)
    e_pessoa = efeito(i, "alt_pessoa", "idade", "sg_uf", peso="passagens", controles=ctrl)
    s += ["", "Efeito de +5 anos na idade média de quem votou (2024), dentro da UF, descontados porte e escolaridade:"]
    s += [f"  troca (fusão = troca):         {efeito_txt(e_estr, 5, 'pontos')}",
          f"  troca (fusão = continuidade):  {efeito_txt(e_ampla, 5, 'pontos')}",
          f"  outra pessoa na prefeitura:    {efeito_txt(e_pessoa, 5, 'pontos')}"]

    # Passagens recentes com o terço da própria eleição
    s += ["", "Passagens recentes com o terço de idade da própria eleição (dentro da UF): % com troca de partido",
          "(fusão = troca).", "", "  Passagem    Mais jovem  Intermediário  Mais velho", "  " + "-" * 50]
    for ano in (2020, 2024):
        d = t[t["ano"] == ano].merge(mun[mun["ano"] == ano][["cd_municipio", "terco_uf"]], on="cd_municipio")
        v = d.assign(tr=d["passagem"].ne(MESMO)).groupby("terco_uf")["tr"].mean() * 100
        s.append(f"  {ano - 4}->{ano}  {v.get(1, np.nan):>9.1f}%  {v.get(2, np.nan):>12.1f}%  {v.get(3, np.nan):>9.1f}%")
    medias = i.groupby("terco_uf")["alt_estrita"].mean()
    return s, {"estrita": e_estr, "ampla": e_ampla, "pessoa": e_pessoa, "medias": medias,
               "velho_mais": velho_mais, "ufs": len(por_uf), "fusoes": int(c.get(FUSAO, 0)), "passagens": len(t)}


# ───────── (C) Idade dos eleitos ─────────

def faixa_idade(idade: pd.Series) -> pd.Series:
    return pd.cut(idade, [17, 34, 49, 64, 200], labels=list(FAIXAS)).astype(int)


def parte_c(cand: pd.DataFrame, mun: pd.DataFrame) -> tuple[list[str], dict]:
    s = titulo("PARTE C: idade dos eleitos (prefeito e vereadores, 2020 e 2024)")
    cand = cand[cand["idade"].between(18, 100)].copy()
    cand["faixa"] = faixa_idade(cand["idade"])
    s += ["Distribuição por faixa de idade: quem votou (18+, 1º turno), candidatos aptos e eleitos.", "",
          "  Ano   Grupo                        Pessoas  Idade média  " + "  ".join(f"{v:>10}" for v in FAIXAS.values()),
          "  " + "-" * 104]
    for ano in (2020, 2024):
        mv = mun[mun["ano"] == ano]
        tot = sum(mv[f"comp_f{f}"].sum() for f in FAIXAS)
        cols = "  ".join(f"{100 * mv[f'comp_f{f}'].sum() / tot:>9.1f}%" for f in FAIXAS)
        s.append(f"  {ano}  {'quem votou (18+)':<27}  {n(tot):>11}  {'-':>11}  {cols}")
        for cargo in (11, 13):
            for rot, d in (("candidatos", cand[(cand["ano"] == ano) & (cand["cod_cargo"] == cargo)]),
                           ("eleitos", cand[(cand["ano"] == ano) & (cand["cod_cargo"] == cargo) & cand["eleito"]])):
                cnt = d["faixa"].value_counts(normalize=True) * 100
                cols = "  ".join(f"{cnt.get(f, 0):>9.1f}%" for f in FAIXAS)
                s.append(f"  {ano}  {CARGOS[cargo] + ': ' + rot:<27}  {n(len(d)):>11}  {d['idade'].mean():>11.1f}  {cols}")
        s.append("")

    # Por município
    g = cand.groupby(["ano", "cd_municipio", "cod_cargo"])
    por = pd.DataFrame({"cand": g["idade"].mean(),
                        "eleitos": cand[cand["eleito"]].groupby(["ano", "cd_municipio", "cod_cargo"])["idade"].mean()})
    por = por.unstack("cod_cargo")
    por.columns = [f"{a}_{CARGOS[c][:3].lower()}" for a, c in por.columns]
    por = por.reset_index().merge(mun[["ano", "cd_municipio", "sg_uf", "idade", "terco_uf", "populacao", "pct_sup"]],
                                  on=["ano", "cd_municipio"])
    por["premio_ver"] = por["eleitos_ver"] - por["cand_ver"]
    por["log_pop"] = np.log(por["populacao"].astype(float))
    pref = cand[cand["eleito"] & (cand["cod_cargo"] == 11)].groupby(["ano", "cd_municipio"])["idade"].max()
    por = por.merge((pref >= 60).rename("pref_60").reset_index(), on=["ano", "cd_municipio"], how="left")

    s += ["Por terço de idade de quem votou (dentro da UF), médias dos municípios. 'Prêmio' = idade média dos",
          "vereadores eleitos menos a dos candidatos a vereador do mesmo município.", "",
          "  Ano   Terço (na UF)   Quem votou  Cand. vereador  Vereadores eleitos  Prêmio  Prefeito eleito  % prefeito 60+",
          "  " + "-" * 112]
    for ano in (2020, 2024):
        for k in (1, 2, 3):
            d = por[(por["ano"] == ano) & (por["terco_uf"] == k)]
            s.append(f"  {ano}  {TERCOS[k]:<14}  {d['idade'].mean():>10.1f}  {d['cand_ver'].mean():>14.1f}"
                     f"  {d['eleitos_ver'].mean():>18.1f}  {d['premio_ver'].mean():>+6.1f}  {d['eleitos_pre'].mean():>15.1f}"
                     f"  {100 * d['pref_60'].mean():>13.1f}%")
    efeitos = {}
    s += ["", "Efeito de +5 anos na idade média de quem votou, dentro da UF e do ano, descontados porte e escolaridade:"]
    por["uf_ano"] = por["sg_uf"] + por["ano"].astype(str)
    for col, rot in (("cand_ver", "idade dos candidatos a vereador"), ("eleitos_ver", "idade dos vereadores eleitos"),
                     ("premio_ver", "prêmio (eleitos - candidatos)"), ("eleitos_pre", "idade do prefeito eleito")):
        efeitos[col] = efeito(por, col, "idade", "uf_ano", controles=("log_pop", "pct_sup"), cluster="cd_municipio")
        s.append(f"  {rot:<34} {efeito_txt(efeitos[col], 5, 'anos')}")
    nac = {ano: {c: cand[(cand["ano"] == ano) & (cand["cod_cargo"] == c) & cand["eleito"]]["idade"].mean()
                 for c in (11, 13)} for ano in (2020, 2024)}
    votou = {ano: media_p(mun.loc[mun["ano"] == ano, "idade"], mun.loc[mun["ano"] == ano, "comp"]) for ano in (2020, 2024)}
    m24 = mun[mun["ano"] == 2024]
    jovens_votou = 100 * m24["comp_f1"].sum() / sum(m24[f"comp_f{f}"].sum() for f in FAIXAS)
    e24 = cand[(cand["ano"] == 2024) & (cand["cod_cargo"] == 13) & cand["eleito"]]
    return s, {"efeitos": efeitos, "nac": nac, "votou": votou, "jovens_votou": jovens_votou,
               "jovens_vereadores": 100 * (e24["faixa"] == 1).mean()}


# ───────── (D) Jovem vota no jovem? ─────────

def zonas_com_votos(votos: pd.DataFrame, zonas_tse: pd.DataFrame, zonas_banco: pd.DataFrame,
                    mun_ref: pd.DataFrame, esc: pd.DataFrame) -> pd.DataFrame:
    v = votos.copy()
    v["votos"] = v["votos"].astype(float)
    v["votos_x_idade"] = v["votos_x_idade"].astype(float)
    tab = v.pivot_table(index=["id_zona", "ano", "cod_cargo"], columns="faixa", values="votos", aggfunc="sum",
                        fill_value=0)
    tab.columns = [f"v_f{c}" for c in tab.columns]
    soma = v.groupby(["id_zona", "ano", "cod_cargo"])[["votos", "votos_x_idade"]].sum()
    z = soma.join(tab).reset_index()
    z["idade_votada"] = z["votos_x_idade"] / z["votos"]
    for f in FAIXAS:
        z[f"pct_v{f}"] = 100 * z.get(f"v_f{f}", 0) / z["votos"]
    z = z.merge(zonas_banco, on="id_zona").merge(completar(zonas_tse), on=["ano", "cd_municipio", "nr_zona"])
    z = z.merge(mun_ref[["cd_municipio", "sg_uf"]], on="cd_municipio")
    z = z.merge(esc, on=["id_zona", "ano"], how="left")
    z["pct_sup"] = 100 * z["comp_sup"] / z["comp_esc"]
    z = z[z["comp"] > 0].copy()
    chave = ["ano", "cod_cargo", "cd_municipio"]
    z["zonas_no_mun"] = z.groupby(chave)["id_zona"].transform("size")
    z["peso_mun"] = z["votos"] / z.groupby(chave)["votos"].transform("sum")   # cada município pesa 1
    return z


def mais_jovem_x_mais_velha(z: pd.DataFrame) -> dict:
    """Em cada município com 2+ zonas: zona de quem votou mais jovem x mais velha (diferenças médias)."""
    d = z[z["zonas_no_mun"] >= 2].sort_values("idade")
    g = d.groupby("cd_municipio")
    jov, vel = g.first(), g.last()
    return {"municipios": len(jov), "dif_idade": (vel["idade"] - jov["idade"]).mean(),
            "dif_votada": (vel["idade_votada"] - jov["idade_votada"]).mean(),
            "dif_jovens": (vel["pct_v1"] - jov["pct_v1"]).mean(), "dif_65": (vel["pct_v4"] - jov["pct_v4"]).mean(),
            "votada_maior": 100 * (vel["idade_votada"] > jov["idade_votada"]).mean()}


def parte_d(z: pd.DataFrame) -> tuple[list[str], dict]:
    s = titulo("PARTE D: jovem vota no jovem? (votos nominais do 1º turno por zona eleitoral)")
    s += paragrafo("O voto é secreto: não se sabe em quem cada eleitor votou, só o total de votos de cada candidato "
                   "em cada zona e a idade de quem compareceu à zona. 'Idade votada' = idade média dos candidatos "
                   "ponderada pelos votos que receberam na zona. Se zonas com eleitorado mais velho dão votos a "
                   "candidatos mais velhos, a idade votada sobe junto com a idade de quem votou. É uma relação entre "
                   "lugares (inferência ecológica): ela é compatível com 'velho vota no velho', mas não prova o voto "
                   "de cada pessoa.")
    res = {}
    s += ["", "D1) Deputados: todas as zonas da UF têm os mesmos candidatos na urna. Terços de zonas dentro da UF,",
          "com o mesmo número de votantes em cada terço.", "",
          "  Ano   Cargo              Terço (na UF)   Quem votou  Idade votada  % votos 18-34  % votos 65+", "  " + "-" * 96]
    for ano in (2018, 2022):
        for cargo in (6, 7):
            d = z[(z["ano"] == ano) & (z["cod_cargo"] == cargo)].copy()
            d["terco"] = tercos(d, "idade", por="sg_uf", peso="comp")
            for k in (1, 2, 3):
                q = d[d["terco"] == k]
                s.append(f"  {ano}  {CARGOS[cargo]:<17}  {TERCOS[k]:<14}  {media_p(q['idade'], q['comp']):>10.1f}"
                         f"  {media_p(q['idade_votada'], q['votos']):>12.1f}  {media_p(q['pct_v1'], q['votos']):>12.1f}%"
                         f"  {media_p(q['pct_v4'], q['votos']):>10.1f}%")
    cidades = z[(z["zonas_no_mun"] >= 2) & (z["ano"] == 2024) & (z["cod_cargo"] == 13)]
    r_esc = efeito(cidades, "pct_sup", "idade", "cd_municipio", reps=0)["r"]
    s += [""]
    s += paragrafo("Nas cidades com várias zonas, as zonas de eleitorado mais velho são também as mais escolarizadas "
                   f"(r = {r_esc:+.2f} entre a idade e a % com superior completo de quem votou, dentro do município, "
                   "2024), e a escolaridade também muda o voto. Por isso cada efeito aparece duas vezes: sem controle e "
                   "comparando zonas de mesma escolaridade. Entre zonas da UF, cada zona pesa pelos seus votos; entre "
                   "zonas do mesmo município, cada município pesa igual (senão São Paulo e Rio decidiriam o resultado). "
                   "IC de 95% por reamostragem de municípios.")
    s += ["", "Efeito de +5 anos na idade de quem votou sobre a idade votada:"]
    for ano in (2018, 2022):
        for cargo in (6, 7):
            d = z[(z["ano"] == ano) & (z["cod_cargo"] == cargo)]
            for chave, rot, dd, por, peso in (("uf", "zonas da UF", d, "sg_uf", "votos"),
                                              ("mun", "zonas do município", d[d["zonas_no_mun"] >= 2],
                                               "cd_municipio", "peso_mun")):
                bruto = efeito(dd, "idade_votada", "idade", por, peso=peso, cluster="cd_municipio")
                ctrl = efeito(dd, "idade_votada", "idade", por, peso=peso, controles=("pct_sup",), cluster="cd_municipio")
                res[(ano, cargo, chave)] = ctrl
                s.append(f"  {ano} {CARGOS[cargo]:<17} {rot + ', sem controle:':<39} {efeito_txt(bruto, 5, 'anos')}")
                s.append(f"  {ano} {CARGOS[cargo]:<17} {rot + ', mesma escolaridade:':<39} {efeito_txt(ctrl, 5, 'anos')}")

    s += ["", "D2) Vereador e prefeito: cada município tem os seus candidatos, então só se comparam zonas do mesmo",
          "município (municípios com 2 zonas ou mais).", ""]
    s += ["  Ano   Cargo              Municípios  Dif. idade quem votou  Dif. idade votada  Dif. % votos 18-34  "
          "Dif. % votos 65+  Votada maior", "  " + "-" * 122]
    for ano in (2020, 2024):
        for cargo in (11, 13):
            d = z[(z["ano"] == ano) & (z["cod_cargo"] == cargo)]
            mm = mais_jovem_x_mais_velha(d)
            s.append(f"  {ano}  {CARGOS[cargo]:<17}  {n(mm['municipios']):>10}  {mm['dif_idade']:>+20.1f}"
                     f"  {mm['dif_votada']:>+17.2f}  {mm['dif_jovens']:>+18.1f}  {mm['dif_65']:>+16.1f}"
                     f"  {mm['votada_maior']:>11.1f}%")
    s += paragrafo("(zona mais velha menos a mais jovem de cada município, média dos municípios; 'Votada maior' = % "
                   "dos municípios em que a zona mais velha deu votos a candidatos mais velhos)", "  ")
    s += ["", "Efeito de +5 anos na idade de quem votou sobre a idade votada, entre zonas do município:"]
    for ano in (2020, 2024):
        for cargo in (11, 13):
            d = z[(z["ano"] == ano) & (z["cod_cargo"] == cargo) & (z["zonas_no_mun"] >= 2)]
            bruto = efeito(d, "idade_votada", "idade", "cd_municipio", peso="peso_mun", cluster="cd_municipio")
            ctrl = efeito(d, "idade_votada", "idade", "cd_municipio", peso="peso_mun", controles=("pct_sup",),
                          cluster="cd_municipio")
            res[(ano, cargo, "mun")] = ctrl
            s.append(f"  {ano} {CARGOS[cargo]:<17} sem controle:       {efeito_txt(bruto, 5, 'anos')}")
            s.append(f"  {ano} {CARGOS[cargo]:<17} mesma escolaridade: {efeito_txt(ctrl, 5, 'anos')}")
    res["r_esc"] = r_esc
    return s, res


# ───────── Conclusão ─────────

def sentido(e: dict, positivo: str, negativo: str, nulo: str) -> str:
    return {1: positivo, -1: negativo, 0: nulo}[claro(e)]


def conclusao(a: dict, b: dict, c: dict, d: dict) -> list[str]:
    ef = c["efeitos"]
    dep_uf = [d[(ano, cargo, "uf")] for ano in (2018, 2022) for cargo in (6, 7)]
    dep_mun = [d[(ano, cargo, "mun")] for ano in (2018, 2022) for cargo in (6, 7)]
    ver = [d[(ano, 13, "mun")] for ano in (2020, 2024)]
    pre = [d[(ano, 11, "mun")] for ano in (2020, 2024)]

    def faixa(es: list[dict]) -> str:
        return f"{min(e['b'] for e in es) * 5:+.1f} a {max(e['b'] for e in es) * 5:+.1f} anos"

    def positivos(es: list[dict]) -> str:
        return f"{sum(claro(e) == 1 for e in es)} de {len(es)}"

    p = [
        f"Perfil etário. A idade média de quem votou vai de {a['amplitude'][0]:.1f} a {a['amplitude'][1]:.1f} anos "
        f"entre os municípios em 2024 e subiu de {a['media'][2018]:.1f} (2018) para {a['media'][2024]:.1f} (2024). "
        f"A classificação em terços é estável ({a['estavel']:.0f}% dos municípios no mesmo terço em 2018 e 2024) e "
        f"acompanha o Censo (r = {a['r_censo']:+.2f} com a idade média da população). Como a idade muda muito entre "
        "regiões (Sul mais velho, Norte mais jovem), as comparações das partes B a D são feitas dentro de cada UF.",

        f"Alternância. Das {n(b['passagens'])} passagens de mandato de prefeito desde 1996, {n(b['fusoes'])} são trocas "
        "com ressalva (o partido do prefeito anterior foi incorporado ao do novo, como DEM e PSL no UNIÃO) e aparecem "
        "à parte. A troca de partido não depende da idade do município: nos municípios mais velhos da própria UF ela "
        f"ocorre em {b['medias'].get(3, float('nan')):.1f}% das passagens, contra {b['medias'].get(1, float('nan')):.1f}% "
        f"nos mais jovens, e +5 anos de idade de quem votou mudam a troca em {b['estrita']['b'] * 5:+.1f} pontos "
        f"({b['ampla']['b'] * 5:+.1f} com fusão = continuidade; "
        + sentido(b["estrita"], "diferença clara", "diferença clara", "intervalo inclui o zero") + "). "
        "O que muda, pouco, é a pessoa: "
        + sentido(b["pessoa"], f"municípios mais velhos trocam mais de prefeito ({b['pessoa']['b'] * 5:+.1f} pontos a cada "
                               "+5 anos), ou seja, reelegem menos, mas tendem a manter o partido.",
                  f"municípios mais velhos trocam menos de prefeito ({b['pessoa']['b'] * 5:+.1f} pontos a cada +5 anos).",
                  "a troca de prefeito também não muda com a idade."),

        f"Idade dos eleitos. Em 2024 os prefeitos eleitos tinham em média {c['nac'][2024][11]:.1f} anos e os "
        f"vereadores {c['nac'][2024][13]:.1f}, contra {c['votou'][2024]:.1f} de quem votou; quem tem de 18 a 34 anos "
        f"é {c['jovens_votou']:.0f}% de quem votou e {c['jovens_vereadores']:.0f}% dos vereadores eleitos. Municípios "
        f"mais velhos elegem vereadores mais velhos ({ef['eleitos_ver']['b'] * 5:+.1f} anos a cada +5 anos de idade de "
        f"quem votou) e prefeitos um pouco mais velhos ({ef['eleitos_pre']['b'] * 5:+.1f}), mas isso acompanha quem se "
        f"candidata ({ef['cand_ver']['b'] * 5:+.1f} anos nos candidatos a vereador); entre os candidatos, "
        + sentido(ef["premio_ver"], "os eleitos são mais velhos nos lugares mais velhos.",
                  "os eleitos são um pouco mais novos nos lugares mais velhos.",
                  "a escolha não favorece os mais velhos nem os mais novos (prêmio de idade sem diferença clara)."),

        "Jovem vota no jovem? Há uma afinidade de idade, mas fraca, e ela só aparece comparando lugares de mesma "
        f"escolaridade: nas cidades, as zonas mais velhas são também as mais escolarizadas (r = {d['r_esc']:+.2f}), e "
        "isso empurra o voto no sentido oposto. Com a escolaridade fixa, entre zonas da mesma UF, que têm os mesmos "
        f"candidatos a deputado, +5 anos de idade de quem votou levam a {faixa(dep_uf)} na idade média dos votados "
        f"(efeito positivo e claro em {positivos(dep_uf)} casos); para vereador, entre zonas do mesmo município, "
        f"{faixa(ver)} ({positivos(ver)}); para prefeito, {faixa(pre)} ({positivos(pre)}); para deputado entre zonas "
        f"do mesmo município, {faixa(dep_mun)} ({positivos(dep_mun)}). Ou seja, lugares mais velhos votam um pouco mais "
        "em candidatos mais velhos, e os mais jovens em candidatos mais jovens, mas entre o terço de zonas mais jovem e o "
        "mais velho (3 a 4 anos de diferença em quem votou) a idade dos votados muda de meio ano a pouco mais de um ano, "
        "enquanto o candidato típico tem de 45 a 50 anos em "
        "todo lugar. A evidência é entre lugares, e não entre pessoas: não prova como vota cada eleitor.",
    ]
    return ["", "=" * 100, "CONCLUSÃO", "=" * 100, "", *[l for t in p for l in (*textwrap.wrap(t, 98), "")]]


# ───────── Principal ─────────

def main() -> None:
    faixas = eleitorado_por_faixa("--refazer-cache" in sys.argv)
    zonas_tse = perfil_zonas(faixas)
    conn = conectar()
    print("Consultando municípios, prefeitos e candidaturas...", flush=True)
    mun_ref = consultar(conn, SQL_MUNICIPIOS)
    mun_ref = mun_ref.merge(censo_idade(), left_on="cd_ibge", right_index=True, how="left")
    for c in ("populacao", "mediana_idade", "indice_envelhecimento"):
        mun_ref[c] = pd.to_numeric(mun_ref[c], errors="coerce")
    mun_ref["populacao"] = mun_ref["populacao"].fillna(mun_ref["pop_censo"])
    gravados = gravar_censo(conn, mun_ref)
    esc = consultar(conn, SQL_ESCOLARIDADE).merge(consultar(conn, SQL_ZONAS), on="id_zona")
    for c in ("comp_sup", "comp_esc"):
        esc[c] = esc[c].astype(float)
    mun = municipios_por_ano(zonas_tse, mun_ref, esc)
    pref = consultar(conn, SQL_PREFEITOS)
    cand = consultar(conn, SQL_CANDIDATURAS)
    print("Somando votos por zona e idade do candidato (alguns minutos)...", flush=True)
    votos = consultar(conn, SQL_VOTOS)
    zonas_banco = consultar(conn, SQL_ZONAS)
    ufs = [s for s, _ in ufs_carregadas(conn)]
    conn.close()

    t = passagens(pref, mun_ref)
    PASSAGENS.parent.mkdir(exist_ok=True)
    t.sort_values(["sg_uf", "nm_municipio", "ano"]).to_csv(PASSAGENS, index=False, sep=";")
    z = zonas_com_votos(votos, zonas_tse, zonas_banco, mun_ref, esc[["id_zona", "ano", "comp_sup", "comp_esc"]])

    sa, ra = parte_a(mun)
    sb, rb = parte_b(t, mun)
    sc, rc = parte_c(cand, mun)
    sd, rd = parte_d(z)
    cabecalho = [
        "P6) Idade do município x alternância de poder e idade dos eleitos: jovem vota no jovem?",
        "",
        "Fontes: perfil de comparecimento por faixa etária e zona (TSE, 1º turno; cache em "
        "dados/_derivados/eleitorado_idade_zona.csv);",
        "população por idade simples (Censo 2022, SIDRA 9514) e idade mediana/índice de envelhecimento (SIDRA 9515);",
        "prefeitos eleitos 1996-2024, candidaturas e votos nominais por zona (TSE, banco eleicoes).",
        f"UFs: {', '.join(ufs) if len(ufs) < 27 else 'todas as 27'}. "
        f"Idade média da população gravada em ibge_censo_municipio para {n(gravados)} municípios.",
        "",
        "Observações:",
        "- Idades em anos completos. Candidato: na data do 1º turno (15/11 em 2020). Quem votou: ponto médio da faixa",
        "  do TSE (16 a 20 anos ano a ano; depois de 5 em 5; 100 ou mais = 100). Faixa 'inválida' fica de fora.",
        "- Terços: os municípios (ou zonas) em 3 grupos pela idade média de quem votou; 'na UF' = dentro de cada UF.",
        "- Eleições ordinárias apenas; suplementares e vices ficam de fora. Candidaturas aptas = sem #NULO.",
        "- Efeitos: inclinação dentro do grupo indicado (efeito fixo), em unidades de +5 anos de idade de quem votou;",
        "  escolaridade = % de quem votou com superior completo (declarada no alistamento, ver P4).",
    ]
    texto = "\n".join([*cabecalho, *sa, *sb, *sc, *sd, *conclusao(ra, rb, rc, rd)]) + "\n"
    caminho = gravar_txt("06_idade_alternancia.txt", texto)
    print(f"Gravado: {caminho.relative_to(RAIZ)} e {PASSAGENS.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
