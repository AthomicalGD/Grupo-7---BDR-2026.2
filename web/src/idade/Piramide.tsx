// Ato 3: a pirâmide etária espelhada, o gráfico canônico de idade. À esquerda, quem votou (18 anos ou mais); à
// direita, os eleitos do cargo; o tracejado em tinta mostra os candidatos aptos sobre os eleitos, para ver que a
// diferença já vem de quem se candidata. As quatro faixas comuns (18 a 34 ... 65 ou mais), cada barra no passo
// sépia da sua faixa, do mais velho em cima ao mais jovem embaixo. As barras crescem do eixo para fora, uma vez.
import { useInView } from 'motion/react'
import { useRef } from 'react'
import type { EleitosIdade } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, pct } from '../lib/formato'
import { anos, COR_FAIXA, TINTA_FAIXA } from './sepia'

const parte = (v: number[]) => {
  const t = v.reduce((a, b) => a + b, 0)
  return v.map((x) => (t ? (100 * x) / t : 0))
}

export function Piramide({ dados, cargo }: { dados: EleitosIdade; cargo: '11' | '13' }) {
  const ref = useRef<HTMLDivElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.3 })
  const c = dados.cargos[cargo]
  const votou = parte(dados.quem_votou)
  const eleitos = parte(c.eleitos)
  const candidatos = parte(c.candidatos)
  const teto = Math.max(...votou, ...eleitos, ...candidatos)
  const largura = (v: number) => `${(100 * v) / teto}%`
  // barra curta (menos de 22% do espaço): o número vai para fora dela, em tinta
  const curta = (v: number) => (100 * v) / teto < 22
  const ordem = [3, 2, 1, 0] // do mais velho (em cima) ao mais jovem
  return (
    <div ref={ref}>
      <div className="grid grid-cols-[minmax(0,1fr)_4.6rem_minmax(0,1fr)] items-end gap-x-2 text-[0.82rem]">
        <p className="text-right font-semibold text-tinta">Quem votou <span className="font-normal text-tinta-3">(18+, {anos(dados.idade_quem_votou)} anos em média)</span></p>
        <span />
        <p className="font-semibold text-tinta">{c.nome === 'Vereador' ? 'Vereadores eleitos' : 'Prefeitos eleitos'} <span className="font-normal text-tinta-3">({anos(c.idade_eleitos)} anos)</span></p>
      </div>
      <ol className="mt-2 grid gap-y-1.5" aria-label={`Pirâmide etária: quem votou e ${c.nome === 'Vereador' ? 'vereadores' : 'prefeitos'} eleitos em ${dados.ano}, por faixa de idade`}>
        {ordem.map((f, i) => (
          <li key={f} className="grid grid-cols-[minmax(0,1fr)_4.6rem_minmax(0,1fr)] items-center gap-x-2">
            <div className="relative flex h-9 items-center justify-end gap-1.5">
              {curta(votou[f]) && <span className="tabular text-[0.8rem] font-bold text-tinta">{pct(votou[f], 0)}</span>}
              <span
                className={`flex h-full items-center justify-start rounded-l-[4px] pl-1.5 ${visto ? 'revela-direita' : 'opacity-0'}`}
                style={{ width: largura(votou[f]), background: COR_FAIXA[f], color: TINTA_FAIXA[f], animationDelay: `${i * 90}ms`, boxShadow: f === 0 ? 'inset 0 0 0 1px rgb(24 32 43 / .2)' : undefined }}
              >
                {!curta(votou[f]) && <span className="tabular text-[0.8rem] font-bold">{pct(votou[f], 0)}</span>}
              </span>
            </div>
            <span className="tabular text-center text-[0.8rem] font-semibold text-tinta-2">{dados.faixas[f]}</span>
            <div className="relative flex h-9 items-center gap-1.5">
              <span
                className={`flex h-full shrink-0 items-center justify-end rounded-r-[4px] pr-1.5 ${visto ? 'revela-esquerda' : 'opacity-0'}`}
                style={{ width: largura(eleitos[f]), background: COR_FAIXA[f], color: TINTA_FAIXA[f], animationDelay: `${i * 90}ms`, boxShadow: f === 0 ? 'inset 0 0 0 1px rgb(24 32 43 / .2)' : undefined }}
              >
                {!curta(eleitos[f]) && <span className="tabular text-[0.8rem] font-bold">{pct(eleitos[f], 0)}</span>}
              </span>
              {curta(eleitos[f]) && <span className="tabular relative z-10 rounded bg-papel/80 px-0.5 text-[0.8rem] font-bold text-tinta" style={{ marginLeft: `max(0px, calc(${largura(candidatos[f])} - ${largura(eleitos[f])}))` }}>{pct(eleitos[f], 0)}</span>}
              {/* os candidatos aptos: o contorno tracejado em tinta */}
              <span className="pointer-events-none absolute inset-y-[3px] left-0 rounded-r-[4px] border-[1.5px] border-l-0 border-dashed border-tinta" style={{ width: largura(candidatos[f]) }} aria-hidden />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-tinta-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border-[1.5px] border-dashed border-tinta" aria-hidden />candidatos aptos ({anos(c.idade_candidatos)} anos em média)</span>
        <span>% de cada grupo em cada faixa de idade</span>
      </p>
      <TabelaAlternavel
        titulo={`Faixas de idade: quem votou, candidatos e eleitos (${c.nome.toLowerCase()}, ${dados.ano})`}
        colunas={['Faixa', 'Quem votou', 'Candidatos', 'Eleitos']}
        linhas={() => ordem.map((f) => [dados.faixas[f], `${pct(votou[f])} (${inteiro(dados.quem_votou[f])})`, `${pct(candidatos[f])} (${inteiro(c.candidatos[f])})`, `${pct(eleitos[f])} (${inteiro(c.eleitos[f])})`])}
      />
    </div>
  )
}
