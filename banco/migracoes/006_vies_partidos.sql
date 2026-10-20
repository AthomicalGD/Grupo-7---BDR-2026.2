-- Viés ideológico (artigo) e alinhamento na Câmara (SVD) dos partidos, por eleição.
--
-- Substitui as antigas 006 a 009, que gravavam números fixos de -100 a +100 vindos do SVD da Câmara
-- (apresentados como se fossem do artigo), usavam 0 para "não informado" e copiavam valores de sucessores
-- à mão. Aqui só se criam as estruturas; quem as preenche é `python -m loader.vies`, a partir de:
--   dados/ideologia_partidos/df_experts.csv      notas dos especialistas (0 = extrema esquerda, 10 = extrema direita)
--   banco/referencia/sucessao_partidos.csv       renomeações e fusões
--   banco/referencia/svd/svd_eleicao_<ano>.csv   alinhamento dos partidos nas votações da Câmara
--
-- Escalas:
--   viés         média do artigo de 0 a 10; na API e na web, (média - 5) * 20, de -100 a +100. A conta é exata
--                porque 0 e 10 são os extremos do questionário.
--   alinhamento  1º componente do SVD sobre deputado x votação, de -100 a +100. Mede o lado de cada partido nas
--                votações do Plenário, o que acompanha a coalizão de governo; NÃO é a mesma coisa que o viés.
-- Sem valor = NULL (nunca 0). A chave do partido é (numero, sigla): o TSE reaproveita números e siglas.

COMMENT ON COLUMN partido.vies_politico IS
    'Viés de -100 (esquerda) a +100 (direita): (média do artigo - 5) * 20, da eleição mais recente do partido '
    'entre 2018 e 2024 (vies_partido_onda). NULL = sem valor. Preenchido por python -m loader.vies.';

-- Que fonte vale em cada eleição. A onda do artigo nunca é posterior à eleição, exceto 2024, que usa a onda
-- de 2022 (os autores desaconselham estender a onda no tempo: a interface avisa). A janela do SVD termina
-- antes da eleição, para não olhar o futuro. `cargos` são os cargos somados, cada um com o mesmo peso.
CREATE TABLE eleicao_referencia (
    ano_eleitoral    smallint   PRIMARY KEY,
    data_1o_turno    date       NOT NULL,
    onda_artigo      smallint   NOT NULL CHECK (onda_artigo IN (2018, 2022)),
    onda_estendida   boolean    NOT NULL,          -- a onda é anterior à eleição anterior (2024 com a onda 2022)
    janela_svd       text       NOT NULL,          -- nome do arquivo banco/referencia/svd/svd_<janela>.csv
    svd_inicio       date       NOT NULL,
    svd_fim          date       NOT NULL,
    cargos           smallint[] NOT NULL,          -- CD_CARGO do TSE; vices, suplentes e o cargo 25 ficam de fora
    observacao       text,
    CHECK (svd_inicio < svd_fim AND svd_fim < data_1o_turno)
);

INSERT INTO eleicao_referencia VALUES
    (2018, '2018-10-07', 2018, false, 'eleicao_2018', '2016-08-31', '2018-07-31', '{1,3,5,6,7,8}',
     'governo Temer; presidente, governador, senador, deputados federal, estadual e distrital'),
    (2020, '2020-11-15', 2018, false, 'eleicao_2020', '2019-02-01', '2020-11-14', '{11,13}',
     '56ª legislatura; prefeito e vereador'),
    (2022, '2022-10-02', 2022, false, 'eleicao_2022', '2019-02-01', '2022-07-31', '{1,3,5,6,7,8}',
     '56ª legislatura; presidente, governador, senador, deputados federal, estadual e distrital'),
    (2024, '2024-10-06', 2022, true,  'eleicao_2024', '2023-02-01', '2024-10-05', '{11,13}',
     '57ª legislatura; prefeito e vereador; onda 2022 estendida por dois anos');

