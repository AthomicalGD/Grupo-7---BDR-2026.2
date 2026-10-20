"""Viés (artigo) e alinhamento (SVD da Câmara) dos partidos em cada eleição de 2018 a 2024.

Uso: python -m loader.vies [--dados PASTA] [--banco URL]
Roda sozinho ao fim de `python -m loader`; rode à mão depois de mudar as referências abaixo.

Entradas:
    dados/ideologia_partidos/df_experts.csv      notas de 0 (extrema esquerda) a 10 (extrema direita) dos
                                                 especialistas, ondas de julho de 2018 e de 2022 (Bolognesi et al.)
    banco/referencia/sucessao_partidos.csv       renomeações e fusões
    banco/referencia/svd/svd_<janela>.csv        alinhamento nas votações da Câmara (scripts/svd_camara.py)
    eleicao_referencia (migração 006)            onda do artigo e janela do SVD de cada eleição

Saídas: vies_partido_onda, partido_alinhamento, partido.vies_politico e o CSV de auditoria
respostas/vies_partidos_auditoria.csv, com a origem de cada número.

Resolução do valor de um partido numa eleição, para cada fonte (a referência da fonte é o ano da onda
do artigo ou o ano de início da janela do SVD):
    1. se o partido resulta de uma fusão posterior à referência e não posterior à eleição, a média dos
       componentes que têm valor (a fonte mediu as partes, não o partido novo): PODE em 2024 = PODE + PSC;
    2. senão, o valor próprio do partido na fonte;
    3. senão, o de outro nome do mesmo partido (renomeação): REPUBLICANOS em 2020 = PRB;
    4. senão, a média dos componentes de uma fusão anterior;
    5. senão, sem valor (NULL, nunca 0).
"""
import argparse
import csv
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from statistics import fmean

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

RAIZ = Path(__file__).resolve().parent.parent
REFERENCIA = RAIZ / "banco" / "referencia"
AUDITORIA = RAIZ / "respostas" / "vies_partidos_auditoria.csv"
BANCO_PADRAO = "postgresql://eleicoes:eleicoes@localhost:5432/eleicoes"

# Abreviações do questionário (colunas ideol_AA_<x>) e grafias que não são mudança de nome.
GRAFIA = {"PROGRESSISTAS": "PP", "PROGRE": "PP", "PODEMOS": "PODE", "SDD": "SOLIDARIEDADE",
          "CDD": "CIDADANIA", "REP": "REPUBLICANOS"}


def canonica(sigla: str) -> str:
    """Sigla sem acento, espaço nem pontuação: 'PC do B' e 'p_cdo_b' -> PCDOB, 'UNIÃO' -> UNIAO."""
    s = unicodedata.normalize("NFKD", str(sigla)).encode("ascii", "ignore").decode().upper()
    s = re.sub(r"[^A-Z0-9]", "", s)
    return GRAFIA.get(s, s)


def duas_casas(x: float) -> float:
    """Arredonda meio para cima, como a Tabela 1 (round(4.595, 2) do Python dá 4.59 pelo binário)."""
    return float(Decimal(repr(x)).quantize(Decimal("0.01"), ROUND_HALF_UP))


def escala(media: float | None) -> float | None:
    """Média do artigo (0 a 10) na escala da aplicação (-100 a +100)."""
    return None if media is None else (media - 5) * 20


# ───────── Regras de sucessão ─────────

@dataclass(frozen=True)
class Fusao:
    ano: int
    resultado: str                  # sigla canônica
    componentes: tuple[str, ...]    # siglas canônicas


