// Gasto × chance de vitória: uma barra por faixa de gasto (escala log), altura = % de eleitos.
// Barra na mesma cor do plenário (o eixo x é o gasto). Faixas com menos de 5 candidatos ficam
// só no contorno: a taxa delas não diz nada.
import { memo, useId, useState } from 'react'
import type { Cadeira } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, pct, plural, reaisCurto } from '../lib/formato'
import { entrada, MINIMO, type EscalaGasto } from './geometria'

const W = 760, H = 290, m = { e: 44, d: 10, c: 40, b: 46 }

export const CurvaVitoria = memo(function CurvaVitoria({ curva, escala, fator }: { curva: Cadeira['curva']; escala: EscalaGasto; fator: number }) {
  const id = useId()
  const [foco, setFoco] = useState<number | null>(null)
  const n = curva.length
  const bw = (W - m.e - m.d) / Math.max(1, n)
  const x = (i: number) => m.e + i * bw
  const y = (taxa: number) => m.c + (1 - taxa) * (H - m.c - m.b)
  const limiar = entrada(curva)
  const iLimiar = limiar ? curva.indexOf(limiar) : -1
  const f = foco != null ? curva[foco] : null
  const faixa = (b: Cadeira['curva'][number]) => (b.de === 0 ? `até ${reaisCurto(b.ate * fator)}` : `de ${reaisCurto(b.de * fator)} a ${reaisCurto(b.ate * fator)}`)

  return (
    <figure className="m-0">
      {/* no celular o gráfico rola na horizontal em vez de encolher o texto */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      <div className="relative min-w-[600px] md:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-labelledby={`${id}-t`} onPointerLeave={() => setFoco(null)}>
          <title id={`${id}-t`}>
            {limiar ? `Metade ou mais dos candidatos se elegeu a partir de ${reaisCurto(limiar.de * fator)} de gasto.` : 'Em nenhuma faixa de gasto a maioria se elegeu.'}
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={m.e} x2={W - m.d} y1={y(t)} y2={y(t)} stroke={t === 0.5 ? 'var(--color-linha-2)' : 'var(--color-linha)'} strokeDasharray={t === 0.5 ? '4 4' : undefined} />
              <text x={m.e - 8} y={y(t) + 4} textAnchor="end" className="tabular fill-tinta-3 text-[11px]">{t * 100}%</text>
            </g>
          ))}
          {curva.map((b, i) => {
            const taxa = b.candidatos ? b.eleitos / b.candidatos : 0
            const confiavel = b.candidatos >= MINIMO
            const meio = b.de === 0 ? b.ate / 2 : Math.sqrt(b.de * b.ate)
            return (
              <g key={b.de}>
                <rect
                  x={x(i) + 2} y={y(taxa)} width={bw - 4} height={Math.max(1.5, y(0) - y(taxa))} rx={2}
                  fill={confiavel ? escala.cor(meio) : 'none'}
                  stroke={confiavel ? 'none' : 'var(--color-linha-2)'} strokeDasharray={confiavel ? undefined : '3 3'}
                  opacity={foco == null || foco === i ? 1 : 0.45}
                />
                {i % 2 === 0 && (
                  <text x={x(i) + bw / 2} y={H - m.b + 16} textAnchor="middle" className="tabular fill-tinta-3 text-[10.5px]">
                    {b.de === 0 ? 'R$ 0' : reaisCurto(b.de * fator).replace('R$ ', '')}
                  </text>
                )}
                <rect
                  x={x(i)} y={m.c} width={bw} height={H - m.c - m.b} fill="transparent" tabIndex={0}
                  aria-label={`${faixa(b)}: ${plural(b.candidatos, 'candidato', 'candidatos')}, ${inteiro(b.eleitos)} eleitos`}
                  onPointerEnter={() => setFoco(i)} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}
                  className="outline-none"
                />
              </g>
            )
          })}
          <text x={(m.e + W - m.d) / 2} y={H - 6} textAnchor="middle" className="fill-tinta-3 text-[11px]">gasto da campanha em R$ (cada faixa é ~1,8 vez a anterior)</text>
          {limiar && (
            <g pointerEvents="none">
              <line x1={x(iLimiar)} x2={x(iLimiar)} y1={m.c - 26} y2={y(0)} stroke="var(--color-tinta)" strokeWidth={1.5} />
              <text x={x(iLimiar) + (iLimiar > n * 0.6 ? -8 : 8)} y={m.c - 14} textAnchor={iLimiar > n * 0.6 ? 'end' : 'start'} className="fill-tinta text-[12.5px] font-bold">
                preço de entrada
              </text>
            </g>
          )}
        </svg>
        {f && foco != null && (
          <div
            className="pointer-events-none absolute top-6 z-10 rounded-lg border border-linha bg-folha px-2.5 py-2 text-[0.78rem] shadow-[var(--shadow-cartao)]"
            style={{ left: `${((x(foco) + bw / 2) / W) * 100}%`, transform: `translateX(${foco > n / 2 ? 'calc(-100% - 10px)' : '10px'})` }}
          >
            <p className="font-bold">{faixa(f)}</p>
            <p className="tabular">{plural(f.candidatos, 'candidato', 'candidatos')} · {inteiro(f.eleitos)} eleitos</p>
            <p className="tabular text-tinta-2">{f.candidatos >= MINIMO ? `${pct((100 * f.eleitos) / f.candidatos, 0)} se elegeram` : 'poucos candidatos para uma taxa'}</p>
          </div>
        )}
      </div>
      </div>
      <TabelaAlternavel
        titulo="Candidatos e eleitos por faixa de gasto"
        colunas={['Faixa de gasto', 'Candidatos', 'Eleitos', '% eleitos']}
        linhas={() => curva.map((b) => [faixa(b), inteiro(b.candidatos), inteiro(b.eleitos), pct((100 * b.eleitos) / b.candidatos, 1)])}
      />
    </figure>
  )
})
