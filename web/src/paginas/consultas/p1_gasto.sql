-- Gasto de cada candidato a deputado federal no Piauí, na época e em reais de outubro de 2024,
-- e se foi eleito. O custo da cadeira é a média do gasto dos eleitos; a prestação de contas soma o
-- gasto de todos e divide pelas cadeiras (scripts/01_custo_cadeira.py).
SELECT e.ano, e.cod_cargo, c.despesa,
       c.despesa * (SELECT indice FROM ipca_outubro WHERE ano = 2024) / i.indice AS despesa_2024,
       ma.id_mandato IS NOT NULL AS eleito
FROM campanha c
JOIN politico_eleicao pe ON pe.id_politico_eleicao = c.id_politico_eleicao
JOIN eleicao e           ON e.id_eleicao = pe.id_eleicao
JOIN ipca_outubro i      ON i.ano = e.ano
LEFT JOIN municipio m    ON m.cd_municipio = e.cd_municipio
LEFT JOIN mandato ma     ON ma.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.tipo <> 1                              -- sem eleições suplementares
  AND e.cod_cargo = 6                          -- deputado federal
  AND COALESCE(m.cd_uf, e.cd_uf) = 22;         -- Piauí
