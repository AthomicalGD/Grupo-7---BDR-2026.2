// O seletor de estado do site (P2 e as páginas com recorte por estado): um minimapa do Brasil. Os estados carregados acendem no oliva claro e são
// botões (clique, toque, Tab e Enter); os outros ficam em papel, "sem dados". O escolhido fica no oliva cheio
// com a sigla em branco e dá um pulo curto; passar o mouse levanta o estado e diz o nome embaixo.
// "Todos" volta à soma dos estados carregados (ou não existe, com `obrigatorio`). Com Presidente (disputa
// nacional) o mapa fica esmaecido. As siglas dos estados pequenos (DF, SE, AL...) só aparecem no escolhido ou
// sob o ponteiro: com os 27 acesos elas se atropelavam no Nordeste; o nome inteiro sempre aparece ao lado.
import { Plus } from '@phosphor-icons/react'
import { memo, useMemo, useState } from 'react'
import type { Malha, UF } from '../api'
import { ufsFrase } from '../lib/formato'
import { Bandeira, useBandeiras } from './Bandeira'
import { formas, projecaoBrasil } from '../atlas/geo'

// abaixo deste lado (unidades do viewBox) a sigla não cabe no estado sem invadir os vizinhos
const LADO_SIGLA = 62

export const MapaEstados = memo(function MapaEstados({ malha, ufs, escolhida, aoEscolher, escolhidas, aoEscolherVarias, nacional = false, obrigatorio = false }: {
  malha: Malha | undefined
  ufs: UF[]
  escolhida: string
  aoEscolher: (sigla: string | undefined) => void
  /** modo de vários estados: com `aoEscolherVarias`, o clique escolhe um estado e Ctrl (Cmd, Shift) + clique junta mais um */
  escolhidas?: readonly string[]
  aoEscolherVarias?: (siglas: string[]) => void
  /** Presidente: o recorte é sempre o Brasil inteiro */
  nacional?: boolean
  /** sempre há um estado escolhido (sem "Todos") */
  obrigatorio?: boolean
}) {
  const varios = !!aoEscolherVarias
  const marcadas = useMemo(() => (varios ? [...(escolhidas ?? [])] : escolhida ? [escolhida] : []), [varios, escolhidas, escolhida])
  // no celular não há Ctrl: o botão "Juntar estados" faz o papel dele
  const [juntando, setJuntando] = useState(false)
  const alternar = (sigla: string, ativo: boolean, junta = false) => {
    if (!aoEscolherVarias) return aoEscolher(ativo ? (obrigatorio ? sigla : undefined) : sigla)
    if (junta) return aoEscolherVarias(ativo ? marcadas.filter((x) => x !== sigla) : [...marcadas, sigla])
    aoEscolherVarias(ativo && marcadas.length === 1 ? [] : [sigla])
  }
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
  useBandeiras(useMemo(() => ufs.map((u) => u.sigla), [ufs]))
  // a bandeira do estado sob o mouse (ou do escolhido)
  const naBandeira = nacional ? null : sobre ?? (marcadas.length === 1 ? marcadas[0] : null)
  const nomes = marcadas.map((s) => ufs.find((u) => u.sigla === s)?.nome ?? s)
  const nomeEscolhida = nomes.length === 0 ? null : nomes.length <= 3 ? nomes.join(' + ') : `${nomes.length} estados`
  // os escolhidos são desenhados por último, para o contorno deles ficar por cima dos vizinhos
  const ordem = useMemo(() => mapa.toSorted((a, b) => Number(marcadas.includes(porCodigo.get(a.codigo)?.sigla ?? '')) - Number(marcadas.includes(porCodigo.get(b.codigo)?.sigla ?? ''))), [mapa, porCodigo, marcadas])

  return (
    <div className={`mapa-estados flex items-center gap-4 transition-opacity duration-300 ${nacional ? 'opacity-45' : ''}`}>
      <svg
        role={varios ? 'group' : 'radiogroup'}
        aria-label={varios ? 'Estados' : 'Estado'}
        aria-disabled={nacional || undefined}
        viewBox={caixa}
        className="h-[176px] w-[176px] shrink-0 overflow-visible sm:h-[196px] sm:w-[196px]"
      >
        {ordem.map((f) => {
          const uf = porCodigo.get(f.codigo)
          if (!uf) return <path key={f.codigo} d={f.d} className="estado-sem-dados" />
          const ativo = marcadas.includes(uf.sigla)
          const aceso = marcadas.length === 0 || ativo
          return (
            <g
              key={f.codigo}
              role={varios ? 'checkbox' : 'radio'}
              aria-checked={ativo}
              aria-label={uf.nome}
              tabIndex={nacional ? -1 : 0}
              className={`estado-alvo ${ativo ? 'estado-ativo' : aceso ? 'estado-aceso' : 'estado-apagado'}`}
              onClick={(e) => !nacional && alternar(uf.sigla, ativo, e.ctrlKey || e.metaKey || e.shiftKey || juntando)}
              onKeyDown={(e) => {
                if (nacional || (e.key !== 'Enter' && e.key !== ' ')) return
                e.preventDefault()
                alternar(uf.sigla, ativo, e.ctrlKey || e.metaKey || e.shiftKey || juntando)
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
            const [[x0, y0], [x1, y1]] = f.caixa
            if (Math.min(x1 - x0, y1 - y0) < LADO_SIGLA && !marcadas.includes(uf.sigla) && uf.sigla !== sobre) return null
            return (
              <text key={f.codigo} x={f.centro[0]} y={f.centro[1]} textAnchor="middle" dominantBaseline="central" className={marcadas.includes(uf.sigla) ? 'sigla-ativa' : 'sigla'}>
                {uf.sigla}
              </text>
            )
          })}
        </g>
      </svg>
      <div className="min-w-0">
        {/* o lugar da bandeira fica reservado: trocar de estado não empurra o texto */}
        <div className="mb-2 h-[67px] w-[96px]">
          {naBandeira ? (
            <Bandeira key={naBandeira} sigla={naBandeira} nome={ufs.find((u) => u.sigla === naBandeira)?.nome} className="bandeira-entra" />
          ) : (
            <div aria-hidden className="size-full rounded-[6px] border-2 border-dashed border-linha-2" />
          )}
        </div>
        <p className="t-rotulo text-tinta-3">{varios ? 'Estados' : 'Estado'}</p>
        <p className="mt-0.5 min-h-[1.6em] text-[1.1rem] font-bold leading-tight text-tinta" aria-live="polite">
          {nacional ? 'Brasil inteiro' : nomeSobre ?? nomeEscolhida ?? ufsFrase(ufs, 'Todos os')}
        </p>
        <p className="mt-1 max-w-[18ch] text-[0.8rem] leading-snug text-tinta-3">
          {nacional ? 'Presidente é disputa nacional' : varios ? 'Ctrl + clique junta mais um' : 'Toque num estado aceso'}
        </p>
        {varios && !nacional && (
          <button
            type="button"
            aria-pressed={juntando}
            onClick={() => setJuntando((v) => !v)}
            title="Com este botão ligado, cada toque junta mais um estado (no celular não há Ctrl)."
            className={`mt-3 inline-flex h-9 items-center gap-1 rounded-full border-2 border-tinta px-3 text-[0.8rem] font-bold ${juntando ? 'bg-[var(--amarelo)] text-tinta' : 'bg-folha text-tinta-2 hover:bg-papel-2'}`}
          >
            <Plus size={13} weight="bold" aria-hidden /> Juntar estados
          </button>
        )}
        {!nacional && !obrigatorio && marcadas.length > 0 && (
          <button type="button" onClick={() => (aoEscolherVarias ? aoEscolherVarias([]) : aoEscolher(undefined))} className="botao-contorno mt-3 ml-0 h-10 px-4 text-[0.84rem]">
            Ver todos
          </button>
        )}
      </div>
    </div>
  )
})
