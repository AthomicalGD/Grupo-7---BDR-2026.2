-- Indicadores municipais (IBGE, Atlas/Ipea) e métricas derivadas.

CREATE TABLE malha_municipio (
    cd_municipio integer PRIMARY KEY REFERENCES municipio,
    geometria    jsonb   NOT NULL
);

-- Preenchida por scripts/07_vies_politico_municipio.py. Em cada cargo da eleição (eleicao_referencia.cargos),
-- média do viés dos partidos ponderada pelos votos válidos (nominais + legenda, 1º turno); os cargos entram com
-- peso igual. Partido sem valor fica fora do numerador e do denominador e aparece na cobertura.
CREATE TABLE vies_municipio (
    cd_municipio          integer  NOT NULL REFERENCES municipio,
    ano_eleitoral         smallint NOT NULL,
    vies_calculado        double precision,     -- viés do artigo, -100 a +100
    cobertura_vies        numeric(5,2),         -- % dos votos válidos dos cargos em partidos com viés
    alinhamento           double precision,     -- alinhamento na Câmara (SVD), -100 a +100; não é o viés
    cobertura_alinhamento numeric(5,2),         -- % dos votos válidos dos cargos em partidos com alinhamento
    n_cargos              smallint NOT NULL,    -- cargos com votos no município
    PRIMARY KEY (cd_municipio, ano_eleitoral)
);

CREATE TABLE ibge_censo_municipio (
    cd_municipio          integer  NOT NULL REFERENCES municipio,
    ano                   smallint NOT NULL,
    idade_media_populacao double precision,
    PRIMARY KEY (cd_municipio, ano)
);

CREATE TABLE indices_municipio (
    cd_municipio          integer  NOT NULL REFERENCES municipio,
    ano                   smallint NOT NULL,
    idhm                  numeric(4,3),
    pib                   numeric(20,2),               -- mil reais, a preços correntes (SIDRA 5938)
    mediana_idade         numeric(5,1),                -- Censo 2022 (SIDRA 9515)
    indice_envelhecimento numeric(8,2),                -- idosos por 100 jovens, Censo 2022 (SIDRA 9515)
    populacao             integer,                     -- estimativa (SIDRA 6579) ou Censo 2022 (SIDRA 4709)
    PRIMARY KEY (cd_municipio, ano)
);
