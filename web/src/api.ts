// Contrato da API (api/app.py) e as consultas do TanStack Query.
import { queryOptions } from '@tanstack/react-query'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export const ANOS = [2018, 2020, 2022, 2024] as const
export type Ano = (typeof ANOS)[number]
export type PorAno<T> = Partial<Record<string, T>>

export interface UF {
  sigla: string
  cd_ibge: number
  nome: string
  regiao: string
  municipios: number
  carregada: boolean
  /** Viés ideológico (artigo de especialistas), −100 a +100. */
  vies: PorAno<number>
  /** Alinhamento nas votações da Câmara (SVD), −100 a +100: segue a coalizão de governo, não é o viés. */
  alinhamento: PorAno<number>
}

export interface MunicipioResumo {
  ibge: number
  nome: string
  regiao: string
  vies: PorAno<number>
  alinhamento: PorAno<number>
  aptos: PorAno<number>
}

export interface UFDetalhe extends Omit<UF, 'municipios'> {
  /** % dos votos válidos em partidos sem viés (ficam fora da média). */
  sem_vies_pct: PorAno<number>
  sem_alinhamento_pct: PorAno<number>
  regioes: { nome: string; vies: PorAno<number> }[]
  municipios: MunicipioResumo[]
}

/** De onde vem o viés de uma UF num ano: partidos (com os candidatos mais votados) e quanto puxam a média. */
export interface ComposicaoVies {
  uf: string
  ano: number
  votos: number
  vies: number | null
  partidos: {
    sigla: string
    nome: string | null
    /** viés do partido naquela eleição; null = sem viés (fica fora da média, contribuição 0) */
    vies: number | null
    votos: number
    pct: number
    /** pontos que o partido soma ao viés do estado (a soma de todos dá o viés) */
    contribuicao: number
    nominais: number
    legenda: number
    candidatos_total: number
    candidatos: { id: number; nome: string; cargo: string; local: string | null; votos: number; eleito: boolean; foto: string | null }[]
  }[]
}

export interface MunicipioBusca {
  ibge: number
  nome: string
  uf: string
  carregada: boolean
}

export interface Partido {
  sigla: string
  nome: string | null
  numero: number
  /** viés do partido naquela eleição; null = sem viés */
  vies: number | null
  votos: number
  pct: number
}

export interface Indicador {
  valor: number | null
  ano: number
}

export interface Comparecimento {
  aptos: number
  comparecimento: number
  brancos: number
  nulos: number
  abstencoes: number
  isentos_pct: number | null
}

export interface Prefeito {
  ano: number
  nome: string
  id_politico: number
  partido: string
  turno: number
  foto: string | null
}

export interface Municipio {
  ibge: number
  nome: string
  uf: string
  uf_nome: string
  regiao_intermediaria: string
  regiao_imediata: string
  carregada: boolean
  vies: PorAno<number>
  vies_uf: PorAno<number>
  sem_vies_pct: PorAno<number>
  alinhamento: PorAno<number>
  alinhamento_uf: PorAno<number>
  espectro: PorAno<Partido[]>
  indicadores: Partial<Record<'pib_per_capita' | 'idhm' | 'populacao' | 'eleitores_populacao' | 'isentos', Indicador | null>>
  comparecimento: PorAno<Comparecimento>
  prefeitos: Prefeito[]
  /** P1: custo da cadeira de prefeito e de vereador no município (2020 e 2024). */
  cadeiras: (ResumoCadeira & { ano: number; cod_cargo: number; cargo: string; fator_ipca: number })[]
}

export interface PoliticoBusca {
  id: number
  nome: string
  nascimento_ano: number | null
  ufs: string[]
  primeiro_ano: number
  ultimo_ano: number
  candidaturas: number
  vitorias: number
  foto: string | null
}

