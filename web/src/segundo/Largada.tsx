// A largada: de onde o vencedor partiu. Uma fileira por cargo e um ponto por disputa, na parte do vencedor
// nos votos dos dois finalistas no 1º turno. À esquerda da metade, ele começou atrás e virou (ouro); à
// direita, começou na frente e confirmou. Os pontos se empilham para não se esconderem (enxame).
import { useEffect, useMemo, useState } from 'react'
import type { SegundoTurno } from '../api'
import { pct } from '../lib/formato'
import { CARGOS, COR, chaveDoCargo, lugar, parteVencedor, type ChaveCargo } from './comuns'

const NOME_FILEIRA: Record<ChaveCargo, string> = { presidente: 'Presidência', governador: 'Governos estaduais', prefeito: 'Prefeituras' }
const DE = 28, ATE = 78

function useEstreito() {
  const consulta = '(max-width: 639px)'
  const [estreito, setEstreito] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(consulta).matches)
  useEffect(() => {
    const m = matchMedia(consulta), muda = () => setEstreito(m.matches)
    m.addEventListener('change', muda)
    return () => m.removeEventListener('change', muda)
  }, [])
  return estreito
}

/** Empilha os pontos de uma fileira: cada um desce ou sobe o mínimo para não encostar nos já postos. */
function enxame(xs: number[], r: number): number[] {
  const postos: { x: number; y: number }[] = []
  const ordem = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x)
  const ys = new Array<number>(xs.length)
  for (const { x, i } of ordem) {
    const perto = postos.filter((p) => Math.abs(p.x - x) < 2 * r)
    let y = 0
    for (let k = 0; ; k++) {
      y = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 1.9)
      if (perto.every((p) => Math.hypot(p.x - x, p.y - y) >= 2 * r - 0.5)) break
    }
    postos.push({ x, y }); ys[i] = y
  }
  return ys
}

