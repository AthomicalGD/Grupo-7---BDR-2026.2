"""Confere a API contra o banco carregado (precisa de PI no banco).

Uso (da pasta do projeto): python -m api.test_api
"""
from fastapi.testclient import TestClient

from api.app import app

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

    geo = get("/api/geo/uf/PI")
    assert len(geo["features"]) == 224
    assert horario(geo["features"][0]["geometry"]["coordinates"][0])
    assert len(get("/api/geo/brasil")["features"]) == 27
    print("ok")


if __name__ == "__main__":
    main()
