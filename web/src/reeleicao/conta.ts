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
  voltou: '#9eb735', // lima de eleito
  perdeu: '#c9c2b4', // cinza quente de não eleito
  tentou: '#5d6b94', // fita ardósia
  nao: '#eae8e4', // papel
  texto: '#55702a', // oliva para números e rótulos de quem voltou
} as const

/** As três partes em 100, pelo maior resto: a soma dá sempre 100. */
export function emCem(c: ContaReeleicao): Record<Destino, number> {
  const brutos = { nao: c.eleitos - c.tentaram, voltou: c.reeleitos, perdeu: c.tentaram - c.reeleitos }
  const chaves = Object.keys(brutos) as Destino[]
  const exatos = chaves.map((k) => (c.eleitos ? (brutos[k] * 100) / c.eleitos : 0))
  const cem = exatos.map(Math.floor)
  const falta = 100 - cem.reduce((a, b) => a + b, 0)
  exatos.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]).slice(0, falta).forEach(([, i]) => cem[i]++)
  return { nao: cem[0], voltou: cem[1], perdeu: cem[2] }
}

// a cor de quem voltou, do claro ao fechado, para pintar uma taxa (silhuetas dos estados); começa em 30%
// para a menor taxa não sumir no papel
const rampa = piecewise(interpolateLab, ['#f2f6e4', '#d2e19a', COR.voltou, '#708d33', '#45591d'])
export const corDaTaxa = (taxa: number) => rampa(Math.max(0, Math.min(1, (taxa - 30) / 60)))