/** Filtros da busca: descrevem uma candidatura ("senador, 2022, PI, PT, eleito"). */
export interface FiltrosBusca {
  cargo?: number
  /** ano da eleição (no endereço, `eleicao`: `ano` já é o ano do mapa) */
  eleicao?: number
  uf?: string
  partido?: string
  resultado?: 'eleito' | 'nao_eleito'
}
export const filtrando = (f: FiltrosBusca) => Object.values(f).some((v) => v != null && v !== '')

/** Ordem da lista de políticos (`ordem` em /api/politicos). Não é filtro: sozinha não dispara a busca. */
export const ORDENS_BUSCA = [
  { valor: 'relevancia', rotulo: 'Relevância' },
  { valor: 'nome', rotulo: 'Nome' },
  { valor: 'eleicao', rotulo: 'Mais recente' },
  { valor: 'cargo', rotulo: 'Cargo mais alto' },
] as const
export type OrdemBusca = (typeof ORDENS_BUSCA)[number]['valor']

export const CARGOS_BUSCA = [
  { cod: 1, nome: 'presidente' },
  { cod: 3, nome: 'governador' },
  { cod: 5, nome: 'senador' },
  { cod: 6, nome: 'deputado federal' },
  { cod: 7, nome: 'deputado estadual' },
  { cod: 11, nome: 'prefeito' },
  { cod: 13, nome: 'vereador' },
] as const
/** Teto de `limite` em /api/politicos (Query(le=50) em api/app.py). */
export const LIMITE_BUSCA = 50

export const ANOS_ELEICAO = [2024, 2022, 2020, 2018, 2016, 2014, 2012, 2010, 2008, 2006, 2004, 2002, 2000, 1998, 1996, 1994] as const

export interface Candidatura {
  ano: number
  cargo: string
  cod_cargo: number
  local: string
  uf: string | null
  municipio_ibge: number | null
  partido: string | null
  /** viés do partido (escala da P7): a cor do santinho */
  vies: number | null
  /** número na urna e nome de urna, como no santinho */
  numero: number | null
  nome_urna: string | null
  situacao: string
  eleito: boolean
  reeleito: boolean
  turno: number | null
  votos: number | null
  /** Despesa contratada da campanha (P1); null antes de 2018. */
  gasto: number | null
  /** id_politico_eleicao: abre a nuvem de gastos da campanha (P9) */
  id_candidatura: number
  suplementar: boolean
  foto: string | null
}

export interface Politico {
  id: number
  nome: string
  nascimento_ano: number | null
  /** gênero declarado ao TSE (migração 015); null quando não informado */
  genero: 'masculino' | 'feminino' | null
  foto: string | null
  ufs: string[]
  candidaturas: Candidatura[]
  resumo: {
    candidaturas: number
    vitorias: number
    derrotas: number
    reeleicoes: number
    primeiro_ano: number | null
    ultimo_ano: number | null
  }
  /** P10a: taxa de reeleição do cargo mais recente na UF (null sem dados suficientes). */
  contexto_reeleicao: { cargo: string; uf: string; tentaram: number; reeleitos: number; taxa: number } | null
}

// ───────── P1: quanto custa uma cadeira ─────────

export const CARGOS_P1 = [
  { cod: 6, nome: 'Deputado federal', curto: 'Dep. federal', municipal: false },
  { cod: 7, nome: 'Deputado estadual', curto: 'Dep. estadual', municipal: false },
  { cod: 5, nome: 'Senador', curto: 'Senador', municipal: false },
  { cod: 3, nome: 'Governador', curto: 'Governador', municipal: false },
  { cod: 11, nome: 'Prefeito', curto: 'Prefeito', municipal: true },
  { cod: 13, nome: 'Vereador', curto: 'Vereador', municipal: true },
] as const
export type CodCargoP1 = (typeof CARGOS_P1)[number]['cod']

