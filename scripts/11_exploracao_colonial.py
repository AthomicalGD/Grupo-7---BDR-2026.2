"""Questão extra) Exploração colonial de cada município, para cruzar com a escolaridade da P4.

Uso: python scripts/11_exploracao_colonial.py
Saída: respostas/11_exploracao_colonial/municipios.csv (uma linha por município do IBGE)

O índice (0 a 100) é metade economia e metade trabalho escravizado:

  economia  a força do ciclo colonial mais forte que o município viveu (o máximo, não a soma: quem viveu de um
            ciclo só não sai menor). Cada ciclo marca os municípios atingidos diretamente e a influência cai com a
            distância, como em Naritomi, Soares e Assunção (2012): ((200 - d) / 200)² até 200 km.
              açúcar      núcleos de 1694 a menos de 200 km do litoral nas capitanias do açúcar (RN, PB, PE, AL, BA,
                          ES e Campos dos Goytacazes), a regra do artigo, mais os municípios cujo histórico do IBGE
                          fala de engenho ou cana antes de 1822
              mineração   histórico do IBGE com ouro, lavras ou diamantes antes de 1822, ou ocorrência de ouro ou
                          diamante do Serviço Geológico do Brasil num núcleo que já existia em 1822 (MG, GO, MT, BA, TO)
              gado        presença colonial (núcleo de 1822 ou histórico colonial) no semiárido, no Piauí ou no
                          sertão do Maranhão (sul da latitude -5,5, os Pastos Bons), mais o histórico com gado e currais
              Norte       presença colonial no Pará, Amazonas, Amapá e norte do Maranhão (a área da Companhia Geral
                          do Grão-Pará e Maranhão), histórico com algodão, arroz, fumo ou drogas do sertão, e o
                          Recôncavo fumageiro
  escravidão a parte da população escravizada no Censo de 1872, na área comparável (IPEA, 1872-2010) de cada
            município, levada ao nível do fim da Colônia: multiplicada pela razão entre a parte escravizada da
            capitania em 1819 (Velloso de Oliveira) e a do estado em 1872; dividida pelo percentil 99 e limitada a 1

Fontes (todas abertas; baixadas para dados/colonial na primeira vez):
  - Old But Gold (Baerlocher, Firmino, Lambais, Reis e Veras, Journal of Urban Economics), Mendeley Data
    ppxdfzt28d, CC BY 4.0: coordenadas, distância do litoral e núcleos de 1694 e 1822 (municípios de 2010)
  - IBGE, Evolução da Divisão Territorial do Brasil 1872-2010: população livre e escravizada de 1872
  - IPEA/geobr, Áreas Mínimas Comparáveis 1872-2010 (Ehrl, 2017)
  - IBGE, API da Biblioteca: o histórico de cada município (lido com palavras-chave e um ano colonial por perto)
  - Serviço Geológico do Brasil (SGB/CPRM): ocorrências de ouro e diamante
  - IBGE: municípios do semiárido (2022)
  - População de 1819 por capitania (Velloso de Oliveira), na tabela 1 de Motta (2022), Revista USP 132
Os municípios sem coordenada na base de 2010 (criados depois) usam o centroide da malha do IBGE; os sem área de
1872 herdam a escravidão do município mais próximo que a tem.
"""
import csv
import io
import json
import math
import re
import sqlite3
import time
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

import httpx
import numpy as np
import xlrd

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "dados" / "colonial"
SAIDA = RAIZ / "respostas" / "11_exploracao_colonial" / "municipios.csv"
CABECALHO = {"User-Agent": "Mozilla/5.0 (Voto Aberto; projeto academico)"}   # o Mendeley recusa o agente do urllib
RAIO = 200

