-- Santinhos: o número que se digita na urna e o nome de urna ("WELLINGTON DIAS", não o nome civil)
-- de cada candidatura. O loader grava nas cargas novas; para o que já estava carregado:
-- python -m loader.partidos
ALTER TABLE politico_eleicao ADD COLUMN nr_candidato integer;
ALTER TABLE politico_eleicao ADD COLUMN nm_urna text;
COMMENT ON COLUMN politico_eleicao.nr_candidato IS 'Número do candidato na urna (NR_CANDIDATO).';
COMMENT ON COLUMN politico_eleicao.nm_urna IS 'Nome de urna (NM_URNA_CANDIDATO).';