export interface ResumoCadeira {
  candidatos: number
  cadeiras: number
  gasto_total: number
  /** Gasto médio dos eleitos. */
  custo_cadeira: number | null
  /** Gasto de todos os candidatos ÷ cadeiras (o da prestação de contas). */
  gasto_por_cadeira: number | null
  mediana_eleito: number | null
  mediana_nao_eleito: number | null
}

/** As zonas eleitorais de um município num ano: eleitorado, comparecimento e o mais votado (prefeito ou presidente). */
export interface Zonas {
  ano: number
  cargo: string
  zonas: {
    numero: number
    aptos: number | null
    foram: number | null
    /** de quem foi votar, quantos têm superior completo */
    superior: number | null
    id_politico: number | null
    nm_urna: string | null
    sigla: string | null
    votos: number | null
    total: number | null
  }[]
}

export interface Assento {
  id: number
  nome: string
  partido: string | null
  vies: number | null
  uf: string
  local: string | null
  gasto: number
  votos: number
  foto: string | null
}

export interface Cadeira {
  ano: number
  cargo: { cod: CodCargoP1; nome: string }
  escopo: { ufs: string[]; municipio: { ibge: number; nome: string } | null }
  /** Fator do IPCA de outubro para reais de out/2024, por ano. */
  ipca: Record<string, number>
  resumo: ResumoCadeira
  anos: Record<string, ResumoCadeira>
  cadeiras: Assento[]
  partidos: { sigla: string; numero: number | null; vies: number | null; candidatos: number; cadeiras: number; gasto: number }[]
  curva: { de: number; ate: number; candidatos: number; eleitos: number }[]
  despesas: { categoria: string; valor: number }[]
  receitas: Record<'fundo_eleitoral' | 'fundo_partidario' | 'pessoas_fisicas' | 'proprios' | 'outros', number>
}

// ───────── P2: patrimônio declarado e taxa de eleição ─────────

/** O DF não tem eleição municipal: nos recortes de prefeito e vereador ele não é um estado escolhível. */
export const semMunicipal = (ufs: UF[], municipal: boolean) => (municipal ? ufs.filter((u) => u.sigla !== 'DF') : ufs)

export const CARGOS_P2 = [
  { cod: 1, nome: 'Presidente', municipal: false, nacional: true },
  { cod: 3, nome: 'Governador', municipal: false, nacional: false },
  { cod: 5, nome: 'Senador', municipal: false, nacional: false },
  { cod: 6, nome: 'Deputado federal', municipal: false, nacional: false },
  { cod: 7, nome: 'Deputado estadual', municipal: false, nacional: false },
  { cod: 11, nome: 'Prefeito', municipal: true, nacional: false },
  { cod: 13, nome: 'Vereador', municipal: true, nacional: false },
] as const

export interface GrupoPatrimonio {
  id: string
  rotulo: string
  tipo: 'sem_bens' | 'zero' | 'quartil' | 'faixa'
  de: number | null
  ate: number | null
  /** o candidato do meio do grupo */
  mediana: number | null
  candidatos: number
  eleitos: number
  taxa: number
}

export interface Patrimonio {
  ano: number
  cargo: { cod: number; nome: string }
  escopo: { uf: string | null; ufs: string[]; nacional: boolean }
  resumo: { candidatos: number; eleitos: number; sem_bens: number; zero_declarado: number; com_bens: number; cobertura_pct: number }
  grupos: GrupoPatrimonio[]
  /** a fila dos que declararam bens em 100 passos: o valor de quem está em cada 1% (do menor ao maior) */
  fila: number[]
  sintese: { quartis: number; maior_supera_menor: boolean; diferenca_pp: number | null }
}

/** Uma candidatura de 2018 a 2024 (P9), com o gasto total da prestação de contas. */
export interface CandidaturaGasto {
  id: number
  id_politico: number
  nome: string
  nome_urna: string | null
  ano: number
  cargo: string
  cod_cargo: number
  local: string
  uf: string
  partido: string | null
  vies: number | null
  eleito: boolean
  foto: string | null
  gasto?: number | null
}

