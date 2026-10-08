-- Chance de ser eleito por grau de escolaridade, ano e cargo.
SELECT e.ano, c.nome AS cargo, es.nivel, es.rotulo AS escolaridade,
       count(*)            AS candidatos,
       count(m.id_mandato) AS eleitos,
       round(100.0 * count(m.id_mandato) / count(*), 1) AS chance
FROM politico_eleicao pe
JOIN eleicao e       USING (id_eleicao)
JOIN cargo c         USING (cod_cargo)
JOIN escolaridade es ON es.ds_grau = pe.ds_grau_instrucao
LEFT JOIN mandato m  USING (id_politico_eleicao)
WHERE e.ano IN (2022, 2024) AND e.tipo = 2
  AND e.cod_cargo IN (3, 5, 6, 7, 11, 13)      -- titulares, sem vices e suplentes
  AND pe.ds_sit_tot_turno IS NOT NULL         -- candidatura apta
  AND es.nivel IS NOT NULL
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3;
