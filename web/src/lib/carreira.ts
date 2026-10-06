import type { Candidatura } from '../api'

/** Anos de mandato do cargo (cod_cargo do TSE): senador e suplentes, 8; os demais, 4. */
export const duracaoMandato = (cod: number) => (cod === 5 || cod === 9 || cod === 10 ? 8 : 4)

export function situacao(c: Candidatura) {
  if (!c.eleito) return 'Não eleito'
  if (c.reeleito) return 'Reeleito'
  return c.turno === 2 ? 'Eleito no 2º turno' : 'Eleito'
}
