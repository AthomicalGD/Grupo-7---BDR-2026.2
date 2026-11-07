# Mudanças pendentes na documentação oficial (para auditoria)

Estas mudanças **não foram aplicadas**. São os trechos da documentação pública do repositório que ficaram
desatualizados com a correção do viés político (plano em `Estou lendo no repositório.md`). Cada item traz o
arquivo, o trecho atual e o texto proposto. Nada foi commitado nem enviado ao GitHub.

Arquivos considerados "informação oficial": `README.md`, `PRODUCT.md`, `DESIGN.md` e `design/PROMPT.md`.
O código da aplicação (inclusive a página `/metodologia`, `web/src/paginas/Metodologia.tsx`) foi alterado
diretamente, porque faz parte da implementação do plano.

---

## 1. `README.md`

> **Aplicado** a seu pedido (17/10/2026). Além dos itens abaixo, o README ganhou a seção "Viés dos partidos e
> alinhamento (P7)", a nota para recriar bancos antigos, `camara/` na árvore de `dados/`, a linha da Câmara no espaço
> em disco, o alinhamento nas telas do Estado e do Boletim e `/politico/{id}` no lugar do id fixo. Os itens abaixo
> ficam como registro.

### 1.1 Linhas 85-86 (seção "Banco de dados")

Atual:

```markdown
- O viés dos partidos (`partido.vies_politico`, de -100 a +100) vem da migração `006_vies_partidos.sql`;
  partidos sem viés informado ficam com 0.
```

Proposto:

```markdown
- O viés dos partidos vem da classificação de especialistas (`dados/ideologia_partidos/df_experts.csv`,
  Bolognesi et al.; 0 = extrema esquerda, 10 = extrema direita) e é gravado por `python -m loader.vies`,
  que roda sozinho ao fim de cada carga: `vies_partido_onda` guarda a média de cada partido em cada eleição
  (onda 2018 para 2018 e 2020; onda 2022 para 2022 e 2024) e `partido.vies_politico`, o valor mais recente
  na escala de -100 a +100, por `(média - 5) * 20`. Partido sem valor fica `NULL` (nunca 0).
  Renomeações e fusões estão em `banco/referencia/sucessao_partidos.csv`; a origem de cada valor, em
  `respostas/vies_partidos_auditoria.csv`.
- O alinhamento na Câmara (`partido_alinhamento`, SVD das votações nominais, `scripts/svd_camara.py`) fica
  à parte do viés: acompanha a coalizão de governo, não a ideologia.
- **Banco criado antes desta versão:** as migrações 006 a 009 foram reescritas num único `006_vies_partidos.sql`
  (e 001 e 004 foram editadas no lugar). O executor só aplica arquivos novos, então recrie o banco
  (`docker compose down -v && docker compose up -d`) e carregue as UFs de novo.
```

### 1.2 Linha 118

Atual:

```markdown
- Não são carregados: votos do exterior (`ZZ`), `VIES_MUNICIPIO` (métrica ainda por calcular), `MALHA_MUNICIPIO` e `idade_media_populacao` (o crawler não baixa esses dados).
```

Proposto:

```markdown
- Não são carregados: votos do exterior (`ZZ`), `MALHA_MUNICIPIO` e `idade_media_populacao` (o crawler não baixa esses dados).
  `vies_municipio` é preenchida por `python scripts/07_vies_politico_municipio.py`.
```

### 1.3 Linha 39 (tabela de opções do crawler)

Atual:

```markdown
| `--fontes tse ibge ipea dataverse` | Só essas fontes |
```

Proposto:

```markdown
| `--fontes tse ibge ipea dataverse camara` | Só essas fontes |
```

### 1.4 Tabela "Fontes" (perto da linha 340): nova linha

```markdown
| Câmara dos Deputados, Dados Abertos | `dadosabertos.camara.leg.br/arquivos/{tipo}/csv/{tipo}-{ano}.csv`, 2015 até o ano corrente | Votações do Plenário, votos e orientações de bancada (alinhamento dos partidos, P7) |
```

