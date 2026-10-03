-- UFs já carregadas pelo loader (python -m loader). Cada UF entra numa única
-- transação, então a linha só existe se a carga da UF terminou. "BR" guarda as
-- candidaturas nacionais (Presidente), carregadas junto com a primeira UF.

CREATE TABLE carga_uf (
    sg_uf        char(2)     PRIMARY KEY,
    carregada_em timestamptz NOT NULL DEFAULT now(),
    linhas       jsonb       NOT NULL                  -- linhas inseridas por tabela
);
