---
name: Voto Aberto
description: Viés político de estados e municípios (2018-2024) e a carreira de cada político desde 1994, com dados abertos do TSE e do IBGE.
colors:
  papel: "#f2f4f5"
  papel-2: "#e6eaed"
  folha: "#fcfdfd"
  tinta: "#18202b"
  tinta-2: "#4b5566"
  tinta-3: "#5f6878"
  linha: "#d9dee2"
  linha-2: "#aeb6bf"
  acao: "#1f5f86"
  marcador: "#f7c21a"
  neutro: "#e8eaec"
  fita-verde: "#5e881b"
  fita-lima: "#a2bd31"
  fita-ardosia: "#5d6b94"
  fita-petroleo: "#468baf"
  fita-celeste: "#76acd0"
  fita-laranja: "#f19929"
  fita-amarelo: "#fbc700"
  confirma: "#3f7f2a"
  corrige: "#e5732a"
  branco-urna: "#f4f5f2"
  eleito: "#3f7f2a"
  reeleito: "#1f5f86"
  vies-esquerda: "#a43f00"
  vies-direita: "#235690"
  marca-verde: "#1f9a4e"
  marca-amarelo: "#fbc700"
  marca-azul: "#2b4c8c"
  gasto-inicio: "#edf8b4"
  gasto-fim: "#004529"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 1.4rem + 2.6vw, 3.8rem)"
    fontWeight: 780
    lineHeight: 0.98
    letterSpacing: "-0.018em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 1.3rem + 1.4vw, 2.45rem)"
    fontWeight: 760
    lineHeight: 1.04
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 106"
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.5625rem"
    fontWeight: 700
    lineHeight: 1.15
  subtitle:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.25
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
  numero:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontWeight: 820
    lineHeight: 1
    fontVariation: "'wdth' 74"
  mono:
    fontFamily: "Red Hat Mono Variable, Red Hat Mono, ui-monospace, monospace"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  marca: "4px"
  controle: "12px"
  cartao: "16px"
  painel: "20px"
  pilula: "9999px"
spacing:
  calha-celular: "16px"
  calha: "72px"
  colunas: "48px"
  secao: "36px"
components:
  botao-primario:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.folha}"
    rounded: "{rounded.pilula}"
    padding: "0 16px"
    height: "40px"
  tecla-confirma:
    backgroundColor: "{colors.confirma}"
    textColor: "#ffffff"
    rounded: "{rounded.pilula}"
    height: "44px"
  tecla-corrige:
    backgroundColor: "{colors.corrige}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pilula}"
    height: "44px"
  tecla-branco:
    backgroundColor: "{colors.branco-urna}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pilula}"
    height: "44px"
  campo-busca:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pilula}"
    height: "52px"
  cartao-estado:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.cartao}"
    padding: "12px 14px"
  boletim:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    padding: "28px 36px 48px"
  santinho:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.cartao}"
    width: "236px"
---

# Design System: Voto Aberto

## Overview

**Creative North Star: "A urna aberta"**

O sistema é feito dos objetos da eleição brasileira operando sobre dado real: a cédula marca o ano, o mapa colore o voto, a urna eletrônica busca o político, o boletim de urna sai impresso para cada município, os santinhos contam a carreira, o plenário mostra quanto custou cada cadeira e o recibo da prestação de contas diz para onde foi o dinheiro. A metáfora só existe porque ajuda a ler o dado; cada objeto é uma ferramenta, não um enfeite.

A superfície é clara e fria, de serviço público: papel cinza-azulado, tinta ardósia quase preta, uma família tipográfica em três larguras e sete fitas onduladas como assinatura. A cor forte é reservada ao dado (a escala do viés) e aos objetos que a pessoa reconhece (teclas da urna, carimbos dos santinhos). Densidade de aplicativo de dados, com respiro entre blocos.

Não imita o portal de resultados que serviu de referência nem se passa por órgão oficial: nenhum nome, brasão ou marca de tribunal; o rodapé diz que é projeto acadêmico.

