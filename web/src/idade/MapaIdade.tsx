// O mapa sépia da P6, como o da Escola: abre no Brasil com cada estado pintado pela idade média de quem votou
// (municípios pesados pelo comparecimento), e um clique no estado leva a câmera até ele (voo de van Wijk) e
// acende os seus municípios. A cor é a escala sépia em seis classes fixas (as mesmas nos quatro anos, então o
// envelhecimento aparece como escurecimento). "Pintar por" troca quem votou pela população do Censo 2022.
// Estados e municípios sem dado ficam hachurados. Clicar num município o escolhe para a galeria e o boletim.
import { ArrowLeft } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { geoConicEqualArea, geoPath } from 'd3-geo'
import { interpolateZoom, type ZoomView } from 'd3-interpolate'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { consultas, type Malha, type MunicipioIdade } from '../api'
import { Alternador } from '../atlas/PainelEstado'
import { useLargura } from '../escola/escolaridade'
import { anos, corIdade, NOME_TERCO, ROTULO_CLASSE, SEPIA } from './sepia'

export type Medida = 'idade' | 'idade_pop'

interface Forma { ibge: number; d: string }

const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

const Municipios = memo(function Municipios({ formas, valor }: { formas: Forma[]; valor: Map<number, number | null> }) {
  return (
    <g>
      {formas.map((f) => (
        <path key={f.ibge} data-ibge={f.ibge} d={f.d} fill={corIdade(valor.get(f.ibge)) ?? 'url(#hachura-idade)'} stroke="var(--color-folha)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  )
})

export function MapaIdade({ municipios, ufs, ano, selecionado, aoEscolher }: {
  municipios: MunicipioIdade[]
  /** as UFs do recorte (uma, com filtro; as carregadas, sem) */
  ufs: string[]
  ano: number
  selecionado: number
  aoEscolher: (ibge: number) => void
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const { data: brasil } = useQuery(consultas.malhaBrasil())
  const { data: listaUfs } = useQuery(consultas.ufs())
  const [hover, setHover] = useState<{ tipo: 'uf' | 'mun'; cod: number } | null>(null)
  const [medida, setMedida] = useState<Medida>('idade')
  const sozinho = ufs.length === 1
  const [foco, setFoco] = useState<string | null>(sozinho ? ufs[0] : null)
  const { data: malhaFoco } = useQuery({ ...consultas.malhaUF(foco ?? ''), enabled: !!foco })
  const W = Math.max(largura, 280)
  const porSigla = useMemo(() => new Map((listaUfs ?? []).map((u) => [u.sigla, u])), [listaUfs])
  const porCodigo = useMemo(() => new Map((listaUfs ?? []).map((u) => [u.cd_ibge, u])), [listaUfs])
  const porIbge = useMemo(() => new Map(municipios.map((m) => [m.ibge, m])), [municipios])
  const prontas = !!brasil && !!listaUfs

  useEffect(() => setFoco(sozinho ? ufs[0] : null), [sozinho, ufs])
  // o município escolhido fora do mapa (busca, galeria) leva a câmera ao estado dele, se ela já está num estado
  const ultimoSelecionado = useRef(selecionado)
  useEffect(() => {
    if (ultimoSelecionado.current === selecionado) return
    ultimoSelecionado.current = selecionado
    const m = porIbge.get(selecionado)
    if (m && foco && m.uf !== foco) setFoco(m.uf)
  }, [selecionado, porIbge, foco])

  const desenho = useMemo(() => {
    if (!prontas || !largura || !brasil) return null
    const codigo = new Map(ufs.map((s) => [s, porSigla.get(s)?.cd_ibge]))
    const doRecorte = brasil.features.filter((f) => ufs.some((s) => codigo.get(s) === f.properties.codarea))
    const colecao = { ...brasil, features: doRecorte } as Malha
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
    const caixas = new Map(
      ufs.flatMap((s) => {
        const f = doRecorte.find((x) => x.properties.codarea === codigo.get(s))
        return f ? [[s, caminho.bounds(f)] as const] : []
      }),
    )
    const estados = brasil.features.map((f) => ({ cd: f.properties.codarea, d: caminho(f) ?? '', centro: caminho.centroid(f) }))
    return { estados, caixas, H, caminho }
  }, [prontas, largura, W, ufs, brasil, porSigla])
  const H = desenho?.H ?? Math.round(W * 0.9)
  const formasFoco = useMemo<Forma[]>(() => {
    const m = foco ? malhaFoco : undefined
    return m && desenho ? m.features.map((f) => ({ ibge: f.properties.codarea, d: desenho.caminho(f) ?? '' })) : []
  }, [desenho, foco, malhaFoco])
  const caminhoDe = useMemo(() => new Map(formasFoco.map((f) => [f.ibge, f.d])), [formasFoco])

  const valor = useMemo(() => new Map(municipios.map((m) => [m.ibge, m[medida]])), [municipios, medida])
  // a média de cada estado: municípios pesados pelo comparecimento
  const mediaUF = useMemo(() => {
    const soma = new Map<string, [number, number]>()
    for (const m of municipios) {
      const v = m[medida]
      if (v == null) continue
      const [a, b] = soma.get(m.uf) ?? [0, 0]
      soma.set(m.uf, [a + v * m.comparecimento, b + m.comparecimento])
    }
    return new Map([...soma].map(([uf, [a, b]]) => [uf, b ? a / b : null]))
  }, [municipios, medida])

  // a câmera: o voo suave do atlas, quadro a quadro direto no grupo do SVG, sem render do React
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

  const oQue = medida === 'idade' ? `de quem votou em ${ano}` : 'da população (Censo 2022)'
  const hm = hover?.tipo === 'mun' ? porIbge.get(hover.cod) : null
  const hu = hover?.tipo === 'uf' ? porCodigo.get(hover.cod) : null
  const ufFoco = foco ? porSigla.get(foco) : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2">
          <span className="text-[0.82rem] text-tinta-3">Pintar por</span>
          <Alternador
            rotulo="Pintar o mapa por"
            valor={medida}
            aoMudar={setMedida}
            opcoes={[{ valor: 'idade', rotulo: 'Quem votou' }, { valor: 'idade_pop', rotulo: 'População (Censo 2022)' }]}
          />
        </span>
      </div>
      <div className="mb-3 flex min-h-[2.75rem] flex-wrap items-center gap-x-3 gap-y-2">
        {foco && !sozinho ? (
          <button type="button" onClick={() => setFoco(null)} className="botao-contorno inline-flex h-[2.75rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[0.82rem] font-semibold">
            <ArrowLeft size={14} weight="bold" aria-hidden /> Todos os estados
          </button>
        ) : null}
        <p className="text-[0.86rem] text-tinta-2">
          {ufFoco ? (
            <><b className="text-tinta">{ufFoco.nome}</b>: idade média {oQue}, <b className="tabular text-tinta">{anos(mediaUF.get(ufFoco.sigla))} anos</b></>
          ) : (
            'Clique num estado para ver os municípios.'
          )}
        </p>
      </div>
      <div ref={ref} className="relative mx-auto max-w-[calc((100dvh-190px)*1.05)]" style={{ height: H }}>
        {!desenho ? (
          <div className="grid h-full place-items-center text-[0.86rem] text-tinta-3">Desenhando o mapa...</div>
        ) : (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`Mapa: idade média ${oQue} ${ufFoco ? `em cada município (${ufFoco.nome})` : 'em cada estado'}, do papel claro (mais jovem) ao sépia (mais velho)`}
            onPointerMove={(e) => {
              const t = e.target as SVGElement
              const i = Number(t.getAttribute?.('data-ibge'))
              const u = Number(t.getAttribute?.('data-uf'))
              const novo = i > 0 ? { tipo: 'mun' as const, cod: i } : u > 0 ? { tipo: 'uf' as const, cod: u } : null
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
              <pattern id="hachura-idade" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="#eceef0" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="#d5d9de" strokeWidth="1.4" />
              </pattern>
            </defs>
            <g ref={grupo}>
              {desenho.estados.map((e) => {
                const u = porCodigo.get(e.cd)
                const carregado = !!u && ufs.includes(u.sigla)
                const emFoco = u?.sigla === foco
                const c = carregado ? corIdade(mediaUF.get(u!.sigla)) : null
                return (
                  <path
                    key={e.cd}
                    d={e.d}
                    data-uf={carregado ? e.cd : undefined}
                    fill={c ?? 'url(#hachura-idade)'}
                    stroke="var(--color-folha)"
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                    className="estado-forma"
                    opacity={foco && !emFoco ? (carregado ? 0.3 : 0.5) : 1}
                    pointerEvents={carregado ? undefined : 'none'}
                  />
                )
              })}
              <g ref={municipiosRef} className="municipios-idade">
                {foco && <Municipios key={foco} formas={formasFoco} valor={valor} />}
              </g>
              {hm && caminhoDe.get(hm.ibge) && (
                <path d={caminhoDe.get(hm.ibge)} fill="none" stroke="var(--color-tinta)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
              {foco && caminhoDe.get(selecionado) && (
                <path d={caminhoDe.get(selecionado)} fill="none" stroke="var(--color-marcador)" strokeWidth={2.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
            </g>
            {desenho.estados.map((e) => {
              const u = porCodigo.get(e.cd)
              if (!u || !ufs.includes(u.sigla) || !Number.isFinite(e.centro[0])) return null
              return (
                <text key={e.cd} x={e.centro[0]} y={e.centro[1]} textAnchor="middle" pointerEvents="none" opacity={foco ? 0 : 1} className="estado-rotulo t-numero" style={{ paintOrder: 'stroke', stroke: 'rgb(252 253 253 / .85)', strokeWidth: 3, transitionDuration: foco ? '200ms' : '600ms', transitionDelay: foco ? '0ms' : '500ms' }}>
                  <tspan x={e.centro[0]} fontSize={13} fontWeight={700} fill="var(--color-tinta)">{u.sigla}</tspan>
                  <tspan x={e.centro[0]} dy={15} fontSize={12} fill="var(--color-tinta-2)">{anos(mediaUF.get(u.sigla))}</tspan>
                </text>
              )
            })}
          </svg>
        )}
        {(hm || hu) && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-xl border border-linha bg-folha px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
            {hm ? (
              <>
                <p className="font-bold text-tinta">{hm.nome} <span className="font-normal text-tinta-3">({hm.uf})</span></p>
                <p className="tabular text-tinta-2">quem votou em {ano}: <b className="text-tinta">{anos(hm.idade)} anos</b> · terço {NOME_TERCO[hm.terco]}</p>
                <p className="tabular text-tinta-3">população (Censo 2022): {anos(hm.idade_pop)} anos</p>
              </>
            ) : (
              <>
                <p className="font-bold text-tinta">{hu!.nome}</p>
                <p className="tabular text-tinta-2">idade média {oQue}: <b className="text-tinta">{anos(mediaUF.get(hu!.sigla))} anos</b></p>
                <p className="text-tinta-3">clique para ver os municípios</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.76rem] text-tinta-3">
        <span className="mr-1">idade média, em anos:</span>
        {SEPIA.map((c, i) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className="h-3 w-6 rounded-[2px]" style={{ background: c, boxShadow: i === 0 ? 'inset 0 0 0 1px rgb(24 32 43 / .2)' : undefined }} aria-hidden />
            <span className="tabular mr-1.5">{ROTULO_CLASSE[i]}</span>
          </span>
        ))}
        <span className="ml-1 flex items-center gap-1.5"><span className="size-3 rounded-[2px] border-2 border-marcador" aria-hidden />escolhido</span>
      </div>
    </div>
  )
}
