import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Link } from '@tanstack/react-router'
import { ANOS, type Ano } from './api'
import { Atlas } from './atlas/Atlas'
import { CirandaTela } from './componentes/Ciranda'
import { Moldura } from './componentes/Moldura'

export interface BuscaAtlas {
  ano?: Ano
  relativo?: boolean
  relevo?: boolean
}

export interface BuscaCadeira {
  cargo?: number
  ano?: Ano
  uf?: string
  municipio?: number
  epoca?: boolean
  ordem?: 'partido'
  pe?: boolean
}

const sim = (v: unknown) => (v === true || v === 'true' ? true : undefined)
const numero = (v: unknown) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : undefined)

const raiz = createRootRoute({
  component: Moldura,
  notFoundComponent: () => (
    <div className="mx-auto max-w-[1440px] px-4 py-24 md:px-[72px]">
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
  validateSearch: (s: Record<string, unknown>): BuscaAtlas => ({
    ano: ANOS.includes(Number(s.ano) as Ano) ? (Number(s.ano) as Ano) : undefined,
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
const politico = createRoute({
  getParentRoute: () => raiz,
  path: '/politico/$id',
  component: lazyRouteComponent(() => import('./politico/PoliticoPagina'), 'PoliticoPagina'),
})
const metodologia = createRoute({
  getParentRoute: () => raiz,
  path: '/metodologia',
  component: lazyRouteComponent(() => import('./paginas/Metodologia'), 'Metodologia'),
})

const arvore = raiz.addChildren([atlas.addChildren([inicio, estado, municipio]), urna, cadeira, politico, metodologia])

export const router = createRouter({
  routeTree: arvore,
  defaultPendingComponent: () => <CirandaTela rotulo="Abrindo a página..." />,
  defaultPendingMs: 150,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
