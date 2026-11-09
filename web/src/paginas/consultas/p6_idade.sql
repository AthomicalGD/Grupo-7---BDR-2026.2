-- P6: idade média de quem votou no 1º turno, por município e eleição (o ponto médio de cada faixa do TSE)
SELECT z.cd_municipio, p.ano_eleicao,
       round(sum(p.qtd_comparecimento * f.idade_media) / sum(p.qtd_comparecimento), 1) AS idade_media,
       sum(p.qtd_comparecimento) AS quem_votou
FROM perfil_etario_munzona p
JOIN zona_eleitoral z USING (id_zona)
JOIN faixa_etaria f   USING (cd_faixa)
GROUP BY 1, 2
ORDER BY 1, 2;
