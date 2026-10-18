"""Score de partidos por SVD sobre as votações nominais do Plenário da Câmara, numa janela de datas.

Uso (da raiz do projeto), com os CSVs da Câmara em dados/camara/ (python -m crawler --fontes camara):

    # 1) replicar o trabalho antigo (legislatura atual)
    python scripts/svd_camara.py --nome replica_legado_57 --inicio 2023-02-01 --fim 2026-12-31

    # 2) janela de uma eleição + validação contra o artigo (onda 2018 ou 2022) e contra o Governo
    python scripts/svd_camara.py --nome eleicao_2018 --inicio 2016-08-31 --fim 2018-07-31 --partido moda \
        --experts dados/ideologia_partidos/df_experts.csv --onda 2018

As janelas usadas no banco, com os parâmetros e a validação de cada uma, estão em
banco/referencia/svd/janelas.csv; os resultados, em banco/referencia/svd/svd_<nome>.csv.

Arquivos lidos, para cada ano da janela, em --dados (padrão dados/camara):
    votacoes-AAAA.csv, votacoesVotos-AAAA.csv, votacoesOrientacoes-AAAA.csv   (separador ';')

Saída: svd_<nome>.csv com partido, n_dep, score (SVD) e alinh_governo (fração dos votos Sim/Não do partido
iguais à orientação do Governo nas votações em que ele orientou; vazio se o arquivo não tiver a bancada).

Método (igual ao do trabalho antigo, que é o padrão --metodo original):
    Sim = 1, Não = -1, Abstenção e Obstrução = 0, ausência = 0; TruncatedSVD de 1 componente sobre
    deputado x votação; sinal fixado por âncoras (esquerda < direita); normalização min-max por
    deputado para -100..+100; score do partido = média dos seus deputados.
    --metodo centrado: antes do SVD, centraliza cada votação pela média dos votos registrados
    (o TruncatedSVD não centraliza, e o 1º componente pode captar só "votar com a maioria").

Só votações do Plenário e nominais: o arquivo traz votos de algumas votações simbólicas (de quem
fez questão de se manifestar); elas são descartadas por terem poucos votos (--min-votos).
"""
import argparse
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.decomposition import TruncatedSVD

CODIGO = {"Sim": 1.0, "Não": -1.0, "Abstenção": 0.0, "Obstrução": 0.0}

# Mesmo partido com outro nome (regra do artigo: renomeado = mesmo valor). Fusões NÃO entram aqui.
CANON = {
    "PMDB": "MDB", "SD": "SOLIDARIEDADE", "SDD": "SOLIDARIEDADE", "PTDOB": "AVANTE", "PTB": "PTB",
    "PRB": "REPUBLICANOS", "REP": "REPUBLICANOS", "PR": "PL", "PPS": "CIDADANIA", "CDD": "CIDADANIA",
    "PTN": "PODE", "PODEMOS": "PODE", "PEN": "PATRI", "PATRIOTA": "PATRI", "PROGRESSISTAS": "PP",
    "PROGRE": "PP", "GOV": "GOVERNO", "PSDC": "DC", "PTC": "AGIR", "PMN": "MOBILIZA", "PCDOB": "PCDOB", "PC DO B": "PCDOB",
}


def canonica(sigla: str) -> str:
    s = unicodedata.normalize("NFKD", str(sigla)).encode("ascii", "ignore").decode().upper()
    s = re.sub(r"[^A-Z0-9 ]", "", s).strip()
    return CANON.get(s, CANON.get(s.replace(" ", ""), s.replace(" ", "") if s.startswith("PC") else s))


def ler(caminho: Path) -> pd.DataFrame:
    return pd.read_csv(caminho, sep=";", encoding="utf-8-sig", dtype=str)


def arquivos(pasta: Path, tipo: str, anos: range) -> list[Path]:
    achados = [pasta / f"{tipo}-{a}.csv" for a in anos if (pasta / f"{tipo}-{a}.csv").exists()]
    if not achados:
        sys.exit(f"Nenhum arquivo {tipo}-AAAA.csv em {pasta} para {anos.start}-{anos.stop - 1}.")
    faltam = [a for a in anos if not (pasta / f"{tipo}-{a}.csv").exists()]
    if faltam:
        print(f"  aviso: sem {tipo} para {faltam}", file=sys.stderr)
    return achados


