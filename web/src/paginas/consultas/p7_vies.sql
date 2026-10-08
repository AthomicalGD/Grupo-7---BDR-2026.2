-- Viés de cada município do Piauí em cada ano: Σ (votos × viés do partido) ÷ Σ votos.
SELECT m.nm_municipio, v.ano_eleicao AS ano,
       sum(v.qt_votos_validos * p.vies_politico) / sum(v.qt_votos_validos) AS vies,
       sum(v.qt_votos_validos) FILTER (WHERE p.vies_politico = 0) AS votos_sem_vies
FROM votacao_partido_municipio v
JOIN partido p   ON p.id_partido = v.id_partido
JOIN municipio m ON m.cd_municipio = v.cd_municipio
WHERE m.cd_uf = 22 AND v.ano_eleicao IN (2018, 2020, 2022, 2024)
GROUP BY 1, 2
HAVING sum(v.qt_votos_validos) > 0
ORDER BY 1, 2;
