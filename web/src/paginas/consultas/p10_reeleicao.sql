-- Taxa de reeleição (versão resumida de scripts/10a_taxa_reeleicao.py, que também liga
-- pelo nome quem não tem título eleitoral): dos eleitos, quantos voltaram a disputar o
-- mesmo cargo no mesmo lugar na eleição seguinte (senador, 8 anos depois) e quantos venceram.
WITH cand AS (
    SELECT pe.id_politico, e.ano, e.cod_cargo,
           COALESCE(e.cd_municipio, -e.cd_uf) AS unidade,
           bool_or(ma.id_mandato IS NOT NULL) AS eleito
    FROM politico_eleicao pe
    JOIN eleicao e       ON e.id_eleicao = pe.id_eleicao
    LEFT JOIN mandato ma ON ma.id_politico_eleicao = pe.id_politico_eleicao
    WHERE e.tipo <> 1
    GROUP BY 1, 2, 3, 4
)
SELECT a.cod_cargo, a.ano AS eleito_em,
       count(*)                         AS eleitos,
       count(b.id_politico)             AS tentaram,
       count(*) FILTER (WHERE b.eleito) AS reeleitos
FROM cand a
LEFT JOIN cand b ON b.id_politico = a.id_politico AND b.cod_cargo = a.cod_cargo
                AND b.unidade = a.unidade
                AND b.ano = a.ano + CASE WHEN a.cod_cargo = 5 THEN 8 ELSE 4 END
WHERE a.eleito
GROUP BY 1, 2
ORDER BY 1, 2;
