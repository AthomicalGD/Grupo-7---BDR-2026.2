// A dispersão da P3: cada município um ponto, do tamanho dos seus eleitores. Serve aos dois gráficos da página
// (viés contra o índice escolhido; desvio padrão do viés contra o IFDM). A linha tracejada é a tendência (mínimos
// quadrados, na escala log quando o eixo é log). Clicar num ponto abre o boletim do município no mapa.
import { scaleLinear, scaleLog } from 'd3-scale'
import { useMemo, useState, type MouseEvent, type PointerEvent } from 'react'
import { useLargura } from '../escola/escolaridade'
import type { Ajuste, Ponto } from './indices'

const ALTURA_BASE = 400
const M = { e: 84, d: 30, t: 14, b: 44 }

/** Marcas do eixo log: só 1, 2 e 5 de cada potência de 10 (e só o 1 quando ficam muitas). */
function marcasLog(ticks: number[]): number[] {
  const cabeca = (v: number) => Math.round(v / 10 ** Math.floor(Math.log10(v)))
  const cheias = ticks.filter((v) => [1, 2, 5].includes(cabeca(v)))
  return cheias.length > 7 ? ticks.filter((v) => cabeca(v) === 1) : cheias
}

export function DispersaoIndices({ pontos, x, y, ajuste, cor, rotulo, aoEscolher, nomeados = 4 }: {
  pontos: Ponto[]
  x: { dominio: [number, number]; marcas: number[]; formato: (v: number) => string; rotulo: string; pontas?: [string, string] }
  y: { formato: (v: number) => string; rotulo: string; log?: boolean }
  ajuste: Ajuste
  cor: (p: Ponto) => string
  /** descrição do gráfico para leitores de tela */
  rotulo: string
  aoEscolher: (p: Ponto) => void
  /** quantos dos maiores municípios levam o nome escrito ao lado do ponto (rótulo direto, sem legenda) */
  nomeados?: number
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const W = Math.max(largura, 280)
  const ALTURA = W < 520 ? 330 : ALTURA_BASE
  const porIbge = useMemo(() => new Map(pontos.map((p) => [p.ibge, p])), [pontos])
  const maxPeso = Math.max(1, ...pontos.map((p) => p.peso))
  const raio = (p: Ponto) => 2.5 + 8 * Math.sqrt(p.peso / maxPeso)

  const sx = scaleLinear().domain(x.dominio).range([M.e, W - M.d])
  const sy = useMemo(() => {
    const ys = pontos.map((p) => p.y).filter((v) => !y.log || v > 0)
    const [min, max] = ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 1]
    const s = y.log ? scaleLog().domain([min, max === min ? min * 10 : max]) : scaleLinear().domain(min === max ? [min - 1, max + 1] : [min, max])
    return s.range([ALTURA - M.b, M.t]).nice()
  }, [pontos, y.log, ALTURA])
  const marcasY = y.log ? marcasLog(sy.ticks(6)) : sy.ticks(5)

  // a tendência: no log, a reta é de log(y), então volta pela exponencial; fica dentro do quadro
  const tendencia = useMemo(() => {
    if (ajuste.r == null) return ''
    const [y0, y1] = sy.domain() as [number, number]
    const passos = 40
    return Array.from({ length: passos + 1 }, (_, i) => {
      const vx = x.dominio[0] + ((x.dominio[1] - x.dominio[0]) * i) / passos
      const t = ajuste.a + ajuste.b * vx
      const vy = Math.min(Math.max(y.log ? Math.exp(t) : t, Math.min(y0, y1)), Math.max(y0, y1))
      return `${i ? 'L' : 'M'}${sx(vx).toFixed(1)},${sy(vy).toFixed(1)}`
    }).join('')
  }, [ajuste, sx, sy, x.dominio, y.log])

  // os maiores municípios levam o nome ao lado; um nome que bateria noutro já escrito fica de fora
  const maiores = useMemo(() => {
    const postos: { x1: number; x2: number; y: number }[] = []
    return pontos.toSorted((a, b) => b.peso - a.peso).slice(0, nomeados + 4).flatMap((p) => {
      const dir = sx(p.x) > W * 0.7
      const larg = p.nome.length * 6.6
      const x1 = dir ? sx(p.x) - raio(p) - 4 - larg : sx(p.x) + raio(p) + 4
      const caixa = { x1, x2: x1 + larg, y: sy(p.y) }
      if (postos.length >= nomeados || postos.some((o) => Math.abs(o.y - caixa.y) < 14 && o.x1 < caixa.x2 && caixa.x1 < o.x2)) return []
      postos.push(caixa)
      return [p]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontos, nomeados, W, sy])

  const h = hover != null ? porIbge.get(hover) : undefined
  const alvo = (e: PointerEvent | MouseEvent) => porIbge.get(Number((e.target as SVGElement).getAttribute?.('data-ibge')))

  return (
    <div ref={ref} className="relative" style={{ height: ALTURA }}>
      {largura > 0 && (
        <svg
          width={W}
          height={ALTURA}
          role="img"
          aria-label={rotulo}
          onPointerMove={(e) => setHover(alvo(e)?.ibge ?? null)}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const p = alvo(e)
            if (p) aoEscolher(p)
          }}
        >
          {marcasY.map((v) => (
            <g key={`y${v}`}>
              <line x1={M.e} x2={W - M.d} y1={sy(v)} y2={sy(v)} stroke="var(--color-linha)" />
              <text x={M.e - 8} y={sy(v) + 4} textAnchor="end" className="tabular fill-tinta-3 text-[0.78rem]">{y.formato(v)}</text>
            </g>
          ))}
          {x.marcas.map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={M.t} y2={ALTURA - M.b} stroke="var(--color-linha)" strokeDasharray={v === 0 && x.pontas ? undefined : '2 4'} />
              <text x={sx(v)} y={ALTURA - M.b + 18} textAnchor="middle" className="tabular fill-tinta-3 text-[0.78rem]">{x.formato(v)}</text>
            </g>
          ))}
          {x.pontas && (
            <>
              <text x={M.e} y={ALTURA - 4} className="fill-tinta-3 text-[0.76rem]">← {x.pontas[0]}</text>
              <text x={W - M.d} y={ALTURA - 4} textAnchor="end" className="fill-tinta-3 text-[0.76rem]">{x.pontas[1]} →</text>
            </>
          )}
          <text x={(M.e + W - M.d) / 2} y={ALTURA - 4} textAnchor="middle" className="fill-tinta-2 text-[0.76rem]">{x.rotulo}</text>
          <text x={12} y={(M.t + ALTURA - M.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(M.t + ALTURA - M.b) / 2})`} className="fill-tinta-2 text-[0.76rem]">{y.rotulo}</text>
          <g className="cursor-pointer">
            {pontos.map((p) => (
              <circle key={p.ibge} data-ibge={p.ibge} cx={sx(p.x)} cy={sy(p.y)} r={raio(p)} fill={cor(p)} fillOpacity={0.62} stroke="var(--color-tinta)" strokeOpacity={0.5} strokeWidth={0.8} />
            ))}
          </g>
          {maiores.map((p) => {
            const direita = sx(p.x) > W * 0.7
            return (
              <text key={`n${p.ibge}`} x={sx(p.x) + (direita ? -1 : 1) * (raio(p) + 4)} y={sy(p.y) + 4} textAnchor={direita ? 'end' : 'start'} pointerEvents="none"
                className="fill-tinta text-[0.78rem] font-bold" style={{ paintOrder: 'stroke', stroke: 'var(--halo)', strokeWidth: 4, strokeLinejoin: 'round' }}>{p.nome}</text>
            )
          })}
          {tendencia && <path d={tendencia} fill="none" stroke="var(--color-tinta)" strokeWidth={2.5} strokeDasharray="8 5" pointerEvents="none" />}
          {h && <circle cx={sx(h.x)} cy={sy(h.y)} r={raio(h) + 2.5} fill="none" stroke="var(--color-marcador)" strokeWidth={2.4} pointerEvents="none" />}
        </svg>
      )}
      {h && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-xl border border-linha bg-folha px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
          <p className="font-bold text-tinta">{h.nome} <span className="font-normal text-tinta-3">({h.uf})</span></p>
          <p className="tabular text-tinta-2">{x.rotulo}: <b className="text-tinta">{x.formato(h.x)}</b></p>
          <p className="tabular text-tinta-2">{y.rotulo}: <b className="text-tinta">{y.formato(h.y)}</b></p>
          <p className="text-[0.74rem] text-tinta-3">Clique para abrir o boletim</p>
        </div>
      )}
    </div>
  )
}
