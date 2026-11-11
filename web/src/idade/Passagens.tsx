// Ato 2: as passagens de mandato de prefeito (1996 a 2024) por terço de idade na UF, em barras de 100% com três
// trechos neutros (a cor desta página é só da idade e do viés): mesmo partido em papel, troca de partido em tinta e
// troca com ressalva (fusão) em tinta hachurada. À direita, o índice de troca do terço, na leitura escolhida da
// fusão (como troca ou como continuidade). A faixa do terço na cor dele, com o nome escrito.
import { useInView } from 'motion/react'
import { useRef } from 'react'
import type { AlternanciaIdade } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, pct } from '../lib/formato'
import { anos, COR_TERCO, maiuscula, NOME_TERCO } from './sepia'

export type Leitura = 'estrita' | 'ampla'

const HACHURA = 'repeating-linear-gradient(135deg, var(--color-tinta-2) 0 3px, var(--color-papel-2) 3px 6px)'

export function Passagens({ dados, leitura }: { dados: AlternanciaIdade; leitura: Leitura }) {
  const ref = useRef<HTMLOListElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.3 })
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.82rem] text-tinta-2">
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded-[3px] border border-linha-2 bg-papel-2" aria-hidden />mesmo partido</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded-[3px] bg-tinta-2" aria-hidden />troca de partido</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded-[3px]" style={{ background: HACHURA }} aria-hidden />troca com ressalva (partidos fundidos)</span>
      </p>
      <ol ref={ref} className="mt-4 grid gap-y-2.5">
        {dados.tercos.map((t, i) => {
          const indice = leitura === 'estrita' ? t.troca_estrita : t.troca_ampla
          const partes = [
            { chave: 'mesmo', valor: t.mesmo, estilo: { background: 'var(--color-papel-2)' } },
            { chave: 'troca', valor: t.troca, estilo: { background: 'var(--color-tinta-2)' } },
            { chave: 'fusao', valor: t.fusao, estilo: { background: HACHURA } },
          ]
          return (
            <li key={t.terco} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[12.5rem_minmax(0,1fr)_7rem]">
              <p className="flex min-w-0 items-center gap-2.5 max-sm:col-span-2">
                <span className="h-9 w-2 shrink-0 rounded-full" style={{ background: COR_TERCO[t.terco], boxShadow: t.terco === 1 ? 'inset 0 0 0 1px rgb(24 32 43 / .2)' : undefined }} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[0.92rem] font-semibold leading-tight text-tinta">{maiuscula(NOME_TERCO[t.terco])}</span>
                  <span className="tabular block text-[0.74rem] text-tinta-3">{inteiro(t.municipios)} municípios · quem votou: {anos(t.idade)} anos</span>
                </span>
              </p>
              <div
                role="img"
                aria-label={`Terço ${NOME_TERCO[t.terco]}: de ${inteiro(t.passagens)} passagens, ${inteiro(t.mesmo)} no mesmo partido, ${inteiro(t.troca)} com troca de partido e ${inteiro(t.fusao)} com ressalva`}
                className={`flex h-8 overflow-hidden rounded-[5px] border border-linha ${visto ? 'revela-esquerda' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 200}ms` }}
              >
                {partes.map((p) => (
                  <span key={p.chave} className="h-full" style={{ ...p.estilo, width: `${(100 * p.valor) / Math.max(t.passagens, 1)}%` }} />
                ))}
              </div>
              <p className="justify-self-end text-right leading-tight">
                <span className="t-numero tabular block text-[1.6rem]">{pct(indice, 0)}</span>
                <span className="block text-[0.72rem] text-tinta-3">com troca</span>
              </p>
            </li>
          )
        })}
      </ol>
      <TabelaAlternavel
        titulo="Passagens de mandato de prefeito por terço de idade"
        colunas={['Terço (na UF)', 'Municípios', 'Passagens', 'Mesmo partido', 'Troca', 'Com ressalva', 'Troca (fusão = troca)', 'Troca (fusão = continuidade)', 'Outra pessoa']}
        linhas={() =>
          dados.tercos.map((t) => [
            NOME_TERCO[t.terco], inteiro(t.municipios), inteiro(t.passagens), inteiro(t.mesmo), inteiro(t.troca), inteiro(t.fusao),
            pct(t.troca_estrita), pct(t.troca_ampla), pct(t.outra_pessoa),
          ])
        }
      />
    </div>
  )
}

/** A mesma conta por porte do município, numa grade compacta (troca com fusão = troca). */
export function PorPorte({ dados }: { dados: AlternanciaIdade }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[30rem] text-[0.86rem]">
        <caption className="sr-only">Troca de partido por porte do município e terço de idade</caption>
        <thead>
          <tr className="border-b border-linha text-left text-[0.76rem] text-tinta-3">
            <th scope="col" className="py-1.5 pr-3 font-semibold">Porte (Censo 2022)</th>
            {([1, 2, 3] as const).map((k) => (
              <th key={k} scope="col" className="py-1.5 pr-3 text-right font-semibold">{maiuscula(NOME_TERCO[k])}</th>
            ))}
            <th scope="col" className="py-1.5 text-right font-semibold">Municípios</th>
          </tr>
        </thead>
        <tbody>
          {dados.portes.map((p) => (
            <tr key={p.porte} className="border-b border-linha/70">
              <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-tinta">{p.porte}</th>
              {p.tercos.map((v, k) => (
                <td key={k} className="py-1.5 pr-3 text-right text-tinta-2">{pct(v, 0)}</td>
              ))}
              <td className="py-1.5 text-right text-tinta-3">{inteiro(p.municipios)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