class Sucessao:
    """Renomeações (mesmo partido, outro nome) e fusões de banco/referencia/sucessao_partidos.csv."""

    def __init__(self, caminho: Path = REFERENCIA / "sucessao_partidos.csv"):
        self._pai: dict[str, str] = {}
        self.fusoes: list[Fusao] = []
        with open(caminho, encoding="utf-8", newline="") as f:
            for linha in csv.DictReader(f, delimiter=";"):
                resultado = canonica(linha["resultado"])
                if linha["tipo"] == "renomeacao":
                    self._unir(resultado, canonica(linha["origem"]))
                elif linha["tipo"] == "fusao":
                    partes = tuple(canonica(p) for p in linha["origem"].split("+"))
                    self.fusoes.append(Fusao(int(linha["ano"]), resultado, partes))
                else:
                    raise ValueError(f"tipo desconhecido em {caminho}: {linha['tipo']}")

    def _raiz(self, s: str) -> str:
        while self._pai.get(s, s) != s:
            s = self._pai[s]
        return s

    def _unir(self, a: str, b: str) -> None:
        ra, rb = self._raiz(a), self._raiz(b)
        if ra != rb:
            self._pai[rb] = ra

    def nomes(self, s: str) -> list[str]:
        """O próprio nome primeiro, depois os outros nomes do mesmo partido."""
        grupo = {n for n in {*self._pai, *self._pai.values(), s} if self._raiz(n) == self._raiz(s)}
        return [s, *sorted(grupo - {s})]

    def fusoes_de(self, s: str) -> list[Fusao]:
        grupo = set(self.nomes(s))
        return sorted((f for f in self.fusoes if f.resultado in grupo), key=lambda f: f.ano, reverse=True)


@dataclass
class Fonte:
    nome: str
    referencia: int                     # ano da onda, ou ano de início da janela do SVD
    valores: dict[str, float]           # sigla canônica -> valor


def resolver(fonte: Fonte, suc: Sucessao, sigla: str, ano: int) -> tuple[float | None, str]:
    """Valor do partido `sigla` na eleição `ano` segundo a fonte, e a origem do número."""
    alvo = canonica(sigla)

    def proprio(s: str) -> tuple[float | None, str]:
        for nome in suc.nomes(s):
            if nome in fonte.valores:
                return fonte.valores[nome], ("direto" if nome == s else f"renomeado de {nome}")
        return None, ""

    def na_referencia(s: str) -> float | None:
        """Valor de um componente na data da fonte (próprio, outro nome ou fusão já ocorrida)."""
        v, _ = proprio(s)
        if v is not None:
            return v
        for f in suc.fusoes_de(s):
            if f.ano <= fonte.referencia:
                v, _ = media_da_fusao(f)
                if v is not None:
                    return v
        return None

    def media_da_fusao(f: Fusao) -> tuple[float | None, str]:
        partes = [(c, na_referencia(c)) for c in f.componentes]
        com_valor = [(c, v) for c, v in partes if v is not None]
        if not com_valor:
            return None, ""
        rotulo = f"média de {' e '.join(c for c, _ in com_valor)} (fusão de {f.ano})"
        sem = [c for c, v in partes if v is None]
        if sem:
            rotulo += f"; sem valor: {', '.join(sem)}"
        return fmean(v for _, v in com_valor), rotulo

    for f in suc.fusoes_de(alvo):
        if fonte.referencia < f.ano <= ano:
            v, origem = media_da_fusao(f)
            if v is not None:
                return v, origem
    v, origem = proprio(alvo)
    if v is not None:
        return v, origem
    for f in suc.fusoes_de(alvo):
        if f.ano <= ano:
            v, origem = media_da_fusao(f)
            if v is not None:
                return v, origem
    return None, "sem valor"


# ───────── Fontes ─────────

def medias_artigo(raiz: Path) -> dict[int, pd.DataFrame]:
    """Média e número de respostas por partido em cada onda: {onda: DataFrame(sigla, media, n)}."""
    caminho = raiz / "ideologia_partidos" / "df_experts.csv"
    df = pd.read_csv(caminho, sep=";", encoding="utf-8-sig", dtype=str)
    ondas = {}
    for onda in (2018, 2022):
        prefixo = f"ideol_{str(onda)[2:]}_"
        linhas = df[df["id"].str.startswith(str(onda))]
        notas = linhas[[c for c in linhas.columns if c.startswith(prefixo)]].apply(pd.to_numeric, errors="coerce")
        ondas[onda] = pd.DataFrame({
            "coluna": notas.columns, "sigla": [canonica(c[len(prefixo):]) for c in notas.columns],
            "media": notas.mean().to_numpy(), "n": notas.count().to_numpy(),
        })
    return ondas


