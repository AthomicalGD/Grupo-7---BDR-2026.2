"""Confere o leitor da planilha do IFDM (loader.ifdm) em planilhas montadas aqui, nos dois formatos que a Firjan
já usou: larga (um ano por coluna, cabeçalho mesclado, nota e ranking lado a lado, uma aba por área, código de
6 dígitos) e longa (uma coluna "Ano", código de 7 dígitos, sem o IFDM geral). Não precisa do banco.

Uso (da pasta do projeto): python -m loader.test_ifdm
"""
import tempfile
from pathlib import Path

import pandas as pd
from openpyxl import Workbook

from .ifdm import ler

MUNICIPIOS = {2211001: "Teresina", 2207702: "Parnaíba", 2927408: "Salvador"}
NOTA = {2211001: 0.7812, 2207702: 0.6543, 2927408: 0.7001}


def municipios_csv(pasta: Path) -> Path:
    # o leitor exige um número mínimo de municípios por aba: completa com códigos que não estão nas planilhas
    extras = [1100015 + 10 * i for i in range(200)]
    caminho = pasta / "municipios.csv"
    pd.DataFrame({"cod_ibge": [*MUNICIPIOS, *extras]}).to_csv(caminho, sep=";", index=False)
    return caminho


def linhas_extras():
    return [(1100015 + 10 * i, 0.5 + i / 1000) for i in range(200)]


def larga(pasta: Path) -> Path:
    wb = Workbook()
    wb.remove(wb.active)
    for aba, delta in (("IFDM", 0), ("Emprego & Renda", 0.01), ("Educação", 0.02), ("Saúde", 0.03)):
        ws = wb.create_sheet(aba)
        ws.append([f"Série histórica do IFDM - {aba}"])
        ws.append(["Código", "UF", "Município", 2013, None, 2023, None])
        ws.merge_cells("D2:E2")
        ws.merge_cells("F2:G2")
        ws.append([None, None, None, "Nota", "Ranking", "Nota", "Ranking"])
        for i, (cd, nome) in enumerate(MUNICIPIOS.items()):
            # Salvador sem índice em 2013: a Firjan põe "*" na nota e no ranking
            antes = ("*", "*") if cd == 2927408 else (NOTA[cd] + delta - 0.05, i + 1)
            ws.append([cd // 10, "PI", nome, *antes, NOTA[cd] + delta, i + 1])
        for cd, v in linhas_extras():
            ws.append([cd // 10, "RO", "x", v, 9, v, 9])
    caminho = pasta / "Serie-Historica-IFDM-larga.xlsx"
    wb.save(caminho)
    return caminho


def longa(pasta: Path) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = "Dados"
    ws.append(["Ano", "Cód. IBGE", "Município", "IFDM Emprego & Renda", "IFDM Educação", "IFDM Saúde", "Ranking"])
    for ano in (2018, 2023):
        for cd, nome in MUNICIPIOS.items():
            ws.append([ano, cd, nome, f"{NOTA[cd]:.4f}".replace(".", ","), NOTA[cd] + 0.1, NOTA[cd] - 0.1, 3])
        for cd, v in linhas_extras():
            ws.append([ano, cd, "x", v, v, v, 7])
    caminho = pasta / "IFDM-longa.xlsx"
    wb.save(caminho)
    return caminho


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp)
        mun = municipios_csv(pasta)

        v = ler(larga(pasta), mun)
        assert v[(2211001, 2023)] == {"ifdm": 0.7812, "emprego_renda": 0.7912, "educacao": 0.8012, "saude": 0.8112}, v[(2211001, 2023)]
        assert abs(v[(2207702, 2013)]["ifdm"] - 0.6043) < 1e-9
        assert {ano for _, ano in v} == {2013, 2023}
        assert not any(x.get("_calculado") for x in v.values())
        assert (2927408, 2013) not in v and v[(2927408, 2023)]["ifdm"] == 0.7001
        assert all(n == n for x in v.values() for n in x.values()), "NaN no lugar de nota vazia"

        v = ler(longa(pasta), mun)
        t = v[(2211001, 2018)]
        assert (t["emprego_renda"], t["educacao"], t["saude"]) == (0.7812, 0.8812, 0.6812), t
        assert t["ifdm"] == round((0.7812 + 0.8812 + 0.6812) / 3, 4) and t["_calculado"]
        assert {ano for _, ano in v} == {2018, 2023}
    print("ok: loader.ifdm lê as planilhas larga e longa")


if __name__ == "__main__":
    main()