/** Um tipo de gasto da nuvem (scripts/09_nuvem_despesas.py). */
export interface TipoGasto {
  rotulo: string
  valor: number
  quantidade: number
  inferidas: number
  propaganda: boolean
  fornecedores: { nome: string; valor: number; quantidade: number }[]
  n_fornecedores: number
  origens: string[]
  descricoes: string[]
}

export interface Gastos {
  candidatura: CandidaturaGasto
  total: number
  despesas: number
  zeradas: number
  sem_fornecedor: number
  cobertura: { fonte: string; quantidade: number; valor: number }[]
  propaganda: { valor: number; pct: number }
  tipos: TipoGasto[]
}

/** A P2 em todos os cargos e anos de uma vez (Presidente sempre nacional). */
export interface PanoramaPatrimonio {
  uf: string | null
  recortes: {
    ano: Ano
    cargo: { cod: number; nome: string }
    nacional: boolean
    candidatos: number
    eleitos: number
    cobertura_pct: number
    grupos: Pick<GrupoPatrimonio, 'id' | 'tipo' | 'taxa' | 'candidatos' | 'eleitos' | 'mediana'>[]
    sintese: Patrimonio['sintese']
  }[]
  com_quartis: number
  maior_supera: number
}

// ───────── P10a: taxa de reeleição ─────────

/** Dos eleitos, quantos tentaram a reeleição (mesmo cargo e lugar, eleição seguinte) e quantos voltaram. */
export interface ContaReeleicao {
  eleitos: number
  tentaram: number
  reeleitos: number
  /** reeleitos ÷ tentaram, em %; nulo quando ninguém tentou */
  taxa: number | null
  /** prefeito e vereador: média simples das taxas dos municípios em que alguém tentou */
  media_municipios: number | null
}

export interface Reeleicao {
  uf: string
  nome: string
  cargos: {
    cod: number
    nome: string
    municipal: boolean
    /** um por eleição de origem: eleitos em `eleitos_em`, disputa em `disputa` (senador: 8 anos depois) */
    ciclos: (ContaReeleicao & { eleitos_em: number; disputa: number })[]
    total: ContaReeleicao
  }[]
  /** prefeito e vereador somados */
  municipais: Omit<ContaReeleicao, 'media_municipios'> | null
  /** eleições cuja seguinte ainda não está no banco */
  fora: { cod: number; cargo: string; eleitos_em: number }[]
  /** tentativas achadas pelo nome ou nascimento (eleito sem título em 1994-1996) */
  ligados_por_nome: number
}

/** P10a: os eleitos de um cargo e ciclo, num dos três destinos da eleição seguinte. */
export type GrupoReeleicao = 'voltaram' | 'perderam' | 'nao'
export interface PessoasReeleicao {
  uf: string
  cargo: number
  eleitos_em: number
  disputa: number
  grupo: GrupoReeleicao
  contagem: Record<GrupoReeleicao, number>
  total: number
  pessoas: { id: number; uf: string; nome: string; nome_urna: string | null; partido: string | null; vies: number | null; municipio: string | null; votos: number | null; foto: string | null }[]
}

export type Malha = FeatureCollection<Polygon | MultiPolygon, { codarea: number }>

export class ErroApi extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

/** P4: os 8 graus do TSE, de 1 (analfabeto) a 8 (superior completo); vetores com 8 posições. */
export interface Escola {
  ano: 2022 | 2024
  /** a UF filtrada, ou nulo para todas as carregadas */
  uf: string | null
  ufs: string[]
  /** como o lugar é medido: eleitos do município (2024) ou o voto para deputado (2022) */
  medida: 'eleitos' | 'votados'
  niveis: { nivel: number; rotulo: string }[]
  /** comparecimento do 1º turno por grau, nas UFs carregadas */
  votantes: number[]
  cargos: { cod: number; nome: string; candidatos: number[]; eleitos: number[] }[]
  quintis: (QuintilEscola & { q: number })[]
  todos: QuintilEscola
  correlacao: number | null
  /** correlação do índice de exploração colonial com a escolaridade, município a município (questão extra) */
  colonial: { municipios: number; votantes: number | null; candidatos: number | null; eleitos?: number | null; votados?: number | null }
}

