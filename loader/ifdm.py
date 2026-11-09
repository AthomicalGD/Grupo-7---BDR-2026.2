"""IFDM (Índice Firjan de Desenvolvimento Municipal), série histórica, no banco: python -m loader.ifdm [opções]

A Firjan publica a série numa planilha só, refeita a cada edição (a de 2025 revisou o método e cobre 2013 a 2023).
O site barra download automático, então o arquivo é baixado pelo navegador e posto em dados/firjan/:

    https://www.firjan.com.br/ifdm/downloads/  ->  "Série Histórica IFDM 2013 a 2023" (.xlsx)

A planilha não tem um formato documentado e já mudou entre edições. O leitor não depende de nomes exatos de
colunas: em cada aba, acha a coluna do código IBGE (a que tem milhares de códigos de município), o ano e a área
de cada coluna pelos cabeçalhos acima dos dados (também em células mescladas) e, entre as colunas de um mesmo ano
e área, a da nota (de 0 a 1, com casas decimais; os rankings são inteiros). Serve tanto para a planilha larga
(um ano por coluna) quanto para a longa (uma coluna "Ano"). O que foi achado sai na tela; com --simular, nada é
gravado.

Áreas: ifdm (geral), emprego_renda, educacao e saude. Sem a coluna do geral, ele é a média simples das três áreas,
que é como a Firjan o calcula. A tabela ifdm_municipio (migração 020) é apagada e regravada inteira.
Depois de carregar, reinicie a API.
"""
import argparse
import os
import re
import sys
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from .__main__ import BANCO_PADRAO, RAIZ_PADRAO, _duracao

AREAS = ("ifdm", "emprego_renda", "educacao", "saude")
PAGINA = "https://www.firjan.com.br/ifdm/downloads/"
ANOS_VALIDOS = range(2005, 2031)
MIN_CODIGOS = 100   # uma aba com menos códigos de município que isso não é de dados


def _normal(x) -> str:
    s = "" if x is None or (isinstance(x, float) and pd.isna(x)) else str(x)
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def area_de(texto: str) -> str | None:
    """A área que um cabeçalho nomeia. As três áreas antes do geral: "IFDM Educação" é educação."""
    t = _normal(texto)
    if "emprego" in t or "renda" in t:
        return "emprego_renda"
    if "educa" in t:
        return "educacao"
    if "saude" in t:
        return "saude"
    if "ifdm" in t or "geral" in t or "consolidado" in t:
        return "ifdm"
    return None


def ano_de(texto: str) -> int | None:
    achados = [int(a) for a in re.findall(r"(?<!\d)(20\d\d)(?!\d)", _normal(texto)) if int(a) in ANOS_VALIDOS]
    return achados[-1] if achados else None


def _codigo(x, validos7: set[int], por6: dict[int, int]) -> int | None:
    """Código IBGE de 7 dígitos, a partir de 7 ou de 6 (sem o dígito verificador, como a Firjan publicava)."""
    try:
        n = int(float(str(x).strip()))
    except (TypeError, ValueError):
        return None
    if n in validos7:
        return n
    return por6.get(n)


def _nota(x) -> float | None:
    """Nota de 0 a 1; aceita vírgula decimal. Fora disso (ranking, texto, vazio), None."""
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    try:
        v = float(str(x).strip().replace(",", "."))
    except ValueError:
        return None
    return v if 0 <= v <= 1 else None


def _notas(coluna: pd.Series) -> list[float | None]:
    """As notas da coluna, com None onde não há (o Series.map viraria o None em NaN e ele passaria por nota).
    A Firjan marca com "*" o município sem índice no ano."""
    return [_nota(x) for x in coluna]


