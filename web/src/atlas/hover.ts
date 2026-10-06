import { criarLoja } from '../lib/loja'

export interface Foco {
  tipo: 'uf' | 'municipio'
  codigo: number
  x: number
  y: number
}

/** Estado ou município sob o ponteiro (ou com foco do teclado) no mapa. */
export const hover = criarLoja<Foco | null>(null)