def carregar(pasta: Path, inicio: date, fim: date, min_votos: int, legislatura: str | None):
    anos = range(inicio.year, fim.year + 1)
    vot = pd.concat([ler(p) for p in arquivos(pasta, "votacoes", anos)], ignore_index=True)
    vot = vot[(vot["siglaOrgao"] == "PLEN") & (vot["data"] >= inicio.isoformat()) & (vot["data"] <= fim.isoformat())]
    print(f"Votações do Plenário na janela: {len(vot):,}")

    votos = pd.concat([ler(p) for p in arquivos(pasta, "votacoesVotos", anos)], ignore_index=True)
    votos = votos[votos["idVotacao"].isin(set(vot["id"]))]
    if legislatura:
        votos = votos[votos["deputado_idLegislatura"] == legislatura]
    votos = votos[votos["voto"].isin(CODIGO)]

    por_votacao = votos.groupby("idVotacao").size()
    print("Votos registrados por votação (para escolher --min-votos):")
    for lo, hi in [(1, 10), (11, 49), (50, 99), (100, 299), (300, 10_000)]:
        print(f"  {lo:>4}-{hi:<6}{((por_votacao >= lo) & (por_votacao <= hi)).sum():>7,} votações")
    nominais = set(por_votacao[por_votacao >= min_votos].index)
    placar = vot.set_index("id")[["votosSim", "votosNao", "votosOutros"]].astype(float).sum(axis=1)
    print(f"Mantidas {len(nominais):,} votações com >= {min_votos} votos"
          f" (referência: {int((placar > 0).sum()):,} têm placar preenchido em votacoes-AAAA)")
    votos = votos[votos["idVotacao"].isin(nominais)].copy()
    votos["dataHoraVoto"] = pd.to_datetime(votos["dataHoraVoto"])
    votos["codigo"] = votos["voto"].map(CODIGO)
    votos["partido"] = votos["deputado_siglaPartido"].map(canonica)
    return votos, nominais


def matriz(votos: pd.DataFrame, min_participacao: float) -> pd.DataFrame:
    # votos repetidos do mesmo deputado na mesma votação: vale o último registro
    ult = votos.sort_values("dataHoraVoto").drop_duplicates(["deputado_id", "idVotacao"], keep="last")
    m = ult.pivot(index="deputado_id", columns="idVotacao", values="codigo")
    if min_participacao > 0:
        m = m[m.notna().mean(axis=1) >= min_participacao]
    return m


def scores_deputado(m: pd.DataFrame, metodo: str) -> pd.Series:
    x = m.to_numpy(dtype=float)
    if metodo == "centrado":
        x = np.where(np.isnan(x), 0.0, x - np.nanmean(x, axis=0))
    else:
        x = np.nan_to_num(x, nan=0.0)
    svd = TruncatedSVD(n_components=1, algorithm="arpack", random_state=0)
    s = svd.fit_transform(x)[:, 0]
    print(f"Variância explicada pelo 1º componente: {100 * svd.explained_variance_ratio_[0]:.1f}%"
          f" ({m.shape[0]:,} deputados x {m.shape[1]:,} votações)")
    return pd.Series(s, index=m.index)


def normaliza(s: pd.Series) -> pd.Series:
    return 200 * (s - s.min()) / (s.max() - s.min()) - 100


def partido_do_deputado(votos: pd.DataFrame, regra: str) -> pd.Series:
    v = votos.sort_values("dataHoraVoto")
    if regra == "moda":
        return v.groupby("deputado_id")["partido"].agg(lambda x: x.mode().iloc[0])
    return v.groupby("deputado_id")["partido"].last()


def por_partido(s: pd.Series, partido: pd.Series) -> pd.DataFrame:
    d = pd.DataFrame({"score": s, "partido": partido.reindex(s.index)}).dropna()
    return d.groupby("partido")["score"].agg(n_dep="size", score="mean").reset_index()


def fixa_sinal(s: pd.Series, partido: pd.Series, esq: list[str], dire: list[str]) -> tuple[pd.Series, str]:
    """O sinal do SVD é arbitrário: vira o eixo se as âncoras da esquerda ficarem à direita das da direita."""
    def media(lista):
        alvo = {canonica(a) for a in lista}
        ok = partido.reindex(s.index).isin(alvo)
        return normaliza(s)[ok].mean() if ok.any() else np.nan
    e, d = media(esq), media(dire)
    if np.isnan(e) or np.isnan(d):
        return s, f"AVISO: âncoras {esq}/{dire} ausentes na janela; sinal NÃO fixado (conferir à mão)"
    if e > d:
        return -s, f"sinal invertido (esquerda {e:+.1f} > direita {d:+.1f} antes da inversão)"
    return s, f"sinal mantido (esquerda {e:+.1f} < direita {d:+.1f})"


# ───────── validação ─────────

def referencia_artigo(caminho: Path, onda: str) -> pd.Series:
    d = pd.read_csv(caminho, sep=";", encoding="utf-8-sig", decimal=",")
    d = d[d["id"].astype(str).str.startswith(onda)]
    pref = f"ideol_{onda[2:]}_"
    cols = [c for c in d.columns if c.startswith(pref)]
    medias = {canonica(c[len(pref):]): pd.to_numeric(d[c], errors="coerce").mean() for c in cols}
    return pd.Series(medias)


