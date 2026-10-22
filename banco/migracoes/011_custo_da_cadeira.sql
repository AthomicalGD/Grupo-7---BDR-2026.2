-- P1 (Quanto custa uma cadeira?): partido de cada candidatura, IPCA para comparar anos e um
-- resumo das contas de campanha por candidatura.

-- O partido só estava em mandato (eleitos). O loader grava este campo nas cargas novas;
-- para o que já estava carregado: python -m loader.partidos
ALTER TABLE politico_eleicao ADD COLUMN id_partido integer REFERENCES partido;
COMMENT ON COLUMN politico_eleicao.id_partido IS 'Partido pelo qual concorreu (eleito ou não).';

-- IPCA, número-índice de outubro (mês da eleição), base dez/1993 = 100.
-- Fonte: IBGE, SIDRA tabela 1737, variável 2266, consultada em 07/10/2026.
-- Valor em reais de out/2024 = valor * (índice de 2024 / índice do ano).
CREATE TABLE ipca_outubro (
    ano    smallint      PRIMARY KEY,
    indice numeric(12,2) NOT NULL
);
INSERT INTO ipca_outubro VALUES (2018, 5103.69), (2020, 5438.12), (2022, 6407.93), (2024, 7036.33);

-- Contas de cada candidatura dos anos com prestação de contas.
-- despesa: contratada, sem "Doações financeiras a outros candidatos/partidos" (esse dinheiro
--          vira receita de outra campanha e seria contado duas vezes).
-- receitas: pela fonte declarada; "outros" = partido sem fundo público, outros candidatos,
--           financiamento coletivo, rendimentos e origens não identificadas.
-- votos: nominais do 1º turno (onde todos os candidatos disputam).
-- Gastos de vices e suplentes ficam de fora (R$ 0,2 mi em quatro eleições).
CREATE MATERIALIZED VIEW campanha AS
SELECT pe.id_politico_eleicao,
       COALESCE(d.despesa, 0)          AS despesa,
       COALESCE(r.fundo_eleitoral, 0)  AS fundo_eleitoral,
       COALESCE(r.fundo_partidario, 0) AS fundo_partidario,
       COALESCE(r.pessoas_fisicas, 0)  AS pessoas_fisicas,
       COALESCE(r.proprios, 0)         AS proprios,
       COALESCE(r.total, 0) - COALESCE(r.fundo_eleitoral, 0) - COALESCE(r.fundo_partidario, 0)
         - COALESCE(r.pessoas_fisicas, 0) - COALESCE(r.proprios, 0) AS outros,
       COALESCE(v.votos, 0)            AS votos
FROM politico_eleicao pe
JOIN eleicao e ON e.id_eleicao = pe.id_eleicao
LEFT JOIN (
    SELECT id_politico_eleicao, sum(vr_despesa_contratada) AS despesa
    FROM despesa_de_campanha
    WHERE ds_origem_despesa IS DISTINCT FROM 'Doações financeiras a outros candidatos/partidos'
    GROUP BY 1
) d ON d.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN (
    SELECT id_politico_eleicao,
           sum(vr_receita) FILTER (WHERE ds_fonte_receita = 'FUNDO ESPECIAL')   AS fundo_eleitoral,
           sum(vr_receita) FILTER (WHERE ds_fonte_receita = 'FUNDO PARTIDARIO') AS fundo_partidario,
           sum(vr_receita) FILTER (WHERE ds_fonte_receita = 'OUTROS RECURSOS'
                                     AND ds_origem_receita = 'Recursos de pessoas físicas') AS pessoas_fisicas,
           sum(vr_receita) FILTER (WHERE ds_fonte_receita = 'OUTROS RECURSOS'
                                     AND ds_origem_receita = 'Recursos próprios')           AS proprios,
           sum(vr_receita) AS total
    FROM receita_de_campanha
    GROUP BY 1
) r ON r.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN (
    SELECT v.id_politico_eleicao, sum(v.qtd_votos_nominais) AS votos
    FROM votacao_candidato_munzona v
    JOIN eleicao e ON e.id_eleicao = v.id_eleicao
    WHERE e.turno = 1
    GROUP BY 1
) v ON v.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.ano IN (SELECT ano FROM ipca_outubro);
CREATE UNIQUE INDEX ON campanha (id_politico_eleicao);

-- Para onde vai o dinheiro: despesa por tipo, somada por disputa.
CREATE MATERIALIZED VIEW despesa_por_eleicao AS
SELECT pe.id_eleicao, COALESCE(d.ds_origem_despesa, 'Não informado') AS categoria,
       sum(d.vr_despesa_contratada) AS valor
FROM despesa_de_campanha d
JOIN politico_eleicao pe ON pe.id_politico_eleicao = d.id_politico_eleicao
WHERE d.ds_origem_despesa IS DISTINCT FROM 'Doações financeiras a outros candidatos/partidos'
GROUP BY 1, 2;
CREATE INDEX ON despesa_por_eleicao (id_eleicao);
