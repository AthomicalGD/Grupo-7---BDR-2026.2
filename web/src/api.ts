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
  vies: PorAno<number>
}

export interface MunicipioResumo {
  ibge: number
  nome: string
  regiao: string
  vies: PorAno<number>
  aptos: PorAno<number>
}

export interface UFDetalhe extends Omit<UF, 'municipios'> {
  sem_vies_pct: PorAno<number>
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
    vies: number
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
  vies: number
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

export const CARGOS_BUSCA = [
  { cod: 1, nome: 'presidente' },
  { cod: 3, nome: 'governador' },
  { cod: 5, nome: 'senador' },
  { cod: 6, nome: 'deputado federal' },
  { cod: 7, nome: 'deputado estadual' },
  { cod: 11, nome: 'prefeito' },
  { cod: 13, nome: 'vereador' },
] as const
export const ANOS_ELEICAO = [2024, 2022, 2020, 2018, 2016, 2014, 2012, 2010, 2008, 2006, 2004, 2002, 2000, 1998, 1996, 1994] as const

export interface Candidatura {
  ano: number
  cargo: string
  cod_cargo: number
  local: string
  uf: string | null
  municipio_ibge: number | null
  partido: string | null
  situacao: string
  eleito: boolean
  reeleito: boolean
  turno: number | null
  votos: number | null
  /** Despesa contratada da campanha (P1); null antes de 2018. */
  gasto: number | null
  suplementar: boolean
  foto: string | null
}

export interface Politico {
  id: number
  nome: string
  nascimento_ano: number | null
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
  custo_cadeira: number | null
  mediana_eleito: number | null
  mediana_nao_eleito: number | null
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

export type Malha = FeatureCollection<Polygon | MultiPolygon, { codarea: number }>

export class ErroApi extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

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

const sempre = { staleTime: Infinity, gcTime: 30 * 60_000 } // os dados só mudam com uma nova carga

export const consultas = {
  ufs: () => queryOptions({ queryKey: ['ufs'], queryFn: ({ signal }) => get<UF[]>('/api/ufs', signal), ...sempre }),
  uf: (sigla: string) =>
    queryOptions({ queryKey: ['uf', sigla], queryFn: ({ signal }) => get<UFDetalhe>(`/api/ufs/${sigla}`, signal), ...sempre }),
  composicao: (sigla: string, ano: number) =>
    queryOptions({
      queryKey: ['composicao', sigla, ano],
      queryFn: ({ signal }) => get<ComposicaoVies>(`/api/ufs/${sigla}/composicao?ano=${ano}`, signal),
      ...sempre,
    }),
  municipio: (ibge: number) =>
    queryOptions({
      queryKey: ['municipio', ibge],
      queryFn: ({ signal }) => get<Municipio>(`/api/municipios/${ibge}`, signal),
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
  buscaPoliticos: (q: string, f: FiltrosBusca = {}) =>
    queryOptions({
      queryKey: ['busca-politicos', q, f],
      queryFn: ({ signal }) => {
        const p = new URLSearchParams({ q, limite: '6' })
        for (const [k, v] of Object.entries(f)) if (v != null && v !== '') p.set(k === 'eleicao' ? 'ano' : k, String(v))
        return get<PoliticoBusca[]>(`/api/politicos?${p}`, signal)
      },
      enabled: q.trim().length >= 3 || filtrando(f),
      ...sempre,
    }),
  partidos: () =>
    queryOptions({ queryKey: ['partidos'], queryFn: ({ signal }) => get<{ sigla: string; candidaturas: number; vies: number }[]>('/api/partidos', signal), ...sempre }),
  politico: (id: number) =>
    queryOptions({ queryKey: ['politico', id], queryFn: ({ signal }) => get<Politico>(`/api/politicos/${id}`, signal), ...sempre }),
  cadeira: (ano: number, cargo: number, uf = '', municipio?: number) =>
    queryOptions({
      queryKey: ['cadeira', ano, cargo, uf, municipio ?? null],
      queryFn: ({ signal }) =>
        get<Cadeira>(`/api/cadeira?ano=${ano}&cargo=${cargo}&uf=${uf}${municipio ? `&municipio=${municipio}` : ''}`, signal),
      ...sempre,
    }),
  malhaBrasil: () =>
    queryOptions({ queryKey: ['malha', 'BR'], queryFn: ({ signal }) => get<Malha>('/api/geo/brasil', signal), ...sempre }),
  malhaUF: (sigla: string) =>
    queryOptions({ queryKey: ['malha', sigla], queryFn: ({ signal }) => get<Malha>(`/api/geo/uf/${sigla}`, signal), ...sempre }),
}

export const politicoAleatorio = () => get<{ id: number; nome: string }>('/api/politicos/aleatorio')
