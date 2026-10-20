// O seletor de estado da P2: um minimapa do Brasil. Os estados carregados acendem no oliva claro e são
// botões (clique, toque, Tab e Enter); os outros ficam em papel, "sem dados". O escolhido fica no oliva cheio
// com a sigla em branco e dá um pulo curto; passar o mouse levanta o estado e diz o nome embaixo.
// "Todos" volta à soma dos estados carregados. Com Presidente (disputa nacional) o mapa fica esmaecido.
import { memo, useMemo, useState } from 'react'
import type { Malha, UF } from '../api'
import { formas, projecaoBrasil } from '../atlas/geo'

export const MapaEstados = memo(function MapaEstados({ malha, ufs, escolhida, aoEscolher, nacional }: {
  malha: Malha | undefined
  ufs: UF[]
  escolhida: string
  aoEscolher: (sigla: string | undefined) => void
  /** Presidente: o recorte é sempre o Brasil inteiro */
  nacional: boolean
}) {
  const [sobre, setSobre] = useState<string | null>(null)
  const mapa = useMemo(() => (malha ? formas(malha, projecaoBrasil(malha), 1) : []), [malha])
  const porCodigo = useMemo(() => new Map(ufs.map((u) => [u.cd_ibge, u])), [ufs])
  const caixa = useMemo(() => {
    if (!mapa.length) return '0 0 1000 1000'
    const x0 = Math.min(...mapa.map((f) => f.caixa[0][0]))
    const y0 = Math.min(...mapa.map((f) => f.caixa[0][1]))
    const x1 = Math.max(...mapa.map((f) => f.caixa[1][0]))
    const y1 = Math.max(...mapa.map((f) => f.caixa[1][1]))
    return `${x0 - 8} ${y0 - 8} ${x1 - x0 + 16} ${y1 - y0 + 16}`
  }, [mapa])
  const nomeSobre = sobre ? ufs.find((u) => u.sigla === sobre)?.nome : null
  const nomeEscolhida = escolhida ? ufs.find((u) => u.sigla === escolhida)?.nome : null
  // o escolhido é desenhado por último, para o contorno dele ficar por cima dos vizinhos
  const ordem = useMemo(() => mapa.toSorted((a, b) => Number(porCodigo.get(a.codigo)?.sigla === escolhida) - Number(porCodigo.get(b.codigo)?.sigla === escolhida)), [mapa, porCodigo, escolhida])

  return (
    <div className={`mapa-estados flex items-center gap-4 transition-opacity duration-300 ${nacional ? 'opacity-45' : ''}`}>
      <svg
        role="radiogroup"
        aria-label="Estado"
        aria-disabled={nacional || undefined}
        viewBox={caixa}
        className="h-[176px] w-[176px] shrink-0 overflow-visible sm:h-[196px] sm:w-[196px]"
      >
        {ordem.map((f) => {
          const uf = porCodigo.get(f.codigo)
          if (!uf) return <path key={f.codigo} d={f.d} className="estado-sem-dados" />
          const ativo = uf.sigla === escolhida
          const aceso = !escolhida || ativo
          return (
            <g
              key={f.codigo}
              role="radio"
              aria-checked={ativo}
              aria-label={uf.nome}
              tabIndex={nacional ? -1 : 0}
              className={`estado-alvo ${ativo ? 'estado-ativo' : aceso ? 'estado-aceso' : 'estado-apagado'}`}
              onClick={() => !nacional && aoEscolher(ativo ? undefined : uf.sigla)}
              onKeyDown={(e) => {
                if (nacional || (e.key !== 'Enter' && e.key !== ' ')) return
                e.preventDefault()
                aoEscolher(ativo ? undefined : uf.sigla)
              }}
              onPointerEnter={() => setSobre(uf.sigla)}
              onPointerLeave={() => setSobre(null)}
              onFocus={() => setSobre(uf.sigla)}
              onBlur={() => setSobre(null)}
            >
              <path d={f.d} />
            </g>
          )
        })}
        {/* as siglas numa camada por cima de todos os estados, para nenhum vizinho cobrir */}
        <g aria-hidden className="pointer-events-none">
          {mapa.map((f) => {
            const uf = porCodigo.get(f.codigo)
            if (!uf) return null
            return (
              <text key={f.codigo} x={f.centro[0]} y={f.centro[1]} textAnchor="middle" dominantBaseline="central" className={uf.sigla === escolhida ? 'sigla-ativa' : 'sigla'}>
                {uf.sigla}
              </text>
            )
          })}
        </g>
      </svg>
      <div className="min-w-0">
        <p className="t-rotulo text-tinta-3">Estado</p>
        <p className="mt-0.5 min-h-[1.6em] text-[1.1rem] font-bold leading-tight text-tinta" aria-live="polite">
          {nacional ? 'Brasil inteiro' : nomeSobre ?? nomeEscolhida ?? `Todos os ${ufs.length}`}
        </p>
        <p className="mt-1 max-w-[18ch] text-[0.8rem] leading-snug text-tinta-3">
          {nacional ? 'Presidente é disputa nacional' : 'Toque num estado aceso'}
        </p>
        {!nacional && escolhida && (
          <button type="button" onClick={() => aoEscolher(undefined)} className="botao-contorno mt-3 h-10 px-4 text-[0.84rem]">
            Ver todos
          </button>
        )}
      </div>
    </div>
  )
})
