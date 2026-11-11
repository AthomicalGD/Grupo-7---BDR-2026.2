// 1º ou 2º turno no mapa do viés: duas casas e uma marca que desliza de uma para a outra.
import { motion } from 'motion/react'
import type { Turno } from '../api'

const TURNOS: { t: Turno; nome: string; nota: string }[] = [
  { t: 1, nome: '1º turno', nota: 'todos os cargos' },
  { t: 2, nome: '2º turno', nota: 'onde houve' },
]

export function SeletorTurno({ turno, aoMudar }: { turno: Turno; aoMudar: (t: Turno) => void }) {
  return (
    <div role="radiogroup" aria-label="Turno" className="relative grid grid-cols-2 rounded-xl bg-papel p-1">
      {TURNOS.map(({ t, nome, nota }) => {
        const marcado = t === turno
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={marcado}
            onClick={() => aoMudar(t)}
            className={`relative z-0 rounded-lg px-3 py-1.5 text-left leading-tight transition-colors ${marcado ? 'text-folha' : 'text-tinta-2 hover:text-tinta'}`}
          >
            {marcado && (
              <motion.span
                layoutId="turno-marca"
                className="absolute inset-0 -z-10 rounded-lg bg-acao shadow-[0_6px_14px_-8px_var(--color-acao)]"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                aria-hidden
              />
            )}
            <span className="block whitespace-nowrap text-[0.9rem] font-bold">{nome}</span>
            <span className={`block whitespace-nowrap text-[0.7rem] ${marcado ? 'text-folha/80' : 'text-tinta-3'}`}>{nota}</span>
          </button>
        )
      })}
    </div>
  )
}
