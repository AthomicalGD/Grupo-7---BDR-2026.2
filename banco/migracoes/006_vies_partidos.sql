-- Viés político dos partidos (escala de -100, esquerda, a +100, direita) conforme
-- "Vieses dos Partidos.txt". O viés vale também para os nomes anteriores do
-- mesmo partido (mesmo número, só mudou o nome/sigla). Partidos sem viés informado,
-- inclusive os que se fundiram ou foram incorporados, ficam com 0.
--
-- A chave é (numero, sigla): o TSE reaproveita siglas de partidos extintos
-- (ex.: PSD 41, extinto em 2003, e PSD 55, criado em 2011; PP 39, de 1993, e PP 11).

ALTER TABLE partido ALTER COLUMN vies_politico SET DEFAULT 0;

UPDATE partido p SET vies_politico = COALESCE(v.vies, 0)
FROM partido p2
LEFT JOIN (VALUES
    -- partido atual
    (13, 'PT',           -68.0),
    (65, 'PC DO B',      -61.1),
    (40, 'PSB',          -58.4),
    (70, 'AVANTE',       -55.0),
    (43, 'PV',           -51.7),
    (12, 'PDT',          -49.9),
    (50, 'PSOL',         -37.0),
    (45, 'PSDB',         -32.1),
    (44, 'UNIÃO',        -31.8),
    (15, 'MDB',          -29.5),
    (55, 'PSD',          -29.2),
    (10, 'REPUBLICANOS', -28.0),
    (11, 'PP',           -20.4),
    (19, 'PODE',         -18.4),
    (20, 'PODE',         -18.4),   -- Podemos passou a usar o número 20 em 2023
    (23, 'CIDADANIA',    -10.6),
    (18, 'REDE',          -5.8),
    (77, 'SOLIDARIEDADE', -3.8),
    (25, 'PRD',            3.5),
    (22, 'PL',            49.0),
    (30, 'NOVO',          87.6),
    -- nomes anteriores do mesmo partido
    (70, 'PT DO B',      -55.0),   -- Avante desde 2017
    (15, 'PMDB',         -29.5),   -- MDB desde 2017
    (10, 'PRB',          -28.0),   -- Republicanos desde 2019
    (11, 'PPB',          -20.4),   -- PP desde 2003
    (19, 'PTN',          -18.4),   -- Podemos desde 2017
    (23, 'PPS',          -10.6),   -- Cidadania desde 2019
    (77, 'SD',            -3.8),   -- sigla Solidariedade desde 2017
    (22, 'PR',            49.0)    -- PL desde 2019
) AS v (numero, sigla, vies) ON v.numero = p2.numero AND v.sigla = p2.sigla
WHERE p.id_partido = p2.id_partido;

COMMENT ON COLUMN partido.vies_politico IS
    'Viés de -100 (esquerda) a +100 (direita); 0 quando não informado.';
