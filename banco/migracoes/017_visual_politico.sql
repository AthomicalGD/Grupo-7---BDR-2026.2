-- A roupa do bonequinho de cada político ("político contra político"): o que alguém vestiu no armário fica
-- salvo e volta na próxima visita, para todos. É brincadeira de quem vê: não diz nada sobre o político.
-- As peças são as do armário (web/src/comparar/pecas.ts); a API confere o formato antes de gravar.
CREATE TABLE politico_visual (
    id_politico   bigint      PRIMARY KEY REFERENCES politico ON DELETE CASCADE,
    visual        jsonb       NOT NULL CHECK (jsonb_typeof(visual) = 'object'),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE politico_visual IS 'Roupa, acessórios e dança do bonequinho de cada político, como foram salvos no armário.';
