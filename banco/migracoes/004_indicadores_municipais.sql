-- Indicadores municipais (IBGE, Atlas/Ipea) e métricas derivadas.

CREATE TABLE malha_municipio (
    cd_municipio integer PRIMARY KEY REFERENCES municipio,
    geometria    jsonb   NOT NULL
);

CREATE TABLE vies_municipio (
    cd_municipio   integer  NOT NULL REFERENCES municipio,
    ano_eleitoral  smallint NOT NULL,
    vies_calculado double precision NOT NULL,
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
