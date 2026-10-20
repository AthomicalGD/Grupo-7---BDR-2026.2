"""P9) Nuvem dos tipos de gasto de uma candidatura (2018, 2020, 2022 ou 2024).

Uso: python scripts/09_nuvem_despesas.py ID_POLITICO_ELEICAO
Saídas: respostas/09_nuvem_despesas_<id>.txt e .png

O tamanho de cada expressão na nuvem representa a soma, em reais da eleição, das despesas
contratadas daquela candidatura. O tipo declarado ao TSE tem prioridade; só nas categorias
genéricas a descrição livre é usada para reconhecer serviços específicos. O fornecedor não
determina o tipo de despesa, mas aparece no detalhamento da resposta.
"""
import argparse
import re
import unicodedata
from collections import defaultdict
from decimal import Decimal

from PIL import Image, ImageDraw, ImageFont
from wordcloud import WordCloud
from wordcloud.wordcloud import FONT_PATH

from comum import RESPOSTAS, conectar, gravar_txt

ANOS = (2018, 2020, 2022, 2024)
DOACAO = "Doações financeiras a outros candidatos/partidos"
GENERICO = {"servicos prestados por terceiros", "servicos proprios prestados por terceiros",
            "diversas a especificar", "outras despesas", "nao informado"}

# Ordem intencional: sinais específicos precedem termos mais amplos. A descrição só decide
# quando o tipo oficial é genérico. Não inferir atividade a partir de fornecedor ou CNAE.
REGRAS_DESCRICAO = (
    ("Propaganda digital", r"\b(?:impulsionamento|redes? sociais?|instagram|facebook|google ads|"
                            r"site|internet|midia digital)\b"),
    ("Propaganda audiovisual", r"\b(?:jingle|vinheta|video|filmagem|audiovisual|radio|televisao)\b"),
    ("Produção e gestão de conteúdo", r"\b(?:jornalismo|gestao de plataforma|producao de conteudo)\b"),
    ("Propaganda impressa", r"\b(?:santinhos?|panfletos?|folders?|cartazes?|banners?|"
                             r"adesivos?|bandeiras?|impressao|material grafico)\b"),
    ("Outras propagandas", r"\b(?:publicidade|propaganda)\b"),
    ("Mobilização e militância", r"\b(?:militancia|mobilizacao|panfletagem|carreata|"
                                    r"cabos? eleitorais?|comicio)\b"),
    ("Fiscalização da eleição", r"\b(?:fiscal(?:izacao)?|fiscais)\b.{0,35}\b(?:eleicao|urna|votacao)\b"),
    ("Transporte e veículos", r"\b(?:transporte|deslocamento|veiculos?|motoristas?|"
                               r"combustivel|gasolina|etanol|diesel|passagens?)\b"),
    ("Comunicação e assessoria", r"\b(?:comunicacao|marketing|assessoria de imprensa)\b"),
    ("Administração financeira", r"\b(?:administrador financeiro|gestao financeira)\b"),
    ("Serviços advocatícios", r"\b(?:advogad[oa]s?|advocacia|juridic[oa]s?)\b"),
    ("Serviços contábeis", r"\b(?:contabil|contabilidade|contador(?:a|es)?)\b"),
    ("Alimentação", r"\b(?:alimentacao|refeicoes?|lanches?|marmitas?)\b"),
    ("Eventos", r"\b(?:eventos?|palestras?|reunioes?)\b"),
    ("Estrutura e manutenção", r"\b(?:limpeza|manutencao|aluguel|locacao|comite|imoveis?)\b"),
)

SQL_CANDIDATURA = """
SELECT pe.id_politico_eleicao, pe.sq_candidato, p.nome, e.ano, e.tipo, c.nome AS cargo,
       COALESCE(m.nm_municipio, u.sigla, 'Brasil') AS localidade
FROM politico_eleicao pe
JOIN politico p ON p.id_politico = pe.id_politico
JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
JOIN cargo c ON c.cod_cargo = e.cod_cargo
LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
LEFT JOIN uf u ON u.cd_ibge = e.cd_uf
WHERE pe.id_politico_eleicao = %s
"""

SQL_DESPESAS = """
SELECT d.ds_origem_despesa, d.ds_despesa, d.vr_despesa_contratada,
       f.numero, f.nm_fornecedor
FROM despesa_de_campanha d
LEFT JOIN fornecedor f ON f.numero = d.numero_fornecedor
WHERE d.id_politico_eleicao = %s
  AND d.ds_origem_despesa IS DISTINCT FROM %s
"""


