"""P10.a) Taxa de reeleição por cargo (estaduais/federais da UF e municipais).

Dos candidatos eleitos numa eleição, qual porcentagem dos que disputam a reeleição vence?

Como o banco não guarda ST_REELEICAO, a tentativa de reeleição é derivada: o político
eleito no ano Y para o cargo C na unidade U (a UF ou o município) tentou a reeleição se
foi candidato ao mesmo cargo, na mesma unidade, na eleição ordinária seguinte (Y+4; para
senador, Y+8, fim do mandato). Venceu se tem mandato nessa candidatura.

Para prefeito e vereador o cálculo é feito sobre todos os municípios da UF juntos
(eleitos que tentaram somados) e, ao final, também como média das taxas municipais.

Uso: python scripts/10a_taxa_reeleicao.py [UF ...]   (sem UF: todas as carregadas)
Saída: respostas/10a_taxa_reeleicao.txt
"""
import sys

import pandas as pd

from comum import conectar, consultar, escolher_ufs, gravar_txt, pct

# Cargos titulares. Presidente fica de fora (disputa nacional) e vices/suplentes também:
# o TSE só marca vices e suplentes como eleitos a partir de 2012 (municipais) e 2014 (gerais).
CARGOS = {3: "Governador", 5: "Senador", 6: "Deputado Federal", 7: "Deputado Estadual",
          11: "Prefeito", 13: "Vereador"}
MUNICIPAIS = {11, 13}

# Em 1994 e 1996 metade das candidaturas não tem título eleitoral, e o loader só liga a pessoa
# entre eleições por nome + nascimento idênticos. Para o eleito sem título, aceita-se também,
# entre os candidatos ao mesmo cargo na mesma unidade na eleição seguinte, o mesmo nome
# normalizado (sem acentos, Z=S, Y=I) ou a mesma data de nascimento com o mesmo primeiro nome.
NOME = ("regexp_replace(translate(upper(p.nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑZY', "
        "'AAAAAEEEEIIIIOOOOOUUUUCNSI'), '[^A-Z]', '', 'g')")

SQL = f"""
WITH cand AS (
    -- Uma linha por político, eleição ordinária, cargo e unidade (tipo 1 = suplementar).
    SELECT pe.id_politico, e.ano, e.cod_cargo, e.cd_municipio,
           COALESCE(e.cd_municipio, -e.cd_uf) AS unidade,
           p.nr_titulo_eleitoral IS NULL AS sem_titulo, p.dt_nascimento,
           {NOME} AS nome, split_part(upper(p.nome), ' ', 1) AS primeiro_nome,
           bool_or(ma.id_mandato IS NOT NULL) AS eleito
    FROM politico_eleicao pe
    JOIN politico p ON p.id_politico = pe.id_politico
    JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
    LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
    LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
    WHERE e.tipo <> 1 AND e.cod_cargo = ANY(%(cargos)s) AND COALESCE(m.cd_uf, e.cd_uf) = %(cd_uf)s
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
),
proximo AS (
    SELECT DISTINCT cod_cargo, ano FROM cand
)
SELECT a.cod_cargo, a.ano AS ano_eleito, a.cd_municipio,
       a.ano + CASE WHEN a.cod_cargo = 5 THEN 8 ELSE 4 END AS ano_disputa,
       bool_or(b.id_politico IS NOT NULL) AS tentou, COALESCE(bool_or(b.eleito), false) AS reeleito,
       bool_or(b.id_politico <> a.id_politico) AS ligado_por_nome,
       EXISTS (SELECT 1 FROM proximo x WHERE x.cod_cargo = a.cod_cargo
                 AND x.ano = a.ano + CASE WHEN a.cod_cargo = 5 THEN 8 ELSE 4 END) AS ha_proxima
FROM cand a
LEFT JOIN cand b ON b.cod_cargo = a.cod_cargo AND b.unidade = a.unidade
                AND b.ano = a.ano + CASE WHEN a.cod_cargo = 5 THEN 8 ELSE 4 END
                AND (b.id_politico = a.id_politico
                     OR (a.sem_titulo AND (b.nome = a.nome
                         OR (b.dt_nascimento = a.dt_nascimento AND b.primeiro_nome = a.primeiro_nome))))
WHERE a.eleito
GROUP BY a.id_politico, a.cod_cargo, a.ano, a.cd_municipio, a.unidade
"""


def resumo(df: pd.DataFrame, por: list[str]) -> pd.DataFrame:
    r = df.groupby(por).agg(eleitos=("tentou", "size"), tentaram=("tentou", "sum"), reeleitos=("reeleito", "sum"))
    r["taxa"] = r["reeleitos"] / r["tentaram"].where(r["tentaram"] > 0)
    return r


def media_municipal(df: pd.DataFrame, por: list[str]) -> pd.Series:
    """Média simples das taxas dos municípios (só municípios em que alguém tentou a reeleição)."""
    r = resumo(df, [*por, "cd_municipio"])
    return r["taxa"].dropna().groupby(level=por).mean() if por else pd.Series({"": r["taxa"].dropna().mean()})