**Key Characteristics:**
- Mapa como tese da primeira tela; painel à direita muda com a rota (Brasil, estado, município).
- Escala do viés contínua, laranja ↔ cinza ↔ azul, simétrica em 0, com "sem dados" sempre hachurado.
- Objetos da eleição com função: cédula (ano e filtros da busca), urna UE2020 (busca), boletim (município), santinho (eleição), plenário (cadeira), recibo (contas), ficha da carreira (político).
- Uma família (Archivo variável) em três larguras; mono só no papel térmico e no visor.
- Movimento único e motivado: câmera do mapa, onda dos municípios, impressão do boletim, leque dos santinhos, cadeiras que se sentam no plenário.

## Colors

Fundo frio de papel e tinta ardósia; cor saturada só no dado, nas fitas da marca e nas teclas da urna.

### Primary
- **Azul Ação** (#1f5f86): links, foco do teclado, valores de ação. Contraste 6,3:1 sobre o papel.
- **Amarelo Marcador** (#f7c21a): o sublinhado do item ativo da navegação e a seleção de texto. Nunca texto.

### Data (escala do viés)
- **Laranja Esquerda** (#a43f00 no extremo, −60): braço esquerdo da escala divergente.
- **Cinza Centro** (#e8eaec, 0): ponto médio neutro; nunca uma matiz.
- **Azul Direita** (#235690 no extremo, +60): braço direito.
- A escala é calculada em OKLCH (`web/src/lib/vies.ts`): cada braço mantém a matiz, luminosidade e croma variam juntos, os dois braços têm o mesmo passo de luminosidade. Satura em ±60; no modo relativo ao estado, em ±20.

### Data (gasto de campanha, P1)
- **Rampa amarelo → verde**: ColorBrewer YlGn (sequencial validado), a partir de 16% para não sumir no papel (`web/src/cadeira/geometria.ts`). As duas pontas são as cores da bandeira; quanto mais verde, mais cara a campanha.
- Linear quando os gastos ficam na mesma ordem de grandeza; logarítmica quando o maior passa de 40 vezes o menor (a legenda diz "escala logarítmica").
- Nunca usada para viés; o partido continua com a cor do seu viés (barras do preço por partido).

### Tertiary (fitas, assinatura)
- **Fitas** (#5e881b, #a2bd31, #5d6b94, #468baf, #76acd0, #f19929, #fbc700): a faixa ondulada do cabeçalho e do rodapé, a tira do santinho e da cédula de consulta. A do cabeçalho só ondula enquanto a API responde. Nunca carregam informação nem texto.
- **Marca** (verde #1f9a4e, amarelo #fbc700, azul #2b4c8c): só no símbolo, que remete à bandeira (losango, globo, faixa e estrelas).

### Neutral
- **Papel** (#f2f4f5): fundo da página. **Papel 2** (#e6eaed): barra utilitária, chips "sem dados".
- **Folha** (#fcfdfd): superfícies que são objetos de papel (boletim, santinho, cartões, campos).
- **Tinta** (#18202b, 14,9:1), **Tinta 2** (#4b5566, 6,8:1), **Tinta 3** (#5f6878, 5,1:1): texto principal, secundário e rótulos.
- **Linha** (#d9dee2) e **Linha 2** (#aeb6bf): divisórias, grade dos gráficos, bordas de campo.

### Named Rules
**A Regra do Dado Colorido.** A cor saturada mostra viés, gasto, resultado ou tecla; tudo o mais é papel, tinta e linha.
**A Regra da Ausência Visível.** Estado não carregado é hachura com rótulo, nunca uma cor da escala; partido sem viés aparece como "não informado".

## Typography

**Display Font:** Archivo Variable (eixos `wght` 100-900 e `wdth` 62-125)
**Body Font:** Archivo Variable
**Label/Mono Font:** Red Hat Mono Variable (papel térmico e visor da urna)

**Character:** uma grotesca latino-americana (Omnibus-Type) usada em três larguras: expandida para a tese, normal para ler, condensada para os números. A mono existe só onde o objeto real imprime em mono.

### Hierarchy
- **Display** (780, clamp(2.4rem → 3.8rem), 0.98, `wdth` 112): a tese de cada tela ("Para onde o voto pendeu").
- **Headline** (760, clamp(1.9rem → 2.45rem), 1.04, `wdth` 106): nome do estado, do município, do político.
- **Title** (700, 1.5625rem, 1.15): seções de página.
- **Subtitle** (650, 1.25rem, 1.25): títulos de gráficos e blocos.
- **Body** (400, 1rem, 1.55): textos explicativos, até ~54ch na coluna do painel.
- **Label** (600, 0.8125rem, 1.3): rótulos, legendas, metadados.
- **Número** (820, `wdth` 74): valores de viés e votos em destaque; algarismos proporcionais. Tabelas e eixos usam `tabular-nums`.

### Named Rules
**A Regra de Uma Família.** Hierarquia por largura e peso do Archivo, nunca por uma segunda família de exibição.
**A Regra do Sinal Tipográfico.** Viés negativo usa o sinal de menos (−), não hífen; números em pt-BR (vírgula decimal, ponto de milhar).

## Layout

Grade de 12 colunas com `max-width: 1440px` e calha de 72px (16px no celular). No atlas, o mapa ocupa 7/12 e fica fixo enquanto o painel (5/12) rola; abaixo de 1024px o mapa vai para cima com 58dvh e o painel desce. O cabeçalho é fixo (72px + 9px de fita); a barra utilitária (32px) rola. Espaço maior acima do título que abaixo; seções do painel separadas por 36px. Nenhuma tela tem rolagem horizontal em 390px (verificado nos testes).

## Elevation & Depth

Plano por padrão; profundidade só para objetos de papel e camadas flutuantes. Sombras tingidas de ardósia, nunca preto puro.

### Shadow Vocabulary
- **Cartão** (`0 1px 2px rgb(42 53 80 / .06), 0 6px 18px -8px rgb(42 53 80 / .18)`): cédula, santinho, controles do mapa, cartão hover.
- **Papel** (`0 1px 0 rgb(42 53 80 / .04), 0 12px 32px -12px rgb(42 53 80 / .22)`): tooltips, listas de busca.
- **Boletim** (`drop-shadow(0 14px 22px rgb(42 53 80 / .16))`): acompanha o serrilhado do papel térmico.

### Named Rules
**A Regra do Papel.** Só o que é papel no mundo real (boletim, santinho, cédula) ganha sombra de objeto; o resto é plano.

## Shapes

Contêineres com 16px de raio, painéis do mapa e do relevo com 20px, controles em pílula, marcas de dados com 3-5px na ponta e o mapa sem raio. O boletim termina em serrilhado (máscara `conic-gradient`, dente de 14px) e sai de uma fenda escura de 12px. Os carimbos dos santinhos são retângulos com 5px de raio, girados −6°.

## Components

### Botões
- **Forma:** pílula.
- **Primário:** tinta com texto branco, 40px de altura ("Linha do tempo").
- **Teclas da urna:** CONFIRMA verde (#3f7f2a, texto branco), CORRIGE laranja (#e5732a, texto tinta), BRANCO (#f4f5f2, borda); sombra sólida de 3px embaixo que some no `:active` (a tecla afunda).
- **Hover / Focus:** foco com contorno de 3px em Azul Ação, deslocado 2px.

### Cédula de anos
Grupo de rádio com quatro casas; a casa marcada desenha um X em dois traços (180ms cada). Setas mudam o ano; "Linha do tempo" percorre 2018 → 2024 a cada 1,6s.

### Campos
- **Busca:** pílula de 52px, borda 1,5px Linha 2, que vira Tinta no foco; combobox ARIA com lista em cartão de papel.

### Navegação
Logo à esquerda, três itens à direita; o ativo em semibold com um marcador amarelo de 4px que desliza entre os itens (mola). Abaixo de 420px, o logo vira só o símbolo.

### Mapa
SVG com a malha do IBGE, câmera `d3-zoom` com transição suave (van Wijk) entre Brasil, estado e município; contornos que não engrossam com o zoom; estados navegáveis por Tab e Enter.

### Boletim do Município (assinatura)
Papel térmico com cabeçalho em mono, picotes tracejados entre seções, linhas impressas em cascata (90ms) e QR code real da página.

### Santinho (assinatura)
Cartão de 236px com a tira das sete fitas, foto de registro, ano em Archivo condensada, cargo, local, partido, votos e carimbo do resultado.

### Urna (assinatura)
Desenhada em vetor, de frente, com as proporções medidas numa foto do terminal do eleitor UE2020 (a versão 3D saiu: o desenho fiel lê melhor e pesa menos). Corpo cinza-claro fosco com grão (textura gerada uma vez, não filtro), visor TFT largo e branco em moldura preta (texto preto em sans, foto à direita, rodapé "Aperte a tecla:"), teclas numéricas grafite com braile e marca tátil no 5, coluna BRANCO (#f2f3f1), CORRIGE (#ee7a21) e CONFIRMA (#2fb46c, mais alta), área gravada no canto. Som sintetizado com os parâmetros medidos da urna real: senoide de ~2.300 Hz na tecla, dois bipes no CORRIGE e o trinado 2.300/2.200 Hz do fim do voto. As teclas são botões (clique, toque, Tab + Enter) e afundam 2,4 px quando apertadas, inclusive pelo teclado do computador. Com filtros, o visor mostra a consulta como a urna mostra o cargo: "CONSULTA PARA SENADOR · PI · 2022".

### Plenário (assinatura, P1)
Hemiciclo em que cada cadeira é um eleito, vista de cima (assento na cor do gasto, encosto em tinta), numerada da esquerda para a direita pelo gasto ou pelos partidos na ordem da escala de viés. O custo da cadeira fica no miolo; em telas estreitas desce para baixo do arco. As cadeiras "sentam" em varredura (520ms, atraso até 650ms) quando a seleção muda e deslizam quando a ordem muda. Cartão com foto ao passar o mouse, setas do teclado percorrem, Enter abre a carreira; no toque, o primeiro toque mostra e o segundo abre. Vista "Em pé" (3D): colunas com altura linear ao gasto e a cadeira em cima.

### Cédula de consulta (filtros da busca)
Papel com a tira das sete fitas no topo e picotes entre as linhas: cargo, eleição (gerais e municipais em duas colunas cronológicas), estado (com a silhueta), partido (da esquerda para a direita, a casa pintada com a cor do viés) e resultado. Tudo se marca com X na casa, como a cédula de anos; uma marca por linha, marcar de novo desmarca, linha sem marca vale tudo. Recolhida, mostra as marcas como fichas removíveis. Tab entra em cada linha e as setas andam pelas casas.

### Ficha da carreira
Retrato 3x4 com borda de papel e o carimbo da situação (em mandato até, sem mandato desde, nunca eleito) na tinta dos carimbos dos santinhos; a fita da carreira (uma casa por eleição, cheia quando venceu, levando ao santinho); a resposta em texto com o contexto da reeleição do cargo na UF; trajetória com a faixa dos partidos na cor do viés.

### Recibo da prestação de contas
Papel térmico com o mesmo picote do boletim, em Red Hat Mono 500, itens com pontilhado até o valor, total e "÷ N cadeiras". Só para despesas; receitas são uma barra única pelas fontes, com o dinheiro público primeiro.

### Loading Apuração
O símbolo da marca trabalhando: as quatro barras sobem e descem como uma contagem (1,6s, defasadas) e a faixa e as estrelas do globo giram dentro do V (2,8s por volta); o visto fica parado. Com movimento reduzido, é o símbolo estático.

## Do's and Don'ts

### Do:
- **Do** pintar viés só com `corVies()` (OKLCH, simétrico em 0); no modo relativo, saturar em ±20 e trocar a legenda.
- **Do** mostrar ausência explicitamente: hachura para estado sem dados, "não informado" para partido sem viés, iniciais quando não há foto.
- **Do** dar a cada gráfico tooltip no hover e no foco e a tabela equivalente ("Ver tabela").
- **Do** animar só `transform`, `opacity` e `fill`, com `cubic-bezier(.16,1,.3,1)`, e respeitar `prefers-reduced-motion`.
- **Do** deixar a página parada sem custo: nenhuma animação infinita, 3D só desenha sob demanda, ponteiro não re-renderiza listas grandes.
- **Do** usar a escala tipográfica do Archivo (larguras 112/106/100/74) e algarismos tabulares em tabelas e eixos.

### Don't:
- **Don't** usar nome, brasão ou marca de órgão oficial; o rodapé sempre diz que não é site da Justiça Eleitoral.
- **Don't** pôr texto nas cores das fitas ou da escala do viés; texto usa as tintas.
- **Don't** inventar cor de partido: a cor do partido é o seu viés.
- **Don't** usar travessão (— ou –) em texto visível; use vírgula, ponto ou hífen.
- **Don't** usar spinner circular genérico; o loading é o símbolo apurando.
- **Don't** mostrar CPF, título eleitoral ou data completa de nascimento.