def normalizar(texto: str | None) -> str:
    sem_acentos = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in sem_acentos if not unicodedata.combining(c)).lower()


def classificar(origem: str | None, descricao: str | None) -> tuple[str, bool]:
    """Retorna (tipo de gasto, inferido da descrição em vez do tipo oficial)."""
    o = normalizar(origem).strip()
    if o and o not in GENERICO:
        if "publicidade por materiais impressos" in o or "publicidade por adesivos" in o:
            return "Propaganda impressa", False
        if "impulsionamento" in o or "paginas na internet" in o or "publicidade por internet" in o:
            return "Propaganda digital", False
        if any(t in o for t in ("jingles", "vinhetas", "programas de radio", "televisao", "video")):
            return "Propaganda audiovisual", False
        if "publicidade" in o or "propaganda" in o:
            return "Outras propagandas", False
        if "militancia" in o or "mobilizacao" in o or "comicios" in o:
            return "Mobilização e militância", False
        if "exceto veiculos" not in o and any(t in o for t in
                                                ("transporte", "deslocamento", "veiculos", "combustiveis", "passagem")):
            return "Transporte e veículos", False
        if "contabe" in o:
            return "Serviços contábeis", False
        if "advocatic" in o:
            return "Serviços advocatícios", False
        if "pessoal" in o:
            return "Pessoal", False
        if "evento" in o:
            return "Eventos", False
        if "alimentacao" in o:
            return "Alimentação", False
        # Conserva as categorias específicas menos comuns com o nome publicado pelo TSE.
        return (origem or "").strip(), False

    descricao_normalizada = normalizar(descricao)
    for rotulo, expressao in REGRAS_DESCRICAO:
        if re.search(expressao, descricao_normalizada):
            return rotulo, True
    return "Outros serviços (não identificados)" if o.startswith("servicos") else "Não especificado", False


def reais(valor: Decimal) -> str:
    return "R$ " + f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def calcular(despesas: list[tuple]) -> tuple[dict, int, int]:
    grupos = defaultdict(lambda: {"valor": Decimal(0), "quantidade": 0, "inferidas": 0,
                                  "fornecedores": defaultdict(lambda: [Decimal(0), 0]),
                                  "origens": defaultdict(Decimal),
                                  "descricoes_inferidas": defaultdict(Decimal)})
    zeradas = 0
    sem_fornecedor = 0
    for origem, descricao, valor, numero, nome in despesas:
        if valor <= 0:
            zeradas += 1
            continue
        rotulo, inferida = classificar(origem, descricao)
        grupo = grupos[rotulo]
        grupo["valor"] += valor
        grupo["quantidade"] += 1
        grupo["inferidas"] += int(inferida)
        grupo["origens"][origem.strip() if origem and origem.strip() else "(não informada)"] += valor
        if inferida:
            grupo["descricoes_inferidas"][(descricao or "").strip()] += valor
        if numero is None:
            sem_fornecedor += 1
            chave = (None, "(fornecedor não informado)")
        else:
            chave = (numero, nome.strip() if nome and nome.strip() else "(nome não informado)")
        grupo["fornecedores"][chave][0] += valor
        grupo["fornecedores"][chave][1] += 1
    return grupos, zeradas, sem_fornecedor


