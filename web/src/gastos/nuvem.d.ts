export const BANDEIRA: string[]
export const MAX_SANTINHOS: number
export function reaisCurto(v: number): string
export function reaisExato(v: number): string
export function casasDoValor(v: number): { digitos: string; unidade: string; curta: string }

export interface ItemNuvem {
  palavra: string
  /** o valor, em reais */
  n: number
  propaganda: boolean
  quantidade: number
  fornecedores: { nome: string; valor: number; quantidade: number }[]
}
export interface ItemDimensionado extends ItemNuvem {
  rank: number
  L: number
  A: number
  tom: number
  cor: string
  tinta: string
}
export function dimensiona(itens: ItemNuvem[]): { lista: ItemDimensionado[]; comPiso: boolean }

export interface EstadoNuvem {
  total: number
  noChao: boolean
  sob: string | null
  fase: 'livre' | 'bafo' | 'pegando' | 'na-mao' | 'devolvendo'
  lida: string | null
}
export interface Nuvem {
  mostra(itens: ItemNuvem[], chuva?: boolean): { comPiso: boolean }
  joga(): void
  varre(): void
  /** `jogar = false` só tira o filtro (quem chama vai jogar todos de novo) */
  filtra(fn: ((s: ItemDimensionado) => boolean) | null, jogar?: boolean): void
  vira(palavra: string): void
  devolve(): void
  destaca(palavra: string | null): void
  som(ligado: boolean): void
  destroi(): void
}
export function criaNuvem(opcoes: {
  palco: HTMLElement
  canvas: HTMLCanvasElement
  dica: HTMLElement
  aoMudar?: (e: EstadoNuvem) => void
}): Nuvem
