"""P7) Viés político de cada município/região na linha do tempo (E.P.: 2018, 2020, 2022, 2024).

Viés do partido: média das notas dos especialistas (Bolognesi et al.; 0 = extrema esquerda,
10 = extrema direita) na onda que vale para a eleição (eleicao_referencia), levada para -100 a +100
por (média - 5) * 20 e com as regras de sucessão de banco/referencia/sucessao_partidos.csv
(tabela vies_partido_onda, preenchida por python -m loader.vies).

Viés do município num ano: em cada cargo do ano, média do viés dos partidos ponderada pelos votos
válidos (nominais + legenda, 1º turno); depois, média dos cargos com peso igual. Partido sem viés
fica fora do numerador e do denominador e aparece na cobertura. Região e estado: a mesma conta
sobre os votos de todos os seus municípios. A base é a view vies_votos_cargo (migração 006).

Alinhamento: a mesma conta com a posição dos partidos nas votações da Câmara (SVD, tabela
partido_alinhamento). Acompanha a coalizão de governo e não é o viés ideológico.

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
SOMAS = ["votos", "votos_com_vies", "votos_x_vies", "votos_com_alinhamento", "votos_x_alinhamento"]

SQL = """
SELECT m.cd_municipio, m.nm_municipio, m.cd_ibge, v.ano, v.cod_cargo,
       v.votos, v.votos_com_vies, v.votos_x_vies, v.votos_com_alinhamento, v.votos_x_alinhamento
