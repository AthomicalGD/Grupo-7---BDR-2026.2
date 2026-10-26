// Gasto × chance de vitória: uma barra por faixa de gasto (escala log), altura = % de eleitos.
// Antes da resposta, "você desenha": a pessoa arrasta o próprio palpite sobre o gráfico vazio e só então as
// barras aparecem, com o palpite por cima (o que se chuta antes se lembra depois).
// Barra na mesma cor do plenário (o eixo x é o gasto). Faixas com menos de 5 candidatos ficam
// só no contorno: a taxa delas não diz nada.
import { memo, useId, useRef, useState, type PointerEvent } from 'react'
import type { Cadeira } from '../api'
import { Ouvir } from '../componentes/Ouvir'
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
  const [palpite, setPalpite] = useState<(number | null)[]>(() => curva.map(() => null))
  const [revelado, setRevelado] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const desenhando = useRef(false)
  const marcados = palpite.filter((v) => v != null).length
  const desenhar = (e: PointerEvent<SVGSVGElement>) => {
    if (revelado || !desenhando.current || !svg.current) return
    const r = svg.current.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H
    const i = Math.floor((px - m.e) / bw)
    if (i < 0 || i >= n) return
    const taxa = Math.max(0, Math.min(1, 1 - (py - m.c) / (H - m.c - m.b)))
    setPalpite((pp) => pp.map((v, j) => (j === i ? taxa : v)))
  }
  // quanto o palpite errou, em pontos percentuais, nas faixas que ele marcou e que têm candidatos bastantes
  const erro = (() => {
    const ds = curva.flatMap((b, i) => (palpite[i] != null && b.candidatos >= MINIMO ? [Math.abs(palpite[i]! - b.eleitos / b.candidatos)] : []))
    return ds.length ? (100 * ds.reduce((a, d) => a + d, 0)) / ds.length : null
  })()
  const pontosPalpite = curva.flatMap((_, i) => (palpite[i] != null ? [[x(i) + bw / 2, y(palpite[i]!)] as const] : []))
  const faixa = (b: Cadeira['curva'][number]) => (b.de === 0 ? `até ${reaisCurto(b.ate * fator)}` : `de ${reaisCurto(b.de * fator)} a ${reaisCurto(b.ate * fator)}`)

  return (
    <figure className="m-0">
      {/* no celular o gráfico rola na horizontal em vez de encolher o texto */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      <div className="relative min-w-[600px] md:min-w-0">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className={`block w-full overflow-visible ${revelado ? '' : 'cursor-crosshair touch-none'}`}
          role="img"
          aria-labelledby={`${id}-t`}
          onPointerLeave={() => setFoco(null)}
          onPointerDown={(e) => {
            if (revelado) return
            desenhando.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            desenhar(e)
          }}
          onPointerMove={desenhar}
          onPointerUp={() => (desenhando.current = false)}
        >
          <title id={`${id}-t`}>
            {limiar ? `Metade ou mais dos candidatos se elegeu a partir de ${reaisCurto(limiar.de * fator)} de gasto.` : 'Em nenhuma faixa de gasto a maioria se elegeu.'}
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={m.e} x2={W - m.d} y1={y(t)} y2={y(t)} stroke={t === 0.5 ? 'var(--color-linha-2)' : 'var(--color-linha)'} strokeDasharray={t === 0.5 ? '4 4' : undefined} />
              <text x={m.e - 8} y={y(t) + 4} textAnchor="end" className="tabular fill-tinta-3 text-[12px]">{t * 100}%</text>
            </g>
          ))}
          {revelado && curva.map((b, i) => {
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
                  <text x={x(i) + bw / 2} y={H - m.b + 16} textAnchor="middle" className="tabular fill-tinta-3 text-[12px]">
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
          <text x={(m.e + W - m.d) / 2} y={H - 6} textAnchor="middle" className="fill-tinta-3 text-[12px]">gasto da campanha em R$ (cada faixa é ~1,8 vez a anterior)</text>
          {!revelado && curva.map((b, i) => i % 2 === 0 && (
            <text key={b.de} x={x(i) + bw / 2} y={H - m.b + 16} textAnchor="middle" className="tabular fill-tinta-3 text-[12px]">
              {b.de === 0 ? 'R$ 0' : reaisCurto(b.de * fator).replace('R$ ', '')}
            </text>
          ))}
          {!revelado && marcados === 0 && (
            <text x={(m.e + W - m.d) / 2} y={y(0.55)} textAnchor="middle" className="pointer-events-none fill-tinta-3 text-[17px] font-semibold">
              Arraste da esquerda para a direita: que parte se elege em cada faixa?
            </text>
          )}
          {pontosPalpite.length > 0 && (
            <g pointerEvents="none">
              {pontosPalpite.length > 1 && <polyline points={pontosPalpite.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--color-tinta)" strokeWidth={2.5} strokeDasharray={revelado ? '6 5' : undefined} strokeLinejoin="round" />}
              {pontosPalpite.map(([px, py], k) => <circle key={k} cx={px} cy={py} r={revelado ? 3.5 : 5} fill="var(--color-folha)" stroke="var(--color-tinta)" strokeWidth={2} />)}
              {revelado && <text x={pontosPalpite.at(-1)![0] - 6} y={pontosPalpite.at(-1)![1] - 10} textAnchor="end" className="fill-tinta text-[13px] font-bold">seu palpite</text>}
            </g>
          )}
          {revelado && limiar && (
            <g pointerEvents="none">
              <line x1={x(iLimiar)} x2={x(iLimiar)} y1={m.c - 26} y2={y(0)} stroke="var(--color-tinta)" strokeWidth={1.5} />
              <text x={x(iLimiar) + (iLimiar > n * 0.6 ? -8 : 8)} y={m.c - 14} textAnchor={iLimiar > n * 0.6 ? 'end' : 'start'} className="fill-tinta text-[12.5px] font-bold">
                preço de entrada
              </text>
            </g>
          )}
        </svg>
        {revelado && f && foco != null && (
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
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-live="polite">
        {revelado ? (
          <>
            {erro != null && (
              <p className="text-[0.95rem] text-tinta-2">
                Seu palpite ficou, em média, a <b className="tabular text-tinta">{pct(erro, 0).replace('%', ' pontos')}</b> das barras de verdade.
              </p>
            )}
            <button type="button" onClick={() => { setPalpite(curva.map(() => null)); setRevelado(false) }} className="text-[0.88rem] font-semibold text-acao hover:underline">
              Desenhar de novo
            </button>
            <Ouvir
              nome="parte que se elege em cada faixa de gasto"
              min={0}
              max={1}
              pontos={curva.map((b) => ({ rotulo: faixa(b), valor: b.candidatos >= MINIMO ? b.eleitos / b.candidatos : null, texto: b.candidatos >= MINIMO ? pct((100 * b.eleitos) / b.candidatos, 0) : 'poucos candidatos' }))}
            />
          </>
        ) : (
          <>
            <button type="button" onClick={() => setRevelado(true)} disabled={marcados < 3} className="botao-vivo px-5 py-2.5 text-[0.92rem] disabled:opacity-50">
              {marcados < 3 ? 'Desenhe ao menos 3 faixas' : 'Mostrar a resposta'}
            </button>
            <button type="button" onClick={() => setRevelado(true)} className="text-[0.88rem] font-semibold text-acao hover:underline">
              Pular e ver as barras
            </button>
          </>
        )}
      </div>
      <TabelaAlternavel sql="p1Gasto"
        titulo="Candidatos e eleitos por faixa de gasto"
        colunas={['Faixa de gasto', 'Candidatos', 'Eleitos', '% eleitos']}
        linhas={() => curva.map((b) => [faixa(b), inteiro(b.candidatos), inteiro(b.eleitos), pct((100 * b.eleitos) / b.candidatos, 1)])}
      />
    </figure>
  )
})
