// A assinatura da P5: o mosaico de cadeiras. Cada pastilha é uma cadeira (ou N, quando são muitas), agrupadas por
// partido e na ordem do tamanho: cobalto = eleito pelo quociente, amarelo = pelas médias. O nome do partido fica na
// própria peça (rótulo direto, sem legenda distante). Clicar numa peça abre os eleitos do partido na lista abaixo.
import type { PartidoLegenda, SituacaoLegenda } from '../api'
import { inteiro } from '../lib/formato'

export function LegendaMosaico({ partidos, unidade, aberto, aoAbrir }: {
  partidos: PartidoLegenda[]
  unidade: number
  aberto?: string
  aoAbrir: (sigla: string, tipo: SituacaoLegenda) => void
}) {
  const pecas = (n: number) => (n > 0 ? Math.max(1, Math.round(n / unidade)) : 0)
  return (
    <div
      role="img"
      aria-label={`Mosaico: ${partidos.map((p) => `${p.sigla} ${p.total}`).join(', ')}`}
      className="flex flex-wrap items-start gap-x-5 gap-y-5 [--t:12px] sm:[--t:15px]"
    >
      {partidos.map((p) => {
        const q = pecas(p.qp), m = pecas(p.media), n = q + m
        const colunas = Math.min(n, Math.max(2, Math.ceil(Math.sqrt(n * 1.7))))
        const ativo = aberto === p.sigla
        return (
          // o mosaico é uma vista; o equivalente por teclado e leitor de tela é a lista de partidos logo abaixo
          <div
            key={p.sigla}
            onClick={() => aoAbrir(p.sigla, p.qp > 0 ? 'qp' : 'media')}
            title={`${p.sigla}: ${inteiro(p.qp)} pelo quociente e ${inteiro(p.media)} pelas médias`}
            className={`cursor-pointer rounded-[8px] p-1.5 transition-colors hover:bg-acao-claro ${ativo ? 'bg-acao-claro ring-[3px] ring-tinta' : ''}`}
            aria-hidden
          >
            <p className="mb-1.5 flex items-baseline gap-1.5 font-[family-name:var(--font-display)] leading-none text-tinta">
              <span className="text-[1.05rem] font-extrabold">{p.sigla}</span>
              <span className="tabular text-[0.82rem] font-bold text-tinta-2">{inteiro(p.total)}</span>
            </p>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${colunas}, var(--t))` }}>
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className="block aspect-square rounded-[3px]" style={{ background: i < q ? 'var(--color-eleito)' : 'var(--amarelo)' }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
