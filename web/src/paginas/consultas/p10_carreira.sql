-- A carreira de um político (versão resumida da consulta da API): cada candidatura
-- com cargo, lugar, partido, número e nome de urna, resultado, gasto e votos.
SELECT e.ano, c.nome AS cargo,
       COALESCE(m.nm_municipio, u.sigla, 'BRASIL') AS lugar,
       pa.sigla AS partido, pe.nr_candidato AS numero, pe.nm_urna AS nome_urna,
       COALESCE(ma.ds_situacao, 'NÃO ELEITO') AS situacao,
       cp.despesa AS gasto, cp.votos
FROM politico_eleicao pe
JOIN eleicao e        ON e.id_eleicao = pe.id_eleicao
JOIN cargo c          ON c.cod_cargo = e.cod_cargo
LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
LEFT JOIN uf u        ON u.cd_ibge = e.cd_uf
LEFT JOIN mandato ma  ON ma.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN partido pa  ON pa.id_partido = COALESCE(pe.id_partido, ma.id_partido)
LEFT JOIN campanha cp ON cp.id_politico_eleicao = pe.id_politico_eleicao
WHERE pe.id_politico = 368990                  -- Wellington Dias
ORDER BY e.ano;
