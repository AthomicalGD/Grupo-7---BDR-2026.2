// Viés na linha do tempo: a série principal em destaque e uma série de contexto em cinza
// (ênfase, não categórico). Um eixo só, de -L a +L, simétrico em 0.
// Eleições gerais (2018, 2022) e municipais (2020, 2024) têm cargos diferentes e não se comparam:
// cada tipo tem a sua linha e o seu marcador (círculo e losango).
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
const GERAIS: Ano[] = [2018, 2022]
const MUNICIPAIS: Ano[] = [2020, 2024]
const geral = (a: Ano) => GERAIS.includes(a)

/** Marcador: círculo nas eleições gerais, losango nas municipais. */
function Marcador({ a, cx, cy, r, fill, stroke, strokeWidth }: { a: Ano; cx: number; cy: number; r: number; fill: string; stroke: string; strokeWidth: number }) {
  if (geral(a)) return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  const d = r * 1.25
  return <path d={`M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
}

export function ViesTempo({ principal, contexto, anoAtivo }: { principal: Serie; contexto?: Serie; anoAtivo?: Ano }) {
  const id = useId()
  const [foco, setFoco] = useState<Ano | null>(null)
  const W = 360, H = 216, m = { e: 40, d: 64, c: 16, b: 28 }
  const x = (i: number) => m.e + (i * (W - m.e - m.d)) / (ANOS.length - 1)
  const y = (v: number) => m.c + ((L - Math.max(-L, Math.min(L, v))) / (2 * L)) * (H - m.c - m.b)
  const linha = (s: Serie, anos: Ano[]) =>
    anos
      .filter((a) => s.valores[a] != null)
      .map((a, k) => `${k ? 'L' : 'M'}${x(ANOS.indexOf(a)).toFixed(1)} ${y(s.valores[a]!).toFixed(1)}`)
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
              <path d={linha(contexto, GERAIS)} fill="none" stroke="var(--color-linha-2)" strokeWidth={1.6} />
              <path d={linha(contexto, MUNICIPAIS)} fill="none" stroke="var(--color-linha-2)" strokeWidth={1.6} opacity={0.6} />
              {ANOS.map((a, i) => contexto.valores[a] != null && (
                <Marcador key={a} a={a} cx={x(i)} cy={y(contexto.valores[a]!)} r={2.6} fill="var(--color-linha-2)" stroke="var(--color-folha)" strokeWidth={1} />
              ))}
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
          <path d={linha(principal, GERAIS)} fill="none" stroke="var(--color-tinta)" strokeWidth={2} />
          <path d={linha(principal, MUNICIPAIS)} fill="none" stroke="var(--color-tinta)" strokeWidth={2} opacity={0.45} />
          {ANOS.map((a, i) => {
            const v = principal.valores[a]
            if (v == null) return null
            const ativo = a === (foco ?? anoAtivo)
            return (
              <g key={a}>
                <Marcador a={a} cx={x(i)} cy={y(v)} r={ativo ? 7.5 : 6} fill={corVies(v)} stroke="var(--color-folha)" strokeWidth={2.5} />
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
            <p className="font-bold tabular">{foco} <span className="font-normal text-tinta-3">· {geral(foco) ? 'eleição geral' : 'eleição municipal'}</span></p>
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
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.76rem] text-tinta-2">
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="12" aria-hidden><line x1="0" y1="6" x2="22" y2="6" stroke="var(--color-tinta)" strokeWidth="2" /><circle cx="11" cy="6" r="4.5" fill="var(--color-tinta-2)" stroke="var(--color-folha)" strokeWidth="1.5" /></svg>
          Gerais (2018, 2022)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="14" aria-hidden><line x1="0" y1="7" x2="22" y2="7" stroke="var(--color-tinta)" strokeWidth="2" opacity="0.45" /><path d="M11 1.5L16.5 7L11 12.5L5.5 7Z" fill="var(--color-tinta-2)" stroke="var(--color-folha)" strokeWidth="1.5" /></svg>
          Municipais (2020, 2024)
        </span>
      </div>
      <TabelaAlternavel
        titulo={`Viés de ${principal.nome} por ano`}
        colunas={['Ano', principal.nome, ...(contexto ? [contexto.nome] : [])]}
        linhas={ANOS.map((a) => [String(a), fmtVies(principal.valores[a]), ...(contexto ? [fmtVies(contexto.valores[a])] : [])])}
      />
    </figure>
  )
}
