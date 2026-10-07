"""Confere a API contra o banco carregado (precisa de PI no banco).

Uso (da pasta do projeto): python -m api.test_api
"""
import json
from collections import defaultdict

from fastapi.testclient import TestClient

from api.app import IBGE, app

cliente = TestClient(app)


def get(url: str):
    r = cliente.get(url)
    assert r.status_code == 200, (url, r.status_code, r.text[:300])
    return r.json()


def chaves(x) -> set[str]:
    if isinstance(x, dict):
        return set(x) | set().union(*map(chaves, x.values()))
    if isinstance(x, list):
        return set().union(*map(chaves, x))
    return set()


def horario(anel: list) -> bool:
    """Área com sinal (lon, lat) negativa = sentido horário."""
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(anel, anel[1:])) < 0


def main() -> None:
    assert get("/api/saude")["banco"]

    ufs = get("/api/ufs")
    assert len(ufs) == 27
    pi = next(u for u in ufs if u["sigla"] == "PI")
    assert pi["carregada"] and pi["municipios"] == 224 and abs(pi["vies"]["2022"] + 41.9) <= 0.5, pi
    assert cliente.get("/api/ufs/XX").status_code == 404

    uf = get("/api/ufs/PI")
    assert len(uf["municipios"]) == 224 and uf["regioes"] and uf["sem_vies_pct"]

    the = get("/api/municipios/2211001")
    assert the["nome"] == "Teresina" and abs(the["vies"]["2022"] + 34.9) <= 0.5, the["vies"]
    esp = the["espectro"]["2022"]
    assert esp[0]["vies"] == min(p["vies"] for p in esp)
    assert abs(sum(p["pct"] for p in esp) - 100) < 1
    assert the["prefeitos"] and "sq" not in the["prefeitos"][0] and the["comparecimento"]["2022"]["aptos"] > 0
    assert all(the["indicadores"][k] for k in ("pib_per_capita", "idhm", "populacao", "eleitores_populacao", "isentos"))

    assert get("/api/municipios?q=teresi")[0]["ibge"] == 2211001
    assert get("/api/municipios?q=t") == []

    assert 368990 in [p["id"] for p in get("/api/politicos?q=wellington barroso")]
    wd = get("/api/politicos/368990")
    assert len(wd["candidaturas"]) == 11 and wd["resumo"]["candidaturas"] == 11
    reeleito = {c["ano"] for c in wd["candidaturas"] if c["cargo"] == "GOVERNADOR" and c["reeleito"]}
    assert reeleito == {2006, 2018}, reeleito
    assert not [k for k in chaves(wd) if "cpf" in k or "titulo" in k]
    assert "id" in get("/api/politicos/aleatorio")
    # busca com filtros (cédula de consulta): senador eleito no PI em 2022, sem nome
    filtrada = get("/api/politicos?cargo=5&ano=2022&uf=PI&resultado=eleito")
    assert [p["id"] for p in filtrada] == [368990], filtrada
    assert 368990 in [p["id"] for p in get("/api/politicos?q=wellington&partido=PT&cargo=3")]
    assert cliente.get("/api/politicos?cargo=99").status_code == 422
    pt = next(p for p in get("/api/partidos") if p["sigla"] == "PT")
    assert pt["vies"] == -68 and pt["candidaturas"] > 0
    # P10a: senador no PI, como em respostas/10a_taxa_reeleicao.txt (4 tentaram, 1 reeleito)
    assert wd["contexto_reeleicao"] == {"cargo": "SENADOR", "uf": "PI", "tentaram": 4, "reeleitos": 1, "taxa": 25.0}

    # fotos (python -m crawler --fotos --ufs PI BR): antes de 2004 o TSE não publica
    fotos = {c["ano"]: c["foto"] for c in wd["candidaturas"]}
    assert fotos[1994] is None and fotos[2022] and wd["foto"] == fotos[2022], fotos
    assert fotos[2010] and fotos[2012], fotos   # 2010-2014: zip sem o "F" no nome
    p2004 = [p for p in the["prefeitos"] if p["ano"] == 2004]
    assert p2004 and p2004[0]["foto"], p2004   # 2004: chave município_SQ
    img = cliente.get(fotos[2022])
    assert img.status_code == 200 and img.headers["content-type"].startswith("image/") and len(img.content) > 1000
    assert get("/api/politicos?q=wellington barroso")[0]["foto"]
    assert cliente.get("/api/fotos/2022/PI/1").status_code == 404

    # P1: deputado federal no PI em 2022, como em respostas/01_custo_cadeira.txt (R$ 6,21 mi por cadeira)
    cad = get("/api/cadeira?ano=2022&cargo=6&uf=PI")
    assert cad["resumo"]["cadeiras"] == 10 and round(cad["resumo"]["custo_cadeira"]) == 6212110, cad["resumo"]
    assert len(cad["cadeiras"]) == 10 and cad["cadeiras"][0]["gasto"] >= cad["cadeiras"][-1]["gasto"]
    assert abs(sum(p["gasto"] for p in cad["partidos"]) - cad["resumo"]["gasto_total"]) < 1
    assert sum(f["candidatos"] for f in cad["curva"]) == cad["resumo"]["candidatos"]
    assert cad["ipca"]["2024"] == 1 and cad["ipca"]["2018"] > 1.3 and set(cad["anos"]) == {"2018", "2022"}
    assert cliente.get("/api/cadeira?ano=2022&cargo=13&municipio=2211001").status_code == 404   # sem eleição municipal
    assert cliente.get("/api/cadeira?ano=2024&cargo=13&uf=PI").status_code == 422             # vereador pede município
    vt = get("/api/cadeira?ano=2024&cargo=13&municipio=2211001")
    assert vt["escopo"]["municipio"]["nome"] == "Teresina" and vt["resumo"]["cadeiras"] == 29
    assert {(c["ano"], c["cod_cargo"]) for c in the["cadeiras"]} == {(2020, 11), (2020, 13), (2024, 11), (2024, 13)}
    gasto = {c["ano"]: c["gasto"] for c in wd["candidaturas"]}
    assert gasto[2022] > 0 and gasto[1994] is None, gasto
    assert all(c["partido"] for c in wd["candidaturas"])   # partido também nas derrotas (migração 011)

    # malha simplificada sem frestas: ponto de fronteira compartilhada fica nos dois vizinhos ou em nenhum
    original = json.loads((IBGE / "malhas" / "municipios_22.geojson").read_text(encoding="utf-8"))
    def pontos(fc):
        donos = defaultdict(set)
        for i, f in enumerate(fc["features"]):
            g = f["geometry"]
            for pol in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
                for anel in pol:
                    for x, y in anel:
                        donos[(x, y)].add(i)
        return donos
    antes, depois = pontos(original), pontos(get("/api/geo/uf/PI"))
    assert sum(map(len, depois.values())) < 0.8 * sum(map(len, antes.values()))
    assert all(not depois.get(p) or depois[p] == d for p, d in antes.items() if len(d) > 1)

    # de onde vem o viés do PI em 2022: a soma do que cada partido puxa dá o viés do mapa
    comp = get("/api/ufs/PI/composicao?ano=2022")
    assert comp["vies"] == pi["vies"]["2022"] and abs(sum(p["contribuicao"] for p in comp["partidos"]) - comp["vies"]) < 0.2
    pt = comp["partidos"][0]
    assert pt["sigla"] == "PT" and pt["candidatos"][0]["nome"].startswith("LUIZ IN"), pt["candidatos"][0]
    assert cliente.get("/api/ufs/XX/composicao?ano=2022").status_code == 404

    geo = get("/api/geo/uf/PI")
    assert len(geo["features"]) == 224
    assert horario(geo["features"][0]["geometry"]["coordinates"][0])
    assert len(get("/api/geo/brasil")["features"]) == 27
    print("ok")


if __name__ == "__main__":
    main()
