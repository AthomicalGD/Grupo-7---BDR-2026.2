# Voto Aberto (ProjetoBDR): crawler, banco, API e site

Responde às 10 perguntas do projeto sobre as eleições brasileiras, nos escopos de tempo definidos (E.P. = 2018, 2020,
2022 e 2024). O caminho é sempre o mesmo: o **crawler** baixa **somente** os arquivos necessários e organiza tudo em
`dados/`; o **loader** grava esses arquivos no **banco** (PostgreSQL); os **scripts** de cada pergunta gravam a resposta em
texto em `respostas/`; a **API** e o **site** (Voto Aberto) mostram as mesmas contas de forma interativa.

Tamanho total, medido nos servidores em 11/09/2026: **6,0 GB de download e ~33 GB em disco**, sem as fotos dos
candidatos, que são opcionais (bem abaixo do teto de 200 GB; ver "Espaço em disco").

Este README segue a ordem do trabalho: instalação, crawler, banco, as perguntas (P1 a P10), API, site, testes,
organização de `dados/`, fontes, espaço em disco e observações gerais para a análise.

## Instalação

Requer Python 3.10+ e rodar a partir desta pasta. As dependências ficam no ambiente virtual `.venv`;
todos os comandos `python` deste README supõem o `.venv` ativo (sem ele, o Python do sistema não acha
`fastapi`, `pandas` etc.).

```bash
python -m venv .venv
```

Ative o ambiente (uma vez por terminal): `.venv\Scripts\activate` no Windows ou `source .venv/bin/activate`
no Linux/macOS. Depois:

```bash
pip install -r requirements.txt
```

## Crawler (download dos dados)

```bash
python -m crawler --simular
```

```bash
python -m crawler
```

| Opção | Efeito |
|---|---|
| `--simular` | Mostra o plano (arquivo por arquivo, com tamanhos reais) e o espaço final, sem baixar nada |
| `--perguntas 1 2 5` | Só o necessário para essas perguntas |
| `--anos 2024` | Só esses anos, dentro do escopo de cada pergunta |
| `--fontes tse ibge ipea dataverse camara` | Só essas fontes |
| `--atualizar` | Baixa de novo o que o servidor republicou desde o último download |
| `--carreira-ate 2026` | Estende a P10 às candidaturas de 2026 (ainda sem resultado) |
| `--manter-zips` | Guarda os zips do TSE em `dados/_zips` (ocupa +6 GB) |
| `--limite-gb 200` | Não baixa se o total em disco for passar desse valor (padrão 200) |
| `--dados PASTA` | Grava em outra pasta (padrão `./dados`) |
| `--fotos` | Baixa as fotos dos candidatos em vez dos dados das perguntas (ver abaixo) |
| `--ufs PI BA BR` | Com `--fotos`: só essas UFs; `BR` são os candidatos a Presidente |

Como o crawler se comporta:

- **Retomável:** pode interromper (Ctrl+C, queda de rede) e rodar de novo, que ele continua do ponto onde parou.
- **Idempotente:** o que já está em disco não é baixado de novo.
- **Econômico:** de cada zip do TSE extrai só os arquivos usados e, entre eles, só o consolidado
  `*_BRASIL.csv`, porque os arquivos por UF repetem o mesmo conteúdo (conferido: o BRASIL inclui as linhas BR e ZZ).
  O zip é apagado logo depois, então só um zip por vez ocupa disco (o maior tem 1,3 GB).
- **Com trava de espaço:** antes de baixar, lê o índice de cada zip no servidor, soma o que será
  extraído e aborta se passar do `--limite-gb` ou do espaço livre.

Para mudar o que é baixado, edite só `crawler/catalogo.py` (`ITENS` e `NECESSIDADES`): é a fonte da verdade sobre o
que cada pergunta usa. O crawler gera `dados/INDICE_PERGUNTAS.md`, a visão por pergunta do que foi baixado.

### Fotos dos candidatos

O TSE publica a foto de registro de cada candidatura num zip por eleição e UF
(`foto_cand<ano>_<UF>_div.zip`), de 2004 em diante; antes disso não há fotos. O Amapá não
publicou as de 2008, e o DF só tem zip nas eleições gerais.

```bash
python -m crawler --fotos --simular
```

```bash
python -m crawler --fotos --ufs AC BA GO PE PI PR BR
```

- Brasil inteiro, 2004 a 2024: 296 zips, **40,6 GB** estimados (2020 e 2024 somam 30 GB); baixado, ocupou 38 GB
  (medido em 07/11/2026). As 6 UFs do exemplo acima + BR: 10,2 GB.
- Os zips ficam inteiros em `dados/tse/fotos_candidatos/<ano>/`, sem extração: são milhões de imagens
  (só as 6 UFs do exemplo + BR somam 745.963), e a API lê cada uma direto do zip pelo nome, que varia por eleição:
  `F<UF><SQ>_div` (2006-2008 e 2016+), `<UF><SQ>_div` (2010-2014) e `F<UF><MUNICÍPIO TSE>_<SQ>_div` (2004,
  quando o SQ só era único dentro do município).
- Cada zip tem o CRC de todas as imagens conferido; o manifesto guarda a contagem por formato e
  `dados/tse/fotos_candidatos/RESUMO.md` mostra as fotos por eleição e UF.
- Aceita `--anos`, `--atualizar`, `--simular`, `--limite-gb` e `--carreira-ate 2026`, e é retomável como o resto.

## Banco de dados (PostgreSQL 17)

As migrações ficam em `banco/migracoes/` e seguem o DER final. O `docker-compose.yml` sobe o banco
e aplica as migrações pendentes (o serviço `migracoes` registra o que já aplicou em `schema_migrations`):

```bash
docker compose up -d
```

Depois, carregue as UFs desejadas. As UFs já carregadas são puladas:

```bash
python -m loader SP RJ MG
```

| Opção | Efeito |
|---|---|
| `--dados PASTA` | Lê de outra pasta (padrão `./dados`, mesma organização do crawler) |
| `--banco URL` | Outro banco (padrão `$DATABASE_URL` ou `postgresql://eleicoes:eleicoes@localhost:5432/eleicoes`) |

- Cada arquivo é lido uma única vez por execução, qualquer que seja o número de UFs; os consolidados
  `*_BRASIL.csv` levam cerca de 10 minutos para ser percorridos. Sem o consolidado, são lidos os arquivos por UF.
- Cada UF é gravada numa única transação e registrada em `carga_uf`: se a carga falhar, a UF não fica
  pela metade e pode ser pedida de novo.
- Na primeira carga entra também `BR`: as candidaturas a Presidente, necessárias à votação de toda UF.
- O viés dos partidos é calculado ao fim de cada carga (`python -m loader.vies`, ver P7). Partido sem viés fica
  `NULL`, nunca 0.
- O loader também atualiza, ao fim de cada carga, as views materializadas `campanha`, `despesa_por_eleicao` (P1) e
  `votos_candidato_uf` (P7).
- Não são carregados: votos do exterior (`ZZ`) e `malha_municipio` (a API lê as malhas direto de `dados/ibge/malhas/`).
- Duas tabelas são preenchidas por scripts das perguntas, não pelo loader: `ibge_censo_municipio.idade_media_populacao`
  por `python scripts/06_idade_alternancia.py` (P6) e `vies_municipio` por `python scripts/07_vies_politico_municipio.py`
  (P7). Depois de recriar o banco, rode os dois. A API não lê essas tabelas (calcula o viés na hora, sobre a view
  `vies_votos_cargo`); elas servem às respostas em `respostas/`.

