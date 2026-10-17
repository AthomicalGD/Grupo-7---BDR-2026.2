// P2: nomes humanos das faixas e a conta das moedas do cofrinho.
import type { GrupoPatrimonio, Patrimonio } from '../api'

/** Moedas: quem se elegeu no lima de "eleito" (como as cédulas que voltaram na reeleição), o resto em metal. */
export const COR = {
  eleito: '#9eb735',
  eleitoBorda: '#6f8a22',
  texto: '#55702a', // lima não tem contraste como texto: números e rótulos no oliva
  metal: '#d5dade',
  metalBorda: '#9aa4ae',
} as const

/** As faixas que entram no cofrinho: quem não registrou bens e os quartis (o zero declarado é miúdo e vai só para a tabela). */
export const naCena = (d: Patrimonio) => d.grupos.filter((g) => g.tipo !== 'zero')

export const quartis = <G extends { tipo: GrupoPatrimonio['tipo'] }>(grupos: readonly G[]) => grupos.filter((g) => g.tipo === 'quartil' || g.tipo === 'faixa')

/** A régua comum das escadinhas: a maior taxa de uma faixa entre todas as disputas. */
export const tetoDe = (recortes: { grupos: { tipo: GrupoPatrimonio['tipo']; taxa: number }[] }[]) =>
  Math.max(10, ...recortes.flatMap((r) => quartis(r.grupos).map((g) => g.taxa)))

/** "Os 25% com menos bens", "Os 25% seguintes"... Com menos de quatro faixas (empates), "Faixa 1 de 3". */
export function nomeFaixa(g: GrupoPatrimonio, i: number, total: number): { nome: string; curto: string } {
  if (g.tipo === 'sem_bens') return { nome: 'Sem bens registrados', curto: 'Sem bens' }
  if (g.tipo === 'zero') return { nome: 'Declararam R$ 0', curto: 'R$ 0' }
  if (total !== 4) return { nome: `Faixa ${i + 1} de ${total}`, curto: `Faixa ${i + 1}` }
  return [
    { nome: 'Os 25% com menos bens', curto: 'Menos bens' },
    { nome: 'Os 25% seguintes', curto: 'Abaixo do meio' },
    { nome: 'Os 25% acima do meio', curto: 'Acima do meio' },
    { nome: 'Os 25% com mais bens', curto: 'Mais bens' },
  ][i]
}

const f1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
/** "R$ 25 mil", "R$ 1,4 mi", "R$ 940": sem o ",0" que o valor curto do sistema mantém. */
export function reaisFaixa(n: number | null | undefined): string {
  if (n == null) return '-'
  // espaços que não quebram: "R$ 1,7 mi" nunca se parte no fim da linha
  if (n >= 1e9) return `R$ ${f1.format(n / 1e9)} bi`
  if (n >= 1e6) return `R$ ${f1.format(n / 1e6)} mi`
  if (n >= 1e3) return `R$ ${f1.format(n >= 1e4 ? Math.round(n / 1e3) : n / 1e3)} mil`
  return `R$ ${Math.round(n)}`
}

/** "até R$ 25 mil", "R$ 25 mil a R$ 85 mil", "acima de R$ 220 mil". */
export function limitesCurtos(g: GrupoPatrimonio, i: number, total: number): string {
  if (g.de == null || g.ate == null) return 'nenhum bem na declaração'
  if (reaisFaixa(g.de) === reaisFaixa(g.ate)) return reaisFaixa(g.de)
  if (i === 0) return `até ${reaisFaixa(g.ate)}`
  if (i === total - 1) return `acima de ${reaisFaixa(g.de)}`
  return `${reaisFaixa(g.de)} a ${reaisFaixa(g.ate)}`
}

/** Abaixo disso, uma faixa tem tão poucos candidatos que um eleito a mais muda muito a porcentagem. */
export const POUCOS = 30

/** Moedas inteiras em cada 100 (arredondadas, nunca zero quando houve eleito). */
export const moedas = (taxa: number) => (taxa > 0 ? Math.max(1, Math.round(taxa)) : 0)

/** Taxa curta para frase: "27%", "0,9%". */
export const taxaCurta = (t: number) => (t >= 10 || t === 0 ? `${Math.round(t)}%` : `${t.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
