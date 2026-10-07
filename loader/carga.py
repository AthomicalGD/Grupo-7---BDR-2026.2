"""Staging e transformação no PostgreSQL.

Cada UF pendente ganha tabelas temporárias stg_<uf>_<conjunto> com o conteúdo já
limpo dos CSVs. Depois, cada UF é gravada nas tabelas do modelo numa única
transação que termina com o registro em carga_uf: ou a UF entra inteira ou não
entra, e uma UF registrada não é carregada de novo.

Chaves usadas para ligar os arquivos do TSE:
- disputa (ELEICAO): (CD_ELEICAO, NR_TURNO, CD_CARGO, SG_UE);
- candidatura: (CD_ELEICAO, SG_UE, SQ_CANDIDATO). Bens, receitas e despesas usam o
  CD_ELEICAO do 1º turno; a votação do 2º turno usa o do 2º turno, que em vários
  anos é outro código (ex.: 2022, 544 e 545). tmp_candidatura cobre os dois.
"""
import io
import json

import pandas as pd

from . import fontes

TRAVA = 7_202_609  # chave do pg_advisory_lock: impede duas cargas simultâneas no mesmo banco
ELEITOS = ["ELEITO", "ELEITO POR QP", "ELEITO POR MÉDIA", "MÉDIA"]
CANDIDATURA = "k.cd_eleicao = {x}.cd_eleicao AND k.ue = {x}.ue AND k.sq = {x}.sq"
DISPUTA = "t.cd_eleicao = {x}.cd_eleicao AND t.turno = {x}.turno AND t.cod_cargo = {x}.cod_cargo AND t.ue = {x}.ue"


def _cand(x: str) -> str:
    return CANDIDATURA.format(x=x)


def _disp(x: str) -> str:
    return DISPUTA.format(x=x)


# ───────── Controle ─────────

def travar(cur) -> bool:
    cur.execute("SELECT pg_try_advisory_lock(%s)", (TRAVA,))
    return cur.fetchone()[0]


def esquema_ok(cur) -> bool:
    cur.execute("SELECT to_regclass('public.carga_uf') IS NOT NULL")
    return cur.fetchone()[0]


def ufs_carregadas(cur) -> set[str]:
    cur.execute("SELECT sg_uf FROM carga_uf")
    return {r[0] for r in cur.fetchall()}


def registrar(cur, uf: str, resumo: dict) -> None:
    cur.execute("INSERT INTO carga_uf (sg_uf, linhas) VALUES (%s, %s)", (uf, json.dumps(resumo)))


# ───────── Staging ─────────

def copiar(cur, tabela: str, df: pd.DataFrame) -> None:
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False)
    buf.seek(0)
    cur.copy_expert(f"COPY {tabela} ({', '.join(df.columns)}) FROM STDIN WITH (FORMAT csv)", buf)


def _stg(uf: str, conjunto: str) -> str:
    return f"stg_{uf.lower()}_{conjunto}"