### Migrações

| Migração | O que cria |
|---|---|
| `001_territorio_e_eleicao.sql` | UF, município, zona eleitoral, cargo, partido e eleição (uma disputa: pleito, turno, cargo e unidade eleitoral) |
| `002_candidaturas.sql` | Político, candidatura (`politico_eleicao`), mandato, bens, receitas, fornecedores e despesas de campanha |
| `003_votacao.sql` | Votos por candidato e por partido (zona e município), perfil do eleitorado por zona (escolaridade) e comparecimento |
| `004_indicadores_municipais.sql` | `indices_municipio` (IDHM, PIB, população, idade mediana, índice de envelhecimento), `ibge_censo_municipio`, `vies_municipio` e `malha_municipio` |
| `005_controle_de_carga.sql` | `carga_uf`: as UFs já carregadas |
| `006_vies_partidos.sql` | Viés (artigo) e alinhamento (SVD da Câmara) por eleição e a view `vies_votos_cargo` (P7) |
| `010_busca_politicos.sql` | Busca de políticos pelo nome, sem acentos e tolerante a erros (trigramas, `pg_trgm`) (P10) |
| `011_custo_da_cadeira.sql` | Partido de toda candidatura (`politico_eleicao.id_partido`), IPCA de outubro (`ipca_outubro`) e as views `campanha` e `despesa_por_eleicao` (P1) |
| `012_votos_candidato_uf.sql` | View `votos_candidato_uf`: votos nominais de cada candidatura por UF e ano (P7) |
| `013_numero_e_nome_de_urna.sql` | Número na urna e nome de urna de cada candidatura (`politico_eleicao.nr_candidato`, `nm_urna`; santinhos, P10) |
| `014_escolaridade.sql` | Escolaridade e situação final de cada candidatura e a tabela `escolaridade` (P4) |

Os números 007 a 009 não existem mais: viraram a `006_vies_partidos.sql` na correção do viés.

- **Banco carregado antes da 011, 013 ou 014:** cargas novas já gravam tudo; num banco antigo, rode uma vez
  `python -m loader.partidos` (relê só os arquivos de candidatos, ~2 min), que preenche o partido, o número e o nome
  de urna, a escolaridade e a situação de cada candidatura e atualiza as views.
- **Banco criado antes da correção do viés:** as antigas migrações 006 a 009 viraram um único
  `006_vies_partidos.sql`, e 001 e 004 foram editadas no lugar. Como o serviço `migracoes` só aplica arquivos
  novos, recrie o banco e carregue as UFs de novo:

  ```bash
  docker compose down -v
  docker compose up -d
  python -m loader SP RJ MG
  ```

### Remover UFs

Para tirar UFs do banco (ex.: liberar espaço ou recarregar do zero):

```bash
python -m loader.remover AC RS --simular
```

```bash
python -m loader.remover AC RS
```

- `--simular` mostra quantas linhas sairiam de cada tabela e desfaz tudo no fim; `--banco` funciona como no loader.
- Cada UF sai numa única transação: municípios, zonas, disputas, candidaturas, votação, contas, indicadores, o
  registro em `carga_uf` e os políticos e fornecedores que ficaram sem candidatura. Partidos e cargos ficam.
- `BR` (candidaturas a Presidente) só sai junto com a última UF, porque a votação de toda UF depende dela.
- Depois, a UF pode ser carregada de novo com `python -m loader` e é preciso **reiniciar a API**.

## As perguntas

### Pergunta -> resposta -> tela

| # | Pergunta | Script e resposta | No site (interface completa / simples) |
|---|---|---|---|
| 1 | Quanto custa uma cadeira? | `scripts/01_custo_cadeira.py` -> `respostas/01_custo_cadeira.txt` | `/cadeira`, boletim do município e ficha do político / `/cadeira` (só eleições gerais) |
| 2 | Qual a taxa de sucesso eleitoral por patrimônio declarado? | `scripts/02_patrimonio.py` -> `respostas/02_patrimonio.txt` | `/patrimonio` / não tem |
| 3 | Índices do município x eleitos e partidos mais vitoriosos | não há | Indicadores no boletim do município |
| 4 | Escolaridade do candidato x escolaridade dos votantes | `scripts/04_escolaridade.py` -> `respostas/04_escolaridade.txt` | `/escola` / `/escola` |
| 5 | Quantos candidatos de dado partido foram eleitos por votos de legenda? | não há | não tem |
| 6 | Idade média do município x alternância de poder e idade dos eleitos | `scripts/06_idade_alternancia.py` -> `respostas/06_idade_alternancia.txt` e `06_passagens_prefeitura.csv` | não tem |
| 7 | Viés político de um município ou região na linha do tempo | `scripts/07_vies_politico_municipio.py` -> `respostas/07_vies_politico_municipio.txt` | `/`, `/uf/{sigla}` e boletim do município / `/`, `/uf/{sigla}` e município |
| 8 | Sucesso de candidatos dependentes de repasses públicos x financiados por outras fontes | não há | Receitas por fonte (fundos públicos) em `/cadeira` |
| 9 | Onde o candidato investe em propaganda (nuvem de palavras)? | `scripts/09_nuvem_despesas.py` -> `respostas/09_nuvem_despesas/` | Ficha do político / não tem |
| 10 | Sobrevivência da carreira de um político | (busca) `respostas/10b_historico_politico.txt`; (taxa de reeleição) `scripts/10a_taxa_reeleicao.py` -> `respostas/10a_taxa_reeleicao.txt` | `/urna`, ficha do político e `/reeleicao` / `/urna`, `/politico/{id}` e `/reeleicao` |

Os scripts 01, 02, 07 e 10a aceitam UFs (`python scripts/01_custo_cadeira.py PI BA`); sem UF, usam todas as
carregadas. O 04 e o 06 usam sempre todas as carregadas; o 09 recebe uma candidatura. As funções em
comum (conexão, UFs carregadas, gravação em `respostas/`) ficam em `scripts/comum.py`.

### Pergunta -> dados

