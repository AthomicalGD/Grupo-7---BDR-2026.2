// "E você?": uma régua só. A pessoa arrasta (ou toca num exemplo marcado na própria régua: moto, carro, casa,
// fazenda) e vê, em letra grande ao lado, em qual grupo da fila cairia e quantos desse grupo se elegeram.
// A régua é logarítmica, como as barrinhas: cada trecho vale 10 vezes o anterior. Os exemplos são valores
// redondos de referência, não dados do TSE.
import { memo } from 'react'
import type { Patrimonio } from '../api'
import { COR, grupoDoValor, nomeFaixa, quartis, reaisFaixa, taxaCurta } from './conta'

const EXEMPLOS = [
  { nome: 'Moto', valor: 12_000 },
  { nome: 'Carro', valor: 60_000 },
  { nome: 'Casa', valor: 250_000 },
  { nome: 'Fazenda', valor: 3_000_000 },
]
const MIN = 3 // 10^3 = R$ 1 mil
const MAX = 8 // 10^8 = R$ 100 mi
const posicaoDe = (v: number) => ((Math.log10(v) - MIN) / (MAX - MIN)) * 100

export const Voce = memo(function Voce({ dados, rotulo, valor, aoMudar }: { dados: Patrimonio; rotulo: string; valor: number | null; aoMudar: (v: number | null) => void }) {
  const qs = quartis(dados.grupos)
  const g = grupoDoValor(dados, valor)
  const i = g ? qs.indexOf(g) : -1
  const media = dados.resumo.candidatos ? (100 * dados.resumo.eleitos) / dados.resumo.candidatos : 0
  const posicao = valor && valor > 0 ? Math.min(MAX, Math.max(MIN, Math.log10(valor))) : MIN
  const comparacao = g ? (g.taxa > media * 1.1 ? 'acima da média' : g.taxa < media * 0.9 ? 'abaixo da média' : 'perto da média') : ''
  const nomeGrupo = g ? (g.tipo === 'sem_bens' ? 'quem não declarou nada' : nomeFaixa(g, i, qs.length).nome.toLowerCase()) : ''

  return (
    <section aria-labelledby="voce-titulo" className="mt-28 grid items-end gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div>
        <h2 id="voce-titulo" className="t-h1">E você, em que grupo cairia?</h2>
        <p className="mt-3 text-[1rem] text-tinta-2">Quanto valem as coisas que você tem?</p>
        <div className="mt-8">
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={0.01}
            value={posicao}
            onChange={(e) => aoMudar(Math.round(10 ** Number(e.target.value) / 100) * 100)}
            aria-label="Valor dos seus bens"
            aria-valuetext={valor ? reaisFaixa(valor) : 'nenhum valor'}
            className="regua-voce w-full"
          />
          {/* os exemplos marcados na régua, no lugar do valor deles */}
          <div className="relative mt-2 h-12">
            {EXEMPLOS.map((e) => {
              const ativo = valor === e.valor
              return (
                <button
                  key={e.nome}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => aoMudar(e.valor)}
                  className={`exemplo-regua absolute flex -translate-x-1/2 flex-col items-center rounded-lg px-2 py-1 leading-tight ${ativo ? 'text-selecao-tinta' : 'text-tinta-2 hover:text-tinta'}`}
                  style={{ left: `${posicaoDe(e.valor)}%` }}
                >
                  <span className="text-[0.86rem] font-bold">{e.nome}</span>
                  <span className="tabular text-[0.75rem] text-tinta-3 max-sm:hidden">{reaisFaixa(e.valor)}</span>
                </button>
              )
            })}
          </div>
          <button type="button" aria-pressed={valor === 0} onClick={() => aoMudar(0)} className={`mt-3 text-[0.86rem] font-semibold underline-offset-4 hover:underline ${valor === 0 ? 'text-selecao-tinta underline' : 'text-acao'}`}>
            Não tenho nada a declarar
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[9.5rem]">
        {g && valor != null ? (
          <div key={g.id} className="revela">
            <p className="text-[1.05rem] text-tinta-2">
              {valor > 0 ? <>Com <b className="tabular text-tinta">{reaisFaixa(valor)}</b>, você estaria entre</> : 'Você estaria entre'}{' '}
              <b className="text-tinta">{nomeGrupo}</b>. Desses {rotulo},
            </p>
            <p className="mt-2 flex items-end gap-3">
              <span className="t-numero tabular text-[clamp(3.4rem,2.6rem+2.4vw,4.8rem)] leading-[.85]" style={{ color: COR.texto }}>{taxaCurta(g.taxa)}</span>
              <span className="pb-1 text-[1rem] font-semibold leading-snug text-tinta-2">se elegeram,<br />{comparacao} ({taxaCurta(media)})</span>
            </p>
          </div>
        ) : (
          <p className="text-[1.05rem] text-tinta-3">Arraste a régua ou toque num exemplo para ver a sua chance.</p>
        )}
      </div>
    </section>
  )
})
