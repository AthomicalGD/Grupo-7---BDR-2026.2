-- Gasto e votos de cada candidatura (trecho da view campanha, migração 011).
-- A doação de uma campanha para outra sai da conta: reaparece como despesa de quem recebeu.
SELECT pe.id_politico_eleicao,
       COALESCE(d.despesa, 0) AS despesa,
       COALESCE(v.votos, 0)   AS votos
FROM politico_eleicao pe
LEFT JOIN (
    SELECT id_politico_eleicao, sum(vr_despesa_contratada) AS despesa
    FROM despesa_de_campanha
    WHERE ds_origem_despesa IS DISTINCT FROM 'Doações financeiras a outros candidatos/partidos'
    GROUP BY 1
) d USING (id_politico_eleicao)
LEFT JOIN (
    SELECT v.id_politico_eleicao, sum(v.qtd_votos_nominais) AS votos
    FROM votacao_candidato_munzona v
    JOIN eleicao e ON e.id_eleicao = v.id_eleicao
    WHERE e.turno = 1
    GROUP BY 1
) v USING (id_politico_eleicao);
