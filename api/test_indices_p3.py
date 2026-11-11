"""Confere o porte dos municípios pela população e a ordem dos rankings da P3 (sem banco).

Uso (da pasta do projeto): python -m api.test_indices_p3
"""
from api.app import _ranking, porte_de


def test_porte_pela_populacao():
    assert [porte_de(n) for n in (1, 49_999, 50_000, 75_000, 100_000, 100_001, 12_000_000)] == \
        ["pequeno", "pequeno", "medio", "medio", "medio", "grande", "grande"]


def test_ranking_menor_melhor():
    prefeitos = {1: "A", 2: "A", 3: "B", 4: "C"}
    valores = {1: 10.0, 2: 20.0, 3: 5.0, 4: 30.0}           # A: 15, B: 5, C: 30
    assert [l["sigla"] for l in _ranking(prefeitos, valores)] == ["C", "A", "B"]
    assert [l["sigla"] for l in _ranking(prefeitos, valores, menor_melhor=True)] == ["B", "A", "C"]
    pop = {1: 100, 2: 50, 3: 10}
    assert {l["sigla"]: l["populacao"] for l in _ranking(prefeitos, valores, pop)} == {"A": 150, "B": 10, "C": None}


if __name__ == "__main__":
    for nome, teste in list(globals().items()):
        if nome.startswith("test_"):
            teste()
            print("ok", nome)
