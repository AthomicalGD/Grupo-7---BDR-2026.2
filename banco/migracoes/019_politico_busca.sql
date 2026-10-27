-- A busca por nome (/api/politicos): o resumo de cada político já contado. Um nome comum ("SILVA" acha ~370
-- mil dos 2,3 milhões de políticos) fazia a busca contar as candidaturas de cada achado na hora (18 s);
-- aqui a contagem está pronta e o nome sem acento tem o próprio índice de trigramas.
-- Depois de cada carga: REFRESH MATERIALIZED VIEW politico_busca (o loader faz, em carga.atualizar_resumos).
CREATE MATERIALIZED VIEW politico_busca AS
SELECT p.id_politico, p.nome, p.dt_nascimento, f_unaccent(upper(p.nome)) AS nome_busca,
       count(*) AS n, min(e.cod_cargo) AS topo, max(e.ano) AS ultimo
FROM politico p
JOIN politico_eleicao pe ON pe.id_politico = p.id_politico
JOIN eleicao e           ON e.id_eleicao = pe.id_eleicao
GROUP BY p.id_politico;

CREATE UNIQUE INDEX ON politico_busca (id_politico);
CREATE INDEX politico_busca_nome_trgm ON politico_busca USING gin (nome_busca gin_trgm_ops);
