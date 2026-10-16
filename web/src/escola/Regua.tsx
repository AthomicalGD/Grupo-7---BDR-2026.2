// A régua do eleitor ao eleito: quem votou, quem se candidatou e quem se elegeu, cada um numa barra de
// 100 partes nos 8 graus (do analfabeto, à esquerda, ao superior completo, na ponta direita, onde fica o
// capelo). Entre uma barra e a seguinte, uma fita liga o grau em destaque: dá para ver a fatia crescer
// ou encolher do eleitor ao eleito sem ler número nenhum. Escolher um grau (na chave ou na barra) acende
// a fatia dele nas três barras e diz os três números.
import { useInView } from 'motion/react'
import { useRef } from 'react'
import { pct } from '../lib/formato'
import { GraduationCap } from '@phosphor-icons/react'
import { alfa, cor, porCento, SUPERIOR } from './escolaridade'

export interface Grupo {
  titulo: string
  /** total do grupo, já escrito ("25,8 mi de pessoas") */
  total: string
  /** contagem por grau, 8 posições */
  valores: number[]
}

const GRAUS = [1, 2, 3, 4, 5, 6, 7, 8]
const FITA = 34 // altura do vão entre as barras, onde passa a fita

/** Onde começa e termina o grau g na barra, em % (os graus anteriores somados). */
const trecho = (p: number[], g: number) => {
  const de = p.slice(0, g - 1).reduce((s, x) => s + x, 0)
  return [de, de + p[g - 1]] as const
}

export function Regua({ grupos, rotulos, chance, destaque, aoDestacar }: {
  grupos: [Grupo, Grupo, Grupo]
  rotulos: string[]
  /** eleitos ÷ candidatos de cada grau, em % */
  chance: (number | null)[]
  destaque: number
  aoDestacar: (nivel: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.25 })
  const partes = grupos.map((g) => porCento(g.valores))
  const r = rotulos[destaque - 1]
  return (
    <div>
      <div role="radiogroup" aria-label="Grau de escolaridade em destaque" className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {GRAUS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === destaque}
            onClick={() => aoDestacar(n)}
            className={`inline-flex h-8 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[0.8rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao ${n === destaque ? 'border-tinta bg-folha font-bold text-tinta' : 'border-transparent text-tinta-2 hover:text-tinta'}`}
          >
            <span className="size-3 shrink-0 rounded-[3px] border border-tinta/20" style={{ background: cor(n) }} aria-hidden />
            {rotulos[n - 1]}
            {n === SUPERIOR && <GraduationCap size={15} weight="fill" className="-mr-0.5 text-tinta" aria-hidden />}
          </button>
        ))}
      </div>

      <div ref={ref} className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 sm:grid-cols-[10.5rem_minmax(0,1fr)_8.5rem] sm:gap-x-6">
        {grupos.map((g, i) => {
          const n = Math.round(partes[i][destaque - 1])
          const [de, ate] = trecho(partes[i], destaque)
          const proxima = partes[i + 1]
          const atraso = i * 260
          return (
            <div key={g.titulo} className="contents">
              <p className="self-center max-sm:col-span-2 max-sm:mb-1.5">
                <span className="t-h3 block">{g.titulo}</span>
                <span className="tabular block text-[0.8rem] text-tinta-3">{g.total}</span>
              </p>
              <div className="relative self-center">
                <div
                  role="img"
                  aria-label={`${g.titulo}: ${n}% com ${r.toLowerCase()}`}
                  className={`flex h-9 overflow-hidden rounded-md ${visto ? 'revela-esquerda' : 'opacity-0'}`}
                  style={{ animationDelay: `${atraso}ms` }}
                >
                  {GRAUS.map((grau) =>
                    partes[i][grau - 1] > 0 ? (
                      <button
                        key={grau}
                        type="button"
                        tabIndex={-1}
                        title={`${rotulos[grau - 1]}: ${pct(partes[i][grau - 1])}`}
                        onClick={() => aoDestacar(grau)}
                        className="h-full border-r border-folha/80 transition-[opacity,flex-basis] duration-500 last:border-r-0"
                        style={{ flexBasis: `${partes[i][grau - 1]}%`, background: cor(grau), opacity: alfa(grau, destaque) }}
                      >
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
              <p className="flex items-baseline gap-1.5 self-center max-sm:row-span-1">
                <span className="t-numero tabular text-[clamp(1.6rem,1.2rem+1vw,2.2rem)] transition-colors" style={{ color: destaque === SUPERIOR && i === 2 ? 'var(--color-tinta)' : undefined }}>{n}%</span>
              </p>
              {proxima && (
                <>
                  <span className="max-sm:hidden" />
                  <svg
                    viewBox={`0 0 100 ${FITA}`}
                    preserveAspectRatio="none"
                    height={FITA}
                    aria-hidden
                    className={`block w-full max-sm:col-span-1 ${visto ? 'surge' : 'opacity-0'}`}
                    style={{ animationDelay: `${atraso + 520}ms` }}
                  >
                    {(() => {
                      const [de2, ate2] = trecho(proxima, destaque)
                      return (
                        <path
                          d={`M${de},0 L${ate},0 C${ate},${FITA / 2} ${ate2},${FITA / 2} ${ate2},${FITA} L${de2},${FITA} C${de2},${FITA / 2} ${de},${FITA / 2} ${de},0 Z`}
                          fill={cor(destaque)}
                          opacity={0.32}
                          className="transition-[d] duration-500"
                        />
                      )
                    })()}
                  </svg>
                  <span />
                </>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-tinta-3 sm:pl-[12rem]">
        <span>← analfabeto</span>
        <span className="ml-auto sm:ml-0">superior completo →</span>
        <span className="basis-full sm:basis-auto">A fita liga o grau em destaque de uma barra à seguinte.</span>
      </p>

      <p aria-live="polite" className="mt-4 max-w-[78ch] text-[0.98rem] leading-relaxed text-tinta-2">
        <b className="text-tinta">{r}:</b> {pct(partes[0][destaque - 1])} de quem votou, {pct(partes[1][destaque - 1])} dos candidatos e{' '}
        {pct(partes[2][destaque - 1])} dos eleitos.
        {chance[destaque - 1] != null && (
          <> Dos candidatos com esse grau, <b className="tabular text-tinta">{Math.round(chance[destaque - 1]!)}%</b> se elegeram.</>
        )}
      </p>
    </div>
  )
}
