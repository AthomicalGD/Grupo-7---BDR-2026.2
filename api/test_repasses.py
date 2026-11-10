"""Confere a conta da P8 (conta_repasses) sem banco.

Uso (da pasta do projeto): python -m api.test_repasses
"""
from api.app import conta_repasses


def linha(i, eleito, fe=0.0, fp=0.0, pf=0.0, proprios=0.0, outros=0.0, votos=0):
    return {"id": i, "nome": f"C{i}", "partido": "X", "uf": "PI", "nm_municipio": None, "sq": i, "cd_municipio": None,
            "eleito": eleito, "fundo_eleitoral": fe, "fundo_partidario": fp, "pessoas_fisicas": pf,
            "proprios": proprios, "outros": outros, "votos": votos}


LINHAS = [
    linha(1, True, fe=100),                  # 100% público, R$ 100
    linha(2, False, fe=900, pf=100),         # 90%, R$ 900
    linha(3, True, fe=50, pf=150),           # 25%, R$ 50
    linha(4, False, pf=1000),                # 0%, sem repasse
    linha(5, True, proprios=500),            # 0%, sem repasse, eleito
    linha(6, False),                         # sem receita: fora da base
    linha(7, False, fe=300, fp=100),         # 100%, R$ 400
    linha(8, True, fe=1000, pf=1000),        # 50%, R$ 1.000
]


def test_faixas_de_parcela():
    d = conta_repasses(LINHAS, 5, 2022)
    assert d["resumo"]["candidatos"] == 8 and d["resumo"]["com_receita"] == 7
    assert d["resumo"]["sem_receita"]["candidatos"] == 1
    f = d["parcela"]["faixas"]
    assert [x["rotulo"] for x in f] == ["0% a 20%", "20% a 40%", "40% a 60%", "60% a 80%", "80% a 100%"]
    assert [x["candidatos"] for x in f] == [2, 1, 1, 0, 3]     # 100% entra na última faixa
    assert [x["eleitos"] for x in f] == [1, 1, 1, 0, 1]
    assert f[3]["taxa"] is None and f[0]["taxa"] == 50.0
    assert sum(x["candidatos"] for x in conta_repasses(LINHAS, 3, 2022)["parcela"]["faixas"]) == 7


def test_medias_e_extremos_da_parcela():
    p = conta_repasses(LINHAS, 5, 2022)["parcela"]
    assert p["media_eleitos"] == round((100 + 25 + 0 + 50) / 4, 2)
    assert p["media_nao_eleitos"] == round((90 + 0 + 100) / 3, 2)
    assert p["eleito_menor"]["id"] == 5 and p["eleito_menor"]["parcela"] == 0
    # dois perdedores com 100%: fica o de mais receita, e o outro é contado como empate
    assert p["nao_eleito_maior"]["id"] == 7 and p["nao_eleito_maior"]["empatados"] == 0
    assert conta_repasses(LINHAS + [linha(9, False, fe=10)], 5, 2022)["parcela"]["nao_eleito_maior"]["empatados"] == 1


def test_quartis_do_valor():
    v = conta_repasses(LINHAS, 5, 2022)["valor"]
    assert v["grupos"][0]["id"] == "zero" and v["grupos"][0]["candidatos"] == 2 and v["grupos"][0]["eleitos"] == 1
    quartis = v["grupos"][1:]
    assert v["quartis"] == 4 and [g["rotulo"] for g in quartis] == ["Q1", "Q2", "Q3", "Q4"]
    assert sum(g["candidatos"] for g in quartis) == 5           # 50, 100, 400, 900, 1000
    assert quartis[0]["de"] == 50 and quartis[-1]["ate"] == 1000
    assert v["media"] == round((100 + 900 + 50 + 0 + 0 + 400 + 1000) / 7, 2)
    assert v["media_receberam"] == round(2450 / 5, 2)
    assert v["eleito_menor"]["id"] == 5 and v["nao_eleito_maior"]["id"] == 2


def test_sem_ninguem():
    d = conta_repasses([linha(1, False)], 5, 2022)
    assert d["resumo"]["com_receita"] == 0 and d["valor"]["grupos"] == []
    assert d["parcela"]["eleito_menor"] is None and d["valor"]["media"] is None


if __name__ == "__main__":
    for nome, teste in list(globals().items()):
        if nome.startswith("test_"):
            teste()
            print("ok", nome)
