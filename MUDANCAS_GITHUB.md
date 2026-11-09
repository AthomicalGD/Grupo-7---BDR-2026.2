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
| `scripts/06_idade_alternancia.py` (novo) | A resposta. Grava `ibge_censo_municipio.idade_media_populacao` (ano 2022, 5.569 municípios), como o script 07 grava `vies_municipio`. A faixa etária de quem votou vinha de um cache em arquivo; desde a parte D, vem da tabela `perfil_etario_munzona` (migração 015). |
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

## D. Tabela nova da P6 e o defeito de Abaeté (07/11/2026, depois do commit `c042e63`; sem commit)

Decisão sua: a P6 aparece no site com a API reaproveitando o script, como a P9, e **tudo vem do banco**. Para isso a
faixa etária de quem votou, que só existia num cache em arquivo, ganhou uma tabela.

| Arquivo | Mudança |
|---|---|
| `banco/migracoes/015_perfil_etario.sql` (novo) | Tabelas `faixa_etaria` (as 22 faixas do TSE, com o ponto médio) e `perfil_etario_munzona` (aptos e comparecimento do 1º turno por zona, ano e faixa; molde de `perfil_eleitorado_munzona`). Já aplicada no banco local (`docker compose run --rm migracoes`). |
| `loader/fontes.py`, `loader/carga.py` | O perfil do TSE passa a ser somado por escolaridade **e** faixa etária; a carga grava `perfil_etario_munzona` (a faixa inválida, -3, fica fora e é contada em `descartadas`). |
| `loader/remover.py` | Remove `perfil_etario_munzona` junto com a UF. |
| `loader/perfil_etario.py` (novo) | `python -m loader.perfil_etario`: preenche a tabela num banco já carregado, relendo só os CSVs de perfil (2min42s para as 27 UFs, 508 mil linhas). Já rodado no banco local. |
| `scripts/06_idade_alternancia.py` | Lê de `perfil_etario_munzona`; sem cache e sem `--refazer-cache`. A lista de passagens saiu idêntica; o txt só mudou por causa de Abaeté (abaixo). |
| `scripts/test_06_idade_alternancia.py` | O teste do ponto médio passou a conferir a tabela `faixa_etaria` da migração (código, intervalo e ponto médio de cada faixa). |
| `dados/_derivados/` | Apagado (era o cache; `dados/` não vai para o git). |
| `README.md` | Migração 015 na tabela, o passo para bancos antigos e a seção da P6 sem o cache. |
| `.impeccable/superficies/idade.md` (novo) | A idealização visual da P6 (página `/idade` e bloco do boletim). |

**Conferência:** comparada ao cache, a tabela tem os mesmos 528.125 pares (zona, ano, faixa) com aptos e
comparecimento idênticos; falta só a zona 1 de Abaeté, pelo defeito abaixo.

### Defeito encontrado (anterior à P6) e **corrigido** em 07/11/2026: Abaeté (MG) estava no banco como BA

- No banco, o município 40037 (Abaeté) tem `cd_uf = 29` (BA) e `cd_ibge` nulo. Na correspondência do TSE ele é de MG
  (IBGE 3100203). Por isso ficou sem votos, sem perfil (escolaridade e idade), sem indicadores e com a BA contando 418
  municípios (são 417; o teste `web/e2e/escola.spec.ts:70` espera 417).
- **Causa:** o arquivo de candidatos de 2000 do TSE traz linhas de Abaeté com `SG_UF = "BA"`. Na carga da BA,
  `_municipios` (`loader/carga.py`) cadastra os "municípios citados e ausentes da correspondência" com a UF da carga, sem
  conferir que o município está na correspondência como de outra UF. A BA foi carregada antes do MG, e a carga do MG não
  corrige (`ON CONFLICT DO NOTHING`) e descarta os votos e o perfil do município pelo filtro de UF.
