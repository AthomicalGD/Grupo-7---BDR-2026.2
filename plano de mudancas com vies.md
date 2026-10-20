Estou lendo no repositório os arquivos que usam o viés: o script da pergunta 7, a API, a consulta do atlas, a página de metodologia e as migrações.

Estou lendo agora o lado web e os testes (escala, rótulos e página de metodologia), para ver o que muda se o viés passar a vir do artigo.

# Plano de mudança do viés e do alinhamento

A branch `feat/correcaoVies` ainda está no estado anterior ao nosso trabalho. O commit lido foi o `3439950` (merge do PR #6), em 17/10/2026. Eu li os arquivos, sem executar nada do repositório.

## Estado atual

1. **Os valores do banco são do SVD.** As migrações 006 a 009 gravam números fixos de −100 a +100 em quatro camadas: valores iniciais, sucessores, a correção do PSL e uma tabela de referência com um gatilho. O padrão 0 significa "não informado" (verificado).
2. **A página de Metodologia diz outra coisa.** Ela atribui o viés à classificação de especialistas ([Metodologia.tsx L266-L268](https://github.com/AthomicalGD/Grupo-7---BDR-2026.2/blob/34399507a26c1d56dda6a763d580badb4d1f706e/web/src/paginas/Metodologia.tsx#L266-L268)) e liga `partido.vies_politico` a `df_experts.csv` ([L285](https://github.com/AthomicalGD/Grupo-7---BDR-2026.2/blob/34399507a26c1d56dda6a763d580badb4d1f706e/web/src/paginas/Metodologia.tsx#L285)). A escala dos especialistas é 0 a 10 (verificado).
3. **A mesma conta está em dois lugares:** `scripts/07_vies_politico_municipio.py` e `api/app.py` (`votos_vies`, `composicao_vies`). Ambas somam todos os cargos, tratam partido sem viés como 0 e dão peso dobrado ao Senado em 2018.
4. **`vies_municipio` só é preenchida pelo script 07,** e a API calcula tudo na hora.
5. **Os testes da API fixam números:** Piauí 2022 em −41,9, Teresina em −34,9 e PT em −68 (`api/test_api.py`).
6. **O `README` já previa usar o `df_experts.csv`,** com mapeamento manual de PRD, Mobiliza, PROS e PSC para 2024. O plano abaixo segue essa intenção.

## Decisões antes de começar

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Reescrever 006 a 009 em um único arquivo, editando 001 e 004 no lugar, em vez de criar 015 em diante | Reescrever. O executor só aplica arquivos que não estão em `schema_migrations`, então editar um arquivo já aplicado não muda bancos existentes. Todos precisam recriar o banco (`docker compose down -v`) e recarregar. Se o recarregamento for inviável, uma única migração 015 remove o que 006 a 009 criaram |
| D2 | Escala | Guardar a média do artigo em 0 a 10. `partido.vies_politico` e a série dos municípios ficam em −100 a +100 por `(média − 5) × 20`. A conta é exata porque 0 e 10 são os extremos reais do questionário, e a API e a web não mudam de escala. O alinhamento do SVD fica em colunas próprias, com outro rótulo e outra paleta, para não parecer a mesma coisa |
| D3 | Janela do alinhamento por eleição, sem olhar o futuro | 2018: Temer (set/2016 a jul/2018). 2020: 56ª legislatura até nov/2020 (rodada nova). 2022: 56ª até jul/2022 (já feita). 2024: 57ª até out/2024 (rodada nova). Rodar as janelas novas com `--partido moda`, para DEM e PSL manterem valor próprio |
| D4 | Onda do artigo por eleição | 2018 e 2020: onda 2018. 2022 e 2024: onda 2022. Em 2024 isso estende a onda por dois anos, o que os autores desaconselham. Marcar na interface |
| D5 | Como somar os cargos | Calcular por cargo e fazer a média com peso igual, o que remove o peso dobrado do Senado. Pode ficar para o fim, porque muda os números da API |

## Regras de nome e fusão (vale para o viés e para o alinhamento)

| Tipo | Regra | Casos |
|---|---|---|
| Só mudou de nome | Mesmo valor | PMDB para MDB, PT do B para AVANTE, PEN para PATRI, PRB para REPUBLICANOS, PR para PL, PPS para CIDADANIA, PTN para PODE, SD para SOLIDARIEDADE, PTC para AGIR, PSDC para DC, PMN para MOBILIZA |
| Fusão ou incorporação | Média aritmética dos componentes que têm valor | UNIÃO (2022) = DEM + PSL. PODE (2019) = PODE + PHS. PCdoB (2019) = PCdoB + PPL. PATRI (2019) = PATRI + PRP. PRD (2023) = PTB + PATRI. PODE (2023) = PODE + PSC. SOLIDARIEDADE (2023) = SOLIDARIEDADE + PROS |

A ordem de resolução é: valor próprio, depois renomeação, depois fusão, e senão vazio. As regras ficam num arquivo de dados, `banco/referencia/sucessao_partidos.csv`, no lugar das listas em SQL das migrações 006 a 008. Pela regra, o PSL deixa de herdar o valor do PL e passa a ter o próprio valor de 2018 (8,11).

Exemplos para os testes: PRD em 2024 é 8,16, ou +63,2 na escala de −100 a +100. PODE em 2024 é 7,93, ou +58,5. SOLIDARIEDADE é 6,73, ou +34,6.

## Execução

**Processo de carga do viés:**
- **Gatilho:** `python -m loader.vies`, depois da carga.
- **Entradas:** `dados/ideologia_partidos/df_experts.csv` (o crawler já baixa), a tabela de sucessão e os CSVs do SVD.
- **O que acontece:** calcula a média por partido em cada onda, aplica as regras de sucessão e grava as tabelas. Depois atualiza `partido.vies_politico` com o valor mais recente de cada sigla.
- **Saídas:** as tabelas novas e um CSV de auditoria com a origem de cada valor ("direto", "renomeado de X", "média de X e Y").

**Passos, em ordem:**
1. **Dados de referência (sem banco).**
   - Acrescentar a fonte `camara` ao crawler, com `votacoes`, `votacoesVotos` e `votacoesOrientacoes` de 2015 a 2026, em `catalogo.py` e num `crawler/camara.py`. O endereço é `dadosabertos.camara.leg.br/arquivos/{tipo}/csv/{tipo}-{ano}.csv`, como no PDF que você enviou.
   - Colocar `svd_camara.py` em `scripts/`, rodar as cinco janelas e versionar os CSVs pequenos de resultado em `banco/referencia/svd/`.
2. **Banco, editando no lugar.**
   - Trocar 006 a 009 por um único `006_vies_partidos.sql`, e apagar 007 a 009. Ele cria `vies_partido_onda`, `partido_alinhamento` e `eleicao_referencia` (ano, onda do artigo, janela do SVD). O padrão de `vies_politico` passa a NULL, e o gatilho, a função e `vies_partido_referencia` saem.
   - Em 004, acrescentar a `vies_municipio` as colunas de alinhamento e de cobertura.
   - Corrigir o comentário de 001, linha 42.
3. **Loader:** criar `loader/vies.py` como descrito acima.
4. **Série dos municípios (`scripts/07`):** usar o viés da onda de cada eleição, tirar os partidos sem valor do numerador e do denominador, gravar a cobertura e acrescentar o alinhamento. Gerar de novo `respostas/07`.
5. **API:** ajustar `votos_vies` e `composicao_vies`, e `sem_vies_pct` passa a contar os valores NULL. Incluir o `alinhamento` em `/api/ufs`, `/api/ufs/{sigla}` e `/api/municipios/{ibge}`.
6. **Web:**
   - **Tipos:** atualizar `api.ts`.
   - **Escala de cor:** recalibrar `lib/vies.ts`. A saturação em 60 e o limite de 38 para texto claro foram feitos para dados entre −70 e +50, e o artigo vai de cerca de −90 a +76. O rótulo "no centro" muda de menos de 5 para menos de 10, a faixa de centro do artigo (4,5 a 5,5).
   - **Boletim e Estado:** mostrar o alinhamento com rótulo e paleta próprios.
   - **Textos:** reescrever a Metodologia, e corrigir `README.md` (linhas 85-86 e 118), `PRODUCT.md` linha 45 e `design/PROMPT.md` linha 180.
7. **Testes:**
   - **Números fixos:** atualizar `api/test_api.py` nas linhas 41, 48, 65, 74 e 126.
   - **Novos testes:** a reprodução da Tabela 1 do artigo, os exemplos de fusão acima e a cobertura por ano.
8. **Limpeza:** remover `banco/migracoes.rar`. O `docker-compose.yml` monta só a pasta `migracoes`, e nada no repositório cita o `.rar`.

**Critérios de pronto:**
- Banco recriado do zero.
- Cobertura do artigo em 100% em 2018 a 2022 e de pelo menos 96% em 2024.
- Nenhum `vies_politico = 0` usado como "desconhecido".
- Documentação e banco dizendo a mesma coisa sobre a origem dos valores.

## Limites

- Não testei este plano contra o banco carregado nem medi o tempo de recarga.
- Os nomes dos arquivos da Câmara vêm do PDF que você enviou, e eu não consegui baixá-los. As datas de troca de nome de PTC, PSDC e PMN estão sem confirmação no TSE.
- Nenhuma das duas janelas novas do SVD (2020 e 2024) foi calculada ainda.
- O alinhamento do SVD acompanha a coalizão de governo, e não a ideologia. Nos nossos testes, o mesmo partido se desloca dezenas de pontos entre governos. O rótulo na interface precisa dizer isso.

PTC (Partido Trabalhista Cristão) mudou de nome para Agir em 2022. O PSDC (Partido Social Democrata Cristão) mudou de nome para Democracia Cristã em 2018. O PMN (Partido da Mobilização Nacional) mudou de nome para Mobilização Nacional em 2023.
