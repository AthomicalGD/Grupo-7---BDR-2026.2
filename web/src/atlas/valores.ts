import type { Ano, MunicipioResumo } from '../api'

/** No modo relativo a cor mostra a distância para o estado, que raramente passa de ±20. */
export const SATURA_RELATIVO = 20

/**
 * No Brasil inteiro a cor dos estados satura em ±40, não em ±75: as médias estaduais ficam entre −5 e +40 e, na
 * escala dos municípios, o mapa saía todo do mesmo azul claro. A legenda acompanha (−40 / +40).
 */
export const SATURA_UF = 40

/** Valor que pinta o município: absoluto, ou a diferença para o estado no modo relativo. */
export function valorMunicipio(m: MunicipioResumo | undefined, ano: Ano, relativo: boolean, vUF?: number) {
  const v = m?.vies[ano]
  if (v == null) return undefined
  return relativo ? (vUF == null ? undefined : v - vUF) : v
}
