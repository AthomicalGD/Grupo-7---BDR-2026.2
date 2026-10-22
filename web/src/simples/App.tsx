// Interface simples: os mesmos dados da completa em páginas lineares com gráficos, sem mapa, urna nem 3D.
// Pacote próprio, escolhido ao subir o site (npm run dev:simples); não tem caminho para a completa.
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider, useRouterState } from '@tanstack/react-router'
import { Cadeira } from './paginas/Cadeira'
import { Escola } from './paginas/Escola'
import { Estado } from './paginas/Estado'
import { Inicio } from './paginas/Inicio'
import { Municipio } from './paginas/Municipio'
import { Politico } from './paginas/Politico'
import { Politicos } from './paginas/Politicos'
import { Reeleicao } from './paginas/Reeleicao'

const NAV = [
  { para: '/', rotulo: 'Estados', ativo: (p: string) => p === '/' || p.startsWith('/uf') },
  { para: '/urna', rotulo: 'Políticos', ativo: (p: string) => p.startsWith('/urna') || p.startsWith('/politico') },
  { para: '/cadeira', rotulo: 'Cadeira', ativo: (p: string) => p.startsWith('/cadeira') },
  { para: '/escola', rotulo: 'Escola', ativo: (p: string) => p.startsWith('/escola') },
  { para: '/reeleicao', rotulo: 'Reeleição', ativo: (p: string) => p.startsWith('/reeleicao') },
] as const

function Moldura() {
  const caminho = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="tema-simples flex min-h-[100dvh] flex-col bg-folha text-tinta">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-folha focus:px-4 focus:py-2 focus:text-tinta"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 bg-tinta text-folha">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-x-4 px-4 sm:px-6">
          <nav aria-label="Principal" className="-ml-2 min-w-0 overflow-x-auto">
            <ul className="flex">
              {NAV.map((item) => {
                const ativo = item.ativo(caminho)
                return (
                  <li key={item.para}>
                    <Link
                      to={item.para}
                      aria-current={ativo ? 'page' : undefined}
                      className={`relative block whitespace-nowrap px-2 py-4 text-[0.92rem] focus-visible:outline-folha sm:px-3 sm:text-[0.95rem] ${ativo ? 'font-semibold text-folha' : 'text-[#a8c3c3] hover:text-folha'}`}
                    >
                      {item.rotulo}
                      {ativo && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-marcador sm:inset-x-3" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <Outlet />
      </main>
      <footer className="border-t border-linha bg-papel">
        <div className="mx-auto flex max-w-[1040px] flex-wrap justify-between gap-x-8 gap-y-2 px-4 py-7 text-[0.85rem] text-tinta-2 sm:px-6">
          <p>Projeto acadêmico de Banco de Dados, Grupo 7, 2026.2. Não é um site oficial da Justiça Eleitoral.</p>
          <p>Dados: TSE, IBGE, Atlas Brasil e Harvard Dataverse.</p>
        </div>
      </footer>
    </div>
  )
}

const raiz = createRootRoute({
  component: Moldura,
  notFoundComponent: () => (
    <>
      <h1 className="text-[1.9rem] font-bold">Página não encontrada</h1>
      <p className="mt-2 text-tinta-2">
        O endereço não existe.{' '}
        <Link to="/" className="font-semibold text-acao underline">
          voltar ao início
        </Link>
        .
      </p>
    </>
  ),
})

const numero = (v: unknown) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : undefined)
const sigla = (v: unknown) => (typeof v === 'string' && /^[A-Z]{2}$/.test(v) ? v : undefined)

const arvore = raiz.addChildren([
  createRoute({ getParentRoute: () => raiz, path: '/', component: Inicio }),
  createRoute({ getParentRoute: () => raiz, path: '/uf/$sigla', component: Estado }),
  createRoute({ getParentRoute: () => raiz, path: '/uf/$sigla/$ibge', component: Municipio }),
  createRoute({ getParentRoute: () => raiz, path: '/urna', component: Politicos }),
  createRoute({ getParentRoute: () => raiz, path: '/politico/$id', component: Politico }),
  createRoute({
    getParentRoute: () => raiz,
    path: '/cadeira',
    component: Cadeira,
    validateSearch: (s: Record<string, unknown>) => ({ cargo: numero(s.cargo), ano: numero(s.ano), uf: sigla(s.uf) }),
  }),
  createRoute({
    getParentRoute: () => raiz,
    path: '/escola',
    component: Escola,
    validateSearch: (s: Record<string, unknown>) => ({ ano: numero(s.ano), uf: sigla(s.uf) }),
  }),
  createRoute({
    getParentRoute: () => raiz,
    path: '/reeleicao',
    component: Reeleicao,
    validateSearch: (s: Record<string, unknown>) => ({ uf: sigla(s.uf), cargo: numero(s.cargo) }),
  }),
])

const router = createRouter({ routeTree: arvore, scrollRestoration: true, defaultPreload: 'intent' })

export function App() {
  return <RouterProvider router={router} />
}
