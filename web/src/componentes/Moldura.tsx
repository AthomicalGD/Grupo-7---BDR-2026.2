import { Archive, Armchair, ArrowsClockwise, BookOpenText, GraduationCap, Intersect, MapTrifold, PiggyBank, type Icon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { consultas } from '../api'
import letreiro from '../assets/marca/letreiro-horizontal.svg'
import letreiroNegativo from '../assets/marca/letreiro-horizontal-negativo.svg'
import simbolo from '../assets/marca/simbolo.svg'
import { Fita } from './Fita'
import { ModoAula } from './ModoAula'
import { NestaPagina } from './NestaPagina'
import { Tour, useTour } from './Tour'

// Preferências de leitura (alto contraste, tamanho da fonte e margens), guardadas só neste navegador.
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

// Cada módulo tem um ícone; o ativo vira uma pílula no oliva claro da seleção (o mesmo papel em todo o
// sistema), com o laço das fitas embaixo. A pílula desliza entre os itens (mola) e o ícone pula e fica
// cheio ao chegar.
type ItemNav = { para: '/' | '/urna' | '/cadeira' | '/escola' | '/patrimonio' | '/reeleicao' | '/segundo-turno' | '/metodologia'; rotulo: string; curto?: string; icone: Icon; ativo: (p: string) => boolean }
const NAV: ItemNav[] = [
  { para: '/', rotulo: 'Mapa', icone: MapTrifold, ativo: (p) => p === '/' || p.startsWith('/uf') },
  { para: '/urna', rotulo: 'Urna', icone: Archive, ativo: (p) => p.startsWith('/urna') || p.startsWith('/politico') },
  { para: '/cadeira', rotulo: 'Cadeira', icone: Armchair, ativo: (p) => p.startsWith('/cadeira') },
  { para: '/escola', rotulo: 'Escola', icone: GraduationCap, ativo: (p) => p.startsWith('/escola') },
  { para: '/patrimonio', rotulo: 'Patrimônio', curto: 'Bens', icone: PiggyBank, ativo: (p) => p.startsWith('/patrimonio') },
  { para: '/reeleicao', rotulo: 'Reeleição', icone: ArrowsClockwise, ativo: (p) => p.startsWith('/reeleicao') },
  { para: '/segundo-turno', rotulo: '2º turno', curto: 'Virada', icone: Intersect, ativo: (p) => p.startsWith('/segundo-turno') },
  { para: '/metodologia', rotulo: 'Metodologia', curto: 'Método', icone: BookOpenText, ativo: (p) => p.startsWith('/metodologia') },
]

function BarraUtilitaria({ aula, aoAula, aoTour }: { aula: boolean; aoAula: (v: boolean) => void; aoTour: () => void }) {
  const [contraste, setContraste] = usePreferencia('va-contraste', 'data-contraste', 'normal')
  const [fonte, setFonte] = usePreferencia('va-fonte', 'data-fonte', '0')
  const [margem, setMargem] = usePreferencia('va-margem', 'data-margem', '1')
  const botao = 'rounded px-2 py-0.5 hover:bg-folha/70 disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div className="bg-papel-2 text-tinta-2">
      {/* largura fixa, fora das margens ajustáveis: assim os botões não fogem do cursor ao clicar */}
      <div className="mx-auto flex h-7 max-w-[1440px] items-center justify-between gap-4 px-4 text-[0.76rem] md:px-[72px]">
        <p className="truncate">Projeto acadêmico de Banco de Dados · Grupo 7 · 2026.2</p>
        <div data-tour="leitura" className="flex shrink-0 items-center gap-1 font-semibold">
          <button type="button" className={`${botao} max-sm:hidden`} onClick={aoTour}>
            Tour
          </button>
          <button type="button" className={`${botao} max-sm:hidden`} aria-pressed={aula} onClick={() => aoAula(!aula)}>
            Sala de aula
          </button>
          <span aria-hidden className="mx-1 h-3 w-px bg-linha-2 max-sm:hidden" />
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
          <span aria-hidden className="mx-1 hidden h-3 w-px bg-linha-2 md:block" />
          {/* só faz efeito do tablet para cima: no celular a margem já é mínima */}
          <span className="hidden items-center md:flex">
            <span className="px-1 font-normal">Margens</span>
            <button type="button" className={botao} aria-label="Diminuir as margens (página mais larga)" disabled={margem === '4'} onClick={() => setMargem(String(Math.min(4, +margem + 1)))}>
              −
            </button>
            <button type="button" className={botao} aria-label="Aumentar as margens (página mais estreita)" disabled={margem === '0'} onClick={() => setMargem(String(Math.max(0, +margem - 1)))}>
              +
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

function Cabecalho() {
  const caminho = useRouterState({ select: (s) => s.location.pathname })
  return (
    <header className="sticky top-0 z-30 bg-folha">
      <div className="mx-auto flex h-14 max-w-[var(--casca-max)] items-center justify-between gap-2 px-4 max-[379px]:gap-1 max-[379px]:px-3 sm:gap-6 md:px-[var(--casca-margem)]">
        <Link to="/" className="shrink-0" aria-label="Voto Aberto, página inicial">
          <img src={letreiro} alt="Voto Aberto" className="hidden h-9 w-auto lg:block" />
          <img src={simbolo} alt="Voto Aberto" className="h-8 w-auto max-[379px]:h-7 lg:hidden" />
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-0 sm:gap-1.5">
            {NAV.map((item) => {
              const ativo = item.ativo(caminho)
              const Icone = item.icone
              return (
                <li key={item.para} className="relative">
                  {ativo && (
                    <motion.span
                      layoutId="nav-pilula"
                      aria-hidden
                      className="absolute inset-x-0 inset-y-1 rounded-full sm:inset-y-0.5"
                      style={{ background: 'var(--color-selecao-claro)' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    >
                      <span className="absolute inset-x-3 -bottom-[7px] h-1 rounded-full sm:inset-x-4" style={{ background: 'var(--laco)' }} />
                    </motion.span>
                  )}
                  <Link
                    to={item.para}
                    className={`nav-item relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-[2px] py-2 text-[0.8rem] transition-colors max-sm:text-[0.78rem] max-sm:[font-stretch:76%] max-[379px]:px-[1px] max-[379px]:text-[0.76rem] sm:px-3 lg:max-xl:px-2 sm:text-[0.97rem] ${ativo ? 'font-semibold' : 'text-tinta-2 hover:bg-papel hover:text-tinta'}`}
                    style={ativo ? { color: 'var(--color-selecao-tinta)' } : undefined}
                    aria-current={ativo ? 'page' : undefined}
                    aria-label={item.curto ? item.rotulo : undefined}
                  >
                    <motion.span
                      key={ativo ? 'ativo' : 'parado'}
                      aria-hidden
                      className="hidden lg:inline-flex"
                      initial={ativo ? { scale: 0.6, rotate: -12 } : false}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 14 }}
                    >
                      <Icone size={19} weight={ativo ? 'fill' : 'regular'} />
                    </motion.span>
                    {item.curto ? (
                      <>
                        <span aria-hidden className="lg:hidden">{item.curto}</span>
                        <span aria-hidden className="hidden lg:inline">{item.rotulo}</span>
                      </>
                    ) : (
                      item.rotulo
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
      <Fita viva />
    </header>
  )
}

/** Um título de coluna do rodapé, com o traço curto na cor de uma fita (enfeite, não informação). */
const TituloRodape = ({ cor, children }: { cor: string; children: ReactNode }) => (
  <h2 className="t-rotulo mb-4 flex items-center gap-2.5 text-white">
    <span className="h-1 w-5 rounded-full" style={{ background: cor }} aria-hidden />
    {children}
  </h2>
)

/** As sete fitas da marca em diagonal, saindo do canto inferior direito do rodapé (como as faixas do TSE). */
const FITAS_RODAPE = ['#5E881B', '#A2BD31', '#5D6B94', '#468BAF', '#76ACD0', '#F19929', '#FBC700']
function FitasDiagonais() {
  const W = 420, H = 260, LARGURA = 15, VAO = 5, INCLINA = 0.62
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-[110px] w-auto sm:h-[230px]">
      {FITAS_RODAPE.map((cor, i) => {
        // faixa paralela: começa na base e sobe até a borda direita
        const a = 150 + i * (LARGURA + VAO)
        const b = a + LARGURA
        return <polygon key={cor} points={`${a},${H} ${b},${H} ${W},${H - (W - b) * INCLINA} ${W},${H - (W - a) * INCLINA}`} fill={cor} />
      })}
    </svg>
  )
}

// O rodapé: a ardósia funda da marca, como o rodapé institucional do TSE, mas com a nossa assinatura:
// as sete fitas da marca cruzam o canto inferior direito em diagonal.
function Rodape() {
  const { data: ufs } = useQuery(consultas.ufs())
  const carregadas = ufs?.filter((u) => u.carregada && u.sigla !== 'BR') ?? []
  return (
    <footer className="relative mt-16 overflow-hidden bg-[linear-gradient(180deg,#1d2b4b_0%,#162139_100%)] text-[#cdd5e1]">
      <Fita altura={7} />
      <FitasDiagonais />
      <div className="relative mx-auto grid max-w-[var(--casca-max)] gap-10 px-4 pb-10 pt-12 md:grid-cols-[1.25fr_1fr_1fr] md:px-[var(--casca-margem)]">
        <div className="space-y-4">
          <img src={letreiroNegativo} alt="Voto Aberto" className="h-11 w-auto" />
          <p className="max-w-[46ch] text-sm leading-relaxed">
            Viés político de estados e municípios, o custo de cada cadeira e a carreira de cada político desde
            1994, com dados abertos coletados, modelados e carregados pelo Grupo 7.
          </p>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[0.82rem] font-semibold text-white ring-1 ring-white/15">
            <span className="size-2 rounded-full bg-[#fbc700]" aria-hidden />
            Este não é um site oficial da Justiça Eleitoral.
          </p>
        </div>
        <div>
          <TituloRodape cor="#a2bd31">Fontes dos dados</TituloRodape>
          <ul className="space-y-2.5 text-sm leading-snug">
            <li><b className="font-semibold text-white">TSE</b>, Portal de Dados Abertos: candidaturas, votação, contas de campanha, fotos</li>
            <li><b className="font-semibold text-white">IBGE</b>: malhas municipais, PIB, população, Censo 2022, IPCA</li>
            <li><b className="font-semibold text-white">Atlas Brasil</b> (PNUD, Ipea, FJP): IDHM</li>
            <li><b className="font-semibold text-white">Harvard Dataverse</b>: ideologia dos partidos</li>
          </ul>
        </div>
        <div>
          <TituloRodape cor="#76acd0">Estados carregados no banco</TituloRodape>
          <ul className="flex flex-wrap gap-1.5" aria-label="Estados carregados">
            {carregadas.length ? (
              carregadas.map((u) => (
                <li key={u.sigla} title={u.nome} className="t-mono rounded-md bg-white/8 px-2 py-1 text-[0.82rem] font-semibold tracking-wider text-white ring-1 ring-white/15">
                  {u.sigla}
                </li>
              ))
            ) : (
              <li className="t-mono text-sm">...</li>
            )}
          </ul>
          <p className="mt-4 text-sm leading-relaxed">
            Os demais aparecem como <em>sem dados carregados</em>. Para incluir um estado:{' '}
            <code className="t-mono whitespace-nowrap rounded bg-black/25 px-1.5 py-0.5 text-white">python -m loader SP</code>
          </p>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <p className="mx-auto max-w-[var(--casca-max)] py-4 pl-4 pr-36 text-[0.78rem] text-[#9fabbf] sm:pr-4 md:px-[var(--casca-margem)]">
          Projeto acadêmico de Banco de Dados · Grupo 7 · 2026.2
        </p>
      </div>
    </footer>
  )
}

/** Cada módulo entra com uma subida curta; dentro do mesmo módulo (estado e município do mapa) não remonta. */
function EntradaDaPagina() {
  const modulo = useRouterState({ select: (s) => s.location.pathname.split('/')[1] })
  const chave = modulo === 'uf' ? '' : modulo === 'politico' ? 'urna' : modulo
  return (
    <div key={chave} className="pagina-entra">
      <Outlet />
    </div>
  )
}

export function Moldura() {
  const tour = useTour()
  // a sala de aula vale só nesta visita: quem fecha o projetor não volta com a letra gigante
  const [aula, setAula] = useState(false)
  useEffect(() => {
    if (aula) document.documentElement.setAttribute('data-aula', '1')
    else document.documentElement.removeAttribute('data-aula')
  }, [aula])
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-tinta focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <BarraUtilitaria aula={aula} aoAula={setAula} aoTour={tour.abrir} />
      <Cabecalho />
      <main id="conteudo" className="flex-1">
        <EntradaDaPagina />
      </main>
      {!aula && <Rodape />}
      {aula ? <ModoAula aoSair={() => setAula(false)} /> : <NestaPagina />}
      {tour.aberto && <Tour aoFechar={tour.fechar} />}
    </div>
  )
}
