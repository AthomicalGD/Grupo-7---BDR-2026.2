// A trança: cada 2º turno é uma linha que sai do 1º turno (à esquerda) e chega ao 2º (à direita), na altura da
// parte do vencedor entre os dois finalistas. Quem começa abaixo da metade e termina acima virou: essas linhas
// ficam no ouro e por cima. Ensina, logo na abertura, a leitura das linhas que se cruzam do resto da página.
import { useEffect, useMemo, useState } from 'react'
import type { SegundoTurno } from '../api'
import { pct } from '../lib/formato'
import { COR, lugar, parteVencedor } from './comuns'

const DE = 20, ATE = 86
// no largo, espaço para os rótulos dos lados; no celular, um desenho mais estreito (as letras ficam maiores)
const medidas = (estreito: boolean) => {
  const W = estreito ? 500 : 960, H = estreito ? 440 : 400, X1 = estreito ? 96 : 168, X2 = estreito ? W - 28 : 792, Y0 = 34, Y1 = H - 46
  const y = (v: number) => Y1 - ((Math.min(ATE, Math.max(DE, v)) - DE) / (ATE - DE)) * (Y1 - Y0)
  const puxa = (X2 - X1) * 0.37
  return { W, H, X1, X2, Y0, Y1, y, curva: (a: number, b: number) => `M${X1} ${y(a)} C${X1 + puxa} ${y(a)} ${X2 - puxa} ${y(b)} ${X2} ${y(b)}` }
}
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

export function Tranca({ disputas, ufs, aoAbrir }: { disputas: SegundoTurno[]; ufs: Map<string, string>; aoAbrir: (id: number) => void }) {
  const [foco, setFoco] = useState<number | null>(null)
  const estreito = useEstreito()
  const { W, H, X1, X2, Y0, Y1, y, curva } = medidas(estreito)
  const f = estreito ? 1.45 : 1   // as letras crescem quando o desenho encolhe
  // as viradas por cima; entre elas, as maiores (o vencedor mais atrás no 1º turno) por último
  const linhas = useMemo(
    () =>
      disputas
        .map((d) => ({ d, ...parteVencedor(d) }))
        .sort((p, q) => Number(p.d.virada) - Number(q.d.virada) || (p.d.virada ? q.t1 - p.t1 : 0)),
    [disputas],
  )
  const viradas = linhas.filter((l) => l.d.virada)
  // as duas maiores viradas ganham nome no começo da linha
  const destaque = estreito ? [] : viradas.slice(-2)
  const emFoco = linhas.find((l) => l.d.id === foco)

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" onPointerLeave={() => setFoco(null)}
        aria-label={`Cada linha é um 2º turno. ${viradas.length} das ${linhas.length} linhas começam abaixo da metade e terminam acima: são as viradas.`}>
        {/* a metade: acima dela, o vencedor estava na frente */}
        <rect x={X1} y={y(50)} width={X2 - X1} height={Y1 - y(50)} fill={COR.viraClaro} opacity={0.45} />
        <line x1={X1 - 14} x2={X2 + 14} y1={y(50)} y2={y(50)} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="5 5" />
        <text x={X1 - 12} y={y(50) + 4} textAnchor="end" className="fill-tinta font-bold" fontSize={13 * f}>metade</text>
        <text x={X1 - 12} y={y(64)} textAnchor="end" className="fill-tinta-3" fontSize={12 * f}>vencedor</text>
        <text x={X1 - 12} y={y(64) + 15 * f} textAnchor="end" className="fill-tinta-3" fontSize={12 * f}>na frente</text>
        <text x={X1 - 12} y={y(36)} textAnchor="end" className="fill-tinta-3" fontSize={12 * f}>vencedor</text>
        <text x={X1 - 12} y={y(36) + 15 * f} textAnchor="end" className="fill-tinta-3" fontSize={12 * f}>atrás</text>
        {[X1, X2].map((x, i) => (
          <g key={x}>
            <line x1={x} x2={x} y1={Y0 - 10} y2={Y1 + 8} stroke="var(--color-linha-2)" strokeWidth={1.5} />
            <text x={x} y={Y1 + 30} textAnchor={estreito ? (i ? 'end' : 'start') : 'middle'} className="fill-tinta font-bold" fontSize={15 * f}>{i ? '2º turno' : '1º turno'}</text>
          </g>
        ))}

        {linhas.map(({ d, t1, t2 }, i) => {
          const ativo = foco === d.id
          return (
            <path
              key={d.id}
              d={curva(t1, t2)}
              pathLength={1}
              className="tranca-linha cursor-pointer"
              style={{ animationDelay: `${Math.min(i, 120) * 6}ms` }}
              fill="none"
              stroke={d.virada ? COR.viraTraco : COR.vence}
              strokeWidth={ativo ? 4 : d.virada ? 2.4 : 1.4}
              strokeOpacity={foco != null && !ativo ? 0.18 : d.virada ? 0.95 : 0.38}
              strokeLinecap="round"
              onPointerEnter={() => setFoco(d.id)}
              onClick={() => aoAbrir(d.id)}
            />
          )
        })}

        {destaque.map(({ d, t1 }) => (
          <text key={d.id} x={X1 + 10} y={y(t1) + 18} className="pointer-events-none fill-tinta text-[12.5px] font-semibold">
            {lugar(d, ufs)} {d.ano}: começou com {pct(t1, 0)}
          </text>
        ))}

        {emFoco && !estreito && (
          <g className="pointer-events-none">
            <circle cx={X1} cy={y(emFoco.t1)} r={5} fill="var(--color-folha)" stroke="var(--color-tinta)" strokeWidth={2} />
            <circle cx={X2} cy={y(emFoco.t2)} r={5} fill="var(--color-folha)" stroke="var(--color-tinta)" strokeWidth={2} />
            <text x={X2 + 14} y={y(emFoco.t2) - 6} className="fill-tinta text-[13px] font-bold">{lugar(emFoco.d, ufs)} · {emFoco.d.ano}</text>
            <text x={X2 + 14} y={y(emFoco.t2) + 11} className="fill-tinta-2 text-[12px]">{pct(emFoco.t1, 0)} → {pct(emFoco.t2, 0)}</text>
          </g>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.84rem] text-tinta-2">
        <span className="inline-flex items-center gap-2"><span className="h-[3px] w-7 rounded-full" style={{ background: COR.viraTraco }} aria-hidden />Virou: o vencedor começou atrás</span>
        <span className="inline-flex items-center gap-2"><span className="h-[3px] w-7 rounded-full opacity-60" style={{ background: COR.vence }} aria-hidden />Quem liderou o 1º turno venceu</span>
        <span>A altura é a parte do vencedor nos votos dos dois finalistas. Passe o mouse numa linha; clique para abrir a disputa.</span>
      </figcaption>
    </figure>
  )
}