### 1.5 Linha 176 (seção da API)

Atual:

```markdown
- O viés segue a mesma conta de `scripts/07_vies_politico_municipio.py`; o custo da cadeira, a de `scripts/01_custo_cadeira.py`.
```

Proposto:

```markdown
- O viés segue a mesma conta de `scripts/07_vies_politico_municipio.py`, as duas sobre a view `vies_votos_cargo`
  (migração 006): em cada cargo, média ponderada pelos votos dos partidos com viés; depois, cargos com peso igual.
  O custo da cadeira segue a de `scripts/01_custo_cadeira.py`.
- `/api/ufs`, `/api/ufs/{sigla}` e `/api/municipios/{ibge}` trazem também `alinhamento` (SVD da Câmara), e
  `sem_vies_pct` é a parcela dos votos em partidos sem viés (fora da média).
- Testes do viés sem banco: `python -m loader.test_vies --sem-banco` (com banco, sem a opção).
```

### 1.6 Linha 170 (tabela da API, `/api/partidos`)

Atual: `Siglas das candidaturas, com o viés médio (filtro da busca)`

Proposto: `Siglas das candidaturas, com o viés atual do partido (NULL = sem viés; filtro da busca)`

### 1.7 Observações para a análise, P7 (fim do README)

Atual (resumo): "`df_experts.csv` traz as notas individuais ... Partidos criados ou fundidos depois de 2022 ...
precisam de mapeamento manual para 2024."

Proposto: acrescentar "O mapeamento está em `banco/referencia/sucessao_partidos.csv` e é aplicado por
`python -m loader.vies`: PRD (2024) = média de PTB e Patriota; Podemos (2024) = Podemos + PSC; Solidariedade
(2024) = Solidariedade + PROS; Mobiliza = PMN."

---

## 2. `PRODUCT.md`, linhas 45-46

Atual:

```markdown
- Viés do partido: `partido.vies_politico`, de -100 (esquerda) a +100 (direita).
  Viés do município = média dos vieses ponderada pelos votos válidos de cada partido.
```

Proposto:

```markdown
- Viés do partido: média dos especialistas (Bolognesi et al., 0 a 10) da onda da eleição, mostrada de -100
  (esquerda) a +100 (direita) por (média - 5) * 20 (`vies_partido_onda`; o valor atual em `partido.vies_politico`).
  Viés do município = em cada cargo, média dos vieses ponderada pelos votos válidos dos partidos com viés;
  depois, média dos cargos com peso igual. Partido sem viés fica fora da média.
- Alinhamento na Câmara (SVD das votações nominais): mostrado à parte, com outra paleta; não é o viés.
```

(A linha 43 lista "UFs carregadas hoje: AC, BA, GO, PE, PI, PR, RS"; o banco local tem AC, BA, GO, PA, PE e PI.
Conferir antes de publicar.)

---

## 3. `DESIGN.md`

### 3.1 Linhas 172-175 (escala divergente)

Atual: "Laranja Esquerda (#a43f00 no extremo, −60)", "Azul Direita (#235690 no extremo, +60)" e
"Satura em ±60; no modo relativo ao estado, em ±20."

Proposto: trocar −60/+60 e ±60 por **−75/+75 e ±75** (`SATURA` em `web/src/lib/vies.ts`; os municípios carregados
ficam em [−41, +72] e os partidos em [−90, +76]), e acrescentar:
"O texto sobre a cor fica claro a partir de 63% da saturação. 'No centro' = |viés| < 10, a faixa de 4,5 a 5,5 do
artigo. O alinhamento na Câmara usa outra escala, petróleo ↔ violeta (`web/src/lib/alinhamento.ts`), saturando
em ±70, com os polos 'com PT e PSOL' e 'com PL e NOVO'."

### 3.2 Linha 349

