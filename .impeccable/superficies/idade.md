# Superfície: /idade (P6) e o bloco "Idade" do boletim

Modo: Read. Público: a turma e quem avalia o trabalho, em projetor ou notebook; cidadão curioso pelo próprio município.
Tarefa: entender se lugares mais velhos ou mais jovens trocam mais de prefeito, quão velhos são os eleitos e se "jovem
vota no jovem e velho vota no velho". Dados: `scripts/06_idade_alternancia.py` (mesmas contas de
`respostas/06_idade_alternancia.txt`). Estado: **idealização**, nada construído.

## Direction contract

THESIS: o tempo na parede da prefeitura. A P6 conta a idade pelos objetos que envelhecem junto com a cidade: o papel
que amarela (a escala sépia, só desta página), a galeria dos ex-prefeitos que toda prefeitura tem pendurada (oito
molduras de 1996 a 2024) e o caderno de votação, que diz a idade de quem compareceu. Recusa formas de fora da eleição
(ampulheta como gráfico, velas de bolo, rugas, bengalas) e qualquer caricatura de jovem ou idoso: idade é número, não
estereótipo.
OWN-WORLD: papel, folha e tinta do Voto Aberto; a escala sépia (folha clara -> palha -> ocre -> sépia, luminosidade
sempre caindo) só para idade; a cor do partido é o seu viés (bolinha da P7) nas plaquinhas da galeria; o retrato 3x4
do sistema com o carimbo na tinta dos santinhos; o papel térmico do boletim; os halteres da P4 (aro e ponto); Archivo
nas três larguras; cédula de anos.
STORY: em segundos vê o Brasil amarelar do Norte (papel quase branco) ao Sul (sépia fundo) e o mapa inteiro escurecer
de 2018 a 2024; depois descobre que a idade não muda a troca de partido na prefeitura, mas muda um pouco a troca de
pessoa; que quem se elege tem mais idade que quem vota e que jovens de 18 a 34 anos são cerca de um terço de quem vota
e um sétimo dos vereadores; por fim, que "jovem vota no jovem" só aparece, e fraco, quando se comparam zonas de mesma
escolaridade.
FIRST VIEWPORT: título Display "Jovem vota no jovem?" com a frase-resposta logo abaixo (calculada, ex.: "Pouco. Com a
mesma escolaridade, zonas 5 anos mais velhas dão votos a candidatos cerca de 1 ano mais velhos."); cédula de anos
2018 | 2020 | 2022 | 2024 à direita; filtro por estado (as pílulas com silhueta da P4); à esquerda o mapa sépia do
Brasil, à direita os três números do ato 1 (idade média de quem votou, o município mais jovem e o mais velho) e a
régua sépia com os três terços. Abre em 2024, todos os estados.
FORM: ensaio em quatro atos, como a Escola, cada ato com o título em forma de pergunta e a resposta em frase logo
abaixo, números em negrito; fecha com "O que a conta não diz", como a P2. Escolhas do usuário em 07/11/2026 (pergunta
estruturada): página própria + bloco no boletim; cor "sépia, papel que amarela"; alternância como "galeria dos
ex-prefeitos"; "jovem vota no jovem" como "halteres por terço".
FINISH: unreviewed and undocumented is unfinished; o build termina com a revisão final, o veredito, as mudanças do
DESIGN.md (registradas em MUDANCAS_GITHUB.md para o usuário aplicar) e os testes ponta a ponta.

## A escala sépia (dado: idade)

Seis passos em OKLCH, luminosidade de 0,955 a 0,43, croma até 0,066 e matiz de 98° (palha) a 66° (sépia), puxada para o
amarelo para não encostar no laranja do viés de esquerda (o tom mais perto dele fica a ΔE 8,3).

| Passo | Hex | Texto sobre | Contraste |
|---|---|---|---|
| 1 | `#f4f1df` | tinta | 14,4:1 (contorno de tinta a 20% sobre a folha, como os claros da Escola) |
| 2 | `#ded4b4` | tinta | 11,1:1 |
| 3 | `#c6b48a` | tinta | 8,0:1 |
| 4 | `#ab9166` | tinta | 5,5:1 |
| 5 | `#896e4a` | folha | 4,7:1 |
| 6 | `#634a30` | folha | 8,1:1 |

- Passos de ΔE 8,8 a 12,7 (OKLab × 100), crescentes para o escuro: a ordem se lê do claro ao escuro, "quanto mais
  velho, mais amarelado o papel".
- **Mapa e régua:** seis classes de idade média de quem votou, com limites fixos para os quatro anos (ex.: até 40,
  40-42, 42-44, 44-46, 46-48, 48 ou mais), para o envelhecimento de 2018 a 2024 aparecer como escurecimento. A legenda
  diz os limites.
- **Terços:** mais jovem, intermediário e mais velho usam os passos 2, 4 e 6, sempre com o nome escrito ao lado (cor
  nunca é o único canal).
- **Ausência:** município sem dado continua hachurado (Regra da Ausência Visível); nunca o passo 1.
- Só existe nesta página e no bloco do boletim; viés, gasto e escolaridade continuam nas suas páginas.

## Os atos

### Ato 1. "Onde o Brasil é mais velho?"

- **Resposta:** "Do Norte ao Sul, o papel amarela: quem votou tem em média **44,2 anos** em 2024, de **34,8** em
  Melgaço (PA) a **53,5** em Coqueiro Baixo (RS)." (números do exemplo, carga de 07/11/2026; sempre calculados).
- **Mapa sépia** (o mapa da Escola: Brasil com estados pintados pela média, câmera van Wijk até o estado, municípios
  acendendo no pouso). "Pintar por: Quem votou | População (Censo 2022)": quem votou muda com a cédula de anos; a
  população é uma foto de 2022 e a cédula esmaece, com a nota "Censo 2022". Hachura para o que não tem dado.
- **Ao lado:** os três números (idade média, mais jovem, mais velho) e a régua sépia com os limites dos terços; a frase
  "86% dos municípios ficam no mesmo terço de 2018 a 2024" sob a régua.
- **Linha do envelhecimento:** quatro pontos (2018 a 2024) da idade média de quem votou, com a parte de municípios onde
  votaram mais pessoas de 60+ do que de 16 a 29 anos (7% em 2018, 42% em 2024) como segunda leitura, em número grande.

### Ato 2. "Lugar mais velho troca mais de prefeito?"

- **Resposta:** "Não troca mais de partido: a troca fica em **68%** das passagens nos três terços. Troca um pouco mais
  de pessoa: a cada 5 anos a mais, **+2,4 pontos** de prefeitos novos."
- **Três barras de 100%**, uma por terço (na UF), com as passagens de mandato desde 1996 em três trechos neutros (a cor
  é só da idade e do viés): mesmo partido em Papel 2, troca de partido em Tinta 2 e **troca com ressalva** em Tinta 2
  hachurada, com o rótulo "partidos fundidos" e o número (221 no total). Ao lado de cada barra, a pílula da leitura
  ("fusão = troca" | "fusão = continuidade") troca os dois % na hora; a pílula escolhida fica no oliva de seleção.
- **Por porte:** a mesma conta em quatro linhas (até 10 mil, 10 a 50 mil, 50 a 200 mil, mais de 200 mil), compacta.
- **A galeria do município** (abaixo das barras, com a busca de município): ver "Galeria dos ex-prefeitos".

### Ato 3. "Quem se elege é mais velho que quem vota?"

- **Resposta:** "Sim: prefeitos eleitos em 2024 têm em média **49,5 anos**, vereadores **45,5**, e quem votou **44**.
  Jovens de 18 a 34 anos são **31%** de quem votou e **15%** dos vereadores."
- **Pirâmide espelhada** (o gráfico canônico de idade, não metáfora): à esquerda quem votou (18+), à direita os eleitos,
  nas quatro faixas comuns (18 a 34, 35 a 49, 50 a 64, 65+), cada barra no passo sépia da sua faixa. Fichas de cargo
  "Vereador | Prefeito"; o tracejado em tinta mostra os candidatos aptos sobre os eleitos, para ver que a diferença já
  vem de quem se candidata. As barras crescem do eixo para fora (uma vez).
- **O prêmio de idade:** uma linha por terço (na UF): idade de quem votou, dos candidatos a vereador e dos eleitos, nos
  halteres do ato 4 (mesma gramática); a frase diz que, entre os candidatos, a escolha não favorece mais velhos nem
  mais novos.

### Ato 4. "Jovem vota no jovem?"

- **Resposta:** em duas camadas, porque a resposta muda com o controle: "Sem comparar a escolaridade, quase nada muda.
  Comparando zonas de mesma escolaridade, sim, mas pouco: 5 anos a mais de quem votou, **+0,8 a +1,7 ano** na idade dos
  deputados votados."
- **Halteres por terço de zonas** (como os cinco grupos da P4): uma linha por terço (zonas mais jovens, intermediárias,
  mais velhas, cada terço com o mesmo número de votantes), na mesma régua de idade; o aro em tinta é a idade de quem
  votou, o ponto cheio (sépia 6) a idade média dos votados, a haste clara a distância. Fichas: Deputado federal,
  Deputado estadual (2018, 2022; zonas da mesma UF, mesmos candidatos), Vereador, Prefeito (2020, 2024; zonas do mesmo
  município, só cidades com 2 zonas ou mais). A cédula de anos mostra só os anos do cargo, como no atlas.
- **"Comparar zonas de mesma escolaridade"** (alternador): os pontos correm para a posição com a escolaridade fixa
  (900ms, uma vez), e a frase troca. A nota curta explica por quê: "nas cidades, as zonas mais velhas são também as mais
  escolarizadas (r = 0,85)".
- **Ver tabela:** os efeitos com o intervalo de 95% e o número de zonas, como no txt.

### "O que a conta não diz" (fecho)

Três lembretes com ícone num círculo oliva claro, como na P2: o voto é secreto (a conta compara lugares, não pessoas);
a idade de quem votou é o meio da faixa do TSE (16 a 20 ano a ano, depois de 5 em 5); fusão de partidos é marcada à
parte, e a conta sai nas duas leituras.

## Galeria dos ex-prefeitos (assinatura nova)

A parede de retratos da prefeitura, de 1996 a 2024: oito mandatos lado a lado.

- **Moldura:** retrato 3x4 do sistema (foto do TSE desde 2004, inteira e sem esticar; antes, as iniciais enormes na
  própria cor, como o santinho tipográfico) numa moldura fina de folha com filete sépia 5, sombra de papel (é um objeto
  pendurado: Regra do Papel). Embaixo, a plaquinha em folha: ano do mandato, nome de urna, sigla com a bolinha na cor
  exata do viés (a escala da P7).
- **Reeleição:** quando a mesma pessoa ocupa dois mandatos seguidos, as duas casas viram uma moldura dupla ("1997 a
  2004"), como as galerias reais fazem com quem foi reeleito.
- **A passagem entre molduras:** um sinal em tinta no vão, com o texto ao lado (cor nunca é o único canal):
  `=` mesmo partido (inclui renomeação, com a nota "PMDB virou MDB"), `≠` troca de partido, `~` troca com ressalva, com
  a nota "o PSL entrou no UNIÃO em 2022" no cartão ao passar o mouse.
- **Resumo do município** sobre a galeria (ex.: "6 trocas de partido em 7 passagens, 2 reeleições"), o terço de idade na UF
  em pílula sépia e a idade média de quem votou.
- **Interação:** passar o mouse ou focar uma moldura mostra o cartão (nome, partido e viés, votos quando é 2020 ou 2024)
  e Enter abre a carreira; setas percorrem. Tocar mostra, o segundo toque abre (como o plenário).
- **Movimento:** as molduras "penduram" da esquerda para a direita (cada uma desce 6px e balança uma vez, 60ms entre
  elas), só na primeira vez; com movimento reduzido já estão no lugar.
- **Celular:** a galeria rola de lado dentro do quadro (é o único lugar com rolagem lateral, dentro do componente),
  com a última moldura visível pela metade para dizer que continua.
- **Janela de notebook:** oito molduras de ~96px de largura e o resumo cabem em 1366 de largura; a galeria não passa de
  ~220px de altura.

## O bloco "Idade" no boletim do município

No papel térmico, depois de "Prefeitos eleitos" (que vira a galeria compacta):

- Cabeçalho em mono "IDADE"; linhas impressas em cascata: idade média de quem votou (2024) com o terço na UF e no
  país; idade média da população (Censo 2022); parte de quem votou com 60+ e com 16 a 29.
- **A galeria compacta:** os retratos de 52px que o boletim já mostra, estendidos a 1996-2024, com os sinais `=`, `≠`
  e `~` entre eles e as molduras duplas da reeleição; a linha de resumo em mono ("6 TROCAS EM 7 PASSAGENS").
- Link "Ver a P6 inteira" para `/idade` com o estado e o município escolhidos.

## Navegação

- 8º item do menu: **Idade**, ícone Phosphor `Hourglass` (cheio quando ativo), entre Escola e Patrimônio (as duas
  páginas do perfil de quem vota e se elege ficam juntas).
- **Restrição a verificar:** hoje sete itens cabem em 360px; com oito, testar a versão compacta (0,8rem, Archivo
  condensada a 84%) e, se não couber, abreviar Reeleição para "Reeleger" abaixo de 640px. Nenhuma tela com rolagem
  horizontal em 390px (teste existente).

## Dados e API necessários (sem mudar o esquema)

**Decisões (07/11/2026): a API reaproveita o script, como a P9, e tudo vem do banco.** `api/app.py` ganha uma
função `p6()` igual à `p9()`: carrega `scripts/06_idade_alternancia.py` por `importlib`, sem cópia, e usa as mesmas
funções (`perfil_zonas`, `passagens`, `Linhagens`, `tercos`, `efeito`), para o site e `respostas/06_idade_alternancia.txt`
darem sempre os mesmos números.

- **Do banco, sem exceção:** a faixa etária de quem votou por zona ganhou a tabela `perfil_etario_munzona` e o ponto
  médio de cada faixa a tabela `faixa_etaria` (migração `015_perfil_etario.sql`; o loader grava nas cargas novas e
  `python -m loader.perfil_etario` preencheu o banco carregado). O resto já estava lá: prefeitos e partidos
  (`mandato`, `partido`), candidaturas e idades (`politico_eleicao`, `politico`), votos por zona, escolaridade de quem
  votou (`perfil_eleitorado_munzona`), indicadores e a idade média da população (`indices_municipio`,
  `ibge_censo_municipio`). O cache em arquivo da primeira versão foi apagado.
- **Ajuste no script antes da API:** hoje as partes A a D montam texto. Separar o cálculo (funções que devolvem
  tabelas) da formatação do txt, sem mudar o txt; a API chama o cálculo, o `main()` continua gravando o txt.
- **Tempo:** a soma dos votos por zona leva ~20 s no banco inteiro. A API guarda o resultado como as outras contas
  pesadas (cache no processo e em `dados/cache_api/<versão>/`, como a reeleição: "alguns segundos na primeira vez").
- `GET /api/idade?ano=&uf=`: atos 1 a 4 (perfil por município e ano, terços, passagens resumidas por terço e porte,
  pirâmide, halteres com e sem escolaridade, frases calculadas).
- `GET /api/idade/municipio/{ibge}`: a galeria (prefeitos de 1996 a 2024 com retrato, partido, viés, passagem e
  reeleição) e as linhas do bloco do boletim; ou acrescentar `idade` e `galeria` em `/api/municipios/{ibge}`.
- Os halteres "com a mesma escolaridade" precisam de um número por terço: a idade votada prevista com a escolaridade na
  média (média geral + inclinação controlada × distância do terço à média). O script hoje só dá a inclinação; acrescentar
  esse cálculo nele, para o txt e o site mostrarem o mesmo.

## Acessibilidade e desempenho

- WCAG 2.2 AA: contrastes da tabela acima; mapa navegável por Tab e Enter; cada gráfico com tooltip no foco e "Ver
  tabela"; os sinais da galeria com texto.
- Movimento só em transform e opacity, com `cubic-bezier(.16,1,.3,1)`; nada em loop; `prefers-reduced-motion` mostra a
  pose final.
- Seções abaixo da dobra com `adiar` (`content-visibility: auto`); a página parada não gasta CPU.
- Esqueleto no desenho da tela depois de 300 ms; nada gira.

## Decisões em aberto

- Mapa "Em pé" (3D, altura pela idade) como na Escola: bonito, mas compete com o 3D do atlas; fica para depois.
- Interface simples: entra uma página `/idade` linear (atos 1, 3 e 4 sem a galeria) ou nada?
- Limites das seis classes do mapa: fixar depois de ver a distribuição dos quatro anos juntos.
- Texto da frase-resposta do primeiro viewport: decidir com o grupo se a pergunta-título é "Jovem vota no jovem?" ou
  a frase inteira do enunciado.
