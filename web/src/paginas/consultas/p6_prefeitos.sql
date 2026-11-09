-- P6: os prefeitos eleitos em cada eleição ordinária (1996 a 2024), com o partido: a base das passagens de mandato
SELECT e.cd_municipio, e.ano, pe.id_politico, p.nome, pa.sigla AS partido, pa.numero
FROM mandato m
JOIN eleicao e           ON e.id_eleicao = m.id_eleicao
JOIN politico_eleicao pe ON pe.id_politico_eleicao = m.id_politico_eleicao
JOIN politico p          ON p.id_politico = pe.id_politico
JOIN partido pa          ON pa.id_partido = m.id_partido
WHERE e.cod_cargo = 11 AND e.tipo = 2      -- prefeito, eleições ordinárias
ORDER BY e.cd_municipio, e.ano;
