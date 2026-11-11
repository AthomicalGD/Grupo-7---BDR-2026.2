// O balão das questões: um azulejo preso ao canto de baixo, à esquerda (o da direita é o "Nesta página"), que
// se abre num cartão com as perguntas do trabalho e leva à tela de cada uma. Liga e desliga na barra de cima
// ("Questões"); desligado, não aparece.
import { ArrowUpRight, Question, X } from '@phosphor-icons/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent as TeclaReact } from 'react'

type Para = '/' | '/urna' | '/cadeira' | '/cadeira/legenda' | '/escola' | '/idade' | '/indices' | '/patrimonio' | '/repasses' | '/reeleicao' | '/segundo-turno' | '/comparar'
interface QuestaoItem { codigo: string; pergunta: string; tela: string; para: Para; ativa: (p: string) => boolean }

const QUESTOES: QuestaoItem[] = [
  { codigo: 'P1', pergunta: 'Quanto custa uma cadeira?', tela: 'Cadeira', para: '/cadeira', ativa: (p) => p.startsWith('/cadeira') && !p.startsWith('/cadeira/legenda') },
  { codigo: 'P2', pergunta: 'Quem declara mais bens se elege mais?', tela: 'Patrimônio', para: '/patrimonio', ativa: (p) => p.startsWith('/patrimonio') },
  { codigo: 'P3', pergunta: 'Os índices do município explicam o voto?', tela: 'Índices', para: '/indices', ativa: (p) => p.startsWith('/indices') },
  { codigo: 'P4', pergunta: 'Quanto estudou quem senta na cadeira?', tela: 'Escola', para: '/escola', ativa: (p) => p.startsWith('/escola') },
  { codigo: 'P5', pergunta: 'Como os partidos preencheram as cadeiras?', tela: 'Legenda', para: '/cadeira/legenda', ativa: (p) => p.startsWith('/cadeira/legenda') },
  { codigo: 'P6', pergunta: 'Jovem vota no jovem?', tela: 'Idade', para: '/idade', ativa: (p) => p.startsWith('/idade') },
  { codigo: 'P7', pergunta: 'Para onde o voto pendeu?', tela: 'Mapa', para: '/', ativa: (p) => p === '/' || p.startsWith('/uf') },
  { codigo: 'P8', pergunta: 'Quem depende de dinheiro público se elege mais?', tela: 'Repasses', para: '/repasses', ativa: (p) => p.startsWith('/repasses') },
  { codigo: 'P10', pergunta: 'Qual é a carreira de um político?', tela: 'Urna', para: '/urna', ativa: (p) => p.startsWith('/urna') || p.startsWith('/politico') },
  { codigo: 'P10a', pergunta: 'Quem tenta a reeleição, volta?', tela: 'Reeleição', para: '/reeleicao', ativa: (p) => p.startsWith('/reeleicao') },
  { codigo: 'Extra', pergunta: 'O que muda no 2º turno?', tela: '2º turno', para: '/segundo-turno', ativa: (p) => p.startsWith('/segundo-turno') },
  { codigo: 'Extra', pergunta: 'Um político contra o outro', tela: 'Comparar', para: '/comparar', ativa: (p) => p.startsWith('/comparar') },
]
// a pastilha de cada questão alterna as três cores do azulejo, como as contas sob os títulos
const PASTILHA = [
  { fundo: 'var(--azul)', letra: '#fff' },
  { fundo: 'var(--amarelo)', letra: '#121417' },
  { fundo: 'var(--vermelho)', letra: '#fff' },
]

