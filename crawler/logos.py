"""Logos dos partidos: python -m crawler --logos  (rode da pasta do projeto, com o banco carregado).

Usados ao lado da sigla na tela de índices. As siglas são as da tabela `partido` do banco (todas as eleições
carregadas). Duas fontes, nesta ordem:

1. Câmara dos Deputados (oficial): o `urlLogo` dos Dados Abertos aponta para .../img/partidos/{SIGLA}.gif,
   que existe também para siglas extintas (PMDB, PSL, PHS...) mas não para os partidos criados ou renomeados
   depois de ~2017 (MDB, PL, UNIÃO, REPUBLICANOS...), nem na própria API. Alguns arquivos são só a sigla
   escrita (PFL, PAN): os menores que LIMITE_TEXTO bytes contam como "sem logo".
2. Wikimedia Commons (não oficial; a licença é a de cada arquivo e fica gravada no manifesto): só para as
   siglas da tabela COMMONS, tirada da propriedade "logo" (P154) do Wikidata de cada partido e, para
   REPUBLICANOS e MISSÃO, que não a têm, de uma busca no Commons. Só entram siglas que são o nome do partido
   na época do logo: o PSDC (hoje DC) e o PFL (depois DEM) ficam sem, para não mostrar um logo de outro tempo.
   O Commons exige um User-Agent que identifique o projeto (política de agentes da Wikimedia).

Saída: dados/partidos/logos/{ARQUIVO}.gif|png e logos.json (sigla -> arquivo, fonte, página e licença).
Logo já em disco não é baixado de novo; --atualizar baixa todos outra vez.
"""
import json
import os
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote

import httpx

from .rede import NaoEncontrado, descrever_erro, requisitar

PASTA = Path("partidos") / "logos"
CAMARA = "https://www.camara.leg.br/internet/Deputado/img/partidos/{}.gif"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
UA_WIKIMEDIA = {"User-Agent": "ProjetoBDR-logos/1.0 (https://github.com/AthomicalGD/Grupo-7---BDR-2026.2)"}
LIMITE_TEXTO = 300      # bytes: abaixo disso, o GIF da Câmara é só a sigla escrita
LARGURA = 160           # px da miniatura PNG que o Commons gera (também a partir de SVG)

# sigla do banco -> arquivo no Commons (com o item do Wikidata de onde veio, para conferir)
COMMONS = {
    "AGIR": "Logomarca do Partido Agir.png",                                 # Q2534868
    "CIDADANIA": "Logo do Cidadania 23.png",                                 # Q2598527
    "DC": "Bandeira-democracia-cristã.png",                                  # Q2653287
    "DEMOCRATA": "Logomarca O Democrata 35.png",                             # Q24478299
    "MDB": "Movimento Democrático Brasileiro (2017).svg",                    # Q1322751
    "MISSÃO": "Partido Missão logo (dark).svg",                              # busca no Commons (a versão light é branca)
    "MOBILIZA": "Logomarca Partido Mobiliza.png",                            # Q429972
    "NOVO": "Partido Novo logo (2023).svg",                                  # Q18552710
    "PATRI": "Logotipo do partido Patriota.svg",                             # Q10345629
    "PATRIOTA": "Logotipo do partido Patriota.svg",                          # Q10345629
    "PCB": "PCB logo.svg",                                                   # Q2597196
    "PCO": "PCO29.jpg",                                                      # Q2453216
    "PGT": "Partido PGT logo.png",                                           # Q3056426
    "PL": "Partido Liberal (Brazil) logo.svg",                               # Q2731720
    "PPL": "Logotipo - Partido Pátria Livre (Brasil).png",                   # Q5499876
    "PRD": "Partido Renovação Democrática logo.svg",                         # Q115156140
    "PSTU": "Logo PSTU.png",                                                 # Q2453869
    "REPUBLICANOS": "Republicanos10.jpg",                                    # busca no Commons
    "SOLIDARIEDADE": "Logomarca do Partido Solidariedade.png",               # Q20061311
    "UNIÃO": "União Brasil logo.svg",                                        # Q108837483
    "UP": "Unidade Popular wordmark.svg",                                    # Q86534531 (o logo.svg sai em branco)
}


def nome_arquivo(sigla: str) -> str:
    """PC DO B -> PCDOB, UNIÃO -> UNIAO: o nome do arquivo em disco e na URL da API."""
    return re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFKD", sigla.upper()).encode("ascii", "ignore").decode())


