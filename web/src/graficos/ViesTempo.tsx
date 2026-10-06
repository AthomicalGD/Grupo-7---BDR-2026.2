// Viés na linha do tempo: a série principal em destaque e uma série de contexto em cinza
// (ênfase, não categórico). Um eixo só, de -L a +L, simétrico em 0.
import { useId, useState } from 'react'
import { ANOS, type Ano, type PorAno } from '../api'
import { vies as fmtVies } from '../lib/formato'
import { corVies, ladoVies } from '../lib/vies'
import { TabelaAlternavel } from './TabelaAlternavel'

interface Serie {
  nome: string
  valores: PorAno<number>
}

const L = 60

export function ViesTempo({ principal, contexto, anoAtivo }: { principal: Serie; contexto?: Serie; anoAtivo?: Ano }) {
  const id = useId()
  const [foco, setFoco] = useState<Ano | null>(null)
  const W = 360, H = 216, m = { e: 40, d: 64, c: 16, b: 28 }
  const x = (i: number) => m.e + (i * (W - m.e - m.d)) / (ANOS.length - 1)
  const y = (v: number) => m.c + ((L - Math.max(-L, Math.min(L, v))) / (2 * L)) * (H - m.c - m.b)
  const linha = (s: Serie) =>
    ANOS.map((a, i) => [i, s.valores[a]] as const)
      .filter(([, v]) => v != null)
      .map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v!).toFixed(1)}`)
      .join('')
  const ultimo = (s: Serie) => [...ANOS].reverse().find((a) => s.valores[a] != null)
  const resumo = ANOS.map((a) => `${a}: ${fmtVies(principal.valores[a])}`).join(', ')

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full overflow-visible"
          role="img"
          aria-labelledby={`${id}-t`}
          onPointerLeave={() => setFoco(null)}
        >
          <title id={`${id}-t`}>{`Viés de ${principal.nome} por ano. ${resumo}.`}</title>
          {[-60, -30, 0, 30, 60].map((v) => (
            <g key={v}>
              <line x1={m.e} x2={W - m.d + 8} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--color-linha-2)' : 'var(--color-linha)'} strokeWidth={1} />
              <text x={m.e - 8} y={y(v) + 3.5} textAnchor="end" className="tabular fill-tinta-3 text-[10px]">
                {v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}
              </text>
            </g>
          ))}
          <text x={W - m.d + 8} y={y(L) + 12} textAnchor="end" className="fill-tinta-3 text-[10px]">direita</text>
          <text x={W - m.d + 8} y={y(-L) - 5} textAnchor="end" className="fill-tinta-3 text-[10px]">esquerda</text>
          {ANOS.map((a, i) => (
            <text key={a} x={x(i)} y={H - 8} textAnchor="middle" className={`tabular text-[10.5px] ${a === anoAtivo ? 'fill-tinta font-bold' : 'fill-tinta-3'}`}>
              {a}
            </text>
          ))}
          {foco && <line x1={x(ANOS.indexOf(foco))} x2={x(ANOS.indexOf(foco))} y1={m.c} y2={H - m.b} stroke="var(--color-linha-2)" strokeWidth={1} />}
          {contexto && (
            <>
              <path d={linha(contexto)} fill="none" stroke="var(--color-linha-2)" strokeWidth={1.6} strokeLinejoin="round" />
              {ultimo(contexto) && (() => {
                const a = ultimo(contexto)!, vc = contexto.valores[a]!, vp = principal.valores[a]
                // perto do ponto principal, o rótulo desvia para não encostar nele
                const desvio = vp != null && Math.abs(vc - vp) < 9 ? 15 : 3.5 // os valores do principal ficam acima dos pontos
                return (
                  <text x={x(ANOS.indexOf(a)) + 11} y={y(vc) + desvio} className="fill-tinta-3 text-[10.5px] font-semibold">
                    {contexto.nome}
                  </text>
                )
              })()}
            </>
          )}
          <path d={linha(principal)} fill="none" stroke="var(--color-tinta)" strokeWidth={2} strokeLinejoin="round" />
          {ANOS.map((a, i) => {
            const v = principal.valores[a]
            if (v == null) return null
            const ativo = a === (foco ?? anoAtivo)
            return (
              <g key={a}>
                <circle cx={x(i)} cy={y(v)} r={ativo ? 7.5 : 6} fill={corVies(v)} stroke="var(--color-folha)" strokeWidth={2.5} />
                <text x={x(i) + (i === 0 ? -6 : i === ANOS.length - 1 ? 6 : 0)} y={y(v) - 13} textAnchor={i === 0 ? 'start' : i === ANOS.length - 1 ? 'end' : 'middle'} className={`tabular text-[11px] ${ativo ? 'fill-tinta font-bold' : 'fill-tinta-2 font-semibold'}`}>
                  {fmtVies(v)}
                </text>
              </g>
            )
          })}
          {ANOS.map((a, i) => (
            <rect
              key={a}
              x={x(i) - (W - m.e - m.d) / 6}
              y={0}
              width={(W - m.e - m.d) / 3}
              height={H}
              fill="transparent"
              tabIndex={0}
              aria-label={`${a}: ${principal.nome} ${fmtVies(principal.valores[a])}${contexto ? `, ${contexto.nome} ${fmtVies(contexto.valores[a])}` : ''}`}
              onPointerEnter={() => setFoco(a)}
              onFocus={() => setFoco(a)}
              onBlur={() => setFoco(null)}
              className="outline-none"
            />
          ))}
        </svg>
        {foco && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-linha bg-folha px-2.5 py-2 text-[0.78rem] shadow-[var(--shadow-cartao)]"
            style={{ left: `${(x(ANOS.indexOf(foco)) / W) * 100}%`, transform: `translateX(${ANOS.indexOf(foco) >= 2 ? 'calc(-100% - 12px)' : '12px'})` }}
          >
            <p className="font-bold tabular">{foco}</p>
            <p>
              {principal.nome}: <b className="tabular">{fmtVies(principal.valores[foco])}</b> <span className="text-tinta-3">({ladoVies(principal.valores[foco])})</span>
            </p>
            {contexto && (
              <p className="text-tinta-2">
                {contexto.nome}: <span className="tabular">{fmtVies(contexto.valores[foco])}</span>
              </p>
            )}
          </div>
        )}
      </div>
      <TabelaAlternavel
        titulo={`Viés de ${principal.nome} por ano`}
        colunas={['Ano', principal.nome, ...(contexto ? [contexto.nome] : [])]}
        linhas={ANOS.map((a) => [String(a), fmtVies(principal.valores[a]), ...(contexto ? [fmtVies(contexto.valores[a])] : [])])}
      />
    </figure>
  )
}
