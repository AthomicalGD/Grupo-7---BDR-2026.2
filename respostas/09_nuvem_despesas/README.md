# Questão 9 — Nuvem de despesas por candidatura

Esta pasta reúne as respostas da pergunta sobre **em que as campanhas gastaram dinheiro**.
Cada candidatura tem uma imagem (`.png`) e um detalhamento (`.txt`); a auditoria das regras
de classificação fica em [auditoria_classificacao.txt](auditoria_classificacao.txt).

## Arquivos e execução

Os pares seguem `<ano>_<nome_civil_sem_acentos>_<id_politico_eleicao>.png/.txt`. O ano
identifica a eleição; o ID distingue candidaturas com nomes iguais ou da mesma pessoa em
anos diferentes. O ID é interno ao banco e pode mudar quando ele for recriado.

Com o PostgreSQL carregado e as dependências de `requirements.txt` instaladas, rode a partir
da raiz do projeto (ative o ambiente virtual antes, se necessário):

```bash
python scripts/09_nuvem_despesas.py 744696
python scripts/09_nuvem_despesas.py --auditar
python -m unittest discover -s scripts -p 'test_09*.py'
```

O primeiro comando gera ou atualiza o par da candidatura de Wellington Dias a governador
do Piauí em 2018; o segundo atualiza a auditoria dos quatro anos nas UFs carregadas.
Para achar outros IDs, consulte `politico_eleicao`, `politico` e `eleicao` no banco.

Os pares atuais estão identificados pelo nome e ano no próprio nome do arquivo. Exemplos:

- [Wellington Dias, governador do PI em 2018](2018_jose_wellington_barroso_de_araujo_dias_744696.txt)
  ([nuvem](2018_jose_wellington_barroso_de_araujo_dias_744696.png)).
- [Sílvio Mendes, governador do PI em 2022](2022_silvio_mendes_de_oliveira_filho_755802.txt)
  ([nuvem](2022_silvio_mendes_de_oliveira_filho_755802.png)).
- [Sílvio Mendes, prefeito de Teresina em 2024](2024_silvio_mendes_de_oliveira_filho_756622.txt)
  ([nuvem](2024_silvio_mendes_de_oliveira_filho_756622.png)).

## Metodologia

O [script](../../scripts/09_nuvem_despesas.py) consulta o PostgreSQL carregado pelo projeto.
Cada despesa de `despesa_de_campanha` está ligada a `politico_eleicao`, que identifica uma
candidatura numa disputa, e pode estar ligada à tabela `fornecedor`. Entram eleições
**ordinárias de 2018, 2020, 2022 e 2024**, conforme os dados disponíveis no banco.

São consideradas despesas **contratadas** (`vr_despesa_contratada`) positivas. Registros
de valor zero são contados no TXT, mas não têm peso na nuvem. A categoria “Doações
financeiras a outros candidatos/partidos” fica fora: transferências entre campanhas
reaparecem como gasto da candidatura recebedora. Eleições suplementares ficam fora.

Cada despesa positiva recebe **um tipo de gasto**; a nuvem recebe, para cada tipo, a soma
dos valores contratados em reais **do próprio ano da eleição**. O tamanho da expressão
na imagem depende desse valor, não do número de registros nem da repetição de palavras
na descrição. Não há correção pelo IPCA nesta resposta. O TXT mostra contagem, valor,
participação no total, categorias declaradas originalmente ao TSE e fornecedores.

## Classificação dos gastos

1. **Tipo do TSE em primeiro lugar.** Quando `ds_origem_despesa` especifica o gasto, ele
   prevalece sobre `ds_despesa`. Tipos equivalentes são agrupados para a nuvem: por exemplo,
   “Publicidade por adesivos” e “Publicidade por materiais impressos” entram em
   **Propaganda impressa**; a categoria original continua visível no TXT.
2. **Descrição nas categorias genéricas.** Para “Serviços prestados por terceiros”,
   “Diversas a especificar” e outras origens genéricas, o script procura serviços
   explícitos em `ds_despesa`. Antes da busca, ignora acentos e diferenças de maiúsculas.
   Regras com termos específicos vêm antes das mais amplas. Por exemplo, “panfleteiro”
   e “cabo eleitoral” entram em **Mobilização e militância**; “mídias sociais” em
   **Comunicação digital**; “serviços advocatícios” em **Serviços advocatícios**.
3. **Sem adivinhação.** Se nem o tipo nem a descrição permitirem identificar um serviço,
   a despesa fica em **Outros serviços (não identificados)** ou **Não especificado**.
   “Conforme contrato”, sem mais detalhes, é um exemplo. O nome ou CNAE do fornecedor
   nunca determina o tipo de gasto.

O TXT separa a cobertura em **tipo TSE**, **descrição** e **sem identificação**, por
quantidade de despesas e por parcela do valor total. Para os tipos inferidos, inclui até
três descrições originais de maior valor, permitindo conferir a interpretação.

## Fornecedores e interpretação

Para cada tipo, o TXT mostra até cinco fornecedores, somados pelo cadastro de documento
quando existe, com valor e quantidade de despesas. Essa lista ajuda a responder *quem
foi contratado* para aquele gasto; **não comprova, por si só, qual serviço foi prestado**.
Quando o documento não foi informado, não há vínculo com `fornecedor`, e o relatório
indica “fornecedor não informado”. Um nome cadastrado também não substitui o texto da
despesa para interpretar o serviço.

## Dificuldades e limitações

- O TSE usa categorias amplas, sobretudo “Serviços prestados por terceiros”; a descrição
  é texto livre, por vezes abreviado, truncado, com erros de grafia ou apenas “contrato”.
  Por isso uma descrição reconhecida é **inferência transparente**, não categoria oficial.
- Uma despesa pode combinar serviços (por exemplo, audiovisual e plataforma digital). A
  regra escolhe **um** tipo para não contar o mesmo valor duas vezes; a categoria e a
  descrição originais ficam no TXT. A ordem das regras influencia esses casos mistos.
- Nem todo gasto tem fornecedor associado, e o cadastro do fornecedor não descreve cada
  contrato. Despesas sem valor positivo não entram na distribuição da imagem.
- A auditoria cobre **somente as UFs carregadas** no banco, não presume cobertura do Brasil
  inteiro. Comparar valores de anos diferentes exige corrigir inflação separadamente.
- A nuvem apresenta uma distribuição de valores declarados; ela não verifica execução de
  contratos, pagamentos efetivos nem regularidade dos gastos.

## Auditoria e testes

O arquivo [auditoria_classificacao.txt](auditoria_classificacao.txt) mostra, para cada ano,
o valor classificado diretamente, o inferido pela descrição e o que ainda não foi
identificado. Ele lista as **20 descrições pendentes de maior valor** por ano, priorizando
a revisão das regras. Uma nova regra só deve ser incluída se a descrição explicitar o
serviço e se exemplos que possam gerar falso positivo forem testados. Continuar com
algum valor não identificado é mais fiel aos dados do que inferir pelo fornecedor.

Os testes em `scripts/test_09_nuvem_despesas.py` cobrem precedência da categoria do TSE,
variações de grafia, descrições ambíguas, soma exata dos valores, falta de fornecedor e
o nome dos arquivos. Os exemplos desta pasta foram gerados contra candidaturas carregadas
dos quatro anos; os totais foram conferidos com a soma das despesas no banco.