FONTES = {
    "old_but_gold": "https://data.mendeley.com/public-files/datasets/ppxdfzt28d/files/717bef70-9f69-41d8-8b96-5c9c5af70e6b/file_downloaded",
    "evolucao_1872": "https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/evolucao_da_divisao_territorial_do_brasil/evolucao_da_divisao_territorial_do_brasil_1872_2010/municipios_1872_1991/Documentacao/pop_mun_TUR_1872_a_2010.xls",
    "amc": "https://www.ipea.gov.br/geobr/data_gpkg/amc/1872/AMC_1872_2010_simplified.gpkg",
    "historico": "https://servicodados.ibge.gov.br/api/v1/biblioteca?aspas=3&codmun={}",
    "sgb": ("https://geoservicos.sgb.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature"
            "&typeName=geosgb:ocorrencias_recursos_minerais&outputFormat=application/json"
            "&CQL_FILTER=substancias%20ILIKE%20%27%25ouro%25%27%20OR%20substancias%20ILIKE%20%27%25diamante%25%27"),
    "semiarido": "https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/semiarido_brasileiro/Situacao_2022/lista_municipios_Semiarido_2022.xlsx",
}

# parte escravizada de cada capitania em 1819 (escravizados / total; Velloso de Oliveira, via Motta 2022, tab. 1);
# as UFs de hoje que não eram capitania usam a de que faziam parte
P1819 = {"13": 6040 / 19350, "15": 33000 / 123901, "21": 133332 / 200000, "22": 12405 / 61226, "23": 55439 / 201170,
         "24": 9109 / 70921, "25": 16723 / 96448, "26": 97633 / 368465, "27": 69094 / 111973, "28": 26213 / 114996,
         "29": 147263 / 477912, "32": 20272 / 72845, "33": 146060 / 510000, "35": 77667 / 238323, "41": 10191 / 59942,
         "42": 9172 / 44031, "43": 28253 / 92180, "31": 168543 / 631885, "52": 26800 / 63168, "51": 14180 / 37396}
P1819.update({"17": P1819["52"], "53": P1819["52"], "50": P1819["51"], "11": P1819["51"], "12": P1819["13"],
              "14": P1819["13"], "16": P1819["15"]})
ACUCAR_UFS, CAMPOS = {"24", "25", "26", "27", "29", "32"}, "3301009"
MINERACAO_UFS = {"31", "52", "51", "29", "17"}
NORTE_UFS = {"15", "13", "16"}
RECONCAVO = {"2904902", "2908200", "2909802", "2911600", "2920601", "2922300", "2928604", "2929008", "2929305"}

# o histórico do IBGE: a atividade conta quando aparece com um ano até 1821 ou um século colonial por perto
PALAVRAS = {
    "acucar": r"engenhos?\b|cana[- ]de[- ]a[çc][úu]car|\ba[çc][úu]car\b|canaviais|canavial",
    "mineracao": r"\bouro\b|minera[çc][ãa]o|\blavras?\b|faiscador|garimp|diamant|\bcatas?\b|aur[íi]fer|minas de",
    "gado": r"\bgado\b|curra(l|is)|fazendas? de (criar|cria[çc][ãa]o|gado)|criat[óo]rio|pecu[áa]ri|vaqueir|boiadas?|\bcriadores\b|charque",
    "norte": r"algod[ãa]o|algodoeir|\barroz|\bfumo\b|tabaco|drogas do sert[ãa]o|\bcacau|salsaparrilha|\bcravo\b|urucu|baunilha",
}
ANO = re.compile(r"\b(1[5-7]\d\d|180\d|181\d|182[01])\b")
COLONIAL = re.compile(r"s[ée]culo\s+(xvi|xvii|xviii)\b|s[ée]c\.?\s*(xvi|xvii|xviii)\b|per[íi]odo colonial|bandeirant|sesmari|capitania", re.I)