Atual: "**Do** pintar viés só com `corVies()` (OKLCH, simétrico em 0); no modo relativo, saturar em ±20 e trocar a legenda."

Proposto: acrescentar "**Don't** pintar o alinhamento com `corVies()`: ele tem `corAlinhamento()`, e sempre o
aviso de que acompanha a coalizão de governo."

---

## 4. `design/PROMPT.md`

### 4.1 Linhas 180-181 (Boletim do Município)

Atual: "2. **Viés na linha do tempo** (P7): pontos 2018-2024 em eixo vertical -100..+100, com a linha do estado como contexto em cinza"

Proposto: manter, e incluir depois do item 3: "**Alinhamento na Câmara**: a mesma forma, com a paleta
petróleo ↔ violeta e o aviso de que não é o viés (acompanha a coalizão de governo)."

### 4.2 Linhas 263-264 (Arquitetura)

Atual: "Viés calculado no SQL com a mesma fórmula de `scripts/07_vies_politico_municipio.py`."

Proposto: "Viés calculado sobre a view `vies_votos_cargo` (migração 006), com a mesma fórmula de
`scripts/07_vies_politico_municipio.py`: cargos com peso igual, partidos sem viés fora da média."

---

## 5. `api/test_api.py`: duas expectativas antigas que não dependem do viés

Não alterei (fora do escopo do plano), mas falham com as UFs carregadas aqui (AC, BA, GO, PA, PE, PI) **também no
banco antigo**, antes de qualquer mudança:

- P4, `(vereador["candidatos"][7], vereador["eleitos"][7]) == (33147, 6763)`: os dois bancos dão (22087, 4281).
- P10a no PI: o teste espera `(70, 51, 38), (210, 164, 126), (1558, 825, 562), (14709, 10934, 7070)`; os dois
  bancos dão `(70, 50, 37), (210, 163, 125), (1558, 826, 562), (14709, 10931, 7069)`.

Provavelmente foram fixadas com outro conjunto de UFs (o `PRODUCT.md` cita PR e RS). Vale decidir se o teste
deve depender das UFs carregadas.

## 6. Arquivos removidos ou movidos (precisam de `git rm` na hora do commit)

- `banco/migracoes/007_vies_partidos_sucedidos.sql`, `008_vies_psl_pl.sql`, `009_vies_partidos_na_carga.sql`:
  substituídos pelo novo `006_vies_partidos.sql` (decisão D1). Cópias em
  `../_backup_vies_2026-10-17/removidos_do_repo/`.
- `banco/migracoes.rar` (passo 8 do plano): movido para `../_backup_vies_2026-10-17/removidos_do_repo/`. É um
  RAR v5 de 4 KB do commit inicial que nenhuma ferramenta daqui abre (provável cabeçalho cifrado) e que nada no
  repositório cita; o `docker-compose.yml` monta só a pasta `migracoes`.

## 7. Arquivos novos que precisam entrar no commit

`crawler/camara.py`, `loader/vies.py`, `loader/test_vies.py`, `scripts/svd_camara.py`,
`banco/referencia/` (sucessão, Tabela 1 e `svd/`), `web/src/lib/alinhamento.ts`,
`web/src/graficos/AlinhamentoCamara.tsx` e a linha nova do `.gitignore`.
`respostas/vies_partidos_auditoria.csv` fica fora do git (`.gitignore`): é regerado a cada carga.
Não entram: `Estou lendo no repositório.md` (é o plano; decida se quer versionar), este arquivo e o relatório.

---
---

# Questão 6 e varredura de documentação (07/11/2026, branch `luanderson#feat/pergunta6`)

Estado em 07/11/2026: o código da P6 foi commitado por você (`c042e63`, "commit inicial da q6"); o `README.md` foi
atualizado a seu pedido (partes B e C.2); `PRODUCT.md`, `DESIGN.md`, `design/PROMPT.md` e o código do site (C.4 a C.6)
continuam sem alteração. A parte A lista o que a P6 mudou no código; a parte B, o texto proposto para a documentação; a parte C, o
resultado da varredura de frontend, API, banco e README (o que falta ou está desatualizado), com a proposta de onde
cada informação deve morar, para que fique concentrada num lugar só.

