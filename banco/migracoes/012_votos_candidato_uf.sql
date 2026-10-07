-- P7 (de onde vem o viés de um estado): votos nominais de cada candidatura somados por UF e ano,
-- no 1º turno das eleições ordinárias (o mesmo recorte de votacao_partido_municipio). Somar zona por
-- zona na hora levava segundos nos estados grandes; aqui é uma leitura por índice.
-- O loader atualiza esta view ao fim de cada carga (carga.atualizar_resumos).
CREATE MATERIALIZED VIEW votos_candidato_uf AS
SELECT v.id_politico_eleicao, m.cd_uf, e.ano, sum(v.qtd_votos_nominais) AS votos
FROM votacao_candidato_munzona v
JOIN eleicao e        ON e.id_eleicao = v.id_eleicao
JOIN zona_eleitoral z ON z.id_zona = v.id_zona
JOIN municipio m      ON m.cd_municipio = z.cd_municipio
WHERE e.turno = 1 AND e.tipo = 2
GROUP BY 1, 2, 3
HAVING sum(v.qtd_votos_nominais) > 0;
CREATE INDEX ON votos_candidato_uf (cd_uf, ano);