def _eh_nota(valores: pd.Series) -> bool:
    """A coluna é de notas: quase tudo entre 0 e 1 e com casas decimais (um ranking é inteiro e passa de 1)."""
    notas = valores.map(_nota).dropna()
    preenchidos = valores.map(lambda x: _normal(x) != "").sum()
    return len(notas) >= MIN_CODIGOS and len(notas) >= 0.9 * preenchidos and (notas % 1 != 0).mean() > 0.5


def ler_aba(nome: str, bruto: pd.DataFrame, validos7: set[int], por6: dict[int, int]) -> tuple[dict, list[str]]:
    """{(cd_ibge, ano): {área: nota}} de uma aba e o que foi achado nela (para a tela)."""
    codigos = bruto.apply(lambda col: col.map(lambda x: _codigo(x, validos7, por6)))
    contagem = codigos.notna().sum()
    if contagem.max() < MIN_CODIGOS:
        return {}, []
    col_cod = contagem.idxmax()
    inicio = int(codigos[col_cod].first_valid_index())
    dados = bruto.iloc[inicio:]
    cods = codigos[col_cod].iloc[inicio:]
    # cabeçalho: as linhas acima dos dados, com as células mescladas preenchidas para a direita; o título da aba
    # entra por último (só vale se a coluna não disser a área)
    cab = bruto.iloc[:inicio].map(_normal)
    cab = cab.mask(cab == "").ffill(axis=1)

    def acima(col, f):
        for i in range(len(cab) - 1, -1, -1):   # da linha mais perto dos dados para cima
            v = cab.iat[i, col]
            achado = f(v) if isinstance(v, str) else None
            if achado:
                return achado
        return f(nome)

    saida: dict = defaultdict(dict)
    achados = []
    col_ano = next((c for c in range(bruto.shape[1]) if c != col_cod
                    and any(_normal(v) == "ano" for v in bruto.iloc[:inicio, c])), None)
    if col_ano is not None:   # planilha longa: uma linha por município e ano
        anos = dados.iloc[:, col_ano].map(lambda x: ano_de(str(x).split(".")[0]))
        for c in range(bruto.shape[1]):
            area = acima(c, area_de) if c not in (col_cod, col_ano) else None
            if not area or not _eh_nota(dados.iloc[:, c]):
                continue
            n = 0
            for cd, ano, v in zip(cods, anos, _notas(dados.iloc[:, c])):
                if cd is not None and ano is not None and v is not None:
                    saida[(int(cd), ano)].setdefault(area, v)
                    n += 1
            achados.append(f"{area} (coluna {c + 1}, {n:,} valores)")
        return saida, achados

    escolhidas: dict[tuple[int, str], int] = {}   # planilha larga: (ano, área) -> coluna da nota
    for c in range(bruto.shape[1]):
        if c == col_cod:
            continue
        ano, area = acima(c, ano_de), acima(c, area_de)
        if ano and area and (ano, area) not in escolhidas and _eh_nota(dados.iloc[:, c]):
            escolhidas[(ano, area)] = c
    for (ano, area), c in sorted(escolhidas.items()):
        for cd, v in zip(cods, _notas(dados.iloc[:, c])):
            if cd is not None and v is not None:
                saida[(int(cd), ano)].setdefault(area, v)
    por_area = defaultdict(list)
    for ano, area in escolhidas:
        por_area[area].append(ano)
    achados = [f"{a}: {min(anos)}-{max(anos)} ({len(anos)} anos)" for a, anos in sorted(por_area.items())]
    return saida, achados


