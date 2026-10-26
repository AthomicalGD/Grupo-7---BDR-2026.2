// Gráficos da interface simples: desenhados na medida do contêiner, rótulos direto no dado
// (sem legenda à parte quando dá) e uma dica que segue o ponteiro.
import { useState, type MouseEvent, type ReactNode } from 'react'
import { ANOS, type PorAno } from '../api'
import { useLargura } from '../escola/escolaridade'
import { vies as fmtVies } from '../lib/formato'
import { corVies } from './cores'

// ───────── dica ─────────

type EstadoDica = { x: number; y: number; conteudo: ReactNode } | null

export function useDica() {
  const [dica, setDica] = useState<EstadoDica>(null)
  return {
    dica,
    mostrar: (e: MouseEvent, conteudo: ReactNode) => setDica({ x: e.clientX, y: e.clientY, conteudo }),
    esconder: () => setDica(null),
  }
}

export function Dica({ dica }: { dica: EstadoDica }) {
  if (!dica) return null
  const direita = dica.x > window.innerWidth - 240
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[240px] rounded-md bg-tinta px-3 py-2 text-[0.82rem] leading-snug text-folha shadow-papel"
      style={{ left: direita ? undefined : dica.x + 14, right: direita ? window.innerWidth - dica.x + 14 : undefined, top: dica.y + 14 }}
    >
      {dica.conteudo}
    </div>
  )
}

// ───────── viés na linha do tempo ─────────

export interface Serie {
  nome: string
  valores: PorAno<number>
  destaque?: boolean
}

