# ProjetoBDR: crawler de dados

Baixa **somente** os arquivos necessários para responder às 10 perguntas do projeto,
nos escopos de tempo definidos (E.P. = 2018, 2020, 2022 e 2024), e organiza tudo em `dados/`.

Tamanho total, medido nos servidores em 11/09/2026: **6,0 GB de download e ~33 GB em disco**
(bem abaixo do teto de 200 GB).

## Uso

Requer Python 3.10+ e rodar a partir desta pasta.

```bash
pip install -r requirements.txt
```

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
| `--fontes tse ibge ipea dataverse` | Só essas fontes |
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

Para mudar o que é baixado, edite só `crawler/catalogo.py` (`ITENS` e `NECESSIDADES`).

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
- O viés dos partidos (`partido.vies_politico`, de -100 a +100) vem da migração `006_vies_partidos.sql`;
  partidos sem viés informado ficam com 0.
- Não são carregados: votos do exterior (`ZZ`), `VIES_MUNICIPIO` (métrica ainda por calcular), `MALHA_MUNICIPIO` e `idade_media_populacao` (o crawler não baixa esses dados).

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

- Brasil inteiro, 2004 a 2024: 296 zips, **40,6 GB** (2020 e 2024 somam 30 GB). As 6 UFs carregadas + BR: 10,2 GB.
- Os zips ficam inteiros em `dados/tse/fotos_candidatos/<ano>/`, sem extração: são milhões de imagens
  (só as 6 UFs + BR somam 745.963), e a API lê cada uma direto do zip pelo nome, que varia por eleição:
  `F<UF><SQ>_div` (2006-2008 e 2016+), `<UF><SQ>_div` (2010-2014) e `F<UF><MUNICÍPIO TSE>_<SQ>_div` (2004,
  quando o SQ só era único dentro do município).
- Cada zip tem o CRC de todas as imagens conferido; o manifesto guarda a contagem por formato e
  `dados/tse/fotos_candidatos/RESUMO.md` mostra as fotos por eleição e UF.
- Aceita `--anos`, `--atualizar`, `--simular`, `--limite-gb` e `--carreira-ate 2026`, e é retomável como o resto.
- Checagem da lógica, sem rede: `python -m crawler.test_fotos`.

## API (Voto Aberto)

API em FastAPI sobre o banco carregado, consumida pelo front-end. Com o banco no ar:

```bash
python -m uvicorn api.app:app --port 8000
```

| Endpoint | Retorna |
|---|---|
| `GET /api/saude` | Se o banco responde e as UFs carregadas (503 com instruções se o banco estiver fora) |
| `GET /api/ufs` | As 27 UFs, com nº de municípios, se estão carregadas e o viés por ano |
| `GET /api/ufs/{sigla}` | Viés da UF, das regiões intermediárias e de cada município, eleitorado apto por ano |
| `GET /api/municipios?q=&uf=&limite=8` | Busca de municípios por nome, sem acentos, em todo o Brasil |
| `GET /api/municipios/{ibge}` | Viés, votos por partido, indicadores (PIB per capita, IDHM...), comparecimento e prefeitos |
| `GET /api/politicos?q=&limite=8` | Busca de políticos por nome (trigramas, sem acentos; migração `010_busca_politicos.sql`) |
| `GET /api/politicos/aleatorio` | Um político com 5+ candidaturas e 2+ vitórias |
| `GET /api/politicos/{id}` | Candidaturas, resultados, votos e reeleições do político (sem CPF, título ou data de nascimento) |
| `GET /api/fotos/{ano}/{uf}/{sq}` | Foto da candidatura, lida do zip do TSE (candidaturas, busca e prefeitos já trazem a URL em `foto`) |
| `GET /api/geo/brasil`, `GET /api/geo/uf/{sigla}` | Malhas do IBGE em GeoJSON, com os anéis no sentido que o d3-geo espera |