/** Médias dos municípios do grupo: % com superior completo de quem votou, dos candidatos, dos eleitos e dos votos. */
export interface QuintilEscola {
  municipios: number
  de: number
  ate: number
  votantes: number | null
  candidatos: number | null
  eleitos: number | null
  votados: number | null
}

export interface EleitoEscola {
  id: number
  nome: string
  nome_urna: string | null
  cargo: number
  partido: string | null
  vies: number | null
  nivel: number | null
  foto: string | null
}

export interface EscolaLugar {
  ibge: number
  nome: string
  uf: string
  ano: 2022 | 2024
  votantes: number[]
  votados: number[]
  eleitos: EleitoEscola[]
  quintil: number | null
  pct: { votantes: number | null; candidatos: number | null; eleitos: number | null; votados: number | null }
}

/** Um município no recorte da P4: % com superior completo de cada grupo (de 0 a 100). */
export interface MunicipioEscola {
  ibge: number
  nome: string
  uf: string
  comparecimento: number
  /** quantos se elegeram no município (2024: prefeito e vereadores) */
  eleitos_n: number | null
  quintil: number
  votantes: number
  candidatos: number | null
  eleitos: number | null
  votados: number | null
  /** a questão extra: exploração colonial (0 a 100) = metade economia (o ciclo mais forte, 0 a 1) e metade trabalho
   *  escravizado (1872 levado a 1819, 0 a 1); os ciclos: açúcar, mineração, gado e Norte */
  colonial: { indice: number; economia: number; escravidao: number; ciclos: [number, number, number, number] } | null
}

export interface PartidoEscola {
  sigla: string
  nome: string
  vies: number | null
  candidatos: number
  candidatos_superior: number
  eleitos: number
  eleitos_superior: number
}

/** 2022 e 2024 lado a lado: por ano e UF, quem votou e, por cargo, candidatos e eleitos (8 graus). */
export interface EscolaComparar {
  ufs: { sigla: string; nome: string }[]
  cargos: Record<string, { cod: number; nome: string }[]>
  anos: Record<string, Record<string, { votantes: number[]; cargos: Record<string, { candidatos: number[]; eleitos: number[] }> }>>
}

export const ANOS_ESCOLA = [2022, 2024] as const