/** Linhas do viés de 2018 a 2024, com o zero marcado; a série em destaque leva os valores. */
export function LinhaVies({ series, altura = 240, mini = false }: { series: Serie[]; altura?: number; mini?: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const todos = series.flatMap((s) => ANOS.map((a) => s.valores[a]).filter((v): v is number => v != null))
  const lim = Math.max(mini ? 50 : 60, Math.ceil(Math.max(0, ...todos.map(Math.abs)) / 10) * 10)
  const m = mini ? { t: 8, r: 10, b: 18, l: 10 } : { t: 18, r: 92, b: 28, l: 44 }
  const w = Math.max(0, largura - m.l - m.r)
  const h = altura - m.t - m.b
  const x = (i: number) => m.l + (i * w) / (ANOS.length - 1)
  const y = (v: number) => m.t + ((lim - v) / (2 * lim)) * h
  const ordem = [...series].sort((a, b) => Number(!!a.destaque) - Number(!!b.destaque)) // destaque por cima
  // rótulos no fim das linhas: se dois caem perto, afasta um do outro
  const fins = new Map<string, number>()
  for (const s of series) {
    const v = ANOS.map((a) => s.valores[a]).findLast((v) => v != null)
    if (v != null) fins.set(s.nome, y(v))
  }
  if (fins.size === 2) {
    const [[n1, y1], [n2, y2]] = [...fins.entries()]
    if (Math.abs(y1 - y2) < 15) {
      const meio = (y1 + y2) / 2
      const [cima, baixo] = y1 <= y2 ? [n1, n2] : [n2, n1]
      fins.set(cima, meio - 8)
      fins.set(baixo, meio + 8)
    }
  }

  return (
    <div ref={ref} className="w-full">
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label={`Viés de ${series.map((s) => s.nome).join(' e ')} de 2018 a 2024`}>
          {!mini &&
            [lim, lim / 2, 0, -lim / 2, -lim].map((v) => (
              <g key={v}>
                <line x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--color-linha-2)' : 'var(--color-linha)'} strokeDasharray={v === 0 ? undefined : '2 4'} />
                <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-tinta-3 text-[12px] tabular-nums">
                  {fmtVies(v).replace(',0', '')}
                </text>
              </g>
            ))}
          {mini && <line x1={m.l} x2={m.l + w} y1={y(0)} y2={y(0)} stroke="var(--color-linha-2)" />}
          {!mini && (
            <>
              <text x={m.l + 6} y={y(lim) + 14} className="fill-tinta-3 text-[12px]">↑ direita</text>
              <text x={m.l + 6} y={y(-lim) - 6} className="fill-tinta-3 text-[12px]">↓ esquerda</text>
            </>
          )}
          {ANOS.map((a, i) => (
            <text key={a} x={x(i)} y={altura - (mini ? 4 : 8)} textAnchor="middle" className={`fill-tinta-3 tabular-nums ${mini ? 'text-[12px]' : 'text-[12px]'}`}>
              {mini ? `’${String(a).slice(2)}` : a}
            </text>
          ))}
          {ordem.map((s) => {
            const pts = ANOS.map((a, i) => ({ a, i, v: s.valores[a] })).filter((p): p is { a: (typeof ANOS)[number]; i: number; v: number } => p.v != null)
            const forte = s.destaque || series.length === 1
            const ultimo = pts.at(-1)
            return (
              <g key={s.nome}>
                <polyline
                  points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                  fill="none"
                  stroke={forte ? 'var(--color-tinta)' : 'var(--color-linha-2)'}
                  strokeWidth={forte ? 2 : 1.5}
                  strokeDasharray={forte ? undefined : '4 3'}
                />
                {pts.map((p) => (
                  <g key={p.a}>
                    <circle cx={x(p.i)} cy={y(p.v)} r={forte ? (mini ? 4 : 6) : 4} fill={corVies(p.v)} stroke="var(--color-folha)" strokeWidth={2} />
                    {forte && !mini && (
                      <text x={x(p.i)} y={y(p.v) + (p.v < 0 ? -12 : 20)} textAnchor="middle" className="fill-tinta text-[12px] font-semibold tabular-nums">
                        {fmtVies(p.v)}
                      </text>
                    )}
                  </g>
                ))}
                {!mini && ultimo && series.length > 1 && (
                  <text x={x(ultimo.i) + 12} y={fins.get(s.nome) ?? y(ultimo.v)} dy="0.32em" className={`text-[12px] ${forte ? 'fill-tinta font-semibold' : 'fill-tinta-3'}`}>
                    {s.nome.length > 13 ? s.nome.slice(0, 12) + '…' : s.nome}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ───────── distribuição (dot plot) ─────────

export interface Ponto {
  id: number
  nome: string
  v: number
}

/** Cada município é um ponto empilhado na sua faixa de viés: a forma mostra para onde o estado se espalha. */
export function Distribuicao({ pontos, aoEscolher, destaque }: { pontos: Ponto[]; aoEscolher?: (p: Ponto) => void; destaque?: number }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const { dica, mostrar, esconder } = useDica()
  const r = largura < 500 ? 3.2 : 4.2
  const passo = r * 2 + 1
  const lim = Math.max(60, Math.ceil(Math.max(0, ...pontos.map((p) => Math.abs(p.v))) / 10) * 10)
  const m = { l: 8, r: 8 }
  const w = Math.max(0, largura - m.l - m.r)
  const x = (v: number) => m.l + ((v + lim) / (2 * lim)) * w
  const colunas = new Map<number, Ponto[]>()
  for (const p of [...pontos].sort((a, b) => a.v - b.v)) {
    const c = Math.round(x(p.v) / passo)
    colunas.set(c, [...(colunas.get(c) ?? []), p])
  }
  const pilha = Math.max(1, ...[...colunas.values()].map((c) => c.length))
  const base = pilha * passo + 8
  const altura = base + 30

  return (
    <div ref={ref} className="w-full">
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label={`Distribuição de ${pontos.length} municípios pelo viés`} onMouseLeave={esconder}>
          <line x1={x(0)} x2={x(0)} y1={0} y2={base} stroke="var(--color-linha-2)" strokeDasharray="2 3" />
          <line x1={m.l} x2={m.l + w} y1={base} y2={base} stroke="var(--color-linha-2)" />
          {[-lim, -lim / 2, 0, lim / 2, lim].map((v) => (
            <text key={v} x={x(v)} y={base + 16} textAnchor={v === -lim ? 'start' : v === lim ? 'end' : 'middle'} className="fill-tinta-3 text-[12px] tabular-nums">
              {fmtVies(v).replace(',0', '')}
            </text>
          ))}
          <text x={m.l} y={base + 28} className="fill-tinta-3 text-[12px]">← esquerda</text>
          <text x={m.l + w} y={base + 28} textAnchor="end" className="fill-tinta-3 text-[12px]">direita →</text>
          {[...colunas.entries()].map(([c, ps]) =>
            ps.map((p, i) => (
              <circle
                key={p.id}
                cx={c * passo}
                cy={base - r - 2 - i * passo}
                r={p.id === destaque ? r + 1.5 : r}
                fill={corVies(p.v)}
                stroke={p.id === destaque ? 'var(--color-tinta)' : 'none'}
                strokeWidth={2}
                className={aoEscolher ? 'cursor-pointer' : undefined}
                onMouseMove={(e) =>
                  mostrar(
                    e,
                    <>
                      <strong>{p.nome}</strong> {fmtVies(p.v)}
                    </>,
                  )
                }
                onClick={() => aoEscolher?.(p)}
              />
            )),
          )}
        </svg>
      )}
      <Dica dica={dica} />
    </div>
  )
}

// ───────── barras horizontais ─────────

export interface Barra {
  chave: string
  rotulo: ReactNode
  valor: number
  cor: string
  texto: string
  dica?: ReactNode
}

/** Barras de comprimento proporcional ao maior valor, com o rótulo à esquerda e o número no fim. */
export function BarrasH({ barras, larguraRotulo = '6.5rem' }: { barras: Barra[]; larguraRotulo?: string }) {
  const { dica, mostrar, esconder } = useDica()
  const max = Math.max(...barras.map((b) => b.valor), 0) || 1
  return (
    <>
    <ul className="space-y-1.5" onMouseLeave={esconder}>
      {barras.map((b) => (
        <li
          key={b.chave}
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: `${larguraRotulo} 1fr` }}
          onMouseMove={b.dica ? (e) => mostrar(e, b.dica) : undefined}
        >
          <span className="truncate text-[0.9rem] font-semibold">{b.rotulo}</span>
          <span className="flex items-center gap-2">
            <span className="h-5 rounded-[3px]" style={{ width: `${(b.valor / max) * 82}%`, minWidth: 2, background: b.cor }} />
            <span className="shrink-0 text-[0.85rem] tabular-nums text-tinta-2">{b.texto}</span>
          </span>
        </li>
      ))}
    </ul>
    <Dica dica={dica} />
    </>
  )
}

// ───────── colunas (uma por item) ─────────

/** Uma coluna por item, do maior ao menor: mostra a forma da desigualdade, a dica diz quem é. */
export function Colunas({ itens, altura = 180 }: { itens: { chave: string | number; valor: number; cor: string; dica: ReactNode }[]; altura?: number }) {
  const { dica, mostrar, esconder } = useDica()
  const max = Math.max(...itens.map((i) => i.valor), 0) || 1
  return (
    <div className="flex items-end gap-px border-b border-linha-2" style={{ height: altura }} onMouseLeave={esconder} role="img" aria-label={`${itens.length} colunas, do maior ao menor`}>
      {itens.map((i) => (
        <span
          key={i.chave}
          className="min-w-px flex-1 rounded-t-[2px] hover:opacity-70"
          style={{ height: `${Math.max(1, (i.valor / max) * 100)}%`, background: i.cor }}
          onMouseMove={(e) => mostrar(e, i.dica)}
        />
      ))}
      <Dica dica={dica} />
    </div>
  )
}

// ───────── composição (barra 100%) ─────────

export function Composicao({ partes, cores, rotulos, altura = 22 }: { partes: number[]; cores: string[]; rotulos: string[]; altura?: number }) {
  const { dica, mostrar, esconder } = useDica()
  const total = partes.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="flex w-full overflow-hidden rounded-[3px] bg-papel-2" style={{ height: altura }} onMouseLeave={esconder}>
      {partes.map((p, i) =>
        p > 0 ? (
          <span
            key={i}
            className="h-full border-r border-folha/70 last:border-r-0"
            style={{ width: `${(p / total) * 100}%`, background: cores[i] }}
            onMouseMove={(e) =>
              mostrar(
                e,
                <>
                  <strong>{rotulos[i]}</strong>: {((p / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </>,
              )
            }
          />
        ) : null,
      )}
      <Dica dica={dica} />
    </div>
  )
}