| # | Escopo | Dados | Colunas-chave |
|---|---|---|---|
| 1 | E.P. | candidatos, despesas contratadas, vagas | `DS_SIT_TOT_TURNO`, `VR_DESPESA_CONTRATADA`, `QT_VAGA` |
| 2 | E.P. | candidatos, bens | `VR_BEM_CANDIDATO` somado por `SQ_CANDIDATO`, `DS_SIT_TOT_TURNO` |
| 3 | E.P. | candidatos, votação por candidato e por partido, detalhe da votação, código TSE-IBGE, PIB e população (IBGE), IDHM | `QT_APTOS`, `QT_ABSTENCOES`, `QT_VOTOS_BRANCOS`, `QT_TOTAL_VOTOS_NULOS`; PIB ÷ população = per capita |
| 4 | 2022, 2024 | candidatos, comparecimento/abstenção, votação por candidato, código TSE-IBGE, instrução no Censo 2022 | `DS_GRAU_INSTRUCAO` (candidato); `DS_GRAU_ESCOLARIDADE` + `QT_APTOS`/`QT_COMPARECIMENTO` (eleitorado por zona) |
| 5 | E.P. | candidatos, votação por candidato e por partido, detalhe da votação, vagas | `DS_SIT_TOT_TURNO` (ELEITO POR QP / ELEITO POR MÉDIA), `QT_VOTOS_NOMINAIS_VALIDOS`, `QT_VOTOS_LEGENDA_VALIDOS`, `QT_TOTAL_VOTOS_VALIDOS`, `QT_VAGA` |
| 6 | E.P. (prefeitos desde 1996) | candidatos, comparecimento/abstenção, votação por candidato, código TSE-IBGE, idade no Censo 2022 | `CD_FAIXA_ETARIA` + `QT_COMPARECIMENTO` (quem votou, por zona), `DT_NASCIMENTO` (idade na eleição; `NR_IDADE_DATA_POSSE` não existe de 2018 a 2024), partido do eleito; população por idade simples, idade mediana e índice de envelhecimento |
| 7 | E.P. | candidatos, votação por partido, código TSE-IBGE, regiões (IBGE), ideologia dos partidos; votações da Câmara (alinhamento, à parte) | votos por `SG_PARTIDO` × escala ideológica |
| 8 | E.P. | candidatos, receitas | `DS_FONTE_RECEITA` (ex.: FUNDO ESPECIAL = FEFC), `DS_ORIGEM_RECEITA`, `VR_RECEITA`, doador originário |
| 9 | E.P. | candidatos, despesas contratadas | `DS_ORIGEM_DESPESA` (tipo), `DS_DESPESA` (texto livre, para a nuvem), `NM_FORNECEDOR` |
| 10 | 1994-2024 | candidatos (16 eleições) | `NR_TITULO_ELEITORAL_CANDIDATO`, `DS_CARGO`, `DS_SIT_TOT_TURNO`, `ST_REELEICAO` |

### P1. Quanto custa uma cadeira?

- **Conta:** custo da cadeira = despesa contratada dos eleitos ÷ cadeiras preenchidas (o gasto médio de quem se
  elegeu). Ao lado, o gasto da disputa por cadeira (despesa de todos os candidatos, eleitos ou não, ÷ cadeiras), o
  eleito típico (mediana) e o não eleito típico.
- **Base:** a view `campanha` (migração `011_custo_da_cadeira.sql`): despesa contratada de cada candidatura sem as
  doações a outras campanhas (seriam contadas duas vezes), receitas por fonte e votos do 1º turno. Valores também em
  reais de outubro de 2024, pelo IPCA de outubro de cada ano (`ipca_outubro`, IBGE/SIDRA 1737).
- **Resposta:** `python scripts/01_custo_cadeira.py` -> `respostas/01_custo_cadeira.txt`.
- **No site:** `/cadeira` (plenário: quanto custa uma cadeira, por cargo, ano e estado ou câmara municipal, em 2D e
  3D, com a chance de vitória por faixa de gasto, o preço por partido, as despesas por tipo e as receitas por fonte);
  o boletim do município traz o custo da cadeira de prefeito e de vereador em 2020 e 2024; a ficha do político, o
  custo das suas campanhas. API: `/api/cadeira`.

### P2. Qual a taxa de sucesso eleitoral por patrimônio declarado?

- **Conta:** soma os bens de cada candidatura apta e compara a proporção de eleitos em quatro faixas (quartis) de
  patrimônio positivo, calculadas separadamente por ano e cargo. Ausência de bens no TSE não é patrimônio zero:
  aparece em grupo próprio, fora dos quartis (sem bens e R$ 0). Exclui vices, suplentes e eleições suplementares;
  Presidente usa sempre a carga nacional (`BR`).
- **Resposta:** `python scripts/02_patrimonio.py` -> `respostas/02_patrimonio.txt`.
- **No site:** `/patrimonio` (candidatos e eleitos por faixa, a fila dos que declararam bens e o panorama de todos os
  cargos e anos). API: `/api/patrimonio` e `/api/patrimonio/panorama`.

### P3. Índices do município x eleitos e partidos mais vitoriosos

- **Sem script de resposta.** Os indicadores estão no banco (`indices_municipio`, `votacao_municipio`) e aparecem no
  boletim de cada município: PIB per capita, IDHM, população, eleitores ÷ população e "isentos" no 1º turno (brancos,
  nulos e abstenções ÷ aptos), ao lado do viés, dos prefeitos eleitos e do custo da cadeira. API: `/api/municipios/{ibge}`.
- A P3 ficou no E.P. completo porque há indicadores para os quatro anos: PIB municipal até 2023,
  estimativas de população para 2018, 2020 e 2024 e o Censo para 2022.
- O IDHM municipal mais recente é o do Censo 2010 (os anteriores são 1991 e 2000). Para 2024 use o PIB de 2023.
  Não há estimativa de população para 2022 e 2023; em 2022 use o Censo.

### P4. Escolaridade do candidato x escolaridade dos votantes (2022 e 2024)

- **(A)** A escolaridade do candidato muda a chance de ser eleito? Eleitos ÷ candidaturas aptas, por grau de
  escolaridade, ano e cargo. **(B)** Lugares com eleitores menos escolarizados elegem pessoas menos escolarizadas?
  Municípios em cinco grupos (quintis) pela % de quem votou com superior completo, contra a % de candidatos, eleitos
  e votos com superior.
- **Base:** a migração `014_escolaridade.sql` guarda a escolaridade e a situação final de cada candidatura
  (`politico_eleicao.ds_grau_instrucao`, `ds_sit_tot_turno`; antes só existia a da candidatura mais recente, em
  `politico`) e cria a tabela `escolaridade`, que põe os 8 graus do TSE em ordem para candidato e eleitor. Quem votou =
  comparecimento do 1º turno por zona (`perfil_eleitorado_munzona`).
- **Resposta:** `python scripts/04_escolaridade.py` -> `respostas/04_escolaridade.txt`.
- **No site:** `/escola` (o diploma ajuda a se eleger, do eleitor ao eleito, a chance de cada grau; onde se estudou
  menos se elege menos diploma, com os cinco grupos de municípios, mapa por estado com 3D, dispersão, ranking e o
  boletim; cada cargo e cada estado, os partidos; filtro por estado). API: `/api/escola` e seus desdobramentos.
- A escolaridade do eleitor no TSE é a declarada no alistamento e raramente é atualizada, então subestima a
  escolaridade real. O Censo 2022 (SIDRA 10061, pessoas de 18+ anos) serve de controle.

### P5. Quantos candidatos de dado partido foram eleitos por votos de legenda?

- **Sem script de resposta nem tela.** Os dados estão no banco: a situação de cada candidatura (`ELEITO POR QP`,
  `ELEITO POR MÉDIA`), os votos nominais e de legenda por partido e zona (`votacao_partido_munzona`) e as vagas. A API
  já devolve os votos de legenda de cada partido na composição do viés de um estado (`/api/ufs/{sigla}/composicao`),
  mas o site não os mostra como resposta da P5.

### P6. Idade média do município x alternância de poder e idade dos eleitos

```bash
python scripts/06_idade_alternancia.py
```