def fonte_artigo(medias: dict[int, pd.DataFrame], onda: int) -> Fonte:
    """Médias com duas casas, a precisão publicada: o artigo tira a média das fusões a partir delas
    (PCdoB 2018 = (1,92 + 7,27) / 2 = 4,60; com as médias sem arredondar daria 4,59)."""
    m = medias[onda].dropna(subset=["media"])
    return Fonte(f"artigo, onda {onda}", onda, dict(zip(m["sigla"], m["media"].round(2))))


def tabela_svd(janela: str) -> pd.DataFrame:
    df = pd.read_csv(REFERENCIA / "svd" / f"svd_{janela}.csv", sep=";")
    df["sigla"] = df["partido"].map(canonica)
    return df


def fontes_svd(janela: str, inicio: int) -> tuple[Fonte, Fonte]:
    """Score do SVD e alinhamento com o Governo, como duas fontes com as mesmas regras de sucessão."""
    df = tabela_svd(janela)
    gov = df.dropna(subset=["alinh_governo"])
    return (Fonte(f"SVD {janela}", inicio, dict(zip(df["sigla"], df["score"]))),
            Fonte(f"SVD {janela} (governo)", inicio, dict(zip(gov["sigla"], gov["alinh_governo"]))))


# ───────── Banco ─────────

SQL_PARTIDOS_POR_ELEICAO = """
SELECT DISTINCT v.ano_eleicao AS ano, p.numero, p.sigla
FROM votacao_partido_municipio v JOIN partido p USING (id_partido)
WHERE v.ano_eleicao IN (SELECT ano_eleitoral FROM eleicao_referencia)
UNION
SELECT DISTINCT e.ano, p.numero, p.sigla
FROM politico_eleicao pe JOIN eleicao e USING (id_eleicao) JOIN partido p ON p.id_partido = pe.id_partido
WHERE e.ano IN (SELECT ano_eleitoral FROM eleicao_referencia)
ORDER BY 1, 2, 3"""

SQL_COBERTURA = """
SELECT r.ano_eleitoral AS ano,
       100.0 * sum(v.qt_votos_validos) FILTER (WHERE o.media IS NOT NULL) / sum(v.qt_votos_validos) AS artigo,
       100.0 * sum(v.qt_votos_validos) FILTER (WHERE a.score IS NOT NULL) / sum(v.qt_votos_validos) AS svd
FROM votacao_partido_municipio v
JOIN eleicao_referencia r ON r.ano_eleitoral = v.ano_eleicao AND v.cod_cargo = ANY (r.cargos)
JOIN partido p USING (id_partido)
LEFT JOIN vies_partido_onda o ON (o.ano_eleitoral, o.numero, o.sigla) = (v.ano_eleicao, p.numero, p.sigla)
LEFT JOIN partido_alinhamento a ON (a.ano_eleitoral, a.numero, a.sigla) = (v.ano_eleicao, p.numero, p.sigla)
GROUP BY 1 ORDER BY 1"""


