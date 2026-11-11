// P8: uma barra por grupo de candidatos, altura = parte que se elegeu. Embaixo de cada barra, o nome do grupo e
// quantos candidatos ele tem (o número que diz se a taxa vale alguma coisa). A linha tracejada é a taxa de todos.
// Grupos com menos de MINIMO candidatos ficam só no contorno, como na curva de vitória da P1.
import { memo, useId, useState } from 'react'
import type { GrupoRepasse } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import type { ConsultaSql } from '../lib/sql'
import { inteiro, pct, plural } from '../lib/formato'

export const MINIMO = 5
const W = 760, H = 300, m = { e: 44, d: 72, c: 30, b: 58 }

export interface BarraTaxa extends GrupoRepasse {
  /** a segunda linha embaixo da barra (a faixa de valores) */
  detalhe?: string
  /** a cor da barra; sem ela, o azul do dinheiro público */
  cor?: string
}

export const BarrasTaxa = memo(function BarrasTaxa({ grupos, geral, titulo, descricao, colunaGrupo, sql }: {
  grupos: BarraTaxa[]
  /** % de eleitos de todos os candidatos da base */
  geral: number | null
  titulo: string
  /** o resumo do gráfico para leitor de tela */
  descricao: string
  colunaGrupo: string
  sql?: ConsultaSql
}) {
  const id = useId()
  const [foco, setFoco] = useState<number | null>(null)
  const n = grupos.length
  // teto em múltiplo de 20: as marcas (quartos do teto) caem em números redondos
  const teto = Math.min(100, Math.max(20, Math.ceil((Math.max(geral ?? 0, ...grupos.map((g) => g.taxa ?? 0)) + 4) / 20) * 20))
  const bw = (W - m.e - m.d) / Math.max(1, n)
  const x = (i: number) => m.e + i * bw
  const y = (taxa: number) => m.c + (1 - taxa / teto) * (H - m.c - m.b)
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((t) => t * teto)
  const g = foco != null ? grupos[foco] : null
  const fino = bw < 70

  return (
    <figure className="m-0">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <div className="relative min-w-[560px] md:min-w-0">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-labelledby={`${id}-t`} onPointerLeave={() => setFoco(null)}>
            <title id={`${id}-t`}>{descricao}</title>
            {marcas.map((t) => (
              <g key={t}>
                <line x1={m.e} x2={W - m.d + 8} y1={y(t)} y2={y(t)} stroke="var(--color-linha)" />
                <text x={m.e - 8} y={y(t) + 4} textAnchor="end" className="tabular fill-tinta-3 text-[12px]">{inteiro(t)}%</text>
              </g>
            ))}
            {grupos.map((b, i) => {
              const confiavel = b.candidatos >= MINIMO
              const taxa = b.taxa ?? 0
              const meio = x(i) + bw / 2
              return (
                <g key={b.rotulo}>
                  {b.candidatos > 0 && (
                    <rect
                      x={x(i) + Math.min(10, bw * 0.12)} y={y(taxa)} width={bw - 2 * Math.min(10, bw * 0.12)} height={Math.max(1.5, y(0) - y(taxa))} rx={4}
                      fill={confiavel ? (b.cor ?? 'var(--azul)') : 'none'}
                      stroke={confiavel ? 'none' : 'var(--color-linha-2)'} strokeDasharray={confiavel ? undefined : '3 3'}
                      opacity={foco == null || foco === i ? 1 : 0.45}
                    />
                  )}
                  <text x={meio} y={y(taxa) - 7} textAnchor="middle" className="tabular fill-tinta text-[13px] font-bold">
                    {b.candidatos === 0 ? 'vazia' : pct(b.taxa, 0)}
                  </text>
                  <text x={meio} y={H - m.b + 18} textAnchor="middle" className="fill-tinta text-[12.5px] font-semibold">{b.rotulo}</text>
                  <text x={meio} y={H - m.b + 34} textAnchor="middle" className="tabular fill-tinta-3 text-[11.5px]">
                    {fino ? inteiro(b.candidatos) : plural(b.candidatos, 'candidato', 'candidatos')}
                  </text>
                  {b.detalhe && !fino && (
                    <text x={meio} y={H - m.b + 49} textAnchor="middle" className="tabular fill-tinta-3 text-[11px]">{b.detalhe}</text>
                  )}
                  <rect
                    x={x(i)} y={m.c} width={bw} height={H - m.c - m.b} fill="transparent" tabIndex={0}
                    aria-label={`${b.rotulo}${b.detalhe ? ` (${b.detalhe})` : ''}: ${plural(b.candidatos, 'candidato', 'candidatos')}, ${inteiro(b.eleitos)} eleitos${b.taxa != null ? `, ${pct(b.taxa, 0)}` : ''}`}
                    onPointerEnter={() => setFoco(i)} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}
                    className="outline-none"
                  />
                </g>
              )
            })}
            {geral != null && (
              <g pointerEvents="none">
                <line x1={m.e} x2={W - m.d + 8} y1={y(geral)} y2={y(geral)} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="6 5" />
                <text x={W - m.d + 12} y={y(geral) - 3} className="fill-tinta text-[12px] font-bold">todos</text>
                <text x={W - m.d + 12} y={y(geral) + 12} className="tabular fill-tinta text-[12px] font-bold">{pct(geral, 0)}</text>
              </g>
            )}
          </svg>
          {g && foco != null && (
            <div
              className="pointer-events-none absolute top-4 z-10 rounded-lg border border-linha bg-folha px-2.5 py-2 text-[0.78rem] shadow-[var(--shadow-cartao)]"
              style={{ left: `${((x(foco) + bw / 2) / W) * 100}%`, transform: `translateX(${foco >= n / 2 ? 'calc(-100% - 10px)' : '10px'})` }}
            >
              <p className="font-bold">{g.rotulo}{g.detalhe ? ` · ${g.detalhe}` : ''}</p>
              <p className="tabular">{plural(g.candidatos, 'candidato', 'candidatos')} · {inteiro(g.eleitos)} eleitos</p>
              <p className="tabular text-tinta-2">
                {g.candidatos === 0 ? 'ninguém nesta faixa' : g.candidatos >= MINIMO ? `${pct(g.taxa, 1)} se elegeram` : `${pct(g.taxa, 0)}, mas são poucos candidatos`}
              </p>
            </div>
          )}
        </div>
      </div>
      {grupos.some((b) => b.candidatos > 0 && b.candidatos < MINIMO) && (
        <p className="mt-2 text-[0.8rem] text-tinta-3">Barras só no contorno: menos de {MINIMO} candidatos, um eleito a mais muda muito a porcentagem.</p>
      )}
      <TabelaAlternavel sql={sql}
        titulo={titulo}
        colunas={[colunaGrupo, 'Candidatos', 'Eleitos', 'Se elegeram']}
        linhas={() => grupos.map((b) => [b.detalhe ? `${b.rotulo} (${b.detalhe})` : b.rotulo, inteiro(b.candidatos), inteiro(b.eleitos), b.taxa == null ? '-' : pct(b.taxa, 1)])}
      />
    </figure>
  )
})
