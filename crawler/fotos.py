"""Fotos dos candidatos (TSE): um zip por eleição e UF, de 2004 em diante.

O TSE publica as fotos de registro das candidaturas em
cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes<ano>/fotos/foto_cand<ano>_<UF>_div.zip.
Antes de 2004 não há fotos. Nas eleições gerais há também o zip "BR" (Presidente);
o DF não tem eleição municipal, então não há zip do DF nesses anos.

Os zips ficam inteiros em dados/tse/fotos_candidatos/<ano>/, sem extração: são
milhões de imagens pequenas e o zip permite ler cada uma pelo nome sem espalhar
arquivos pelo disco. Dentro do zip a foto se chama F<UF><SQ_CANDIDATO>_div.<ext>
e se liga à candidatura (politico_eleicao.sq_candidato) pelo ano, UF e SQ.

Cada zip baixado tem a integridade conferida (CRC de todas as imagens) e fica
registrado no manifesto com a contagem de fotos por formato. No fim, o
RESUMO.md da pasta mostra quantas fotos há por eleição e UF.
"""
import re
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .manifesto import Manifesto
from .rede import NaoEncontrado, baixar, descrever_erro, info_remota

URL = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes{ano}/fotos/foto_cand{ano}_{uf}_div.zip"
PRIMEIRO_ANO = 2004
PASTA = Path("tse") / "fotos_candidatos"
UFS = ("AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE",
       "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO")
FOTO = re.compile(r"^F(?P<uf>[A-Z]{2})(?P<sq>\d+)_div\.(?P<ext>jpe?g|png|bmp|gif)$", re.IGNORECASE)


def geral(ano: int) -> bool:
    return ano % 4 == 2


def unidades(ano: int, ufs) -> list[str]:
    """UFs com zip publicado no ano: BR só nas gerais, DF só nas gerais."""
    lista = [u for u in ufs if u != "BR" and (geral(ano) or u != "DF")]
    return lista + (["BR"] if geral(ano) and "BR" in ufs else [])


def anos_disponiveis(ate: int, anos=None) -> list[int]:
    return [a for a in range(PRIMEIRO_ANO, ate + 1, 2) if not anos or a in anos]


def nome_da_foto(nomes, uf: str, sq: int | str) -> str | None:
    """Membro do zip com a foto da candidatura (uf, sq), em qualquer extensão."""
    prefixo = f"F{uf}{sq}_div.".upper()
    return next((n for n in nomes if n.rsplit("/", 1)[-1].upper().startswith(prefixo)), None)


@dataclass
class Pacote:
    ano: int
    uf: str
    raiz: Path
    tamanho: int | None = None
    modificado: str | None = None
    pendente: bool = True
    ausente: bool = False      # o TSE não publica esse zip (ex.: DF em ano municipal)
    erro: str | None = None

    @property
    def url(self) -> str:
        return URL.format(ano=self.ano, uf=self.uf)

    @property
    def destino(self) -> Path:
        return self.raiz / PASTA / str(self.ano) / f"foto_cand{self.ano}_{self.uf}_div.zip"

    @property
    def chave(self) -> str:
        return f"fotos:{self.ano}:{self.uf}"


def planejar(cli, raiz: Path, manifesto: Manifesto, anos: list[int], ufs, atualizar: bool) -> list[Pacote]:
    pacotes = [Pacote(a, u, raiz) for a in anos for u in unidades(a, ufs)]

    def consultar(p: Pacote) -> None:
        registro = manifesto.get(p.chave)
        if registro and p.destino.exists() and not atualizar:
            p.pendente, p.tamanho = False, p.destino.stat().st_size
            return
        try:
            info = info_remota(cli, p.url)
        except NaoEncontrado:
            p.pendente, p.ausente = False, True
            return
        except Exception as e:  # noqa: BLE001 - vira erro do pacote sem derrubar o plano
            p.erro = descrever_erro(e)
            return
        p.tamanho, p.modificado = info.tamanho, info.modificado
        if registro and p.destino.exists() and registro.get("modificado") == p.modificado:
            p.pendente = False

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(consultar, pacotes))
    return pacotes


def conferir(zip_local: Path) -> dict:
    """Confere o CRC de todas as imagens e conta as fotos por formato."""
    with zipfile.ZipFile(zip_local) as z:
        ruim = z.testzip()
        if ruim:
            raise ValueError(f"{zip_local.name}: {ruim} está corrompido")
        infos = [i for i in z.infolist() if FOTO.match(i.filename.rsplit("/", 1)[-1])]
    formatos = Counter(i.filename.rsplit(".", 1)[-1].lower() for i in infos)
    return {"fotos": len(infos), "formatos": dict(formatos), "bytes_fotos": sum(i.file_size for i in infos)}


def executar(cli, p: Pacote, manifesto: Manifesto) -> dict:
    info = baixar(cli, p.url, p.destino, rotulo=p.destino.name)
    resumo = conferir(p.destino)
    manifesto.registrar(p.chave, url=p.url, modificado=p.modificado or info.modificado,
                        arquivo=manifesto.relativo(p.destino), **resumo)
    return resumo


def _milhar(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def gerar_resumo(raiz: Path, manifesto: Manifesto) -> Path:
    """RESUMO.md com as fotos baixadas por eleição e UF."""
    registros = {k: v for k, v in manifesto.dados.items() if k.startswith("fotos:") and (raiz / v["arquivo"]).exists()}
    tabela: dict[int, dict[str, int]] = {}
    for chave, r in registros.items():
        _, ano, uf = chave.split(":")
        tabela.setdefault(int(ano), {})[uf] = r["fotos"]
    colunas = sorted({u for linha in tabela.values() for u in linha}, key=lambda u: (u == "BR", u))
    total = sum(r["fotos"] for r in registros.values())
    tamanho = sum((raiz / r["arquivo"]).stat().st_size for r in registros.values())
    formatos = Counter()
    for r in registros.values():
        formatos.update(r.get("formatos", {}))
    linhas = [
        "# Fotos dos candidatos (TSE)", "",
        f"Gerado por `python -m crawler --fotos` em {datetime.now():%d/%m/%Y %H:%M}.",
        f"**{_milhar(total)} fotos** em {len(registros)} zips, {tamanho / 1e9:.1f} GB. "
        f"Formatos: {', '.join(f'{k} {_milhar(v)}' for k, v in formatos.most_common())}.", "",
        "Cada zip guarda as fotos de uma eleição e UF com o nome `F<UF><SQ_CANDIDATO>_div.<ext>`.",
        "A API lê a foto direto do zip; não é preciso extrair.", "",
        "| Ano | " + " | ".join(colunas) + " | Total |",
        "|---|" + "---:|" * (len(colunas) + 1),
    ]
    for ano in sorted(tabela):
        linha = tabela[ano]
        celulas = [_milhar(linha[u]) if u in linha else "" for u in colunas]
        linhas.append(f"| {ano} | " + " | ".join(celulas) + f" | {_milhar(sum(linha.values()))} |")
    destino = raiz / PASTA / "RESUMO.md"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return destino
