-- Políticos, candidaturas, mandatos, bens e prestação de contas.

CREATE TABLE politico (
    id_politico            bigserial   PRIMARY KEY,
    cpf                    char(11),                   -- mascarado em 2024 e ausente nos anos antigos
    nr_titulo_eleitoral    varchar(12) UNIQUE,
    nome                   text        NOT NULL,
    ds_grau_de_instrucao   text,                       -- o da candidatura mais recente
    dt_nascimento          date,
    ano_ultima_candidatura smallint    NOT NULL
);
CREATE INDEX ON politico (cpf);
CREATE INDEX ON politico (nome, dt_nascimento);
COMMENT ON TABLE politico IS
    'Pessoa identificada pelo título eleitoral; sem ele, pelo CPF; sem ambos, por nome + data de nascimento.';

CREATE TABLE politico_eleicao (
    id_politico_eleicao bigserial PRIMARY KEY,
    sq_candidato        bigint    NOT NULL,
    id_politico         bigint    NOT NULL REFERENCES politico,
    id_eleicao          integer   NOT NULL REFERENCES eleicao,   -- disputa do 1º turno
    UNIQUE (id_eleicao, sq_candidato)
);
CREATE INDEX ON politico_eleicao (id_politico);
COMMENT ON TABLE politico_eleicao IS
    'Candidatura. SQ_CANDIDATO não é único entre anos nem entre unidades eleitorais, por isso a chave é substituta.';

CREATE TABLE mandato (
    id_mandato          bigserial PRIMARY KEY,
    id_politico_eleicao bigint    NOT NULL UNIQUE REFERENCES politico_eleicao,
    id_partido          integer   NOT NULL REFERENCES partido,
    id_eleicao          integer   NOT NULL REFERENCES eleicao,   -- disputa (turno) em que foi eleito
    ds_situacao         text      NOT NULL                       -- ELEITO, ELEITO POR QP, ELEITO POR MÉDIA ou MÉDIA
);
CREATE INDEX ON mandato (id_partido);
CREATE INDEX ON mandato (id_eleicao);

CREATE TABLE bem (
    id_bem              bigserial     PRIMARY KEY,
    id_politico_eleicao bigint        NOT NULL REFERENCES politico_eleicao,
    vr_bem_candidato    numeric(20,2) NOT NULL
);
CREATE INDEX ON bem (id_politico_eleicao);

CREATE TABLE receita_de_campanha (
    cd_receita          bigserial     PRIMARY KEY,
    sq_receita          bigint,
    id_politico_eleicao bigint        NOT NULL REFERENCES politico_eleicao,
    vr_receita          numeric(20,2) NOT NULL,
    ds_receita          text,
    ds_fonte_receita    text,                          -- FUNDO ESPECIAL, FUNDO PARTIDARIO, OUTROS RECURSOS
    ds_origem_receita   text
);
CREATE INDEX ON receita_de_campanha (id_politico_eleicao);

CREATE TABLE fornecedor (
    numero              serial PRIMARY KEY,
    cpf_cnpj_fornecedor varchar(14) NOT NULL UNIQUE,
    nm_fornecedor       text,
    ds_cnae_fornecedor  text
);

CREATE TABLE despesa_de_campanha (
    cd_despesa            bigserial     PRIMARY KEY,
    sq_despesa            text,
    id_politico_eleicao   bigint        NOT NULL REFERENCES politico_eleicao,
    numero_fornecedor     integer       REFERENCES fornecedor,  -- nulo quando o documento não foi informado
    ds_despesa            text,
    ds_origem_despesa     text,                                 -- tipo da despesa (ex.: publicidade por materiais impressos)
    vr_despesa_contratada numeric(20,2) NOT NULL
);
CREATE INDEX ON despesa_de_campanha (id_politico_eleicao);
CREATE INDEX ON despesa_de_campanha (numero_fornecedor);
