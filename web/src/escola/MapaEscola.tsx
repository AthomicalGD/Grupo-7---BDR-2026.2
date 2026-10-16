// O mapa da escolaridade, como o atlas: abre no Brasil com cada estado carregado pintado pela sua média
// (os municípios pesados pelo comparecimento, ou pelos eleitos), e um clique no estado leva a câmera até
// ele e abre os seus municípios; os outros estados esmaecem. A cor é a escala da bandeira em 8 níveis,
// pela parte com superior completo entre os políticos (eleitos em 2024, votos para deputado em 2022) ou
// entre os eleitores (quem votou; aqui a régua vai até 25%, porque ninguém passa muito disso).
// "Em pé" levanta o mesmo recorte em 3D. Estados sem dados ficam hachurados. Clicar num município abre o boletim.
import { ArrowLeft, Cube, Square } from '@phosphor-icons/react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { geoConicEqualArea, geoPath } from 'd3-geo'
import { interpolateZoom, type ZoomView } from 'd3-interpolate'
import { lazy, memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { consultas, type Malha, type MunicipioEscola } from '../api'
import { Alternador } from '../atlas/PainelEstado'
import { Ciranda } from '../componentes/Ciranda'
import { pct } from '../lib/formato'
import { cor, useLargura } from './escolaridade'

const RelevoEscola3D = lazy(() => import('./RelevoEscola3D'))

export type Quem = 'politicos' | 'eleitores'
const TETO: Record<Quem, number> = { politicos: 100, eleitores: 25 }
/** 8 níveis da escala da bandeira entre 0 e o teto da vista. */
const corDe = (v: number | null | undefined, quem: Quem) => (v == null ? null : cor(Math.min(8, Math.floor((8 * v) / TETO[quem]) + 1)))

interface Forma { ibge: number; uf: string; d: string }

const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

const Municipios = memo(function Municipios({ formas, valor, quem }: { formas: Forma[]; valor: Map<number, number | null>; quem: Quem }) {
  return (
    <g>
      {formas.map((f) => (
        <path key={f.ibge} data-ibge={f.ibge} d={f.d} fill={corDe(valor.get(f.ibge), quem) ?? 'url(#hachura-escola)'} stroke="var(--color-folha)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  )
})

export function MapaEscola({ municipios, ufs, medida, selecionado, aoEscolher }: {
  municipios: MunicipioEscola[]
  /** as UFs do recorte (uma, com filtro; as carregadas, sem) */
  ufs: string[]
  medida: 'eleitos' | 'votados'
  selecionado: number
  aoEscolher: (ibge: number) => void
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const malhas = useQueries({ queries: ufs.map((s) => consultas.malhaUF(s)), combine: (rs) => rs.map((r) => r.data) })
  const { data: brasil } = useQuery(consultas.malhaBrasil())
  const { data: listaUfs } = useQuery(consultas.ufs())
  const [hover, setHover] = useState<{ tipo: 'uf' | 'mun'; cod: number } | null>(null)
  const [quem, setQuem] = useState<Quem>('politicos')
  const [modo, setModo] = useState<'plano' | 'pe'>('plano')
  const sozinho = ufs.length === 1
  const [foco, setFoco] = useState<string | null>(sozinho ? ufs[0] : null)
  const prontas = malhas.every(Boolean)
  const W = Math.max(largura, 280)
  const porSigla = useMemo(() => new Map((listaUfs ?? []).map((u) => [u.sigla, u])), [listaUfs])
  const porCodigo = useMemo(() => new Map((listaUfs ?? []).map((u) => [u.cd_ibge, u])), [listaUfs])
  const campo = quem === 'eleitores' ? 'votantes' : medida
  const porIbge = useMemo(() => new Map(municipios.map((m) => [m.ibge, m])), [municipios])

  // com filtro de estado, o mapa é só ele; sem, volta ao Brasil
  useEffect(() => setFoco(sozinho ? ufs[0] : null), [sozinho, ufs])
  // o município escolhido pelo boletim (busca, ranking) leva a câmera ao estado dele, se ela já está num estado
  const ultimoSelecionado = useRef(selecionado)
  useEffect(() => {
    if (ultimoSelecionado.current === selecionado) return
    ultimoSelecionado.current = selecionado
    const m = porIbge.get(selecionado)
    if (m && foco && m.uf !== foco) setFoco(m.uf)
  }, [selecionado, porIbge, foco])

  const desenho = useMemo(() => {
    if (!prontas || !largura) return null
    const lista = malhas as Malha[]
    const feicoes = lista.flatMap((m) => m.features)
    const colecao = { type: 'FeatureCollection', features: feicoes } as Malha
    const proj = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).preclip((s) => s).precision(0).fitWidth(W - 16, colecao)
    let caminho = geoPath(proj).digits(1)
    let [[, y0], [, y1]] = caminho.bounds(colecao)
    if (y1 - y0 > W * 1.1) {
      proj.fitExtent([[8, 8], [W - 8, W * 1.1]], colecao)
      caminho = geoPath(proj).digits(1)
      ;[[, y0], [, y1]] = caminho.bounds(colecao)
    }
    proj.translate([proj.translate()[0] + 8, proj.translate()[1] - y0 + 8])
    caminho = geoPath(proj).digits(1)
    const H = Math.ceil(y1 - y0 + 16)
    const caixas = new Map(lista.map((m, i) => [ufs[i], caminho.bounds(m)]))
    const estados = brasil ? brasil.features.map((f) => ({ cd: f.properties.codarea, d: caminho(f) ?? '', centro: caminho.centroid(f) })) : []
    // os caminhos dos municípios só são montados para o estado aberto (a vista do Brasil não os usa)
    return { estados, caixas, H, caminho, malhaDe: new Map(lista.map((m, i) => [ufs[i], m])) }
  }, [prontas, largura, W, ufs, malhas, brasil])
  const H = desenho?.H ?? Math.round(W * 0.9)
  // a lista estável mantém o memo dos municípios: o hover não redesenha centenas de caminhos
  const formasFoco = useMemo<Forma[]>(() => {
    const m = foco ? desenho?.malhaDe.get(foco) : undefined
    return m && desenho ? m.features.map((f) => ({ ibge: f.properties.codarea, uf: foco!, d: desenho.caminho(f) ?? '' })) : []
  }, [desenho, foco])
  const caminhoDe = useMemo(() => new Map(formasFoco.map((f) => [f.ibge, f.d])), [formasFoco])

  const valor = useMemo(() => new Map(municipios.map((m) => [m.ibge, m[campo]])), [municipios, campo])
  // a média de cada estado: municípios pesados pelo comparecimento (ou pelos eleitos, para os eleitos)
  const mediaUF = useMemo(() => {
    const soma = new Map<string, [number, number]>()
    for (const m of municipios) {
      const v = m[campo]
      if (v == null) continue
      const peso = campo === 'eleitos' ? (m.eleitos_n ?? 0) : m.comparecimento
      const [a, b] = soma.get(m.uf) ?? [0, 0]
      soma.set(m.uf, [a + v * peso, b + peso])
    }
    return new Map([...soma].map(([uf, [a, b]]) => [uf, b ? a / b : null]))
  }, [municipios, campo])

  // a câmera: o voo suave do atlas (interpolateZoom, de van Wijk: afasta, desliza e aproxima), quadro a
  // quadro direto no grupo do SVG, sem render do React. O estado chega pintado pela média e os municípios
  // acendem quando a câmera pousa.
  const grupo = useRef<SVGGElement>(null)
  const municipiosRef = useRef<SVGGElement>(null)
  const vistaAtual = useRef<ZoomView | null>(null)
  const alvo = useMemo<ZoomView>(() => {
    const c = foco && desenho?.caixas.get(foco)
    if (!c) return [W / 2, H / 2, W]
    const [[x0, y0], [x1, y1]] = c
    return [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, ((y1 - y0) * W) / H) / 0.88]
  }, [foco, desenho, W, H])
  useLayoutEffect(() => {
    const g = grupo.current
    if (!g) return
    const pintar = ([cx, cy, w]: ZoomView) => {
      const k = W / w
      g.setAttribute('transform', `translate(${W / 2 - k * cx},${H / 2 - k * cy}) scale(${k})`)
    }
    const de = vistaAtual.current
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const acender = () => municipiosRef.current?.classList.add('acesos')
    if (!de || reduz) {
      vistaAtual.current = alvo
      pintar(alvo)
      acender()
      return
    }
    const voo = interpolateZoom(de, alvo)
    const duracao = Math.min(1500, Math.max(750, voo.duration * 0.75))
    municipiosRef.current?.classList.remove('acesos')
    const inicio = performance.now()
    let quadro = 0
    const passo = (agora: number) => {
      const x = Math.min(1, (agora - inicio) / duracao)
      const v = voo(suave(x))
      vistaAtual.current = v
      pintar(v)
      if (x < 1) quadro = requestAnimationFrame(passo)
      else acender()
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, W, H, desenho])

  const oQue = quem === 'eleitores' ? 'de quem votou' : medida === 'eleitos' ? 'dos eleitos' : 'dos votos para deputado'
  const hm = hover?.tipo === 'mun' ? porIbge.get(hover.cod) : null
  const hu = hover?.tipo === 'uf' ? porCodigo.get(hover.cod) : null
  const ufFoco = foco ? porSigla.get(foco) : null

  // o 3D: o estado em foco (municípios) ou o Brasil (os estados carregados)
  const malha3D = useMemo<Malha | null>(() => {
    if (foco) return (malhas as (Malha | undefined)[])[ufs.indexOf(foco)] ?? null
    if (!brasil) return null
    const cods = new Set(ufs.map((s) => porSigla.get(s)?.cd_ibge))
    return { ...brasil, features: brasil.features.filter((f) => cods.has(f.properties.codarea)) }
  }, [foco, malhas, ufs, brasil, porSigla])
  const valor3D = useMemo(
    () => (foco ? valor : new Map(ufs.map((s) => [porSigla.get(s)?.cd_ibge ?? 0, mediaUF.get(s) ?? null]))),
    [foco, valor, ufs, porSigla, mediaUF],
  )

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2">
          <span className="text-[0.82rem] text-tinta-3">Pintar por</span>
          <Alternador rotulo="Pintar o mapa por" valor={quem} aoMudar={setQuem} opcoes={[{ valor: 'politicos', rotulo: 'Políticos' }, { valor: 'eleitores', rotulo: 'Eleitores' }]} />
        </span>
        <Alternador
          rotulo="Mapa plano ou em pé"
          valor={modo}
          aoMudar={setModo}
          opcoes={[
            { valor: 'plano', rotulo: 'Plano', icone: <Square size={14} weight="bold" aria-hidden /> },
            { valor: 'pe', rotulo: 'Em pé', icone: <Cube size={14} weight="bold" aria-hidden /> },
          ]}
        />
      </div>
      <div className="mb-3 flex min-h-[2.75rem] flex-wrap items-center gap-x-3 gap-y-2">
        {foco && !sozinho ? (
          <button type="button" onClick={() => setFoco(null)} className="botao-contorno inline-flex h-[2.75rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[0.82rem] font-semibold">
            <ArrowLeft size={14} weight="bold" aria-hidden /> Todos os estados
          </button>
        ) : null}
        <p className="text-[0.86rem] text-tinta-2">
          {ufFoco ? (
            <><b className="text-tinta">{ufFoco.nome}</b>: {pct(mediaUF.get(ufFoco.sigla), 0)} {oQue} com superior completo</>
          ) : (
            'Clique num estado para ver os municípios.'
          )}
        </p>
      </div>
      <div ref={ref} className="relative mx-auto max-w-[calc((100dvh-190px)*1.05)]" style={{ height: H }}>
        {modo === 'pe' ? (
          malha3D ? (
            <Suspense fallback={<div className="grid h-full place-items-center"><Ciranda rotulo="Levantando o mapa..." /></div>}>
              <RelevoEscola3D
                malha={malha3D}
                valor={valor3D}
                cor={(v) => corDe(v, quem)}
                teto={TETO[quem]}
                selecionado={foco ? selecionado : null}
                legenda={`% ${oQue} com superior completo`}
                rotulo={(c) => {
                  const m = foco ? porIbge.get(c) : null
                  const u = foco ? null : porCodigo.get(c)
                  return (
                    <span className="block">
                      <b className="text-tinta">{m?.nome ?? u?.nome}</b>{' '}
                      <span className="tabular text-tinta-2">{pct(foco ? valor.get(c) : mediaUF.get(u?.sigla ?? ''), 0)}</span>
                    </span>
                  )
                }}
                aoEscolher={(c) => (foco ? porIbge.has(c) && aoEscolher(c) : setFoco(porCodigo.get(c)?.sigla ?? null))}
              />
            </Suspense>
          ) : (
            <div className="grid h-full place-items-center text-[0.86rem] text-tinta-3">Desenhando o mapa...</div>
          )
        ) : !desenho ? (
          <div className="grid h-full place-items-center text-[0.86rem] text-tinta-3">Desenhando o mapa...</div>
        ) : (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`Mapa: de cada 100 ${quem === 'eleitores' ? 'pessoas que votaram' : medida === 'eleitos' ? 'eleitos' : 'votos para deputado'} ${ufFoco ? `em cada município (${ufFoco.nome})` : 'em cada estado'}, quantos com superior completo`}
            onPointerMove={(e) => {
              const t = e.target as SVGElement
              const i = Number(t.getAttribute?.('data-ibge'))
              const u = Number(t.getAttribute?.('data-uf'))
              const novo = i > 0 ? { tipo: 'mun' as const, cod: i } : u > 0 ? { tipo: 'uf' as const, cod: u } : null
              // só re-renderiza ao trocar de forma, não a cada pixel do ponteiro
              setHover((h) => (h?.tipo === novo?.tipo && h?.cod === novo?.cod ? h : novo))
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const t = e.target as SVGElement
              const i = Number(t.getAttribute?.('data-ibge'))
              const u = Number(t.getAttribute?.('data-uf'))
              if (i > 0 && porIbge.has(i)) aoEscolher(i)
              else if (u > 0) setFoco(porCodigo.get(u)?.sigla ?? null)
            }}
            className="cursor-pointer overflow-hidden"
          >
            <defs>
              <pattern id="hachura-escola" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="#eceef0" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="#d5d9de" strokeWidth="1.4" />
              </pattern>
            </defs>
            <g ref={grupo}>
              {desenho.estados.map((e) => {
                const u = porCodigo.get(e.cd)
                const carregado = !!u && ufs.includes(u.sigla)
                const emFoco = u?.sigla === foco
                const c = carregado ? corDe(mediaUF.get(u!.sigla), quem) : null
                return (
                  <path
                    key={e.cd}
                    d={e.d}
                    data-uf={carregado ? e.cd : undefined}
                    fill={c ?? 'url(#hachura-escola)'}
                    stroke="var(--color-folha)"
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                    className="estado-forma"
                    opacity={foco && !emFoco ? (carregado ? 0.3 : 0.5) : 1}
                    pointerEvents={carregado ? undefined : 'none'}
                  />
                )
              })}
              <g ref={municipiosRef} className="municipios-escola">
                {foco && <Municipios key={foco} formas={formasFoco} valor={valor} quem={quem} />}
              </g>
              {hm && caminhoDe.get(hm.ibge) && (
                <path d={caminhoDe.get(hm.ibge)} fill="none" stroke="var(--color-tinta)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
              {foco && caminhoDe.get(selecionado) && (
                <path d={caminhoDe.get(selecionado)} fill="none" stroke="var(--color-marcador)" strokeWidth={2.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
            </g>
            {/* sigla e média de cada estado, só na vista do Brasil */}
            {desenho.estados.map((e) => {
                const u = porCodigo.get(e.cd)
                if (!u || !ufs.includes(u.sigla) || !Number.isFinite(e.centro[0])) return null
                return (
                  <text key={e.cd} x={e.centro[0]} y={e.centro[1]} textAnchor="middle" pointerEvents="none" opacity={foco ? 0 : 1} className="estado-rotulo t-numero" style={{ paintOrder: 'stroke', stroke: 'rgb(252 253 253 / .85)', strokeWidth: 3, transitionDuration: foco ? '200ms' : '600ms', transitionDelay: foco ? '0ms' : '500ms' }}>
                    <tspan x={e.centro[0]} fontSize={13} fontWeight={700} fill="var(--color-tinta)">{u.sigla}</tspan>
                    <tspan x={e.centro[0]} dy={15} fontSize={12} fill="var(--color-tinta-2)">{pct(mediaUF.get(u.sigla), 0)}</tspan>
                  </text>
                )
              })}
          </svg>
        )}
        {modo === 'plano' && (hm || hu) && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-xl border border-linha bg-folha px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
            {hm ? (
              <>
                <p className="font-bold text-tinta">{hm.nome} <span className="font-normal text-tinta-3">({hm.uf})</span></p>
                <p className="tabular text-tinta-2">{medida === 'eleitos' ? 'eleitos' : 'votos para deputado'} com superior: <b className="text-tinta">{pct(hm[medida], 0)}</b></p>
                <p className="tabular text-tinta-3">quem votou com superior: {pct(hm.votantes, 0)}</p>
              </>
            ) : (
              <>
                <p className="font-bold text-tinta">{hu!.nome}</p>
                <p className="tabular text-tinta-2">{oQue} com superior: <b className="text-tinta">{pct(mediaUF.get(hu!.sigla), 0)}</b></p>
                <p className="text-tinta-3">clique para ver os municípios</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.76rem] text-tinta-3">
        <span>0%</span>
        {Array.from({ length: 8 }, (_, i) => <span key={i} className="h-3 w-6 rounded-[2px]" style={{ background: cor(i + 1) }} aria-hidden />)}
        <span>{TETO[quem]}%{quem === 'eleitores' ? ' ou mais' : ''} {oQue} com superior completo</span>
        <span className="ml-2 flex items-center gap-1.5"><span className="size-3 rounded-[2px] border-2 border-marcador" aria-hidden />no boletim</span>
      </div>
    </div>
  )
}
