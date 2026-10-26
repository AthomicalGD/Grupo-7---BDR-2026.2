-- P12: o que muda no 2º turno. Cada disputa que teve 2º turno (de 2018 em diante, quando há votos por zona)
-- é ligada ao 1º turno da mesma disputa (mesmo ano, cargo e lugar). Cada linha é um candidato do 1º turno,
-- com os votos nos dois turnos: no 2º, só os dois finalistas têm votos. Os votos de 2º turno ficam na mesma
-- candidatura do 1º (politico_eleicao), então o crescimento de cada finalista é votos_t2 / votos_t1 - 1.
WITH disputa AS (
    SELECT e2.id_eleicao AS id_t2, e1.id_eleicao AS id_t1, e2.ano, c.nome AS cargo,
           COALESCE(u.sigla, um.sigla) AS uf, m.nm_municipio AS municipio
    FROM eleicao e2
    JOIN eleicao e1 ON e1.ano = e2.ano AND e1.tipo = e2.tipo AND e1.cod_cargo = e2.cod_cargo AND e1.turno = 1
                   AND e1.cd_uf IS NOT DISTINCT FROM e2.cd_uf
                   AND e1.cd_municipio IS NOT DISTINCT FROM e2.cd_municipio
    JOIN cargo c          ON c.cod_cargo = e2.cod_cargo
    LEFT JOIN uf u        ON u.cd_ibge = e2.cd_uf
    LEFT JOIN municipio m ON m.cd_municipio = e2.cd_municipio
    LEFT JOIN uf um       ON um.cd_ibge = m.cd_uf
    WHERE e2.turno = 2 AND e2.tipo <> 1 AND e2.ano >= 2018
      AND e2.cod_cargo IN (1, 3, 11)   -- presidente, governador e prefeito; os vices vão na chapa
),
votos AS (
    SELECT d.id_t2, v.id_politico_eleicao,
           sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = d.id_t1) AS votos_t1,
           sum(v.qtd_votos_nominais) FILTER (WHERE v.id_eleicao = d.id_t2) AS votos_t2
    FROM disputa d
    JOIN votacao_candidato_munzona v ON v.id_eleicao IN (d.id_t1, d.id_t2)
    GROUP BY d.id_t2, v.id_politico_eleicao
)
SELECT d.ano, d.cargo, d.uf, d.municipio, p.nome, pa.sigla AS partido, v.votos_t1, v.votos_t2,
       -- parte nos votos nominais do 1º turno (todos os candidatos) e na disputa a dois do 2º
       round(100.0 * v.votos_t1 / sum(v.votos_t1) OVER (PARTITION BY d.id_t2), 1) AS pct_t1,
       round(100.0 * v.votos_t2 / sum(v.votos_t2) OVER (PARTITION BY d.id_t2), 1) AS pct_t2,
       rank() OVER (PARTITION BY d.id_t2 ORDER BY v.votos_t1 DESC NULLS LAST) AS posicao_t1,
       rank() OVER (PARTITION BY d.id_t2 ORDER BY v.votos_t2 DESC NULLS LAST) AS posicao_t2
FROM disputa d
JOIN votos v            ON v.id_t2 = d.id_t2
JOIN politico_eleicao pe ON pe.id_politico_eleicao = v.id_politico_eleicao
JOIN politico p          ON p.id_politico = pe.id_politico
LEFT JOIN partido pa     ON pa.id_partido = pe.id_partido
ORDER BY d.ano, d.cargo, d.uf, d.municipio, v.votos_t1 DESC;
-- Virada: quem venceu o 2º turno (posicao_t2 = 1) não liderou o 1º (posicao_t1 > 1).
-- Comparecimento, brancos, nulos e abstenções de cada turno vêm de votacao_municipio (somados na disputa).
