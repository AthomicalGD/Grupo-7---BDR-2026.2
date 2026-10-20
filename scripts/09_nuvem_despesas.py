"""P9) Nuvem dos tipos de gasto de uma candidatura (2018, 2020, 2022 ou 2024).

Uso: python scripts/09_nuvem_despesas.py ID_POLITICO_ELEICAO
     python scripts/09_nuvem_despesas.py --auditar
Saídas: respostas/09_nuvem_despesas/<ano>_<nome>_<id>.txt e .png;
        respostas/09_nuvem_despesas/auditoria_classificacao.txt

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
PASTA_SAIDA = "09_nuvem_despesas"
GENERICO = {"servicos prestados por terceiros", "servicos proprios prestados por terceiros",
            "diversas a especificar", "outras despesas", "nao informado", "nao especificado"}
FONTES = ("tipo TSE", "descrição", "sem identificação")

# Ordem intencional: sinais específicos precedem termos mais amplos. A descrição só decide
# quando o tipo oficial é genérico. Não inferir atividade a partir de fornecedor ou CNAE.
REGRAS_DESCRICAO = tuple((rotulo, re.compile(expressao)) for rotulo, expressao in (
    ("Propaganda digital", r"\b(?:impulsionament\w*|facebook ads|google ads|"
                           r"insercao de anuncios na internet|trafego pago)\b"),
    ("Internet e telefonia", r"\b(?:servicos? de internet|acesso a internet|telefonia)\b"),
    ("Propaganda audiovisual", r"\b(?:jingles?|vinhetas?|videos?|filmagens?|filmes?|"
                              r"fotografi\w*|cinematografi\w*|audiovisual|"
                              r"cinegrafistas?|radio|televisao|tv|locu(?:cao|tores?))\b"),
    ("Comunicação digital", r"\b(?:midias? sociais?|redes? sociais?|marketing digital|mk digital|"
                           r"social midia\w*|webmonitoramento|plataforma web\w*|plataformas? digitais?|"
                           r"comunic(?:acao)? dig\w*|monitoramento digital|sites?|internet)\b"),
    ("Comunicação e assessoria", r"\b(?:assessoria de imprensa|clipping|monitoramento de radios?|"
                                 r"monitoramento noticiario|comunicacao|assessoria de comunicacao)\b"),
    ("Produção e gestão de conteúdo", r"\b(?:jornalismo|gestao de plataforma|producao de conteudo|"
                                    r"reporteres?|edicao de textos?)\b"),
    ("Propaganda sonora", r"\b(?:carros? de som|reboque de som|som automotivo|"
                           r"trios? eletricos?|operador(?:a|es)? de som|sonorizacao)\b"),
    ("Propaganda impressa", r"\b(?:santinhos?|panfletos?|folders?|cartazes?|banners?|"
                             r"adesivos?|bandeiras?|impressao|impressas?|material grafico)\b"),
    ("Mobilização e militância", r"\b(?:militancia|mobilizacao|panfletagem|"
                                    r"panflet(?:agem|eiros?)|panfelt(?:eiros?)|"
                                    r"carreatas?|cabos? eleitora(?:l|is)|comicios?)\b"),
    ("Fiscalização da eleição", r"\b(?:fiscal(?:izacao)?|fiscais)\b.{0,35}\b(?:eleicao|urna|votacao)\b"),
    ("Transporte e veículos", r"\b(?:transporte|deslocamento|veiculos?|motoristas?|"
                               r"combustivel|gasolina|etanol|diesel|passagens?)\b"),
    ("Serviços advocatícios", r"\b(?:advogad[oa]s?|advocacia|advocatic\w*|juridic\w*)\b"),
    ("Serviços contábeis", r"\b(?:contab\w*|contador(?:a|es)?)\b"),
    ("Segurança", r"\b(?:vigilancia|vigias?|seguranca armada|segurancas?)\b"),
    ("Administração financeira", r"\b(?:administrador financeiro|gestao financeira)\b"),
    ("Coordenação de campanha", r"\b(?:coordenac\w*|coordenador\w*|coord\.? de campanha)\b"),
    ("Estratégia política", r"\bestrategia politica\b"),
    ("Planejamento de campanha", r"\b(?:planejamento de campanhas?|planej\w* estrategic\w*|"
                                r"estrategia de campanha|criacao de planejamento de campanhas?)\b"),
    ("Tecnologia e dados", r"\b(?:gestao de base de dados|desenvolv\w* tec\w* da informacao|"
                          r"licenca de uso|computacao grafica)\b"),
    ("Administração e apoio", r"\b(?:almoxarife|assistente administrativo|apoio administrativo|"
                              r"auxiliar de servicos gerais|assitente administrativo|"
                              r"assistente (?:de equipe|de campanha)|servicos? administrativos?|"
                              r"contratacao de pessoal|aux(?:iliar)? (?:de )?adm\w*|"
                              r"recepcionistas?)\b"),
    ("Assessoria de campanha", r"\bassessoria de campanha\b"),
    ("Marketing de campanha", r"\b(?:marketing|mk politico)\b"),
    ("Outras propagandas", r"\b(?:publicidade|propaganda|anuncios?|divulgacao|publicitari\w*)\b"),
    ("Pessoal", r"\bdespesas? com pessoal\b"),
    ("Alimentação", r"\b(?:alimentacao|refeicoes?|lanches?|marmitas?)\b"),
    ("Água", r"\bagua (?:mineral|copo|para consumo)\b"),
    ("Mascotes de campanha", r"\bmascotes?\b"),
    ("Indenização de veículo", r"\b(?:indeniza\w* sinistro veicular)\b"),
    ("Fogos de artifício", r"\b(?:foguetes?|girandolas?|fogos? de artificio)\b"),
    ("Eventos", r"\b(?:eventos?|palestras?|reunioes?)\b"),
    ("Estrutura e manutenção", r"\b(?:limpeza|manutencao|eletricistas?|"
                                r"locacao de equipamentos?|instalacao do comite|"
                                r"operac\w* do comite|montagem de estruturas?)\b"),
))

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

# A auditoria agrupa descrições repetidas no banco antes de aplicar as mesmas regras
# da candidatura; não depende de nomes de fornecedores nem cria categorias particulares.
SQL_AUDITORIA = """
SELECT e.ano, d.ds_origem_despesa, d.ds_despesa,
       count(*) AS quantidade, sum(d.vr_despesa_contratada) AS valor
