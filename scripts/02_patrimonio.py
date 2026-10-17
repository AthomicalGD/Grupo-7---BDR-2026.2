"""P2) Qual a taxa de sucesso eleitoral por patrimônio declarado?

Soma os bens de cada candidatura apta e compara a proporção de eleitos em quatro
faixas (quartis) de patrimônio positivo, calculadas separadamente por ano e cargo.
Ausência de bens no TSE não é patrimônio zero: aparece em grupo próprio, fora dos
quartis. Usa somente as UFs carregadas no banco, excluindo vices, suplentes e
eleições suplementares.

Uso: python scripts/02_patrimonio.py [UF ...]   (sem UF: todas as carregadas)
Saída: respostas/02_patrimonio.txt
"""
import sys

import pandas as pd

from comum import conectar, consultar, escolher_ufs, gravar_txt

CARGOS = {3: "Governador", 5: "Senador", 6: "Deputado Federal", 7: "Deputado Estadual",
          11: "Prefeito", 13: "Vereador"}
ANOS = (2018, 2020, 2022, 2024)

SQL = """
WITH patrimonio AS (
    SELECT id_politico_eleicao, sum(vr_bem_candidato) AS total
    FROM bem
    GROUP BY id_politico_eleicao
)
SELECT e.ano, e.cod_cargo, b.total::double precision AS patrimonio,
       ma.id_mandato IS NOT NULL AS eleito
FROM politico_eleicao pe
JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
LEFT JOIN municipio mu ON mu.cd_municipio = e.cd_municipio
LEFT JOIN patrimonio b ON b.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.ano = ANY(%(anos)s) AND e.tipo = 2 AND e.turno = 1
  AND e.cod_cargo = ANY(%(cargos)s)
  AND pe.ds_sit_tot_turno IS NOT NULL
  AND COALESCE(mu.cd_uf, e.cd_uf) = ANY(%(ufs)s)
"""


