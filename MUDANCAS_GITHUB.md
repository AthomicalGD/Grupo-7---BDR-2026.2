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
