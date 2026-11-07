// P6: a escala sépia, só desta página e do bloco "Idade" do boletim. O papel amarela com o tempo: da folha clara
// (mais jovem) ao sépia (mais velho), em OKLCH com a luminosidade sempre caindo (0,955 -> 0,43) e a matiz puxada
// para o amarelo (98° -> 66°), para não encostar no laranja do viés de esquerda (o tom mais perto fica a ΔE 8,3).
// Texto em tinta sobre os quatro claros e em folha sobre os dois escuros (contraste de 4,7:1 ou mais).
import type { IdadeMunicipio, Passagem, Terco } from '../api'

export const SEPIA = ['#f4f1df', '#ded4b4', '#c6b48a', '#ab9166', '#896e4a', '#634a30'] as const

/** Tinta do texto sobre o passo i (0 a 5) da escala. */
export const tintaSobreSepia = (i: number) => (i <= 3 ? 'var(--color-tinta)' : 'var(--color-folha)')

/** Limites das seis classes do mapa (idade média de quem votou): os mesmos nos quatro anos, para o
 *  envelhecimento de 2018 a 2024 aparecer como escurecimento. */
export const LIMITES = [40, 42, 44, 46, 48] as const

export const classeIdade = (idade: number) => LIMITES.filter((l) => idade >= l).length

export const corIdade = (idade: number | null | undefined) => (idade == null ? null : SEPIA[classeIdade(idade)])

export const ROTULO_CLASSE = ['até 40', '40 a 42', '42 a 44', '44 a 46', '46 a 48', '48 ou mais']

/** Os terços usam os passos 2, 4 e 6, sempre com o nome escrito ao lado (cor nunca é o único canal). */
export const COR_TERCO: Record<Terco, string> = { 1: SEPIA[1], 2: SEPIA[3], 3: SEPIA[5] }
export const NOME_TERCO: Record<Terco, string> = { 1: 'mais jovem', 2: 'intermediário', 3: 'mais velho' }
export const TERCOS: Terco[] = [1, 2, 3]

/** "Mais jovem" (só a primeira letra; a classe capitalize poria "Mais Jovem"). */
export const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** As quatro faixas comuns a quem votou, candidatos e eleitos (18 a 34 ... 65 ou mais). */
export const COR_FAIXA = [SEPIA[1], SEPIA[2], SEPIA[4], SEPIA[5]] as const
export const TINTA_FAIXA = ['var(--color-tinta)', 'var(--color-tinta)', 'var(--color-folha)', 'var(--color-folha)'] as const

/** A marca entre duas molduras da galeria: o sinal, o nome curto e a explicação. */
export const MARCA: Record<Passagem, { sinal: string; curto: string; nome: string }> = {
  'mesmo partido': { sinal: '=', curto: 'mesmo partido', nome: 'Mesmo partido (renomeações contam como o mesmo)' },
  'troca de partido': { sinal: '≠', curto: 'troca', nome: 'Troca de partido' },
  'troca com ressalva (partidos fundidos)': {
    sinal: '~',
    curto: 'com ressalva',
    nome: 'Troca com ressalva: o partido anterior foi incorporado ao novo entre as duas eleições',
  },
}

/** "45,7" (anos, uma casa, vírgula decimal). */
export const anos = (n: number | null | undefined, casas = 1) =>
  n == null ? '-' : n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** "+1,7" com o sinal de menos tipográfico (−) quando negativo. */
export const comSinal = (n: number | null | undefined, casas = 1) =>
  n == null ? '-' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`

/** +1 / -1 se o intervalo de 95% não cruza o zero, 0 se cruza. */
export const claro = (e: { lo: number; hi: number } | null | undefined) => (!e ? 0 : e.lo > 0 ? 1 : e.hi < 0 ? -1 : 0)

/** "6 trocas de partido em 7 passagens, 2 reeleições" (as trocas com ressalva à parte). */
export function resumoPassagens(p: NonNullable<IdadeMunicipio['passagens']>) {
  if (!p.total) return 'Sem passagens de mandato registradas'
  const trocas = `${p.troca} ${p.troca === 1 ? 'troca' : 'trocas'} de partido em ${p.total} ${p.total === 1 ? 'passagem' : 'passagens'}`
  const fusao = p.fusao ? `, ${p.fusao} com ressalva (fusão)` : ''
  const ree = `${p.reeleicoes} ${p.reeleicoes === 1 ? 'reeleição' : 'reeleições'}`
  return `${trocas}${fusao}, ${ree}`
}
