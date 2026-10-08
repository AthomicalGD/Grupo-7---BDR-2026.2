// A peneira da urna: oito fitas, uma por grau de escolaridade, escorrendo de quem votou para quem
// se candidatou e para quem se elegeu. A largura de cada fita em cada poste é a parte daquele grau
// no grupo; as de cima (superior) engrossam e as de baixo afinam até sumir. Passar o mouse ou o
// foco por um grau destaca a fita e mostra os três números; sem interação, o destaque é o superior.
import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { decimal, pct } from '../lib/formato'
import { cor, porCento, SUPERIOR, useLargura } from './escolaridade'

export interface Poste {
  titulo: string
  /** total do grupo, já escrito ("7,7 mi de pessoas"), e a versão curta para tela estreita */
  total: string
  curto: string
  /** contagem por grau, 8 posições */
  valores: number[]
}

const GRAUS = [8, 7, 6, 5, 4, 3, 2, 1] // de cima para baixo
const FOLGA = 2 // px entre os trechos de um poste

/** Afasta rótulos que se encostariam: desce os que estão perto demais e, se passar do fim, sobe. */
function espalhar(ys: number[], minimo: number, fim: number): number[] {
  const r = [...ys]
  for (let i = 1; i < r.length; i++) r[i] = Math.max(r[i], r[i - 1] + minimo)
  for (let i = r.length - 1; i >= 0; i--) r[i] = Math.min(r[i], (i === r.length - 1 ? fim : r[i + 1] - minimo))
  return r
}

