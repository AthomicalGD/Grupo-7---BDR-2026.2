-- Território, cargos, partidos e eleições.
--
-- ELEICAO representa uma disputa: um pleito do TSE (cd_eleicao) em um turno,
-- para um cargo, em uma unidade eleitoral (Brasil, UF ou município). É nessa
-- granularidade que quantidade_de_vagas e os relacionamentos com CARGO, UF e
-- MUNICIPIO do DER fazem sentido. Presidente: cd_uf e cd_municipio nulos;
-- governador/senador/deputados: só cd_uf; prefeito/vereador: só cd_municipio.

CREATE TABLE uf (
    cd_ibge smallint PRIMARY KEY,
    sigla   char(2)  NOT NULL UNIQUE
);

CREATE TABLE municipio (
    cd_municipio integer  PRIMARY KEY,                 -- código do TSE (5 dígitos)
    nm_municipio text     NOT NULL,
    cd_ibge      integer  UNIQUE,                      -- código do IBGE (7 dígitos); nulo em municípios extintos
    cd_uf        smallint NOT NULL REFERENCES uf (cd_ibge)
);
CREATE INDEX ON municipio (cd_uf);

CREATE TABLE zona_eleitoral (
    id_zona      serial  PRIMARY KEY,
    numero       integer NOT NULL,
    cd_municipio integer NOT NULL REFERENCES municipio,
    UNIQUE (cd_municipio, numero)
);
COMMENT ON TABLE zona_eleitoral IS
    'Parte de uma zona eleitoral dentro de um município: uma zona do TSE pode abranger vários municípios.';

CREATE TABLE cargo (
    cod_cargo smallint PRIMARY KEY,                    -- CD_CARGO do TSE
    ds_cargo  text     NOT NULL,                       -- descrição como veio da base eleitoral
    nome      text     NOT NULL                        -- descrição padronizada (maiúsculas)
);

CREATE TABLE partido (
    id_partido    serial   PRIMARY KEY,
    numero        smallint NOT NULL,
    sigla         varchar(30) NOT NULL,
    nome          text,
    vies_politico double precision,                    -- ainda não calculado
    UNIQUE (numero, sigla)
);
COMMENT ON TABLE partido IS
    'O TSE reaproveita números de partidos extintos (ex.: 25 foi DEM e hoje é PRD), por isso a chave natural é (numero, sigla).';

CREATE TABLE eleicao (
    id_eleicao          serial   PRIMARY KEY,
    cd_eleicao          integer  NOT NULL,             -- CD_ELEICAO do TSE (muda entre turnos em vários anos)
    ano                 smallint NOT NULL,
    turno               smallint NOT NULL CHECK (turno IN (1, 2)),
    tipo                smallint NOT NULL,             -- CD_TIPO_ELEICAO: 1 suplementar, 2 ordinária
    ds_eleicao          text,
    quantidade_de_vagas integer,
    cod_cargo           smallint NOT NULL REFERENCES cargo,
    cd_uf               smallint REFERENCES uf (cd_ibge),
    cd_municipio        integer  REFERENCES municipio,
    CHECK (cd_uf IS NULL OR cd_municipio IS NULL),
    UNIQUE NULLS NOT DISTINCT (cd_eleicao, turno, cod_cargo, cd_uf, cd_municipio)
);
CREATE INDEX ON eleicao (cod_cargo);
CREATE INDEX ON eleicao (cd_uf);
CREATE INDEX ON eleicao (cd_municipio);
CREATE INDEX ON eleicao (ano, turno);
