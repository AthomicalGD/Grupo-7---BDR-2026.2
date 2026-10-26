// P12: o que as peças da página do 2º turno dividem: as cores dos papéis, os nomes dos lugares e a conta da
// parte do vencedor entre os dois finalistas (a medida das linhas que se cruzam).
import type { Finalista, SegundoTurno } from '../api'
import { doEstado, nomeProprio } from '../lib/formato'

// As disputas (a largada) se pintam pelo resultado: virada no ouro do marcador, confirmação no verde de eleito.
export const COR = {
  vence: 'var(--color-eleito)',
  venceClaro: 'color-mix(in oklab, var(--color-eleito) 42%, white)',
  perde: 'var(--color-tinta-3)',
  perdeClaro: 'var(--color-linha-2)',
  vira: 'var(--color-escolha)',
  viraTraco: 'var(--color-escolha-2)',
  viraClaro: 'var(--color-escolha-claro)',
} as const

// Os finalistas se pintam pelo lado do partido (o viés, −100 a +100): esquerda vermelha e direita azul. Quando os
// dois são do mesmo lado, o mais à ponta fica com a cor do lado e o outro com o amarelo; sem viés, cinza.
export interface CorFinalista { cor: string; claro: string; texto: string; lado: 'esquerda' | 'direita' | null }
const VERMELHO = '#d6382a', AZUL = '#1d4fa0', AMARELO = '#f5b800', CINZA = '#5f6878'
const claro = (c: string) => `color-mix(in oklab, ${c} 45%, white)`
const pinta = (cor: string, lado: CorFinalista['lado']): CorFinalista => ({
  cor, claro: claro(cor), lado,
  // o amarelo não dá para ler sobre o branco: o texto dele vai num ouro escuro da mesma família
  texto: cor === AMARELO ? '#7a5800' : cor === CINZA ? 'var(--color-tinta-2)' : cor,
})
export function coresFinalistas(d: SegundoTurno): [CorFinalista, CorFinalista] {
  const lados = d.finalistas.map((f) => (f.vies == null ? null : f.vies < 0 ? 'esquerda' : 'direita'))
  const [la, lb] = lados
  const base = (l: CorFinalista['lado']) => (l === 'esquerda' ? VERMELHO : l === 'direita' ? AZUL : CINZA)
  if (la && la === lb) {
    // do mesmo lado: quem está mais à ponta (mais à esquerda ou mais à direita) fica com a cor do lado
    const [va, vb] = d.finalistas.map((f) => Math.abs(f.vies ?? 0))
    return va >= vb ? [pinta(base(la), la), pinta(AMARELO, lb)] : [pinta(AMARELO, la), pinta(base(lb), lb)]
  }
  return [pinta(base(la), la), pinta(base(lb), lb)]
}

export const CARGOS = { presidente: 1, governador: 3, prefeito: 11 } as const
export type ChaveCargo = keyof typeof CARGOS
export const chaveDoCargo = (cod: number): ChaveCargo => (cod === 1 ? 'presidente' : cod === 3 ? 'governador' : 'prefeito')

/** A parte do vencedor entre os dois finalistas, em % (acima de 50: estava na frente). */
export function parteVencedor(d: SegundoTurno) {
  const [a, b] = d.finalistas
  return { t1: (100 * a.votos_t1) / (a.votos_t1 + b.votos_t1 || 1), t2: (100 * a.votos_t2) / (a.votos_t2 + b.votos_t2 || 1) }
}

export const nomeUrna = (f: Finalista) => nomeProprio(f.nome_urna || f.nome)

/** "Brasil", "Pernambuco", "Belo Horizonte (MG)". */
export function lugar(d: SegundoTurno, ufs: Map<string, string>): string {
  if (d.cod_cargo === 1) return 'Brasil'
  if (d.cod_cargo === 3) return ufs.get(d.uf ?? '') ?? d.uf ?? ''
  return `${nomeProprio(d.municipio ?? '')} (${d.uf})`
}

/** "Presidência da República", "Governo de Pernambuco", "Prefeitura de Belo Horizonte (MG)". */
export function disputaNome(d: SegundoTurno, ufs: Map<string, string>): string {
  if (d.cod_cargo === 1) return 'Presidência da República'
  if (d.cod_cargo === 3) return `Governo ${doEstado(d.uf ?? '', ufs.get(d.uf ?? '') ?? d.uf ?? '')}`
  return `Prefeitura de ${nomeProprio(d.municipio ?? '')} (${d.uf})`
}

export const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')