def inteiro(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def reais(valor: float) -> str:
    return "R$ " + f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def linha(rotulo: str, d: pd.DataFrame) -> str:
    total = len(d)
    eleitos = int(d["eleito"].sum())
    return f"  {rotulo:<43} {inteiro(total):>11} {inteiro(eleitos):>9} {100 * eleitos / total:>6.1f}%"


def faixas_positivas(d: pd.DataFrame) -> list[tuple[str, pd.DataFrame]]:
    """Quartis de valores positivos; empates no corte ficam na mesma faixa.

    Quando há valores repetidos nos cortes, qcut elimina cortes duplicados em vez
    de separar candidaturas com patrimônio idêntico só para forçar quatro grupos.
    """
    if d.empty:
        return []
    if d["patrimonio"].nunique() == 1:
        return [(f"Faixa única: {reais(d['patrimonio'].iloc[0])}", d)]
    categorias = pd.qcut(d["patrimonio"], q=4, duplicates="drop")
    partes = []
    for i, intervalo in enumerate(categorias.cat.categories, 1):
        grupo = d.loc[categorias == intervalo]
        if not grupo.empty:
            partes.append((grupo, i))
    numero = len(partes)
    return [(f"{'Q' + str(i) if numero == 4 else 'Faixa ' + str(i) + '/' + str(numero)}: "
             f"{reais(grupo['patrimonio'].min())} a {reais(grupo['patrimonio'].max())}", grupo)
            for grupo, i in partes]


def secao(d: pd.DataFrame, ano: int, cargo: int) -> list[str]:
    faltantes = d[d["patrimonio"].isna()]
    zero = d[d["patrimonio"].eq(0)]
    positivos = d[d["patrimonio"].gt(0)]
    cobertura = 100 * (len(d) - len(faltantes)) / len(d)
    out = [f"{ano} · {CARGOS[cargo]} — {inteiro(len(d))} candidaturas aptas, "
           f"{inteiro(int(d['eleito'].sum()))} eleitos; bens informados: {cobertura:.1f}%",
           f"  {'Faixa patrimonial':<43} {'Candidatos':>11} {'Eleitos':>9} {'Taxa':>7}",
           "  " + "-" * 75]
    if not faltantes.empty:
        out.append(linha("Sem registro de bens", faltantes))
    if not zero.empty:
        out.append(linha("Total declarado igual a zero", zero))
    faixas = faixas_positivas(positivos)
    for rotulo, grupo in faixas:
        out.append(linha(rotulo, grupo))
    if len(faixas) >= 2:
        primeira, ultima = faixas[0][1], faixas[-1][1]
        dif = 100 * (ultima["eleito"].mean() - primeira["eleito"].mean())
        out.append(f"  Maior faixa menos menor faixa: {dif:+.1f} p.p.")
    if 0 < len(faixas) < 4:
        out.append("  Menos de quatro faixas distintas: patrimônios repetidos nos cortes.")
    return out + [""]


def relatorio(df: pd.DataFrame, ufs: list[str]) -> str:
    if df.empty:
        raise ValueError("Nenhuma candidatura apta encontrada nas UFs selecionadas.")
    if df["patrimonio"].lt(0).any():
        raise ValueError("Há patrimônios negativos; verificar os registros antes de calcular as faixas.")
    grupos = list(df.groupby(["ano", "cod_cargo"], sort=True))
    comparacoes = []
    for _, grupo in grupos:
        faixas = faixas_positivas(grupo[grupo["patrimonio"].gt(0)])
        if len(faixas) == 4:
            comparacoes.append(faixas[-1][1]["eleito"].mean() > faixas[0][1]["eleito"].mean())
    faltantes = int(df["patrimonio"].isna().sum())
    out = ["P2) Qual a taxa de sucesso eleitoral por patrimônio declarado?", "",
           f"Abrangência: {', '.join(ufs)} (UFs carregadas, não o Brasil inteiro).",
           f"Síntese: em {sum(comparacoes)} de {len(comparacoes)} recortes ano/cargo com quatro quartis, "
           "a taxa de eleição do quartil de maior patrimônio supera a do menor.",
           f"Cobertura: {inteiro(faltantes)} de {inteiro(len(df))} candidaturas aptas "
           f"({100 * faltantes / len(df):.1f}%) não têm bens registrados.",
           "Fonte: TSE, candidaturas e bens declarados; eleições ordinárias de 2018, 2020, 2022 e 2024.",
           "Taxa = candidaturas eleitas / candidaturas aptas em cada faixa, por ano e cargo.",
           "Patrimônio = soma dos bens registrados para a candidatura; não é receita de campanha.",
           "Quartis calculados só entre valores positivos de cada ano/cargo; empates não são separados.",
           "Sem registro de bens ≠ patrimônio declarado igual a zero: ambos ficam fora dos quartis.",
           "A situação de eleição considera o resultado final, inclusive o 2º turno, sem duplicar a candidatura.",
           "Vices, suplentes, presidente e eleições suplementares não entram na análise.",
           "Valores de cada faixa são nominais do ano da eleição; taxas não precisam de correção pelo IPCA.",
           "As diferenças são associações observadas, não efeito causal do patrimônio sobre a eleição.", ""]
    for (ano, cargo), grupo in grupos:
        out.extend(secao(grupo, int(ano), int(cargo)))
    return "\n".join(out)


def main(argv: list[str]) -> None:
    with conectar() as conn:
        ufs = escolher_ufs(conn, argv)
        if not ufs:
            raise SystemExit("Nenhuma UF carregada no banco.")
        df = consultar(conn, SQL, {"anos": list(ANOS), "cargos": list(CARGOS),
                                 "ufs": [codigo for _, codigo in ufs]})
    caminho = gravar_txt("02_patrimonio.txt", relatorio(df, [sigla for sigla, _ in ufs]))
    print(f"gravado: {caminho}")


if __name__ == "__main__":
    main(sys.argv[1:])
