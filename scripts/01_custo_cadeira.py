"""P1) Quanto custa uma cadeira?

Custo da cadeira = despesa contratada de todos os candidatos ao cargo ÷ cadeiras preenchidas
(eleitos). Mede quanto a disputa inteira gastou por vaga; ao lado, quanto gastou o eleito típico
(mediana) e o não eleito típico.

Contas por candidatura na view campanha (banco/migracoes/011_custo_da_cadeira.sql): despesa
contratada sem as doações a outras campanhas (seriam contadas duas vezes). Valores também em
reais de outubro de 2024, pelo IPCA de outubro de cada ano (IBGE, SIDRA 1737).

Uso: python scripts/01_custo_cadeira.py [UF ...]   (sem UF: todas as carregadas)
Saída: respostas/01_custo_cadeira.txt
"""
import sys

import pandas as pd

from comum import conectar, consultar, escolher_ufs, gravar_txt

CARGOS = {6: "Deputado Federal", 7: "Deputado Estadual", 5: "Senador", 3: "Governador",
          11: "Prefeito", 13: "Vereador"}
MUNICIPAIS = {11, 13}

SQL = """
SELECT e.ano, e.cod_cargo, e.cd_municipio, c.despesa::float AS despesa,
       c.despesa::float * (SELECT indice FROM ipca_outubro WHERE ano = 2024) / i.indice AS despesa_2024,
       ma.id_mandato IS NOT NULL AS eleito
FROM campanha c
JOIN politico_eleicao pe ON pe.id_politico_eleicao = c.id_politico_eleicao
JOIN eleicao e           ON e.id_eleicao = pe.id_eleicao
JOIN ipca_outubro i      ON i.ano = e.ano
LEFT JOIN municipio m    ON m.cd_municipio = e.cd_municipio
LEFT JOIN mandato ma     ON ma.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.tipo <> 1 AND e.cod_cargo = ANY(%(cargos)s) AND COALESCE(m.cd_uf, e.cd_uf) = %(cd_uf)s
"""


def reais(v: float) -> str:
    if pd.isna(v):
        return "-"
    if v >= 1e6:
        return f"R$ {v / 1e6:,.2f} mi".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {v:,.0f}".replace(",", ".")


def inteiro(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def linha_ano(d: pd.DataFrame) -> dict:
    eleitos = d[d["eleito"]]
    n = len(eleitos)
    return {"candidatos": len(d), "cadeiras": n, "total": d["despesa"].sum(),
            "custo": d["despesa"].sum() / n if n else float("nan"),
            "custo_2024": d["despesa_2024"].sum() / n if n else float("nan"),
            "med_eleito": eleitos["despesa"].median(), "med_nao": d.loc[~d["eleito"], "despesa"].median()}


def secao_cargo(d: pd.DataFrame, cargo: int) -> list[str]:
    cab = (f"  {'Ano':>4}  {'Candidatos':>10}  {'Cadeiras':>8}  {'Gasto total':>16}  {'Custo da cadeira':>16}"
           f"  {'Em R$ de 2024':>15}  {'Eleito (mediana)':>16}  {'Não eleito (med.)':>17}")
    out = [CARGOS[cargo], cab, "  " + "-" * (len(cab) - 2)]
    anos = {}
    for ano, g in d.groupby("ano"):
        r = anos[ano] = linha_ano(g)
        out.append(f"  {ano:>4}  {inteiro(r['candidatos']):>10}  {inteiro(r['cadeiras']):>8}  {reais(r['total']):>16}"
                   f"  {reais(r['custo']):>16}  {reais(r['custo_2024']):>15}  {reais(r['med_eleito']):>16}"
                   f"  {reais(r['med_nao']):>17}")
    if len(anos) == 2:
        a, b = sorted(anos)
        real = anos[b]["custo_2024"] / anos[a]["custo_2024"] - 1
        out.append(f"  De {a} para {b}, já descontada a inflação: {real:+.0%}.")
    if cargo in MUNICIPAIS:
        for ano, g in d.groupby("ano"):
            mun = g.groupby("cd_municipio").apply(lambda x: linha_ano(x)["custo"], include_groups=False).dropna()
            out.append(f"  {ano}, por município: mediana {reais(mun.median())}; "
                       f"mais barato {reais(mun.min())}; mais caro {reais(mun.max())}.")
    return out + [""]


CABECALHO = """\
P1) Quanto custa uma cadeira?
Custo da cadeira = soma da despesa contratada de todos os candidatos ao cargo ÷ cadeiras
preenchidas. Mostra quanto a disputa inteira gastou para preencher cada vaga.

Colunas: Gasto total = despesa de todos os candidatos; Custo da cadeira = Gasto total ÷ Cadeiras
(em reais da época e em reais de outubro de 2024, pelo IPCA); Eleito / Não eleito = despesa
mediana de cada grupo.

Observações:
- Despesa contratada declarada ao TSE, sem "Doações financeiras a outros candidatos/partidos"
  (o dinheiro reaparece como despesa de quem recebeu).
- Prefeito e vereador: o custo da UF soma todos os municípios; ao lado, a distribuição do
  custo da cadeira entre os municípios.
- Excluídos: eleições suplementares, Presidente (disputa nacional), vices e suplentes
  (R$ 0,2 mi em quatro eleições).
"""


def main(argv: list[str]) -> None:
    with conectar() as conn:
        ufs = escolher_ufs(conn, argv)
        texto = [CABECALHO]
        for sigla, cd_uf in ufs:
            df = consultar(conn, SQL, {"cargos": list(CARGOS), "cd_uf": cd_uf})
            texto += ["=" * 112, f"UF: {sigla}", "=" * 112, ""]
            for cargo in CARGOS:
                d = df[df["cod_cargo"] == cargo]
                if not d.empty:
                    texto += secao_cargo(d, cargo)
    caminho = gravar_txt("01_custo_cadeira.txt", "\n".join(texto))
    print(f"gravado: {caminho}")


if __name__ == "__main__":
    main(sys.argv[1:])
