# Inspirações para as telas das questões novas (P6, P3, P5)

Pesquisa feita no Dribbble (sem bloqueio; o aviso de cookies ficou fechado e nada foi clicado nele). Buscas: *election dashboard*,
*age pyramid*, *data storytelling*, *demographics infographic*, *scatter plot dashboard*, *editorial data visualization*, *civic tech*,
*brazil map dashboard*. Nada foi copiado: cada referência virou uma **regra** aplicada ao azulejo de Brasília (azul `#1d4fa0`,
vermelho `#d6382a`, amarelo `#f5b800`, rejunte de 3px, League Spartan + Archivo).

| # | Referência | O que ensina | Como entrou no Voto Aberto |
|---|---|---|---|
| 1 | [Demographics dashboard, dark UI](https://dribbble.com/shots/27860705-Demographics-dashboard-dark-UI) (Goucem Adel Abdelaziz) | Título que diz a conclusão ("pirâmide, tempo de casa e equilíbrio num relance"); faixa de 3 ou 4 números-chave **acima** da pirâmide; a pirâmide é o único gráfico grande do bloco | Cada ato da `/idade` abre com um **veredito** (palavra grande + frase) e só depois o gráfico; a pirâmide ficou como herói do ato 3 |
| 2 | [Mobile-first interactive charts](https://dribbble.com/shots/23665009-Mobile-first-interactive-charts) | Rótulos ligados direto à figura (linhas e percentuais no corpo), seletor de ano em setas grandes, a mesma pirâmide no celular | Rótulos diretos nas barras e nos pontos (sem legenda distante); alvos de toque de 44px; mobile de 390px desenhado primeiro |
| 3 | [Village of 100 infographic](https://dribbble.com/shots/22574323-Village-of-100-infographic) (Alexa Herrmann) | "Se a cidade fosse uma vila de 100": gráfico de unidades (cada ícone = pessoas), blocos de peso igual, número enorme + rótulo de uma linha | O **mosaico de cadeiras** da `/cadeira/legenda`: cada pastilha é uma cadeira (ou N cadeiras), agrupadas por partido |
| 4 | [Civic Data & Demographics Infographics](https://dribbble.com/shots/26316043-Civic-Data-Demographics-Infographics) | Uma cor chapada por lâmina, números gigantes com um rótulo curto, uma mensagem por quadro | Veredito como **peça de azulejo** de cor chapada (amarela, azul ou branca) com a palavra-resposta em League Spartan |
| 5 | [VotersHQ, civic tech election tracking](https://dribbble.com/shots/27507132-VotersHQ-Civic-Tech-Election-Tracking-Platform-Web-UI) | Sublinhado curto de cor sob os títulos de seção; barra Sim/Não com o percentual escrito dentro; ação principal em uma peça de cor | O fio de pastilhas sob os títulos (já do azulejo) foi mantido; barras de proporção com o número dentro e a ação principal na peça amarela |
| 6 | [Exploring the City: Barranquilla's Localities](https://dribbble.com/shots/27204036-Exploring-the-City-Barranquilla-s-Localities-Digital-Special) | Especial editorial: fio de bandeira sob o título, divulgação progressiva por **abas de lugar**, o mapa só depois do texto | Atalhos de pergunta no topo da `/idade` (as quatro perguntas como peças), cada uma leva ao seu ato; o detalhe (tabelas, mapa de passagens) fica sob demanda |
| 7 | [I tried to draw a billion](https://dribbble.com/shots/27753630-I-tried-to-draw-a-billion) (GyGinfographics) | A régua nas bordas e as marcas de milímetro: o gráfico *é* um instrumento de medir; um objeto só, grande, no centro | A **régua de idade** da `/idade` (5 anos da zona contra 1,7 ano do deputado, na mesma escala) e o **termômetro** de correlação da `/indices` |

## Lições transversais

- **Hierarquia:** pergunta (h1) → veredito em 1 palavra → frase de apoio com 60 caracteres por linha → um gráfico herói → detalhe sob demanda.
- **Ritmo:** peças quadradas de mesmo módulo; o branco entre elas é o rejunte (3px), nunca sombra.
- **Cor:** o azulejo tem três cores e cada uma tem um papel: azul = o dado principal, amarelo = o destaque/veredito, vermelho = o alerta ou a exceção. O sépia da `/idade` fica restrito ao dado de idade.
- **Tipografia:** números e vereditos em League Spartan; texto corrido em Archivo; nenhuma quarta família.
- **Microinteração:** nada contínuo. Barras crescem uma vez ao aparecer (e param com `prefers-reduced-motion`); foco e *hover* só trocam cor e contorno.
