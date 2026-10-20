// Escala divergente do viés (-100 esquerda, +100 direita): laranja ↔ cinza ↔ azul.
// Viés = (média dos especialistas - 5) × 20. Contínua e simétrica em 0, saturando em ±75: os municípios
// carregados ficam em [-41, +72] e os partidos em [-90, +76], então só os partidos dos extremos saturam.
// Cada braço mantém a própria matiz e varia luminosidade e croma em OKLCH, então os
// passos de luminosidade dos dois lados são iguais (validado no protótipo).

const ESQ = [0.5, 0.15, 46] as const
const MEIO = [0.935, 0.004, 250] as const
const DIR = [0.45, 0.11, 254] as const
export const SATURA = 75

export function oklchParaHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const canal = (c: number) => {
    c = Math.max(0, Math.min(1, c))
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return (
    '#' +
    canal(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) +
    canal(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) +
    canal(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  )
}

const cache = new Map<string, string>()

/** Cor do viés; null/undefined = sem dado. `satura` é o valor que já recebe a cor mais forte. */
export function corVies(v: number | null | undefined, satura = SATURA): string {
  if (v == null || Number.isNaN(v)) return 'var(--color-papel-2)'
  const arredondado = Math.round(v * 2) / 2
  const chave = arredondado + '/' + satura
  let cor = cache.get(chave)
  if (!cor) {
    const t = Math.min(1, Math.abs(arredondado) / satura) ** 0.85
    const alvo = arredondado < 0 ? ESQ : DIR
    cor = oklchParaHex(MEIO[0] + (alvo[0] - MEIO[0]) * t, MEIO[1] + (alvo[1] - MEIO[1]) * (1 - (1 - t) ** 2.2), alvo[2])
    cache.set(chave, cor)
  }
  return cor
}

/** Texto escuro ou claro sobre a cor do viés: claro a partir de ~63% da saturação (38 de 60 na escala antiga). */
export const tintaSobre = (v: number | null | undefined, satura = SATURA) =>
  v != null && Math.abs(v) >= satura * (38 / 60) ? '#fcfdfd' : '#18202b'

/** Centro = faixa de centro do artigo (4,5 a 5,5 na escala 0–10), que vira −10 a +10. */
export function ladoVies(v: number | null | undefined): string {
  if (v == null) return 'sem dados'
  if (Math.abs(v) < 10) return 'no centro'
  return v < 0 ? 'pendeu à esquerda' : 'pendeu à direita'
}

export const gradienteVies = (satura = SATURA) =>
  [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) => corVies(f * satura, satura))
