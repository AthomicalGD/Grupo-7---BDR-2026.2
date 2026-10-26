"""P12) O que muda no 2º turno? (questão extra)

Quando ninguém passa da metade dos votos válidos (presidente, governador e prefeito das cidades com mais de
200 mil eleitores), os dois mais votados disputam um 2º turno. Para cada 2º turno de 2018 a 2024 (antes disso
o banco não tem os votos por zona), compara os dois finalistas nos dois turnos: a parte de cada um, o
crescimento dos votos e se houve virada (quem venceu o 2º turno não liderou o 1º).

A consulta é a mesma que o site mostra em "Ver SQL" (web/src/paginas/consultas/p12_segundo_turno.sql): os
votos do 2º turno ficam na mesma candidatura do 1º (politico_eleicao), então cada finalista tem os dois números.
Disputas sem os votos do 1º turno no banco (falha na carga daquela disputa) ficam de fora e são listadas.

Uso: python scripts/12_segundo_turno.py
Saída: respostas/12_segundo_turno.txt
"""
from pathlib import Path

from comum import conectar, consultar, gravar_txt

SQL = (Path(__file__).resolve().parent.parent / "web" / "src" / "paginas" / "consultas" / "p12_segundo_turno.sql").read_text(encoding="utf-8")
CARGOS = [("PRESIDENTE", "Presidência"), ("GOVERNADOR", "Governos estaduais"), ("PREFEITO", "Prefeituras")]


def lugar(cargo: str, uf, municipio) -> str:
    if cargo == "PRESIDENTE":
        return "Brasil"
    return uf if cargo == "GOVERNADOR" else f"{municipio.title()} ({uf})"


def main() -> None:
    with conectar() as conn:
        df = consultar(conn, SQL.split(";\n")[0])   # o arquivo tem uma consulta só; depois dela, só comentários
    disputas, incompletas = [], []
    for (ano, cargo, uf, municipio), g in df.groupby(["ano", "cargo", "uf", "municipio"], dropna=False, sort=True):
        fin = g[g.votos_t2.notna()].sort_values("votos_t2", ascending=False)
        if len(fin) != 2 or (fin.votos_t1.fillna(0) == 0).any():
            incompletas.append(f"{lugar(cargo, uf, municipio)} {ano}")
            continue
        v, p = fin.iloc[0], fin.iloc[1]
        disputas.append({
            "ano": int(ano), "cargo": cargo, "lugar": lugar(cargo, uf, municipio),
            "vencedor": v.nome, "partido_v": v.partido or "-", "derrotado": p.nome, "partido_d": p.partido or "-",
            # a parte do vencedor entre os dois finalistas, em cada turno (abaixo de 50 no 1º: começou atrás)
            "parte1": 100 * v.votos_t1 / (v.votos_t1 + p.votos_t1), "parte2": 100 * v.votos_t2 / (v.votos_t2 + p.votos_t2),
            "pct1": float(v.pct_t1), "cresc": 100 * (v.votos_t2 - v.votos_t1) / v.votos_t1, "virada": int(v.posicao_t1) != 1,
        })

    viradas = [d for d in disputas if d["virada"]]
    t = []
    t.append("P12) O que muda no 2º turno? (questão extra)")
    t.append("Os segundos turnos de 2018 a 2024: quem liderou o 1º turno venceu o 2º? Quanto cresceu cada finalista?\n")
    t.append("Colunas: % 1º = parte do candidato nos votos nominais do 1º turno (entre todos os candidatos);")
    t.append("Parte 1º → 2º = parte do vencedor nos votos dos dois finalistas, em cada turno (abaixo de 50% no 1º:")
    t.append("começou atrás); Cresc. = votos do vencedor no 2º turno sobre os do 1º; Virada = o vencedor não liderou o 1º.\n")
    t.append("Observações:")
    t.append("- Votos nominais por zona do TSE; antes de 2018 o banco não tem os votos por zona.")
    t.append("- Vice-presidente, vice-governador e vice-prefeito ficam de fora: vão na chapa do titular.")
    if incompletas:
        t.append(f"- Sem os votos do 1º turno no banco, ficaram de fora: {', '.join(incompletas)}.")
    t.append("")
    t.append("=" * 100)
    t.append(f"Resumo: {len(disputas)} segundos turnos, {len(viradas)} viradas ({100 * len(viradas) / len(disputas):.1f}%).")
    t.append(f"Quem liderou o 1º turno venceu o 2º em {len(disputas) - len(viradas)} ({100 * (len(disputas) - len(viradas)) / len(disputas):.1f}%).")
    t.append("=" * 100 + "\n")
    t.append(f"{'Cargo':<22}{'Disputas':>10}{'Viradas':>10}{'% viradas':>12}{'Cresc. médio do vencedor':>28}")
    for chave, nome in CARGOS:
        ds = [d for d in disputas if d["cargo"] == chave]
        if not ds:
            continue
        vs = [d for d in ds if d["virada"]]
        t.append(f"{nome:<22}{len(ds):>10}{len(vs):>10}{100 * len(vs) / len(ds):>11.1f}%{sum(d['cresc'] for d in ds) / len(ds):>27.1f}%")
    t.append(f"{'Por ano':<22}")
    for ano in sorted({d["ano"] for d in disputas}):
        ds = [d for d in disputas if d["ano"] == ano]
        vs = [d for d in ds if d["virada"]]
        t.append(f"  {ano:<20}{len(ds):>10}{len(vs):>10}{100 * len(vs) / len(ds):>11.1f}%")

    def tabela(titulo: str, lista: list[dict]) -> None:
        t.append("\n" + "=" * 100)
        t.append(titulo)
        t.append("=" * 100)
        t.append(f"{'Ano':<6}{'Cargo':<12}{'Lugar':<30}{'Vencedor':<46}{'% 1º':>7}{'Parte 1º → 2º':>16}{'Cresc.':>9}  Derrotado")
        for d in lista:
            t.append(f"{d['ano']:<6}{d['cargo'].title():<12}{d['lugar'][:29]:<30}{(d['vencedor'] + ' (' + d['partido_v'] + ')')[:45]:<46}"
                     f"{d['pct1']:>6.1f}%{d['parte1']:>8.1f}% →{d['parte2']:>5.1f}%{d['cresc']:>8.0f}%  {d['derrotado']} ({d['partido_d']})"
                     + ("  VIRADA" if d["virada"] else ""))

    tabela("As viradas, da maior para a menor (o vencedor mais atrás no 1º turno primeiro)", sorted(viradas, key=lambda d: d["parte1"]))
    tabela("Todas as disputas", sorted(disputas, key=lambda d: (d["ano"], d["cargo"], d["lugar"])))
    caminho = gravar_txt("12_segundo_turno.txt", "\n".join(t) + "\n")
    print(f"{len(disputas)} disputas, {len(viradas)} viradas -> {caminho}")


if __name__ == "__main__":
    main()
