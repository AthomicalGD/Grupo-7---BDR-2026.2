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

/** Busca sem acento e sem caixa. */
export const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