def secao_cargo(df: pd.DataFrame, cargo: int) -> list[str]:
    municipal = cargo in MUNICIPAIS
    ciclos = resumo(df, ["ano_eleito", "ano_disputa"])
    medias = media_municipal(df, ["ano_eleito"]) if municipal else None
    cab = f"  {'Eleitos em':>10}  {'Disputa':>7}  {'Eleitos':>7}  {'Tentaram':>8}  {'(% eleitos)':>11}  {'Reeleitos':>9}  {'Taxa':>6}"
    linhas = [f"{CARGOS[cargo]}", cab + ("  Média municípios" if municipal else ""), "  " + "-" * (len(cab) + (18 if municipal else 0))]

    def linha(rot1, rot2, r, media=None):
        s = (f"  {rot1:>10}  {rot2:>7}  {int(r.eleitos):>7}  {int(r.tentaram):>8}  {pct(r.tentaram, r.eleitos):>11}"
             f"  {int(r.reeleitos):>9}  {pct(r.reeleitos, r.tentaram):>6}")
        return s + (f"  {pct(media, 1) if pd.notna(media) else '-':>16}" if municipal else "")

    for (ano, disputa), r in ciclos.iterrows():
        linhas.append(linha(ano, disputa, r, medias.get(ano) if municipal else None))
    total = resumo(df.assign(t="Total"), ["t"]).iloc[0]
    linhas.append("  " + "-" * (len(cab) + (18 if municipal else 0)))
    linhas.append(linha("Total", "", total, media_municipal(df, []).iloc[0] if municipal else None))
    return linhas


def secao_uf(conn, sigla: str, cd_uf: int) -> list[str]:
    df = consultar(conn, SQL, {"cargos": list(CARGOS), "cd_uf": cd_uf})
    sem_proxima = df[~df["ha_proxima"]]
    df = df[df["ha_proxima"]]
    out = [f"{'=' * 90}", f"UF: {sigla}", f"{'=' * 90}", ""]
    finais = []
    for cargo in CARGOS:
        d = df[df["cod_cargo"] == cargo]
        if d.empty:
            continue
        out += secao_cargo(d, cargo) + [""]
        t = resumo(d.assign(t=0), ["t"]).iloc[0]
        media = media_municipal(d, []).iloc[0] if cargo in MUNICIPAIS else None
        finais.append((cargo, t, media, f"{d['ano_eleito'].min()}-{d['ano_eleito'].max()}"))

    out += [f"Resumo {sigla} (todas as eleições somadas)", ""]
    cab = f"  {'Cargo':<18}  {'Eleitos em':>10}  {'Eleitos':>7}  {'Tentaram':>8}  {'Reeleitos':>9}  {'Taxa (UF)':>9}  {'Média municípios':>16}"
    out += [cab, "  " + "-" * len(cab)]
    for cargo, t, media, anos in finais:
        out.append(f"  {CARGOS[cargo]:<18}  {anos:>10}  {int(t.eleitos):>7}  {int(t.tentaram):>8}  {int(t.reeleitos):>9}"
                   f"  {pct(t.reeleitos, t.tentaram):>9}  {pct(media, 1) if media is not None else '':>16}")
    m = [f for f in finais if f[0] in MUNICIPAIS]
    if m:
        tent = int(sum(f[1].tentaram for f in m))
        reel = int(sum(f[1].reeleitos for f in m))
        out += ["", f"  Cargos municipais (prefeito + vereador) em todo o estado: {reel} reeleitos de {tent} "
                    f"que tentaram = {pct(reel, tent).strip()}"]
    if not sem_proxima.empty:
        anos = ", ".join(f"{CARGOS[c]} {a}" for c, a in
                         sem_proxima.groupby(["cod_cargo", "ano_eleito"]).size().index)
        out += ["", f"  Fora do cálculo (eleição seguinte ainda sem dados): {anos}."]
    ligados = int(df["ligado_por_nome"].eq(True).sum())
    out += ["", f"  Tentativas identificadas pela ligação por nome/nascimento (eleito sem título): {ligados}."]
    return out + [""]


CABECALHO = """\
P10.a) Taxa de reeleição por cargo
Dos eleitos numa eleição, quantos disputam a reeleição (mesmo cargo, mesma UF/município,
na eleição ordinária seguinte; senador: 8 anos depois) e qual porcentagem deles vence.

Colunas: Eleitos = eleitos na eleição de origem; Tentaram = desses, os que foram candidatos
à reeleição; Reeleitos = os que venceram; Taxa = Reeleitos / Tentaram.
Para prefeito e vereador, "Taxa" soma todos os municípios da UF; "Média municípios" é a média
simples das taxas de cada município (só os municípios em que alguém tentou a reeleição).

Observações:
- Excluídos: eleições suplementares, Presidente (disputa nacional) e vices/suplentes
  (o TSE só os marca como eleitos a partir de 2012/2014).
- "Tentou" = teve candidatura registrada; candidaturas indeferidas ou renunciadas também
  contam, pois o banco não guarda a situação da candidatura.
- Pessoas ligadas entre eleições pelo título eleitoral (ou CPF / nome + nascimento).
"""


def main(argv: list[str]) -> None:
    with conectar() as conn:
        ufs = escolher_ufs(conn, argv)
        texto = [CABECALHO]
        for sigla, cd_uf in ufs:
            texto += secao_uf(conn, sigla, cd_uf)
    caminho = gravar_txt("10a_taxa_reeleicao.txt", "\n".join(texto))
    print(f"gravado: {caminho}")


if __name__ == "__main__":
    main(sys.argv[1:])
