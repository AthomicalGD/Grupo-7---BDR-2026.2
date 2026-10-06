import 'd3-transition'
import { ArrowsIn, Minus, Plus } from '@phosphor-icons/react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Ano, Malha, MunicipioResumo, UF, UFDetalhe } from '../api'
import { useLoja } from '../lib/loja'
import { corVies } from '../lib/vies'
import { formas, LADO, projecaoBrasil, type Caixa, type Forma } from './geo'
import { Dica } from './Dica'
import { hover, type Foco } from './hover'
import { SATURA_RELATIVO, valorMunicipio } from './valores'

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const reduzMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  malhaBrasil: Malha
  ufs: UF[]
  ano: Ano
  sigla?: string
  ibge?: number
  malhaUF?: Malha
  detalheUF?: UFDetalhe
  relativo: boolean
  aoEscolherUF: (sigla: string) => void
  aoEscolherMunicipio: (ibge: number) => void
}

// origem do último clique num estado: daí os municípios surgem em onda
let origemClique: [number, number] | null = null

export function Mapa(p: Props) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const cameraRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null)
  const [vista, setVista] = useState({ x: 0, y: 0, w: LADO, h: LADO })
  const alvoAnterior = useRef<string | null>(null) // a câmera só anima quando o alvo muda

  const projecao = useMemo(() => projecaoBrasil(p.malhaBrasil), [p.malhaBrasil])
  const formasUF = useMemo(() => formas(p.malhaBrasil, projecao, 2), [p.malhaBrasil, projecao])
  const formasMun = useMemo(() => (p.malhaUF ? formas(p.malhaUF, projecao, 3) : []), [p.malhaUF, projecao])
  const ufPorCodigo = useMemo(() => new Map(p.ufs.map((u) => [u.cd_ibge, u])), [p.ufs])
  const munPorIbge = useMemo(() => new Map((p.detalheUF?.municipios ?? []).map((m) => [m.ibge, m])), [p.detalheUF])
  const ufSel = p.sigla ? p.ufs.find((u) => u.sigla === p.sigla) : undefined
  const formaUFSel = ufSel ? formasUF.find((f) => f.codigo === ufSel.cd_ibge) : undefined
  const formaMunSel = p.ibge ? formasMun.find((f) => f.codigo === p.ibge) : undefined
  const vUF = p.detalheUF?.vies[p.ano]
  const municipiosProntos = !!p.sigla && formasMun.length > 0 && p.detalheUF?.sigla === p.sigla

  // viewBox acompanha a proporção do contêiner, sem distorcer o mapa
  useLayoutEffect(() => {
    const el = caixaRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (!width || !height) return
      const r = width / height
      const w = r >= 1 ? LADO * r : LADO, h = r >= 1 ? LADO : LADO / r
      setVista({ x: (LADO - w) / 2, y: (LADO - h) / 2, w, h })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // comportamento de zoom (arrastar, roda, pinça); sem zoom no duplo clique
  useEffect(() => {
    const svg = svgRef.current!
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 900])
      .on('zoom', (e) => {
        cameraRef.current?.setAttribute('transform', e.transform.toString())
        // a hachura dos estados sem dados fica do mesmo tamanho na tela em qualquer zoom
        svg.querySelector('#hachura')?.setAttribute('patternTransform', `rotate(45) scale(${(1 / e.transform.k).toFixed(4)})`)
        if (e.sourceEvent) hover.set(null) // arrastar ou rolar move o mapa sob o tooltip
      })
    select(svg).call(z).on('dblclick.zoom', null)
    zoomRef.current = z
    return () => void select(svg).on('.zoom', null)
  }, [])

  // câmera: Brasil, estado ou município, com a aproximação suave do d3 (interpolateZoom)
  const caixaAlvo: { caixa: Caixa; preenche: number } = formaMunSel
    ? { caixa: formaMunSel.caixa, preenche: 0.3 }
    : formaUFSel
      ? { caixa: formaUFSel.caixa, preenche: 0.9 }
      : { caixa: [[24, 24], [LADO - 24, LADO - 24]], preenche: 0.97 }
  const chaveAlvo = caixaAlvo.caixa.flat().join(',')
  const enquadrar = (duracao: number) => {
    const z = zoomRef.current, svg = svgRef.current
    if (!z || !svg) return
    z.extent([[vista.x, vista.y], [vista.x + vista.w, vista.y + vista.h]])
    const [[x0, y0], [x1, y1]] = caixaAlvo.caixa
    const k = Math.min(600, caixaAlvo.preenche / Math.max((x1 - x0) / vista.w, (y1 - y0) / vista.h))
    const t = zoomIdentity
      .translate(vista.x + vista.w / 2 - (k * (x0 + x1)) / 2, vista.y + vista.h / 2 - (k * (y0 + y1)) / 2)
      .scale(k)
    if (duracao) hover.set(null) // a câmera vai voar: o tooltip de onde o ponteiro estava não vale mais
    select(svg).interrupt().transition().duration(duracao).ease(suave).call(z.transform, t)
  }
  useEffect(() => {
    // redimensionar ou a primeira medida reenquadram na hora; trocar de Brasil/estado/município anima
    const mudouAlvo = alvoAnterior.current !== null && alvoAnterior.current !== chaveAlvo
    alvoAnterior.current = chaveAlvo
    const duracao = !mudouAlvo || reduzMovimento() ? 0 : formaMunSel ? 950 : 1150
    enquadrar(duracao)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- a câmera reage só ao alvo e ao tamanho; enquadrar lê o estado atual
  }, [chaveAlvo, vista])

  const pontoNoMapa = (e: MouseEvent): [number, number] | null => {
    const g = cameraRef.current, svg = svgRef.current
    const m = g?.getScreenCTM()
    if (!g || !svg || !m) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [pt.x, pt.y]
  }

  const moverHover = (e: PointerEvent<SVGGElement>) => {
    const alvo = (e.target as Element).closest('[data-codigo]') as SVGElement | null
    if (!alvo) return hover.set(null)
    const foco: Foco = { tipo: alvo.dataset.tipo as Foco['tipo'], codigo: Number(alvo.dataset.codigo), x: e.clientX, y: e.clientY }
    const atual = hover.get()
    if (!atual || atual.codigo !== foco.codigo || Math.abs(atual.x - foco.x) + Math.abs(atual.y - foco.y) > 2) hover.set(foco)
  }

  const clicar = (e: MouseEvent<SVGGElement>) => {
    const alvo = (e.target as Element).closest('[data-codigo]') as SVGElement | null
    if (!alvo) return
    const codigo = Number(alvo.dataset.codigo)
    if (alvo.dataset.tipo === 'uf') {
      const uf = ufPorCodigo.get(codigo)
      if (uf?.carregada && uf.sigla !== p.sigla) {
        origemClique = pontoNoMapa(e)
        p.aoEscolherUF(uf.sigla)
      }
    } else {
      p.aoEscolherMunicipio(codigo)
    }
  }

  const zoomPor = (fator: number) => {
    const z = zoomRef.current, svg = svgRef.current
    if (z && svg) select(svg).transition().duration(reduzMovimento() ? 0 : 320).call(z.scaleBy, fator)
  }

  const nomeAno = p.sigla ? `${ufSel?.nome ?? p.sigla}, por município` : 'Brasil, por estado'
  return (
    <div ref={caixaRef} className="relative h-full w-full touch-none select-none">
      <svg
        ref={svgRef}
        viewBox={`${vista.x} ${vista.y} ${vista.w} ${vista.h}`}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
        role="group"
        aria-label={`Mapa do viés político em ${p.ano}: ${nomeAno}`}
      >
        <defs>
          <pattern id="hachura" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="#eceef0" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="#c9ced3" strokeWidth="1.6" />
          </pattern>
        </defs>
        <g ref={cameraRef} onPointerMove={moverHover} onPointerLeave={() => hover.set(null)} onClick={clicar}>
          <CamadaUFs formas={formasUF} ufPorCodigo={ufPorCodigo} ano={p.ano} sigla={p.sigla} vazarAtiva={municipiosProntos} aoEscolher={p.aoEscolherUF} />
          {municipiosProntos && (
            <CamadaMunicipios
              key={p.sigla}
              formas={formasMun}
              munPorIbge={munPorIbge}
              ano={p.ano}
              relativo={p.relativo}
              vUF={vUF}
              foco={!!p.ibge}
              caixaUF={formaUFSel?.caixa}
            />
          )}
          {formaUFSel && (
            <path d={formaUFSel.d} fill="none" stroke="var(--color-tinta)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          )}
          {formaMunSel && (
            <path
              d={formaMunSel.d}
              fill={corVies(valorMunicipio(munPorIbge.get(formaMunSel.codigo), p.ano, p.relativo, vUF), p.relativo ? SATURA_RELATIVO : undefined)}
              stroke="var(--color-tinta)"
              strokeWidth={2.6}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              className="mapa-forma"
            />
          )}
          <ContornoHover formasUF={formasUF} formasMun={formasMun} />
        </g>
      </svg>

      <Dica ufPorCodigo={ufPorCodigo} munPorIbge={munPorIbge} ano={p.ano} relativo={p.relativo} vUF={vUF} />

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-full border border-linha bg-folha/95 shadow-[var(--shadow-cartao)]">
        <button type="button" onClick={() => zoomPor(1.6)} className="grid size-10 place-items-center text-tinta-2 hover:bg-papel hover:text-tinta" aria-label="Aproximar">
          <Plus size={18} weight="bold" />
        </button>
        <button type="button" onClick={() => zoomPor(1 / 1.6)} className="grid size-10 place-items-center border-y border-linha text-tinta-2 hover:bg-papel hover:text-tinta" aria-label="Afastar">
          <Minus size={18} weight="bold" />
        </button>
        <button type="button" onClick={() => enquadrar(reduzMovimento() ? 0 : 700)} className="grid size-10 place-items-center text-tinta-2 hover:bg-papel hover:text-tinta" aria-label="Enquadrar de novo">
          <ArrowsIn size={18} weight="bold" />
        </button>
      </div>
    </div>
  )
}

const CamadaUFs = memo(function CamadaUFs({
  formas,
  ufPorCodigo,
  ano,
  sigla,
  vazarAtiva,
  aoEscolher,
}: {
  formas: Forma[]
  ufPorCodigo: Map<number, UF>
  ano: Ano
  sigla?: string
  vazarAtiva: boolean // com os municípios na tela, o estado ativo fica sem cor por baixo deles
  aoEscolher: (sigla: string) => void
}) {
  return (
    <g>
      {formas.map((f) => {
        const uf = ufPorCodigo.get(f.codigo)
        const v = uf?.vies[ano]
        const ativa = uf?.sigla === sigla
        const outra = !!sigla && !ativa
        return (
          <path
            key={f.codigo}
            d={f.d}
            data-codigo={f.codigo}
            data-tipo="uf"
            className="mapa-forma outline-none"
            fill={ativa && vazarAtiva ? 'var(--color-papel)' : uf?.carregada ? corVies(v) : 'url(#hachura)'}
            opacity={outra ? 0.32 : 1}
            stroke="#fcfdfd"
            strokeWidth={1.1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            tabIndex={uf?.carregada && !ativa ? 0 : undefined}
            role={uf?.carregada ? 'link' : undefined}
            aria-label={uf ? `${uf.nome}: ${uf.carregada ? `viés ${v?.toFixed(1) ?? 'sem dado'} em ${ano}` : 'sem dados carregados'}` : undefined}
            style={{ cursor: uf?.carregada ? 'pointer' : 'not-allowed' }}
            onFocus={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              hover.set({ tipo: 'uf', codigo: f.codigo, x: r.left + r.width / 2, y: r.top + r.height / 2 })
            }}
            onBlur={() => hover.set(null)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && uf?.carregada) {
                e.preventDefault()
                origemClique = f.centro
                aoEscolher(uf.sigla)
              }
            }}
          />
        )
      })}
    </g>
  )
})

