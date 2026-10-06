"""Leitura dos CSVs de dados/: onde estão, que colunas usar e como limpá-las.

Arquivos do TSE: latin-1, separador ';'. Os valores #NULO, #NE, -1, -3, -4 e
"NÃO DIVULGÁVEL" significam ausente ou mascarado e viram NULL. Só as colunas
usadas são lidas, em blocos, e só as linhas das UFs pedidas seguem adiante.

Em cada pasta, se existir o consolidado *_BRASIL.csv, só ele é lido (filtrando
SG_UF); senão, são lidos os arquivos por UF (*_SP.csv etc.) das UFs pedidas.
"""
import re
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import Callable, Iterator

import pandas as pd

BLOCO = 500_000
AUSENTES = {"", "#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4", "NÃO DIVULGÁVEL"}
TIPOS_SQL = {"texto": "text", "sigla": "text", "ue": "text", "cpf": "text", "titulo": "text", "doc": "text",
             "int": "integer", "bigint": "bigint", "dec": "numeric", "data": "date"}

_SUFIXO = re.compile(r"_(BRASIL|[A-Z]{2})\.csv$", re.IGNORECASE)


# ───────── Conversores (uma Series de str -> Series limpa) ─────────

def _texto(s: pd.Series) -> pd.Series:
    s = s.str.strip()
    return s.mask(s.str.upper().isin(AUSENTES)).astype("string")


def _sigla(s: pd.Series) -> pd.Series:
    return _texto(s).str.upper()


def _inteiro(s: pd.Series) -> pd.Series:
    return pd.to_numeric(_texto(s), errors="coerce").round().astype("Int64")


def _decimal(s: pd.Series) -> pd.Series:
    """Aceita '1250,00' e '1250.00'; com vírgula, o ponto é separador de milhar."""
    t = _texto(s)
    virgula = t.str.contains(",", regex=False, na=False)
    t = t.where(~virgula, t.str.replace(".", "", regex=False).str.replace(",", ".", regex=False))
    return pd.to_numeric(t, errors="coerce")


def _data(s: pd.Series) -> pd.Series:
    d = pd.to_datetime(_texto(s), format="%d/%m/%Y", errors="coerce")
    # ano com 2 dígitos ("09/01/54") vira o ano 54, que o strftime do Windows grava sem zeros ("54-01-09")
    d = d.where(d.dt.year >= 1900)
    return d.dt.strftime("%Y-%m-%d").astype("string")


def _digitos(s: pd.Series, tamanho: int) -> pd.Series:
    """Documento só com dígitos, completado com zeros à esquerda; zeros ou lixo viram NULL."""
    t = _texto(s)
    ok = t.str.fullmatch(r"\d+", na=False) & (t.str.len() <= tamanho) & ~t.str.fullmatch(r"0+", na=False)
    return t.where(ok.fillna(False)).str.zfill(tamanho)


def _cpf_cnpj(s: pd.Series) -> pd.Series:
    t = _texto(s)
    ok = t.str.fullmatch(r"\d{11}|\d{14}", na=False) & ~t.str.fullmatch(r"0+", na=False)
    return t.where(ok)


def _ue(s: pd.Series) -> pd.Series:
    """Unidade eleitoral: 'BR', sigla da UF ou código TSE do município sem zeros à esquerda."""
    t = _sigla(s)
    numerica = t.str.fullmatch(r"\d+", na=False)
    return t.where(~numerica, t.str.lstrip("0").replace("", "0"))


CONVERSORES: dict[str, Callable[[pd.Series], pd.Series]] = {
    "texto": _texto, "sigla": _sigla, "ue": _ue, "int": _inteiro, "bigint": _inteiro, "dec": _decimal,
    "data": _data, "cpf": partial(_digitos, tamanho=11), "titulo": partial(_digitos, tamanho=12), "doc": _cpf_cnpj,
}


# ───────── Conjuntos de dados do TSE ─────────

@dataclass(frozen=True)
class Conjunto:
    nome: str                                  # sufixo das tabelas de staging
    pasta: str                                 # relativa a dados/
    padrao: str                                # glob dos arquivos
    colunas: dict[str, tuple[str, str]]        # coluna do CSV -> (coluna de staging, tipo)
    pos: Callable[[pd.DataFrame], pd.DataFrame] | None = None
    extras: tuple[tuple[str, str], ...] = ()   # colunas criadas por `pos` (nome, tipo)

    @property
    def estrutura(self) -> list[tuple[str, str]]:
        return [*self.colunas.values(), *self.extras]


