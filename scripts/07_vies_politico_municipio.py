"""P7) Viés político de cada município/região na linha do tempo (E.P.: 2018, 2020, 2022, 2024).

Viés do município num ano = média do viés dos partidos (partido.vies_politico, de -100 a +100)
ponderada pelos votos válidos (nominais + legenda) que cada partido teve no município naquele
ano, somando todos os cargos disputados (1º turno das eleições ordinárias).
Região e estado: a mesma média ponderada, sobre os votos de todos os seus municípios.

O resultado por município é gravado em vies_municipio.

Uso: python scripts/07_vies_politico_municipio.py [UF ...]   (sem UF: todas as carregadas)
Saída: respostas/07_vies_politico_municipio.txt
"""
import sys

import pandas as pd
from psycopg2.extras import execute_values

from comum import RAIZ, conectar, consultar, escolher_ufs, gravar_txt

ANOS = [2018, 2020, 2022, 2024]
REGIOES = RAIZ / "dados" / "ibge" / "territorio" / "municipios.csv"

SQL = """
SELECT m.cd_municipio, m.nm_municipio, m.cd_ibge, v.ano_eleicao AS ano,
       sum(v.qt_votos_validos * p.vies_politico) AS votos_x_vies,
       sum(v.qt_votos_validos) AS votos,
       COALESCE(sum(v.qt_votos_validos) FILTER (WHERE p.vies_politico = 0), 0) AS votos_sem_vies
FROM votacao_partido_municipio v
JOIN partido p ON p.id_partido = v.id_partido
JOIN municipio m ON m.cd_municipio = v.cd_municipio
WHERE m.cd_uf = %(cd_uf)s AND v.ano_eleicao = ANY(%(anos)s)
GROUP BY 1, 2, 3, 4
HAVING sum(v.qt_votos_validos) > 0
"""


def regioes() -> pd.DataFrame | None:
    if not REGIOES.exists():
        print(f"aviso: {REGIOES} não encontrado; o resultado sai sem regiões")
        return None
    df = pd.read_csv(REGIOES, sep=";", encoding="utf-8-sig", dtype={"cod_ibge": "Int64"})
    return df[["cod_ibge", "regiao_intermediaria"]].rename(columns={"cod_ibge": "cd_ibge"})


def vies(df: pd.DataFrame, por: list[str]) -> pd.DataFrame:
    """Média ponderada pelos votos, em colunas por ano."""
    g = df.groupby([*por, "ano"])[["votos_x_vies", "votos"]].sum()
    return (g["votos_x_vies"] / g["votos"]).unstack("ano").reindex(columns=ANOS)


def fmt(x) -> str:
    return f"{x:+6.1f}" if pd.notna(x) else "     -"


def tabela(titulo: str, rotulo: str, df: pd.DataFrame, largura: int) -> list[str]:
    cab = f"  {rotulo:<{largura}}" + "".join(f"  {a:>6}" for a in ANOS)
    linhas = [titulo, cab, "  " + "-" * (len(cab) - 2)]
    for nome, r in df.iterrows():
        linhas.append(f"  {str(nome):<{largura}}" + "".join(f"  {fmt(r[a])}" for a in ANOS))
    return linhas + [""]


def gravar_banco(conn, cd_uf: int, df: pd.DataFrame) -> None:
    linhas = [(int(r.cd_municipio), int(r.ano), float(r.votos_x_vies / r.votos)) for r in df.itertuples()]
    with conn.cursor() as cur:
        cur.execute("""DELETE FROM vies_municipio v USING municipio m
                       WHERE m.cd_municipio = v.cd_municipio AND m.cd_uf = %s AND v.ano_eleitoral = ANY(%s)""",
                    (cd_uf, ANOS))
        execute_values(cur, "INSERT INTO vies_municipio (cd_municipio, ano_eleitoral, vies_calculado) VALUES %s",
                       linhas)
    conn.commit()


