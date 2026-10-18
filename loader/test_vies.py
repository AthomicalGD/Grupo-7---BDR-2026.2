"""Confere o viés dos partidos (loader.vies) contra o artigo, os exemplos do plano e o banco.

Uso (da pasta do projeto): python -m loader.test_vies [--sem-banco]
Sem banco, confere só a Tabela 1 e as regras de sucessão.
"""
import csv
import os
import sys

from loader import vies

TABELA1 = vies.REFERENCIA / "tabela1_artigo.csv"


def tabela1(medias, suc) -> None:
    """Coluna 2022 = média da onda 2022; coluna 2018 = onda 2018 com as fusões até 2022 (como o artigo faz)."""
    onda18, onda22 = vies.fonte_artigo(medias, 2018), vies.fonte_artigo(medias, 2022)
    with open(TABELA1, encoding="utf-8", newline="") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))
    assert len(linhas) == 32, len(linhas)
    for linha in linhas:
        sigla = linha["partido"]
        v22, _ = vies.resolver(onda22, vies.Sucessao(), sigla, 2022)
        assert vies.duas_casas(v22) == float(linha["media_2022"]), (sigla, v22, linha)
        v18, origem = vies.resolver(onda18, suc, sigla, 2022)
        if linha["media_2018"]:
            assert v18 is not None and vies.duas_casas(v18) == float(linha["media_2018"]), (sigla, v18, origem, linha)
        else:
            assert v18 is None, (sigla, v18, origem)
    print(f"ok  Tabela 1 do artigo reproduzida ({len(linhas)} partidos, ondas 2018 e 2022)")


def exemplos(medias, suc) -> None:
    """Exemplos do plano e casos que as migrações antigas resolviam errado."""
    casos = [  # (sigla, eleição, média esperada, viés esperado ou None, origem contém)
        ("PRD", 2024, 8.16, 63.2, "média de PTB e PATRI (fusão de 2023)"),
        ("PODE", 2024, 7.93, 58.5, "média de PODE e PSC (fusão de 2023)"),
        ("SOLIDARIEDADE", 2024, 6.73, 34.6, "média de SOLIDARIEDADE e PROS (fusão de 2023)"),
        ("PSL", 2018, 8.11, 62.2, "direto"),            # antes herdava o valor do PL
        ("PSL", 2020, 8.11, 62.2, "direto"),
        ("UNIÃO", 2022, 8.49, 69.8, "direto"),          # a onda 2022 já mediu o UNIÃO
        ("UNIÃO", 2024, 8.49, 69.8, "direto"),
        ("PC DO B", 2020, 4.60, None, "média de PCDOB e PPL (fusão de 2019)"),
        ("PODE", 2020, 7.10, None, "média de PODE e PHS (fusão de 2019)"),
        ("PATRIOTA", 2020, 8.08, None, "média de PATRI e PRP (fusão de 2019)"),
        ("REPUBLICANOS", 2020, 7.78, None, "renomeado de PRB"),
        ("PL", 2020, 7.78, None, "renomeado de PR"),
        ("MOBILIZA", 2024, 6.74, None, "renomeado de PMN"),
        ("AGIR", 2024, 7.55, None, "direto"),
        ("PT", 2024, 2.68, -46.4, "direto"),
    ]
    for sigla, ano, media, escala, trecho in casos:
        onda = 2018 if ano <= 2020 else 2022
        v, origem = vies.resolver(vies.fonte_artigo(medias, onda), suc, sigla, ano)
        assert v is not None and vies.duas_casas(v) == media, (sigla, ano, v, origem)
        if escala is not None:
            assert round(vies.escala(v), 1) == escala, (sigla, ano, vies.escala(v))
        assert trecho in origem, (sigla, ano, origem)
    for sigla, ano in [("UP", 2020), ("PCA1", 2018)]:   # UP só existe a partir de 2019; PCA* é o cargo 25
        v, origem = vies.resolver(vies.fonte_artigo(medias, 2018), suc, sigla, ano)
        assert v is None and origem == "sem valor", (sigla, v, origem)
    print(f"ok  regras de sucessão ({len(casos) + 2} casos, inclusive os exemplos do plano)")


def alinhamento(suc) -> None:
    """No SVD, a fusão posterior ao início da janela usa os componentes: UNIÃO em 2022 = DEM + PSL."""
    svd, _ = vies.fontes_svd("eleicao_2022", 2019)
    v, origem = vies.resolver(svd, suc, "UNIÃO", 2022)
    assert origem.startswith("média de DEM e PSL"), origem
    assert abs(v - (svd.valores["DEM"] + svd.valores["PSL"]) / 2) < 1e-9
    svd24, _ = vies.fontes_svd("eleicao_2024", 2023)
    v, origem = vies.resolver(svd24, suc, "PRD", 2024)   # na janela os deputados do PRD contam como PATRI (moda)
    assert v == svd24.valores["PATRI"] and "sem valor: PTB" in origem, (v, origem)
    print("ok  alinhamento: fusões dentro da janela do SVD")


def banco() -> None:
    import psycopg2
    url = os.environ.get("DATABASE_URL", vies.BANCO_PADRAO)
    with psycopg2.connect(url) as conn, conn.cursor() as cur:
        cur.execute(vies.SQL_COBERTURA)
        cobertura = {a: (float(art), float(s)) for a, art, s in cur.fetchall()}
        assert set(cobertura) == {2018, 2020, 2022, 2024}, cobertura
        for ano, (art, _) in cobertura.items():
            assert art >= (96 if ano == 2024 else 99.9), (ano, art)
        cur.execute("SELECT count(*) FROM partido WHERE vies_politico = 0")
        assert cur.fetchone()[0] == 0, "vies_politico = 0 usado como desconhecido"
        cur.execute("SELECT count(*) FROM vies_partido_onda WHERE media IS NULL AND origem <> 'sem valor'")
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT vies_politico FROM partido WHERE numero = 17 AND sigla = 'PSL'")
        psl = cur.fetchone()
        assert psl is None or round(psl[0], 1) == 62.2, psl
    print(f"ok  banco: cobertura do artigo {vies.resumo([(a, *c) for a, c in sorted(cobertura.items())])}")


def main() -> None:
    suc = vies.Sucessao()
    medias = vies.medias_artigo(vies.RAIZ / "dados")
    tabela1(medias, suc)
    exemplos(medias, suc)
    alinhamento(suc)
    if "--sem-banco" not in sys.argv:
        banco()
    print("Tudo certo.")


if __name__ == "__main__":
    main()