DISPUTA = {
    "ANO_ELEICAO": ("ano", "int"), "CD_TIPO_ELEICAO": ("tipo", "int"), "CD_ELEICAO": ("cd_eleicao", "int"),
    "DS_ELEICAO": ("ds_eleicao", "texto"), "SG_UE": ("ue", "ue"), "NM_UE": ("nm_ue", "texto"),
    "CD_CARGO": ("cod_cargo", "int"), "DS_CARGO": ("ds_cargo", "texto"),
}
CANDIDATURA = {"CD_ELEICAO": ("cd_eleicao", "int"), "SG_UE": ("ue", "ue"), "SQ_CANDIDATO": ("sq", "bigint")}
ZONA = {"CD_MUNICIPIO": ("cd_municipio", "int"), "NM_MUNICIPIO": ("nm_municipio", "texto"), "NR_ZONA": ("nr_zona", "int")}


def _chave_pessoa(df: pd.DataFrame) -> pd.DataFrame:
    """Chave de identificação da pessoa, na ordem de confiança: título, CPF, nome + nascimento.

    Sem nenhum deles, a pessoa fica restrita à própria candidatura.
    """
    df = df[df["sq"].notna() & df["cd_eleicao"].notna()].copy()
    df["nome"] = df["nome"].fillna("(nome não informado)")
    so_candidatura = ("S" + df["ano"].astype("string") + "|" + df["tipo"].astype("string") + "|"
                      + df["ue"] + "|" + df["sq"].astype("string"))
    df["chave"] = (("T" + df["titulo"]).fillna("C" + df["cpf"])
                   .fillna("N" + df["nome"] + "|" + df["dt_nascimento"]).fillna(so_candidatura))
    return df


def _agregar_perfil(df: pd.DataFrame) -> pd.DataFrame:
    """O arquivo tem um corte por gênero, idade, raça etc.; só interessa escolaridade no 1º turno."""
    df = df[df["turno"].eq(1).fillna(False)]
    df = df.assign(grau=df["grau"].fillna("NÃO INFORMADO"))
    chaves = ["sg_uf", "ano", "turno", "cd_municipio", "nm_municipio", "nr_zona", "grau"]
    return df.groupby(chaves, dropna=False, as_index=False)[["qt_aptos", "qt_comparecimento"]].sum()