const CamadaMunicipios = memo(function CamadaMunicipios({
  formas,
  munPorIbge,
  ano,
  relativo,
  vUF,
  foco,
  caixaUF,
}: {
  formas: Forma[]
  munPorIbge: Map<number, MunicipioResumo>
  ano: Ano
  relativo: boolean
  vUF?: number
  foco: boolean
  caixaUF?: Caixa
}) {
  // atraso de cada município proporcional à distância do clique: a onda que sai do gesto
  const atrasos = useMemo(() => {
    const [[x0, y0], [x1, y1]] = caixaUF ?? [[0, 0], [1, 1]]
    const origem = origemClique ?? [(x0 + x1) / 2, (y0 + y1) / 2]
    const diag = Math.hypot(x1 - x0, y1 - y0) || 1
    return new Map(formas.map((f) => [f.codigo, Math.round((Math.hypot(f.centro[0] - origem[0], f.centro[1] - origem[1]) / diag) * 520)]))
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- a onda é calculada uma vez, na entrada do estado
  }, [formas])
  return (
    <g style={{ opacity: foco ? 0.42 : 1, transition: 'opacity 500ms var(--ease-saida)' }}>
      {formas.map((f) => (
        <path
          key={f.codigo}
          d={f.d}
          data-codigo={f.codigo}
          data-tipo="municipio"
          className="mapa-forma municipio-surge cursor-pointer"
          style={{ animationDelay: `${180 + (atrasos.get(f.codigo) ?? 0)}ms` }}
          fill={corVies(valorMunicipio(munPorIbge.get(f.codigo), ano, relativo, vUF), relativo ? SATURA_RELATIVO : undefined)}
          stroke="#fcfdfd"
          strokeWidth={0.55}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
})

function ContornoHover({ formasUF, formasMun }: { formasUF: Forma[]; formasMun: Forma[] }) {
  const foco = useLojaHover()
  if (!foco) return null
  const lista = foco.tipo === 'uf' ? formasUF : formasMun
  const f = lista.find((x) => x.codigo === foco.codigo)
  if (!f) return null
  return <path d={f.d} fill="none" stroke="var(--color-tinta)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
}

const useLojaHover = () => useLoja(hover)
