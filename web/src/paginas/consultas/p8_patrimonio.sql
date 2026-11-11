-- Patrimônio declarado e dinheiro recebido de cada candidato a deputado federal no Piauí em 2022. A tela separa
-- os candidatos em grupos de patrimônio (sem bens, R$ 0 e quartis de quem declarou bens, como na P2) e soma
-- quanto do dinheiro de fundos públicos (fundo eleitoral + partidário) e de toda a receita cada grupo recebeu.
WITH bens AS (
    SELECT id_politico_eleicao, sum(vr_bem_candidato) AS patrimonio
    FROM bem
    GROUP BY 1
)
SELECT pe.id_politico_eleicao, b.patrimonio,
       c.fundo_eleitoral + c.fundo_partidario AS publico,
       c.fundo_eleitoral + c.fundo_partidario + c.pessoas_fisicas + c.proprios + c.outros AS receita
FROM campanha c
JOIN politico_eleicao pe ON pe.id_politico_eleicao = c.id_politico_eleicao
JOIN eleicao e           ON e.id_eleicao = pe.id_eleicao
LEFT JOIN municipio m    ON m.cd_municipio = e.cd_municipio
LEFT JOIN bens b         ON b.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.tipo <> 1                              -- sem eleições suplementares
  AND e.ano = 2022
  AND e.cod_cargo = 6                          -- deputado federal
  AND COALESCE(m.cd_uf, e.cd_uf) = 22          -- Piauí
ORDER BY b.patrimonio DESC NULLS LAST;
