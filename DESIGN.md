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
  escola-inicio: "#f9e99a"
  escola-fim: "#1c3e81"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.1rem + 2vw, 3.1rem)"
    fontWeight: 780
    lineHeight: 0.98
    letterSpacing: "-0.018em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 1.1rem + 1.05vw, 2.1rem)"
    fontWeight: 760
    lineHeight: 1.04
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 106"
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.18
  subtitle:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
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
    backgroundColor: "cores do Brasil por cargo, matiz puxado pelo viés (COR_CARGO)"
    textColor: "{colors.folha} (tinta nos amarelos)"
    rounded: "10px"
    width: "236px"
    height: "404px"
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
- Movimento único e motivado: câmera do mapa, onda dos municípios, impressão do boletim, leque dos santinhos (que viram para a cola), cadeiras que se sentam no plenário.

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

### Data (escolaridade, P4)
- **Escala da bandeira** (#f9e99a → #1c3e81): os 8 graus do TSE, de analfabeto (amarelo claro) a superior completo (azul fechado), feita das âncoras da marca: o amarelo #fbc700, o verde #1f9a4e e o azul #2b4c8c, em OKLCH com a luminosidade sempre caindo (0,93 → 0,38), então a ordem se lê do claro ao escuro. Quanto mais estudo, mais fundo o azul. Em `web/src/escola/escolaridade.ts`.
- Os tons claros levam contorno de tinta a 20% sobre a folha, para não sumir. Texto em tinta sobre os quatro tons claros e em folha sobre os quatro escuros.
- O grau em destaque ganha contorno de tinta de 1,2px nas suas unidades; os outros recuam a 30% de opacidade, e a composição continua à vista. Unidade vazia (fora da conta) é folha com contorno #87919d (3,1:1).
- Só existe na página da Escola; o viés continua laranja ↔ azul e o gasto amarelo → verde em suas páginas.

### Tertiary (fitas, assinatura)
- **Fitas** (#5e881b, #a2bd31, #5d6b94, #468baf, #76acd0, #f19929, #fbc700): a faixa ondulada do cabeçalho e do rodapé, a tira do santinho e da cédula de consulta. A do cabeçalho só ondula enquanto a API responde. Nunca carregam informação nem texto.
- **Marca** (verde #1f9a4e, amarelo #fbc700, azul #2b4c8c): só no símbolo, que remete à bandeira (losango, globo, faixa e estrelas).

### Neutral
- **Papel** (#f2f4f5): fundo da página. **Papel 2** (#e6eaed): barra utilitária, chips "sem dados".
- **Folha** (#fcfdfd): superfícies que são objetos de papel (boletim, verso do santinho, cartões, campos).
- **Tinta** (#18202b, 14,9:1), **Tinta 2** (#4b5566, 6,8:1), **Tinta 3** (#5f6878, 5,1:1): texto principal, secundário e rótulos.
- **Linha** (#d9dee2) e **Linha 2** (#aeb6bf): divisórias, grade dos gráficos, bordas de campo.

### Named Rules
**A Regra do Dado Colorido.** A cor saturada mostra viés, gasto, escolaridade, resultado ou tecla; tudo o mais é papel, tinta e linha.
**A Regra da Ausência Visível.** Estado não carregado é hachura com rótulo, nunca uma cor da escala; partido sem viés aparece como "não informado".

## Typography

**Display Font:** Archivo Variable (eixos `wght` 100-900 e `wdth` 62-125)
**Body Font:** Archivo Variable
**Label/Mono Font:** Red Hat Mono Variable (papel térmico e visor da urna)

**Character:** uma grotesca latino-americana (Omnibus-Type) usada em três larguras: expandida para a tese, normal para ler, condensada para os números. A mono existe só onde o objeto real imprime em mono.

### Hierarchy
- **Display** (780, clamp(2rem → 3.1rem), 0.98, `wdth` 112): a tese de cada tela ("Para onde o voto pendeu").
- **Headline** (760, clamp(1.6rem → 2.1rem), 1.04, `wdth` 106): nome do estado, do município, do político.
- **Title** (700, 1.375rem, 1.18): seções de página.
- **Subtitle** (650, 1.125rem, 1.25): títulos de gráficos e blocos.
- **Body** (400, 1rem, 1.55): textos explicativos, até ~54ch na coluna do painel.
- **Label** (600, 0.8125rem, 1.3): rótulos, legendas, metadados.
- **Número** (820, `wdth` 74): valores de viés e votos em destaque; algarismos proporcionais. Tabelas e eixos usam `tabular-nums`.

### Named Rules
**A Regra de Uma Família.** Hierarquia por largura e peso do Archivo, nunca por uma segunda família de exibição.
**A Regra do Sinal Tipográfico.** Viés negativo usa o sinal de menos (−), não hífen; números em pt-BR (vírgula decimal, ponto de milhar).

## Layout

Grade de 12 colunas com `max-width: 1440px` e calha de 72px (16px no celular). No atlas, o mapa ocupa 7/12 e fica fixo enquanto o painel (5/12) rola; abaixo de 1024px o mapa vai para cima com 58dvh e o painel desce. O cabeçalho é fixo (56px + 9px de fita); a barra utilitária (28px) rola. Espaço maior acima do título que abaixo; seções do painel separadas por 28px e seções de página por 64px. Nenhuma tela tem rolagem horizontal em 390px (verificado nos testes).

**A Regra da Janela de Notebook.** Cada grupo que se lê junto (um gráfico com a sua legenda e o seu número, o mapa com o boletim, os dois anos de uma comparação) cabe inteiro numa janela de 1366×657 (um notebook com a barra do navegador), sem zoom. Desenhos grandes se limitam pela altura da janela com `dvh`: a urna, o plenário da Cadeira (`min(1180px, (100dvh − 120px) × 1,92)`), o mapa da Escola e a coluna fixa do atlas. Os objetos da Escola não passam de ~200px de altura.

## Elevation & Depth

Plano por padrão; profundidade só para objetos de papel e camadas flutuantes. Sombras tingidas de ardósia, nunca preto puro.

### Shadow Vocabulary
- **Cartão** (`0 1px 2px rgb(42 53 80 / .06), 0 6px 18px -8px rgb(42 53 80 / .18)`): cédula, santinho, controles do mapa, cartão hover.
- **Papel** (`0 1px 0 rgb(42 53 80 / .04), 0 12px 32px -12px rgb(42 53 80 / .22)`): tooltips, listas de busca.
- **Boletim** (`drop-shadow(0 14px 22px rgb(42 53 80 / .16))`): acompanha o serrilhado do papel térmico.

### Named Rules
**A Regra do Papel.** Só o que é papel no mundo real (boletim, santinho, cédula) ganha sombra de objeto; o resto é plano.

## Shapes

Contêineres com 16px de raio, painéis do mapa e do relevo com 20px, controles em pílula, marcas de dados com 3-5px na ponta e o mapa sem raio. O boletim termina em serrilhado (máscara `conic-gradient`, dente de 14px) e sai de uma fenda escura de 12px. Os carimbos dos santinhos são retângulos com 4px de raio, girados −8°.

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
Logo à esquerda, cinco itens à direita (Mapa, Urna, Cadeira, Escola, Metodologia); o ativo em semibold com um marcador amarelo de 4px que desliza entre os itens (mola). Abaixo de 420px, o logo vira só o símbolo.

### Mapa
SVG com a malha do IBGE, câmera `d3-zoom` com transição suave (van Wijk) entre Brasil, estado e município; contornos que não engrossam com o zoom; estados navegáveis por Tab e Enter.

### Boletim do Município (assinatura)
Papel térmico com cabeçalho em mono, picotes tracejados entre seções, linhas impressas em cascata (90ms) e QR code real da página.

### Santinho (assinatura)
O impresso de campanha, 236×404px. Frente nas cores do Brasil: a família de cor vem do cargo (Presidência azul-anil, Governo verde-bandeira, Senado azul, Câmara verde-mata, Assembleia verde-folha, Prefeitura amarelo-ouro, Câmara Municipal amarelo-sol), em degradê de gráfica com retícula de meio-tom, e o viés do partido puxa o matiz até 15° (esquerda mais quente, direita mais fria); o ano em pé numa faixa à esquerda; a foto de registro inteira e no tamanho do TSE (161×225, nunca esticada nem cortada), sangrando no topo e na direita; as sete fitas da marca em onda cruzando o pé da foto, como a faixa dos santinhos; o carimbo do resultado sobre o canto da foto; o nome de urna do TSE em Archivo condensada black caixa-alta; cargo e sigla do partido em pílula branca com a bolinha na cor exata do viés (a escala da P7); o número em casas brancas como no visor da urna, o maior elemento; a letra miúda "Dados do TSE · não é material de campanha" no lugar do CNPJ da gráfica. Sem foto (antes de 2004) vira santinho tipográfico: as iniciais enormes na própria cor. Clicar vira o santinho: um giro 3D de 780ms em que ele sobe 18px e cresce 7% no meio da volta, passa 12° do ponto e assenta como papel, com a sombra crescendo no chão e um brilho de papel cruzando a face que chega (branco na frente, azul-branco-amarelo no verso); só transform e opacity pela Web Animations API, nada roda parado e "reduzir movimento" vira na hora. o verso, em folha, é a cola para a urna ("Para senador, digite" + o número) com onde, partido, viés do partido, votos, resultado, gasto e custo por voto, e o boletim do município quando é eleição municipal. A face escondida fica `inert`, e o foco passa para o botão da outra face. Nunca escrever "vote"; não é propaganda.

### Urna (assinatura)
Desenhada em vetor, de frente, com as proporções medidas numa foto do terminal do eleitor UE2020 (a versão 3D saiu: o desenho fiel lê melhor e pesa menos). Corpo cinza-claro fosco com grão (textura gerada uma vez, não filtro), visor TFT largo e branco em moldura preta (texto preto em sans, foto à direita, rodapé "Aperte a tecla:"), teclas numéricas grafite com braile e marca tátil no 5, coluna BRANCO (#f2f3f1), CORRIGE (#ee7a21) e CONFIRMA (#2fb46c, mais alta), área gravada no canto. Som sintetizado com os parâmetros medidos da urna real: senoide de ~2.300 Hz na tecla, dois bipes no CORRIGE e o trinado 2.300/2.200 Hz do fim do voto. As teclas são botões (clique, toque, Tab + Enter) e afundam 2,4 px quando apertadas, inclusive pelo teclado do computador. Com filtros, o visor mostra a consulta como a urna mostra o cargo: "CONSULTA PARA SENADOR · PI · 2022".

### Plenário (assinatura, P1)
Hemiciclo em que cada cadeira é um eleito, vista de cima (assento na cor do gasto, encosto em tinta), numerada da esquerda para a direita pelo gasto ou pelos partidos na ordem da escala de viés. O custo da cadeira (gasto médio dos eleitos, dentro da faixa de cor) fica no miolo; o gasto de todos os candidatos ÷ cadeiras fica no recibo da prestação de contas; em telas estreitas desce para baixo do arco. As cadeiras "sentam" em varredura (520ms, atraso até 650ms) quando a seleção muda e deslizam quando a ordem muda. Cartão com foto ao passar o mouse, setas do teclado percorrem, Enter abre a carreira; no toque, o primeiro toque mostra e o segundo abre. Vista "Em pé" (3D): colunas com altura linear ao gasto e a cadeira em cima.

### Do caderno ao plenário (assinatura, P4)
A mesma eleição contada por três objetos, cada um com 100 unidades (Isotype) na cor do grau, do superior completo para baixo: o **caderno de votação** (uma folha pautada com 100 linhas de assinatura em 5 colunas, três rabiscos alternados; quem votou assina), os **santinhos** (100 santinhos em miniatura, cartão na cor do grau, janela da foto e linha do nome; quem se candidatou) e o **plenário** (100 cadeiras do sistema, encosto em tinta e assento na cor do grau; quem se elegeu), com título e total em cima, desenho alinhado na base e o "de 100" do grau em destaque embaixo; os três com ~200px de altura. A chave dos 8 graus é uma coluna de botões à esquerda dos objetos, do superior completo para baixo, na ordem em que eles se empilham (no celular, uma linha que rola de lado, como as fichas de cargo); escolher um grau, ou passar o ponteiro por qualquer unidade, acende as unidades dele nos três objetos. As cadeiras se sentam em varredura quando o ano ou o cargo muda.

### De cada 100 santinhos (P4)
Um quadro de 100 santinhos por grau (cada um vale 1% dos candidatos do grau), do menor para o maior, sem amostra de cor nos rótulos: aqui o verde significa só eleito. O santinho tem janela de foto e linha do nome; o eleito fica no verde de quem venceu e enche o quadro de baixo para cima (no celular, faixas 25×4 da esquerda), como barra. Tracejado em tinta na média do cargo. Graus com menos de 30 candidatos viram nota.

### Cinco câmaras (P4)
Os municípios em cinco quintos pela % de quem votou com superior completo; cada quinto é um plenário de 100 cadeiras com os eleitos de superior completo no azul do topo da escala e os outros em folha com contorno #87919d (2024). Em 2022, 100 votos para deputado como casas da cédula, marcadas com X (dois traços, como a cédula de anos) as dos candidatos com superior completo. Embaixo, o "de 100" e, com superior de cada 100, quem votou e os candidatos. O quinto do município do boletim leva contorno no amarelo do marcador (o anel de seleção, como na busca do plenário).

### Boletim da escolaridade (P4)
O município no papel térmico do boletim de urna: fenda escura, borda serrilhada, cabeçalho em mono, picotes e linhas impressas em cascata. Uma tabela por grau (de 100 que votaram; cadeiras da câmara em 2024 ou votos para deputado de 100 em 2022), a câmara eleita no plenário com a cadeira do sistema e o prefeito no miolo, e, sob a câmara, quantos vereadores têm superior e o grau do prefeito (em 2022, o fecho em mono). Toque mostra a cadeira, o segundo toque abre a carreira.

### Filtro por estado (P4)
No cabeçalho, sob a cédula de anos: "Todos" e uma pílula por estado carregado com a silhueta (as mesmas da Cadeira), em grade de 4 no largo e numa linha que rola de lado no celular. Recorta a página inteira: a frase de abertura diz "na Bahia", os quintos dividem os municípios do estado e o boletim abre na capital. Com filtro, os atos mostram ao lado do título a pílula "Recorte: 2022 · Bahia" com um x para tirar o filtro.

### Cada cadeira, cada estado (P4)
2022 ao lado de 2024, em duas colunas com o ano em número grande. Cada linha é uma faixa de composição (os 8 graus em fila, do analfabeto ao superior completo, na escala da bandeira) com o "de 100 com superior" à direita: primeiro a faixa de quem votou (mais fina e clara, a régua), depois um cargo por linha. Embaixo, os estados numa tabela só, com 2022 e 2024 na mesma linha (faixa, "de 100" e, miúdos, quantos eleitos e quantos de 100 que votaram têm superior); no celular, os dois anos um sob o outro dentro do estado. Clicar num estado aplica o filtro; o estado filtrado leva o anel do marcador.

### Os partidos e o diploma (P4)
O espectro da P7 contado em diploma: cada partido é uma coluna, da esquerda para a direita na ordem do viés e na cor do viés (a cor do partido é o seu viés), com a largura pelos eleitos e a altura pelos eleitos com superior completo; o traço em tinta é a mesma conta entre os candidatos e o tracejado, a média. A escala vai até o maior valor arredondado (não até 100), para as diferenças aparecerem. Cada coluna tem na base uma tira na cor do seu viés (a posição não é o viés: o eixo é a soma dos eleitos); os dois extremos citados no texto ganham chamada com sigla e valor, por cima de tudo. Cartão com os números ao passar o mouse. No celular vira uma linha por partido (sigla, barra na cor do viés, traço dos candidatos).

### Mapa e dispersão da escolaridade (P4)
Um alternador troca as duas vistas dos municípios. O mapa pinta cada município na escala da bandeira (de 0 a 100, 12,5 pontos por tom) pelos eleitos com superior (2024) ou pelos votos para deputado em candidatos com superior (2022), sobre o Brasil hachurado como no mapa do viés; o município do boletim leva contorno no amarelo do marcador. A dispersão põe cada município como ponto (quem votou × eleitos, tamanho por quem votou) com a diagonal pontilhada "eleito = eleitor" e a tendência tracejada. Clicar em qualquer município abre o boletim. O mapa não passa da altura da janela, para caber ao lado do boletim.

### Ranking dos municípios (P4)
Três listas impressas como linhas do boletim (cabeçalho em mono, picote, posição e valor em mono com pontilhado até o número): mais diploma, menos diploma e maior distância do eleitor. Só entram câmaras com ao menos 5 eleitos; quando o extremo empata em mais municípios do que a lista mostra, ela diz quantos ("63 empatam em 0 de 100; os maiores:"). Cada linha abre o boletim. Em 2022 a seção das cinco câmaras se chama "Cinco cédulas".

### Filtros da busca (fichas)
Uma linha discreta de fichas sob o campo do nome: Cargo, Eleição, Estado, Partido, Resultado. Cada ficha abre um menu pequeno só quando clicada (fecha com Esc ou clique fora, abre para o lado com espaço). A escolhida fica em tinta, com o valor e um x para tirar, como os alternadores. Dentro dos menus continuam os sinais do sistema: eleições gerais e municipais em duas colunas, estado com a silhueta, partidos da esquerda para a direita com a cor do viés.

### De onde vem o viés (painel do estado)
A balança: uma barra divergente a partir do zero em que cada partido é um trecho na cor do seu viés, puxando para a esquerda ou para a direita; o traço marca o resultado, igual ao viés do mapa. Embaixo, os partidos com % dos votos, viés e quanto puxam; cada um abre os candidatos mais votados no estado, com retrato, cargo e votos, levando à carreira.

### Busca no plenário
Campo "Procurar eleito" acima do plenário; Enter destaca a cadeira: as outras escurecem (papel a 72%), a achada ganha o anel amarelo do marcador, pulsa duas vezes, e um cartão fixo ao lado leva à carreira. Em tela estreita o cartão desce para baixo do desenho.

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
- **Do** manter o voo da câmera leve: nada monta durante o voo (os municípios entram no pouso, em 6 anéis), sem contornos e sem hachura recalculada a cada quadro. Fontes: animações na thread principal perdem quadros quando o React renderiza junto (motion.dev/docs/performance); o traço que não escala é refeito a cada mudança de transform (código do Chromium); muitas animações viram muitas camadas (web.dev, layer count).
- **Do** usar `content-visibility: auto` (classe `adiar`) nas seções abaixo da dobra e animar barras por `transform` em texto, não `scaleX`, para o Motion usar a GPU.
- **Do** usar a escala tipográfica do Archivo (larguras 112/106/100/74) e algarismos tabulares em tabelas e eixos.

### Don't:
- **Don't** usar nome, brasão ou marca de órgão oficial; o rodapé sempre diz que não é site da Justiça Eleitoral.
- **Don't** pôr texto nas cores das fitas ou da escala do viés; texto usa as tintas.
- **Don't** inventar cor de partido: a cor do partido é o seu viés.
- **Don't** usar travessão (— ou –) em texto visível; use vírgula, ponto ou hífen.
- **Don't** usar spinner circular genérico; o loading é o símbolo apurando.
- **Don't** mostrar CPF, título eleitoral ou data completa de nascimento.
