# Voto Aberto: prompt de design e construção

Prompt mestre do front-end. Escrito com o método do **impeccable** (produto → modo →
mundo visual → contrato de direção → estados → verificação) e as travas do
**taste-skill** (leitura do brief, três dials, proibições de "cara de IA", pre-flight).
Quem implementar (pessoa ou agente) segue este arquivo; o produto em si está em
[`PRODUCT.md`](../PRODUCT.md).

---

## 1. Leitura do brief (taste-skill §0)

> **Lendo como:** atlas eleitoral público para estudantes, professores e cidadãos, com
> linguagem de serviço governamental confiável, construído com os objetos da eleição
> brasileira (urna eletrônica, boletim de urna, santinho) sobre a paleta clara das
> fitas onduladas.

| Dial | Valor | Por quê |
|---|---|---|
| `DESIGN_VARIANCE` | 5 | Serviço público pede grade previsível; a assimetria fica no mapa e na urna. |
| `MOTION_INTENSITY` | 6 | O usuário pediu animações suaves e concisas, zoom no mapa e 3D interativo. |
| `VISUAL_DENSITY` | 6 | Produto de dados: denso o bastante para comparar, com respiro entre blocos. |

**Modo (impeccable):** *Operate* no mapa e na urna (a pessoa explora e consulta);
*Read* no Boletim e na Metodologia. A expressão nunca esconde o dado, o estado da
tela ou a affordance.

**Cena física:** sala de aula com projetor e notebooks à luz do dia → **tema claro**,
contraste alto, nada depende de tela escura.

---

## 2. Contrato de direção

- **THESIS.** O sistema é a urna aberta: cada tela é um objeto da eleição brasileira
  operando sobre dado real. Recusa o painel genérico de cards + gráfico de pizza e a
  cópia do portal de resultados.
- **OWN-WORLD.** Fundo papel-claro frio, tinta azul-ardósia quase preta, sete fitas
  onduladas (verde, lima, ardósia, petróleo, celeste, laranja, amarelo) como
  assinatura; teclas da urna (BRANCO, CORRIGE laranja, CONFIRMA verde); papel
  térmico do boletim com tipografia mono; santinhos como cartões. Escala do viés
  laranja (esquerda) ↔ cinza ↔ azul (direita).
- **STORY.** A pessoa vê o Brasil colorido pelo viés, escolhe um ano (ou aperta play
  e vê 2018→2024), entra no estado com um zoom de câmera, chega ao município clicando
  ou digitando, e o Boletim do Município sai impresso. Na urna, digita um nome,
  aperta CONFIRMA e a carreira se abre em santinhos.
- **FIRST VIEWPORT.** Desktop 1440×900: barra utilitária fina; cabeçalho com marca e
  navegação; à esquerda (7/12) o mapa do Brasil ocupa a altura útil, com o seletor de
  ano em formato de cédula acima e a legenda divergente abaixo; à direita (5/12) o
  título-tese ("Para onde o voto pendeu"), a busca "Digite um município" e a lista
  de estados com silhueta. A ação primária é clicar num estado ou digitar.
- **FORM.** Objetos da eleição (1ª da lista ordenada; escolha do usuário entre 4
  direções). Seed: escolhida no AskUserQuestion, sem roll (o launcher do impeccable
  não está instalado nesta máquina).
- **FINISH.** "unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, DESIGN.md, and every shipping raster carrying its
  provenance".

---

## 3. Sistema visual

### 3.1 Cor (estratégia: *Full palette* com papéis fixos)

| Papel | Token | Hex | Uso |
|---|---|---|---|
| Fundo | `--papel` | `#F2F4F5` | página |
| Superfície | `--folha` | `#FCFDFD` | painéis, boletim, santinho |
| Tinta | `--tinta` | `#18202B` | texto principal (14,9:1) |
| Tinta 2 | `--tinta-2` | `#4B5566` | texto secundário (6,8:1) |
| Tinta 3 | `--tinta-3` | `#5F6878` | legendas, rótulos (5,1:1) |
| Linha | `--linha` | `#D9DEE2` | divisórias e grade (hairline) |
| Ação | `--acao` | `#1F5F86` | links, foco, botão primário (6,3:1) |
| Marcador | `--marcador` | `#F7C21A` | sublinhado do item ativo, ano selecionado |
| Fitas | `--fita-1..7` | `#5E881B #A2BD31 #5D6B94 #468BAF #76ACD0 #F19929 #FBC700` | assinatura de marca, loading, ícone; nunca texto |
| Urna CONFIRMA | `--confirma` | `#3F7F2A` | tecla verde |
| Urna CORRIGE | `--corrige` | `#E5732A` | tecla laranja |
| Urna BRANCO | `--branco` | `#F4F5F2` | tecla branca |

