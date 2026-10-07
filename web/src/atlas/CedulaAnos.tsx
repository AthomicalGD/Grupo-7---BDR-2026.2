// Seletor de ano em forma de cédula: quatro casas que se marcam com um X.
// "Linha do tempo" percorre 2018 → 2024 e para no último ano.
import { Pause, Play } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ANOS, type Ano } from '../api'

const TIPO: Record<Ano, string> = { 2018: 'Geral', 2020: 'Municipal', 2022: 'Geral', 2024: 'Municipal' }
const PASSO_MS = 1600

export function CedulaAnos({ ano, aoMudar, anos = ANOS, linhaDoTempo = true }: {
  ano: Ano
  aoMudar: (a: Ano) => void
  /** Só os anos que valem aqui (a P1 mostra os dois anos do tipo de eleição do cargo). */
  anos?: readonly Ano[]
  linhaDoTempo?: boolean
}) {
  const [tocando, setTocando] = useState(false)
  const atual = useRef(ano)
  useEffect(() => {
    atual.current = ano
  }, [ano])

  useEffect(() => {
    if (!tocando) return
    if (atual.current === anos[anos.length - 1]) aoMudar(anos[0])
    const id = setInterval(() => {
      const i = anos.indexOf(atual.current)
      if (i >= anos.length - 1) return setTocando(false)
      aoMudar(anos[i + 1])
    }, PASSO_MS)
    return () => clearInterval(id)
  }, [tocando, aoMudar, anos])

  const teclado = (e: KeyboardEvent) => {
    const i = anos.indexOf(ano)
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const proximo = anos[(i + delta + anos.length) % anos.length]
    aoMudar(proximo)
    document.getElementById(`cedula-${proximo}`)?.focus()
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-linha bg-folha p-1.5 pr-2 shadow-[var(--shadow-cartao)]">
      <div role="radiogroup" aria-label="Ano da eleição" className="grid flex-1 grid-cols-2 sm:flex sm:flex-wrap" onKeyDown={teclado}>
        {anos.map((a) => {
          const marcado = a === ano
          return (
            <button
              key={a}
              id={`cedula-${a}`}
              type="button"
              role="radio"
              aria-checked={marcado}
              tabIndex={marcado ? 0 : -1}
              onClick={() => {
                setTocando(false)
                aoMudar(a)
              }}
              className="group flex min-w-[104px] flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-papel"
            >
              <span className="relative grid size-[22px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-tinta bg-folha">
                <svg viewBox="0 0 22 22" className="absolute inset-0" aria-hidden>
                  {marcado && (
                    <>
                      <motion.path d="M5 5 L17 17" stroke="var(--color-tinta)" strokeWidth={2.6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.18, ease: 'easeOut' }} />
                      <motion.path d="M17 5 L5 17" stroke="var(--color-tinta)" strokeWidth={2.6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.18, delay: 0.14, ease: 'easeOut' }} />
                    </>
                  )}
                </svg>
              </span>
              <span className="leading-tight">
                <span className={`block tabular text-[1rem] ${marcado ? 'font-bold' : 'font-semibold text-tinta-2'}`}>{a}</span>
                <span className="block text-[0.74rem] text-tinta-3">{TIPO[a]}</span>
              </span>
            </button>
          )
        })}
      </div>
      {linhaDoTempo && <button
        type="button"
        onClick={() => setTocando((t) => !t)}
        aria-pressed={tocando}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-tinta px-4 text-[0.85rem] font-semibold whitespace-nowrap text-white transition-transform hover:bg-[#2a3442] active:scale-[0.97] sm:w-auto"
      >
        {tocando ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
        Linha do tempo
      </button>}
    </div>
  )
}