-- Viés de cada partido em cada eleição, já com as regras de sucessão. `origem` diz de onde veio o número:
-- "direto", "renomeado de X", "média de X e Y (fusão de AAAA)" ou "sem valor".
CREATE TABLE vies_partido_onda (
    ano_eleitoral smallint     NOT NULL REFERENCES eleicao_referencia,
    numero        smallint     NOT NULL,
    sigla         varchar(30)  NOT NULL,
    onda          smallint     NOT NULL,
    media         numeric(6,4) CHECK (media BETWEEN 0 AND 10),
    vies          numeric GENERATED ALWAYS AS ((media - 5) * 20) STORED,
    origem        text         NOT NULL,
    PRIMARY KEY (ano_eleitoral, numero, sigla)
);
COMMENT ON TABLE vies_partido_onda IS
    'Viés do partido (numero, sigla) na eleição: média dos especialistas da onda (0 a 10) e (média - 5) * 20.';

-- Alinhamento de cada partido em cada eleição (SVD da Câmara), com as mesmas regras de sucessão.
CREATE TABLE partido_alinhamento (
    ano_eleitoral smallint     NOT NULL REFERENCES eleicao_referencia,
    numero        smallint     NOT NULL,
    sigla         varchar(30)  NOT NULL,
    janela_svd    text         NOT NULL,
    score         numeric(5,1) CHECK (score BETWEEN -100 AND 100),
    alinh_governo numeric(4,3) CHECK (alinh_governo BETWEEN 0 AND 1),  -- fração dos votos iguais à orientação do Governo
    n_deputados   integer,
    origem        text         NOT NULL,
    PRIMARY KEY (ano_eleitoral, numero, sigla)
);
COMMENT ON TABLE partido_alinhamento IS
    'Posição do partido nas votações do Plenário (SVD), de -100 a +100. Acompanha a coalizão de governo, não a ideologia.';

-- Base comum do viés de qualquer recorte (scripts/07_vies_politico_municipio.py e a API): votos válidos
-- (nominais + legenda, 1º turno das eleições ordinárias) por município, eleição e cargo, com o viés e o
-- alinhamento de cada partido NAQUELA eleição. Partido sem valor entra em `votos` e fica fora das somas
-- ponderadas. Viés de um recorte num ano = média, com peso igual por cargo, de
-- sum(votos_x_vies) / sum(votos_com_vies) de cada cargo; o mesmo para o alinhamento.
CREATE VIEW vies_votos_cargo AS
SELECT v.cd_municipio,
       v.ano_eleicao                                                              AS ano,
       v.cod_cargo,
       sum(v.qt_votos_validos)                                                    AS votos,
       COALESCE(sum(v.qt_votos_validos) FILTER (WHERE o.media IS NOT NULL), 0)    AS votos_com_vies,
       COALESCE(sum(v.qt_votos_validos * o.vies), 0)                              AS votos_x_vies,
       COALESCE(sum(v.qt_votos_validos) FILTER (WHERE a.score IS NOT NULL), 0)    AS votos_com_alinhamento,
       COALESCE(sum(v.qt_votos_validos * a.score), 0)                             AS votos_x_alinhamento
FROM votacao_partido_municipio v
JOIN eleicao_referencia r  ON r.ano_eleitoral = v.ano_eleicao AND v.cod_cargo = ANY (r.cargos)
JOIN partido p             ON p.id_partido = v.id_partido
LEFT JOIN vies_partido_onda o
       ON o.ano_eleitoral = v.ano_eleicao AND o.numero = p.numero AND o.sigla = p.sigla
LEFT JOIN partido_alinhamento a
       ON a.ano_eleitoral = v.ano_eleicao AND a.numero = p.numero AND a.sigla = p.sigla
GROUP BY v.cd_municipio, v.ano_eleicao, v.cod_cargo
HAVING sum(v.qt_votos_validos) > 0;