**Escala do viés (divergente, 9 classes, validada em OKLCH):** dois braços de 4 passos
com o mesmo ΔL por passo e ponto médio cinza neutro (`#E6E8EA`, nunca uma cor).
Esquerda = laranja queimado → claro; direita = azul claro → azul-marinho. Quebras de
classe: ±5, ±15, ±30, ±45 pontos. "Sem dados carregados" = hachura 45° cinza sobre
`#ECEEF0`, com rótulo, nunca uma classe da escala.

Regras: texto nunca na cor da série; a cor do partido é o seu viés (não existe cor de
partido inventada); cor nunca é o único canal (legenda, rótulo direto e tabela).

### 3.2 Tipografia

- **Archivo** (variável, eixos `wght` 100-900 e `wdth` 62-125; Omnibus-Type, fundição
  latino-americana): uma família só, três larguras para a hierarquia.
  - Display: `wdth 112`, `wght 780`, 49-61px, entrelinha 0,98: a tese de cada tela.
  - H1 39 / H2 25 / H3 20: `wdth 100`, `wght 720 → 640`.
  - Corpo 16/1,55 `wght 420`; pequeno 14/1,45.
  - Números grandes (santinho, votos): `wdth 72`, `wght 800`, algarismos proporcionais.
  - Tabelas e eixos: `font-variant-numeric: tabular-nums`.
- **Red Hat Mono**: só o papel térmico do Boletim e o visor da urna.
- Escala modular 1,25. Mais espaço acima do título que abaixo. Máximo 1 eyebrow a
  cada 3 seções. **Zero travessões (— ou –) em qualquer texto visível.**

### 3.3 Forma e espaço

- Raio: contêineres 16px, controles em pílula, marcas de dados 4px na ponta, mapa sem
  raio. A urna 3D tem chanfros físicos.
- Grade de 12 colunas, `max-width 1440px`, calha de 24px (16px no celular).
- Sombras tingidas de ardósia, nunca preto puro. Cards só onde a elevação significa
  algo (boletim e santinho, que são objetos de papel).

### 3.4 Movimento (gramática única)

| Momento | Duração | Curva | O que comunica |
|---|---|---|---|
| Micro (hover, tecla) | 140-180ms | `cubic-bezier(.16,1,.3,1)` / mola 500/30 | feedback |
| Painel entra | 320ms | mesma curva | mudança de estado |
| Zoom Brasil → estado → município | 900-1100ms | `d3.interpolateZoom` (van Wijk) | aproximação de câmera |
| Municípios surgem | stagger radial a partir do clique, ≤ 450ms | ease-out | origem do gesto |
| Boletim imprime | 700ms + linhas em cascata de 28ms | ease-out | objeto saindo da urna |
| Santinhos | leque com stagger de 60ms | mola | a carreira se abre |
| Play da linha do tempo | 1,6s por ano, cross-fade de cor 600ms | linear no tempo | mudança no tempo |

`prefers-reduced-motion`: tudo vira fade ≤ 120ms, o zoom é instantâneo e o 3D fica
estático. Só se anima `transform` e `opacity` (cor do mapa via transição de `fill`).

---

## 4. Telas e rotas

| Rota | Tela | Perguntas |
|---|---|---|
| `/` | Mapa do Brasil | P7 (estado) |
| `/uf/:sigla` | Estado com municípios | P7 (município, região intermediária) |
| `/uf/:sigla/:ibge` | Município + Boletim | P7, P3 (bônus) |
| `/urna` | Urna 3D de consulta | P10 (busca) |
| `/politico/:id` | Carreira | P10 |
| `/metodologia` | Fontes e método | todas |

### 4.1 Moldura comum

- **Barra utilitária** (32px, `--tinta` sobre `--papel` escurecido): "Projeto acadêmico
  de Banco de Dados · Grupo 7 · 2026.2" à esquerda; à direita, Alto contraste e A+/A-.