## A. O que a P6 mudou no código (commit `c042e63`)

| Arquivo | Mudança |
|---|---|
| `crawler/catalogo.py`, `crawler/ibge.py` | Novo item `ibge_censo2022_idades`: SIDRA 9514, população por idade simples (101 idades, total de sexo e de forma de declaração), em `dados/ibge/censo2022/populacao_idade_simples_tabela9514.csv`. Declarado na P6. O comentário de `candidatos` na P6 passou de "idade na posse" para "nascimento (idade na eleição)": `NR_IDADE_DATA_POSSE` não existe nos arquivos de 2018 a 2024. |
| `scripts/06_idade_alternancia.py` (novo) | A resposta. Lê a faixa etária de quem votou dos CSVs de perfil do TSE (o loader só guarda a escolaridade) e guarda o resumo em `dados/_derivados/eleitorado_idade_zona.csv` (14 MB, ~40 s para montar; `--refazer-cache` refaz). Grava `ibge_censo_municipio.idade_media_populacao` (ano 2022, 5.569 municípios), como o script 07 grava `vies_municipio`. Não muda o esquema do banco nem o loader: **não é preciso recarregar as UFs**. |
| `scripts/test_06_idade_alternancia.py` (novo) | 10 testes sem banco: faixas do TSE, passagens (renomeação, fusão dentro e fora do intervalo, PSD antigo x atual, vice duplicado em 2000), terços com peso, efeito fixo e controle. `python -m unittest discover -s scripts -p 'test_06*.py'`. |
| `respostas/06_idade_alternancia.txt` (novo) | A resposta (partes A a D e conclusão). |
| `respostas/06_passagens_prefeitura.csv` (novo, 2,3 MB) | Uma linha por passagem de mandato de prefeito (38.345), com a marca `mesmo partido` / `troca de partido` / `troca com ressalva (partidos fundidos)` e se foi a mesma pessoa. **Decidido:** fica fora do git (`.gitignore`, commit `c042e63`), porque é regerado a cada execução. |

Decisões de método que valem registrar (estão no cabeçalho do script e do txt):

- Fusão é marcada à parte ("troca com ressalva") e o índice de alternância sai nas duas leituras. A fusão só conta se
  ocorreu **entre** as duas eleições (DEM 2016 -> PSL 2020 é troca; DEM 2020 -> UNIÃO 2024 é com ressalva).
  As mudanças de partido anteriores a 2018 que o CSV da P7 não traz (PRN -> PTC; PST e PGT -> PL; PSD antigo (41)
  -> PTB; PRONA -> PR; PAN -> PTB) ficam no script, e **não** em `banco/referencia/sucessao_partidos.csv`, para não
  mexer no viés da P7.
- Comparações dentro de cada UF (a idade muda muito entre regiões) e, na parte D, com e sem controle de escolaridade
  de quem votou: nas cidades, as zonas mais velhas são também as mais escolarizadas (r = +0,85).
- Os arquivos por seção do TSE continuam descartados (README, "Avaliadas e descartadas"); seriam o próximo passo de
  precisão para "jovem vota no jovem" (PI 2024: 68 MB compactados entre perfil e votação por seção).

## B. Texto proposto para o `README.md`

> **Aplicado** a seu pedido (07/11/2026), junto com a reorganização do README (perguntas P1 a P10 em ordem, cada uma
> com conta, resposta, tela e API; migrações em tabela; testes numa seção só). Os números de linha abaixo são os da
> versão anterior e ficam como registro.

### B.1 Linha 128 (seção "Banco de dados")

Atual:

