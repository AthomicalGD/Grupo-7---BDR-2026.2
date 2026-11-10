import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Link } from '@tanstack/react-router'
import { ANOS, ANOS_ELEICAO, ANOS_LEGENDA, CARGOS_BUSCA, ORDENS_BUSCA, type Ano, type FiltrosBusca, type OrdemBusca, type SituacaoLegenda } from './api'
import { Atlas } from './atlas/Atlas'
import { EsqueletoPagina } from './componentes/Esqueleto'
import { ErroCarga } from './componentes/ErroCarga'
import { registraOrigem } from './lib/pilha'
import { ehFalhaDeModulo, recarregaUmaVez } from './lib/recarrega'
import { Moldura } from './componentes/Moldura'

export interface BuscaAtlas {
  ano?: Ano
  /** só o voto para este cargo (#10); sem ele, a média dos cargos */
  cargo?: number
  /** 2: o viés do 2º turno (presidente, governador e prefeito); sem ele, o 1º */
  turno?: 2
  relativo?: boolean
  relevo?: boolean
}

/** Cargos do filtro do atlas (os mesmos de /api/vies/cargos). */
export const CARGOS_ATLAS = [1, 3, 5, 6, 7, 11, 13]

export interface BuscaCadeira {
  cargo?: number
  ano?: Ano
  uf?: string
  municipio?: number
  epoca?: boolean
  ordem?: 'partido'
  pe?: boolean
  /** a galeria de quem não se elegeu em volta do plenário */
  todos?: boolean
}

export interface BuscaEscola {
  ano?: Ano
  /** cargo do caderno ao plenário (sem ele, todos os cargos do ano) */
  cargo?: number
  /** cargo dos 100 santinhos */
  santinho?: number
  uf?: string
  ibge?: number
  /** "Pintar por" do mapa (sem ele, os políticos) */
  pintar?: 'eleitores' | 'colonial'
  /** a dispersão no lugar do mapa */
  vista?: 'dispersao'
}

export interface BuscaIdade {
  /** o ano do mapa (ato 1) */
  ano?: Ano
  uf?: string
  /** o município da galeria */
  ibge?: number
  /** a eleição municipal da pirâmide (ato 3) */
  eleitos?: 2020 | 2024
  /** o cargo e a eleição do "jovem vota no jovem?" (ato 4) */
  cargo?: number
  voto?: Ano
}

export interface BuscaPolitico {
  /** id_politico_eleicao da campanha cuja nuvem de gastos abre (P9) */
  gasto?: number
}

export interface BuscaPatrimonio {
  ano?: Ano
  cargo?: number
  uf?: string
}

export interface BuscaRepasses {
  cargo?: number
  ano?: Ano
  uf?: string
  /** só prefeito e vereador */
  municipio?: number
  /** em quantas faixas iguais a parcela pública é dividida (padrão 5, de 20 em 20) */
  faixas?: number
  /** o dinheiro repartido entre os grupos de patrimônio; sem ele, só os fundos públicos */
  dinheiro?: 'receita'
}

export interface BuscaSegundoTurno {
  /** a disputa aberta (id da eleição do 2º turno) */
  d?: number
  /** código do cargo: 1 presidente, 3 governador, 11 prefeito */
  cargo?: number
  ano?: Ano
  /** só as viradas */
  viradas?: boolean
  ordem?: 'recentes' | 'viradas' | 'crescimento'
}

export interface BuscaReeleicao {
  uf?: string
  cargo?: number
}

export interface BuscaLegenda {
  ano_p5?: number
  cargo?: number
  uf?: string
  partido?: string
  situacao?: SituacaoLegenda
}

/** Os índices do eixo vertical da P3 (ver indices/indices.ts). */
export const INDICES_P3 = ['ifdm', 'emprego_renda', 'educacao', 'saude', 'pib_pc', 'eleitores_pop', 'isentos'] as const
export type IndiceP3 = (typeof INDICES_P3)[number]

