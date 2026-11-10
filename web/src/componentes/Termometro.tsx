// O termômetro da correlação (r de Pearson, de -1 a +1): sete peças encaixadas, como o azulejo, com os limiares de
// Cohen (0,1 / 0,3 / 0,5); o marcador amarelo mostra onde cai o r e o rótulo diz em palavras. Rótulos nas pontas, sem legenda.
import { decimal } from '../lib/formato'

const PEDACOS = [
  { de: -1, ate: -0.5, nome: 'forte' }, { de: -0.5, ate: -0.3, nome: 'moderada' }, { de: -0.3, ate: -0.1, nome: 'fraca' },
  { de: -0.1, ate: 0.1, nome: 'quase nenhuma' },
  { de: 0.1, ate: 0.3, nome: 'fraca' }, { de: 0.3, ate: 0.5, nome: 'moderada' }, { de: 0.5, ate: 1, nome: 'forte' },
]
// de fora para dentro: quanto mais forte, mais cobalto
const TOM = ['100%', '66%', '36%', '0%', '36%', '66%', '100%']

export function Termometro({ r, esquerda, direita, descricao }: { r: number | null; esquerda: string; direita: string; descricao: string }) {
  const pos = r == null ? null : Math.min(94, Math.max(6, ((r + 1) / 2) * 100))
  const sinal = (v: number) => `${v < 0 ? '−' : '+'}${decimal(Math.abs(v), 2)}`
  return (
    <figure className="mt-5 max-w-[34rem]" aria-label={descricao}>
      <div role="img" aria-label={descricao} className="relative pt-9">
        {pos != null && r != null && (
          <div className="absolute top-0 z-10 -translate-x-1/2 text-center" style={{ left: `${pos}%` }}>
            <span className="peca peca-amarela tabular block rounded-[10px] px-2 py-0.5 text-[0.9rem] font-black leading-tight">r = {sinal(r)}</span>
            <span className="mx-auto block h-3 w-[3px] bg-tinta" />
          </div>
        )}
        <div className="flex h-7 gap-[3px] overflow-hidden rounded-[8px] border-[3px] border-tinta bg-tinta">
          {PEDACOS.map((p, i) => (
            <span
              key={i}
              className="block h-full"
              style={{
                width: `${((p.ate - p.de) / 2) * 100}%`,
                background: i === 3 ? 'var(--color-papel-2)' : `color-mix(in oklab, var(--azul) ${TOM[i]}, var(--color-folha))`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[0.8rem] leading-tight text-tinta-2">
        <span className="max-w-[10rem]">← {esquerda}</span>
        <span className="text-center text-tinta-3">sem relação</span>
        <span className="max-w-[10rem] text-right">{direita} →</span>
      </div>
    </figure>
  )
}