```markdown
- Não são carregados: votos do exterior (`ZZ`), `MALHA_MUNICIPIO` e `idade_media_populacao` (o crawler não baixa esses dados).
  `vies_municipio` é preenchida por `python scripts/07_vies_politico_municipio.py` (seção abaixo).
```

Proposto:

```markdown
- Não são carregados: votos do exterior (`ZZ`) e `MALHA_MUNICIPIO` (as malhas são lidas direto de `dados/ibge/malhas/`).
  Duas tabelas são preenchidas por scripts das perguntas, não pelo loader: `vies_municipio`, por
  `python scripts/07_vies_politico_municipio.py`, e `ibge_censo_municipio.idade_media_populacao`, por
  `python scripts/06_idade_alternancia.py`. Depois de recriar o banco, rode os dois (a API não lê essas tabelas:
  calcula o viés na hora, sobre a view `vies_votos_cargo`; elas servem às respostas em `respostas/`).
```

### B.2 Nova seção depois de "Nuvem de despesas por candidatura (P9)" (depois da linha 203)

```markdown
### Idade, alternância de poder e voto por idade (P6)

```bash
python scripts/06_idade_alternancia.py
```

- Grava `respostas/06_idade_alternancia.txt` e `respostas/06_passagens_prefeitura.csv` (cada passagem de mandato de
  prefeito de 1996 a 2024, marcada como mesmo partido, troca de partido ou troca com ressalva, quando o partido
  anterior foi incorporado ao do novo entre as duas eleições), e preenche `ibge_censo_municipio.idade_media_populacao`.
- A idade de quem votou vem dos CSVs `perfil_comparecimento_abstencao` (faixa etária por zona, 1º turno). O loader
  só guarda a escolaridade deles, então o script lê os CSVs uma vez e guarda o resumo em
  `dados/_derivados/eleitorado_idade_zona.csv` (~40 s; `--refazer-cache` refaz).
- A idade da população vem do Censo 2022 por idade simples (SIDRA 9514; `python -m crawler --perguntas 6 --fontes ibge`).
- Testes sem banco: `python -m unittest discover -s scripts -p 'test_06*.py'`.
```

### B.3 Linha 419 (tabela "Pergunta -> dados", P6)

Atual:

```markdown
| 6 | E.P. | candidatos, comparecimento/abstenção, votação por candidato, código TSE-IBGE, idade no Censo 2022 | `DS_FAIXA_ETARIA`, `NR_IDADE_DATA_POSSE`, `DT_NASCIMENTO`, partido do eleito; idade mediana e índice de envelhecimento |
```

Proposto:

```markdown
| 6 | E.P. (prefeitos desde 1996) | candidatos, comparecimento/abstenção, votação por candidato, código TSE-IBGE, idade no Censo 2022 | `CD_FAIXA_ETARIA` + `QT_COMPARECIMENTO` (quem votou, por zona), `DT_NASCIMENTO` (idade na eleição; `NR_IDADE_DATA_POSSE` não existe de 2018 a 2024), partido do eleito; população por idade simples, idade mediana e índice de envelhecimento |
```

### B.4 Linha 433 (tabela "Fontes", IBGE)

Atual: `Censo 2022: população (4709), idade mediana/envelhecimento (9515), instrução 18+ (10061)`

Proposto: `Censo 2022: população (4709), população por idade simples (9514), idade mediana/envelhecimento (9515), instrução 18+ (10061)`

### B.5 Linhas 490-491 (Observações, P6)

Atual:

```markdown
- **P6:** para medir alternância com mais pontos no tempo, os arquivos de candidatos de 1994 a 2024,
  baixados para a P10, trazem a sequência de prefeitos desde 1996 sem custo extra de download.
```

Proposto:

