-- Gênero do político (DS_GENERO do TSE), para o bonequinho do "político contra político".
--
-- Fica no político, não na candidatura: é o declarado na candidatura mais recente que o informa.
-- Só MASCULINO e FEMININO; "NÃO INFORMADO" (1998) e "NÃO DIVULGÁVEL" (2024) viram nulo.
-- O loader grava nas cargas novas; para o que já estava carregado: python -m loader.partidos
ALTER TABLE politico ADD COLUMN ds_genero text CHECK (ds_genero IN ('MASCULINO', 'FEMININO'));
COMMENT ON COLUMN politico.ds_genero IS
    'Gênero declarado ao TSE (DS_GENERO) na candidatura mais recente que o informa; nulo quando não informado.';
