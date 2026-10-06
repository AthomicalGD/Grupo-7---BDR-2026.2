// Trajetória de um político: uma faixa por cargo (só os disputados, em ordem de hierarquia),
// eixo de 1994 a 2026. Ponto cheio = eleito, anel = reeleito, vazado = não eleito; barra fina
// com a duração do mandato; linha cinza ligando as candidaturas em ordem.
import { useId, useState } from 'react'
import type { Candidatura } from '../api'
import { duracaoMandato, situacao } from '../lib/carreira'
import { cargo as fmtCargo, inteiro } from '../lib/formato'
import { TabelaAlternavel } from './TabelaAlternavel'

// cod_cargo do TSE, de baixo para cima
const HIERARQUIA = [13, 12, 11, 7, 8, 6, 9, 10, 5, 4, 3, 2, 1]
const INICIO = 1994, FIM = 2026

export function Trajetoria({ candidaturas }: { candidaturas: Candidatura[] }) {
  const id = useId()
  const [foco, setFoco] = useState<number | null>(null)
  const cargos = HIERARQUIA.filter((c) => candidaturas.some((x) => x.cod_cargo === c))
  const nomeCargo = new Map(candidaturas.map((c) => [c.cod_cargo, fmtCargo(c.cargo)]))
  const W = 1000, faixa = 44, m = { e: 150, d: 24, c: 18, b: 34 }
  const H = m.c + cargos.length * faixa + m.b
  const x = (ano: number) => m.e + ((ano - INICIO) / (FIM - INICIO)) * (W - m.e - m.d)
  const y = (cod: number) => m.c + (cargos.length - 1 - cargos.indexOf(cod)) * faixa + faixa / 2
  const ordem = [...candidaturas].sort((a, b) => a.ano - b.ano || a.cod_cargo - b.cod_cargo)
  const percurso = ordem.map((c, i) => `${i ? 'L' : 'M'}${x(c.ano).toFixed(1)} ${y(c.cod_cargo).toFixed(1)}`).join('')
  const c = foco != null ? ordem[foco] : null

  return (
    <figure className="m-0">
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[640px]" role="img" aria-labelledby={`${id}-t`} onPointerLeave={() => setFoco(null)}>
          <title id={`${id}-t`}>{`Trajetória por cargo: ${ordem.map((c) => `${c.ano} ${fmtCargo(c.cargo)} ${situacao(c).toLowerCase()}`).join('; ')}`}</title>
          {cargos.map((cod) => (
            <g key={cod}>
              <line x1={m.e} x2={W - m.d} y1={y(cod)} y2={y(cod)} stroke="var(--color-linha)" />
              <text x={m.e - 14} y={y(cod) + 4} textAnchor="end" className="fill-tinta-2 text-[13px] font-semibold">{nomeCargo.get(cod)}</text>
            </g>
          ))}
          {Array.from({ length: (FIM - INICIO) / 2 + 1 }, (_, i) => INICIO + i * 2).map((a) => (
            <text key={a} x={x(a)} y={H - 10} textAnchor="middle" className="tabular fill-tinta-3 text-[11px]">{a}</text>
          ))}
          {/* mandatos: começam em janeiro do ano seguinte à eleição */}
          {ordem.filter((c) => c.eleito).map((c, i) => (
            <rect
              key={i}
              x={x(c.ano + 1)}
              y={y(c.cod_cargo) - 3.5}
              width={Math.max(0, Math.min(x(c.ano + 1 + duracaoMandato(c.cod_cargo)), x(FIM)) - x(c.ano + 1))}
              height={7}
              rx={3.5}
              fill={c.reeleito ? 'var(--color-reeleito)' : 'var(--color-eleito)'}
              opacity={0.28}
            />
          ))}
          <path d={percurso} fill="none" stroke="var(--color-linha-2)" strokeWidth={1.6} strokeLinejoin="round" />
          {ordem.map((c, i) => {
            const cx = x(c.ano), cy = y(c.cod_cargo)
            const cor = c.reeleito ? 'var(--color-reeleito)' : 'var(--color-eleito)'
            return (
              <g key={i} onPointerEnter={() => setFoco(i)} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)} tabIndex={0} aria-label={`${c.ano}, ${fmtCargo(c.cargo)}, ${c.local}: ${situacao(c)}`} className="cursor-default outline-none">
                <circle cx={cx} cy={cy} r={16} fill="transparent" />
                {c.reeleito && <circle cx={cx} cy={cy} r={12} fill="none" stroke={cor} strokeWidth={1.8} />}
                <circle cx={cx} cy={cy} r={foco === i ? 8.5 : 7} fill={c.eleito ? cor : 'var(--color-folha)'} stroke={c.eleito ? 'var(--color-folha)' : 'var(--color-tinta-3)'} strokeWidth={c.eleito ? 2.5 : 2} />
              </g>
            )
          })}
        </svg>
        {c && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[260px] rounded-lg border border-linha bg-folha px-3 py-2 text-[0.8rem] shadow-[var(--shadow-cartao)]"
            style={{ left: `${(x(c.ano) / W) * 100}%`, top: `${((y(c.cod_cargo) + 18) / H) * 100}%`, transform: `translateX(${c.ano > 2012 ? 'calc(-100% + 12px)' : '-12px'})` }}
          >
            <p className="font-bold">{c.ano} · {fmtCargo(c.cargo)}</p>
            <p className="text-tinta-2">{c.local}{c.partido ? ` · ${c.partido}` : ''}</p>
            <p className="mt-1 font-semibold">{situacao(c)}{c.votos != null ? ` · ${inteiro(c.votos)} votos` : ''}</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-tinta-2">
        <span className="inline-flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5.5" fill="var(--color-eleito)" /></svg>Eleito</span>
        <span className="inline-flex items-center gap-1.5"><svg width="18" height="18" aria-hidden><circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--color-reeleito)" strokeWidth="1.5" /><circle cx="9" cy="9" r="4.5" fill="var(--color-reeleito)" /></svg>Reeleito</span>
        <span className="inline-flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5" fill="var(--color-folha)" stroke="var(--color-tinta-3)" strokeWidth="2" /></svg>Não eleito</span>
        <span className="inline-flex items-center gap-1.5"><svg width="22" height="8" aria-hidden><rect y="1" width="22" height="6" rx="3" fill="var(--color-eleito)" opacity="0.3" /></svg>Duração do mandato</span>
      </div>
      <TabelaAlternavel
        titulo="Candidaturas"
        colunas={['Ano', 'Cargo', 'Local', 'Partido', 'Resultado', 'Votos']}
        linhas={ordem.map((c) => [String(c.ano), fmtCargo(c.cargo), c.local, c.partido ?? '-', situacao(c), c.votos != null ? inteiro(c.votos) : '-'])}
      />
    </figure>
  )
}