```markdown
- **P6:** para medir alternância com mais pontos no tempo, os arquivos de candidatos de 1994 a 2024,
  baixados para a P10, trazem a sequência de prefeitos desde 1996 sem custo extra de download. Em 2000 o TSE marca
  dois "eleitos" a prefeito em 30 municípios (o vice, do mesmo partido). Renomeações contam como o mesmo partido;
  fusões entre as duas eleições, como troca com ressalva. O voto é secreto: "jovem vota no jovem" é medido entre
  zonas (inferência ecológica), com a escolaridade de quem votou como controle, porque nas cidades as zonas mais
  velhas são também as mais escolarizadas.
```

## C. Varredura: frontend, API, banco e README (o que falta ou está desatualizado)

Conferido em 07/11/2026 com o banco recarregado (**as 27 UFs + BR**, 11 migrações aplicadas). Os itens de código
(frontend, testes) **não foram alterados**: ficam listados para decisão. Onde a mesma informação aparece em vários
lugares, a coluna "Lugar único proposto" diz onde ela deveria morar, para os outros só apontarem para lá.

### C.1 Onde cada informação deveria morar

| Informação | Hoje aparece em | Lugar único proposto |
|---|---|---|
| Pergunta -> script -> resposta -> tela | espalhado: README (só P4, P7, P9), tabela de telas do README, Metodologia, comentários | **Nova tabela no README** (C.2.1); a Metodologia e o PRODUCT.md apontam para ela |
| UFs carregadas | PRODUCT.md:43 (7 UFs), README:216-221 (6 UFs), comentários do web ("6 estados"), testes | **Só dinâmico** (`/api/saude`, `carga_uf`); textos fixos saem ou viram "as UFs carregadas" |
| Método de cada pergunta | cabeçalho de cada script + `respostas/*.txt` + `/metodologia` | **Cabeçalho do script** (vira o topo do txt); a Metodologia resume e cita o script |
| Endpoints da API | tabela do README (incompleta) | **Tabela do README**, completada (C.2.4) |
| Fontes (tabelas do SIDRA etc.) | README "Fontes", Metodologia "Fontes", `crawler/catalogo.py` | **`crawler/catalogo.py`** (fonte da verdade); README e Metodologia listam o mesmo conjunto |

### C.2 `README.md`

> **Aplicado** em 07/11/2026: os itens 1 a 9 abaixo estão no README novo (a tabela de respostas virou
> "As perguntas -> Pergunta -> resposta -> tela"; os testes que dependem de 6 UFs e do id 368990 estão avisados na
> seção "Testes"). Os itens de código (C.4) continuam pendentes.

1. **Falta uma tabela "Respostas" (proposta: nova seção depois de "Pergunta -> dados", linha 427).** Estado real:

   | # | Script | Resposta | Tela (completa / simples) |
   |---|---|---|---|
   | 1 | `scripts/01_custo_cadeira.py` | `respostas/01_custo_cadeira.txt` | `/cadeira` e boletim do município / `/cadeira` (só gerais) |
   | 2 | `scripts/02_patrimonio.py` | `respostas/02_patrimonio.txt` | `/patrimonio` / não tem |
   | 3 | não há | não há | indicadores no boletim do município (sem página nem seção na Metodologia) |
   | 4 | `scripts/04_escolaridade.py` | `respostas/04_escolaridade.txt` | `/escola` / `/escola` |
   | 5 | não há | não há | não há (a API devolve `legenda` na composição do viés, mas nada a mostra como P5) |
   | 6 | `scripts/06_idade_alternancia.py` | `respostas/06_idade_alternancia.txt`, `06_passagens_prefeitura.csv` | **não há** (nenhum endpoint nem página) |
   | 7 | `scripts/07_vies_politico_municipio.py` | `respostas/07_vies_politico_municipio.txt` | `/`, `/uf/{sigla}`, boletim / `/`, `/uf/...` |
   | 8 | não há | não há | só as receitas por fonte dentro de `/cadeira` (rotuladas P1) |
   | 9 | `scripts/09_nuvem_despesas.py` | `respostas/09_nuvem_despesas/` | ficha do político (`/politico/{id}`) / não tem |
   | 10 | (busca) | `respostas/10b_historico_politico.txt` (SQL dentro do txt; **não há script 10b**) | `/urna`, `/politico/{id}` / `/urna`, `/politico/{id}` |
   | 10a | `scripts/10a_taxa_reeleicao.py` | `respostas/10a_taxa_reeleicao.txt` | `/reeleicao` / `/reeleicao` |

