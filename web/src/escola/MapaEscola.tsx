// O mapa da escolaridade: cada município pintado na escala da bandeira pela parte, de cada 100, com
// superior completo entre os eleitos do município (2024) ou entre os votos que ele deu para deputado
// (2022). Estados sem dados ficam hachurados, como no mapa do viés. Clicar abre o boletim do município.
import { useQueries, useQuery } from '@tanstack/react-query'
import { geoConicEqualArea, geoPath } from 'd3-geo'
import { memo, useMemo, useState } from 'react'
import { consultas, type Malha, type MunicipioEscola } from '../api'
import { pct } from '../lib/formato'
import { cor, corDe100, useLargura } from './escolaridade'

interface Forma { ibge: number; d: string }

const Municipios = memo(function Municipios({ formas, valor }: { formas: Forma[]; valor: Map<number, number | null> }) {
  return (
    <g>
      {formas.map((f) => {
        const c = corDe100(valor.get(f.ibge))
        return <path key={f.ibge} data-ibge={f.ibge} d={f.d} fill={c ?? 'url(#hachura-escola)'} stroke="var(--color-folha)" strokeWidth={0.35} />
      })}
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
  // `combine` devolve a mesma lista enquanto as malhas não mudam: o desenho não é refeito a cada render
  const malhas = useQueries({ queries: ufs.map((s) => consultas.malhaUF(s)), combine: (rs) => rs.map((r) => r.data) })
  const { data: brasil } = useQuery(consultas.malhaBrasil())
  const [hover, setHover] = useState<number | null>(null)
  const prontas = malhas.every(Boolean)
  const W = Math.max(largura, 280)

  const desenho = useMemo(() => {
    if (!prontas || !largura) return null
    const feicoes = (malhas as Malha[]).flatMap((m) => m.features)
    const colecao = { type: 'FeatureCollection', features: feicoes } as Malha
    // cabe na largura; a altura é a do desenho (limitada a 1,1 da largura para estados compridos)
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
    const formas: Forma[] = feicoes.map((f) => ({ ibge: f.properties.codarea, d: caminho(f) ?? '' }))
    const estados = ufs.length > 1 && brasil ? brasil.features.map((f) => ({ cd: f.properties.codarea, d: caminho(f) ?? '' })) : []
    return { formas, estados, H, porIbge: new Map(formas.map((f) => [f.ibge, f.d])) }
  }, [prontas, largura, W, ufs.length, malhas, brasil])
  const H = desenho?.H ?? Math.round(W * 0.9)

  const valor = useMemo(() => new Map(municipios.map((m) => [m.ibge, m[medida]])), [municipios, medida])
  const porIbge = useMemo(() => new Map(municipios.map((m) => [m.ibge, m])), [municipios])
  const h = hover != null ? porIbge.get(hover) : null

  return (
    <div>
      <div ref={ref} className="relative" style={{ height: H }}>
        {!desenho ? (
          <div className="grid h-full place-items-center text-[0.86rem] text-tinta-3">Desenhando o mapa...</div>
        ) : (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`Mapa: de cada 100 ${medida === 'eleitos' ? 'eleitos' : 'votos para deputado'} em cada município, quantos com superior completo`}
            onPointerMove={(e) => {
              const i = Number((e.target as SVGElement).getAttribute?.('data-ibge'))
              setHover(Number.isFinite(i) && i > 0 ? i : null)
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const i = Number((e.target as SVGElement).getAttribute?.('data-ibge'))
              if (i > 0 && porIbge.has(i)) aoEscolher(i)
            }}
            className="cursor-pointer"
          >
            <defs>
              <pattern id="hachura-escola" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="#eceef0" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="#c9ced3" strokeWidth="1.6" />
              </pattern>
            </defs>
            {desenho.estados.map((e) => (
              // ao fundo, o Brasil hachurado: os estados carregados ficam cobertos pelos seus municípios
              <path key={e.cd} d={e.d} fill="url(#hachura-escola)" stroke="var(--color-folha)" strokeWidth={1} pointerEvents="none" />
            ))}
            <Municipios formas={desenho.formas} valor={valor} />
            {hover != null && desenho.porIbge.get(hover) && (
              <path d={desenho.porIbge.get(hover)} fill="none" stroke="var(--color-tinta)" strokeWidth={1.5} pointerEvents="none" />
            )}
            {desenho.porIbge.get(selecionado) && (
              <path d={desenho.porIbge.get(selecionado)} fill="none" stroke="var(--color-marcador)" strokeWidth={2.6} pointerEvents="none" />
            )}
          </svg>
        )}
        {h && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-xl border border-linha bg-folha px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
            <p className="font-bold text-tinta">{h.nome} <span className="font-normal text-tinta-3">({h.uf})</span></p>
            <p className="tabular text-tinta-2">
              {medida === 'eleitos' ? 'eleitos' : 'votos para deputado'} com superior: <b className="text-tinta">{pct(h[medida], 0)}</b>
            </p>
            <p className="tabular text-tinta-3">quem votou com superior: {pct(h.votantes, 0)}</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.76rem] text-tinta-3">
        <span>0%</span>
        {Array.from({ length: 8 }, (_, i) => <span key={i} className="h-3 w-6 rounded-[2px]" style={{ background: cor(i + 1) }} aria-hidden />)}
        <span>100% {medida === 'eleitos' ? 'dos eleitos' : 'dos votos para deputado'} com superior completo</span>
        <span className="ml-2 flex items-center gap-1.5"><span className="size-3 rounded-[2px] border-2 border-marcador" aria-hidden />no boletim</span>
      </div>
    </div>
  )
}
