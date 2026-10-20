// Paleta da interface simples: petróleo e âmbar no papel, carmim ↔ azul no viés.
// As escalas são calculadas em OKLCH como as da completa (lib/vies.ts), com as matizes desta interface.
import { oklchParaHex, SATURA } from '../lib/vies'

const ESQ = [0.47, 0.165, 22] as const // carmim
const MEIO = [0.93, 0.006, 200] as const // cinza esverdeado, sem matiz forte
const DIR = [0.44, 0.13, 262] as const // azul

const cache = new Map<number, string>()

/** Cor do viés, de −SATURA (carmim) a +SATURA (azul), simétrica em 0; sem dado, o papel. */
export function corVies(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'var(--color-papel-2)'
  const r = Math.round(v * 2) / 2
  let cor = cache.get(r)
  if (!cor) {
    const t = Math.min(1, Math.abs(r) / SATURA) ** 0.85
    const alvo = r < 0 ? ESQ : DIR
    cor = oklchParaHex(MEIO[0] + (alvo[0] - MEIO[0]) * t, MEIO[1] + (alvo[1] - MEIO[1]) * (1 - (1 - t) ** 2.2), alvo[2])
    cache.set(r, cor)
  }
  return cor
}

/** Sequencial de t ∈ [0, 1]: claro e quente embaixo, petróleo fechado em cima (a luminosidade sempre cai). */
function sequencial(t: number, de: readonly [number, number, number], ate: readonly [number, number, number]) {
  return oklchParaHex(de[0] + (ate[0] - de[0]) * t, de[1] + (ate[1] - de[1]) * Math.sin(t * Math.PI * 0.75), de[2] + (ate[2] - de[2]) * t)
}

/** Os 8 graus de escolaridade, do analfabeto (âmbar claro) ao superior completo (petróleo). */
export const ESCALA_ESCOLA = Array.from({ length: 8 }, (_, i) => sequencial(i / 7, [0.92, 0.09, 85], [0.33, 0.07, 222]))

/** Rampa do gasto de campanha: menta clara (pouco) a petróleo fechado (muito). */
export const corGasto = (t: number) => sequencial(0.12 + 0.88 * t, [0.94, 0.05, 165], [0.3, 0.06, 215])
