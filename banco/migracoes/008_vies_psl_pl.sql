-- O PSL passa a herdar o viés do PL, e não o do UNIÃO (007_vies_partidos_sucedidos.sql).

UPDATE partido SET vies_politico = (SELECT vies_politico FROM partido WHERE numero = 22 AND sigla = 'PL')
WHERE numero = 17 AND sigla = 'PSL';