def atualizar(cur, raiz: Path, auditoria: Path | None = AUDITORIA) -> list[tuple]:
    """Recalcula tudo a partir das referências e devolve a cobertura por ano (ano, % artigo, % SVD).

    Não faz commit."""
    suc = Sucessao()
    medias = medias_artigo(raiz)
    cur.execute("SELECT ano_eleitoral, onda_artigo, janela_svd, extract(year FROM svd_inicio)::int "
                "FROM eleicao_referencia ORDER BY 1")
    referencias = cur.fetchall()
    cur.execute(SQL_PARTIDOS_POR_ELEICAO)
    partidos = cur.fetchall()

    linhas_vies, linhas_alinh, trilha = [], [], []
    for ano, onda, janela, inicio in referencias:
        artigo = fonte_artigo(medias, onda)
        svd, governo = fontes_svd(janela, inicio)
        n_dep = tabela_svd(janela).groupby("sigla")["n_dep"].sum().to_dict()
        for _, numero, sigla in (p for p in partidos if p[0] == ano):
            media, origem = resolver(artigo, suc, sigla, ano)
            linhas_vies.append((ano, numero, sigla, onda, media, origem))
            trilha.append((ano, numero, sigla, "artigo", f"onda {onda}", media, escala(media), origem))
            score, origem_svd = resolver(svd, suc, sigla, ano)
            alinh, _ = resolver(governo, suc, sigla, ano)
            n = n_dep.get(canonica(sigla)) if origem_svd == "direto" else None
            linhas_alinh.append((ano, numero, sigla, janela, score, alinh, n, origem_svd))
            trilha.append((ano, numero, sigla, "svd", janela, score, score, origem_svd))

    cur.execute("DELETE FROM vies_partido_onda; DELETE FROM partido_alinhamento")
    execute_values(cur, "INSERT INTO vies_partido_onda (ano_eleitoral, numero, sigla, onda, media, origem) VALUES %s",
                   linhas_vies)
    execute_values(cur, "INSERT INTO partido_alinhamento (ano_eleitoral, numero, sigla, janela_svd, score, "
                        "alinh_governo, n_deputados, origem) VALUES %s",
                   [(a, nu, s, j, None if v is None else round(v, 1), None if g is None else round(g, 3), n, o)
                    for a, nu, s, j, v, g, n, o in linhas_alinh])

    # partido.vies_politico: o da eleição mais recente do partido. Partidos que só disputaram antes de 2018
    # herdam o do mesmo partido com outro nome e o mesmo número (PFL -> DEM, PPB -> PP); os demais ficam NULL.
    recente: dict[tuple[int, str], float] = {}
    for ano, numero, sigla, _, media, _ in sorted(linhas_vies):
        if media is not None:
            recente[(numero, sigla)] = escala(media)
    cur.execute("SELECT numero, sigla FROM partido")
    for numero, sigla in cur.fetchall():
        if (numero, sigla) in recente:
            continue
        for outro in suc.nomes(canonica(sigla))[1:]:
            achado = [v for (n, s), v in recente.items() if n == numero and canonica(s) == outro]
            if achado:
                recente[(numero, sigla)] = achado[0]
                trilha.append(("atual", numero, sigla, "artigo", "partido.vies_politico", None, achado[0],
                               f"renomeado de {outro} (mesmo número)"))
                break
    cur.execute("UPDATE partido SET vies_politico = NULL")
    execute_values(cur, "UPDATE partido p SET vies_politico = v.vies FROM (VALUES %s) AS v (numero, sigla, vies) "
                        "WHERE p.numero = v.numero AND p.sigla = v.sigla",
                   [(n, s, v) for (n, s), v in recente.items()])

    if auditoria:
        auditoria.parent.mkdir(parents=True, exist_ok=True)
        with open(auditoria, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["ano_eleitoral", "numero", "sigla", "fonte", "referencia", "valor_fonte",
                        "valor_menos100_mais100", "origem"])
            for a, nu, s, fo, ref, v, e, o in trilha:
                w.writerow([a, nu, s, fo, ref, "" if v is None else f"{v:.4f}", "" if e is None else f"{e:.1f}", o])

    cur.execute(SQL_COBERTURA)
    return cur.fetchall()


def resumo(cobertura: list[tuple]) -> str:
    return "; ".join(f"{a}: artigo {float(art):.2f}%, SVD {float(s):.2f}%" for a, art, s in cobertura)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="python -m loader.vies", description=__doc__.split("\n")[0])
    p.add_argument("--dados", type=Path, default=RAIZ / "dados", help="pasta com os dados (padrão: ./dados)")
    p.add_argument("--banco", default=os.environ.get("DATABASE_URL", BANCO_PADRAO))
    a = p.parse_args(argv)
    with psycopg2.connect(a.banco) as conn, conn.cursor() as cur:
        cobertura = atualizar(cur, a.dados.resolve())
        conn.commit()
    print(f"Viés e alinhamento dos partidos atualizados. Cobertura dos votos válidos: {resumo(cobertura)}")
    print(f"Origem de cada valor: {AUDITORIA.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
