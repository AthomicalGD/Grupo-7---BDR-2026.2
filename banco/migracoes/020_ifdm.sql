-- P3: Índice Firjan de Desenvolvimento Municipal (IFDM), série histórica revisada de 2013 a 2023 (edição 2025).
-- Preenchida por python -m loader.ifdm a partir da planilha da Firjan baixada à mão em dados/firjan/.
-- O IDHM municipal só existe nos Censos (o mais recente é o de 2010, em indices_municipio); o IFDM é anual e
-- entra no lugar dele nas eleições de 2018 a 2024.
-- A chave é o código IBGE (7 dígitos), sem referência a municipio: a planilha cobre o Brasil inteiro e é carregada
-- uma vez só, antes ou depois das UFs, sem depender de quais estão no banco.
CREATE TABLE ifdm_municipio (
    cd_ibge       integer  NOT NULL,
    ano           smallint NOT NULL,              -- ano-base do índice
    ifdm          numeric(5,4),                   -- 0 a 1; geral, média das três áreas
    emprego_renda numeric(5,4),
    educacao      numeric(5,4),
    saude         numeric(5,4),
    PRIMARY KEY (cd_ibge, ano)
);