def _variantes_camara(sigla: str) -> list[str]:
    return list(dict.fromkeys([sigla, sigla.replace(" ", ""), nome_arquivo(sigla)]))


def siglas_do_banco(url: str) -> list[str]:
    import psycopg2
    with psycopg2.connect(url) as conn, conn.cursor() as cur:
        cur.execute("SELECT DISTINCT sigla FROM partido WHERE sigla !~ '^PCA[0-9]+$' ORDER BY 1")   # PCA*: não são partidos
        return [r[0] for r in cur.fetchall()]


def _da_camara(cli: httpx.Client, sigla: str) -> tuple[bytes, str] | None:
    for v in _variantes_camara(sigla):
        url = CAMARA.format(quote(v))
        try:
            r = requisitar(cli, url)
        except NaoEncontrado:
            continue
        if r.headers.get("content-type", "").startswith("image") and len(r.content) >= LIMITE_TEXTO:
            return r.content, url
    return None


def _do_commons(cli: httpx.Client, arquivo: str) -> tuple[bytes, dict]:
    info = requisitar(cli, COMMONS_API, headers=UA_WIKIMEDIA, params={
        "action": "query", "titles": f"File:{arquivo}", "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": LARGURA, "format": "json"}).json()
    pagina = next(iter(info["query"]["pages"].values()))
    if "imageinfo" not in pagina:
        raise NaoEncontrado(f"File:{arquivo}")
    ii = pagina["imageinfo"][0]
    meta = ii.get("extmetadata", {})
    texto = lambda k: re.sub(r"<[^>]+>", "", meta.get(k, {}).get("value", "")).strip() or None
    conteudo = requisitar(cli, ii.get("thumburl") or ii["url"], headers=UA_WIKIMEDIA).content
    return conteudo, {"url": ii.get("thumburl") or ii["url"], "pagina": ii["descriptionurl"],
                      "licenca": texto("LicenseShortName"), "autor": texto("Artist")}


def coletar(cli: httpx.Client, raiz: Path, banco: str | None = None, atualizar: bool = False) -> dict:
    pasta = raiz / PASTA
    pasta.mkdir(parents=True, exist_ok=True)
    caminho = pasta / "logos.json"
    manifesto = json.loads(caminho.read_text(encoding="utf-8")) if caminho.exists() else {}
    siglas = siglas_do_banco(banco or os.environ.get("DATABASE_URL", "postgresql://eleicoes:eleicoes@127.0.0.1:5432/eleicoes"))
    for sigla in siglas:
        atual = manifesto.get(sigla)
        if atual and not atualizar and (atual.get("arquivo") is None or (pasta / atual["arquivo"]).exists()):
            print(f"    {sigla:14} já em disco" if atual.get("arquivo") else f"    {sigla:14} sem logo (já conferido)", flush=True)
            continue
        try:
            achado = _da_camara(cli, sigla)
            if achado:
                conteudo, url = achado
                registro = {"fonte": "camara", "url": url, "pagina": "https://dadosabertos.camara.leg.br/swagger/api.html",
                            "licenca": "Dados abertos da Câmara dos Deputados", "autor": None}
                ext = "gif"
            elif sigla in COMMONS:
                conteudo, registro = _do_commons(cli, COMMONS[sigla])
                registro["fonte"] = "wikimedia"
                ext = "png" if conteudo[:8] == b"\x89PNG\r\n\x1a\n" else "jpg" if conteudo[:2] == b"\xff\xd8" else "gif"
            else:
                manifesto[sigla] = {"arquivo": None, "fonte": None}
                print(f"    {sigla:14} sem logo nas fontes", flush=True)
                continue
        except (httpx.HTTPError, NaoEncontrado) as e:
            print(f"    {sigla:14} [erro] {descrever_erro(e)}", flush=True)
            continue
        arquivo = f"{nome_arquivo(sigla)}.{ext}"
        (pasta / arquivo).write_bytes(conteudo)
        manifesto[sigla] = {"arquivo": arquivo, **registro}
        print(f"    {sigla:14} {registro['fonte']:9} {len(conteudo) / 1e3:.1f} kB", flush=True)
    caminho.write_text(json.dumps(manifesto, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    return manifesto