2. **Linha 1:** o título "ProjetoBDR: crawler de dados" descreve só o começo; o README cobre crawler, banco, API e
   site. Proposto: `# Voto Aberto (ProjetoBDR): crawler, banco, API e site`.
3. **Linhas 198-202 (P9):** diz que o script grava `respostas/09_nuvem_despesas_<id>.png` e `.txt`. Hoje grava em
   `respostas/09_nuvem_despesas/<ano>_<nome>_<id>.png` e `.txt`, e tem `--auditar` (gera
   `respostas/09_nuvem_despesas/auditoria_classificacao.txt`). A API usa o mesmo script em `/api/gastos`.
4. **Tabela da API (linhas 238-261):** a API tem 27 rotas; faltam na tabela `GET /api/vies/cargos` (cargos e anos do
   filtro do atlas), `GET /api/ufs/{sigla}/composicao/{partido}?ano=&cargo=&q=&desde=&limite=` (candidatos de um
   partido, paginados), `GET /api/gastos?candidatura=` (P9, nuvem de uma candidatura) e `GET /api/gastos/destaques`
   (as 3 campanhas que mais gastaram por ano). O parâmetro `cargo` de `/api/ufs`, `/api/ufs/{sigla}` e
   `/api/municipios/{ibge}` também não aparece.
5. **Tabela de telas (linhas 365-374):** faltam `/patrimonio` (P2), `/reeleicao` (P10a) e a nuvem de gastos na
   ficha do político (P9). Vale dizer que a interface simples não tem P2, P9 nem Metodologia.
6. **Linhas 216-221 (fotos):** "As 6 UFs carregadas + BR: 10,2 GB" e "só as 6 UFs + BR somam 745.963" eram as UFs da
   época; hoje são as 27. Proposto: manter os números com a data ("em 17/10/2026, com AC, BA, GO, PE, PI e PR") ou
   trocar pelo total do Brasil.
7. **Linhas 6 e 461-472 (espaço):** "~33/34 GB" não conta as fotos. Medido hoje: `dados/` tem 74 GB, dos quais 38 GB
   são `tse/fotos_candidatos`. Proposto: acrescentar a linha "Fotos dos candidatos (opcional, `--fotos`)".
8. **Linha 267:** "Conferência contra o banco (precisa de PI carregado)": ver C.4, o teste também supõe que SP **não**
   está carregado.
9. Itens da P6: ver B.1 a B.5.

### C.3 Banco

1. **`vies_municipio` está vazia** depois da recarga (o script 07 não foi rodado). Nada no site quebra, porque a API não
   lê essa tabela, mas `respostas/07_vies_politico_municipio.txt` só fica certo depois de
   `python scripts/07_vies_politico_municipio.py`.
2. **`malha_municipio` nunca é preenchida** (a API lê os GeoJSON de `dados/ibge/malhas/`). **Decidir:** documentar
   como "reservada" ou removê-la numa migração nova.
3. **`indices_municipio.mediana_idade` e `indice_envelhecimento`** são carregados mas só a P6 os usa (como
   conferência); nenhuma tela os mostra. Junto com `ibge_censo_municipio`, seriam a base de uma tela da P6 (C.5).
4. As migrações vão de 001 a 006 e de 010 a 014 (11 arquivos; 007-009 viraram a 006 na correção do viés). Ver C.4
   (Metodologia diz 14).

### C.4 Frontend, Metodologia e testes (código; não alterado)

