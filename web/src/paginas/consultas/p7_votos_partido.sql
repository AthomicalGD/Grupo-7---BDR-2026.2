-- Na carga (loader): votos válidos de cada partido no município, somando as zonas,
-- no 1º turno das eleições ordinárias.
INSERT INTO votacao_partido_municipio (cd_municipio, id_partido, ano_eleicao, cod_cargo, qt_votos_validos)
SELECT z.cd_municipio, v.id_partido, e.ano, e.cod_cargo,
       sum(v.qt_votos_nominais_validos + v.qt_total_votos_leg_validos)
FROM votacao_partido_munzona v
JOIN zona_eleitoral z ON z.id_zona = v.id_zona
JOIN eleicao e        ON e.id_eleicao = v.id_eleicao
WHERE e.turno = 1 AND e.tipo = 2
GROUP BY 1, 2, 3, 4;
