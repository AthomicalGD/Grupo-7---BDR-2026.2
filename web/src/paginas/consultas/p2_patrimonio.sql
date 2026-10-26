-- Patrimônio declarado de cada candidato a deputado federal no Piauí em 2022 e se foi eleito
-- (a API faz a mesma consulta para qualquer cargo, ano e estado). Sem linha em `bem` não vira zero:
-- quem não declarou nada fica fora da fila. Depois, em Python, os candidatos são cortados em quartos.
WITH bens AS (
    SELECT id_politico_eleicao, sum(vr_bem_candidato)::double precision AS patrimonio
    FROM bem
    GROUP BY id_politico_eleicao
)
SELECT e.ano, e.cod_cargo, b.patrimonio, ma.id_mandato IS NOT NULL AS eleito
FROM politico_eleicao pe
JOIN eleicao e        ON e.id_eleicao = pe.id_eleicao
LEFT JOIN uf u        ON u.cd_ibge = e.cd_uf
LEFT JOIN bens b      ON b.id_politico_eleicao = pe.id_politico_eleicao
LEFT JOIN mandato ma  ON ma.id_politico_eleicao = pe.id_politico_eleicao
WHERE e.ano = 2022 AND e.tipo = 2 AND e.turno = 1     -- eleição ordinária, 1º turno
  AND e.cod_cargo = 6                                -- deputado federal
  AND pe.ds_sit_tot_turno IS NOT NULL                -- candidatura que foi a voto
  AND u.sigla = 'PI';