- **(A) Perfil etário:** idade média de quem votou no 1º turno (TSE, por faixa etária e zona, muda a cada eleição);
  idade média da população (Censo 2022, SIDRA 9514, idade simples); idade mediana e índice de envelhecimento (SIDRA
  9515) como conferência. Os municípios são divididos em três terços (mais jovem, intermediário e mais velho), no país
  e dentro de cada UF, porque a idade muda muito entre regiões.
- **(B) Alternância de poder:** cada passagem de mandato de prefeito de 1996 a 2024 (8 eleições ordinárias, 7
  passagens) é marcada pelo partido como **mesmo partido** (renomeações, como PMDB -> MDB e PFL -> DEM, contam como o
  mesmo partido), **troca de partido** ou **troca com ressalva**, quando o partido do prefeito anterior foi incorporado
  ao do novo entre as duas eleições (DEM e PSL no UNIÃO em 2022; PTB e Patriota no PRD em 2023); e pela pessoa
  (reeleição ou não). O índice de alternância sai nas duas leituras da fusão (como troca e como continuidade).
- **(C) Idade dos eleitos:** prefeito e vereadores eleitos em 2020 e 2024, contra os candidatos e quem votou.
- **(D) Jovem vota no jovem?** O voto é secreto, então a resposta vem do perfil de cada zona eleitoral (inferência
  ecológica): para deputado (2018 e 2022), entre zonas da mesma UF, que têm os mesmos candidatos; para vereador e
  prefeito (2020 e 2024), entre zonas do mesmo município. Cada efeito sai também com a escolaridade de quem votou
  fixa, porque nas cidades as zonas mais velhas são também as mais escolarizadas.
- **Resposta:** `respostas/06_idade_alternancia.txt` e `respostas/06_passagens_prefeitura.csv` (cada passagem, com a
  marca e se foi a mesma pessoa). O script também preenche `ibge_censo_municipio.idade_media_populacao`.
- **Dados sem mudar o banco:** a faixa etária de quem votou vem dos CSVs `perfil_comparecimento_abstencao`, que o
  loader agrega só por escolaridade; o script os lê uma vez e guarda o resumo em
  `dados/_derivados/eleitorado_idade_zona.csv` (~40 s; `--refazer-cache` refaz). A idade da população vem do Censo
  2022 por idade simples (`python -m crawler --perguntas 6 --fontes ibge`).
- Para medir alternância com mais pontos no tempo, os arquivos de candidatos de 1994 a 2024, baixados para a P10,
  trazem a sequência de prefeitos desde 1996 sem custo extra de download. Em 2000 o TSE marca dois "eleitos" a prefeito
  em 30 municípios (o vice, do mesmo partido). As mudanças de partido anteriores a 2018 (PRN -> PTC; PST e PGT -> PL;
  PSD antigo, número 41, -> PTB; PRONA -> PR; PAN -> PTB) ficam no script, e não em
  `banco/referencia/sucessao_partidos.csv`, para não mexer no viés da P7.
- **No site:** ainda não tem tela.

### P7. Viés político de um município ou região na linha do tempo

O **viés** de cada partido é a média das notas dos especialistas de Bolognesi et al. (`dados/ideologia_partidos/df_experts.csv`;
0 = extrema esquerda, 10 = extrema direita), mostrada de -100 a +100 por `(média - 5) * 20`. Cada eleição usa a sua
onda: 2018 e 2020 a de 2018; 2022 e 2024 a de 2022 (em 2024 estendida por dois anos, o que a interface avisa).

O **alinhamento na Câmara** é outra medida, mostrada à parte: a posição de cada partido nas votações nominais do
Plenário (SVD), numa janela que termina antes de cada eleição. Ele acompanha quem é governo e quem é oposição, e não
a ideologia.

| Onde | O quê |
|---|---|
| `eleicao_referencia` (migração 006) | Onda do artigo, janela do SVD e cargos de cada eleição |
| `vies_partido_onda` | Viés de cada partido em cada eleição: média (0 a 10), escala -100 a +100 e a origem do número |
| `partido_alinhamento` | Alinhamento de cada partido em cada eleição (-100 a +100) |
| `partido.vies_politico` | O viés da eleição mais recente do partido, de -100 a +100 (`NULL` = sem valor) |
| `vies_votos_cargo` (view) | Votos por município, ano e cargo, com o viés e o alinhamento daquela eleição: base do script 07 e da API |
| `votos_candidato_uf` (view, migração 012) | Votos nominais de cada candidatura por UF e ano: a composição do viés de um estado sai em milissegundos |
| `vies_municipio` | Viés, alinhamento, cobertura e nº de cargos por município e ano (script 07) |
| `banco/referencia/sucessao_partidos.csv` | Renomeações (mesmo valor) e fusões (média dos componentes): PRD 2024 = PTB + Patriota, Podemos 2024 = Podemos + PSC, Solidariedade 2024 = Solidariedade + PROS, Mobiliza = PMN etc. |
| `banco/referencia/tabela1_artigo.csv` | Tabela 1 do artigo, conferida pelos testes |
| `banco/referencia/svd/` | Resultado de cada janela do SVD (`svd_eleicao_<ano>.csv`) e os parâmetros e a validação (`janelas.csv`) |

O `loader` grava o viés e o alinhamento sozinho ao fim de cada carga. Depois de mudar as regras de sucessão ou os
arquivos do SVD, recalcule à mão:

```bash
python -m loader.vies
```

A origem de cada número ("direto", "renomeado de X", "média de X e Y") fica em `respostas/vies_partidos_auditoria.csv`
(gerado a cada execução, fora do git).

O viés de um município num ano é calculado em cada cargo (média dos vieses ponderada pelos votos válidos do 1º turno,
nominais e de legenda) e os cargos entram com peso igual. Partidos sem viés ficam fora da média e aparecem na
cobertura. Estados e regiões usam a mesma conta. Para gravar `vies_municipio` e gerar
`respostas/07_vies_politico_municipio.txt`:

```bash
python scripts/07_vies_politico_municipio.py
```

Para refazer o alinhamento, baixe as votações da Câmara e rode a janela de cada eleição (as datas estão em
`eleicao_referencia` e em `banco/referencia/svd/janelas.csv`):

```bash
python -m crawler --fontes camara
python scripts/svd_camara.py --nome eleicao_2024 --inicio 2023-02-01 --fim 2024-10-05 --partido moda --experts dados/ideologia_partidos/df_experts.csv --onda 2022
```

- `scripts/svd_camara.py` grava em `banco/referencia/svd/` e mostra a correlação com o artigo e com o governo.
- `df_experts.csv` traz as notas individuais dos especialistas (0 = esquerda, 10 = direita) por partido, em 2018 e
  2022. A escala sai da média por partido, com duas casas, como na Tabela 1 do artigo. Partidos criados ou fundidos
  depois de 2022 (PRD = PTB + Patriota; Mobiliza = ex-PMN; PROS incorporado ao Solidariedade; PSC ao Podemos) estão
  mapeados em `banco/referencia/sucessao_partidos.csv`. Uma fusão posterior à onda usa a média dos componentes, mesmo
  que o partido tenha valor próprio na onda (Podemos 2024 = 7,93, e não os 7,44 do Podemos de 2022). O alinhamento da
  Câmara não substitui o viés: correlaciona mais com o apoio ao governo da época (0,81 a 0,93) do que com o artigo
  (0,68 a 0,77).
