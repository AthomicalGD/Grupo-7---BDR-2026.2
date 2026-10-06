import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { consultas } from '../api'
import letreiro from '../assets/marca/letreiro-horizontal.svg'
import letreiroNegativo from '../assets/marca/letreiro-horizontal-negativo.svg'
import simbolo from '../assets/marca/simbolo.svg'
import { Fita } from './Fita'

// Preferências de leitura (alto contraste e tamanho da fonte), guardadas só neste navegador.
function usePreferencia(chave: string, atributo: string, inicial: string) {
  const [valor, setValor] = useState(() => {
    try {
      return localStorage.getItem(chave) ?? inicial
    } catch {
      return inicial
    }
  })
  useEffect(() => {
    document.documentElement.setAttribute(atributo, valor)
    try {
      localStorage.setItem(chave, valor)
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }, [chave, atributo, valor])
  return [valor, setValor] as const
}

const NAV = [
  { para: '/', rotulo: 'Mapa', ativo: (p: string) => p === '/' || p.startsWith('/uf') },
  { para: '/urna', rotulo: 'Urna', ativo: (p: string) => p.startsWith('/urna') || p.startsWith('/politico') },
  { para: '/metodologia', rotulo: 'Metodologia', ativo: (p: string) => p.startsWith('/metodologia') },
] as const

function BarraUtilitaria() {
  const [contraste, setContraste] = usePreferencia('va-contraste', 'data-contraste', 'normal')
  const [fonte, setFonte] = usePreferencia('va-fonte', 'data-fonte', '0')
  const botao = 'rounded px-2 py-0.5 hover:bg-folha/70 disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div className="bg-papel-2 text-tinta-2">
      <div className="mx-auto flex h-8 max-w-[1440px] items-center justify-between gap-4 px-4 text-[0.78rem] md:px-[72px]">
        <p className="truncate">Projeto acadêmico de Banco de Dados · Grupo 7 · 2026.2</p>
        <div className="flex shrink-0 items-center gap-1 font-semibold">
          <button
            type="button"
            className={botao}
            aria-pressed={contraste === 'alto'}
            onClick={() => setContraste(contraste === 'alto' ? 'normal' : 'alto')}
          >
            Alto contraste
          </button>
          <span aria-hidden className="mx-1 h-3 w-px bg-linha-2" />
          <button type="button" className={botao} aria-label="Diminuir o texto" disabled={fonte === '0'} onClick={() => setFonte(String(Math.max(0, +fonte - 1)))}>
            A−
          </button>
          <button type="button" className={botao} aria-label="Aumentar o texto" disabled={fonte === '2'} onClick={() => setFonte(String(Math.min(2, +fonte + 1)))}>
            A+
          </button>
        </div>
      </div>
    </div>
  )
}

function Cabecalho() {
  const caminho = useRouterState({ select: (s) => s.location.pathname })
  return (
    <header className="sticky top-0 z-30 bg-folha/95 backdrop-blur-[6px]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 md:h-[72px] md:px-[72px]">
        <Link to="/" className="shrink-0" aria-label="Voto Aberto, página inicial">
          <img src={letreiro} alt="Voto Aberto" className="hidden h-9 w-auto min-[420px]:block md:h-10" />
          <img src={simbolo} alt="Voto Aberto" className="h-9 w-auto min-[420px]:hidden" />
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-1 sm:gap-3">
            {NAV.map((item) => {
              const ativo = item.ativo(caminho)
              return (
                <li key={item.para} className="relative">
                  <Link
                    to={item.para}
                    className={`block rounded-md px-2 py-2 text-[0.95rem] transition-colors sm:px-3 sm:text-base ${ativo ? 'font-semibold text-tinta' : 'text-tinta-2 hover:text-tinta'}`}
                    aria-current={ativo ? 'page' : undefined}
                  >
                    {item.rotulo}
                  </Link>
                  {ativo && (
                    <motion.span
                      layoutId="nav-marcador"
                      className="absolute inset-x-2 -bottom-[14px] h-1 rounded-full bg-marcador sm:inset-x-3 md:-bottom-[18px]"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
      <Fita />
    </header>
  )
}

function Rodape() {
  const { data: ufs } = useQuery(consultas.ufs())
  const carregadas = ufs?.filter((u) => u.carregada).map((u) => u.sigla) ?? []
  return (
    <footer className="mt-24 bg-tinta text-[#c9d0d8]">
      <Fita altura={7} />
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr_1fr] md:px-[72px]">
        <div className="space-y-4">
          <img src={letreiroNegativo} alt="Voto Aberto" className="-ml-2 h-14 w-auto" />
          <p className="max-w-[46ch] text-sm leading-relaxed">
            Viés político de estados e municípios de 2018 a 2024 e a carreira de cada político desde 1994, com
            dados abertos coletados, modelados e carregados pelo Grupo 7.
          </p>
          <p className="text-sm font-semibold text-white">Este não é um site oficial da Justiça Eleitoral.</p>
        </div>
        <div>
          <h2 className="t-rotulo mb-3 text-white">Fontes dos dados</h2>
          <ul className="space-y-1.5 text-sm">
            <li>TSE, Portal de Dados Abertos: candidaturas, votação, fotos</li>
            <li>IBGE: malhas municipais, PIB, população, Censo 2022</li>
            <li>Atlas Brasil (PNUD, Ipea, FJP): IDHM</li>
            <li>Harvard Dataverse: ideologia dos partidos</li>
          </ul>
        </div>
        <div>
          <h2 className="t-rotulo mb-3 text-white">Estados carregados no banco</h2>
          <p className="t-mono text-sm tracking-wider">{carregadas.length ? carregadas.join('  ') : '...'}</p>
          <p className="mt-4 text-sm">
            Os demais aparecem como <em>sem dados carregados</em>. Para incluir um estado:{' '}
            <code className="t-mono text-white">python -m loader SP</code>
          </p>
        </div>
      </div>
    </footer>
  )
}

export function Moldura() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-tinta focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <BarraUtilitaria />
      <Cabecalho />
      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>
      <Rodape />
    </div>
  )
}