export interface BuscaIndices {
  uf?: string
  ano?: 2018 | 2020 | 2022 | 2024
  /** sem ele, o IFDM geral */
  indice?: IndiceP3
  /** a eleição municipal da área de desempenho dos partidos; sem ela, 2020 */
  municipal?: EleicaoMunicipalP3
  /** o índice dos rankings dos partidos; sem ele, o IFDM geral */
  ranking?: IndiceP3
  /** o porte dos municípios pela população (menos de 50 mil, 50 mil a 100 mil, mais de 100 mil); sem ele, todos */
  porte?: PorteP3
}

/** Os portes dos municípios da P3 pela população: menos de 50 mil, de 50 mil a 100 mil e mais de 100 mil (api/app.py, porte_de). */
export const PORTES_P3 = ['pequeno', 'medio', 'grande'] as const
export type PorteP3 = (typeof PORTES_P3)[number]

/** As eleições municipais com índices dentro das regras de ano (ver api/app.py, desempenho_partidos). */
export const MUNICIPAIS_P3 = [2012, 2016, 2020, 2024] as const
export type EleicaoMunicipalP3 = (typeof MUNICIPAIS_P3)[number]

const sim = (v: unknown) => (v === true || v === 'true' ? true : undefined)
const numero = (v: unknown) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : undefined)

const raiz = createRootRoute({
  component: Moldura,
  notFoundComponent: () => (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 py-24 md:px-[var(--casca-margem)]">
      <h1 className="t-h1">Página não encontrada</h1>
      <p className="mt-3 text-tinta-2">
        O endereço não existe. <Link to="/" className="font-semibold text-acao underline">Voltar ao mapa</Link>.
      </p>
    </div>
  ),
})

// O mapa vive no layout: Brasil, estado e município trocam só a câmera e o painel.
const atlas = createRoute({
  getParentRoute: () => raiz,
  id: 'atlas',
  component: Atlas,
  pendingComponent: () => <EsqueletoPagina variante="mapa" rotulo="Abrindo o mapa..." />,
  validateSearch: (s: Record<string, unknown>): BuscaAtlas => ({
    ano: ANOS.includes(Number(s.ano) as Ano) ? (Number(s.ano) as Ano) : undefined,
    cargo: CARGOS_ATLAS.includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
    turno: Number(s.turno) === 2 ? 2 : undefined,
    relativo: s.relativo === true || s.relativo === 'true' ? true : undefined,
    relevo: s.relevo === true || s.relevo === 'true' ? true : undefined,
  }),
})
const inicio = createRoute({ getParentRoute: () => atlas, path: '/' })
const estado = createRoute({ getParentRoute: () => atlas, path: '/uf/$sigla' })
const municipio = createRoute({ getParentRoute: () => atlas, path: '/uf/$sigla/$ibge' })