| Onde | O quê | Proposta |
|---|---|---|
| `web/src/paginas/Metodologia.tsx:170` | "14 migrações SQL" | "11 migrações SQL" (ou não citar o número) |
| `Metodologia.tsx:172` | "um script por questão em `scripts/`" | "um script por questão respondida (P1, P2, P4, P6, P7, P9, P10a)" |
| `Metodologia.tsx:280` x `api/app.py:1722` | A página diz que a P4 é "sem presidente"; o script 04 e `p4_chance.sql` também tiram o presidente, mas a API inclui o cargo 1 em 2022 (`CARGOS_ESCOLA`) | **Pendente:** consultar o autor das questões sobre qual critério vale. O README não toma partido. Depois, alinhar o lado que perder (API `CARGOS_ESCOLA`, ou `Metodologia.tsx:280`, `p4_chance.sql` e `scripts/04_escolaridade.py`, regerando `respostas/04_escolaridade.txt`) |
| `Metodologia.tsx:136-147` (`INDICE`) | A seção da P9 (`m-gastos`, :380) existe mas não está no índice; P3, P5, P6 e P8 não aparecem | Pôr P9 no índice; seção da P6 quando houver tela |
| `Metodologia.tsx:479` (Fontes) | Cita "idade 9515", não a 9514 | Acrescentar "população por idade simples (9514)" |
| `web/src/paginas/consultas/p10_carreira.sql:16`, `web/e2e/atlas.spec.ts:74`, `urna.spec.ts:15`, `simples.spec.ts:44` | Id fixo `368990` "Wellington Dias". **No banco recarregado o 368990 é outra pessoa** (Wellington Dias é o 1234183) | Buscar pelo título/nome em vez do id serial; os três testes ponta a ponta vão falhar como estão |
| `api/test_api.py:179, 188, 201-209` | Números fixos de quando havia 6 UFs (P4: 33147/6763; P10a PI) e a suposição de que SP não está carregado (`uf=SP` -> 404) | Com as 27 UFs, as checagens de SP e da P4 nacional falham. Fixar os números por UF (PI) e tirar a suposição sobre SP |
| `web/e2e/escola.spec.ts:8, 70` | Comentário com 6 UFs e "417 municípios" na BA | Conferir com a carga atual |
| Comentários "6 estados": `cadeira/Dinheiro.tsx:43`, `patrimonio/Recorte.tsx:1`, `PatrimonioPagina.tsx:2`, `ReeleicaoPagina.tsx:118`; `escola/EscolaPagina.tsx:36` ("AC, BA, GO, PE, PI, PR e RS") | Exemplos de texto que o código gera dinamicamente | Só comentários; atualizar quando mexer nesses arquivos |
| `GET /api/saude` | Nenhuma tela chama | Ok (diagnóstico), só registrar no README |

### C.5 P6 no site (ainda não existe)

Não há endpoint, página nem seção da Metodologia para a P6. Se for entrar no site, a proposta mínima, sem mexer no
esquema: um bloco no boletim do município (idade média de quem votou e da população, terço na UF e no país, a fila
das passagens de prefeito desde 1996 com as três marcas) e uma seção na Metodologia que resuma o cabeçalho do script
06. Exigiria definir o desenho em `DESIGN.md`/`design/PROMPT.md` antes.

### C.6 `PRODUCT.md` e `design/`

- **`PRODUCT.md:28`**: "As demais perguntas (1-6, 8, 9) entram depois". Hoje 1, 2, 4, 6 e 9 têm resposta. Proposto:
  apontar para a tabela de respostas do README (C.2.1) em vez de listar.
- **`PRODUCT.md:43`**: "UFs carregadas hoje: AC, BA, GO, PE, PI, PR, RS". Hoje são as 27. Proposto: "As UFs
  carregadas aparecem em `/api/saude`; o site mostra as não carregadas em cinza."
- `DESIGN.md` e `design/PROMPT.md` não têm nada da P6 (coerente com C.5). Os itens 3 e 4 da parte de cima deste
  arquivo (escala do viés) continuam valendo.