def preparar_referencias(cur, municipios: pd.DataFrame, indices: pd.DataFrame) -> None:
    """UFs (todas) e tabelas temporárias com a correspondência de municípios e os indicadores."""
    ufs = municipios[["cd_uf", "sg_uf"]].drop_duplicates()
    cur.executemany("INSERT INTO uf (cd_ibge, sigla) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    [(int(c), s) for c, s in ufs.itertuples(index=False)])
    cur.execute("CREATE TEMP TABLE stg_municipio (sg_uf text, cd_uf smallint, cd_municipio integer,"
                " nm_municipio text, cd_ibge integer)")
    copiar(cur, "stg_municipio", municipios.drop_duplicates("cd_municipio"))
    cur.execute("CREATE TEMP TABLE stg_indices (cd_ibge integer, ano smallint, idhm numeric, pib numeric,"
                " mediana_idade numeric, indice_envelhecimento numeric, populacao bigint)")
    copiar(cur, "stg_indices", indices)
    cur.execute("ANALYZE stg_municipio; ANALYZE stg_indices")


def criar_staging(cur, ufs: list[str]) -> None:
    for uf in ufs:
        for c in fontes.CONJUNTOS:
            colunas = ", ".join(f"{nome} {fontes.TIPOS_SQL[tipo]}" for nome, tipo in c.estrutura)
            cur.execute(f"CREATE TEMP TABLE {_stg(uf, c.nome)} ({colunas})")


def gravar_staging(cur, conjunto: fontes.Conjunto, bloco: pd.DataFrame) -> None:
    colunas = [nome for nome, _ in conjunto.estrutura]
    for uf, parte in bloco.groupby("sg_uf"):
        copiar(cur, _stg(uf, conjunto.nome), parte[colunas])


def analisar_staging(cur, ufs: list[str]) -> None:
    for uf in ufs:
        for c in fontes.CONJUNTOS:
            cur.execute(f"ANALYZE {_stg(uf, c.nome)}")


def descartar_staging(cur, uf: str) -> None:
    for c in fontes.CONJUNTOS:
        cur.execute(f"DROP TABLE IF EXISTS {_stg(uf, c.nome)}")


# ───────── Transformação de uma UF ─────────

class _Execucao:
    def __init__(self, cur, uf: str, cd_uf: int | None):
        self.cur = cur
        self.s = f"stg_{uf.lower()}_"
        self.params = {"uf": uf, "cd_uf": cd_uf, "eleitos": ELEITOS}
        self.inseridas: dict[str, int] = {}
        self.descartadas: dict[str, int] = {}

    def sql(self, comando: str, tabela: str | None = None, **extra) -> None:
        self.cur.execute(comando.replace("{s}", self.s), {**self.params, **extra})
        if tabela:
            self.inseridas[tabela] = self.inseridas.get(tabela, 0) + max(self.cur.rowcount, 0)

    def contar(self, comando: str) -> int:
        self.cur.execute(comando.replace("{s}", self.s), self.params)
        return self.cur.fetchone()[0]


def carregar_uf(cur, uf: str, cd_uf: int | None) -> dict:
    """Grava a UF nas tabelas do modelo. Não faz commit. `cd_uf` é None para 'BR'."""
    x = _Execucao(cur, uf, cd_uf)
    if cd_uf is not None:
        _municipios(x)
    _disputas(x)
    _politicos(x)
    _candidaturas(x)
    _votacao(x)
    _contas(x)
    if cd_uf is not None:
        x.sql("""
            INSERT INTO indices_municipio (cd_municipio, ano, idhm, pib, mediana_idade, indice_envelhecimento, populacao)
            SELECT m.cd_municipio, i.ano, i.idhm, i.pib, i.mediana_idade, i.indice_envelhecimento, i.populacao
            FROM stg_indices i JOIN municipio m ON m.cd_ibge = i.cd_ibge
            WHERE m.cd_uf = %(cd_uf)s
            ON CONFLICT DO NOTHING""", "indices_municipio")
    return {"inseridas": x.inseridas, "descartadas": {k: v for k, v in x.descartadas.items() if v}}


def _municipios(x: _Execucao) -> None:
    x.sql("""
        INSERT INTO municipio (cd_municipio, nm_municipio, cd_ibge, cd_uf)
        SELECT cd_municipio, nm_municipio, cd_ibge, cd_uf FROM stg_municipio WHERE sg_uf = %(uf)s
        ON CONFLICT (cd_municipio) DO NOTHING""", "municipio")
    # Municípios citados pelo TSE e ausentes da correspondência TSE x IBGE (ex.: extintos).
    x.sql("""
        INSERT INTO municipio (cd_municipio, nm_municipio, cd_uf)
        SELECT DISTINCT ON (cd) cd, COALESCE(nome, 'MUNICÍPIO ' || cd), %(cd_uf)s
        FROM (
            SELECT DISTINCT CASE WHEN ue ~ '^[0-9]+$' THEN ue::int END AS cd, nm_ue AS nome FROM {s}candidato
            UNION SELECT DISTINCT CASE WHEN ue ~ '^[0-9]+$' THEN ue::int END, nm_ue FROM {s}vagas
            UNION SELECT DISTINCT cd_municipio, nm_municipio FROM {s}votacao_candidato
            UNION SELECT DISTINCT cd_municipio, nm_municipio FROM {s}votacao_partido
            UNION SELECT DISTINCT cd_municipio, nm_municipio FROM {s}detalhe
            UNION SELECT DISTINCT cd_municipio, nm_municipio FROM {s}perfil
        ) m
        WHERE cd IS NOT NULL
        ORDER BY cd, nome NULLS LAST
        ON CONFLICT (cd_municipio) DO NOTHING""", "municipio")


def _disputas(x: _Execucao) -> None:
    corrida = "cd_eleicao, ano, turno, tipo, ds_eleicao, cod_cargo, ds_cargo, ue"
    x.sql(f"""
        CREATE TEMP TABLE tmp_corrida ON COMMIT DROP AS
        SELECT DISTINCT {corrida} FROM {{s}}candidato
        UNION SELECT DISTINCT {corrida} FROM {{s}}votacao_candidato
        UNION SELECT DISTINCT {corrida} FROM {{s}}votacao_partido
        UNION SELECT DISTINCT {corrida} FROM {{s}}detalhe""")
    x.sql("""
        INSERT INTO cargo (cod_cargo, ds_cargo, nome)
        SELECT DISTINCT ON (cod_cargo) cod_cargo, ds_cargo, upper(ds_cargo)
        FROM tmp_corrida WHERE cod_cargo IS NOT NULL AND ds_cargo IS NOT NULL
        ORDER BY cod_cargo, ds_cargo
        ON CONFLICT (cod_cargo) DO NOTHING""", "cargo")
    x.sql("""
        INSERT INTO eleicao (cd_eleicao, ano, turno, tipo, ds_eleicao, cod_cargo, cd_uf, cd_municipio)
        SELECT DISTINCT ON (c.cd_eleicao, c.turno, c.cod_cargo, c.ue)
               c.cd_eleicao, c.ano, c.turno, c.tipo, c.ds_eleicao, c.cod_cargo,
               uf.cd_ibge, CASE WHEN c.ue ~ '^[0-9]+$' THEN c.ue::int END
        FROM tmp_corrida c
        JOIN cargo USING (cod_cargo)
        LEFT JOIN uf ON uf.sigla = c.ue
        LEFT JOIN municipio m ON m.cd_municipio = CASE WHEN c.ue ~ '^[0-9]+$' THEN c.ue::int END
        WHERE c.cd_eleicao IS NOT NULL AND c.ano IS NOT NULL AND c.turno IN (1, 2) AND c.tipo IS NOT NULL
          AND (c.ue = 'BR' OR uf.cd_ibge IS NOT NULL OR m.cd_municipio IS NOT NULL)
        ORDER BY c.cd_eleicao, c.turno, c.cod_cargo, c.ue, c.ds_eleicao
        ON CONFLICT DO NOTHING""", "eleicao")
    _tmp_eleicao(x)
    x.sql("""
        UPDATE eleicao e SET quantidade_de_vagas = v.qt
        FROM (SELECT cd_eleicao, cod_cargo, ue, max(qt_vaga) AS qt FROM {s}vagas GROUP BY 1, 2, 3) v
        JOIN tmp_eleicao t ON t.cd_eleicao = v.cd_eleicao AND t.cod_cargo = v.cod_cargo AND t.ue = v.ue
        WHERE e.id_eleicao = t.id_eleicao""")
    # O arquivo de vagas só traz o código do 1º turno; o 2º turno herda.
    x.sql("""
        UPDATE eleicao e2 SET quantidade_de_vagas = e1.quantidade_de_vagas
        FROM tmp_eleicao t2
        JOIN tmp_eleicao t1 ON t1.ano = t2.ano AND t1.tipo = t2.tipo AND t1.cod_cargo = t2.cod_cargo
                           AND t1.ue = t2.ue AND t1.turno = 1
        JOIN eleicao e1 ON e1.id_eleicao = t1.id_eleicao
        WHERE t2.turno = 2 AND e2.id_eleicao = t2.id_eleicao
          AND e2.quantidade_de_vagas IS NULL AND e1.quantidade_de_vagas IS NOT NULL""")
    x.sql("""
        INSERT INTO partido (numero, sigla, nome)
        SELECT DISTINCT ON (nr_partido, sg_partido) nr_partido, sg_partido, nm_partido
        FROM (SELECT DISTINCT nr_partido, sg_partido, nm_partido FROM {s}candidato
              UNION SELECT DISTINCT nr_partido, sg_partido, nm_partido FROM {s}votacao_partido) p
        WHERE nr_partido IS NOT NULL AND sg_partido IS NOT NULL
        ORDER BY nr_partido, sg_partido, nm_partido NULLS LAST
        ON CONFLICT (numero, sigla) DO NOTHING""", "partido")


def _tmp_eleicao(x: _Execucao) -> None:
    """Disputas da UF (e as nacionais), com a unidade eleitoral no formato do staging."""
    x.sql("""
        CREATE TEMP TABLE tmp_eleicao ON COMMIT DROP AS
        SELECT e.id_eleicao, e.cd_eleicao, e.ano, e.turno, e.tipo, e.cod_cargo,
               COALESCE(e.cd_municipio::text, uf.sigla::text, 'BR') AS ue
        FROM eleicao e
        LEFT JOIN uf ON uf.cd_ibge = e.cd_uf
        LEFT JOIN municipio m ON m.cd_municipio = e.cd_municipio
        WHERE COALESCE(m.cd_uf, e.cd_uf) = %(cd_uf)s OR (e.cd_uf IS NULL AND e.cd_municipio IS NULL);
        CREATE INDEX ON tmp_eleicao (cd_eleicao, turno, cod_cargo, ue);
        ANALYZE tmp_eleicao""")


def _politicos(x: _Execucao) -> None:
    """Identifica cada pessoa: título eleitoral, senão CPF, senão nome + data de nascimento.

    As pessoas com a chave mais confiável entram primeiro; assim quem aparece sem
    título num ano antigo ainda pode ser ligado a quem acabou de entrar com título.
    """
    x.sql("""
        CREATE TEMP TABLE tmp_pessoa ON COMMIT DROP AS
        SELECT DISTINCT ON (chave) chave, titulo, cpf, nome, dt_nascimento, grau, ano,
               NULL::bigint AS id_politico, false AS novo
        FROM {s}candidato
        ORDER BY chave, ano DESC, grau IS NULL, turno;
        CREATE INDEX ON tmp_pessoa (chave);
        ANALYZE tmp_pessoa""")
    reconhecer = [
        """UPDATE tmp_pessoa p SET id_politico = po.id_politico FROM politico po
           WHERE p.id_politico IS NULL AND p.titulo IS NOT NULL AND po.nr_titulo_eleitoral = p.titulo""",
        """UPDATE tmp_pessoa p SET id_politico = po.id_politico FROM politico po
           WHERE p.id_politico IS NULL AND p.cpf IS NOT NULL AND po.cpf = p.cpf
             AND (p.titulo IS NULL OR po.nr_titulo_eleitoral IS NULL)""",
        """UPDATE tmp_pessoa p SET id_politico = po.id_politico FROM politico po
           WHERE p.id_politico IS NULL AND p.dt_nascimento IS NOT NULL
             AND po.nome = p.nome AND po.dt_nascimento = p.dt_nascimento
             AND (p.titulo IS NULL OR po.nr_titulo_eleitoral IS NULL)
             AND (p.cpf IS NULL OR po.cpf IS NULL OR po.cpf = p.cpf)""",
    ]
    for fase in ("T", "C", "N", "S"):  # título, CPF, nome + nascimento, sem identificação
        for comando in reconhecer:
            x.sql(comando)
        x.sql("""
            UPDATE tmp_pessoa SET id_politico = nextval(pg_get_serial_sequence('politico', 'id_politico')), novo = true
            WHERE id_politico IS NULL AND left(chave, 1) = %(fase)s""", fase=fase)
        x.sql("""
            INSERT INTO politico (id_politico, cpf, nr_titulo_eleitoral, nome, ds_grau_de_instrucao,
                                  dt_nascimento, ano_ultima_candidatura)
            SELECT id_politico, cpf, titulo, nome, grau, dt_nascimento, ano
            FROM tmp_pessoa WHERE novo AND left(chave, 1) = %(fase)s""", "politico", fase=fase)
    # Quem já existia: completa documentos e atualiza nome/escolaridade se a candidatura for mais recente.
    x.sql("""
        UPDATE politico po SET
            nr_titulo_eleitoral = COALESCE(po.nr_titulo_eleitoral,
                CASE WHEN NOT EXISTS (SELECT 1 FROM politico o WHERE o.nr_titulo_eleitoral = u.titulo) THEN u.titulo END),
            cpf = COALESCE(po.cpf, u.cpf),
            dt_nascimento = COALESCE(po.dt_nascimento, u.dt_nascimento),
            nome = CASE WHEN u.ano > po.ano_ultima_candidatura THEN u.nome ELSE po.nome END,
            ds_grau_de_instrucao = CASE WHEN u.ano > po.ano_ultima_candidatura
                                        THEN COALESCE(u.grau, po.ds_grau_de_instrucao)
                                        ELSE COALESCE(po.ds_grau_de_instrucao, u.grau) END,
            ano_ultima_candidatura = GREATEST(po.ano_ultima_candidatura, u.ano)
        FROM (SELECT id_politico, max(titulo) AS titulo, max(cpf) AS cpf, max(dt_nascimento) AS dt_nascimento,
                     max(ano) AS ano, (array_agg(nome ORDER BY ano DESC))[1] AS nome,
                     (array_agg(grau ORDER BY ano DESC) FILTER (WHERE grau IS NOT NULL))[1] AS grau
              FROM tmp_pessoa WHERE NOT novo GROUP BY id_politico) u
        WHERE po.id_politico = u.id_politico""")


def _candidaturas(x: _Execucao) -> None:
    x.sql(f"""
        INSERT INTO politico_eleicao (sq_candidato, id_politico, id_eleicao)
        SELECT DISTINCT ON (t.id_eleicao, c.sq) c.sq, p.id_politico, t.id_eleicao
        FROM {{s}}candidato c
        JOIN tmp_pessoa p ON p.chave = c.chave
        JOIN tmp_eleicao t ON {_disp('c')}
        WHERE c.turno = 1
        ORDER BY t.id_eleicao, c.sq
        ON CONFLICT (id_eleicao, sq_candidato) DO NOTHING""", "politico_eleicao")
    partidos_das_candidaturas(x)
    # (código da eleição, UE, SQ) -> candidatura, tanto com o código do 1º turno quanto com o do 2º.
    x.sql("""
        CREATE TEMP TABLE tmp_candidatura ON COMMIT DROP AS
        SELECT DISTINCT ON (cd_eleicao, ue, sq) cd_eleicao, ue, sq, id_politico_eleicao
        FROM (SELECT t1.cd_eleicao, t1.ue, pe.sq_candidato AS sq, pe.id_politico_eleicao, 0 AS prioridade
              FROM politico_eleicao pe JOIN tmp_eleicao t1 ON t1.id_eleicao = pe.id_eleicao
              UNION ALL
              SELECT t2.cd_eleicao, t2.ue, pe.sq_candidato, pe.id_politico_eleicao, 1
              FROM politico_eleicao pe
              JOIN tmp_eleicao t1 ON t1.id_eleicao = pe.id_eleicao
              JOIN tmp_eleicao t2 ON t2.turno = 2 AND t2.ano = t1.ano AND t2.tipo = t1.tipo
                                 AND t2.cod_cargo = t1.cod_cargo AND t2.ue = t1.ue) c
        ORDER BY cd_eleicao, ue, sq, prioridade;
        CREATE INDEX ON tmp_candidatura (cd_eleicao, ue, sq);
        ANALYZE tmp_candidatura""")
    x.sql(f"""
        INSERT INTO mandato (id_politico_eleicao, id_partido, id_eleicao, ds_situacao)
        SELECT DISTINCT ON (k.id_politico_eleicao) k.id_politico_eleicao, pa.id_partido, t.id_eleicao, c.situacao
        FROM {{s}}candidato c
        JOIN tmp_eleicao t ON {_disp('c')}
        JOIN tmp_candidatura k ON {_cand('c')}
        JOIN partido pa ON pa.numero = c.nr_partido AND pa.sigla = c.sg_partido
        WHERE c.situacao = ANY(%(eleitos)s)
        ORDER BY k.id_politico_eleicao, c.turno DESC
        ON CONFLICT (id_politico_eleicao) DO NOTHING""", "mandato")


def partidos_das_candidaturas(x: _Execucao) -> None:
    """Partido pelo qual cada candidatura concorreu (o de mandato só cobre os eleitos)."""
    x.sql(f"""
        UPDATE politico_eleicao pe SET id_partido = pa.id_partido
        FROM {{s}}candidato c
        JOIN tmp_eleicao t ON {_disp('c')}
        JOIN partido pa ON pa.numero = c.nr_partido AND pa.sigla = c.sg_partido
        WHERE c.turno = 1 AND pe.id_eleicao = t.id_eleicao AND pe.sq_candidato = c.sq
          AND pe.id_partido IS DISTINCT FROM pa.id_partido""")


def atualizar_resumos(cur) -> None:
    """Views materializadas que dependem da carga (migrações 011 e 012)."""
    cur.execute("REFRESH MATERIALIZED VIEW campanha; REFRESH MATERIALIZED VIEW despesa_por_eleicao; "
                "REFRESH MATERIALIZED VIEW votos_candidato_uf")


def _votacao(x: _Execucao) -> None:
    x.sql("""
        INSERT INTO zona_eleitoral (cd_municipio, numero)
        SELECT DISTINCT z.cd_municipio, z.nr_zona
        FROM (SELECT DISTINCT cd_municipio, nr_zona FROM {s}votacao_candidato
              UNION SELECT DISTINCT cd_municipio, nr_zona FROM {s}votacao_partido
              UNION SELECT DISTINCT cd_municipio, nr_zona FROM {s}detalhe
              UNION SELECT DISTINCT cd_municipio, nr_zona FROM {s}perfil) z
        JOIN municipio m ON m.cd_municipio = z.cd_municipio
        WHERE z.nr_zona IS NOT NULL
        ON CONFLICT (cd_municipio, numero) DO NOTHING""", "zona_eleitoral")
    x.sql("""
        CREATE TEMP TABLE tmp_zona ON COMMIT DROP AS
        SELECT z.id_zona, z.cd_municipio, z.numero
        FROM zona_eleitoral z JOIN municipio m USING (cd_municipio)
        WHERE m.cd_uf = %(cd_uf)s;
        CREATE INDEX ON tmp_zona (cd_municipio, numero);
        ANALYZE tmp_zona""")
    zona = "z.cd_municipio = v.cd_municipio AND z.numero = v.nr_zona"
    x.sql(f"""
        INSERT INTO votacao_candidato_munzona (id_eleicao, id_zona, id_politico_eleicao, qtd_votos_nominais)
        SELECT t.id_eleicao, z.id_zona, k.id_politico_eleicao, COALESCE(sum(v.qt_votos), 0)
        FROM {{s}}votacao_candidato v
        JOIN tmp_eleicao t ON {_disp('v')}
        JOIN tmp_zona z ON {zona}
        JOIN tmp_candidatura k ON {_cand('v')}
        GROUP BY 1, 2, 3""", "votacao_candidato_munzona")
    x.descartadas["votacao_candidato_munzona_sem_candidatura"] = x.contar(f"""
        SELECT count(*) FROM {{s}}votacao_candidato v
        WHERE NOT EXISTS (SELECT 1 FROM tmp_candidatura k WHERE {_cand('v')})""")
    x.sql(f"""
        INSERT INTO votacao_partido_munzona (id_eleicao, id_zona, id_partido, qt_votos_legenda_validos,
                                             qt_total_votos_leg_validos, qt_votos_nominais_validos)
        SELECT t.id_eleicao, z.id_zona, pa.id_partido,
               COALESCE(sum(v.qt_legenda), 0), COALESCE(sum(v.qt_total_legenda), 0), COALESCE(sum(v.qt_nominais), 0)
        FROM {{s}}votacao_partido v
        JOIN tmp_eleicao t ON {_disp('v')}
        JOIN tmp_zona z ON {zona}
        JOIN partido pa ON pa.numero = v.nr_partido AND pa.sigla = v.sg_partido
        GROUP BY 1, 2, 3""", "votacao_partido_munzona")
    x.sql(f"""
        INSERT INTO perfil_eleitorado_munzona (id_zona, ano_eleicao, ds_grau_escolaridade,
                                               qtd_eleitores, qtd_comparecimento)
        SELECT z.id_zona, v.ano, v.grau, COALESCE(sum(v.qt_aptos), 0), COALESCE(sum(v.qt_comparecimento), 0)
        FROM {{s}}perfil v
        JOIN tmp_zona z ON {zona}
        WHERE v.ano IS NOT NULL AND v.grau IS NOT NULL
        GROUP BY 1, 2, 3""", "perfil_eleitorado_munzona")
    x.sql(f"""
        INSERT INTO votacao_municipio (id_eleicao, cd_municipio, qt_aptos, qt_comparecimento,
                                       qt_brancos, qt_nulos, qt_abstencoes)
        SELECT t.id_eleicao, v.cd_municipio, COALESCE(sum(v.qt_aptos), 0), COALESCE(sum(v.qt_comparecimento), 0),
               COALESCE(sum(v.qt_brancos), 0), COALESCE(sum(v.qt_nulos), 0), COALESCE(sum(v.qt_abstencoes), 0)
        FROM {{s}}detalhe v
        JOIN tmp_eleicao t ON {_disp('v')}
        JOIN municipio m ON m.cd_municipio = v.cd_municipio
        GROUP BY 1, 2""", "votacao_municipio")
    x.sql("""
        INSERT INTO votacao_partido_municipio (cd_municipio, id_partido, ano_eleicao, cod_cargo, qt_votos_validos)
        SELECT z.cd_municipio, v.id_partido, e.ano, e.cod_cargo,
               sum(v.qt_votos_nominais_validos + v.qt_total_votos_leg_validos)
        FROM votacao_partido_munzona v
        JOIN tmp_zona z ON z.id_zona = v.id_zona
        JOIN eleicao e ON e.id_eleicao = v.id_eleicao
        WHERE e.turno = 1 AND e.tipo = 2
        GROUP BY 1, 2, 3, 4""", "votacao_partido_municipio")


def _contas(x: _Execucao) -> None:
    x.sql(f"""
        INSERT INTO bem (id_politico_eleicao, vr_bem_candidato)
        SELECT k.id_politico_eleicao, v.vr
        FROM {{s}}bem v JOIN tmp_candidatura k ON {_cand('v')}
        WHERE v.vr IS NOT NULL""", "bem")
    x.sql(f"""
        INSERT INTO receita_de_campanha (sq_receita, id_politico_eleicao, vr_receita, ds_receita,
                                         ds_fonte_receita, ds_origem_receita)
        SELECT v.sq_receita, k.id_politico_eleicao, v.vr, v.ds_receita, v.ds_fonte, v.ds_origem
        FROM {{s}}receita v JOIN tmp_candidatura k ON {_cand('v')}
        WHERE v.vr IS NOT NULL""", "receita_de_campanha")
    x.sql("""
        INSERT INTO fornecedor (cpf_cnpj_fornecedor, nm_fornecedor, ds_cnae_fornecedor)
        SELECT DISTINCT ON (doc) doc, nm_fornecedor, cnae
        FROM {s}despesa WHERE doc IS NOT NULL
        ORDER BY doc, cnae IS NULL, nm_fornecedor IS NULL
        ON CONFLICT (cpf_cnpj_fornecedor) DO NOTHING""", "fornecedor")
    x.sql(f"""
        INSERT INTO despesa_de_campanha (sq_despesa, id_politico_eleicao, numero_fornecedor, ds_despesa,
                                         ds_origem_despesa, vr_despesa_contratada)
        SELECT v.sq_despesa, k.id_politico_eleicao, f.numero, v.ds_despesa, v.ds_origem, v.vr
        FROM {{s}}despesa v
        JOIN tmp_candidatura k ON {_cand('v')}
        LEFT JOIN fornecedor f ON f.cpf_cnpj_fornecedor = v.doc
        WHERE v.vr IS NOT NULL""", "despesa_de_campanha")
    for tabela in ("bem", "receita", "despesa"):
        x.descartadas[f"{tabela}_sem_candidatura"] = x.contar(f"""
            SELECT count(*) FROM {{s}}{tabela} v
            WHERE NOT EXISTS (SELECT 1 FROM tmp_candidatura k WHERE {_cand('v')})""")
