-- Por município, em 2024: % com superior completo de quem compareceu, dos candidatos
-- e dos eleitos a prefeito e vereador. Sobre estas linhas o script forma os quintos
-- e calcula as correlações de Pearson e de Spearman.
WITH votou AS (
    SELECT z.cd_municipio,
           100.0 * sum(p.qtd_comparecimento) FILTER (WHERE es.nivel = 8)
                 / sum(p.qtd_comparecimento) AS superior_votou
    FROM perfil_eleitorado_munzona p
    JOIN zona_eleitoral z USING (id_zona)
    JOIN escolaridade es  ON es.ds_grau = p.ds_grau_escolaridade
    WHERE p.ano_eleicao = 2024 AND es.nivel IS NOT NULL
    GROUP BY 1
),
disputa AS (
    SELECT e.cd_municipio,
           100.0 * avg((es.nivel = 8)::int) AS superior_candidatos,
           100.0 * avg((es.nivel = 8)::int)
                 FILTER (WHERE m.id_mandato IS NOT NULL) AS superior_eleitos
    FROM politico_eleicao pe
    JOIN eleicao e       USING (id_eleicao)
    JOIN escolaridade es ON es.ds_grau = pe.ds_grau_instrucao
    LEFT JOIN mandato m  USING (id_politico_eleicao)
    WHERE e.ano = 2024 AND e.tipo = 2 AND e.cod_cargo IN (11, 13)
      AND pe.ds_sit_tot_turno IS NOT NULL AND es.nivel IS NOT NULL
    GROUP BY 1
)
SELECT mu.nm_municipio, votou.superior_votou,
       disputa.superior_candidatos, disputa.superior_eleitos
FROM votou
JOIN disputa       USING (cd_municipio)
JOIN municipio mu  USING (cd_municipio);
