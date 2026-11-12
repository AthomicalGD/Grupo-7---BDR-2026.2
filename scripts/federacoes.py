"""Gera api/federacoes.json: quais partidos formaram cada federação (2022 em diante) e cada coligação proporcional (2018).

    python scripts/federacoes.py

Lê os consulta_cand_<ano>_BRASIL.csv do TSE (python -m crawler) e guarda só a composição, que é pequena:
  federacoes[ano]  = [{"nome": "Brasil da Esperança", "membros": ["PT", "PC DO B", "PV"]}, ...]   (valem no país todo)
  coligacoes[ano]  = {"UF|cargo": [["PT", "PC DO B", "PROS"], ...]}   (cada UF e cargo tem as suas; só 2018 tem)
A API usa isso para dizer, na Legenda, com quem cada partido somou votos. Siglas em maiúsculas, como em partido.sigla.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CARGOS = {"DEPUTADO FEDERAL": 6, "DEPUTADO ESTADUAL": 7, "DEPUTADO DISTRITAL": 7}
NULOS = {"", "#NULO", "#NULO#", "#NE", "#NE#"}


def siglas(composicao: str) -> list[str]:
    """"13-PT/65-PC do B/43-PV" ou "PT / PC do B / PV" -> ["PT", "PC DO B", "PV"]."""
    saida = []
    for parte in re.split(r"\s*[/;,]\s*", composicao.strip()):
        parte = re.sub(r"^\d+\s*-\s*", "", parte.strip()).upper()
        if parte and parte not in saida:
            saida.append(parte)
    return saida


def nome_bonito(nm: str, membros: list[str]) -> str:
    """"FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL" -> "Brasil da Esperança" (siglas curtas dos membros ficam em maiúsculas)."""
    nm = re.sub(r"(?i)^federa[cç][aã]o\s+", "", nm.strip())
    nm = re.sub(r"\s*-\s*FE BRASIL$", "", nm, flags=re.I)
    palavras = []
    for w in nm.split():
        if w.upper() in membros and len(w) <= 4:
            palavras.append(w.upper())
        else:
            palavras.append(w.lower() if w.lower() in ("da", "de", "do") else w.capitalize())
    return " ".join(palavras)


def ler(ano: int):
    arquivo = RAIZ / "dados" / "tse" / "candidatos" / str(ano) / f"consulta_cand_{ano}_BRASIL.csv"
    with open(arquivo, encoding="latin-1", newline="") as f:
        yield from csv.DictReader(f, delimiter=";")


def main() -> None:
    federacoes: dict[str, list[dict]] = {}
    coligacoes: dict[str, dict[str, list[list[str]]]] = {}
    for ano in (2018, 2022, 2024, 2026):
        vistos: dict[frozenset, dict] = {}
        colig: dict[str, set[tuple[str, ...]]] = {}
        for r in ler(ano):
            comp = (r.get("DS_COMPOSICAO_FEDERACAO") or "").strip()
            if ano >= 2022 and comp not in NULOS:
                membros = siglas(comp)
                if len(membros) > 1:
                    vistos.setdefault(frozenset(membros), {"nome": nome_bonito(r.get("NM_FEDERACAO", ""), membros), "membros": membros})
            cargo = CARGOS.get((r.get("DS_CARGO") or "").strip().upper())
            comp = (r.get("DS_COMPOSICAO_COLIGACAO") or "").strip()
            if ano == 2018 and cargo and comp not in NULOS:
                membros = siglas(comp)
                if len(membros) > 1:
                    colig.setdefault(f"{r['SG_UF']}|{cargo}", set()).add(tuple(membros))
        if vistos:
            federacoes[str(ano)] = sorted(vistos.values(), key=lambda x: x["membros"])
        if colig:
            coligacoes[str(ano)] = {k: [list(t) for t in sorted(v)] for k, v in sorted(colig.items())}
        print(ano, "federações:", len(vistos), "| coligações proporcionais (UF e cargo):", len(colig))
    saida = RAIZ / "api" / "federacoes.json"
    saida.write_text(json.dumps({"federacoes": federacoes, "coligacoes": coligacoes}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("gravado:", saida.relative_to(RAIZ), f"({saida.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