CONJUNTOS = [
    Conjunto("candidato", "tse/candidatos", "consulta_cand_*.csv", {
        **DISPUTA, "NR_TURNO": ("turno", "int"), "SQ_CANDIDATO": ("sq", "bigint"),
        "NM_CANDIDATO": ("nome", "texto"), "NR_CPF_CANDIDATO": ("cpf", "cpf"),
        "NR_TITULO_ELEITORAL_CANDIDATO": ("titulo", "titulo"), "DT_NASCIMENTO": ("dt_nascimento", "data"),
        "DS_GRAU_INSTRUCAO": ("grau", "texto"), "NR_PARTIDO": ("nr_partido", "int"),
        "SG_PARTIDO": ("sg_partido", "sigla"), "NM_PARTIDO": ("nm_partido", "texto"),
        "DS_SIT_TOT_TURNO": ("situacao", "sigla"),
    }, pos=_chave_pessoa, extras=(("chave", "texto"),)),
    Conjunto("vagas", "tse/vagas", "consulta_vagas_*.csv", {**DISPUTA, "QT_VAGA": ("qt_vaga", "int")}),
    Conjunto("bem", "tse/bens_candidatos", "bem_candidato_*.csv", {
        **CANDIDATURA, "VR_BEM_CANDIDATO": ("vr", "dec"),
    }),
    Conjunto("receita", "tse/receitas_candidatos", "receitas_candidatos_[0-9]*.csv", {
        **CANDIDATURA, "SQ_RECEITA": ("sq_receita", "bigint"), "VR_RECEITA": ("vr", "dec"),
        "DS_RECEITA": ("ds_receita", "texto"), "DS_FONTE_RECEITA": ("ds_fonte", "texto"),
        "DS_ORIGEM_RECEITA": ("ds_origem", "texto"),
    }),
    Conjunto("despesa", "tse/despesas_contratadas_candidatos", "despesas_contratadas_candidatos_*.csv", {
        **CANDIDATURA, "SQ_DESPESA": ("sq_despesa", "texto"), "VR_DESPESA_CONTRATADA": ("vr", "dec"),
        "DS_DESPESA": ("ds_despesa", "texto"), "DS_ORIGEM_DESPESA": ("ds_origem", "texto"),
        "NR_CPF_CNPJ_FORNECEDOR": ("doc", "doc"), "NM_FORNECEDOR": ("nm_fornecedor", "texto"),
        "DS_CNAE_FORNECEDOR": ("cnae", "texto"),
    }),
    Conjunto("votacao_candidato", "tse/votacao_candidato_munzona", "votacao_candidato_munzona_*.csv", {
        **DISPUTA, "NR_TURNO": ("turno", "int"), **ZONA, "SQ_CANDIDATO": ("sq", "bigint"),
        "QT_VOTOS_NOMINAIS": ("qt_votos", "int"),
    }),
    Conjunto("votacao_partido", "tse/votacao_partido_munzona", "votacao_partido_munzona_*.csv", {
        **DISPUTA, "NR_TURNO": ("turno", "int"), **ZONA, "NR_PARTIDO": ("nr_partido", "int"),
        "SG_PARTIDO": ("sg_partido", "sigla"), "NM_PARTIDO": ("nm_partido", "texto"),
        "QT_VOTOS_LEGENDA_VALIDOS": ("qt_legenda", "int"), "QT_TOTAL_VOTOS_LEG_VALIDOS": ("qt_total_legenda", "int"),
        "QT_VOTOS_NOMINAIS_VALIDOS": ("qt_nominais", "int"),
    }),
    Conjunto("detalhe", "tse/detalhe_votacao_munzona", "detalhe_votacao_munzona_*.csv", {
        **DISPUTA, "NR_TURNO": ("turno", "int"), **ZONA, "QT_APTOS": ("qt_aptos", "int"),
        "QT_COMPARECIMENTO": ("qt_comparecimento", "int"), "QT_ABSTENCOES": ("qt_abstencoes", "int"),
        "QT_VOTOS_BRANCOS": ("qt_brancos", "int"), "QT_TOTAL_VOTOS_NULOS": ("qt_nulos", "int"),
    }),
    Conjunto("perfil", "tse/comparecimento_abstencao", "perfil_comparecimento_abstencao_*.csv", {
        "ANO_ELEICAO": ("ano", "int"), "NR_TURNO": ("turno", "int"), **ZONA,
        "DS_GRAU_ESCOLARIDADE": ("grau", "texto"), "QT_APTOS": ("qt_aptos", "int"),
        "QT_COMPARECIMENTO": ("qt_comparecimento", "int"),
    }, pos=_agregar_perfil),
]


def arquivos(raiz: Path, conjunto: Conjunto, ufs: set[str]) -> list[Path]:
    por_pasta: dict[Path, list[Path]] = {}
    for p in sorted((raiz / conjunto.pasta).rglob(conjunto.padrao)):
        por_pasta.setdefault(p.parent, []).append(p)
    escolhidos = []
    for lista in por_pasta.values():
        sufixos = {p: (m.group(1).upper() if (m := _SUFIXO.search(p.name)) else None) for p in lista}
        inteiros = [p for p, s in sufixos.items() if s in (None, "BRASIL")]
        escolhidos += inteiros or [p for p, s in sufixos.items() if s in ufs]
    return escolhidos


def ler(arquivo: Path, conjunto: Conjunto, ufs: set[str]) -> Iterator[pd.DataFrame]:
    """Blocos já limpos, só com as UFs pedidas, com a coluna sg_uf para separar por UF."""
    leitor = pd.read_csv(arquivo, sep=";", encoding="latin-1", dtype=str, usecols=[*conjunto.colunas, "SG_UF"],
                         keep_default_na=False, na_filter=False, chunksize=BLOCO, on_bad_lines="warn")
    for bloco in leitor:
        uf = bloco["SG_UF"].str.strip().str.upper()
        manter = uf.isin(ufs)
        if not manter.any():
            continue
        bloco = bloco[manter]
        limpo = pd.DataFrame({destino: CONVERSORES[tipo](bloco[origem])
                              for origem, (destino, tipo) in conjunto.colunas.items()})
        limpo["sg_uf"] = uf[manter]
        yield conjunto.pos(limpo) if conjunto.pos else limpo


