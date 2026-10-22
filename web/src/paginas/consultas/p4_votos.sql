-- Em 2022 deputado é eleito pelo estado: por município, a parte dos votos nominais
-- para deputado dados a candidatos com superior completo.
SELECT z.cd_municipio,
       100.0 * sum(v.qtd_votos_nominais) FILTER (WHERE es.nivel = 8)
             / sum(v.qtd_votos_nominais) AS votos_em_superior
FROM votacao_candidato_munzona v
JOIN eleicao e           USING (id_eleicao)
JOIN zona_eleitoral z    USING (id_zona)
JOIN politico_eleicao pe USING (id_politico_eleicao)
JOIN escolaridade es     ON es.ds_grau = pe.ds_grau_instrucao
WHERE e.ano = 2022 AND e.turno = 1 AND e.tipo = 2
  AND e.cod_cargo IN (6, 7)                    -- deputados federal e estadual
  AND es.nivel IS NOT NULL
GROUP BY 1;
