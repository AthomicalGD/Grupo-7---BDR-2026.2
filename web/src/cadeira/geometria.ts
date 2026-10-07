// Geometria do plenário e escala de cor do gasto (P1).
import { interpolateRgbBasis } from 'd3-interpolate'
import type { Assento, Cadeira } from '../api'

export interface Lugar {
  x: number // centro do hemiciclo em (0, 0), raio externo 1, y para cima
  y: number
  ang: number // radianos: π à esquerda, 0 à direita
  fileira: number
}

/**
 * Hemiciclo de `n` lugares, como os diagramas de parlamento: fileiras concêntricas, cada uma
 * com lugares proporcionais ao comprimento do arco, numerados da esquerda para a direita.
 * Devolve os lugares e o diâmetro de cada um (na mesma unidade do raio).
 */
export function hemiciclo(n: number): { lugares: Lugar[]; diametro: number } {
  if (n <= 0) return { lugares: [], diametro: 0 }
  if (n <= 12) {
    // poucos lugares (governador, senador, uma câmara pequena): uma fileira só
    const r = 0.74
    const passo = Math.PI / n
    const lugares = Array.from({ length: n }, (_, j) => {
      const ang = Math.PI - (j + 0.5) * passo
      return { x: r * Math.cos(ang), y: r * Math.sin(ang), ang, fileira: 0 }
    })
    return { lugares, diametro: Math.min(0.15, r * passo * 0.72) }
  }
  const r0 = 0.36 // o miolo fica livre para o número
  let fileiras = 1
  const raios = (f: number) => Array.from({ length: f }, (_, i) => r0 + ((i + 0.5) * (1 - r0)) / f)
  const capacidade = (f: number) => raios(f).reduce((s, r) => s + Math.floor((Math.PI * r) / ((1 - r0) / f)) + 1, 0)
  while (capacidade(fileiras) < n) fileiras++
  const rs = raios(fileiras)
  const passo = (1 - r0) / fileiras

  // n dividido entre as fileiras pelo comprimento do arco (maiores restos)
  const soma = rs.reduce((s, r) => s + r, 0)
  const cotas = rs.map((r) => (n * r) / soma)
  const qtd = cotas.map(Math.floor)
  const ordem = cotas.map((c, i) => [c - Math.floor(c), i]).sort((a, b) => b[0] - a[0])
  const faltam = n - qtd.reduce((s, q) => s + q, 0)
  for (let k = 0; k < faltam; k++) qtd[ordem[k % ordem.length][1]]++

  const lugares: Lugar[] = []
  rs.forEach((r, f) => {
    const m = qtd[f]
    const folga = (passo * 0.5) / r // meia cadeira de margem em cada ponta
    for (let j = 0; j < m; j++) {
      const ang = m === 1 ? Math.PI / 2 : Math.PI - folga - (j * (Math.PI - 2 * folga)) / (m - 1)
      lugares.push({ x: r * Math.cos(ang), y: r * Math.sin(ang), ang, fileira: f })
    }
  })
  // da esquerda para a direita; no mesmo ângulo, de dentro para fora
  lugares.sort((a, b) => b.ang - a.ang || a.fileira - b.fileira)
  return { lugares, diametro: Math.min(0.12, passo * 0.8) } // câmaras pequenas não viram cadeiras gigantes
}

export type Ordem = 'gasto' | 'partido'

/** Quem senta onde: do menor ao maior gasto, ou por partido da esquerda para a direita (escala da P7). */
export function ordenar(cadeiras: Assento[], ordem: Ordem): Assento[] {
  const c = [...cadeiras]
  if (ordem === 'gasto') return c.sort((a, b) => a.gasto - b.gasto || a.id - b.id)
  return c.sort((a, b) => (a.vies ?? 0) - (b.vies ?? 0) || (a.partido ?? '').localeCompare(b.partido ?? '') || a.gasto - b.gasto)
}

// ColorBrewer YlGn (Cynthia Brewer): sequencial validado; de amarelo a verde, como a bandeira.
const YLGN = interpolateRgbBasis(['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529'])
const INICIO = 0.16 // o começo da rampa é quase branco e some no papel

export interface EscalaGasto {
  cor: (gasto: number) => string
  t: (gasto: number) => number
  min: number
  max: number
  log: boolean
}

/**
 * Escala do gasto entre o menor e o maior valor. Linear quando os gastos estão na mesma ordem de
 * grandeza (deputados, por exemplo); logarítmica quando o maior passa de 40 vezes o menor
 * (prefeitos de cidades pequenas e de capitais na mesma tela), senão quase tudo teria a mesma cor.
 */
export function escalaGasto(valores: number[]): EscalaGasto {
  const positivos = valores.filter((v) => v > 0)
  const min = Math.max(100, Math.min(...positivos, Infinity))
  const max = Math.max(min * 1.5, ...positivos)
  const log = max / min > 40
  const t = (g: number) =>
    g <= 0 ? 0 : Math.max(0, Math.min(1, log ? Math.log(g / min) / Math.log(max / min) : (g - min) / (max - min)))
  return { t, cor: (g) => YLGN(INICIO + (1 - INICIO) * t(g)), min, max, log }
}

export const corRampa = (t: number) => YLGN(INICIO + (1 - INICIO) * t)

/** Faixas com menos candidatos que isso não têm taxa de vitória que diga algo. */
export const MINIMO = 5

/** Primeira faixa de gasto em que metade ou mais dos candidatos se elegeu (o "preço de entrada"). */
export function entrada(curva: Cadeira['curva']) {
  return curva.find((f) => f.candidatos >= MINIMO && f.eleitos / f.candidatos >= 0.5)
}

const medidas = new WeakMap<HTMLElement, { w: number; h: number }>()

/** Mede o cartão uma vez por conteúdo; seguir o ponteiro não força layout a cada movimento. */
export function medir(el: HTMLElement | null) {
  if (el) medidas.set(el, { w: el.offsetWidth, h: el.offsetHeight })
}

/** Põe o cartão ao lado do ponteiro sem sair da tela. Move por transform (camada própria, sem
 *  layout nem repintura do plenário embaixo) e direto no elemento: segue o mouse sem render. */
export function posicionar(el: HTMLElement | null, x: number, y: number) {
  if (!el) return
  if (!medidas.has(el)) medir(el)
  const { w, h } = medidas.get(el)!
  let left = x + 16, top = y + 16
  if (left + w > window.innerWidth - 8) left = x - w - 16
  if (top + h > window.innerHeight - 8) top = y - h - 16
  el.style.transform = `translate3d(${Math.max(8, left)}px, ${Math.max(8, top)}px, 0)`
}