FROM vies_votos_cargo v
JOIN municipio m ON m.cd_municipio = v.cd_municipio
WHERE m.cd_uf = %(cd_uf)s AND v.ano = ANY(%(anos)s)
"""


def regioes() -> pd.DataFrame | None:
    if not REGIOES.exists():
        print(f"aviso: {REGIOES} não encontrado; o resultado sai sem regiões")
        return None
    df = pd.read_csv(REGIOES, sep=";", encoding="utf-8-sig", dtype={"cod_ibge": "Int64"})
    return df[["cod_ibge", "regiao_intermediaria"]].rename(columns={"cod_ibge": "cd_ibge"})


def agregar(df: pd.DataFrame, por: list[str]) -> pd.DataFrame:
    """Por recorte e ano: viés e alinhamento (cargos com peso igual), coberturas e número de cargos."""
    c = df.groupby([*por, "ano", "cod_cargo"])[SOMAS].sum()
    c["vies"] = c["votos_x_vies"] / c["votos_com_vies"].where(c["votos_com_vies"] > 0)
    c["alinhamento"] = c["votos_x_alinhamento"] / c["votos_com_alinhamento"].where(c["votos_com_alinhamento"] > 0)
    a = c.groupby([*por, "ano"]).agg(vies=("vies", "mean"), alinhamento=("alinhamento", "mean"),
                                     n_cargos=("votos", "size"), votos=("votos", "sum"),
                                     votos_com_vies=("votos_com_vies", "sum"),
                                     votos_com_alinhamento=("votos_com_alinhamento", "sum"))
    a["cobertura_vies"] = 100 * a["votos_com_vies"] / a["votos"]
    a["cobertura_alinhamento"] = 100 * a["votos_com_alinhamento"] / a["votos"]
    return a


def por_ano(a: pd.DataFrame, coluna: str) -> pd.DataFrame:
    return a[coluna].unstack("ano").reindex(columns=ANOS)


def fmt(x) -> str:
    return f"{x:+6.1f}" if pd.notna(x) else "     -"


def tabela(titulo: str, rotulo: str, df: pd.DataFrame, largura: int) -> list[str]:
    cab = f"  {rotulo:<{largura}}" + "".join(f"  {a:>6}" for a in ANOS)
    linhas = [titulo, cab, "  " + "-" * (len(cab) - 2)]
    for nome, r in df.iterrows():
        linhas.append(f"  {str(nome):<{largura}}" + "".join(f"  {fmt(r[a])}" for a in ANOS))
    return linhas + [""]


def gravar_banco(conn, cd_uf: int, mun: pd.DataFrame) -> None:
    def num(x):
        return None if pd.isna(x) else float(x)
    linhas = [(int(cd), int(ano), num(r.vies), round(float(r.cobertura_vies), 2), num(r.alinhamento),
               round(float(r.cobertura_alinhamento), 2), int(r.n_cargos))
              for (cd, ano), r in mun.iterrows()]
    with conn.cursor() as cur:
        cur.execute("""DELETE FROM vies_municipio v USING municipio m
                       WHERE m.cd_municipio = v.cd_municipio AND m.cd_uf = %s AND v.ano_eleitoral = ANY(%s)""",
                    (cd_uf, ANOS))
        execute_values(cur, """INSERT INTO vies_municipio (cd_municipio, ano_eleitoral, vies_calculado, cobertura_vies,
                                   alinhamento, cobertura_alinhamento, n_cargos) VALUES %s""", linhas)
    conn.commit()


def secao_uf(conn, sigla: str, cd_uf: int, reg: pd.DataFrame | None) -> list[str]:
    df = consultar(conn, SQL, {"cd_uf": cd_uf, "anos": ANOS})
    if df.empty:
        return [f"{'=' * 70}", f"UF: {sigla} — sem votação por partido no banco", ""]
    for c in SOMAS:
        df[c] = df[c].astype(float)
    gravar_banco(conn, cd_uf, agregar(df, ["cd_municipio"]))

    out = [f"{'=' * 70}", f"UF: {sigla}", f"{'=' * 70}", ""]
    estado = agregar(df.assign(uf=sigla), ["uf"])
    out += tabela("Estado: viés", "", por_ano(estado, "vies"), 4)
    out += tabela("Estado: alinhamento na Câmara (SVD; não é o viés)", "", por_ano(estado, "alinhamento"), 4)
    cob = estado.droplevel("uf")
    out += ["  Cobertura dos votos válidos (votos em partidos com valor):",
            "    viés:        " + ", ".join(f"{a}: {r.cobertura_vies:.2f}%" for a, r in cob.iterrows()),
            "    alinhamento: " + ", ".join(f"{a}: {r.cobertura_alinhamento:.2f}%" for a, r in cob.iterrows()), ""]

    if reg is not None:
        d = df.merge(reg, on="cd_ibge", how="left")
        d["regiao_intermediaria"] = d["regiao_intermediaria"].fillna("(sem região)")
        out += tabela("Regiões intermediárias (IBGE): viés", "Região",
                      por_ano(agregar(d, ["regiao_intermediaria"]), "vies"), 32)

    mun = por_ano(agregar(df, ["nm_municipio", "cd_municipio"]), "vies").droplevel("cd_municipio").sort_index()
    out += destaques(mun)
    out += tabela(f"Municípios ({len(mun)}): viés", "Município", mun, 32)
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

Viés do partido: média das notas de especialistas (Bolognesi et al., ondas de julho de 2018 e de 2022;
0 = extrema esquerda, 10 = extrema direita), na escala -100 a +100 por (média - 5) * 20.
Onda de cada eleição: 2018 e 2020 usam a onda 2018; 2022 e 2024, a onda 2022 (em 2024 a onda é
estendida por dois anos, o que os autores desaconselham). Renomeados herdam o valor; fundidos depois
da onda usam a média dos componentes (banco/referencia/sucessao_partidos.csv).

Viés do município no ano: em cada cargo, média do viés dos partidos ponderada pelos votos válidos
(nominais + legenda) do 1º turno; depois, média dos cargos com peso igual
(2018/2022: presidente, governador, senador, deputados; 2020/2024: prefeito e vereador).
Regiões e estado: a mesma conta sobre os votos de todos os seus municípios.

Alinhamento: a mesma conta com a posição de cada partido nas votações nominais do Plenário da Câmara
(SVD, janela que termina antes de cada eleição). Ele acompanha a coalizão de governo, não a ideologia:
o mesmo partido muda dezenas de pontos de um governo para outro.

Observações:
- Partidos sem viés ficam fora da média; a cobertura (parcela dos votos válidos em partidos com
  valor) aparece logo abaixo do estado.
- Com os cargos de peso igual, o voto duplo para o Senado em 2018 não pesa mais que os outros cargos.
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
