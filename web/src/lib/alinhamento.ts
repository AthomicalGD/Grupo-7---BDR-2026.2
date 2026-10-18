// Alinhamento nas votações da Câmara (SVD, −100 a +100). NÃO é o viés ideológico: acompanha a coalizão de
// governo (o mesmo partido muda dezenas de pontos de um governo para outro). Por isso tem paleta própria,
// petróleo ↔ violeta, longe do laranja ↔ azul do viés, e rótulos pelas âncoras do eixo, não "esquerda/direita".
// Mesma construção em OKLCH de lib/vies.ts: cada braço mantém a matiz e os passos de luminosidade são iguais.
import { oklchParaHex } from './vies'

const NEG = [0.5, 0.09, 195] as const // petróleo: vota com PT e PSOL
const MEIO = [0.935, 0.004, 250] as const
const POS = [0.47, 0.13, 310] as const // violeta: vota com PL e NOVO
export const SATURA_ALINHAMENTO = 70

/** Âncoras que fixam o sinal do SVD (scripts/svd_camara.py). */
export const POLOS_ALINHAMENTO = { negativo: 'com PT e PSOL', positivo: 'com PL e NOVO' } as const

const cache = new Map<number, string>()

export function corAlinhamento(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'var(--color-papel-2)'
  const r = Math.round(v * 2) / 2
  let cor = cache.get(r)
  if (!cor) {
    const t = Math.min(1, Math.abs(r) / SATURA_ALINHAMENTO) ** 0.85
    const alvo = r < 0 ? NEG : POS
    cor = oklchParaHex(MEIO[0] + (alvo[0] - MEIO[0]) * t, MEIO[1] + (alvo[1] - MEIO[1]) * (1 - (1 - t) ** 2.2), alvo[2])
    cache.set(r, cor)
  }
  return cor
}

export function ladoAlinhamento(v: number | null | undefined): string {
  if (v == null) return 'sem dados'
  if (Math.abs(v) < 10) return 'entre os blocos'
  return v < 0 ? `vota mais ${POLOS_ALINHAMENTO.negativo}` : `vota mais ${POLOS_ALINHAMENTO.positivo}`
}