- O viés segue a mesma conta de `scripts/07_vies_politico_municipio.py`.
- As respostas ficam em cache no processo: **reinicie a API depois de carregar UFs**.
- Conferência contra o banco (precisa de PI carregado): `python -m api.test_api`.

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
│   └── municipio_tse_ibge/
├── ibge/
│   ├── pib/  populacao/  censo2022/  territorio/
├── ipea_atlas/idhm_municipios.csv
├── ideologia_partidos/
└── _controle/manifesto.json       <- controle interno (versão e arquivos de cada download)
```

Organizei por **fonte/tipo/ano** e não por pergunta porque o mesmo arquivo serve a várias perguntas
(a lista de candidatos é usada pelas 10). Pastas por pergunta duplicariam gigabytes. A visão por
pergunta fica no `INDICE_PERGUNTAS.md`, gerado a cada execução.

## Pergunta -> dados

| # | Escopo | Dados | Colunas-chave |
|---|---|---|---|
| 1 | E.P. | candidatos, despesas contratadas, vagas | `DS_SIT_TOT_TURNO`, `VR_DESPESA_CONTRATADA`, `QT_VAGA` |
| 2 | E.P. | candidatos, bens | `VR_BEM_CANDIDATO` somado por `SQ_CANDIDATO`, `DS_SIT_TOT_TURNO` |
| 3 | E.P. | candidatos, votação por candidato e por partido, detalhe da votação, código TSE-IBGE, PIB e população (IBGE), IDHM | `QT_APTOS`, `QT_ABSTENCOES`, `QT_VOTOS_BRANCOS`, `QT_TOTAL_VOTOS_NULOS`; PIB ÷ população = per capita |
| 4 | 2022, 2024 | candidatos, comparecimento/abstenção, votação por candidato, código TSE-IBGE, instrução no Censo 2022 | `DS_GRAU_INSTRUCAO` (candidato); `DS_GRAU_ESCOLARIDADE` + `QT_APTOS`/`QT_COMPARECIMENTO` (eleitorado por zona) |
| 5 | E.P. | candidatos, votação por candidato e por partido, detalhe da votação, vagas | `DS_SIT_TOT_TURNO` (ELEITO POR QP / ELEITO POR MÉDIA), `QT_VOTOS_NOMINAIS_VALIDOS`, `QT_VOTOS_LEGENDA_VALIDOS`, `QT_TOTAL_VOTOS_VALIDOS`, `QT_VAGA` |
| 6 | E.P. | candidatos, comparecimento/abstenção, votação por candidato, código TSE-IBGE, idade no Censo 2022 | `DS_FAIXA_ETARIA`, `NR_IDADE_DATA_POSSE`, `DT_NASCIMENTO`, partido do eleito; idade mediana e índice de envelhecimento |
| 7 | E.P. | candidatos, votação por partido, código TSE-IBGE, regiões (IBGE), ideologia dos partidos | votos por `SG_PARTIDO` × escala ideológica |
| 8 | E.P. | candidatos, receitas | `DS_FONTE_RECEITA` (ex.: FUNDO ESPECIAL = FEFC), `DS_ORIGEM_RECEITA`, `VR_RECEITA`, doador originário |
| 9 | E.P. | candidatos, despesas contratadas | `DS_ORIGEM_DESPESA` (tipo), `DS_DESPESA` (texto livre, para a nuvem), `NM_FORNECEDOR` |
| 10 | 1994-2024 | candidatos (16 eleições) | `NR_TITULO_ELEITORAL_CANDIDATO`, `DS_CARGO`, `DS_SIT_TOT_TURNO`, `ST_REELEICAO` |

A P3 ficou no E.P. completo porque há indicadores para os quatro anos: PIB municipal até 2023,
estimativas de população para 2018, 2020 e 2024 e o Censo para 2022.

## Fontes

| Fonte | Como | O que |
|---|---|---|
| TSE, Portal de Dados Abertos | CDN `cdn.tse.jus.br`; se um caminho mudar, procura o zip pela API CKAN do portal | Candidatos, bens, vagas, votação, prestação de contas, comparecimento, códigos de município |
| IBGE | API SIDRA + API de Localidades | PIB municipal (tabela 5938), população estimada (6579), Censo 2022: população (4709), idade mediana/envelhecimento (9515), instrução 18+ (10061); regiões dos municípios |
| Atlas Brasil (PNUD/Ipea/FJP) | API do Ipeadata, séries `ADH_IDHM`, `_E`, `_L`, `_R` | IDHM e subíndices por município. O link de "dados brutos" do site do Atlas saiu do ar (404) |
| Harvard Dataverse | API, doi:10.7910/DVN/MFIXKW | Classificação ideológica dos partidos (Bolognesi, Codato, Ribeiro & Silva; base de Bolognesi, Ribeiro & Codato, *Dados* 66(2), 2023) |

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
  somam dezenas de GB e o nível município/zona basta para todas as perguntas.
- **Despesas pagas:** P1 e P9 usam as despesas contratadas. As pagas medem o fluxo de caixa e acrescentariam ~4 GB.
- Prestação de contas de órgãos partidários, extratos bancários, CNPJ de campanha, notas fiscais,
  fotos, propostas de governo, redes sociais, certidões criminais, motivos de cassação e coligações
  (a composição já vem nos arquivos de candidatos e de votação por partido).
- Votação por candidato fora do E.P.: a P10 não precisa de votos, porque situação e reeleição estão nos arquivos de candidatos.

## Espaço em disco (medido em 11/09/2026)

| Conjunto | Em disco |
|---|---|
| Prestação de contas (receitas + despesas contratadas), 4 anos | 11,7 GB |
| Votação por candidato/município/zona, 4 anos | 9,1 GB |
| Comparecimento/abstenção por perfil, 4 anos | 8,7 GB |
| Candidatos 1994-2024 (16 eleições) | 2,2 GB |
| Bens, votação por partido, detalhe da votação, vagas, códigos | 1,0 GB |
| IBGE, IDHM, ideologia | 25 MB |
| **Total** | **~33 GB** |

## Observações para a análise

- **Formato dos CSVs do TSE:** latin-1, separador `;`. Os valores `#NULO#`, `#NE`, `-1`, `-3` e `-4`
  significam ausente ou mascarado. O layout de cada arquivo está no `leiame.pdf` da mesma pasta.
  Os CSVs gerados das APIs (IBGE, Ipeadata) são UTF-8 com separador `;`.