- **Correção aplicada:**
  1. `loader/carga.py` (`_municipios`): só cadastra como "ausente da correspondência" o município que não está em
     `stg_municipio` de nenhuma UF. As 5 linhas de 2000 com UF errada ficam fora da carga da BA.
  2. No banco local: `UPDATE municipio SET cd_uf = 31, cd_ibge = 3100203, nm_municipio = 'Abaeté' WHERE
     cd_municipio = 40037`, e você removeu e recarregou o MG (e o AC) com o loader novo.
  3. Conferido depois da recarga: Abaeté em MG com os 8 prefeitos de 1996 a 2024, votos, perfil por escolaridade e
     por idade e indicadores; BA com 417 municípios e MG com 853; `perfil_etario_munzona` com 528.213 linhas (o
     conjunto completo). Abaeté era o único município com UF diferente da correspondência do TSE.
  4. `respostas/06_idade_alternancia.txt` regerado: 38.352 passagens, 5.570 municípios; nenhuma conclusão mudou.
- **Outras respostas** (`01`, `02`, `04`, `07`, `10a`) foram geradas antes, com outro conjunto de UFs, e não foram
  regeradas agora; ao regerar, Abaeté entra em MG.

## E. A tela da P6 (07/11/2026, sem commit)

Construída a partir de `.impeccable/superficies/idade.md`, com as decisões suas: página própria + bloco no boletim,
escala sépia, galeria dos ex-prefeitos, halteres por terço, API reaproveitando o script (como a P9) e tudo vindo do
banco. A Metodologia e o código do site foram alterados direto (fazem parte da implementação); o `README.md` foi
atualizado (tela, endpoints e a seção da P6). `DESIGN.md`, `PRODUCT.md` e `design/PROMPT.md` ficam para você: o texto
proposto está em E.2.

### E.1 Arquivos

| Arquivo | Mudança |
|---|---|
| `scripts/06_idade_alternancia.py` | `carregar(conn, censo_do_arquivo)` monta a base a partir do banco (a API passa `False` e lê a idade da população de `ibge_censo_municipio`); funções de resumo para a API (`resumo_perfil`, `resumo_alternancia`, `resumo_eleitos`, `resumo_voto`, `galeria`, `resumo_municipio`) com as mesmas primitivas do txt; `indice_com_idade` e `eleitos_por_municipio` extraídos das partes B e C. O txt e o CSV saem idênticos. |
| `api/app.py` | Seção P6: `p6()` carrega o script como `p9()`; `p6_base()` (com trava, ~18 s, uma vez por processo); 5 endpoints `/api/idade/...` com `em_disco`; `_aquecer_idade` deixa prontos os recortes nacionais ao subir. |
| `api/test_api.py` | `test_idade_p6`: as partes fecham entre si (não depende das UFs carregadas) e a galeria de Abaeté está em MG. |
| `web/src/idade/` (novo) | `IdadePagina.tsx` (os quatro atos e o fecho), `MapaIdade.tsx` (o mapa sépia, adaptado do mapa da Escola, sem o 3D), `Galeria.tsx` (a galeria dos ex-prefeitos, completa e compacta), `Passagens.tsx`, `Piramide.tsx`, `HalteresIdade.tsx`, `sepia.ts` (a escala e os rótulos). |
| `web/src/api.ts`, `web/src/router.tsx` | Tipos e consultas da P6; rota `/idade` (busca: `ano`, `uf`, `ibge`, `eleitos`, `cargo`, `voto`). |
| `web/src/componentes/Moldura.tsx` | 8º item do menu, **Idade** (Phosphor `Hourglass`), entre Escola e Patrimônio. Conferido: os 8 cabem em 360 px sem rolagem lateral. |
| `web/src/atlas/Boletim.tsx` | "Prefeitos eleitos" vira a galeria compacta (1996 a 2024, com as marcas), com a lista antiga enquanto a P6 não chega; bloco "IDADE" com o link para `/idade`. |
| `web/src/paginas/Metodologia.tsx`, `consultas/p6_*.sql` | Seção P6 (com índice, dados, desafios e duas consultas) e a 9514 nas fontes. |
| `web/src/index.css` | Animações `pendura` (as molduras), `revela-direita` (o lado esquerdo da pirâmide) e `municipios-idade`; todas desligadas com movimento reduzido. |
| `web/e2e/idade.spec.ts` (novo) | Página (os quatro atos, a galeria de Teresina) e o boletim levando à página; passou em desktop e celular. |
| `.impeccable/superficies/idade.md` | Estado "construída" e os endpoints reais. |