# ───────── Referências: municípios e indicadores ─────────

def municipios(raiz: Path) -> pd.DataFrame:
    """Correspondência TSE x IBGE: sg_uf, cd_uf, cd_municipio, nm_municipio, cd_ibge."""
    caminho = next(iter(sorted((raiz / "tse").rglob("municipio_tse_ibge*.csv"))), None)
    if caminho is None:
        raise FileNotFoundError(f"não achei municipio_tse_ibge*.csv em {raiz / 'tse'}")
    df = pd.read_csv(caminho, sep=";", encoding="latin-1", dtype=str, keep_default_na=False)
    return pd.DataFrame({
        "sg_uf": _sigla(df["SG_UF"]), "cd_uf": _inteiro(df["CD_UF_IBGE"]),
        "cd_municipio": _inteiro(df["CD_MUNICIPIO_TSE"]), "nm_municipio": _texto(df["NM_MUNICIPIO_TSE"]),
        "cd_ibge": _inteiro(df["CD_MUNICIPIO_IBGE"]),
    }).dropna(subset=["sg_uf", "cd_uf", "cd_municipio"])


def _sidra(raiz: Path, tabela: str) -> pd.DataFrame | None:
    """Tabela do SIDRA baixada pelo crawler: cd_ibge, ano, variavel, valor."""
    caminho = next(iter(sorted((raiz / "ibge").rglob(f"*tabela{tabela}*.csv"))), None)
    if caminho is None:
        print(f"  aviso: tabela SIDRA {tabela} não encontrada em {raiz / 'ibge'}")
        return None
    df = pd.read_csv(caminho, sep=";", encoding="utf-8-sig", dtype=str, keep_default_na=False)
    return pd.DataFrame({
        "cd_ibge": _inteiro(df["Município (Código)"]), "ano": _inteiro(df["Ano"]),
        "variavel": df["Variável"].str.lower(), "valor": _decimal(df["Valor"]),
    }).dropna(subset=["cd_ibge", "ano"])


def indices(raiz: Path) -> pd.DataFrame:
    """Uma linha por (cd_ibge, ano) com idhm, pib, mediana_idade, indice_envelhecimento e populacao."""
    partes = []

    def serie(df: pd.DataFrame | None, nome: str, filtro: str | None = None) -> None:
        if df is None:
            return
        if filtro:
            df = df[df["variavel"].str.contains(filtro, regex=False)]
        partes.append(df.groupby(["cd_ibge", "ano"])["valor"].first().rename(nome))

    serie(_sidra(raiz, "5938"), "pib")
    serie(_sidra(raiz, "6579"), "populacao")
    serie(_sidra(raiz, "4709"), "populacao_censo")
    idade = _sidra(raiz, "9515")
    serie(idade, "mediana_idade", "mediana")
    serie(idade, "indice_envelhecimento", "envelhecimento")

    idhm = next(iter(sorted((raiz / "ipea_atlas").rglob("idhm*.csv"))), None)
    if idhm is None:
        print(f"  aviso: IDHM não encontrado em {raiz / 'ipea_atlas'}")
    else:
        df = pd.read_csv(idhm, sep=";", encoding="utf-8-sig", dtype=str, keep_default_na=False)
        df = pd.DataFrame({"cd_ibge": _inteiro(df["cod_ibge"]), "ano": _inteiro(df["ano"]), "idhm": _decimal(df["idhm"])})
        partes.append(df.dropna(subset=["cd_ibge", "ano"]).groupby(["cd_ibge", "ano"])["idhm"].first())

    colunas = ["cd_ibge", "ano", "idhm", "pib", "mediana_idade", "indice_envelhecimento", "populacao"]
    if not partes:
        return pd.DataFrame(columns=colunas)
    df = pd.concat(partes, axis=1).reset_index()
    for c in colunas:
        if c not in df:
            df[c] = pd.NA
    if "populacao_censo" in df:
        df["populacao"] = df["populacao"].fillna(df["populacao_censo"])
    df["populacao"] = df["populacao"].round().astype("Int64")
    return df[colunas]