- **Turnos:** os arquivos trazem 1º e 2º turno (`NR_TURNO`). Em `DS_SIT_TOT_TURNO`, "2º TURNO"
  indica que o candidato foi ao 2º turno, e o resultado final está na linha do 2º turno.
- **Municípios:** o código do TSE (5 dígitos) é diferente do IBGE (7). Use `tse/municipio_tse_ibge/`.
- **Chave do político (P10):** o CPF vem mascarado (`-4`) em 2024. O título eleitoral
  (`NR_TITULO_ELEITORAL_CANDIDATO`) e a data de nascimento estão presentes em todos os anos
  conferidos (1998, 2008, 2016, 2018, 2024). `SQ_CANDIDATO` muda a cada eleição e serve só para ligar
  arquivos da mesma eleição (bens, receitas, despesas, votação).
- **P3:** o IDHM municipal mais recente é o do Censo 2010 (os anteriores são 1991 e 2000). Para 2024 use o PIB de 2023.
  Não há estimativa de população para 2022 e 2023; em 2022 use o Censo.
- **P4:** a escolaridade do eleitor no TSE é a declarada no alistamento e raramente é atualizada, então
  subestima a escolaridade real. O Censo 2022 serve de controle.
- **P6:** para medir alternância com mais pontos no tempo, os arquivos de candidatos de 1994 a 2024,
  baixados para a P10, trazem a sequência de prefeitos desde 1996 sem custo extra de download.
- **P7:** `df_experts.csv` traz as notas individuais dos especialistas (0 = esquerda, 10 = direita)
  por partido, em 2018 e 2022. A escala sai da média por partido. Partidos criados ou fundidos depois
  de 2022 (PRD = PTB + Patriota; Mobiliza = ex-PMN; PROS incorporado ao Solidariedade; PSC ao
  Podemos) precisam de mapeamento manual para 2024.