- **No site:** `/` (mapa do Brasil, viés por estado, linha do tempo 2018-2024), `/uf/{sigla}` (municípios, de onde
  vem o viés, com partidos e candidatos, alinhamento na Câmara, regiões intermediárias, extremos, relevo 3D) e o
  boletim do município (viés, espectro do voto, alinhamento, prefeitos, custo da cadeira, indicadores, QR code). API:
  `/api/ufs`, `/api/ufs/{sigla}`, `/api/ufs/{sigla}/composicao`, `/api/vies/cargos` e `/api/municipios/{ibge}`.

### P8. Sucesso de candidatos dependentes de repasses públicos x financiados por outras fontes

- **Sem script de resposta.** As receitas de cada candidatura, com a fonte (`DS_FONTE_RECEITA`: FUNDO ESPECIAL =
  FEFC, FUNDO PARTIDARIO, OUTROS RECURSOS), estão em `receita_de_campanha` e somadas por fonte na view `campanha`.
- **No site:** só a parte das receitas: em `/cadeira`, quanto do dinheiro que entrou nas campanhas veio de fundos
  públicos (fundo eleitoral e fundo partidário), por cargo, ano e estado. A comparação de sucesso entre os grupos
  ainda não existe.

### P9. Onde o candidato investe em propaganda (nuvem de palavras)?

Com uma candidatura carregada no banco, descubra o `id_politico_eleicao` pelo nome e ano (a chave
muda se o banco for recriado). Por exemplo, numa consulta SQL:

```sql
SELECT pe.id_politico_eleicao, p.nome, e.ano, c.nome AS cargo
FROM politico_eleicao pe
JOIN politico p ON p.id_politico = pe.id_politico
JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
JOIN cargo c ON c.cod_cargo = e.cod_cargo
WHERE p.nome ILIKE '%NOME%' AND e.ano = 2024;
```

Depois rode `python scripts/09_nuvem_despesas.py <id_politico_eleicao>`. O script grava
`respostas/09_nuvem_despesas/<ano>_<nome>_<id>.png` (nuvem ponderada pelo valor contratado) e
`respostas/09_nuvem_despesas/<ano>_<nome>_<id>.txt` (valores, percentuais, tipos declarados ao TSE e até
cinco fornecedores por tipo). `python scripts/09_nuvem_despesas.py --auditar` grava
`respostas/09_nuvem_despesas/auditoria_classificacao.txt`.

- Usa o tipo oficial da despesa; a descrição livre só classifica tipos genéricos quando contém termos reconhecíveis.
  Não infere o serviço pelo fornecedor.
- Exclui doações financeiras a outras campanhas para evitar dupla contagem, como na P1.
- **No site:** a nuvem de gastos fica na ficha de cada político (`/politico/{id}`, em cada candidatura de 2018 a
  2024); a página `/metodologia` mostra as campanhas que mais gastaram. A API (`/api/gastos`) usa as mesmas regras do
  script.

### P10. Sobrevivência da carreira de um político

- **Busca e carreira:** a urna de consulta (`/urna`, UE2020 em vetor) busca pelo nome e por uma cédula de filtros
  (cargo, ano, estado, partido, resultado); a ficha da carreira (`/politico/{id}`; o id muda quando o banco é
  recriado) mostra a situação atual, a fita das eleições, a trajetória com os partidos, o custo das campanhas e os
  santinhos (número e nome de urna, migração 013). A busca usa trigramas sem acentos (migração
  `010_busca_politicos.sql`). API: `/api/politicos`, `/api/politicos/{id}`, `/api/politicos/aleatorio` e
  `/api/partidos`. A consulta equivalente em SQL está em `respostas/10b_historico_politico.txt`.
- **Taxa de reeleição (P10a):** dos eleitos numa eleição, quantos disputam a reeleição (mesmo cargo, mesma UF ou
  município, na eleição ordinária seguinte; senador: 8 anos depois) e quantos vencem.
  `python scripts/10a_taxa_reeleicao.py` -> `respostas/10a_taxa_reeleicao.txt`. No site: `/reeleicao`. API:
  `/api/reeleicao` e `/api/reeleicao/pessoas`.
- **Chave do político:** o CPF vem mascarado (`-4`) em 2024. O título eleitoral (`NR_TITULO_ELEITORAL_CANDIDATO`) e a
  data de nascimento estão presentes em todos os anos conferidos (1998, 2008, 2016, 2018, 2024). `SQ_CANDIDATO` muda
  a cada eleição e serve só para ligar arquivos da mesma eleição (bens, receitas, despesas, votação).
- Votação por candidato fora do E.P. não é baixada: a P10 não precisa de votos, porque situação e reeleição estão nos
  arquivos de candidatos.

## API (Voto Aberto)

API em FastAPI sobre o banco carregado, consumida pelo front-end. Com o banco no ar (Docker Desktop aberto e
`docker compose up -d`) e o `.venv` ativo:

```bash
python -m uvicorn api.app:app --port 8000
```