- **Cabeçalho** (64px): letreiro vetorizado da marca (web/src/assets/marca), navegação
  Mapa · Urna · Metodologia; item ativo com sublinhado `--marcador` de 4px.
  Embaixo, uma fita de 6px com as sete cores em onda lenta (a única onda fixa da página).
- **Rodapé**: fontes (TSE Dados Abertos, IBGE, Atlas Brasil/Ipea, Harvard Dataverse), UFs
  carregadas, e a frase "Este não é um site oficial da Justiça Eleitoral."

### 4.2 Mapa do Brasil (`/`)

- Coroplético das 27 UFs (malha IBGE `intermediaria`), cor = viés estadual do ano
  escolhido. UFs não carregadas com hachura e tooltip "Sem dados carregados".
- **Seletor de ano em forma de cédula**: quatro casas (2018 Geral, 2020 Municipal,
  2022 Geral, 2024 Municipal) que se marcam com um X desenhado; botão ▶ "Linha do tempo"
  percorre os anos.
- Hover: contorno 2px `--tinta` + tooltip (UF, viés com sinal, lado). Teclado: Tab
  percorre os estados, Enter entra.
- Lista lateral de estados agrupada por região, cada um com **silhueta do estado**
  (desenhada da própria malha), nome e chip de viés; os não carregados ficam esmaecidos.
- Busca "Digite um município" (ignora acento, sugere a partir de 2 letras, mostra UF);
  Enter leva direto ao município com zoom.
- Clique num estado: zoom de câmera até os limites dele, o Brasil some em fade e os
  municípios surgem em onda a partir do ponto clicado.

### 4.3 Estado (`/uf/:sigla`)

- Mapa municipal (malha `maxima`) colorido pelo viés do município no ano.
- Painel: viés do estado nos 4 anos (linha), regiões intermediárias (barras divergentes
  ordenadas), extremos do ano (mais à esquerda e mais à direita), parcela de votos em
  partidos sem viés informado.
- Alternador **Mapa | Relevo 3D**: municípios extrudados (altura = eleitorado apto,
  cor = viés), órbita com o mouse, clique abre o município.
- Busca local de município com a mesma lógica.

### 4.4 Município e Boletim (`/uf/:sigla/:ibge`)

- O mapa aproxima até o município; vizinhos ficam a 35% de opacidade.
- **Boletim do Município** sai da fenda do topo do painel como papel térmico (borda
  serrilhada, Red Hat Mono no cabeçalho), com:
  1. Identificação: município, UF, região intermediária, código IBGE.
  2. **Viés na linha do tempo** (P7): pontos 2018-2024 em eixo vertical -100..+100,
     com a linha do estado como contexto em cinza (ênfase, não categórico).
  3. **Espectro do voto** por ano: barra 100% com os partidos ordenados da esquerda para a
     direita, cada segmento na cor do seu viés, gap de 2px, rótulo só nos 3 maiores.
  4. Partidos mais votados no ano (tabela curta).
  5. Indicadores (P3, bônus): PIB per capita, IDHM, eleitores/população, isentos
     (brancos + nulos + abstenções) em stat tiles.
  6. Rodapé do boletim com **QR code real** do link da página e "Emitido em".

### 4.5 Urna de consulta (`/urna`)

- **Urna eletrônica 3D** (React Three Fiber): corpo claro, painel ardósia, visor,
  teclado 0-9 e BRANCO / CORRIGE / CONFIRMA nas cores reais. Inclina com o ponteiro
  (mola), flutua em repouso, as teclas afundam no clique e ao digitar.
- O visor mostra a consulta: "CONSULTA DE CARREIRA / Nome: ▌" e até 6 resultados
  (nome, ano da última candidatura, UF). Setas escolhem, **CONFIRMA** (ou Enter)
  abre, **CORRIGE** (ou Esc) apaga, **BRANCO** sorteia um político com carreira longa.
- Ao confirmar: o bipe da urna (sintetizado com WebAudio, sem gravação), o visor
  mostra "FIM" e a carreira entra.
- Acessibilidade: o campo do visor é um `<input>` real com rótulo; a lista é um
  `listbox`; sem WebGL ou com movimento reduzido, a mesma interface aparece em 2D.

### 4.6 Carreira do político (`/politico/:id`)