export function Largada({ disputas, ufs, aoAbrir }: { disputas: SegundoTurno[]; ufs: Map<string, string>; aoAbrir: (id: number) => void }) {
  const estreito = useEstreito()
  const [foco, setFoco] = useState<number | null>(null)
  const W = estreito ? 400 : 960, E = estreito ? 14 : 214, D = estreito ? 14 : 40, r = estreito ? 5.2 : 7.5
  const f = estreito ? 1.5 : 1   // as letras crescem quando o desenho encolhe
  const x = (v: number) => E + ((Math.min(ATE, Math.max(DE, v)) - DE) / (ATE - DE)) * (W - E - D)

  const fileiras = useMemo(() => (Object.keys(CARGOS) as ChaveCargo[]).map((k) => {
    const ds = disputas.filter((d) => chaveDoCargo(d.cod_cargo) === k).map((d) => ({ d, t1: parteVencedor(d).t1 }))
    const ys = enxame(ds.map((p) => x(p.t1)), r)
    const altura = Math.max(2 * r + 6, (Math.max(0, ...ys.map(Math.abs)) + r) * 2 + 8)
    return { k, pontos: ds.map((p, i) => ({ ...p, dy: ys[i] })), altura, viradas: ds.filter((p) => p.d.virada).length }
  }).filter((l) => l.pontos.length),
  // a escala só muda com o tamanho (estreito); recalcular a cada desenho refaria o enxame à toa
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  [disputas, estreito])

  // cada fileira: rótulo em cima (no celular) ou à esquerda (no largo), e o enxame
  const cab = estreito ? 30 : 0, folga = estreito ? 18 : 26
  let topo = 40
  const posicoes = fileiras.map((l) => { const y0 = topo + cab; topo = y0 + l.altura + folga; return y0 })
  const H = topo + 30
  const maior = fileiras.flatMap((l) => l.pontos).filter((p) => p.d.virada).sort((a, b) => a.t1 - b.t1)[0]
  const emFoco = fileiras.flatMap((l, i) => l.pontos.map((p) => ({ ...p, cy: posicoes[i] + l.altura / 2 + p.dy }))).find((p) => p.d.id === foco)
  const total = disputas.length, viradas = disputas.filter((d) => d.virada).length

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" onPointerLeave={() => setFoco(null)}
        aria-label={`Cada ponto é um 2º turno, na parte do vencedor no 1º turno. ${viradas} das ${total} disputas ficam à esquerda da metade: o vencedor começou atrás e virou.`}>
        {/* as duas metades: à esquerda, começou atrás (o véu do ouro); à direita, na frente */}
        <rect x={x(DE)} y={22} width={x(50) - x(DE)} height={H - 52} rx={10} fill={COR.viraClaro} opacity={0.7} />
        <text x={x(50) - 10} y={16} textAnchor="end" className="fill-tinta font-bold" fontSize={13 * f}>{estreito ? '← virou' : '← começou atrás e virou'}</text>
        <text x={x(50) + 10} y={16} className="fill-tinta-2 font-semibold" fontSize={13 * f}>{estreito ? 'confirmou →' : 'começou na frente →'}</text>
        <line x1={x(50)} x2={x(50)} y1={22} y2={H - 30} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="5 5" />

        {fileiras.map((l, i) => {
          const y0 = posicoes[i], meio = y0 + l.altura / 2
          return (
            <g key={l.k}>
              {estreito ? (
                <text x={E} y={y0 - 10} className="fill-tinta font-bold" fontSize={13 * f}>
                  {NOME_FILEIRA[l.k]} <tspan className="fill-tinta-2 font-normal">· {l.viradas} de {l.pontos.length} viraram</tspan>
                </text>
              ) : (
                <>
                  <text x={E - 24} y={meio - 3} textAnchor="end" className="fill-tinta text-[15px] font-bold">{NOME_FILEIRA[l.k]}</text>
                  <text x={E - 24} y={meio + 16} textAnchor="end" className="fill-tinta-2 text-[13px]">{l.viradas} de {l.pontos.length} viraram</text>
                </>
              )}
              <line x1={x(DE)} x2={x(ATE)} y1={meio} y2={meio} stroke="var(--color-linha)" strokeWidth={1} />
              {l.pontos.map((p, k) => (
                <circle
                  key={p.d.id}
                  cx={x(p.t1)}
                  cy={meio + p.dy}
                  r={foco === p.d.id ? r + 2.5 : r}
                  className="largada-ponto cursor-pointer"
                  style={{ animationDelay: `${Math.min(k, 60) * 8}ms` }}
                  fill={p.d.virada ? COR.vira : COR.vence}
                  stroke={foco === p.d.id ? 'var(--color-tinta)' : 'var(--color-folha)'}
                  strokeWidth={foco === p.d.id ? 2.5 : 1.5}
                  opacity={foco != null && foco !== p.d.id ? 0.45 : 1}
                  onPointerEnter={() => setFoco(p.d.id)}
                  onClick={() => aoAbrir(p.d.id)}
                />
              ))}
            </g>
          )
        })}

        {/* o eixo: a parte do vencedor no 1º turno */}
        {[30, 40, 50, 60, 70].map((v) => (
          <text key={v} x={x(v)} y={H - 10} textAnchor="middle" className={v === 50 ? 'fill-tinta font-bold' : 'fill-tinta-3'} fontSize={12 * f}>{v === 50 ? 'metade' : `${v}%`}</text>
        ))}

        {maior && !estreito && (() => {
          const i = fileiras.findIndex((l) => l.pontos.includes(maior))
          const meio = posicoes[i] + fileiras[i].altura / 2, cy = meio + maior.dy, ty = meio + 44
          return (
            <g className="pointer-events-none">
              <path d={`M${E - 20} ${ty - 4} C${E} ${ty - 4} ${x(maior.t1) - 20} ${cy + 18} ${x(maior.t1)} ${cy + r + 2}`} fill="none" stroke="var(--color-tinta)" strokeWidth={1} />
              <text x={E - 24} y={ty} textAnchor="end" className="fill-tinta text-[12.5px] font-semibold">maior virada:</text>
              <text x={E - 24} y={ty + 16} textAnchor="end" className="fill-tinta-2 text-[12.5px]">{lugar(maior.d, ufs).replace(/ \(..\)$/, '')} {maior.d.ano}, com {pct(maior.t1, 0)}</text>
            </g>
          )
        })()}

        {emFoco && (
          <g className="pointer-events-none" transform={`translate(${Math.min(x(emFoco.t1) + 14, W - (estreito ? 200 : 260))} ${Math.max(28, emFoco.cy - 40)})`}>
            <rect width={estreito ? 196 : 250} height={52 * f} rx={10} fill="var(--color-folha)" stroke="var(--color-linha-2)" />
            <text x={12} y={21 * f} className="fill-tinta font-bold" fontSize={13 * f}>{lugar(emFoco.d, ufs)} · {emFoco.d.ano}</text>
            <text x={12} y={40 * f} className="fill-tinta-2" fontSize={12 * f}>
              {emFoco.d.virada ? 'virou: ' : 'confirmou: '}{pct(emFoco.t1, 0)} → {pct(parteVencedor(emFoco.d).t2, 0)}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.84rem] text-tinta-2">
        <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: COR.vira }} aria-hidden />Virou: o vencedor começou atrás</span>
        <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: COR.vence }} aria-hidden />Quem liderou o 1º turno venceu</span>
        <span>Cada ponto é uma disputa, na parte do vencedor nos votos dos dois finalistas no 1º turno. Clique num ponto para abrir a disputa.</span>
      </figcaption>
    </figure>
  )
}
