// P12: o que as peças da página do 2º turno dividem: as cores dos papéis, os nomes dos lugares e a conta da
// parte do vencedor entre os dois finalistas (a medida das linhas que se cruzam).
import type { Finalista, SegundoTurno } from '../api'
import { doEstado, nomeProprio } from '../lib/formato'

// Resultado, não lado político: o vencedor no verde de "eleito", o derrotado na ardósia neutra e a virada no
// ouro do marcador. Nunca a escala do viés: os dois finalistas podem ser do mesmo lado (PE 2022).
export const COR = {
  vence: 'var(--color-eleito)',
  venceClaro: '#b9cf6e',
  perde: 'var(--color-tinta-3)',
  perdeClaro: 'var(--color-linha-2)',
  vira: 'var(--color-escolha)',
  viraTraco: 'var(--color-escolha-2)',
  viraClaro: 'var(--color-escolha-claro)',
} as const

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