const urna = createRoute({
  getParentRoute: () => raiz,
  path: '/urna',
  component: lazyRouteComponent(() => import('./urna/UrnaPagina'), 'UrnaPagina'),
  validateSearch: (s: Record<string, unknown>): FiltrosBusca & { ordem?: OrdemBusca } => ({
    cargo: CARGOS_BUSCA.some((c) => c.cod === Number(s.cargo)) ? Number(s.cargo) : undefined,
    eleicao: ANOS_ELEICAO.includes(Number(s.eleicao) as (typeof ANOS_ELEICAO)[number]) ? Number(s.eleicao) : undefined,
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    partido: typeof s.partido === 'string' && /^[A-Z0-9 ÇÃÁÉÍÓÚÂÊÔÕ]{2,20}$/.test(s.partido) ? s.partido : undefined,
    resultado: s.resultado === 'eleito' || s.resultado === 'nao_eleito' ? s.resultado : undefined,
    ordem: ORDENS_BUSCA.some((o) => o.valor === s.ordem && o.valor !== 'relevancia') ? (s.ordem as OrdemBusca) : undefined,
  }),
})
const cadeira = createRoute({
  getParentRoute: () => raiz,
  path: '/cadeira',
  component: lazyRouteComponent(() => import('./cadeira/CadeiraPagina'), 'CadeiraPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaCadeira => ({
    cargo: numero(s.cargo),
    ano: ANOS.includes(Number(s.ano) as Ano) ? (Number(s.ano) as Ano) : undefined,
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    municipio: numero(s.municipio),
    epoca: sim(s.epoca),
    ordem: s.ordem === 'partido' ? 'partido' : undefined,
    pe: sim(s.pe),
    todos: sim(s.todos),
  }),
})
const legenda = createRoute({
  getParentRoute: () => raiz,
  path: '/cadeira/legenda',
  component: lazyRouteComponent(() => import('./legenda/LegendaPagina'), 'LegendaPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaLegenda => ({
    ano_p5: ANOS_LEGENDA.includes(Number(s.ano_p5) as (typeof ANOS_LEGENDA)[number]) ? Number(s.ano_p5) : undefined,
    cargo: [6, 7, 13].includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    partido: typeof s.partido === 'string' && /^[A-Z0-9 ÇÃÁÉÍÓÚÂÊÔÕ]{2,20}$/.test(s.partido) ? s.partido : undefined,
    situacao: s.situacao === 'qp' || s.situacao === 'media' ? s.situacao : undefined,
  }),
})
const escola = createRoute({
  getParentRoute: () => raiz,
  path: '/escola',
  component: lazyRouteComponent(() => import('./escola/EscolaPagina'), 'EscolaPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaEscola => ({
    ano: ([2022, 2024, 2026] as const).find((a) => a === Number(s.ano)),
    cargo: numero(s.cargo),
    santinho: numero(s.santinho),
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    ibge: numero(s.ibge),
    pintar: s.pintar === 'eleitores' || s.pintar === 'colonial' ? s.pintar : undefined,
    vista: s.vista === 'dispersao' ? 'dispersao' : undefined,
  }),
})
const idade = createRoute({
  getParentRoute: () => raiz,
  path: '/idade',
  component: lazyRouteComponent(() => import('./idade/IdadePagina'), 'IdadePagina'),
  validateSearch: (s: Record<string, unknown>): BuscaIdade => ({
    ano: ANOS.includes(Number(s.ano) as Ano) ? (Number(s.ano) as Ano) : undefined,
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    ibge: numero(s.ibge),
    eleitos: Number(s.eleitos) === 2020 ? 2020 : undefined,
    cargo: [6, 7, 11, 13].includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
    voto: ANOS.includes(Number(s.voto) as Ano) ? (Number(s.voto) as Ano) : undefined,
  }),
})
const patrimonio = createRoute({
  getParentRoute: () => raiz,
  path: '/patrimonio',
  component: lazyRouteComponent(() => import('./patrimonio/PatrimonioPagina'), 'PatrimonioPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaPatrimonio => ({
    ano: ANOS.includes(Number(s.ano) as Ano) ? (Number(s.ano) as Ano) : undefined,
    cargo: [1, 3, 5, 6, 7, 11, 13].includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
  }),
})
const repasses = createRoute({
  getParentRoute: () => raiz,
  path: '/repasses',
  component: lazyRouteComponent(() => import('./repasses/RepassesPagina'), 'RepassesPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaRepasses => ({
    cargo: [3, 5, 6, 7, 11, 13].includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
    ano: ([2018, 2020, 2022, 2024, 2026] as const).find((a) => a === Number(s.ano)),
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    municipio: numero(s.municipio),
    faixas: Number.isInteger(Number(s.faixas)) && Number(s.faixas) >= 2 && Number(s.faixas) <= 10 && Number(s.faixas) !== 5 ? Number(s.faixas) : undefined,
    dinheiro: s.dinheiro === 'receita' ? 'receita' : undefined,
  }),
})
const reeleicao = createRoute({
  getParentRoute: () => raiz,
  path: '/reeleicao',
  component: lazyRouteComponent(() => import('./reeleicao/ReeleicaoPagina'), 'ReeleicaoPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaReeleicao => ({
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    cargo: [3, 5, 6, 7, 11, 13].includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
  }),
})
const indices = createRoute({
  getParentRoute: () => raiz,
  path: '/indices',
  component: lazyRouteComponent(() => import('./indices/IndicesPagina'), 'IndicesPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaIndices => ({
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    ano: ([2018, 2020, 2022, 2024] as const).find((a) => a === Number(s.ano)),
    indice: INDICES_P3.find((i) => i === s.indice && i !== 'ifdm'),
    municipal: MUNICIPAIS_P3.find((a) => a === Number(s.municipal) && a !== 2020),
    ranking: INDICES_P3.find((i) => i === s.ranking && i !== 'ifdm'),
    porte: PORTES_P3.find((p) => p === s.porte),
  }),
})
const politico = createRoute({
  getParentRoute: () => raiz,
  path: '/politico/$id',
  component: lazyRouteComponent(() => import('./politico/PoliticoPagina'), 'PoliticoPagina'),
  // outro político, outra ficha: sem isto o React reaproveitava os santinhos (virados, com a foto do anterior)
  remountDeps: ({ params }) => params,
  pendingComponent: () => <EsqueletoPagina variante="carreira" rotulo="Abrindo a carreira..." />,
  validateSearch: (s: Record<string, unknown>): BuscaPolitico => ({ gasto: numero(s.gasto) }),
})
const comparar = createRoute({
  getParentRoute: () => raiz,
  path: '/comparar',
  component: lazyRouteComponent(() => import('./comparar/CompararPagina'), 'CompararPagina'),
  validateSearch: (s: Record<string, unknown>): { a?: number; b?: number } => ({ a: numero(s.a), b: numero(s.b) }),
})
const metodologia = createRoute({
  getParentRoute: () => raiz,
  path: '/metodologia',
  component: lazyRouteComponent(() => import('./paginas/Metodologia'), 'Metodologia'),
})