Verificado: `npx tsc -b` sem erros; `npm run lint` só com avisos do mesmo tipo dos que o mapa da Escola já tem;
`npm run build` ok (a página é um pedaço de 54 kB, 15,6 kB comprimido); sem erro no console e sem rolagem lateral em
1440 e 390 px; `e2e/idade.spec.ts` 4 de 4. Rodado com o Chrome do sistema (os navegadores do Playwright não estão
baixados). No `e2e/atlas.spec.ts`, 2 falhas que **não** vêm da P6: o teste supõe SP fora do banco (C.4) e o primeiro
Tab, no Chrome do sistema, foca a página antes do link "Pular para o conteúdo" (igual em `/` e `/escola`).

**Fora do escopo, ainda pendentes:** a interface simples não tem a P6; a Metodologia ainda diz "14 migrações" (agora
são 12: 001 a 006 e 010 a 015) e "um script por questão" (C.4).

### E.2 Texto proposto para os documentos oficiais

**`DESIGN.md`**, no cabeçalho YAML (`colors`), depois de `escola-fim`:

```yaml
  sepia-inicio: "#f4f1df"
  sepia-fim: "#634a30"
```

**`DESIGN.md`**, seção "Colors", nova subseção depois de "Data (escolaridade, P4)":

```markdown
### Data (idade, P6)
- **Escala sépia, o papel que amarela** (#f4f1df → #ded4b4 → #c6b48a → #ab9166 → #896e4a → #634a30): a idade de quem
  votou, do mais jovem (papel claro) ao mais velho (sépia), em OKLCH com a luminosidade sempre caindo (0,955 → 0,43) e a
  matiz puxada para o amarelo (98° → 66°), para não encostar no laranja do viés de esquerda (o passo mais perto fica a
  ΔE 8,3). Em `web/src/idade/sepia.ts`.
- O mapa usa seis classes fixas de idade média (até 40, 40 a 42, ..., 48 ou mais), as mesmas nos quatro anos: o
  envelhecimento aparece como escurecimento. Os terços (mais jovem, intermediário, mais velho) usam os passos 2, 4 e 6,
  sempre com o nome escrito.
- Texto em tinta sobre os quatro claros e em folha sobre os dois escuros; o passo mais claro leva contorno de tinta a
  20%. Só existe na página da Idade e no bloco "IDADE" do boletim.
- As passagens de mandato não têm cor de dado: mesmo partido em Papel 2, troca em Tinta 2, troca com ressalva em
  Tinta 2 hachurada.
```

**`DESIGN.md`**, "Components", novas entradas depois de "Ranking dos municípios (P4)":

