// Pílula de escolha única (cargo, estado): a marcada fica em tinta, como os alternadores.
import type { ReactNode } from 'react'

export function Escolha({ ativo, aoClicar, children, rotulo }: { ativo: boolean; aoClicar: () => void; children: ReactNode; rotulo?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      aria-label={rotulo}
      onClick={aoClicar}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[0.86rem] font-semibold whitespace-nowrap transition-[background-color,color,transform] active:scale-[0.97] ${ativo ? 'border-tinta bg-tinta text-white' : 'border-linha bg-folha text-tinta-2 hover:border-linha-2 hover:text-tinta'}`}
    >
      {children}
    </button>
  )
}
