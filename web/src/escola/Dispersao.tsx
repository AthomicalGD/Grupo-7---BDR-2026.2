// A dispersão: cada município um ponto, a escolaridade de quem votou (de 100, com superior completo)
// contra a dos eleitos do município (2024) ou dos votos que ele deu para deputado (2022). O tamanho é
// quantos votaram. A diagonal é "o eleito parecido com o eleitor"; quase tudo fica acima dela. A linha
// tracejada é a tendência (mínimos quadrados). Clicar abre o boletim.
import { useMemo, useState } from 'react'
import type { MunicipioEscola } from '../api'
import { decimal, pct } from '../lib/formato'
import { cor, SUPERIOR, useLargura } from './escolaridade'

const ALTURA = 360
const M = { e: 44, d: 12, t: 12, b: 40 }

export function Dispersao({ municipios, medida, selecionado, aoEscolher }: {
  municipios: MunicipioEscola[]
  medida: 'eleitos' | 'votados'
  selecionado: number
  aoEscolher: (ibge: number) => void
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pontos = useMemo(() => municipios.filter((m) => m[medida] != null), [municipios, medida])
  const xMax = Math.max(10, Math.ceil(Math.max(...pontos.map((m) => m.votantes)) / 5) * 5)
  const maxComp = Math.max(...pontos.map((m) => m.comparecimento))
  const W = Math.max(largura, 280)
  const x = (v: number) => M.e + (v / xMax) * (W - M.e - M.d)
  const y = (v: number) => M.t + (1 - v / 100) * (ALTURA - M.t - M.b)

  const { a, b, acima } = useMemo(() => {
    const n = pontos.length
    const mx = pontos.reduce((s, m) => s + m.votantes, 0) / n
    const my = pontos.reduce((s, m) => s + (m[medida] ?? 0), 0) / n
    const sxy = pontos.reduce((s, m) => s + (m.votantes - mx) * ((m[medida] ?? 0) - my), 0)
    const sxx = pontos.reduce((s, m) => s + (m.votantes - mx) ** 2, 0)
    const b = sxx ? sxy / sxx : 0
    return { a: my - b * mx, b, acima: (100 * pontos.filter((m) => (m[medida] ?? 0) > m.votantes).length) / n }
  }, [pontos, medida])

  const porIbge = useMemo(() => new Map(pontos.map((m) => [m.ibge, m])), [pontos])
  const sel = porIbge.get(selecionado)
  const h = hover != null ? porIbge.get(hover) : null
  const raio = (m: MunicipioEscola) => 2 + 7 * Math.sqrt(m.comparecimento / maxComp)
  const alvo = medida === 'eleitos' ? 'eleitos' : 'votos para deputado'

  return (
    <div>
      <p className="mb-3 text-[0.92rem] leading-relaxed text-tinta-2">
        Em <b className="tabular text-tinta">{decimal(acima, 0)}% dos municípios</b> os {alvo} têm mais diploma do que quem votou: os pontos ficam
        acima da diagonal. Cada ponto a mais de quem votou com superior soma <b className="tabular text-tinta">{decimal(b, 1)}</b> nos {alvo}.
      </p>
      <div ref={ref} className="relative" style={{ height: ALTURA }}>
        {largura > 0 && (
          <svg
            width={W}
            height={ALTURA}
            role="img"
            aria-label={`Dispersão dos ${pontos.length} municípios: quem votou contra ${alvo}, de cada 100 com superior completo`}
            onPointerMove={(e) => {
              const i = Number((e.target as SVGElement).getAttribute?.('data-ibge'))
              setHover(i > 0 ? i : null)
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const i = Number((e.target as SVGElement).getAttribute?.('data-ibge'))
              if (i > 0) aoEscolher(i)
            }}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={`y${v}`}>
                <line x1={M.e} x2={W - M.d} y1={y(v)} y2={y(v)} stroke="var(--color-linha)" />
                <text x={M.e - 8} y={y(v) + 4} textAnchor="end" className="tabular fill-tinta-3 text-[0.72rem]">{v}%</text>
              </g>
            ))}
            {Array.from({ length: xMax / 5 + 1 }, (_, i) => i * 5).map((v) => (
              <text key={`x${v}`} x={x(v)} y={ALTURA - M.b + 18} textAnchor="middle" className="tabular fill-tinta-3 text-[0.72rem]">{v}%</text>
            ))}
            <text x={(M.e + W - M.d) / 2} y={ALTURA - 4} textAnchor="middle" className="fill-tinta-2 text-[0.76rem]">quem votou com superior completo</text>
            <text x={12} y={y(50)} textAnchor="middle" transform={`rotate(-90 12 ${y(50)})`} className="fill-tinta-2 text-[0.76rem]">{alvo} com superior</text>
            {/* a diagonal: o eleito parecido com o eleitor */}
            <line x1={x(0)} y1={y(0)} x2={x(xMax)} y2={y(xMax)} stroke="var(--color-tinta-3)" strokeWidth={1.2} strokeDasharray="2 4" />
            <text x={x(xMax) - 4} y={y(xMax) - 6} textAnchor="end" className="fill-tinta-3 text-[0.7rem]">eleito = eleitor</text>
            <g className="cursor-pointer">
              {pontos.map((m) => (
                <circle key={m.ibge} data-ibge={m.ibge} cx={x(m.votantes)} cy={y(m[medida] ?? 0)} r={raio(m)} fill={cor(SUPERIOR)} fillOpacity={0.28} stroke={cor(SUPERIOR)} strokeOpacity={0.5} strokeWidth={0.6} />
              ))}
            </g>
            <line x1={x(0)} y1={y(Math.max(0, Math.min(100, a)))} x2={x(xMax)} y2={y(Math.max(0, Math.min(100, a + b * xMax)))} stroke="var(--color-tinta)" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
            {h && <circle cx={x(h.votantes)} cy={y(h[medida] ?? 0)} r={raio(h) + 2} fill="none" stroke="var(--color-tinta)" strokeWidth={1.6} pointerEvents="none" />}
            {sel && (
              <g pointerEvents="none">
                <circle cx={x(sel.votantes)} cy={y(sel[medida] ?? 0)} r={raio(sel) + 3} fill="none" stroke="var(--color-marcador)" strokeWidth={3} />
                <text x={x(sel.votantes) + raio(sel) + 7} y={y(sel[medida] ?? 0) + 4} className="fill-tinta text-[0.78rem] font-bold">{sel.nome}</text>
              </g>
            )}
          </svg>
        )}
        {h && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-xl border border-linha bg-folha px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
            <p className="font-bold text-tinta">{h.nome} <span className="font-normal text-tinta-3">({h.uf})</span></p>
            <p className="tabular text-tinta-2">quem votou com superior: <b className="text-tinta">{pct(h.votantes, 0)}</b></p>
            <p className="tabular text-tinta-2">{alvo} com superior: <b className="text-tinta">{pct(h[medida], 0)}</b></p>
          </div>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.76rem] text-tinta-3">
        <span>Tamanho: quantas pessoas votaram.</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-tinta" aria-hidden />tendência</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted border-tinta-3" aria-hidden />eleito = eleitor</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-marcador" aria-hidden />no boletim</span>
      </p>
    </div>
  )
}
