// Uma projeção só para o atlas inteiro: Brasil, UFs e municípios ficam no mesmo espaço de
// coordenadas, então aproximar de um estado ou município é só mudar a câmera (zoom/pan).
import { geoConicEqualArea, geoPath, type GeoProjection } from 'd3-geo'
import type { Malha } from '../api'

export const LADO = 1000
export type Caixa = [[number, number], [number, number]]

export interface Forma {
  codigo: number
  d: string
  caixa: Caixa
  centro: [number, number]
}

/** Cônica de áreas iguais centrada no Brasil (paralelos padrão -2° e -22°).
 *  Sem recorte no antimeridiano (o Brasil não o cruza) e sem reamostragem adaptativa (a malha já é
 *  densa): as duas contas eram a maior parte do tempo de abrir um estado grande. */
export function projecaoBrasil(malha: Malha): GeoProjection {
  return geoConicEqualArea()
    .parallels([-2, -22])
    .rotate([54, 0])
    .preclip((s) => s)
    .precision(0)
    .fitExtent([[24, 24], [LADO - 24, LADO - 24]], malha)
}

/** Caminho SVG, caixa e centróide de cada feição; `casas` limita o texto do SVG. */
export function formas(malha: Malha, projecao: GeoProjection, casas = 3): Forma[] {
  const caminho = geoPath(projecao).digits(casas)
  return malha.features.map((f) => ({
    codigo: f.properties.codarea,
    d: caminho(f) ?? '',
    caixa: caminho.bounds(f) as Caixa,
    centro: caminho.centroid(f) as [number, number],
  }))
}

/** Silhueta de uma feição ajustada a um quadrado (lista de estados). */
export function silhueta(malha: Malha, codigo: number, lado = 40): string {
  const f = malha.features.find((x) => x.properties.codarea === codigo)
  if (!f) return ''
  const p = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).preclip((s) => s).precision(0).fitSize([lado, lado], f)
  return geoPath(p).digits(1)(f) ?? ''
}
