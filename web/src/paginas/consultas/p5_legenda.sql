SELECT e.ano, CASE e.cod_cargo WHEN 8 THEN 7 ELSE e.cod_cargo END AS cod_cargo,
       pa.sigla, max(pa.nome) AS nome, ma.ds_situacao, count(*) AS eleitos,
       array_agg(DISTINCT COALESCE(u.sigla, um.sigla)) AS ufs
FROM mandato ma
JOIN politico_eleicao pe ON pe.id_politico_eleicao = ma.id_politico_eleicao
JOIN eleicao e ON e.id_eleicao = ma.id_eleicao
JOIN partido pa ON pa.id_partido = ma.id_partido
LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
LEFT JOIN uf um ON um.cd_ibge = m.cd_uf
LEFT JOIN uf u ON u.cd_ibge = e.cd_uf
WHERE e.ano = ANY(ARRAY[2018, 2020, 2022, 2024, 2026])
  AND e.tipo = 2 AND e.turno = 1 AND e.cod_cargo IN (6, 7, 8, 13)
  AND ma.ds_situacao IN ('ELEITO POR QP', 'ELEITO POR MÉDIA')
GROUP BY e.ano, 2, pa.sigla, ma.ds_situacao;
