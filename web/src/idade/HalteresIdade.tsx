// Halteres por terço (atos 3 e 4), a gramática dos cinco grupos da P4: uma linha por terço, na mesma régua de idade;
// o aro em tinta é a idade de quem votou, o ponto cheio (sépia fundo) a idade dos votados ou dos eleitos, e a haste
// clara é a distância. Quando o alvo muda (o alternador "mesma escolaridade"), o ponto corre até o novo lugar
// (900 ms); na primeira vez, sai do aro.
import { useInView } from 'motion/react'
import { useRef } from 'react'
import type { Terco } from '../api'
import { anos, COR_TERCO, NOME_TERCO, SEPIA } from './sepia'

export interface LinhaHaltere {
  terco: Terco
  rotulo: string
  detalhe: string
  quemVotou: number
  alvo: number
  /** um ponto pequeno a mais (os candidatos, no ato 3) */
  extra?: number | null
}

const PONTO = SEPIA[5]

export function HalteresIdade({ linhas, rotuloAlvo, rotuloExtra, descricao }: {
  linhas: LinhaHaltere[]
  rotuloAlvo: string
  rotuloExtra?: string
  descricao: (l: LinhaHaltere) => string
}) {
  const ref = useRef<HTMLOListElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.3 })
  const valores = linhas.flatMap((l) => [l.quemVotou, l.alvo, l.extra ?? l.alvo])
  const de = Math.floor(Math.min(...valores) - 1)
  const ate = Math.ceil(Math.max(...valores) + 1)
  const marcas = Array.from({ length: ate - de + 1 }, (_, i) => de + i).filter((v) => (ate - de > 8 ? v % 2 === 0 : true))
  const x = (v: number) => `${(100 * (v - de)) / (ate - de)}%`
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.82rem] text-tinta-2">
        <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-full border-2 border-tinta-2 bg-folha" aria-hidden />quem votou</span>
        {rotuloExtra && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-tinta-3" aria-hidden />{rotuloExtra}</span>}
        <span className="flex items-center gap-1.5"><span className="size-4 rounded-full border-2 border-folha shadow-[0_0_0_1px_rgb(24_32_43/.2)]" style={{ background: PONTO }} aria-hidden />{rotuloAlvo}</span>
        <span className="text-tinta-3">idade média, em anos</span>
      </p>
      <ol ref={ref} className="mt-4 grid gap-y-1.5">
        {linhas.map((l, i) => {
          const [a, b] = [Math.min(l.quemVotou, l.alvo), Math.max(l.quemVotou, l.alvo)]
          return (
            <li key={l.terco} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-lg px-2 py-2 sm:grid-cols-[12.5rem_minmax(0,1fr)_7.5rem]">
              <p className="flex min-w-0 items-center gap-2.5 max-sm:col-span-2">
                <span className="h-9 w-2 shrink-0 rounded-full" style={{ background: COR_TERCO[l.terco], boxShadow: l.terco === 1 ? 'inset 0 0 0 1px rgb(24 32 43 / .2)' : undefined }} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[0.92rem] font-semibold leading-tight text-tinta">{l.rotulo}</span>
                  <span className="tabular block text-[0.74rem] text-tinta-3">{l.detalhe}</span>
                </span>
              </p>
              <div role="img" aria-label={descricao(l)} className="relative h-8 max-sm:mt-1">
                <span className="absolute inset-x-0 top-1/2 h-px bg-linha-2" />
                {marcas.map((t) => (
                  <span key={t} className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-linha-2" style={{ left: x(t) }} />
                ))}
                <span
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full transition-[left,width] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
                  style={{ left: x(visto ? a : l.quemVotou), width: `calc(${x(visto ? b : l.quemVotou)} - ${x(visto ? a : l.quemVotou)})`, background: PONTO, opacity: 0.22, transitionDelay: `${i * 120}ms` }}
                />
                {l.extra != null && <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tinta-3" style={{ left: x(l.extra) }} />}
                <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tinta-2 bg-folha" style={{ left: x(l.quemVotou) }} />
                <span
                  className="absolute top-1/2 size-[1.15rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-folha shadow-[0_0_0_1px_rgb(24_32_43/.25)] transition-[left] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
                  style={{ left: visto ? x(l.alvo) : x(l.quemVotou), background: PONTO, transitionDelay: `${i * 120}ms` }}
                />
              </div>
              <p className="justify-self-end text-right leading-tight">
                <span className="t-numero tabular block text-[1.6rem]">{anos(l.alvo)}</span>
                <span className="tabular block text-[0.74rem] text-tinta-3">quem votou: {anos(l.quemVotou)}</span>
              </p>
            </li>
          )
        })}
      </ol>
      <div className="tabular relative mt-1 hidden h-4 text-[0.72rem] text-tinta-3 sm:ml-[14rem] sm:mr-[9rem] sm:block" aria-hidden>
        {marcas.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>{t}</span>
        ))}
      </div>
      <span className="sr-only">{linhas.map((l) => `${NOME_TERCO[l.terco]}: ${anos(l.alvo)}`).join('; ')}</span>
    </div>
  )
}