FROM despesa_de_campanha d
JOIN politico_eleicao pe ON pe.id_politico_eleicao = d.id_politico_eleicao
JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
WHERE e.ano = ANY(%s) AND e.tipo <> 1 AND d.vr_despesa_contratada > 0
  AND d.ds_origem_despesa IS DISTINCT FROM %s
GROUP BY e.ano, d.ds_origem_despesa, d.ds_despesa
"""


def normalizar(texto: str | None) -> str:
    sem_acentos = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in sem_acentos if not unicodedata.combining(c)).lower()


def nome_arquivo(candidato: tuple) -> str:
    """Ano, nome civil e ID: legível, estável nesta carga e sem colisão entre eleições."""
    id_, _, nome, ano, *_ = candidato
    slug = re.sub(r"[^a-z0-9]+", "_", normalizar(nome)).strip("_")
    return f"{ano}_{slug}_{id_}"


def fonte_classificacao(rotulo: str, inferida: bool) -> str:
    if inferida:
        return FONTES[1]
    if rotulo in {"Outros serviços (não identificados)", "Não especificado"}:
        return FONTES[2]
    return FONTES[0]


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
        if "publicidade por carros de som" in o:
            return "Propaganda sonora", False
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
        if expressao.search(descricao_normalizada):
            return rotulo, True
    return "Outros serviços (não identificados)" if o.startswith("servicos") else "Não especificado", False


def reais(valor: Decimal) -> str:
    return "R$ " + f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def calcular(despesas: list[tuple]) -> tuple[dict, int, int, dict]:
    grupos = defaultdict(lambda: {"valor": Decimal(0), "quantidade": 0, "inferidas": 0,
                                  "fornecedores": defaultdict(lambda: [Decimal(0), 0]),
                                  "origens": defaultdict(Decimal),
                                  "descricoes_inferidas": defaultdict(Decimal)})
    zeradas = 0
    sem_fornecedor = 0
    cobertura = {fonte: [0, Decimal(0)] for fonte in FONTES}
    for origem, descricao, valor, numero, nome in despesas:
        if valor <= 0:
            zeradas += 1
            continue
        rotulo, inferida = classificar(origem, descricao)
        dados_fonte = cobertura[fonte_classificacao(rotulo, inferida)]
        dados_fonte[0] += 1
        dados_fonte[1] += valor
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
    return grupos, zeradas, sem_fornecedor, cobertura


def linhas_cobertura(cobertura: dict) -> list[str]:
    total = sum((valor for _, valor in cobertura.values()), Decimal(0))
    return [f"  {fonte}: {quantidade} {'despesa' if quantidade == 1 else 'despesas'}, {reais(valor)} "
            f"({100 * valor / total:.1f}% do valor)" if total else
            f"  {fonte}: 0 despesas, R$ 0,00 (-)"
            for fonte, (quantidade, valor) in cobertura.items()]


def texto_resposta(candidato: tuple, grupos: dict, zeradas: int, sem_fornecedor: int, cobertura: dict) -> str:
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
           f"Total analisado: {reais(total)} em {sum(g['quantidade'] for g in grupos.values())} despesas.",
           "Cobertura da classificação por valor:", *linhas_cobertura(cobertura), ""]
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


def auditar(conn) -> str:
    """Resumo por ano e maiores descrições ainda sem tipo; leitura em lotes pelo cursor servidor."""
    anos = {ano: {fonte: [0, Decimal(0)] for fonte in FONTES} for ano in ANOS}
    pendencias = defaultdict(lambda: [0, Decimal(0)])
    with conn.cursor(name="auditoria_p9") as cur:
        cur.itersize = 2000
        cur.execute(SQL_AUDITORIA, (list(ANOS), DOACAO))
        for ano, origem, descricao, quantidade, valor in cur:
            rotulo, inferida = classificar(origem, descricao)
            fonte = fonte_classificacao(rotulo, inferida)
            anos[ano][fonte][0] += quantidade
            anos[ano][fonte][1] += valor
            if fonte == FONTES[2]:
                item = pendencias[(ano, origem or "(não informada)", descricao or "(sem descrição)")]
                item[0] += quantidade
                item[1] += valor
    out = ["P9) Auditoria das classificações por ano (somente UFs carregadas)",
           "Despesas contratadas positivas de eleições ordinárias, sem transferências entre campanhas.",
           "Prioridade de revisão: maiores valores que continuam sem identificação, não nomes de fornecedores.", ""]
    for ano, cobertura in anos.items():
        out += [f"Ano: {ano}", *linhas_cobertura(cobertura), ""]
        maiores = sorted(((k, v) for k, v in pendencias.items() if k[0] == ano),
                         key=lambda item: (-item[1][1], item[0]))[:20]
        out.append("  Maiores descrições ainda sem identificação:")
        for (_, origem, descricao), (quantidade, valor) in maiores:
            out.append(f"    {reais(Decimal(valor))} | {quantidade} "
                       f"{'despesa' if quantidade == 1 else 'despesas'} | {origem} | {descricao}")
        out.append("")
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("id_politico_eleicao", nargs="?", type=int, help="ID da candidatura no banco")
    parser.add_argument("--auditar", action="store_true", help="resumo por ano e maiores gastos não classificados")
    args = parser.parse_args()
    if args.auditar:
        if args.id_politico_eleicao is not None:
            parser.error("use um ID de candidatura ou --auditar, não ambos")
        with conectar() as conn:
            texto = auditar(conn)
        (RESPOSTAS / PASTA_SAIDA).mkdir(parents=True, exist_ok=True)
        print(f"gravado: {gravar_txt(f'{PASTA_SAIDA}/auditoria_classificacao.txt', texto)}")
        return
    if args.id_politico_eleicao is None:
        parser.error("informe o ID da candidatura ou use --auditar")
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
        grupos, zeradas, sem_fornecedor, cobertura = calcular(cur.fetchall())

    nome = nome_arquivo(candidato)
    pasta = RESPOSTAS / PASTA_SAIDA
    pasta.mkdir(parents=True, exist_ok=True)
    png = pasta / f"{nome}.png"
    gravar_nuvem(png, grupos)
    txt = gravar_txt(f"{PASTA_SAIDA}/{nome}.txt",
                     texto_resposta(candidato, grupos, zeradas, sem_fornecedor, cobertura))
    print(f"gravado: {txt}\ngravado: {png}")


if __name__ == "__main__":
    main()
