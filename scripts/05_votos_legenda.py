"""P5) Quantos candidatos foram eleitos pelo sistema proporcional, por partido?

Conta as candidaturas com resultado oficial ELEITO POR QP ou ELEITO POR MÉDIA,
separando as duas situações e agrupando pelo partido de filiação do candidato.
Usa eleições ordinárias de 2018, 2020, 2022, 2024 e 2026 nas UFs carregadas.

Uso: python scripts/05_votos_legenda.py
Saída: respostas/05_votos_legenda.txt
"""
from comum import conectar, consultar, gravar_txt, ufs_carregadas

CARGOS = {6: "Deputado Federal", 7: "Deputado Estadual", 8: "Deputado Distrital", 13: "Vereador"}
ANOS = (2018, 2020, 2022, 2024, 2026)

SQL = """
SELECT e.ano, e.cod_cargo, p.sigla, m.ds_situacao,
       COALESCE(NULLIF(btrim(pe.nm_urna), ''), po.nome) AS candidato,
       COALESCE(pe.nr_candidato::text, '') AS numero,
       COALESCE(mu.nm_municipio, u.sigla) AS local
FROM mandato m
JOIN politico_eleicao pe ON pe.id_politico_eleicao = m.id_politico_eleicao
JOIN politico po         ON po.id_politico = pe.id_politico
JOIN eleicao e           ON e.id_eleicao = m.id_eleicao
JOIN partido p           ON p.id_partido = m.id_partido
LEFT JOIN municipio mu   ON mu.cd_municipio = e.cd_municipio
LEFT JOIN uf u           ON u.cd_ibge = COALESCE(e.cd_uf, mu.cd_uf)
WHERE e.ano = ANY(%(anos)s) AND e.tipo = 2 AND e.turno = 1
  AND e.cod_cargo = ANY(%(cargos)s)
  AND m.ds_situacao IN ('ELEITO POR QP', 'ELEITO POR MÉDIA')
ORDER BY e.ano, e.cod_cargo, p.sigla, m.ds_situacao, candidato
"""


def relatorio(df, ufs: list[str]) -> str:
    linhas = [
        "P5) Candidatos eleitos pelo sistema proporcional, por partido de filiação",
        "",
        f"Abrangência: eleições ordinárias de 2018 a 2026; UFs carregadas: {', '.join(ufs)}.",
        "Contagem de candidaturas classificadas pelo TSE como ELEITO POR QP ou ELEITO POR MÉDIA.",
        "O partido apresentado é o partido de filiação do candidato; QP e média são mostrados separadamente.",
        "",
        "Nota metodológica:",
        "A distribuição das cadeiras considerou os votos somados da coligação proporcional em 2018",
        "e da federação partidária em 2022, 2024 e 2026. Em 2020 não houve coligações proporcionais.",
        "Assim, esta contagem identifica o partido de filiação dos eleitos, mas não significa que os votos",
        "desse partido, isoladamente, tenham garantido a cadeira.",
        "",
    ]
    if df.empty:
        linhas.append("Nenhum candidato encontrado nas UFs carregadas.")
        return "\n".join(linhas)

    rotulo_status = {"ELEITO POR QP": "Por QP", "ELEITO POR MÉDIA": "Por média"}
    for (ano, cargo), grupo in df.groupby(["ano", "cod_cargo"], sort=True):
        por_partido = []
        for sigla, partido in grupo.groupby("sigla", sort=True):
            qp = int(partido["ds_situacao"].eq("ELEITO POR QP").sum())
            media = int(partido["ds_situacao"].eq("ELEITO POR MÉDIA").sum())
            por_partido.append((sigla, partido, qp, media))
        por_partido.sort(key=lambda item: (-(item[2] + item[3]), item[0]))
        total_qp = sum(item[2] for item in por_partido)
        total_media = sum(item[3] for item in por_partido)
        linhas.extend([
            f"{ano} · {CARGOS[int(cargo)]} — {total_qp + total_media:,} eleitos"
            f" ({total_qp:,} por QP; {total_media:,} por média)".replace(",", "."),
            f"  {'Partido':<32} {'Por QP':>8} {'Por média':>10} {'Total':>8}",
            "  " + "-" * 62,
        ])
        for sigla, partido, qp, media in por_partido:
            linhas.append(f"  {sigla:<32} {qp:>8,} {media:>10,} {qp + media:>8,}".replace(",", "."))
            for status, rotulo in rotulo_status.items():
                eleitos = partido[partido["ds_situacao"].eq(status)]
                if eleitos.empty:
                    continue
                linhas.append(f"    {rotulo}:")
                for candidato in eleitos.itertuples(index=False):
                    numero = f" ({candidato.numero})" if candidato.numero else ""
                    local = f" — {candidato.local}" if candidato.local else ""
                    linhas.append(f"      {candidato.candidato}{numero}{local}")
        linhas.append("")
    return "\n".join(linhas)


def main() -> None:
    with conectar() as conn:
        ufs = [sigla for sigla, _ in ufs_carregadas(conn)]
        df = consultar(conn, SQL, {"anos": list(ANOS), "cargos": list(CARGOS)})
    caminho = gravar_txt("05_votos_legenda.txt", relatorio(df, ufs))
    print(f"gravado: {caminho}")


if __name__ == "__main__":
    main()
