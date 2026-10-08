-- P4: escolaridade do candidato x escolaridade de quem vota.
--
-- A escolaridade é da candidatura (a pessoa estuda entre uma eleição e outra), não do político:
-- politico.ds_grau_de_instrucao guarda só a da candidatura mais recente: 37% das candidaturas de
-- 2022 herdavam a de uma candidatura posterior, e em 699 (8,6%) ela era outra. O loader grava nas
-- cargas novas; para o que já estava carregado: python -m loader.partidos
ALTER TABLE politico_eleicao ADD COLUMN ds_grau_instrucao text;
ALTER TABLE politico_eleicao ADD COLUMN ds_sit_tot_turno text;
COMMENT ON COLUMN politico_eleicao.ds_grau_instrucao IS
    'Escolaridade declarada nesta candidatura (DS_GRAU_INSTRUCAO); nula quando não divulgável.';
COMMENT ON COLUMN politico_eleicao.ds_sit_tot_turno IS
    'Situação ao fim do 1º turno (DS_SIT_TOT_TURNO); nula (#NULO) quando a candidatura não foi apta.';

-- Escala comum: o TSE escreve a escolaridade do candidato e a do eleitor com os mesmos nomes.
CREATE TABLE escolaridade (
    ds_grau text     PRIMARY KEY,
    nivel   smallint UNIQUE,                -- 1 = analfabeto ... 8 = superior completo; nulo = não informado
    rotulo  text     NOT NULL               -- nome curto para tabelas e gráficos
);
INSERT INTO escolaridade VALUES
    ('ANALFABETO',                    1, 'Analfabeto'),
    ('LÊ E ESCREVE',                  2, 'Lê e escreve'),
    ('ENSINO FUNDAMENTAL INCOMPLETO', 3, 'Fundamental incompleto'),
    ('ENSINO FUNDAMENTAL COMPLETO',   4, 'Fundamental completo'),
    ('ENSINO MÉDIO INCOMPLETO',       5, 'Médio incompleto'),
    ('ENSINO MÉDIO COMPLETO',         6, 'Médio completo'),
    ('SUPERIOR INCOMPLETO',           7, 'Superior incompleto'),
    ('SUPERIOR COMPLETO',             8, 'Superior completo'),
    ('NÃO INFORMADO',              NULL, 'Não informado');
COMMENT ON TABLE escolaridade IS
    'Os 8 graus de escolaridade do TSE em ordem; liga politico_eleicao.ds_grau_instrucao e perfil_eleitorado_munzona.ds_grau_escolaridade.';