def ler(arquivo: Path, municipios: Path) -> dict:
    ibge = pd.read_csv(municipios, sep=";", encoding="utf-8-sig", usecols=["cod_ibge"])["cod_ibge"].astype(int)
    validos7 = set(ibge)
    por6 = {c // 10: c for c in validos7}
    abas = pd.read_excel(arquivo, sheet_name=None, header=None, dtype=object)
    tudo: dict = defaultdict(dict)
    for nome, bruto in abas.items():
        valores, achados = ler_aba(nome, bruto, validos7, por6)
        print(f"  aba {nome!r}: " + ("; ".join(achados) if achados else "sem dados de município"))
        for chave, areas in valores.items():
            for area, v in areas.items():
                tudo[chave].setdefault(area, v)
    for areas in tudo.values():
        partes = [areas.get(a) for a in AREAS[1:]]
        if "ifdm" not in areas and all(p is not None for p in partes):
            areas["ifdm"] = round(sum(partes) / 3, 4)
            areas["_calculado"] = True
    return tudo


def achar_arquivo(raiz: Path) -> Path | None:
    pasta = raiz / "firjan"
    candidatos = sorted((p for p in pasta.glob("*.xlsx") if "ifdm" in p.name.lower() and not p.name.startswith("~$")),
                        key=lambda p: p.stat().st_mtime) if pasta.exists() else []
    return candidatos[-1] if candidatos else None


def _argumentos(argv):
    p = argparse.ArgumentParser(prog="python -m loader.ifdm", description="Carrega o IFDM da Firjan em ifdm_municipio.")
    p.add_argument("--arquivo", type=Path, help="a planilha (padrão: a .xlsx mais recente com IFDM no nome em dados/firjan/)")
    p.add_argument("--dados", type=Path, default=RAIZ_PADRAO, help="pasta com os dados (padrão: ./dados)")
    p.add_argument("--banco", default=os.environ.get("DATABASE_URL", BANCO_PADRAO),
                   help="URL de conexão (padrão: $DATABASE_URL ou o banco do docker-compose.yml)")
    p.add_argument("--simular", action="store_true", help="só lê a planilha e mostra o que achou, sem gravar")
    return p.parse_args(argv)


def main(argv=None) -> None:
    a = _argumentos(argv)
    inicio = time.monotonic()
    arquivo = a.arquivo or achar_arquivo(a.dados)
    if arquivo is None or not arquivo.exists():
        sys.exit(f"Planilha do IFDM não encontrada em {a.dados / 'firjan'}.\n"
                 f"Baixe \"Série Histórica IFDM 2013 a 2023\" pelo navegador em {PAGINA} e salve a .xlsx nessa pasta\n"
                 "(o site da Firjan não deixa baixar por script). Ou indique o arquivo com --arquivo.")
    print(f"Lendo {arquivo} ...", flush=True)
    valores = ler(arquivo, a.dados / "ibge" / "territorio" / "municipios.csv")
    if not valores:
        sys.exit("Nenhuma nota de município achada na planilha: o formato mudou. Veja as abas listadas acima.")

    por_ano = defaultdict(lambda: defaultdict(int))
    for (_, ano), areas in valores.items():
        for area in areas:
            por_ano[ano][area] += 1
    print("\n  ano   " + "".join(f"{x:>15}" for x in AREAS))
    for ano in sorted(por_ano):
        print(f"  {ano}  " + "".join(f"{por_ano[ano].get(x, 0):>15,}" for x in AREAS))
    calculados = sum(1 for v in valores.values() if v.get("_calculado"))
    if calculados:
        print(f"\n  {calculados:,} valores do IFDM geral calculados como média das três áreas (a planilha não traz o geral).")
    if a.simular:
        print("\n--simular: nada foi gravado.")
        return

    linhas = [(cd, ano, *(v.get(x) for x in AREAS)) for (cd, ano), v in sorted(valores.items())]
    conn = psycopg2.connect(a.banco)
    with conn, conn.cursor() as cur:
        cur.execute("DELETE FROM ifdm_municipio")
        execute_values(cur, "INSERT INTO ifdm_municipio (cd_ibge, ano, ifdm, emprego_renda, educacao, saude) VALUES %s",
                       linhas, page_size=5000)
    conn.close()
    print(f"\n{len(linhas):,} linhas gravadas em ifdm_municipio em {_duracao(time.monotonic() - inicio)}. Reinicie a API.")


if __name__ == "__main__":
    main()
