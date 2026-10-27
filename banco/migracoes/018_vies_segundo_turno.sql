-- Viés do 2º turno (mapa da P7 com o seletor de turno): a mesma conta de vies_votos_cargo, mas com os votos
-- nominais dos finalistas no 2º turno (presidente, governador e prefeito), pelo partido de cada um. Só há
-- valor onde houve 2º turno; no resto o mapa fica sem dados. Os votos do 2º turno ficam na candidatura do
-- 1º (o partido e o viés vêm dela). Materializada: soma ~1 milhão de linhas de votos por zona.
-- Depois de cada carga: REFRESH MATERIALIZED VIEW vies_votos_cargo_t2 (o loader faz).
CREATE MATERIALIZED VIEW vies_votos_cargo_t2 AS
SELECT z.cd_municipio,
       e.ano,
       e.cod_cargo,
       sum(v.qtd_votos_nominais)                                                  AS votos,
       COALESCE(sum(v.qtd_votos_nominais) FILTER (WHERE o.media IS NOT NULL), 0)  AS votos_com_vies,
       COALESCE(sum(v.qtd_votos_nominais * o.vies), 0)                            AS votos_x_vies,
       COALESCE(sum(v.qtd_votos_nominais) FILTER (WHERE a.score IS NOT NULL), 0)  AS votos_com_alinhamento,
       COALESCE(sum(v.qtd_votos_nominais * a.score), 0)                           AS votos_x_alinhamento
FROM eleicao e
JOIN votacao_candidato_munzona v ON v.id_eleicao = e.id_eleicao
JOIN zona_eleitoral z            ON z.id_zona = v.id_zona
JOIN politico_eleicao pe         ON pe.id_politico_eleicao = v.id_politico_eleicao
JOIN partido p                   ON p.id_partido = pe.id_partido
LEFT JOIN vies_partido_onda o    ON o.ano_eleitoral = e.ano AND o.numero = p.numero AND o.sigla = p.sigla
LEFT JOIN partido_alinhamento a  ON a.ano_eleitoral = e.ano AND a.numero = p.numero AND a.sigla = p.sigla
WHERE e.turno = 2 AND e.tipo <> 1 AND e.cod_cargo IN (1, 3, 11)
GROUP BY z.cd_municipio, e.ano, e.cod_cargo
HAVING sum(v.qtd_votos_nominais) > 0;

CREATE UNIQUE INDEX ON vies_votos_cargo_t2 (cd_municipio, ano, cod_cargo);