def texto_resposta(candidato: tuple, grupos: dict, zeradas: int, sem_fornecedor: int) -> str:
    id_, sq, nome, ano, _, cargo, localidade = candidato
    total = sum((g["valor"] for g in grupos.values()), Decimal(0))
    itens = sorted(grupos.items(), key=lambda item: (-item[1]["valor"], item[0]))
    out = [f"P9) Para onde foi o dinheiro da candidatura de {nome}?",
           f"Candidatura: {id_} | SQ_CANDIDATO: {sq} | {cargo} | {localidade} | {ano}", "",
           "Fonte: TSE, despesas contratadas declaradas pela candidatura; valores em reais do ano da eleição.",
           "Nuvem: tamanho da expressão proporcional à soma dos valores contratados por tipo de gasto.",
           "O tipo do TSE (DS_ORIGEM_DESPESA) prevalece; descrições livres (DS_DESPESA) só ajudam",
           "a identificar serviços nas categorias genéricas. Não se usa o nome/CNAE do fornecedor",
           "para inferir o tipo de gasto. Categorias sem identificação ficam explícitas.",
           f"Fora da conta: '{DOACAO}' (transferência que reaparece na campanha recebedora).",
           f"Despesas com valor zero: {zeradas}; registros com valor positivo sem fornecedor: {sem_fornecedor}.",
           f"Total analisado: {reais(total)} em {sum(g['quantidade'] for g in grupos.values())} despesas.", ""]
    if not itens:
        return "\n".join(out + ["Esta candidatura não tem despesas contratadas positivas no banco.", ""])

    out += ["Gastos por tipo (base da nuvem):", "  Tipo | despesas | valor | participação | inferidas da descrição"]
    for rotulo, g in itens:
        out.append(f"  {rotulo} | {g['quantidade']} | {reais(g['valor'])} | "
                   f"{100 * g['valor'] / total:.1f}% | {g['inferidas']}")
    out.append("")

    out += ["Fornecedores por tipo (até 5 maiores valores contratados em cada tipo):"]
    for rotulo, g in itens:
        out.append(f"  {rotulo} — {reais(g['valor'])}:")
        fornecedores = sorted(g["fornecedores"].items(), key=lambda item: (-item[1][0], item[0][1]))
        for (_, fornecedor), (valor, quantidade) in fornecedores[:5]:
            out.append(f"    {fornecedor}: {reais(valor)} ({quantidade} "
                       f"{'despesa' if quantidade == 1 else 'despesas'})")
        if len(fornecedores) > 5:
            out.append(f"    ... mais {len(fornecedores) - 5} fornecedor(es) nesse tipo.")
        origens = sorted(g["origens"].items(), key=lambda item: (-item[1], item[0]))
        out.append("    Categorias declaradas ao TSE: " + "; ".join(
            f"{origem} ({reais(valor)})" for origem, valor in origens))
        descricoes = sorted(g["descricoes_inferidas"].items(), key=lambda item: (-item[1], item[0]))
        for descricao, valor in descricoes[:3]:
            out.append(f"    Descrição declarada (classificada): {descricao} ({reais(valor)})")
    out += ["", "Observação: o fornecedor é o vinculado ao documento cadastrado no banco;",
            "quando falta documento, o banco não associa um fornecedor à despesa.", ""]
    return "\n".join(out)


def gravar_nuvem(caminho, grupos: dict) -> None:
    frequencias = {rotulo: float(g["valor"]) for rotulo, g in grupos.items()}
    if frequencias:
        nuvem = WordCloud(width=1600, height=900, font_path=FONT_PATH,
                          background_color="white", colormap="viridis",
                          prefer_horizontal=0.95, random_state=9, max_words=100,
                          collocations=False, margin=12)
        nuvem.generate_from_frequencies(frequencias)
        nuvem.to_file(str(caminho))
    else:
        imagem = Image.new("RGB", (1600, 900), "white")
        desenho = ImageDraw.Draw(imagem)
        fonte = ImageFont.truetype(FONT_PATH, 48)
        texto = "Sem despesas contratadas positivas"
        desenho.text((800, 450), texto, anchor="mm", font=fonte, fill="#333333")
        imagem.save(caminho)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("id_politico_eleicao", type=int, help="ID da candidatura no banco")
    args = parser.parse_args()
    if args.id_politico_eleicao <= 0:
        parser.error("o ID da candidatura precisa ser positivo")

    with conectar() as conn, conn.cursor() as cur:
        cur.execute(SQL_CANDIDATURA, (args.id_politico_eleicao,))
        candidato = cur.fetchone()
        if candidato is None:
            parser.error("candidatura não encontrada no banco")
        if candidato[3] not in ANOS or candidato[4] == 1:
            parser.error("a P9 cobre apenas eleições ordinárias de 2018, 2020, 2022 e 2024")
        cur.execute(SQL_DESPESAS, (args.id_politico_eleicao, DOACAO))
        grupos, zeradas, sem_fornecedor = calcular(cur.fetchall())

    nome = f"09_nuvem_despesas_{args.id_politico_eleicao}"
    RESPOSTAS.mkdir(exist_ok=True)
    png = RESPOSTAS / f"{nome}.png"
    gravar_nuvem(png, grupos)
    txt = gravar_txt(f"{nome}.txt", texto_resposta(candidato, grupos, zeradas, sem_fornecedor))
    print(f"gravado: {txt}\ngravado: {png}")


if __name__ == "__main__":
    main()
