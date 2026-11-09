// As peças do armário do bonequinho 3D: o que dá para escolher e os nomes que aparecem nas gavetas.
export const ROSTOS = { foto: 'Foto do TSE', desenho: 'Desenhado' } as const
export const CHAPEUS = {
  nenhum: 'Sem chapéu', cartola: 'Cartola', bone: 'Boné', coroa: 'Coroa', cangaceiro: 'Cangaceiro',
  palha: 'Palha', panama: 'Panamá do Lula', capacete: 'Capacete', festa: 'Festa', formatura: 'Capelo',
} as const
export const OCULOS = { nenhum: 'Sem óculos', leitura: 'Leitura', aviador: 'Aviador', escuros: 'Escuros', coracao: 'Coração' } as const
export const ROUPAS = {
  padrao: 'Do partido', terno: 'Terno', presidiario: 'Presidiário', selecao: 'Seleção', astronauta: 'Astronauta', super: 'Super-herói',
} as const
export const NA_MAO = {
  nada: 'Nada', bandeira: 'Bandeira', trofeu: 'Troféu', microfone: 'Microfone', constituicao: 'Constituição',
  plaquinha: 'Plaquinha', megafone: 'Megafone', balao: 'Balão',
} as const
export const ANIMACOES = {
  auto: 'Do resultado', acena: 'Acenar', danca: 'Dançar', pula: 'Pular', gira: 'Girar', comemora: 'Comemorar',
  discursa: 'Discursar', pensa: 'Pensar', alonga: 'Alongar', cabisbaixo: 'Cabisbaixo',
} as const

/** As cores do boneco: as do azulejo primeiro, depois outras de tinta de parede. null: a cor do lado. */
export const CORES = [
  { cor: '#1d4fa0', nome: 'Cobalto' }, { cor: '#f5b800', nome: 'Amarelo' }, { cor: '#d6382a', nome: 'Vermelho' },
  { cor: '#86a6dc', nome: 'Céu' }, { cor: '#2e8b57', nome: 'Verde' }, { cor: '#7a4fb5', nome: 'Roxo' },
  { cor: '#e8836f', nome: 'Coral' }, { cor: '#f08a24', nome: 'Laranja' }, { cor: '#e76fa8', nome: 'Rosa' },
  { cor: '#1aa6a6', nome: 'Turquesa' }, { cor: '#8b5a2b', nome: 'Terra' }, { cor: '#121417', nome: 'Preto' },
  { cor: '#eef1f5', nome: 'Branco' },
] as const

export type Rosto = keyof typeof ROSTOS
export type Chapeu = keyof typeof CHAPEUS
export type Oculos = keyof typeof OCULOS
export type Roupa = keyof typeof ROUPAS
export type NaMao = keyof typeof NA_MAO
export type Animacao = keyof typeof ANIMACOES

export interface Visual {
  rosto: Rosto
  chapeu: Chapeu
  oculos: Oculos
  roupa: Roupa
  mao: NaMao
  animacao: Animacao
  /** null: a do dado (quem venceu para presidente, governador ou prefeito já vem com a faixa) */
  faixa: boolean | null
  /** a cor do boneco (#rrggbb); null: a do lado */
  cor: string | null
  bigode: boolean
  chuva: boolean
  /** aumenta para tocar a animação de novo (o botão "tocar") */
  toca: number
}

export const VISUAL_INICIAL: Visual = {
  rosto: 'foto', chapeu: 'nenhum', oculos: 'nenhum', roupa: 'padrao', mao: 'nada', animacao: 'auto', faixa: null, cor: null, bigode: false, chuva: false, toca: 0,
}

const sorteia = <T extends string>(o: Record<T, string>) => { const k = Object.keys(o) as T[]; return k[Math.floor(Math.random() * k.length)] }
export const sortear = (v: Visual): Visual => ({
  ...v, chapeu: sorteia(CHAPEUS), oculos: sorteia(OCULOS), roupa: sorteia(ROUPAS), mao: sorteia(NA_MAO), animacao: sorteia(ANIMACOES),
  cor: Math.random() < 0.5 ? CORES[Math.floor(Math.random() * CORES.length)].cor : null,
  bigode: Math.random() < 0.25, chuva: Math.random() < 0.3, toca: v.toca + 1,
})
/** Tira tudo, mas mantém o rosto escolhido. */
export const despir = (v: Visual): Visual => ({ ...VISUAL_INICIAL, rosto: v.rosto, toca: v.toca })
