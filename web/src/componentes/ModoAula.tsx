// Modo sala de aula: letra grande, página larga, rodapé fora e as setas do teclado (ou o passador de slides,
// que manda PageDown/PageUp) pulam de seção em seção, como slides. Para projetar o site numa aula.
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import { useEffect } from 'react'

const TITULOS = 'main h1, main h2'

/** Vai para o título seguinte (ou anterior) ao topo da tela. */
function pular(direcao: 1 | -1) {
  const topo = 72 // a altura do cabeçalho fixo
  const titulos = [...document.querySelectorAll<HTMLElement>(TITULOS)].filter((t) => t.offsetParent !== null)
  const posicoes = titulos.map((t) => t.getBoundingClientRect().top - topo)
  const alvo = direcao === 1 ? titulos[posicoes.findIndex((p) => p > 8)] : titulos[posicoes.findLastIndex((p) => p < -8)]
  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (alvo) window.scrollBy({ top: alvo.getBoundingClientRect().top - topo - 12, behavior: reduz ? 'auto' : 'smooth' })
  else if (direcao === -1) window.scrollTo({ top: 0, behavior: reduz ? 'auto' : 'smooth' })
}

export function ModoAula({ aoSair }: { aoSair: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      // dentro de um campo, de um controle com setas próprias (plenário, gráficos) ou com modificador, a tecla é dele
      if (e.altKey || e.ctrlKey || e.metaKey || el.closest('input, textarea, select, [role="group"], [role="slider"], [role="dialog"], svg')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        pular(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        pular(-1)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  const botao = 'grid size-11 place-items-center rounded-full text-white hover:bg-white/15'
  return (
    <div role="toolbar" aria-label="Sala de aula" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-tinta px-2 py-1.5 text-white shadow-[var(--shadow-papel)]">
      <button type="button" onClick={() => pular(-1)} aria-label="Seção anterior" className={botao}>
        <CaretLeft size={20} weight="bold" aria-hidden />
      </button>
      <span className="px-2 text-[0.9rem] font-semibold">Sala de aula · ← → passam as seções</span>
      <button type="button" onClick={() => pular(1)} aria-label="Próxima seção" className={botao}>
        <CaretRight size={20} weight="bold" aria-hidden />
      </button>
      <span aria-hidden className="mx-1 h-6 w-px bg-white/25" />
      <button type="button" onClick={aoSair} aria-label="Sair do modo sala de aula" className={botao}>
        <X size={18} weight="bold" aria-hidden />
      </button>
    </div>
  )
}