class ZipRemoto(io.RawIOBase):
    """Um arquivo remoto lido por faixas (HTTP Range): o zipfile só busca o índice e o membro pedido."""

    def __init__(self, url: str):
        self.url, self.pos = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, headers={**CABECALHO, "Range": "bytes=0-0"}), timeout=60) as r:
            self.tamanho = int(r.headers["Content-Range"].split("/")[1])
            self.url = r.url   # o endereço final (o Mendeley redireciona para o armazenamento)

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, pos, de=0):
        self.pos = pos if de == 0 else self.pos + pos if de == 1 else self.tamanho + pos
        return self.pos

    def read(self, n=-1):
        fim = self.tamanho if n is None or n < 0 else min(self.tamanho, self.pos + n)
        if fim <= self.pos:
            return b""
        pedido = urllib.request.Request(self.url, headers={**CABECALHO, "Range": f"bytes={self.pos}-{fim - 1}"})
        with urllib.request.urlopen(pedido, timeout=120) as r:
            dados = r.read()
        self.pos += len(dados)
        return dados


def baixa(nome: str, arquivo: str) -> Path:
    destino = DADOS / arquivo
    if not destino.exists():
        print(f"baixando {arquivo}...", flush=True)
        destino.parent.mkdir(parents=True, exist_ok=True)
        if nome == "old_but_gold":
            with zipfile.ZipFile(ZipRemoto(FONTES[nome])) as z:
                destino.write_bytes(z.read(next(n for n in z.namelist() if n.endswith("mun10data.csv"))))
        else:
            r = httpx.get(FONTES[nome], headers=CABECALHO, timeout=300, follow_redirects=True)
            r.raise_for_status()
            destino.write_bytes(r.content)
    return destino


def historicos(codigos: list[str]) -> dict:
    """O histórico de cada município (uma consulta por município; a API cai às vezes: retoma de onde parou)."""
    arquivo = DADOS / "historico_ibge.json"
    feitos = json.loads(arquivo.read_text(encoding="utf-8")) if arquivo.exists() else {}
    faltam = [c for c in codigos if c not in feitos]
    if faltam:
        print(f"baixando o histórico de {len(faltam)} municípios do IBGE...", flush=True)
    with httpx.Client(timeout=60, headers=CABECALHO) as cli:
        for i, c in enumerate(faltam):
            for tentativa in range(5):
                try:
                    v = cli.get(FONTES["historico"].format(c)).json().get(c) or {}
                    feitos[c] = {k: v.get(k, "") for k in ("HISTORICO", "FORMACAO_ADMINISTRATIVA")}
                    break
                except (httpx.HTTPError, ValueError):
                    time.sleep(3 * (tentativa + 1))
            if i % 200 == 199:
                arquivo.write_text(json.dumps(feitos, ensure_ascii=False), encoding="utf-8")
    arquivo.write_text(json.dumps(feitos, ensure_ascii=False), encoding="utf-8")
    return feitos


def atividades(texto: str) -> dict[str, bool]:
    frases = re.split(r"(?<=[.;!?])\s+|\n", texto)
    achou = {"colonial": bool(ANO.search(texto) or COLONIAL.search(texto))}
    for k, padrao in PALAVRAS.items():
        achou[k] = any(re.search(padrao, f, re.I) and (ANO.search(c := " ".join(frases[max(0, i - 1):i + 2])) or COLONIAL.search(c))
                       for i, f in enumerate(frases))
    return achou


def semiarido(arquivo: Path) -> set[str]:
    """Os códigos da primeira coluna da planilha (xlsx lido como zip de XML, sem dependência)."""
    with zipfile.ZipFile(arquivo) as z:
        textos = re.findall(r"<t[^>]*>([^<]*)</t>", z.read("xl/sharedStrings.xml").decode()) if "xl/sharedStrings.xml" in z.namelist() else []
        folha = z.read("xl/worksheets/sheet1.xml").decode()
    codigos = set()
    for celula in re.finditer(r'<c r="A\d+"([^>]*)>(?:<f>[^<]*</f>)?<v>([^<]*)</v>', folha):
        v = textos[int(celula.group(2))] if 't="s"' in celula.group(1) else celula.group(2)
        if re.fullmatch(r"\d{7}(\.0)?", v.strip()):
            codigos.add(v.strip()[:7])
    return codigos


