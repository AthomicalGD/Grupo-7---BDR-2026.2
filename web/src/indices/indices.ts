// P3: os índices do eixo vertical, a correlação de Pearson e a reta de tendência (mínimos quadrados).
import type { IndicesVies, MunicipioIndices } from '../api'
import { decimal, inteiro, reaisCurto } from '../lib/formato'
import type { IndiceP3 } from '../router'

export interface DefIndice {
  rotulo: string
  /** o nome no eixo e na dica */
  eixo: string
  valor: (m: MunicipioIndices, ano: number) => number | null | undefined
  formato: (v: number) => string
  /** o PIB per capita vai de centenas a milhões de reais: na escala log os pontos não se amontoam */
  log?: boolean
  /** de onde vem o número na eleição escolhida (o ano do índice nem sempre é o da eleição) */
  fonte: (d: IndicesVies, ano: number) => string
  /** o que o índice mede, sem tirar conclusão do gráfico */
  explica: string
  /** a variação durante o mandato (área de desempenho dos partidos): em % no PIB per capita, em pontos nos outros */
  variacao: (v: number) => string
}

const comSinal = (v: number, casas: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${decimal(Math.abs(v), casas)}`

const EXPLICA_IFDM = {
  ifdm:
    'O IFDM (Índice Firjan de Desenvolvimento Municipal) vai de 0 a 1 e é a média de três áreas: emprego e renda, educação e saúde, ' +
    'calculadas a partir de dados oficiais (Ministérios do Trabalho, da Educação e da Saúde). Quanto mais perto de 1, mais desenvolvido o município.',
  emprego_renda:
    'A área de emprego e renda do IFDM, de 0 a 1, mede a geração de emprego formal, a parcela da população com emprego formal ' +
    'e a renda média e sua distribuição no mercado de trabalho formal.',
  educacao:
    'A área de educação do IFDM, de 0 a 1, mede o atendimento na educação infantil, o abandono e a distorção idade-série no ensino ' +
    'fundamental, a formação dos docentes, as horas-aula diárias e o resultado do Ideb.',
  saude:
    'A área de saúde do IFDM, de 0 a 1, mede a atenção básica: consultas de pré-natal, óbitos por causas mal definidas, ' +
    'óbitos infantis por causas evitáveis e internações que a atenção básica poderia ter evitado.',
} as const

const ifdm = (area: 'ifdm' | 'emprego_renda' | 'educacao' | 'saude', nome: string): DefIndice => ({
  explica: EXPLICA_IFDM[area],
  variacao: (v) => comSinal(v, 3),
  rotulo: area === 'ifdm' ? 'IFDM' : nome,
  eixo: area === 'ifdm' ? 'IFDM' : `IFDM ${nome}`,
  valor: (m, ano) => m.ifdm[ano]?.[area],
  formato: (v) => decimal(v, 3),
  fonte: (d, ano) => {
    const a = d.ano_ifdm[ano]
    return a == null ? 'IFDM não carregado' : a === ano ? `IFDM de ${a} (Firjan)` : `IFDM de ${a}, o mais recente (Firjan)`
  },
})

export const INDICES: Record<IndiceP3, DefIndice> = {
  ifdm: ifdm('ifdm', 'geral'),
  emprego_renda: ifdm('emprego_renda', 'Emprego e renda'),
  educacao: ifdm('educacao', 'Educação'),
  saude: ifdm('saude', 'Saúde'),
  pib_pc: {
    rotulo: 'PIB per capita',
    eixo: 'PIB per capita',
    valor: (m, ano) => m.pib_pc[ano],
    formato: reaisCurto,
    log: true,
    variacao: (v) => `${comSinal(v, 1)}%`,
    fonte: (d, ano) => (d.ano_pib[ano] == null ? 'PIB não carregado' : `PIB de ${d.ano_pib[ano]} (IBGE) sobre a população`),
    explica:
      'O PIB per capita é tudo o que o município produziu no ano (o Produto Interno Bruto, estimado pelo IBGE) dividido pela ' +
      'população, em reais por habitante.',
  },
  eleitores_pop: {
    rotulo: 'Eleitores por habitante',
    eixo: 'eleitores por 100 habitantes',
    valor: (m, ano) => m.eleitores_pop[ano],
    formato: (v) => inteiro(Math.round(v)),
    variacao: (v) => comSinal(v, 1),
    fonte: (_, ano) => `eleitores aptos de ${ano} (TSE) sobre a população (IBGE)`,
    explica:
      'Eleitores por 100 habitantes é o número de eleitores aptos a votar dividido pela população do município, vezes 100. ' +
      'Pode passar de 100 quando o cadastro eleitoral tem eleitores que moram em outro lugar.',
  },
  isentos: {
    rotulo: 'Isentos',
    eixo: 'isentos, % dos eleitores',
    valor: (m, ano) => m.isentos[ano],
    formato: (v) => `${decimal(v, 1)}%`,
    variacao: (v) => `${comSinal(v, 1)} p.p.`,
    fonte: (_, ano) => `brancos, nulos e abstenções de ${ano} (TSE), ${ano % 4 === 2 ? 'para presidente' : 'para prefeito'}`,
    explica:
      'Isentos é a parcela dos eleitores aptos que não escolheu candidato: os que votaram em branco, anularam o voto ou não ' +
      'compareceram, em porcentagem do total de eleitores.',
  },
}

export interface Ponto {
  ibge: number
  nome: string
  uf: string
  x: number
  y: number
  /** quantos eleitores: o tamanho do ponto */
  peso: number
}

export interface Ajuste {
  n: number
  /** correlação de Pearson; null com menos de 3 pontos ou um eixo constante */
  r: number | null
  a: number
  b: number
}

/** Pearson e a reta y = a + b·x, sobre `t(y)` (o log, no PIB, para a reta seguir o que se vê). */
export function ajuste(pontos: Ponto[], t: (y: number) => number = (y) => y): Ajuste {
  const n = pontos.length
  if (n < 3) return { n, r: null, a: 0, b: 0 }
  const ys = pontos.map((p) => t(p.y))
  const mx = pontos.reduce((s, p) => s + p.x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  pontos.forEach((p, i) => {
    sxy += (p.x - mx) * (ys[i] - my)
    sxx += (p.x - mx) ** 2
    syy += (ys[i] - my) ** 2
  })
  if (!sxx || !syy) return { n, r: null, a: my, b: 0 }
  const b = sxy / sxx
  return { n, r: sxy / Math.sqrt(sxx * syy), a: my - b * mx, b }
}

/** A força da correlação em palavras (limiares usuais de Cohen). */
export function forca(r: number): string {
  const v = Math.abs(r)
  return v < 0.1 ? 'quase nenhuma' : v < 0.3 ? 'fraca' : v < 0.5 ? 'moderada' : 'forte'
}
