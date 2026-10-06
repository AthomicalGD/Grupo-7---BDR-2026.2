# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegado pelo usuário ("algo realmente profissional, não só HTML/CSS/JS"). Escolha:
React 19 + TypeScript + Vite no front (TanStack Router e Query, Tailwind v4 com tokens,
Motion, D3 para mapas e gráficos, Three.js via React Three Fiber para o 3D) e uma API
FastAPI sobre o PostgreSQL 17 já existente. Testes ponta a ponta com Playwright.

## Users

Alunos e professores da disciplina de Banco de Dados (Grupo 7, 2026.2) e quem avaliar o
trabalho: precisam ver, com dados reais do TSE e do IBGE, as respostas às perguntas do
projeto. Uso em sala, em projetor ou notebook, à luz do dia. Público secundário:
qualquer cidadão curioso sobre o próprio município ou sobre a carreira de um político.

## Product Purpose

**Urna Aberta** abre os dados públicos das eleições brasileiras e responde, de forma
visual e navegável, às perguntas do projeto. Foco atual: P7 (viés político de município
e região na linha do tempo 2018-2024) e P10 (sobrevivência da carreira de um político,
1994-2024). As demais perguntas (1-6, 8, 9) entram depois, sem prioridade.

Sucesso: em segundos, quem chega entende para que lado cada estado e município pendeu
em cada eleição, chega ao seu município pelo mapa ou digitando o nome, e reconstrói a
trajetória de qualquer político a partir do nome.

## Positioning

Não é um portal de resultados de apuração. É o arquivo aberto da urna: liga quatro
eleições de viés partidário a cada município do mapa e trinta anos de candidaturas a
cada pessoa, com dados que o próprio grupo coletou, modelou e carregou.

## Operating Context

- Dados em `dados/` (crawler), carregados no PostgreSQL por UF (`python -m loader`).
- UFs carregadas hoje: AC, BA, GO, PE, PI, PR (+ BR para Presidente). As outras
  aparecem como "sem dados carregados", nunca como zero.
- Viés do partido: `partido.vies_politico`, de -100 (esquerda) a +100 (direita).
  Viés do município = média dos vieses ponderada pelos votos válidos de cada partido.
- Anos gerais (2018, 2022) e municipais (2020, 2024) têm cargos diferentes.

## Capabilities and Constraints

- Mapas a partir das malhas GeoJSON do IBGE (`dados/ibge/malhas/`).
- Carreira: candidaturas e mandatos de 1994 a 2024; partido conhecido só nos mandatos;
  votos por candidatura só em 2018-2024 e nas UFs carregadas.
- Privacidade: CPF e título eleitoral nunca aparecem na interface.

## Brand Commitments

- Nome: **Urna Aberta**.
- Paleta clara das ondas de referência (verde, lima, ardósia, azul-petróleo,
  azul-claro, laranja, amarelo), sem copiar o layout das referências.
- Cara de site governamental sério, sem se passar por órgão oficial: sem nome, brasão
  ou marca do TSE ou de qualquer órgão; rodapé diz que é projeto acadêmico.
- Urnas fazem parte do funcionamento do sistema, não só da decoração.

## Evidence on Hand

Respostas já calculadas em `respostas/` (P7, P10a, P10b), scripts em `scripts/`,
esquema em `banco/migracoes/`. Não inventar números: tudo vem do banco.

## Product Principles

1. O dado real é o protagonista; a metáfora só existe se ajudar a ler o dado.
2. Ausência é informação: UF não carregada, partido sem viés e ano sem dado ficam
   visíveis e explicados.
3. Todo caminho tem duas entradas: clicar no mapa ou digitar o nome.
4. Rigor de órgão público: fonte, método e limitações a um clique.

## Accessibility & Inclusion

WCAG 2.2 AA: contraste, navegação por teclado no mapa e na urna, `prefers-reduced-motion`
desliga zoom animado e 3D, cor nunca é o único canal (legenda, rótulos e tabela).