def alinhamento_governo(pasta: Path, votos: pd.DataFrame, nominais: set, anos: range) -> pd.Series | None:
    o = pd.concat([ler(p) for p in arquivos(pasta, "votacoesOrientacoes", anos)], ignore_index=True)
    o = o[o["idVotacao"].isin(nominais)]
    gov = o[o["siglaBancada"].map(lambda x: canonica(x) == "GOVERNO") & o["orientacao"].isin(["Sim", "Não"])]
    if gov.empty:
        print("AVISO: sem orientação do 'Governo' em votacoesOrientacoes; teste governo x oposição pulado.")
        return None
    gov = gov.drop_duplicates("idVotacao").set_index("idVotacao")["orientacao"].map({"Sim": 1.0, "Não": -1.0})
    v = votos[votos["codigo"].ne(0) & votos["idVotacao"].isin(gov.index)].copy()
    v["acordo"] = (v["codigo"] == v["idVotacao"].map(gov)).astype(float)
    print(f"Votações com orientação do Governo (Sim/Não): {len(gov):,}")
    return v.groupby("partido")["acordo"].mean()


def valida(tab: pd.DataFrame, ref: pd.Series | None, gov: pd.Series | None, min_dep: int) -> None:
    t = tab[tab["n_dep"] >= min_dep].set_index("partido")["score"]
    print(f"\n── Validação (partidos com >= {min_dep} deputados: {len(t)}) ──")
    for nome, outro in [("artigo", ref), ("alinhamento com o Governo", gov)]:
        if outro is None:
            continue
        j = pd.concat([t, outro], axis=1, keys=["svd", "outro"]).dropna()
        if len(j) < 4:
            print(f"  {nome}: só {len(j)} partidos em comum; sem correlação")
            continue
        rho, p = spearmanr(j["svd"], j["outro"])
        print(f"  Spearman SVD x {nome}: {rho:+.3f} (n={len(j)}, p={p:.3f})")
        if nome == "artigo":
            centro = j[(j["outro"] > 5.5) & (j["svd"] < -10)]
            print(f"    partidos à direita no artigo (>5,5) e à esquerda no SVD (<-10): {len(centro)}"
                  + (f" -> {', '.join(centro.index)}" if len(centro) else ""))
            print(f"    sem par no artigo: {', '.join(sorted(set(t.index) - set(j.index))) or '-'}")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--nome", required=True, help="rótulo da janela (nome do arquivo de saída)")
    p.add_argument("--inicio", required=True, type=date.fromisoformat)
    p.add_argument("--fim", required=True, type=date.fromisoformat)
    p.add_argument("--dados", type=Path, default=Path("dados/camara"))
    p.add_argument("--saida", type=Path, default=Path("banco/referencia/svd"))
    p.add_argument("--metodo", choices=["original", "centrado"], default="original")
    p.add_argument("--min-votos", type=int, default=100, help="votos registrados para uma votação contar como nominal")
    p.add_argument("--min-participacao", type=float, default=0.0, help="fração mínima das votações em que o deputado votou")
    p.add_argument("--legislatura", help="filtra deputado_idLegislatura (ex.: 56)")
    p.add_argument("--partido", choices=["ultimo", "moda"], default="ultimo", help="partido do deputado na janela")
    p.add_argument("--ancora-esq", nargs="+", default=["PT", "PSOL"])
    p.add_argument("--ancora-dir", nargs="+", default=["PL", "NOVO", "PSL"])
    p.add_argument("--experts", type=Path, help="df_experts.csv do Harvard Dataverse (validação)")
    p.add_argument("--onda", choices=["2018", "2022"], help="onda do artigo a comparar")
    p.add_argument("--min-dep", type=int, default=3, help="mínimo de deputados por partido na validação")
    a = p.parse_args(argv)

    votos, nominais = carregar(a.dados, a.inicio, a.fim, a.min_votos, a.legislatura)
    if votos.empty:
        sys.exit("Nenhum voto nominal na janela.")
    m = matriz(votos, a.min_participacao)
    s = scores_deputado(m, a.metodo)
    part = partido_do_deputado(votos, a.partido)
    s, aviso = fixa_sinal(s, part, a.ancora_esq, a.ancora_dir)
    print("Sinal:", aviso)
    tab = por_partido(normaliza(s), part).sort_values("score")
    tab["score"] = tab["score"].round(1)
    gov = alinhamento_governo(a.dados, votos, nominais, range(a.inicio.year, a.fim.year + 1))
    if gov is not None:
        tab["alinh_governo"] = tab["partido"].map(gov).round(3)

    a.saida.mkdir(parents=True, exist_ok=True)
    destino = a.saida / f"svd_{a.nome}.csv"
    tab.to_csv(destino, index=False, sep=";")
    print(f"\n{len(tab)} partidos -> {destino}")
    print(tab.to_string(index=False))

    ref = referencia_artigo(a.experts, a.onda) if a.experts and a.onda else None
    if ref is not None or gov is not None:
        valida(tab, ref, gov, a.min_dep)
    return 0


if __name__ == "__main__":
    sys.exit(main())