def ouro_diamante(arquivo: Path, por_nome: dict) -> set[str]:
    codigos = set()
    for f in json.loads(arquivo.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        c = por_nome.get((p.get("uf"), sem_acento(p.get("municipio"))))
        if c:
            codigos.add(c)
    return codigos


def sem_acento(s) -> str:
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper().strip()


def escravidao_1872(xls: Path, gpkg: Path) -> dict[str, float]:
    """Parte escravizada de 1872 na área comparável de cada município de 2010, levada ao nível de 1819."""
    folha = xlrd.open_workbook(xls).sheet_by_index(0)
    pop, esc = {}, {}
    for i in range(1, folha.nrows):
        v = folha.row_values(i)
        if isinstance(v[4], float) and isinstance(v[6], float):   # o município sede de uma unidade de 1872
            c = str(int(v[0]))
            pop[c], esc[c] = v[4], v[6]
    area = {}
    for codigo, lista in sqlite3.connect(gpkg).execute("SELECT code_amc, list_code_muni_2010 FROM AMC_1872_2010_simplified"):
        for m in lista.split(","):
            area[m.strip()] = codigo
    pa, ea, pu, eu = {}, {}, {}, {}
    for c in pop:
        a = area.get(c)
        if a is not None:
            pa[a] = pa.get(a, 0) + pop[c]
            ea[a] = ea.get(a, 0) + esc[c]
        pu[c[:2]] = pu.get(c[:2], 0) + pop[c]
        eu[c[:2]] = eu.get(c[:2], 0) + esc[c]
    saida = {}
    for m, a in area.items():
        uf = m[:2]
        if pa.get(a) and eu.get(uf):
            saida[m] = (ea[a] / pa[a]) * P1819[uf] / (eu[uf] / pu[uf])
    return saida


def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2, dl = math.radians(la1), math.radians(la2), math.radians(lo2 - lo1)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def centroides_ibge() -> dict[str, tuple[float, float]]:
    saida = {}
    for arq in (RAIZ / "dados" / "ibge" / "malhas").glob("municipios_*.geojson"):
        for f in json.loads(arq.read_text(encoding="utf-8"))["features"]:
            g = f["geometry"]
            anel = max((p[0] for p in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]])), key=len)
            saida[str(f["properties"]["codarea"])] = (sum(y for _, y in anel) / len(anel), sum(x for x, _ in anel) / len(anel))
    return saida