export function Peneira({ postes, rotulos, chance, destaque, aoDestacar, chave }: {
  postes: [Poste, Poste, Poste]
  rotulos: string[]
  /** eleitos ÷ candidatos de cada grau, em % */
  chance: (number | null)[]
  destaque: number
  aoDestacar: (nivel: number) => void
  /** muda quando o recorte muda: a peneira escorre de novo */
  chave: string
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const reduzir = useReducedMotion()
  const estreito = largura < 760
  const W = Math.max(largura, 300)
  const ESQ = estreito ? 0 : 214 // nomes dos graus
  const DIR = estreito ? 60 : 132 // % dos eleitos
  const POSTE = estreito ? 16 : 24
  const TOPO = 62
  const H = estreito ? 300 : 392
  const xs = [ESQ, ESQ + (W - ESQ - DIR - POSTE) / 2, W - DIR - POSTE]

  const partes = useMemo(() => postes.map((p) => porCento(p.valores)), [postes])
  // trechos de cada poste, de cima (superior) para baixo
  const trechos = useMemo(() => {
    const util = H - FOLGA * (GRAUS.length - 1)
    return partes.map((p) => {
      let y = TOPO
      const t: Record<number, { y0: number; y1: number }> = {}
      for (const n of GRAUS) {
        const h = (p[n - 1] / 100) * util
        t[n] = { y0: y, y1: y + h }
        y += h + FOLGA
      }
      return t
    })
  }, [partes, H])

  const fita = (n: number, a: number) => {
    const A = trechos[a][n], B = trechos[a + 1][n]
    const x0 = xs[a] + POSTE, x1 = xs[a + 1], m = (x0 + x1) / 2
    return `M${x0},${A.y0}C${m},${A.y0} ${m},${B.y0} ${x1},${B.y0}L${x1},${B.y1}C${m},${B.y1} ${m},${A.y1} ${x0},${A.y1}Z`
  }
  const meio = (a: number, n: number) => (trechos[a][n].y0 + trechos[a][n].y1) / 2
  const rotEsq = espalhar(GRAUS.map((n) => meio(0, n)), 17, TOPO + H - 6)
  const visiveisDir = GRAUS.filter((n) => partes[2][n - 1] >= 1.5 || n === destaque)
  const rotDir = espalhar(visiveisDir.map((n) => meio(2, n)), 16, TOPO + H - 6)
  const d = destaque
  const altura = TOPO + H + 10

  return (
    <div>
      <div ref={ref} className="relative select-none" style={{ height: altura }}>
        {largura > 0 && (
          <svg width={W} height={altura} role="img" aria-label={`Peneira: ${postes.map((p, i) => `${p.titulo}, ${pct(partes[i][SUPERIOR - 1])} com superior completo`).join('; ')}`}>
            <defs>
              <clipPath id={`escorre-${chave}`}>
                <motion.rect
                  key={chave}
                  x={0}
                  y={0}
                  width={W}
                  height={altura}
                  style={{ transformOrigin: '0px 0px' }}
                  initial={reduzir ? false : { scaleX: 0.04 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1] }}
                />
              </clipPath>
            </defs>

            {/* cabeçalhos dos postes */}
            {postes.map((p, a) => {
              // estreito: só o número, centrado no poste do meio e encostado na borda no último
              const ancora = a === 0 ? 'start' : a === 1 ? (estreito ? 'middle' : 'start') : 'end'
              const x = a === 0 ? xs[0] : a === 1 ? (estreito ? xs[1] + POSTE / 2 : xs[1]) : estreito ? W - 2 : xs[2] + POSTE
              return (
                <g key={p.titulo} textAnchor={ancora}>
                  <text x={x} y={22} className={`fill-tinta font-bold ${estreito ? 'text-[0.86rem]' : 'text-[0.95rem]'}`}>{p.titulo}</text>
                  <text x={x} y={42} className="tabular fill-tinta-3 text-[0.8rem]">{estreito ? p.curto : p.total}</text>
                </g>
              )
            })}

            <g clipPath={`url(#escorre-${chave})`}>
              {[0, 1].map((a) =>
                GRAUS.map((n) => (
                  <path
                    key={`${a}-${n}`}
                    d={fita(n, a)}
                    fill={cor(n)}
                    opacity={n === d ? 0.96 : 0.5}
                    className="cursor-pointer transition-opacity duration-300"
                    onPointerEnter={() => aoDestacar(n)}
                  />
                )),
              )}
              {trechos.map((t, a) =>
                GRAUS.map((n) =>
                  t[n].y1 - t[n].y0 > 0.3 ? (
                    <rect key={`${a}-${n}`} x={xs[a]} y={t[n].y0} width={POSTE} height={t[n].y1 - t[n].y0} fill={cor(n)} rx={1.5} onPointerEnter={() => aoDestacar(n)} />
                  ) : null,
                ),
              )}
              {/* o grau em destaque ganha um contorno nos três postes */}
              {trechos.map((t, a) =>
                t[d].y1 - t[d].y0 > 0.3 ? (
                  <rect key={`d${a}`} x={xs[a] - 2} y={t[d].y0 - 2} width={POSTE + 4} height={t[d].y1 - t[d].y0 + 4} rx={3} fill="none" stroke="var(--color-tinta)" strokeWidth={1.5} pointerEvents="none" />
                ) : null,
              )}
            </g>

            {/* % dos eleitos à direita; o destaque em grande */}
            {visiveisDir.map((n, i) => (
              <text
                key={n}
                x={xs[2] + POSTE + 10}
                y={rotDir[i] + (n === d ? 9 : 4)}
                className={n === d ? `t-numero fill-tinta ${estreito ? 'text-[1.3rem]' : 'text-[1.65rem]'}` : 'tabular fill-tinta-3 text-[0.8rem]'}
              >
                {n === d ? `${Math.round(partes[2][n - 1])}%` : `${decimal(partes[2][n - 1])}%`}
              </text>
            ))}

            {/* o destaque nos dois primeiros postes */}
            {[0, 1].map((a) => {
              const y = meio(a, d)
              const v = partes[a][d - 1]
              return (
                <g key={a} pointerEvents="none">
                  <rect x={xs[a] + POSTE + 6} y={y - 15} width={estreito ? 46 : 58} height={30} rx={6} fill="var(--color-folha)" opacity={0.94} />
                  <text x={xs[a] + POSTE + 12} y={y + 8} className={`t-numero fill-tinta ${estreito ? 'text-[1.1rem]' : 'text-[1.45rem]'}`}>
                    {Math.round(v)}%
                  </text>
                </g>
              )
            })}
          </svg>
        )}
        {/* largo: os nomes dos graus ficam à esquerda do primeiro poste, na altura do seu trecho */}
        {!estreito && largura > 0 && (
          <div role="radiogroup" aria-label="Grau de escolaridade em destaque">
            {GRAUS.map((n, i) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === d}
                onPointerEnter={() => aoDestacar(n)}
                onClick={() => aoDestacar(n)}
                onFocus={() => aoDestacar(n)}
                className={`absolute flex h-[18px] items-center justify-end gap-1.5 whitespace-nowrap rounded px-1 text-[0.8rem] leading-none focus-visible:outline-2 focus-visible:outline-acao ${n === d ? 'font-bold text-tinta' : 'text-tinta-2 hover:text-tinta'}`}
                style={{ top: rotEsq[i] - 9, right: W - ESQ + 8 }}
              >
                {rotulos[n - 1]}
                <span className="tabular w-[2.6rem] text-right font-normal text-tinta-3">{decimal(partes[0][n - 1])}%</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* estreito: os nomes viram uma legenda que também escolhe o grau */}
      {estreito && (
        <div role="radiogroup" aria-label="Grau de escolaridade em destaque" className="mt-3 grid grid-cols-2 gap-1">
          {GRAUS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === d}
              onClick={() => aoDestacar(n)}
              onFocus={() => aoDestacar(n)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8rem] focus-visible:outline-2 focus-visible:outline-acao ${n === d ? 'bg-folha font-bold text-tinta' : 'text-tinta-2'}`}
            >
              <span className="size-3 shrink-0 rounded-[3px]" style={{ background: cor(n) }} aria-hidden />
              {rotulos[n - 1]}
            </button>
          ))}
        </div>
      )}

      <p aria-live="polite" className="mt-4 max-w-[78ch] text-[0.98rem] leading-relaxed text-tinta-2">
        <b className="text-tinta">{rotulos[d - 1]}:</b> {pct(partes[0][d - 1])} de quem votou, {pct(partes[1][d - 1])} dos candidatos e{' '}
        {pct(partes[2][d - 1])} dos eleitos.
        {chance[d - 1] != null && (
          <> De cada 100 candidatos com esse grau, <b className="tabular text-tinta">{Math.round(chance[d - 1]!)}</b> se elegeram.</>
        )}
      </p>
    </div>
  )
}
