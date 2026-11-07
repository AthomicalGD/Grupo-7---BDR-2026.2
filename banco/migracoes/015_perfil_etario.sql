-- P6: idade de quem votou, por zona e faixa etária.
--
-- Vem do mesmo arquivo do TSE que perfil_eleitorado_munzona (perfil_comparecimento_abstencao, 1º turno), que
-- antes era somado só por escolaridade. O loader grava nas cargas novas; para o que já estava carregado:
-- python -m loader.perfil_etario

-- As faixas do TSE (CD_FAIXA_ETARIA): ano a ano de 16 a 20, depois de 5 em 5, e 100 ou mais. A faixa "inválida"
-- (-3) não entra. idade_media é o ponto médio em anos completos, usado nas médias da P6.
CREATE TABLE faixa_etaria (
    cd_faixa     smallint     PRIMARY KEY,
    ds_faixa     text         NOT NULL,
    idade_inicio smallint     NOT NULL,
    idade_fim    smallint,                       -- nulo: 100 anos ou mais
    idade_media  numeric(4,1) NOT NULL
);
INSERT INTO faixa_etaria VALUES
    (1600, '16 anos',           16,   16,  16.0),
    (1700, '17 anos',           17,   17,  17.0),
    (1800, '18 anos',           18,   18,  18.0),
    (1900, '19 anos',           19,   19,  19.0),
    (2000, '20 anos',           20,   20,  20.0),
    (2124, '21 a 24 anos',      21,   24,  22.5),
    (2529, '25 a 29 anos',      25,   29,  27.0),
    (3034, '30 a 34 anos',      30,   34,  32.0),
    (3539, '35 a 39 anos',      35,   39,  37.0),
    (4044, '40 a 44 anos',      40,   44,  42.0),
    (4549, '45 a 49 anos',      45,   49,  47.0),
    (5054, '50 a 54 anos',      50,   54,  52.0),
    (5559, '55 a 59 anos',      55,   59,  57.0),
    (6064, '60 a 64 anos',      60,   64,  62.0),
    (6569, '65 a 69 anos',      65,   69,  67.0),
    (7074, '70 a 74 anos',      70,   74,  72.0),
    (7579, '75 a 79 anos',      75,   79,  77.0),
    (8084, '80 a 84 anos',      80,   84,  82.0),
    (8589, '85 a 89 anos',      85,   89,  87.0),
    (9094, '90 a 94 anos',      90,   94,  92.0),
    (9599, '95 a 99 anos',      95,   99,  97.0),
    (9999, '100 anos ou mais', 100, NULL, 100.0);
COMMENT ON TABLE faixa_etaria IS
    'As faixas etárias do TSE (CD_FAIXA_ETARIA) com o ponto médio em anos completos; liga perfil_etario_munzona.';

CREATE TABLE perfil_etario_munzona (
    id_zona            integer  NOT NULL REFERENCES zona_eleitoral,
    ano_eleicao        smallint NOT NULL,
    cd_faixa           smallint NOT NULL REFERENCES faixa_etaria,
    qtd_eleitores      integer  NOT NULL,            -- aptos
    qtd_comparecimento integer  NOT NULL,
    PRIMARY KEY (id_zona, ano_eleicao, cd_faixa)
);
CREATE INDEX ON perfil_etario_munzona (ano_eleicao);
COMMENT ON TABLE perfil_etario_munzona IS 'Eleitorado apto e comparecimento no 1º turno, por faixa etária.';
