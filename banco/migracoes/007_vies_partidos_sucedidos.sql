-- Viés dos partidos que deixaram de existir por fusão ou incorporação: herdam o viés do
-- partido que os sucedeu (006_vies_partidos.sql cobre só as mudanças de nome).
-- Chave (numero, sigla), como em 006.

UPDATE partido p SET vies_politico = v.vies
FROM (VALUES
    -- fusão DEM + PSL = UNIÃO (2022)
    (25, 'DEM',      -31.8),
    (25, 'PFL',      -31.8),   -- DEM até 2007
    (17, 'PSL',      -31.8),
    -- fusão PTB + Patriota = PRD (2023)
    (14, 'PTB',        3.5),
    (51, 'PATRIOTA',   3.5),
    (51, 'PATRI',      3.5),
    (44, 'PRP',        3.5),   -- incorporado ao Patriota (2019)
    -- incorporados ao Podemos
    (20, 'PSC',      -18.4),   -- 2023
    (31, 'PHS',      -18.4),   -- 2019
    (31, 'PSN',      -18.4),   -- PHS até 2000
    -- incorporado ao Solidariedade (2023)
    (90, 'PROS',      -3.8),
    -- incorporado ao PC do B (2019)
    (54, 'PPL',      -61.1)
) AS v (numero, sigla, vies)
WHERE p.numero = v.numero AND p.sigla = v.sigla;
