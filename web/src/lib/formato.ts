// Formatação pt-BR e nomes do TSE.
const MENOS = '−'

export const inteiro = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('pt-BR'))

export const decimal = (n: number | null | undefined, casas = 1) =>
  n == null ? '-' : n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** Viés com sinal tipográfico: "−41,9", "+12,0", "0,0". */
export function vies(n: number | null | undefined): string {
  if (n == null) return '-'
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return n < -0.05 ? MENOS + s : n > 0.05 ? '+' + s : s
}

export const pct = (n: number | null | undefined, casas = 1) => (n == null ? '-' : decimal(n, casas) + '%')

export const reais = (n: number | null | undefined) =>
  n == null ? '-' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** Valor curto para leitura rápida: "R$ 5,6 mi", "R$ 33,8 mil", "R$ 940", "R$ 21,60". */
export function reaisCurto(n: number | null | undefined): string {
  if (n == null) return '-'
  const a = Math.abs(n)
  const f = (v: number, casas: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  if (a >= 1e9) return `R$ ${f(n / 1e9, 1)} bi`
  if (a >= 1e6) return `R$ ${f(n / 1e6, 1)} mi`
  if (a >= 1e4) return `R$ ${f(n / 1e3, 1)} mil`
  if (a >= 100) return `R$ ${f(n, 0)}`
  return `R$ ${f(n, 2)}`
}

const MINUSCULAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'D'])

/** "JOSE WELLINGTON BARROSO DE ARAUJO DIAS" -> "Jose Wellington Barroso de Araujo Dias". */
export function nomeProprio(nome: string): string {
  return nome
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p.toUpperCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

/** "DEPUTADO ESTADUAL" -> "Deputado estadual". */
export const cargo = (c: string) => c.charAt(0) + c.slice(1).toLowerCase()

/** "1 eleição", "11 eleições". */
export const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`

/** "SENADOR" -> "senadores", "DEPUTADO FEDERAL" -> "deputados federais". */
export const cargoPlural = (c: string) =>
  c
    .toLowerCase()
    .split(' ')
    .map((p) => (p.endsWith('r') ? p + 'es' : p.endsWith('l') ? p.slice(0, -1) + 'is' : p + 's'))
    .join(' ')

/** Busca sem acento e sem caixa. */
export const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
