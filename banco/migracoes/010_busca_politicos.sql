-- Busca de políticos pelo nome na API, sem diferenciar acentos e tolerante a erros de
-- digitação: trigramas (pg_trgm) sobre o nome sem acentos.
--
-- unaccent() é só STABLE (depende do dicionário em search_path) e não pode entrar num
-- índice; f_unaccent fixa o dicionário e se declara IMMUTABLE.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    RETURN public.unaccent('public.unaccent', $1);

CREATE INDEX politico_nome_trgm ON politico USING gin (f_unaccent(upper(nome)) gin_trgm_ops);
