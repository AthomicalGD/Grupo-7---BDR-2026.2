-- Receita de cada candidato a deputado federal no Piauí em 2022, quanto dela veio de repasses públicos
-- (fundo eleitoral + fundo partidário) e se foi eleito. A parcela pública é repasse ÷ receita total; quem não
-- declarou receita fica fora. A tela agrupa por faixas iguais de parcela e por quartis do valor recebido.
SELECT pe.id_politico_eleicao,
       c.fundo_eleitoral + c.fundo_partidario AS publico,
       c.fundo_eleitoral + c.fundo_partidario + c.pessoas_fisicas + c.proprios + c.outros AS total,
       100 * (c.fundo_eleitoral + c.fundo_partidario)
           / NULLIF(c.fundo_eleitoral + c.fundo_partidario + c.pessoas_fisicas + c.proprios + c.outros, 0) AS parcela,
       ma.id_mandato IS NOT NULL AS eleito
FROM campanha c
JOIN politico_eleicao pe ON pe.id_politico_eleicao = c.id_politico_eleicao
JOIN eleicao e           ON e.id_eleicao = pe.id_eleicao
LEFT JOIN municipio m    ON m.cd_municipio = e.cd_municipio
LEFT JOIN mandato ma     ON ma.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.tipo <> 1                              -- sem eleições suplementares
  AND e.ano = 2022
  AND e.cod_cargo = 6                          -- deputado federal
  AND COALESCE(m.cd_uf, e.cd_uf) = 22          -- Piauí
  AND c.fundo_eleitoral + c.fundo_partidario + c.pessoas_fisicas + c.proprios + c.outros > 0;
