import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Link } from '@tanstack/react-router'
import { ANOS, ANOS_ELEICAO, CARGOS_BUSCA, ORDENS_BUSCA, type Ano, type FiltrosBusca, type OrdemBusca } from './api'
import { Atlas } from './atlas/Atlas'
import { EsqueletoPagina } from './componentes/Esqueleto'
import { ErroCarga } from './componentes/ErroCarga'
import { ehFalhaDeModulo, recarregaUmaVez } from './lib/recarrega'
import { Moldura } from './componentes/Moldura'

export interface BuscaAtlas {
  ano?: Ano
  /** só o voto para este cargo (#10); sem ele, a média dos cargos */
  cargo?: number
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
}

export interface BuscaEscola {
  ano?: Ano
  /** cargo do caderno ao plenário (sem ele, todos os cargos do ano) */
  cargo?: number
  /** cargo dos 100 santinhos */
  santinho?: number
  uf?: string
  ibge?: number
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

export interface BuscaReeleicao {
  uf?: string
  cargo?: number
}

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
  }),
})
const escola = createRoute({
  getParentRoute: () => raiz,
  path: '/escola',
  component: lazyRouteComponent(() => import('./escola/EscolaPagina'), 'EscolaPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaEscola => ({
    ano: Number(s.ano) === 2022 ? 2022 : Number(s.ano) === 2024 ? 2024 : undefined,
    cargo: numero(s.cargo),
    santinho: numero(s.santinho),
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    ibge: numero(s.ibge),
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
const reeleicao = createRoute({
  getParentRoute: () => raiz,
  path: '/reeleicao',
  component: lazyRouteComponent(() => import('./reeleicao/ReeleicaoPagina'), 'ReeleicaoPagina'),
  validateSearch: (s: Record<string, unknown>): BuscaReeleicao => ({
    uf: typeof s.uf === 'string' && /^[A-Z]{2}$/.test(s.uf) ? s.uf : undefined,
    cargo: [3, 5, 6, 7, 11, 13].includes(Number(s.cargo)) ? Number(s.cargo) : undefined,
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
const metodologia = createRoute({
  getParentRoute: () => raiz,
  path: '/metodologia',
  component: lazyRouteComponent(() => import('./paginas/Metodologia'), 'Metodologia'),
})

const arvore = raiz.addChildren([atlas.addChildren([inicio, estado, municipio]), urna, cadeira, escola, patrimonio, reeleicao, politico, metodologia])

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

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Baixa o código das páginas no tempo ocioso, uma por vez, depois da primeira tela: trocar de página fica imediato
// (sem esqueleto nem espera). O 3D não entra aqui: ele é baixado só quando a tela que o usa abre.
const ocioso = (f: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 1500))
const paginas = [urna, cadeira, escola, patrimonio, reeleicao, politico, metodologia]
const proxima = () => {
  const r = paginas.shift()
  const pre = r && (r.options.component as { preload?: () => Promise<void> } | undefined)?.preload
  if (pre) void pre().catch(() => undefined).finally(() => ocioso(proxima))
}
if (typeof window !== 'undefined') window.addEventListener('load', () => ocioso(proxima), { once: true })