export function Questoes() {
  const caminho = useRouterState({ select: (s) => s.location.pathname })
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const id = useId()
  const calmo = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // trocar de tela fecha o balão
  useEffect(() => setAberto(false), [caminho])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAberto(false)
      botao.current?.focus()
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    // o foco entra na questão da tela atual (ou na primeira), para o teclado seguir dali
    requestAnimationFrame(() => (raiz.current?.querySelector<HTMLAnchorElement>('nav a[aria-current="page"]') ?? raiz.current?.querySelector<HTMLAnchorElement>('nav a'))?.focus())
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  // setas sobem e descem na lista
  const teclado = (e: TeclaReact) => {
    const passo = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!passo) return
    e.preventDefault()
    const links = [...(raiz.current?.querySelectorAll<HTMLAnchorElement>('nav a') ?? [])]
    const i = links.indexOf(document.activeElement as HTMLAnchorElement)
    links[(i + passo + links.length) % links.length]?.focus()
  }

  return (
    <div ref={raiz} className="fixed bottom-5 left-5 z-40 max-sm:bottom-3 max-sm:left-3">
      <AnimatePresence>
        {aberto && (
          <motion.nav
            id={id}
            aria-label="Questões do trabalho"
            onKeyDown={teclado}
            className="questoes-cartao absolute bottom-[calc(100%+12px)] left-0 w-[min(372px,calc(100vw-24px))] overflow-hidden rounded-[18px] border-[3px] border-tinta bg-folha"
            // o cartão se desdobra a partir do canto do botão
            initial={calmo ? { opacity: 0 } : { clipPath: 'inset(100% 100% 0% 0% round 18px)', opacity: 0.6 }}
            animate={calmo ? { opacity: 1 } : { clipPath: 'inset(0% 0% 0% 0% round 18px)', opacity: 1 }}
            exit={calmo ? { opacity: 0 } : { clipPath: 'inset(100% 100% 0% 0% round 18px)', opacity: 0.6, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="faixa-questoes" aria-hidden />
            <p className="px-4 pb-1.5 pt-3 font-[var(--font-display)] text-[1.05rem] font-extrabold text-tinta">Ir para uma questão</p>
            <ol className="max-h-[min(62dvh,520px)] overflow-y-auto px-2 pb-2">
              {QUESTOES.map((q, i) => {
                const aqui = q.ativa(caminho)
                const p = PASTILHA[i % PASTILHA.length]
                return (
                  <motion.li
                    key={q.para}
                    initial={calmo ? false : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.32, delay: 0.08 + i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      to={q.para}
                      aria-current={aqui ? 'page' : undefined}
                      onClick={() => setAberto(false)}
                      className={`group grid grid-cols-[3.4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-acao ${aqui ? 'bg-acao-claro' : 'hover:bg-papel-2'}`}
                    >
                      <span className="grid h-8 place-items-center rounded-full border-2 border-tinta text-[0.78rem] font-extrabold tabular" style={{ background: p.fundo, color: p.letra }}>
                        {q.codigo}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[0.92rem] font-semibold leading-snug ${aqui ? 'text-tinta' : 'text-tinta group-hover:text-tinta'}`}>{q.pergunta}</span>
                        <span className="block text-[0.76rem] text-tinta-3">{aqui ? `Você está aqui · ${q.tela}` : q.tela}</span>
                      </span>
                      <ArrowUpRight size={16} weight="bold" aria-hidden className={`text-tinta-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-tinta ${aqui ? 'invisible' : ''}`} />
                    </Link>
                  </motion.li>
                )
              })}
            </ol>
            <Link to="/metodologia" onClick={() => setAberto(false)}
              className="block border-t-2 border-linha px-4 py-2.5 text-[0.82rem] font-semibold text-acao hover:underline focus-visible:outline-[3px] focus-visible:outline-acao">
              Como cada uma foi respondida: a metodologia
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
      <motion.button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={aberto ? 'Fechar as questões' : 'Abrir as questões'}
        title="Questões"
        onClick={() => setAberto((a) => !a)}
        whileTap={calmo ? undefined : { scale: 0.92 }}
        className={`questoes-botao relative grid size-[52px] place-items-center rounded-full border-[3px] border-tinta transition-colors max-sm:size-12 ${aberto ? 'bg-tinta text-folha' : 'bg-[var(--azul)] text-white hover:bg-[#153a77]'}`}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={aberto ? 'x' : 'q'} className="grid place-items-center"
            initial={calmo ? false : { rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={calmo ? undefined : { rotate: 90, scale: 0.5, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}>
            {aberto ? <X size={22} weight="bold" aria-hidden /> : <Question size={26} weight="bold" aria-hidden />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