```markdown
### A página da Idade (P6)
Quatro atos, cada um com a pergunta como título e a resposta em frase logo abaixo: "Onde o Brasil é mais velho?" (o
mapa sépia com os três terços e o envelhecimento de 2018 a 2024), "Lugar mais velho troca mais de prefeito?" (barras
de 100% das passagens por terço, a leitura da fusão num alternador e a galeria), "Quem se elege é mais velho que quem
vota?" (a pirâmide e o prêmio de idade) e "Jovem vota no jovem?" (halteres por terço de zonas, com o alternador "Como
votaram | Mesma escolaridade"). Fecha com "O que a conta não diz". A frase do topo usa sempre deputado federal em 2022.

### Galeria dos ex-prefeitos (assinatura, P6)
A parede de retratos da prefeitura, de 1996 a 2024: cada mandato numa moldura de folha com filete sépia, o retrato do
TSE (desde 2004; antes, as iniciais), o mandato ("2005 a 2012"), o nome de urna e o partido com a bolinha do viés.
Reeleição vira moldura dupla, com os dois retratos e "PTB → PSDB" quando a pessoa trocou de partido. Entre as molduras,
o sinal da passagem num círculo (= mesmo partido, ≠ troca, ~ troca com ressalva), com o nome curto embaixo e a
explicação no título. As molduras penduram uma vez (descem e balançam, 60 ms entre elas). No celular, a galeria rola
de lado dentro do quadro. No boletim, a versão compacta (retratos de 44 px, sem o nome curto) e a linha de resumo em
mono.

### Pirâmide etária (P6)
Espelhada: quem votou (18+) à esquerda, os eleitos à direita, as quatro faixas comuns do mais velho (em cima) ao mais
jovem, cada barra no passo sépia da faixa; o tracejado em tinta são os candidatos aptos. O número fica dentro da barra
e vai para fora quando ela é curta. As barras crescem do eixo para fora, uma vez.
```

**`DESIGN.md`**, "Navegação": "sete itens à direita (Mapa, Urna, Cadeira, Escola, Patrimônio, Reeleição,
Metodologia)" vira "oito itens à direita (Mapa, Urna, Cadeira, Escola, Idade, Patrimônio, Reeleição, Metodologia)", e
"para os sete caberem em 360px" vira "para os oito caberem em 360px".

**`PRODUCT.md`**, "Evidence on Hand": acrescentar a P6 (`respostas/06_idade_alternancia.txt`, tela `/idade`).

**`design/PROMPT.md`**, "4. Telas e rotas": nova subseção "Idade (`/idade`)" com o resumo da página da Idade acima.

---

## 2026 no crawler e o SVD de 2026 (09/11/2026)

> **Não aplicado.** Texto proposto para o `README.md`; o código do crawler (`crawler/__main__.py` e
> `crawler/catalogo.py`) já foi alterado na árvore local, sem commit.

### `README.md`, seção "A eleição de 2026 (dados parciais)"

Atual: "O TSE publica a eleição aos poucos. Em 27/10/2026 já havia candidaturas, bens, o 1º turno (votos por zona,
detalhe e comparecimento por escolaridade) e a prestação de contas parcial; o 2º turno e as contas finais, não."

Proposto (conferido nos arquivos baixados em 09/11/2026: `votacao_candidato_munzona_2026` tem o turno 2 de presidente
e governador, e `consulta_cand_2026` traz a situação final de quem foi ao 2º turno):

```markdown
O TSE publica a eleição aos poucos. Em 09/11/2026 já havia candidaturas, bens, os dois turnos (votos por zona,
detalhe e comparecimento por escolaridade) e a prestação de contas parcial; as contas finais, não.
```

E, na lista logo abaixo, trocar "(quem foi a um 2º turno ainda não publicado fica de fora do patrimônio e, na
reeleição, aparece como pendente)" e "e o 2º turno (P12), listado em `incompletas`" **só depois** de recarregar 2026
(`python -m loader.ano 2026`) e conferir `respostas/conferencia_2026.txt`: o código da API (`api/app.py`) ainda trata o
2º turno de 2026 como "não publicado" (comentários e a exclusão de governador e presidente em 2026).

### `README.md`, linha da tabela de fontes (Câmara) e `/api/segundo-turno`

- Fonte da Câmara: o texto "o ano corrente é baixado de novo a cada execução" passa a ser verdadeiro (antes, sem
  `--atualizar`, o crawler pulava a fonte inteira quando os arquivos já existiam). Agora é uma vez por dia.
- `GET /api/segundo-turno`: "todos os 2º turnos de 2018 a 2024" vira "de 2018 a 2026" depois da recarga acima.

---