- Cabeçalho: nome, ano de nascimento (sem data completa, sem CPF nem título), UFs.
- Stat tiles: candidaturas, vitórias, derrotas, reeleições, anos com mandato.
- **Trajetória** (gráfico principal): eixo x 1994→2024; faixas y por cargo, em ordem
  de hierarquia (Vereador, Prefeito, Dep. Estadual, Dep. Federal, Senador, Governador,
  Presidente); ponto cheio = eleito, vazado = não eleito, anel = reeleito; barra fina
  com a duração do mandato (4 anos; senador 8); linha ligando a sequência.
- **Santinhos**: um cartão por eleição em leque horizontal com scroll-snap; ano grande,
  cargo, local, partido (se eleito), carimbo ELEITO / NÃO ELEITO / REELEITO / 2º TURNO,
  votos quando houver (2018-2024).
- Contexto: taxa de reeleição do cargo na UF ("Na BA, X% dos vereadores que tentaram se
  reeleger conseguiram"), do mesmo cálculo da P10a.

### 4.7 Estados especiais (todos obrigatórios)

- **Loading "Ciranda"**: sete fitas onduladas nas cores da marca girando em volta de um
  centro em velocidades levemente diferentes, que se trançam e se separam; legenda
  contextual ("Apurando 2022..."). Nada de spinner circular.
- Refetch: mantém o desenho anterior a 60% de opacidade (sem esqueleto piscando).
- Vazio: "Nenhum município encontrado para 'xyz'" com sugestão. UF sem dados: explica
  como carregar (`python -m loader UF`).
- Erro: API fora do ar → mensagem com o comando para subir (`docker compose up -d`).

---

## 5. Ícone e marca

- **Símbolo**: silhueta do Brasil (da malha IBGE) recortando barras verticais nas cores
  das fitas, de alturas crescentes: Brasil + gráfico + paleta. Num quadrado de cantos
  arredondados `--tinta`, a parte vazia da silhueta em branco a 22%.
- Favicon SVG + PNG 32/180/512 gerados do mesmo desenho.

---

## 6. Gráficos (método dataviz)

- Forma pela tarefa: viés no tempo = pontos + linha (1 série + contexto cinza);
  composição = barra 100% ordenada; regiões = barras divergentes; carreira = faixas.
- Marcas finas, linhas de 2px, pontos ≥ 8px com anel de 2px da superfície, grade
  hairline sólida (nunca tracejada), um eixo só.
- Hover com tooltip em todo gráfico e foco de teclado equivalente; todo gráfico
  tem "ver tabela".
- Cor da escala divergente validada (ΔL igual por braço, ponto médio cinza).

---

## 7. Proibições (anti "cara de IA")

Sem travessões; sem gradiente roxo; sem glassmorphism; sem três cards iguais lado a lado;
sem eyebrow numerado ("01 / Mapa"); sem pontos decorativos; sem "Scroll para explorar";
sem ícones desenhados à mão (Phosphor); sem números inventados; sem dados de exemplo
fingindo ser reais; sem pizza para comparar partidos; sem spinner genérico; sem `h-screen`;
sem `window.addEventListener('scroll')`.

---

## 8. Arquitetura

- `api/` FastAPI: `/api/ufs`, `/api/ufs/{sigla}`, `/api/municipios?q=`,
  `/api/municipios/{ibge}`, `/api/politicos?q=`, `/api/politicos/{id}`,
  `/api/geo/brasil`, `/api/geo/uf/{sigla}`. Viés calculado no SQL com a mesma fórmula
  de `scripts/07_vies_politico_municipio.py`. Busca com `unaccent` + `pg_trgm`.
- `web/` Vite + React 19 + TS estrito; TanStack Router (rotas tipadas) e Query (cache);
  Tailwind v4 com os tokens acima; Motion; D3 (geo, zoom, scale, shape); R3F + drei;
  Phosphor; fontes self-hosted (@fontsource).
- Code-splitting: o 3D só carrega nas rotas que o usam.

---

## 9. Verificação

- **Figma**: protótipo das telas-chave (mapa, estado + boletim, urna, carreira,
  loading/ícone) antes do código.
- **Playwright**: cada rota em 1440×900 e 390×844; checa tooltip do mapa, zoom ao clicar
  num estado, busca digitada levando ao município, boletim com os quatro anos, urna
  CONFIRMA abrindo a carreira, `prefers-reduced-motion`, e ausência de erros no console.
  Screenshots em `web/e2e/__screenshots__/`.
- Pre-flight do taste-skill (§14) e checagem de travessões antes de cada commit.
