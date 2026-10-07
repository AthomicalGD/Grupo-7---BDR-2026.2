// Para onde vai e de onde vem o dinheiro da disputa.
// Para onde: um recibo de prestação de contas, item a item, impresso como o boletim do município.
// De onde: uma barra só, dividida pelas fontes declaradas; o dinheiro público vem primeiro.
import { memo } from 'react'
import type { Cadeira } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { pct, plural, reaisCurto } from '../lib/formato'

const CURTO: Record<string, string> = {
  'Publicidade por materiais impressos': 'Material impresso',
  'Serviços prestados por terceiros': 'Serviços de terceiros',
  'Atividades de militância e mobilização de rua': 'Militância de rua',
  'Produção de programas de rádio, televisão ou vídeo': 'Rádio, TV e vídeo',
  'Despesas com pessoal': 'Pessoal',
  'Publicidade por adesivos': 'Adesivos',
  'Serviços advocatícios': 'Advogados',
  'Despesa com Impulsionamento de Conteúdos': 'Impulsionamento na internet',
  'Cessão ou locação de veículos': 'Aluguel de veículos',
  'Combustíveis e lubrificantes': 'Combustível',
  'Serviços contábeis': 'Contadores',
  'Diversas a especificar': 'Diversas, sem especificar',
  'Produção de jingles, vinhetas e slogans': 'Jingles e vinhetas',
  'Despesas com transporte ou deslocamento': 'Transporte',
  'Locação/cessão de bens imóveis': 'Aluguel de imóveis',
  'Pesquisas ou testes eleitorais': 'Pesquisas eleitorais',
  'Publicidade por carros de som': 'Carro de som',
  'Eventos de promoção da candidatura': 'Eventos',
  'Criação e inclusão de páginas na internet': 'Sites',
  'Publicidade por jornais e revistas': 'Jornais e revistas',
}

const FONTES = [
  { chave: 'fundo_eleitoral', nome: 'Fundo eleitoral', cor: '#2B4C8C', publico: true },
  { chave: 'fundo_partidario', nome: 'Fundo partidário', cor: '#6F8CC4', publico: true },
  { chave: 'pessoas_fisicas', nome: 'Doações de pessoas', cor: '#FBC700', publico: false },
  { chave: 'proprios', nome: 'Do próprio bolso', cor: '#F19929', publico: false },
  { chave: 'outros', nome: 'Outras origens', cor: '#AEB6BF', publico: false },
] as const

interface Props {
  dados: Cadeira
  fator: number
  titulo: string // "Deputado federal · 2022 · 6 estados"
}

export const Recibo = memo(function Recibo({ dados, fator, titulo }: Props) {
  const total = dados.despesas.reduce((s, d) => s + d.valor, 0)
  const { cadeiras } = dados.resumo
  return (
    <figure className="m-0">
      <div className="boletim-papel mx-auto max-w-[460px] bg-folha px-6 pb-12 pt-6 font-mono text-[0.8rem] font-medium text-tinta shadow-[var(--shadow-papel)] sm:px-8">
        <p className="text-center font-semibold tracking-[0.06em]">PRESTAÇÃO DE CONTAS</p>
        <p className="mt-1 text-center text-tinta-2">{titulo}</p>
        <p className="mt-0.5 text-center text-tinta-3">despesa contratada declarada ao TSE</p>
        <div className="my-4 border-t border-dashed border-linha-2" />
        <ul className="grid grid-cols-1 gap-1.5">
          {dados.despesas.map((d, i) => (
            <li key={d.categoria} className="boletim-linha flex items-baseline gap-2" style={{ ['--i' as string]: i }}>
              <span className="min-w-0 shrink truncate" title={d.categoria}>{CURTO[d.categoria] ?? d.categoria}</span>
              <span aria-hidden className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-linha-2" />
              <span className="tabular whitespace-nowrap">{reaisCurto(d.valor * fator)}</span>
              <span className="tabular w-[3.2rem] text-right text-tinta-3">{pct((100 * d.valor) / total, 0)}</span>
            </li>
          ))}
        </ul>
        <div className="my-4 border-t border-dashed border-linha-2" />
        <p className="flex justify-between font-semibold">
          <span>TOTAL</span>
          <span className="tabular">{reaisCurto(total * fator)}</span>
        </p>
        <p className="mt-1 flex justify-between text-tinta-2">
          <span>÷ {plural(cadeiras, 'cadeira', 'cadeiras')}</span>
          <span className="tabular">{cadeiras ? reaisCurto((total * fator) / cadeiras) : '-'}</span>
        </p>
      </div>
      <TabelaAlternavel
        titulo="Despesa por tipo"
        colunas={['Tipo de despesa', 'Valor', '% do total']}
        linhas={() => dados.despesas.map((d) => [d.categoria, reaisCurto(d.valor * fator), pct((100 * d.valor) / total, 1)])}
      />
    </figure>
  )
})

export const Fontes = memo(function Fontes({ dados, fator }: { dados: Cadeira; fator: number }) {
  const r = dados.receitas
  const total = FONTES.reduce((s, f) => s + r[f.chave], 0)
  if (!total) return <p className="text-tinta-2">Nenhuma receita declarada nesta disputa.</p>
  const publico = FONTES.filter((f) => f.publico).reduce((s, f) => s + r[f.chave], 0)
  return (
    <figure className="m-0">
      <p className="t-numero text-[clamp(2.6rem,1.6rem+3vw,4rem)] leading-none">{pct((100 * publico) / total, 0)}</p>
      <p className="mt-2 max-w-[36ch] text-[1.02rem] text-tinta-2">
        do dinheiro que entrou nas campanhas veio de fundos públicos ({reaisCurto(publico * fator)} de {reaisCurto(total * fator)}).
      </p>
      <div className="mt-6 flex h-11 overflow-hidden rounded-[10px]" role="img" aria-label={FONTES.map((f) => `${f.nome} ${pct((100 * r[f.chave]) / total, 0)}`).join(', ')}>
        {FONTES.map((f) => (
          <div key={f.chave} style={{ width: `${(100 * r[f.chave]) / total}%`, background: f.cor }} className="h-full border-r-2 border-folha last:border-r-0" />
        ))}
      </div>
      <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {FONTES.map((f) => (
          <div key={f.chave} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-x-2.5">
            <span aria-hidden className="size-3 translate-y-0.5 rounded-[3px]" style={{ background: f.cor }} />
            <dt className="text-[0.9rem] font-semibold">{f.nome}</dt>
            <dd className="tabular text-[0.9rem]">{pct((100 * r[f.chave]) / total, 0)}</dd>
            <dd className="tabular col-start-2 text-[0.8rem] text-tinta-3">{reaisCurto(r[f.chave] * fator)}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
})
