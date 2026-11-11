// Contas compartilhadas da P10a: as cores dos destinos e a divisão dos eleitos em 100.
// Como as situações do TSE Resultados: voltaram no lima de "eleito", perderam no cinza quente de "não
// eleito", não tentaram em papel. `texto` é o oliva para escrever números na cor de quem voltou (lima
// não tem contraste como texto).
import { interpolateLab, piecewise } from 'd3-interpolate'
import type { ContaReeleicao } from '../api'

export type Destino = 'nao' | 'voltou' | 'perdeu'
// casas do quadro de calor com menos tentativas que isso ficam hachuradas
export const POUCOS = 10
// todos os estados carregados somados (na API e no endereço, a ausência de uf)
export const TODOS = 'TODOS'

export const COR = {
  voltou: '#1d4fa0', // azulejo: cobalto
  perdeu: '#e8836f', // azulejo: vermelho claro
  tentou: '#f5b800', // azulejo: amarelo
  nao: '#eef1f5', // branco de Brasília
  texto: '#1d4fa0', // cobalto
} as const

/** As três partes em 100, pelo maior resto: a soma dá sempre 100. Quem aguarda um 2º turno ainda não
 * publicado (2026) fica fora das três. */
export function emCem(c: ContaReeleicao): Record<Destino, number> {
  const base = c.eleitos - (c.pendentes ?? 0)
  const brutos = { nao: base - c.tentaram, voltou: c.reeleitos, perdeu: c.tentaram - c.reeleitos }
  const chaves = Object.keys(brutos) as Destino[]
  const exatos = chaves.map((k) => (base ? (brutos[k] * 100) / base : 0))
  const cem = exatos.map(Math.floor)
  const falta = 100 - cem.reduce((a, b) => a + b, 0)
  exatos.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]).slice(0, falta).forEach(([, i]) => cem[i]++)
  return { nao: cem[0], voltou: cem[1], perdeu: cem[2] }
}

// a cor de quem voltou, do claro ao fechado, para pintar uma taxa (silhuetas dos estados); começa em 30%
// para a menor taxa não sumir no papel
const rampa = piecewise(interpolateLab, ['#eef3fb', '#c3d3ef', '#4b78c2', COR.voltou, '#0f2c5c'])
export const corDaTaxa = (taxa: number) => rampa(Math.max(0, Math.min(1, (taxa - 30) / 60)))