def secao_uf(conn, sigla: str, cd_uf: int, reg: pd.DataFrame | None) -> list[str]:
    df = consultar(conn, SQL, {"cd_uf": cd_uf, "anos": ANOS})
    if df.empty:
        return [f"{'=' * 70}", f"UF: {sigla} — sem votação por partido no banco", ""]
    for c in ("votos_x_vies", "votos", "votos_sem_vies"):
        df[c] = df[c].astype(float)
    gravar_banco(conn, cd_uf, df)

    out = [f"{'=' * 70}", f"UF: {sigla}", f"{'=' * 70}", ""]
    estado = vies(df.assign(uf=sigla), ["uf"])
    out += tabela("Estado", "", estado, 4)
    cobertura = df.groupby("ano")[["votos_sem_vies", "votos"]].sum()
    out += ["  Votos em partidos sem viés informado (contam como 0): "
            + ", ".join(f"{a}: {100 * r.votos_sem_vies / r.votos:.1f}%" for a, r in cobertura.iterrows()), ""]

    if reg is not None:
        d = df.merge(reg, on="cd_ibge", how="left")
        d["regiao_intermediaria"] = d["regiao_intermediaria"].fillna("(sem região)")
        out += tabela("Regiões intermediárias (IBGE)", "Região", vies(d, ["regiao_intermediaria"]), 32)

    mun = vies(df, ["nm_municipio", "cd_municipio"]).droplevel("cd_municipio").sort_index()
    out += destaques(mun)
    out += tabela(f"Municípios ({len(mun)})", "Município", mun, 32)
    return out


def destaques(mun: pd.DataFrame) -> list[str]:
    """Municípios extremos de cada ano e os de maior e menor variância entre os anos."""
    out = ["Municípios mais à esquerda e mais à direita",
           f"  {'Ano':<4}  {'Mais à esquerda':<38}  {'Mais à direita':<38}",
           "  " + "-" * 82]
    for a in ANOS:
        s = mun[a].dropna()
        if s.empty:
            continue
        esq, dir_ = s.idxmin(), s.idxmax()
        out.append(f"  {a:<4}  {f'{esq} ({fmt(s[esq]).strip()})':<38}  {f'{dir_} ({fmt(s[dir_]).strip()})':<38}")
    out.append("")

    # Variância populacional dos 4 anos; só municípios com viés em todos eles.
    completos = mun.dropna()
    var = completos.var(axis=1, ddof=0).rename("var")
    largura = 32
    for titulo, sel in (("maior variância (mais mudaram)", var.nlargest(5)),
                        ("menor variância (mais constantes)", var.nsmallest(5))):
        cab = f"  {'Município':<{largura}}" + "".join(f"  {a:>6}" for a in ANOS) + f"  {'Variância':>9}"
        out += [f"Top 5 municípios com {titulo}", cab, "  " + "-" * (len(cab) - 2)]
        for nome, v in sel.items():
            r = completos.loc[nome]
            out.append(f"  {str(nome):<{largura}}" + "".join(f"  {fmt(r[a])}" for a in ANOS) + f"  {v:>9.1f}")
        out.append("")
    if len(completos) < len(mun):
        out += [f"  ({len(mun) - len(completos)} município(s) sem viés em algum ano ficaram fora da variância.)", ""]
    return out


CABECALHO = """\
P7) Viés político dos municípios e regiões na linha do tempo (2018, 2020, 2022, 2024)

Escala: -100 = esquerda, +100 = direita (viés de cada partido em partido.vies_politico).
Viés do município no ano = média do viés dos partidos ponderada pelos votos válidos
(nominais + legenda) que cada partido obteve ali, somando todos os cargos do 1º turno
(2018/2022: presidente, governador, senador, deputados; 2020/2024: prefeito e vereador).
Regiões e estado: a mesma média ponderada sobre os votos de todos os seus municípios.

Observações:
- Partidos sem viés informado entram com viés 0 e puxam a média para o centro; a parcela
  desses votos aparece logo abaixo do estado.
- Em 2018 cada eleitor tinha 2 votos para senador, então o Senado pesa o dobro nesse ano.
- Anos gerais e municipais têm cargos diferentes: compare 2018 com 2022 e 2020 com 2024.
- Variância: variância populacional dos 4 valores anuais do município (pontos²); entram só
  os municípios com viés nos 4 anos. Parte dela vem da troca entre anos gerais e municipais.
"""


def main(argv: list[str]) -> None:
    reg = regioes()
    with conectar() as conn:
        texto = [CABECALHO]
        for sigla, cd_uf in escolher_ufs(conn, argv):
            texto += secao_uf(conn, sigla, cd_uf, reg)
    caminho = gravar_txt("07_vies_politico_municipio.txt", "\n".join(texto))
    print(f"gravado: {caminho}")


if __name__ == "__main__":
    main(sys.argv[1:])