async function get<T>(caminho: string, signal?: AbortSignal): Promise<T> {
  let r: Response
  try {
    r = await fetch(caminho, { signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ErroApi(0, 'A API não respondeu. Suba-a com: python -m uvicorn api.app:app --port 8000')
  }
  if (!r.ok) {
    const corpo = await r.json().catch(() => null)
    throw new ErroApi(r.status, corpo?.detail ?? `Erro ${r.status} em ${caminho}`)
  }
  return r.json()
}

/** Um cargo do filtro do atlas (#10) e os anos em que foi disputado. */
export interface CargoVies {
  cod: number
  nome: string
  anos: Ano[]
  municipal: boolean
}

/** Os candidatos de um partido no estado (#11): página e busca pelo nome. */
export interface CandidatosPartido {
  partido: string
  total: number
  achados: number
  desde: number
  candidatos: ComposicaoVies['partidos'][number]['candidatos']
}

// ───────── P12: o que muda no 2º turno ─────────

export interface Finalista {
  id_candidatura: number
  id_politico: number
  nome: string
  nome_urna: string | null
  partido: string | null
  vies: number | null
  foto: string | null
  votos_t1: number
  votos_t2: number
  /** parte nos votos nominais do 1º turno (entre todos os candidatos) e do 2º (entre os dois) */
  pct_t1: number
  pct_t2: number
  /** votos do 2º turno sobre os do 1º, em % */
  crescimento: number | null
  lider_t1: boolean
  venceu: boolean
}
export interface Comparecimento { aptos: number; comparecimento: number; brancos: number; nulos: number; abstencoes: number }
export interface SegundoTurno {
  id: number
  ano: number
  cod_cargo: number
  cargo: string
  uf: string | null
  municipio: string | null
  municipio_ibge: number | null
  /** quem venceu o 2º turno não liderou o 1º */
  virada: boolean
  /** o vencedor primeiro */
  finalistas: [Finalista, Finalista]
  eliminados: { candidatos: number; votos: number }
  turnos: { t1: Comparecimento | null; t2: Comparecimento | null }
}
/** a disputa pelo território: a = vencedor, b = derrotado (votos de cada um em cada lugar e turno) */
export interface LugarSegundoTurno { codigo: string; nome: string; a1: number; b1: number; outros1: number; a2: number; b2: number; virou: boolean }
export interface SegundoTurnoLugares { disputa: SegundoTurno; nivel: 'uf' | 'municipio' | 'zona'; lugares: LugarSegundoTurno[] }

const sempre = { staleTime: Infinity, gcTime: 30 * 60_000 } // os dados só mudam com uma nova carga
/** "?cargo=1" (ou "&cargo=1"), ou nada quando são todos os cargos */
const comCargo = (cargo: number | undefined, sep: '?' | '&') => (cargo ? `${sep}cargo=${cargo}` : '')

const GERAIS: Ano[] = [2018, 2022]
const MUNICIPAIS: Ano[] = [2020, 2024]
/** Os cargos de /api/vies/cargos, para mostrar antes da resposta chegar. */
const CARGOS_PADRAO: CargoVies[] = [
  { cod: 1, nome: 'Presidente', anos: GERAIS, municipal: false },
  { cod: 3, nome: 'Governador', anos: GERAIS, municipal: false },
  { cod: 5, nome: 'Senador', anos: GERAIS, municipal: false },
  { cod: 6, nome: 'Deputado federal', anos: GERAIS, municipal: false },
  { cod: 7, nome: 'Deputado estadual', anos: GERAIS, municipal: false },
  { cod: 11, nome: 'Prefeito', anos: MUNICIPAIS, municipal: true },
  { cod: 13, nome: 'Vereador', anos: MUNICIPAIS, municipal: true },
]

export const consultas = {
  ufs: (cargo?: number) =>
    queryOptions({ queryKey: ['ufs', cargo ?? null], queryFn: ({ signal }) => get<UF[]>(`/api/ufs${comCargo(cargo, '?')}`, signal), ...sempre }),
  uf: (sigla: string, cargo?: number) =>
    queryOptions({ queryKey: ['uf', sigla, cargo ?? null], queryFn: ({ signal }) => get<UFDetalhe>(`/api/ufs/${sigla}${comCargo(cargo, '?')}`, signal), ...sempre }),
  // a lista quase nunca muda: começa com a de sempre para o filtro e os textos não esperarem a API fria
  cargosVies: () =>
    queryOptions({ queryKey: ['cargos-vies'], queryFn: ({ signal }) => get<CargoVies[]>('/api/vies/cargos', signal), placeholderData: CARGOS_PADRAO, ...sempre }),
  composicao: (sigla: string, ano: number, cargo?: number) =>
    queryOptions({
      queryKey: ['composicao', sigla, ano, cargo ?? null],
      queryFn: ({ signal }) => get<ComposicaoVies>(`/api/ufs/${sigla}/composicao?ano=${ano}${comCargo(cargo, '&')}`, signal),
      ...sempre,
    }),
  candidatosPartido: (sigla: string, partido: string, ano: number, cargo: number | undefined, q: string, limite: number) =>
    queryOptions({
      queryKey: ['candidatos-partido', sigla, partido, ano, cargo ?? null, q, limite],
      queryFn: ({ signal }) =>
        get<CandidatosPartido>(
          `/api/ufs/${sigla}/composicao/${encodeURIComponent(partido)}?ano=${ano}${comCargo(cargo, '&')}&limite=${limite}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
          signal,
        ),
      ...sempre,
    }),
  municipio: (ibge: number, cargo?: number) =>
    queryOptions({
      queryKey: ['municipio', ibge, cargo ?? null],
      queryFn: ({ signal }) => get<Municipio>(`/api/municipios/${ibge}${comCargo(cargo, '?')}`, signal),
      ...sempre,
    }),
  zonas: (ibge: number, ano: number) =>
    queryOptions({
      queryKey: ['zonas', ibge, ano],
      queryFn: ({ signal }) => get<Zonas>(`/api/municipios/${ibge}/zonas?ano=${ano}`, signal),
      ...sempre,
    }),
  buscaMunicipios: (q: string, uf = '') =>
    queryOptions({
      queryKey: ['busca-municipios', q, uf],
      queryFn: ({ signal }) =>
        get<MunicipioBusca[]>(`/api/municipios?q=${encodeURIComponent(q)}&uf=${uf}&limite=8`, signal),
      enabled: q.trim().length >= 2,
      ...sempre,
    }),
  /** `limite` cresce de 6 em 6 com o "mais" da urna; a API aceita até LIMITE_BUSCA. */
  buscaPoliticos: (q: string, f: FiltrosBusca = {}, limite = 6, ordem: OrdemBusca = 'relevancia') =>
    queryOptions({
      queryKey: ['busca-politicos', q, f, limite, ordem],
      queryFn: ({ signal }) => {
        const p = new URLSearchParams({ q, limite: String(limite), ordem })
        for (const [k, v] of Object.entries(f)) if (v != null && v !== '') p.set(k === 'eleicao' ? 'ano' : k, String(v))
        return get<PoliticoBusca[]>(`/api/politicos?${p}`, signal)
      },
      enabled: q.trim().length >= 3 || filtrando(f),
      ...sempre,
    }),
  partidos: () =>
    queryOptions({ queryKey: ['partidos'], queryFn: ({ signal }) => get<{ sigla: string; candidaturas: number; vies: number | null }[]>('/api/partidos', signal), ...sempre }),
  politico: (id: number) =>
    queryOptions({ queryKey: ['politico', id], queryFn: ({ signal }) => get<Politico>(`/api/politicos/${id}`, signal), ...sempre }),
  cadeira: (ano: number, cargo: number, uf = '', municipio?: number) =>
    queryOptions({
      queryKey: ['cadeira', ano, cargo, uf, municipio ?? null],
      queryFn: ({ signal }) =>
        get<Cadeira>(`/api/cadeira?ano=${ano}&cargo=${cargo}&uf=${uf}${municipio ? `&municipio=${municipio}` : ''}`, signal),
      ...sempre,
    }),
  naoEleitos: (ano: number, cargo: number, uf = '', municipio?: number) =>
    queryOptions({
      queryKey: ['nao-eleitos', ano, cargo, uf, municipio ?? null],
      queryFn: ({ signal }) =>
        get<Assento[]>(`/api/cadeira/nao-eleitos?ano=${ano}&cargo=${cargo}&uf=${uf}${municipio ? `&municipio=${municipio}` : ''}`, signal),
      ...sempre,
    }),
  patrimonio: (ano: number, cargo: number, uf = '') =>
    queryOptions({
      queryKey: ['patrimonio', ano, cargo, uf],
      queryFn: ({ signal }) => get<Patrimonio>(`/api/patrimonio?ano=${ano}&cargo=${cargo}${uf ? `&uf=${uf}` : ''}`, signal),
      ...sempre,
    }),
  gastos: (candidatura: number) =>
    queryOptions({ queryKey: ['gastos', candidatura], queryFn: ({ signal }) => get<Gastos>(`/api/gastos?candidatura=${candidatura}`, signal), ...sempre }),
  gastosDestaques: () =>
    queryOptions({ queryKey: ['gastos-destaques'], queryFn: ({ signal }) => get<CandidaturaGasto[]>('/api/gastos/destaques', signal), ...sempre }),
  patrimonioPanorama: (uf = '') =>
    queryOptions({
      queryKey: ['patrimonio-panorama', uf],
      queryFn: ({ signal }) => get<PanoramaPatrimonio>(`/api/patrimonio/panorama${uf ? `?uf=${uf}` : ''}`, signal),
      ...sempre,
    }),
  escola: (ano: number, uf = '') =>
    queryOptions({ queryKey: ['escola', ano, uf], queryFn: ({ signal }) => get<Escola>(`/api/escola?ano=${ano}&uf=${uf}`, signal), ...sempre }),
  escolaMunicipios: (ano: number, uf = '') =>
    queryOptions({
      queryKey: ['escola-municipios', ano, uf],
      queryFn: ({ signal }) => get<MunicipioEscola[]>(`/api/escola/municipios?ano=${ano}&uf=${uf}`, signal),
      ...sempre,
    }),
  escolaPartidos: (ano: number, uf = '') =>
    queryOptions({
      queryKey: ['escola-partidos', ano, uf],
      queryFn: ({ signal }) => get<PartidoEscola[]>(`/api/escola/partidos?ano=${ano}&uf=${uf}`, signal),
      ...sempre,
    }),
  escolaComparar: () =>
    queryOptions({ queryKey: ['escola-comparar'], queryFn: ({ signal }) => get<EscolaComparar>('/api/escola/comparar', signal), ...sempre }),
  escolaLugar: (ibge: number, ano: number) =>
    queryOptions({
      queryKey: ['escola-lugar', ibge, ano],
      queryFn: ({ signal }) => get<EscolaLugar>(`/api/escola/municipio/${ibge}?ano=${ano}`, signal),
      ...sempre,
    }),
  reeleicao: (uf: string) =>
    queryOptions({ queryKey: ['reeleicao', uf], queryFn: ({ signal }) => get<Reeleicao>(`/api/reeleicao?uf=${uf}`, signal), ...sempre }),
  pessoasReeleicao: (uf: string, cargo: number, eleitosEm: number, grupo: GrupoReeleicao, limite: number, busca = '') =>
    queryOptions({
      queryKey: ['reeleicao-pessoas', uf, cargo, eleitosEm, grupo, limite, busca],
      queryFn: ({ signal }) =>
        get<PessoasReeleicao>(
          `/api/reeleicao/pessoas?uf=${uf}&cargo=${cargo}&eleitos_em=${eleitosEm}&grupo=${grupo}&limite=${limite}&q=${encodeURIComponent(busca)}`,
          signal,
        ),
      ...sempre,
    }),
  malhaBrasil: () =>
    queryOptions({ queryKey: ['malha', 'BR'], queryFn: ({ signal }) => get<Malha>('/api/geo/brasil', signal), ...sempre }),
  malhaUF: (sigla: string) =>
    queryOptions({ queryKey: ['malha', sigla], queryFn: ({ signal }) => get<Malha>(`/api/geo/uf/${sigla}`, signal), ...sempre }),
  segundoTurno: () =>
    queryOptions({ queryKey: ['segundo-turno'], queryFn: ({ signal }) => get<{ disputas: SegundoTurno[]; incompletas: { ano: number; cargo: string; uf: string | null; municipio: string | null }[] }>('/api/segundo-turno', signal), ...sempre }),
  segundoTurnoLugares: (id: number) =>
    queryOptions({ queryKey: ['segundo-turno', id], queryFn: ({ signal }) => get<SegundoTurnoLugares>(`/api/segundo-turno/${id}`, signal), ...sempre }),
}

export const politicoAleatorio = () => get<{ id: number; nome: string }>('/api/politicos/aleatorio')
