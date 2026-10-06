-- As migrações 006 a 008 gravam o viés com UPDATE em partido. Num banco novo elas rodam
-- antes da carga, com partido ainda vazio, e todo partido inserido depois pelo loader
-- fica com o viés padrão 0. Aqui os mesmos valores viram uma tabela de referência e um
-- trigger preenche o viés de cada partido inserido, qualquer que seja a ordem.

CREATE TABLE vies_partido_referencia (
    numero smallint         NOT NULL,
    sigla  varchar(30)      NOT NULL,
    vies   double precision NOT NULL,
    PRIMARY KEY (numero, sigla)
);
COMMENT ON TABLE vies_partido_referencia IS
    'Viés (-100 esquerda, +100 direita) por (numero, sigla), de 006, 007 e 008. Ausente = 0.';

INSERT INTO vies_partido_referencia (numero, sigla, vies) VALUES
    -- 006: partido atual
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
    (20, 'PODE',         -18.4),
    (23, 'CIDADANIA',    -10.6),
    (18, 'REDE',          -5.8),
    (77, 'SOLIDARIEDADE', -3.8),
    (25, 'PRD',            3.5),
    (22, 'PL',            49.0),
    (30, 'NOVO',          87.6),
    -- 006: nomes anteriores do mesmo partido
    (70, 'PT DO B',      -55.0),
    (15, 'PMDB',         -29.5),
    (10, 'PRB',          -28.0),
    (11, 'PPB',          -20.4),
    (19, 'PTN',          -18.4),
    (23, 'PPS',          -10.6),
    (77, 'SD',            -3.8),
    (22, 'PR',            49.0),
    -- 007: fundidos ou incorporados herdam o sucessor
    (25, 'DEM',          -31.8),
    (25, 'PFL',          -31.8),
    (14, 'PTB',            3.5),
    (51, 'PATRIOTA',       3.5),
    (51, 'PATRI',          3.5),
    (44, 'PRP',            3.5),
    (20, 'PSC',          -18.4),
    (31, 'PHS',          -18.4),
    (31, 'PSN',          -18.4),
    (90, 'PROS',          -3.8),
    (54, 'PPL',          -61.1),
    -- 008: o PSL herda o viés do PL
    (17, 'PSL',           49.0);

CREATE FUNCTION partido_preencher_vies() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.vies_politico := COALESCE(
        (SELECT r.vies FROM vies_partido_referencia r WHERE r.numero = NEW.numero AND r.sigla = NEW.sigla),
        NEW.vies_politico, 0);
    RETURN NEW;
END $$;

CREATE TRIGGER partido_vies BEFORE INSERT ON partido
    FOR EACH ROW EXECUTE FUNCTION partido_preencher_vies();

-- Bancos já carregados: corrige os partidos que ficaram com 0.
UPDATE partido p SET vies_politico = r.vies
FROM vies_partido_referencia r
WHERE r.numero = p.numero AND r.sigla = p.sigla AND p.vies_politico IS DISTINCT FROM r.vies;
