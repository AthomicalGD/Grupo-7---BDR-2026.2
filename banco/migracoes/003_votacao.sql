-- Resultados e perfil do eleitorado por zona e por município.

CREATE TABLE votacao_candidato_munzona (
    id_eleicao          integer NOT NULL REFERENCES eleicao,
    id_zona             integer NOT NULL REFERENCES zona_eleitoral,
    id_politico_eleicao bigint  NOT NULL REFERENCES politico_eleicao,
    qtd_votos_nominais  integer NOT NULL,
    PRIMARY KEY (id_eleicao, id_zona, id_politico_eleicao)
);
CREATE INDEX ON votacao_candidato_munzona (id_politico_eleicao);
CREATE INDEX ON votacao_candidato_munzona (id_zona);

CREATE TABLE votacao_partido_munzona (
    id_eleicao                 integer NOT NULL REFERENCES eleicao,
    id_zona                    integer NOT NULL REFERENCES zona_eleitoral,
    id_partido                 integer NOT NULL REFERENCES partido,
    qt_votos_legenda_validos   integer NOT NULL,
    qt_total_votos_leg_validos integer NOT NULL,
    qt_votos_nominais_validos  integer NOT NULL,
    PRIMARY KEY (id_eleicao, id_zona, id_partido)
);
CREATE INDEX ON votacao_partido_munzona (id_partido);
CREATE INDEX ON votacao_partido_munzona (id_zona);

CREATE TABLE perfil_eleitorado_munzona (
    id_zona              integer  NOT NULL REFERENCES zona_eleitoral,
    ano_eleicao          smallint NOT NULL,
    ds_grau_escolaridade text     NOT NULL,
    qtd_eleitores        integer  NOT NULL,            -- aptos
    qtd_comparecimento   integer  NOT NULL,
    PRIMARY KEY (id_zona, ano_eleicao, ds_grau_escolaridade)
);
COMMENT ON TABLE perfil_eleitorado_munzona IS 'Eleitorado apto e comparecimento no 1º turno, por escolaridade.';

CREATE TABLE votacao_municipio (
    id_eleicao        integer NOT NULL REFERENCES eleicao,
    cd_municipio      integer NOT NULL REFERENCES municipio,
    qt_aptos          integer NOT NULL,
    qt_comparecimento integer NOT NULL,
    qt_brancos        integer NOT NULL,
    qt_nulos          integer NOT NULL,
    qt_abstencoes     integer NOT NULL,
    PRIMARY KEY (id_eleicao, cd_municipio)
);
CREATE INDEX ON votacao_municipio (cd_municipio);

CREATE TABLE votacao_partido_municipio (
    cd_municipio     integer  NOT NULL REFERENCES municipio,
    id_partido       integer  NOT NULL REFERENCES partido,
    ano_eleicao      smallint NOT NULL,
    cod_cargo        smallint NOT NULL REFERENCES cargo,
    qt_votos_validos integer  NOT NULL,                -- nominais + legenda
    PRIMARY KEY (cd_municipio, id_partido, ano_eleicao, cod_cargo)
);
CREATE INDEX ON votacao_partido_municipio (id_partido);
COMMENT ON TABLE votacao_partido_municipio IS
    'Votos válidos do partido no município, 1º turno das eleições ordinárias, por cargo.';
