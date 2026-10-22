-- Viés de cada município do Piauí em cada ano. Em cada cargo: Σ (votos × viés do partido naquela eleição)
-- ÷ Σ votos dos partidos com viés; depois, a média dos cargos com peso igual. A view vies_votos_cargo
-- (migração 006) já traz as somas por município, ano e cargo.
WITH por_cargo AS (
  SELECT v.cd_municipio, v.ano, v.cod_cargo, v.votos, v.votos_com_vies,
         v.votos_x_vies / NULLIF(v.votos_com_vies, 0) AS vies
  FROM vies_votos_cargo v
)
SELECT m.nm_municipio, c.ano,
       avg(c.vies)                                        AS vies,
       100.0 * sum(c.votos_com_vies) / sum(c.votos)       AS cobertura_pct,
       count(*)                                           AS cargos
FROM por_cargo c
JOIN municipio m ON m.cd_municipio = c.cd_municipio
WHERE m.cd_uf = 22
GROUP BY 1, 2
ORDER BY 1, 2;
