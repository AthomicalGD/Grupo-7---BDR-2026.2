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

const arvore = raiz.addChildren([atlas.addChildren([inicio, estado, municipio]), urna, politico, metodologia])

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