def main():
    with (RAIZ / "dados" / "ibge" / "territorio" / "municipios.csv").open(encoding="utf-8-sig") as f:
        atuais = {r["cod_ibge"]: r for r in csv.DictReader(f, delimiter=";")}
    base = {r["code_muni"]: r for r in csv.DictReader(baixa("old_but_gold", "mun10data.csv").open(encoding="utf-8"))}
    num = lambda v: float(v) if v not in ("", "NA", None) else None
    pos = {c: (num(r["latitude"]), num(r["longitude"])) for c, r in base.items() if num(r["latitude"]) is not None}
    centro = centroides_ibge()
    for c in atuais:
        if c not in pos and c in centro:
            pos[c] = centro[c]
    codigos = [c for c in atuais if c in pos]

    hist = historicos(list(atuais))
    ativ = {c: atividades((v.get("HISTORICO") or "") + "\n" + (v.get("FORMACAO_ADMINISTRATIVA") or "")) for c, v in hist.items()}
    tem = lambda c, k: ativ.get(c, {}).get(k, False)
    em1694 = lambda c: base.get(c, {}).get("settletype1694", "") not in ("", "NA")
    em1822 = lambda c: base.get(c, {}).get("settletype1822", "") not in ("", "NA")
    colonial = lambda c: em1822(c) or tem(c, "colonial")
    litoral = lambda c: (num(base.get(c, {}).get("dist_to_coast")) or 1e12) < RAIO * 1000
    por_nome = {(r["sg_uf"], sem_acento(r["municipio"])): c for c, r in atuais.items()}
    ouro = ouro_diamante(baixa("sgb", "sgb_ouro_diamante.geojson"), por_nome)
    semi = semiarido(baixa("semiarido", "semiarido_2022.xlsx"))

    diretos = {
        "acucar": {c for c in codigos if (em1694(c) and litoral(c) and c[:2] in ACUCAR_UFS) or c == CAMPOS or tem(c, "acucar")},
        "mineracao": {c for c in codigos if tem(c, "mineracao") or (c in ouro and em1822(c) and c[:2] in MINERACAO_UFS)},
        "gado": {c for c in codigos if (colonial(c) and (c in semi or c[:2] == "22" or (c[:2] == "21" and pos[c][0] < -5.5))) or tem(c, "gado")},
        "norte": {c for c in codigos if (colonial(c) and (c[:2] in NORTE_UFS or (c[:2] == "21" and pos[c][0] >= -5.5))) or tem(c, "norte") or c in RECONCAVO},
    }
    lat = np.radians([pos[c][0] for c in codigos])
    lon = np.radians([pos[c][1] for c in codigos])
    indice = {c: i for i, c in enumerate(codigos)}

    def influencia(conjunto: set[str]) -> np.ndarray:
        perto = np.full(len(codigos), np.inf)
        alvos = np.array([indice[c] for c in conjunto])
        for k in range(0, len(alvos), 256):
            j = alvos[k:k + 256]
            h = (np.sin((lat[:, None] - lat[None, j]) / 2) ** 2
                 + np.cos(lat[:, None]) * np.cos(lat[None, j]) * np.sin((lon[:, None] - lon[None, j]) / 2) ** 2)
            perto = np.minimum(perto, (12742 * np.arcsin(np.sqrt(h))).min(1))
        return np.where(perto < RAIO, ((RAIO - perto) / RAIO) ** 2, 0.0)

    ciclos = {k: influencia(v) for k, v in diretos.items()}
    economia = np.max(np.vstack(list(ciclos.values())), axis=0)

    esc = escravidao_1872(baixa("evolucao_1872", "pop_mun_TUR_1872_a_2010.xls"), baixa("amc", "AMC_1872_2010.gpkg"))
    com_dado = [c for c in codigos if c in esc]
    teto = float(np.percentile([esc[c] for c in com_dado], 99))
    escravidao = []
    for c in codigos:
        v = esc.get(c)
        if v is None:   # sem área de 1872 (criado depois, ou fora da tabela): o mais próximo que tem
            v = esc[min(com_dado, key=lambda o: km(pos[c], pos[o]))]
        escravidao.append(min(1.0, v / teto))
    escravidao = np.array(escravidao)

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with SAIDA.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ibge", "indice", "economia", "escravidao", "acucar", "mineracao", "gado", "norte"])
        for c in atuais:
            if c not in indice:
                w.writerow([c] + [""] * 7)
                continue
            i = indice[c]
            w.writerow([c, round(50 * economia[i] + 50 * escravidao[i], 1), round(economia[i], 3), round(escravidao[i], 3)]
                       + [round(ciclos[k][i], 3) for k in ("acucar", "mineracao", "gado", "norte")])
    print({k: len(v) for k, v in diretos.items()}, f"p99 da escravidão = {teto:.3f}")
    for uf, cd in (("MA", "21"), ("PI", "22"), ("SP", "35"), ("BA", "29"), ("PE", "26"), ("MG", "31")):
        ii = [indice[c] for c in codigos if c[:2] == cd]
        print(uf, round(float(np.mean(50 * economia[ii] + 50 * escravidao[ii])), 1),
              "economia", round(float(np.mean(economia[ii])), 2), "escravidão", round(float(np.mean(escravidao[ii])), 2))


if __name__ == "__main__":
    main()
