// "Nesta página": nas páginas longas (Escola, Reeleição, Cadeira, Patrimônio, Metodologia), um botão preso ao
// canto abre a lista das seções e diz em qual se está. Aparece depois da primeira tela, quando já há o que pular.
import { ListBullets } from '@phosphor-icons/react'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { semAcento } from '../lib/formato'

interface Secao {
  id: string
  texto: string
}

function lerSecoes(): Secao[] {
  return [...document.querySelectorAll<HTMLElement>('main h2')]
    .filter((h) => h.offsetParent !== null && h.textContent?.trim())
    .map((h) => {
      // título sem id ganha um, do próprio texto, para a âncora
      if (!h.id) h.id = 's-' + semAcento(h.textContent!).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
      return { id: h.id, texto: h.textContent!.trim() }
    })
}

export function NestaPagina() {
  const caminho = useRouterState({ select: (s) => s.location.pathname })
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [atual, setAtual] = useState('')
  const [visivel, setVisivel] = useState(false)
  // aberto vale para a página em que foi aberto: trocar de página fecha sem efeito
  const [abertoEm, setAbertoEm] = useState<string | null>(null)
  const aberto = abertoEm === caminho
  const setAberto = (v: boolean | ((a: boolean) => boolean)) => setAbertoEm((typeof v === 'function' ? v(aberto) : v) ? caminho : null)
  const raiz = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    let quadro = 0
    const olhar = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        const s = lerSecoes()
        setSecoes((antes) => (antes.length === s.length && antes.every((x, i) => x.id === s[i].id) ? antes : s))
        setVisivel(window.scrollY > window.innerHeight * 0.8)
        // a seção atual é a última cujo título já passou do terço de cima da tela
        const corte = window.innerHeight / 3
        let aqui = ''
        for (const x of s) if ((document.getElementById(x.id)?.getBoundingClientRect().top ?? 1e9) < corte) aqui = x.id
        setAtual(aqui)
      })
    }
    const t = setTimeout(olhar, 800)
    window.addEventListener('scroll', olhar, { passive: true })
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(quadro)
      window.removeEventListener('scroll', olhar)
    }
  }, [caminho])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAbertoEm(null)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbertoEm(null)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  if (secoes.length < 3 || !visivel) return null
  const ir = (s: Secao) => {
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const el = document.getElementById(s.id)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: reduz ? 'auto' : 'smooth' })
    setAberto(false)
    el?.setAttribute('tabindex', '-1')
    el?.focus({ preventScroll: true })
  }
  const daqui = secoes.find((s) => s.id === atual)
  return (
    <div ref={raiz} className="fixed bottom-5 right-5 z-40 max-sm:bottom-3 max-sm:right-3">
      {aberto && (
        <nav id={id} aria-label="Nesta página" className="absolute bottom-[calc(100%+8px)] right-0 max-h-[60dvh] w-[min(320px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-linha bg-folha p-2 shadow-[var(--shadow-papel)]">
          <ol>
            {secoes.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => ir(s)}
                  aria-current={s.id === atual ? 'location' : undefined}
                  className={`flex w-full rounded-lg px-3 py-2 text-left text-[0.92rem] leading-snug ${s.id === atual ? 'bg-selecao-claro font-semibold text-selecao-tinta' : 'text-tinta-2 hover:bg-papel hover:text-tinta'}`}
                >
                  {s.texto}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="flex max-w-[min(300px,calc(100vw-24px))] items-center gap-2 rounded-full border border-linha bg-folha py-2.5 pl-3.5 pr-4 text-[0.88rem] font-semibold text-tinta shadow-[var(--shadow-cartao)] hover:border-tinta"
      >
        <ListBullets size={17} weight="bold" aria-hidden className="shrink-0" />
        <span className="truncate">{daqui ? daqui.texto : 'Nesta página'}</span>
      </button>
    </div>
  )
}
