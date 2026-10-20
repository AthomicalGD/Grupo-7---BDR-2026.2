// Uma projeção só para o atlas inteiro: Brasil, UFs e municípios ficam no mesmo espaço de
// coordenadas, então aproximar de um estado ou município é só mudar a câmera (zoom/pan).
import { geoConicEqualArea, geoPath, type GeoPath, type GeoProjection } from 'd3-geo'
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

// as formas de cada malha ficam guardadas: projetar os ~850 municípios de MG leva ~200 ms, então a conta
// é adiantada (formasCedo) quando o ponteiro para sobre o estado, em fatias no ócio do navegador, e o
// clique já as encontra prontas (ou termina só o que falta)
interface Guardada {
  projecao: GeoProjection
  formas: Forma[]
  caminho: GeoPath
}
const guardadas = new WeakMap<Malha, Guardada>()

function forma(caminho: GeoPath, f: Malha['features'][number]): Forma {
  return {
    codigo: f.properties.codarea,
    d: caminho(f) ?? '',
    caixa: caminho.bounds(f) as Caixa,
    centro: caminho.centroid(f) as [number, number],
  }
}

function guardada(malha: Malha, projecao: GeoProjection): Guardada {
  let g = guardadas.get(malha)
  if (g?.projecao !== projecao) {
    g = { projecao, formas: [], caminho: geoPath(projecao).digits(3) }
    guardadas.set(malha, g)
  }
  return g
}

/** formas(malha, projecao, 3) de uma malha de municípios, feita uma vez por malha e projeção. */
export function formasGuardadas(malha: Malha, projecao: GeoProjection): Forma[] {
  const g = guardada(malha, projecao)
  const fs = malha.features
  while (g.formas.length < fs.length) g.formas.push(forma(g.caminho, fs[g.formas.length]))
  return g.formas
}

/** Adianta formasGuardadas em fatias de poucos milissegundos, sem segurar a tela. */
export function formasCedo(malha: Malha, projecao: GeoProjection) {
  const g = guardada(malha, projecao)
  const fs = malha.features
  const ocioso = window.requestIdleCallback ?? ((f: IdleRequestCallback) => setTimeout(() => f({ didTimeout: true, timeRemaining: () => 8 }), 16))
  const fatia: IdleRequestCallback = (prazo) => {
    const ate = performance.now() + Math.max(4, Math.min(prazo.timeRemaining(), 12))
    while (g.formas.length < fs.length && performance.now() < ate) g.formas.push(forma(g.caminho, fs[g.formas.length]))
    if (g.formas.length < fs.length && guardadas.get(malha) === g) ocioso(fatia, { timeout: 120 })
  }
  if (g.formas.length < fs.length) ocioso(fatia, { timeout: 120 })
}

/** Silhueta de uma feição ajustada a um quadrado (lista de estados). */
export function silhueta(malha: Malha, codigo: number, lado = 40): string {
  const f = malha.features.find((x) => x.properties.codarea === codigo)
  if (!f) return ''
  const p = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).preclip((s) => s).precision(0).fitSize([lado, lado], f)
  return geoPath(p).digits(1)(f) ?? ''
}