## F. Integração das questões 3, 5 e 6 e a eleição de 2026 (09/11/2026)

> Registro de tudo o que foi feito na branch `frankenstein-q3-q5-q6` e o que ficou pendente. **Nada daqui foi
> aplicado ao `README.md`, `DESIGN.md`, `PRODUCT.md` ou `design/PROMPT.md` além do que o próprio merge trouxe**
> (listado em F.2). O texto proposto para o resto está em F.5.

### F.1 Como a branch foi montada

O Victor tinha a interface completa em `origin/feat/pergunta-3` (a mesma de `feat/turnos-tema-personagem`), com 17
commits que nunca entraram na `main`; a `main` tinha a Q6 (PR #16). A Q5 estava só em `feat/votodelegenda` (Felipe) e a Q3
do Saleh só foi enviada em 09/11/2026, como um commit (`0f2f73e`) na própria `feat/pergunta-3`.

| Passo | Commit | O que entrou |
|---|---|---|
| Base | `8e363b7` (`origin/feat/pergunta-3`) | interface do Victor: tour, modo aula, "Ouvir", político contra político, 2º turno (Q12), colonial (Q11), 2026, gênero (migrações 015 a 019) |
| Merge da `main` | `8bd6652` | Q6 (`/idade`, migração `015_perfil_etario`, script e resposta) |
| Merge de `origin/feat/votodelegenda` | `da84e3d` | Q5 (`/cadeira/legenda`, `/api/legenda`, `scripts/05_votos_legenda.py`) |
| Merge de `origin/feat/pergunta-3` (Saleh) | `d88b94c` | Q3 (`/indices`, `/api/indices`, migração `020_ifdm`, `loader/ifdm.py`, `loader/comparecimento.py`, `crawler/logos.py`) |

A branch **não tem upstream** (de propósito, para um `git push` não cair na branch do Victor). Nada foi enviado ao GitHub.

Conflitos resolvidos: `README.md`, `web/src/api.ts`, `web/src/componentes/Moldura.tsx`, `web/src/paginas/Metodologia.tsx`,
`web/src/router.tsx`, `web/src/atlas/Boletim.tsx` e `loader/carga.py` (Q6 + Victor); os mesmos mais a Q5 e a Q3 depois.
Quase todos eram aditivos (rotas, itens de menu, tipos). Dois não eram:

- **Boletim do município:** ficou a versão da Q6 (galeria dos prefeitos e idade), que já traz como reserva a lista simples
  de prefeitos do Victor.
- **`loader/carga.py`:** ficou a correção de Abaeté do Victor (`ON CONFLICT ... DO UPDATE ... WHERE cd_ibge IS NULL`)
  com o comentário da `main`.

### F.2 O que os merges mudaram no `README.md` (para você conferir)

O README da `main` (reorganizado na Q6) foi a base; o que o Victor tinha acrescentado foi reaplicado por cima:

1. Introdução: "E.P. = 2018, 2020, 2022, 2024 e 2026, este só com o que o TSE já publicou".
2. Tabela do crawler: `--carreira-ate 2026` (agora "último ano da P10, padrão 2026").
3. P7: a onda 2022 vale também para 2026 (estendida por quatro anos); comando `svd_camara.py --nome eleicao_2026`.
4. Seções novas "Exploração colonial (questão extra)" e "O que muda no 2º turno (questão extra 12)", antes da P10.
5. Tabela da API: `turno=` em `/api/ufs` e `/api/municipios/{ibge}`, `/api/municipios/{ibge}/zonas`, `/api/politicos/{id}/raio-x`,
   `/api/politicos/{id}/visual`, `/api/segundo-turno` (e `/{id}`), `/api/cadeira/nao-eleitos`; `/api/escola` com 2026.
6. Tabela de telas: "linha do tempo 2018-2026" e a linha "O que muda no 2º turno".
7. Árvore de `dados/` (`colonial/`), linha "Extra" de pergunta -> dados, fonte "Exploração colonial".
8. Seção "A eleição de 2026 (dados parciais)", antes de "Espaço em disco".
9. Tabela de migrações: linhas `015_genero` a `019_politico_busca` (o Victor não as documentou) e `020_ifdm`.
10. Da Q3 do Saleh: o bloco "A página de índices (`/indices`) e o viés político (P3)", dentro da seção P3 (IFDM, planilha
    manual da Firjan, `loader.ifdm`, `loader.comparecimento`, `crawler --logos`).
11. Da Q5 do Felipe: a linha 5 das tabelas "Pergunta -> resposta -> tela" e a seção P5 (vieram do merge, sem edição minha).

### F.3 Texto proposto para o `README.md` (não aplicado)

**Tabela "Pergunta -> resposta -> tela", linha 3** (hoje: `não há` / `Indicadores no boletim do município`):

```markdown
| 3 | Índices do município x eleitos e partidos mais vitoriosos | `/api/indices` (sem script de resposta em texto) | `/indices` (dispersão do viés contra o IFDM e outros índices, desempenho municipal dos partidos) e indicadores no boletim do município / não tem |
```

**Seção "P3"**: o primeiro item ("Sem script de resposta...") passa a citar a página `/indices`; o bloco do Saleh já está
logo abaixo dela.

**Tabela da API** (os três endpoints do Saleh não estão documentados; parâmetros conferir em `api/app.py:1373`, `1498`, `749`):

```markdown
| `GET /api/indices?uf=` | P3: viés de cada município nas eleições de 2018 a 2024 com IFDM, IDHM 2010, PIB per capita, eleitores ÷ população e isentos, e o desvio padrão do viés nas eleições municipais |
| `GET /api/indices/partidos?uf=&ano=` | P3: desempenho municipal dos partidos nas eleições municipais de 2012 a 2024, por faixa de cada índice |
| `GET /api/partidos/logos` | Sigla -> URL do logo, de onde veio e a licença (`python -m crawler --logos`); `/api/partidos/logos/{arquivo}` serve o arquivo |
```

**Tabela de telas**: acrescentar `/indices` (P3) e `/cadeira/legenda` (P5, já na tabela do Felipe).

**Seção "A eleição de 2026"** (conferido em 09/11/2026: o TSE já publicou o 2º turno de presidente e governador, e o banco
está carregado; ver `respostas/conferencia_2026.txt`):

```markdown
O TSE publica a eleição aos poucos. Em 09/11/2026 já havia candidaturas, bens, os dois turnos (votos por zona,
detalhe e comparecimento por escolaridade) e a prestação de contas parcial; as contas finais, não.
```

e, na lista abaixo dela, trocar "quem foi a um 2º turno ainda não publicado..." e "o 2º turno (P12), listado em
`incompletas`" **depois** de ajustar a API (F.4, item 1).

**Fonte da Câmara**: "o ano corrente é baixado de novo a cada execução" passa a ser verdade (antes, sem `--atualizar`,
o crawler pulava a fonte quando os arquivos já existiam; agora refaz uma vez por dia).

**Para reproduzir / dois Dockers** (sugestão de nota): no Linux com Docker do sistema e Docker Desktop, os dois publicam a
`127.0.0.1:5432` e têm volumes separados com o mesmo nome. Conferir `docker context ls` antes de `docker compose up`, nunca
usar `down -v` sem saber o engine, e lembrar que o DBeaver conecta no engine que ganhou a porta.

### F.4 O que ainda precisa de decisão ou de código

1. **API ainda trata o 2º turno de 2026 como não publicado** (o banco já tem os dados: presidente, 12.212 linhas; 6 governos).
   Trechos: `api/app.py:54` (`ANOS`), `964`, `1012`, `1204` (grupo "aguardando"), `1683`, `2009`, `2353` e `2590`
   (`AND NOT (e.ano = 2026 AND e.cod_cargo IN (1, 3))`). Enquanto não forem revisados, presidente e governador de 2026
   ficam fora de algumas telas. Os testes de API e os e2e não foram rodados (faltam banco de testes e `pytest` na `.venv`).
2. **Menu com 10 itens** (Mapa, Urna, Cadeira, Escola, Idade, Patrimônio, Reeleição, Índices, 2º turno, Metodologia):
   conferir a 360px. O `DESIGN.md` ("Navegação") diz "sete itens"; a seção 3 deste arquivo já propunha "oito" (com Idade).
   Com 2º turno e Índices o texto proposto passa a ser **dez itens** (e "para os dez caberem em 360px").
3. **Q3 sem dados no banco local**: falta aplicar a `020_ifdm` (`docker compose run --rm migracoes`), baixar à mão a planilha
   do IFDM da Firjan (`dados/firjan/`) e rodar `loader.ifdm`; baixar `--perguntas 3 --fontes tse --anos 2012 2016` e rodar
   `loader.comparecimento 2012 2016`; baixar os logos (`crawler --logos`). Passos no README do Saleh (F.1, item 10).
4. **Gênero dos políticos quase todo vazio** (`politico.ds_genero`): depois da carga de 2026 só 20.875 de 2.320.919 estão
   preenchidos (os candidatos de 2026). Os mais antigos vêm de `python -m loader.partidos`, que roda `carga.genero_dos_politicos`
   sobre as candidaturas já carregadas (`loader/partidos.py:39`). Até lá o bonequinho do "político contra político" fica sem gênero.
5. **Q3 e Q8 sem `scripts/NN_*.py` e `respostas/NN_*.txt`**, como as outras questões; e **sem seção de Metodologia** a Q8
   (a da Q3 veio do Saleh).
6. **Migrações:** há dois arquivos `015` (`015_genero` e `015_perfil_etario`). O compose registra por nome de arquivo em
   `schema_migrations`, então convivem; não renumerar, porque quem já aplicou a `015_perfil_etario` a reaplicaria.
   Os textos que dizem "migração 015" (`loader/carga.py:356` e `:374`, `loader/perfil_etario.py`) ficam ambíguos.
7. **Banco: dois engines.** O `127.0.0.1:5432` respondia o Docker do sistema (vazio, volume antigo com migrações 006 a 008
   de antes da reescrita do viés), e os dados estavam no Docker Desktop. Resolvido em 09/11/2026 passando a porta para o
   Desktop; o container do sistema não foi removido.

### F.5 Código alterado fora dos merges (sem commit até a mensagem abaixo)

| Arquivo | Mudança |
|---|---|
| `crawler/__main__.py` | A Câmara deixa de ser pulada quando os arquivos existem: o ano corrente é rebaixado uma vez por dia (`_externo_em_disco`) |
| `crawler/catalogo.py` | Comentários e `ULTIMO_ANO_COM_RESULTADO`: 2026 com os dois turnos |
| `loader/carga.py` | `copiar` descarta o byte NUL (`\x00`) antes do `COPY`: o TSE publicou em 2026 uma despesa com NUL no meio do texto (linha 637.467 de 1.773.202), e o PostgreSQL recusa; os arquivos de 2018 a 2024 não têm nenhum |
| `respostas/conferencia_2026.txt` | Regenerado depois da carga de 2026 com o 2º turno (27 governadores, presidente eleito, 12.212 linhas de votos do 2º turno do presidente) |

### F.6 SVD de 2026

`banco/referencia/svd/svd_eleicao_2026.csv` (22 partidos, 643 deputados, 1.123 votações; janela 2023-02-01 a 2026-10-03;
Spearman +0,646 contra o artigo e -0,829 contra o governo, o mesmo sinal invertido de 2024) foi calculado pelo Victor e
**reproduzido aqui com saída idêntica**, antes e depois de atualizar a Câmara em 09/11. Não há o que recalcular. O resultado
chega ao banco por `python -m loader.vies`.