| Endpoint | Retorna |
|---|---|
| `GET /api/saude` | Se o banco responde e as UFs carregadas (503 com instruções se o banco estiver fora) |
| `GET /api/geo/brasil`, `GET /api/geo/uf/{sigla}` | Malhas do IBGE em GeoJSON, com os anéis no sentido que o d3-geo espera |
| `GET /api/municipios?q=&uf=&limite=8` | Busca de municípios por nome, sem acentos, em todo o Brasil |
| `GET /api/fotos/{ano}/{uf}/{sq}` | Foto da candidatura, lida do zip do TSE (candidaturas, busca e prefeitos já trazem a URL em `foto`) |
| `GET /api/cadeira?ano=&cargo=&uf=&municipio=` | P1: custo da cadeira (gasto médio dos eleitos) e gasto da disputa por cadeira (gasto de todos os candidatos ÷ eleitos), cada eleito com gasto e votos, chance de vitória por faixa de gasto, preço por partido, despesas por tipo, receitas por fonte e o fator do IPCA |
| `GET /api/patrimonio?ano=&cargo=&uf=` | P2: candidatos e eleitos por faixa de patrimônio declarado (sem bens, R$ 0 e quartis, com limites e o candidato do meio) e a fila dos que declararam bens em 100 passos, como em `respostas/02_patrimonio.txt`; Presidente sempre nacional |
| `GET /api/patrimonio/panorama?uf=` | P2: a taxa de cada faixa em todos os cargos e anos de uma vez, e em quantas disputas a faixa de mais bens supera a de menos |
| `GET /api/municipios/{ibge}?cargo=` | P7, P3 e P1 no boletim: viés e alinhamento (do município e da UF), votos por partido com o viés de cada eleição, indicadores (PIB per capita, IDHM, população, eleitores ÷ população, isentos), comparecimento, prefeitos e custo da cadeira de prefeito e vereador (2020 e 2024) |
| `GET /api/escola?ano=&uf=` | P4 (2022 ou 2024; `uf` opcional recorta um estado): quem votou, candidatos e eleitos por grau de escolaridade e cargo, municípios em quintis pela escolaridade de quem votou e a correlação |
| `GET /api/escola/municipios?ano=&uf=` | P4: cada município com a % de superior completo de quem votou, dos candidatos, dos eleitos e dos votos (mapa, dispersão e ranking) |
| `GET /api/escola/partidos?ano=&uf=` | P4: cada partido na ordem do viés, com candidatos e eleitos e quantos deles têm superior completo |
| `GET /api/escola/comparar` | P4: 2022 e 2024 lado a lado, por estado e cargo (candidatos e eleitos por grau) e quem votou por estado |
| `GET /api/escola/municipio/{ibge}?ano=` | P4 no município: quem votou por grau, os eleitos (2024) com grau e partido, os votos para deputado (2022) ou vereador por grau, e o quintil |
| `GET /api/vies/cargos` | P7: os cargos do filtro do atlas, com os anos de cada um e se é municipal |
| `GET /api/ufs?cargo=` | P7: as 27 UFs, com nº de municípios, se estão carregadas, o viés e o alinhamento na Câmara por ano |
| `GET /api/ufs/{sigla}?cargo=` | P7: viés da UF, das regiões intermediárias e de cada município, alinhamento da UF e de cada município, % dos votos em partidos sem viés e eleitorado apto por ano |
| `GET /api/ufs/{sigla}/composicao?ano=&cargo=` | P7: de onde vem o viés da UF no ano: cada partido com votos (nominais e de legenda), viés naquela eleição e quanto puxa a média (a soma dá o viés; partido sem viés puxa 0), e os candidatos mais votados de cada partido |
| `GET /api/ufs/{sigla}/composicao/{partido}?ano=&cargo=&q=&desde=&limite=` | P7: os candidatos de um partido na composição, paginados e com busca pelo nome |
| `GET /api/gastos?candidatura=` | P9: a nuvem de gastos de uma candidatura (`id_politico_eleicao`), com as regras de `scripts/09_nuvem_despesas.py` |
| `GET /api/gastos/destaques` | P9: as 3 campanhas que mais gastaram em cada ano |
| `GET /api/politicos?q=&cargo=&ano=&uf=&partido=&resultado=&limite=8` | P10: busca de políticos por nome (trigramas, sem acentos; migração `010_busca_politicos.sql`) e/ou por uma candidatura que bata com todos os filtros |
| `GET /api/partidos` | P10: siglas das candidaturas (filtro da busca), com o viés atual do partido (`partido.vies_politico`; média quando a sigla teve mais de um número; `null` = sem viés) |
| `GET /api/politicos/aleatorio` | P10: um político com 5+ candidaturas e 2+ vitórias |
| `GET /api/politicos/{id}` | P10: candidaturas, resultados, votos e reeleições do político (sem CPF, título ou data de nascimento) |
| `GET /api/reeleicao?uf=` | P10a: por cargo, eleitos, quantos tentaram a reeleição e quantos voltaram, ciclo a ciclo e somados (média das taxas municipais para prefeito e vereador), como em `respostas/10a_taxa_reeleicao.txt`; alguns segundos na primeira vez de cada UF |
| `GET /api/reeleicao/pessoas?uf=&cargo=&eleitos_em=&grupo=&limite=&desde=` | P10a: os eleitos de um cargo numa eleição que voltaram, perderam ou não tentaram na seguinte (`grupo`), os mais votados primeiro, com a contagem dos três grupos |

- O viés e o alinhamento seguem a mesma conta de `scripts/07_vies_politico_municipio.py`, as duas sobre a view
  `vies_votos_cargo` (cargos com peso igual, partidos sem viés fora da média); o custo da cadeira segue a de
  `scripts/01_custo_cadeira.py`; a nuvem de gastos importa `scripts/09_nuvem_despesas.py`.
- As respostas ficam em cache no processo: **reinicie a API depois de carregar UFs** (ou de rodar `python -m loader.vies`).

## Front-end (Voto Aberto)

Site em `web/`: React 19 + TypeScript + Vite, TanStack Router e Query, Tailwind v4, Motion, D3
(mapas e gráficos) e Three.js via React Three Fiber (urna e relevo 3D). Requer Node 22+, o banco
no ar e a API rodando (seção acima).

```bash
cd web
npm install
npm run dev
```

Abra http://localhost:5173. O Vite repassa `/api` para a API em `127.0.0.1:8000`.

### Telas

| Tela | Rota | Pergunta | Interface simples |
|---|---|---|---|
| Plenário: quanto custa uma cadeira, por cargo, ano e estado (ou câmara municipal), em 2D e 3D | `/cadeira` | P1 (e receitas da P8) | `/cadeira`, só eleições gerais |
| Patrimônio: quem declara mais bens se elege mais? Faixas, fila e panorama | `/patrimonio` | P2 | não tem |
| Escola: o diploma ajuda a se eleger (do eleitor ao eleito, a chance de cada grau) e onde se estudou menos se elege menos diploma (cinco grupos de municípios, mapa por estado com 3D, dispersão, ranking e o boletim); cada cargo e cada estado, os partidos; filtro por estado | `/escola` | P4 | `/escola` |
| Mapa do Brasil, viés por estado, linha do tempo 2018-2024 | `/` | P7 | `/` |
| Estado: municípios, de onde vem o viés (partidos e candidatos), alinhamento na Câmara, regiões intermediárias, extremos, relevo 3D | `/uf/PI` | P7 | `/uf/PI` |
| Boletim do município: viés, espectro do voto, alinhamento na Câmara, prefeitos, custo da cadeira, indicadores, QR code | `/uf/PI/2211001` | P7, P1, P3 | `/uf/PI/2211001` |
| Urna de consulta (UE2020 em vetor): busca pelo nome e cédula de filtros (cargo, ano, estado, partido, resultado) | `/urna` | P10 | `/urna` (lista de políticos) |
| Ficha da carreira: situação atual, fita das eleições, trajetória com os partidos, custo das campanhas, nuvem de gastos, santinhos | `/politico/{id}` (o id muda quando o banco é recriado) | P10, P9, P1 | `/politico/{id}`, sem a nuvem |
| Reeleição: quem tenta a reeleição, volta? Taxa por cargo e estado, ciclo a ciclo, e as pessoas | `/reeleicao` | P10a | `/reeleicao` |
| Fontes, método e limitações | `/metodologia` | todas | não tem |

As UFs carregadas não são fixas no site: ele lê `carregada` de `/api/ufs` (no mapa, as outras ficam hachuradas).

### Interface completa e interface simples

O site tem duas interfaces sobre os mesmos dados: a **completa** (mapa, urna, plenário, 3D) e a
**simples** (páginas lineares com gráficos e fotos, paleta própria, sem logo; em `web/src/simples/`).
A interface é escolhida **só ao subir o site**: cada uma é um pacote separado, em porta própria, e
nenhuma tem botão, link ou parâmetro que leve à outra.

| Interface | Desenvolvimento | Produção |
|---|---|---|
| Completa | `npm run dev` → http://localhost:5173 | `npm run build` e `npm run preview` → http://localhost:4173 |
| Simples | `npm run dev:simples` → http://localhost:5174 | `npm run build:simples` e `npm run preview:simples` → http://localhost:4174 |

Por baixo, quem decide é `VITE_INTERFACE` (`completa`, o padrão, ou `simples`), lida pelo
`vite.config.ts`; `--mode simples` a lê de `web/.env.simples`. Um valor diferente desses dois
impede o site de subir. As duas podem rodar ao mesmo tempo, cada uma na sua porta.

