// Espectro do voto: para cada ano, uma barra 100% com os partidos ordenados do mais à
// esquerda ao mais à direita, cada um na cor do próprio viés. Pequenos múltiplos por ano:
// o deslocamento da barra no tempo é a resposta visual da P7.
import { useState } from 'react'
import { ANOS, type Ano, type Partido, type PorAno } from '../api'
import { inteiro, pct, vies as fmtVies } from '../lib/formato'
import { corVies, tintaSobre } from '../lib/vies'
import { TabelaAlternavel } from './TabelaAlternavel'

interface Foco {
  ano: string
  p: Partido
  x: number
}

export function Espectro({ espectro, anoAtivo }: { espectro: PorAno<Partido[]>; anoAtivo: Ano }) {
  const [foco, setFoco] = useState<Foco | null>(null)
  const anos = ANOS.filter((a) => espectro[a]?.length)
  if (!anos.length) return <p className="text-tinta-2">Sem votação por partido para este município.</p>

  return (
    <figure className="m-0">
      <div className="relative space-y-3.5" onPointerLeave={() => setFoco(null)}>
        {anos.map((a) => {
          const partidos = espectro[a]!
          const maiores = new Set([...partidos].sort((x, y) => y.pct - x.pct).slice(0, 3).map((p) => p.sigla))
          let acumulado = 0
          return (
            <div key={a} className="grid grid-cols-[44px_1fr] items-center gap-3">
              <span className={`tabular text-[0.82rem] ${a === anoAtivo ? 'font-bold text-tinta' : 'font-semibold text-tinta-3'}`}>{a}</span>
              <div className="relative">
                <div className={`flex h-7 gap-[2px] overflow-hidden rounded-[5px] ${a === anoAtivo ? '' : 'opacity-80'}`} role="img" aria-label={`${a}: ${partidos.map((p) => `${p.sigla} ${pct(p.pct)}`).join(', ')}`}>
                  {partidos.map((p) => {
                    const inicio = acumulado
                    acumulado += p.pct
                    const largo = p.pct >= 6 + p.sigla.length * 2.2 // o rótulo só entra se couber
                    return (
                      <div
                        key={p.sigla + p.numero}
                        className="relative flex min-w-[1.5px] items-center justify-center overflow-hidden transition-[filter] hover:brightness-110"
                        style={{ flex: `${p.pct} 0 0`, background: p.vies === 0 ? 'var(--color-neutro)' : corVies(p.vies) }}
                        onPointerEnter={() => setFoco({ ano: a.toString(), p, x: inicio + p.pct / 2 })}
                      >
                        {largo && maiores.has(p.sigla) && (
                          <span className="truncate px-1 text-[0.7rem] font-bold" style={{ color: tintaSobre(p.vies) }}>
                            {p.sigla}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <div className="grid grid-cols-[44px_1fr] gap-3 text-[0.72rem] text-tinta-3">
          <span />
          <span className="flex justify-between">
            <span>← esquerda</span>
            <span>direita →</span>
          </span>
        </div>
        {foco && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-lg border border-linha bg-folha px-2.5 py-2 text-[0.78rem] shadow-[var(--shadow-cartao)]"
            style={{
              top: `${anos.indexOf(Number(foco.ano) as Ano) * 42 + 32}px`,
              left: `calc(56px + (100% - 56px) * ${foco.x / 100})`,
              transform: `translateX(${foco.x > 60 ? '-100%' : '0'})`,
            }}
          >
            <p className="font-bold">
              {foco.p.sigla} <span className="font-normal text-tinta-3">· {foco.ano}</span>
            </p>
            {foco.p.nome && <p className="text-tinta-2">{foco.p.nome.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}</p>}
            <p className="mt-1 tabular">
              {pct(foco.p.pct)} dos votos válidos · {inteiro(foco.p.votos)}
            </p>
            <p className="tabular text-tinta-2">{foco.p.vies === 0 ? 'Viés não informado (conta como 0)' : `Viés do partido: ${fmtVies(foco.p.vies)}`}</p>
          </div>
        )}
      </div>
      <TabelaAlternavel
        titulo={`Votos válidos por partido em ${anoAtivo}`}
        colunas={['Partido', 'Viés', 'Votos', '%']}
        linhas={(espectro[anoAtivo] ?? []).map((p) => [p.sigla, p.vies === 0 ? 'não informado' : fmtVies(p.vies), inteiro(p.votos), pct(p.pct)])}
      />
    </figure>
  )
}
