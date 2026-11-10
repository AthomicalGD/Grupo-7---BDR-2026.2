// O veredito: a resposta da pergunta da tela numa peça de azulejo colorida (a palavra, em League Spartan) ao lado
// de uma frase curta em linguagem de jornal. Serve às três telas das questões novas (P3, P5, P6).
import type { ReactNode } from 'react'

const TOM = { amarelo: 'peca-amarela', azul: 'peca-azul', vermelho: 'peca-vermelha', branco: '' } as const

export function Veredito({ palavra, tom = 'amarelo', grande = false, empilhado = false, children }: {
  palavra: ReactNode
  tom?: keyof typeof TOM
  /** o veredito do topo da página (maior) */
  grande?: boolean
  /** peça em cima e frase embaixo (para colunas estreitas) */
  empilhado?: boolean
  children: ReactNode
}) {
  return (
    <div className={`mt-4 grid items-stretch gap-x-5 gap-y-3 ${empilhado ? '' : 'sm:grid-cols-[auto_minmax(0,1fr)]'}`}>
      <p
        className={`peca ${TOM[tom]} grid place-items-center px-5 py-3 text-center font-[family-name:var(--font-display)] font-black leading-[0.95] tracking-[-0.03em] ${empilhado ? 'justify-self-start' : 'sm:min-w-[9rem]'} ${
          grande ? 'text-[clamp(2.2rem,1.4rem+3vw,3.6rem)]' : 'text-[clamp(1.6rem,1.2rem+1.4vw,2.3rem)]'
        }`}
      >
        {palavra}
      </p>
      <div className="apoio self-center text-[clamp(1.02rem,0.95rem+0.3vw,1.18rem)] leading-[1.5] text-tinta-2">{children}</div>
    </div>
  )
}