const segundoTurno = createRoute({
  getParentRoute: () => raiz,
  path: '/segundo-turno',
  component: lazyRouteComponent(() => import('./segundo/SegundoTurnoPagina'), 'SegundoTurnoPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaSegundoTurno => ({
    d: Number.isInteger(Number(s.d)) && Number(s.d) > 0 ? Number(s.d) : undefined,
    cargo: [1, 3, 11].includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
    ano: ([2018, 2020, 2022, 2024, 2026] as const).find((a) => a === Number(s.ano)),
    viradas: s.viradas === true || s.viradas === 'true' ? true : undefined,
    ordem: s.ordem === 'viradas' || s.ordem === 'crescimento' ? s.ordem : undefined,
  }),
})

const arvore = raiz.addChildren([atlas.addChildren([inicio, estado, municipio]), urna, cadeira, legenda, escola, idade, patrimonio, repasses, reeleicao, indices, segundoTurno, politico, comparar, metodologia])

export const router = createRouter({
  routeTree: arvore,
  // a troca de página: nada nos primeiros 300 ms (o código já foi baixado no tempo ocioso ou ao passar o mouse no link)
  // e, se demorar, o esqueleto da página, que fica pelo menos 300 ms para não piscar
  defaultPendingComponent: () => <EsqueletoPagina />,
  defaultPendingMinMs: 300,
  // uma página ou um 3D que não baixou: recarrega uma vez (ver lib/recarrega.ts); outro erro: a tela de erro do site
  defaultErrorComponent: ({ error }) =>
    ehFalhaDeModulo(error) && recarregaUmaVez() ? <EsqueletoPagina rotulo="Atualizando a página..." /> : <ErroCarga erro={error} />,
  defaultPendingMs: 300,
  scrollRestoration: true,
  // baixa o código da página quando o ponteiro para sobre o link: a troca de tela fica imediata
  defaultPreload: 'intent',
})

// a pilha de navegação: cada tela sabe de onde se chegou a ela (o Voltar da carreira leva para lá, não à urna)
router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation }) =>
  registraOrigem(toLocation.state.__TSR_key, fromLocation && { pathname: fromLocation.pathname, href: fromLocation.href }),
)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Baixa o código das páginas no tempo ocioso, uma por vez, depois da primeira tela: trocar de página fica imediato
// (sem esqueleto nem espera). O 3D não entra aqui: ele é baixado só quando a tela que o usa abre.
const ocioso = (f: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 1500))
const paginas = [urna, cadeira, legenda, escola, idade, patrimonio, repasses, reeleicao, indices, segundoTurno, politico, metodologia]
const proxima = () => {
  const r = paginas.shift()
  const pre = r && (r.options.component as { preload?: () => Promise<void> } | undefined)?.preload
  if (pre) void pre().catch(() => undefined).finally(() => ocioso(proxima))
}
if (typeof window !== 'undefined') window.addEventListener('load', () => ocioso(proxima), { once: true })