Para rodar uma segunda API (em outra porta) sem derrubar a primeira, aponte o site para ela com
`API_ALVO` e escolha a porta do site com `PORTA`, por exemplo `API_ALVO=http://127.0.0.1:8001 PORTA=5180 npm run dev`;
os testes ponta a ponta usam `SITE=http://localhost:5180` (e `SITE_SIMPLES` para a interface simples).

Para só usar ou apresentar o site, a versão de produção é bem mais leve para o computador
(sem o modo de desenvolvimento do React): `npm run build` e depois `npx vite preview`,
em http://localhost:4173 (também repassa `/api` para a API).

### Formas de subir o site

| Para quê | Comando | Endereço |
|---|---|---|
| Programar (recarrega ao salvar; pesado) | `npm run dev` | http://localhost:5173 |
| Apresentar no notebook (versão de produção, leve) | `npm run apresentar` | http://localhost:4173 |
| Celular na mesma rede privada (casa) | `npm run rede` | `http://<IP da rede>:4173/?chave=...` |
| Celulares em qualquer Wi-Fi (universidade) | `npm run rede:publico` | `https://<sorteado>.trycloudflare.com/?chave=...` |

Para apresentar, use sempre a versão de produção (`apresentar`, `rede` ou `rede:publico`). Medido
neste notebook: no `npm run dev` cada página trava de 450 a 800 ms ao abrir e usa de 2 a 3 vezes mais
memória; na produção, as páginas abrem sem travar e rolam a 60 quadros por segundo.

### Abrir no celular (QR code do boletim)

Com `npm run rede` ou `npm run rede:publico`, o terminal mostra um endereço com `?chave=...`. Abra-o
no notebook: o QR code de cada boletim de município já leva esse endereço com a chave, e o celular
que escanear abre a mesma página.

- **`rede`** (casa): o celular fala direto com o notebook, pela rede privada. Na primeira vez o
  Windows pergunta se o Node.js pode usar a rede: permita só em **Redes privadas**. Para escolher
  outra rede privada: `REDE_IP=<ip> npm run rede`.
- **`rede:publico`** (Wi-Fi da universidade, que é rede pública e costuma isolar os aparelhos): o
  `cloudflared` leva o site até a Cloudflare por uma conexão de saída e devolve um link `https`. Não
  precisa marcar o Wi-Fi como privado nem mexer no firewall, e não faça isso: numa rede pública,
  isso exporia o notebook a todo o campus. Usa o `cloudflared` do instalador oficial (`C:\Program Files (x86)\cloudflared`, já instalado
  neste notebook, versão 2026.9.1 com assinatura válida da Cloudflare); ou o de `web/.ferramentas/`
  (fora do git), o do PATH ou `CLOUDFLARED=<caminho>`. Não precisa de conta: é um túnel rápido, com
  endereço sorteado a cada execução.

O que protege o notebook, nos dois:

- Sai do notebook só a versão de produção (`dist`), nunca o servidor de desenvolvimento do Vite.
- `rede` escuta só no IP privado da rede local (192.168.x, 10.x, 172.16-31.x): adaptadores virtuais
  e VPNs (WSL, Hyper-V, Docker, ZeroTier, Tailscale) e IPs públicos são recusados, e o terminal lista
  o que não foi exposto. `rede:publico` escuta só em `127.0.0.1`.
- Uma chave aleatória nova a cada execução: sem ela, tudo responde 403. Quem não escaneou o QR na
  sua tela não abre o site.
- Só leitura (GET e HEAD), cabeçalho Host conferido e `Referrer-Policy: no-referrer`, para a chave
  não vazar para os sites das fotos.
- A API (`127.0.0.1:8000`) e o banco (`127.0.0.1:5432`) continuam só no notebook: este servidor
  repassa `/api` para a API local.
- Desliga sozinho em 60 minutos (`REDE_MINUTOS=30` muda o tempo); Ctrl+C desliga na hora, e no
  `rede:publico` o link deixa de existir.

### Para a apresentação não travar

- Suba com `npm run apresentar`, `npm run rede` ou `npm run rede:publico`, não com `npm run dev`.
- Feche o que não for usar (outros navegadores, editores, abas). O notebook tem 16 GB e, com tudo
  aberto, sobravam menos de 2 GB livres.
- O Docker roda numa máquina virtual (o `vmmemWSL` no Gerenciador de Tarefas) que guarda memória.
  Para a apresentação, o banco pode subir mais leve: `PG_MEMORIA=256MB PG_TRABALHO=16MB docker compose up -d db`
  (os valores padrão, maiores, são para carregar estados). Para limitar a máquina virtual, crie
  `C:\Users\<você>\.wslconfig` com `[wsl2]` e `memory=4GB` e rode `wsl --shutdown`; vale para o
  Docker inteiro.
- Os 3D (relevo, plenário em pé, mapa em pé) calculam as sombras enquanto as colunas crescem e as
  congelam quando a cena assenta; ao girar, a resolução baixa um pouco e volta quando a câmera para.

### Outros comandos do site

- `npm run build` gera o site estático em `web/dist`; `npm run lint` roda o oxlint.
- A marca é gerada por código: `npm run marca` escreve `src/assets/marca/`, `design/marca/` e o favicon.
- O desenho do sistema está em `design/PROMPT.md` e o produto em `PRODUCT.md`.

## Testes

| O quê | Comando | Precisa do banco? |
|---|---|---|
| Viés: Tabela 1 do artigo e regras de sucessão (P7) | `python -m loader.test_vies --sem-banco`; com o banco, sem a opção (inclui a cobertura por ano) | não / sim |
| Fotos: lógica do crawler, sem rede | `python -m crawler.test_fotos` | não |
| P6: faixas etárias, passagens de mandato, terços e efeitos | `python -m unittest discover -s scripts -p 'test_06*.py'` | não |
| P9: recorte, classificação e soma da nuvem | `python -m unittest discover -s scripts -p 'test_09*.py'` | não |
| API contra o banco | `python -m api.test_api` | sim, com PI carregado |
| Site, ponta a ponta (desktop 1440×900 e celular 390×844, contra os dados reais) | `npx playwright install chromium` uma vez, depois `npx playwright test` (em `web/`) | sim, com API e site no ar |

- `api/test_api.py` e alguns testes ponta a ponta foram escritos com 6 UFs carregadas: supõem SP fora do banco, têm
  totais nacionais da P4 fixos e abrem a ficha `/politico/368990` (Wellington Dias), um id que muda quando o banco é
  recriado. Com outro conjunto de UFs ou depois de recriar o banco, essas checagens falham sem que haja erro no site.

## Organização de `dados/`

```
dados/
├── INDICE_PERGUNTAS.md            <- o que cada pergunta usa e o que já foi baixado
├── tse/
│   ├── candidatos/<ano>/                        consulta_cand_<ano>_BRASIL.csv + leiame.pdf
│   ├── bens_candidatos/<ano>/
│   ├── vagas/<ano>/
│   ├── votacao_candidato_munzona/<ano>/
│   ├── votacao_partido_munzona/<ano>/
│   ├── detalhe_votacao_munzona/<ano>/
│   ├── receitas_candidatos/<ano>/
│   ├── despesas_contratadas_candidatos/<ano>/
│   ├── comparecimento_abstencao/<ano>/
│   ├── municipio_tse_ibge/
│   └── fotos_candidatos/<ano>/                  zips das fotos (opcional, --fotos) + RESUMO.md
├── ibge/
│   ├── pib/  populacao/  censo2022/  territorio/  malhas/
├── ipea_atlas/idhm_municipios.csv
├── ideologia_partidos/            df_experts.csv (notas dos especialistas, P7)
├── camara/                        votacoes, votacoesVotos e votacoesOrientacoes-<ano>.csv (alinhamento, P7)
├── _derivados/                    eleitorado_idade_zona.csv (faixa etária de quem votou, P6; refeito pelo script)
└── _controle/manifesto.json       <- controle interno (versão e arquivos de cada download)
```

Organizei por **fonte/tipo/ano** e não por pergunta porque o mesmo arquivo serve a várias perguntas
(a lista de candidatos é usada pelas 10). Pastas por pergunta duplicariam gigabytes. A visão por
pergunta fica no `INDICE_PERGUNTAS.md`, gerado a cada execução.

## Fontes

| Fonte | Como | O que |
|---|---|---|
| TSE, Portal de Dados Abertos | CDN `cdn.tse.jus.br`; se um caminho mudar, procura o zip pela API CKAN do portal | Candidatos, bens, vagas, votação, prestação de contas, comparecimento, códigos de município, fotos |
| IBGE | API SIDRA + APIs de Localidades e de Malhas | PIB municipal (5938), população estimada (6579), Censo 2022: população (4709), população por idade simples (9514), idade mediana/envelhecimento (9515), instrução 18+ (10061); regiões dos municípios; contornos dos estados e municípios. O IPCA de outubro (SIDRA 1737, P1) não passa pelo crawler: os quatro valores estão gravados na migração `011_custo_da_cadeira.sql` |
| Atlas Brasil (PNUD/Ipea/FJP) | API do Ipeadata, séries `ADH_IDHM`, `_E`, `_L`, `_R` | IDHM e subíndices por município. O link de "dados brutos" do site do Atlas saiu do ar (404) |
| Harvard Dataverse | API, doi:10.7910/DVN/MFIXKW | Classificação ideológica dos partidos (Bolognesi, Codato, Ribeiro & Silva; base de Bolognesi, Ribeiro & Codato, *Dados* 66(2), 2023) |
| Câmara dos Deputados, Dados Abertos | `dadosabertos.camara.leg.br/arquivos/{tipo}/csv/{tipo}-{ano}.csv`, de 2015 ao ano corrente (o ano corrente é baixado de novo a cada execução) | Votações do Plenário, votos dos deputados e orientações de bancada, para o alinhamento dos partidos (P7) |

Os sons do cofrinho (P2) são gravações em domínio público (CC0): Kenney (Impact Sounds, RPG Audio, Interface
Sounds), Freesound (cerâmica quebrando, moedas caindo e um cofre de moedas chacoalhando; não há gravação
livre de cofrinho de porquinho quebrando, então a quebra é uma montagem) e OpenGameArt "scissors"; a origem de cada arquivo está em `web/public/sons/CREDITOS.txt`.

O CDN do TSE recusa (HTTP 403) User-Agents que contenham "crawler", "python" ou "httpx". O crawler
usa um User-Agent compatível que ainda identifica o projeto.

### Avaliadas e descartadas

- **INEP:** a P4 compara a escolaridade do candidato com a de quem vota. O TSE dá a escolaridade do
  eleitorado e do comparecimento por zona, e o Censo 2022 dá a da população. Censo Escolar e IDEB medem a rede de ensino, não a escolaridade adulta.
- **Portal da Transparência (CGU):** o FEFC e o Fundo Partidário recebidos por cada candidato já
  estão nas receitas do TSE (`DS_FONTE_RECEITA`). A API da CGU exige chave e não tem dados de campanha por candidato.
- **`perfil_eleitorado`:** redundante. O `perfil_comparecimento_abstencao` tem `QT_APTOS` com os
  mesmos cortes (faixa etária, escolaridade, zona) e ainda traz o comparecimento. Economia de ~7 GB.
- **Arquivos por seção** (votação, detalhe e perfil do eleitor por seção), boletins de urna e logs:
  somam dezenas de GB e o nível município/zona basta para todas as perguntas. Na P6, seriam o próximo passo de
  precisão para "jovem vota no jovem" (perfil e votação por seção do PI em 2024: 68 MB compactados).
- **Despesas pagas:** P1 e P9 usam as despesas contratadas. As pagas medem o fluxo de caixa e acrescentariam ~4 GB.
- Prestação de contas de órgãos partidários, extratos bancários, CNPJ de campanha, notas fiscais,
  propostas de governo, redes sociais, certidões criminais, motivos de cassação e coligações
  (a composição já vem nos arquivos de candidatos e de votação por partido). As fotos, antes descartadas, entraram
  depois como download opcional (`--fotos`), para a urna e os santinhos.
- Votação por candidato fora do E.P.: a P10 não precisa de votos, porque situação e reeleição estão nos arquivos de candidatos.

## Espaço em disco

| Conjunto | Em disco |
|---|---|
| Prestação de contas (receitas + despesas contratadas), 4 anos | 11,7 GB |
| Votação por candidato/município/zona, 4 anos | 9,1 GB |
| Comparecimento/abstenção por perfil, 4 anos | 8,7 GB |
| Candidatos 1994-2024 (16 eleições) | 2,2 GB |
| Bens, votação por partido, detalhe da votação, vagas, códigos | 1,0 GB |
| IBGE, IDHM, ideologia | 25 MB |
| Votações da Câmara, 2015-2026 (medido em 17/10/2026) | 0,6 GB |
| **Total** (medido em 11/09/2026, salvo a Câmara) | **~34 GB** |
| Fotos dos candidatos, Brasil inteiro, 2004-2024 (opcional, medido em 07/11/2026) | 38 GB |
| Cache da P6 (`dados/_derivados/`, medido em 07/11/2026) | 14 MB |

## Observações gerais para a análise

- **Formato dos CSVs do TSE:** latin-1, separador `;`. Os valores `#NULO#`, `#NE`, `-1`, `-3` e `-4`
  significam ausente ou mascarado. O layout de cada arquivo está no `leiame.pdf` da mesma pasta.
  Os CSVs gerados das APIs (IBGE, Ipeadata) são UTF-8 com separador `;`.
- **Turnos:** os arquivos trazem 1º e 2º turno (`NR_TURNO`). Em `DS_SIT_TOT_TURNO`, "2º TURNO"
  indica que o candidato foi ao 2º turno, e o resultado final está na linha do 2º turno.
- **Municípios:** o código do TSE (5 dígitos) é diferente do IBGE (7). Use `tse/municipio_tse_ibge/`.
- **Datas das eleições:** o banco não guarda `DT_ELEICAO`. As idades da P6 usam o 1º turno de cada ano (07/10/2018,
  15/11/2020, adiada pela pandemia, 02/10/2022 e 06/10/2024).
- As observações de cada pergunta (P3, P4, P6, P7 e P10) ficam na seção da pergunta, em "As perguntas".
