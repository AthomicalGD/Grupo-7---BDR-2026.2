// "E você?": a pessoa escolhe quanto valem as coisas que tem (exemplos ou a régua) e vê em qual grupo da fila
// cairia e quantos desse grupo se elegeram. A régua é logarítmica, como as barrinhas: cada trecho vale 10 vezes
// o anterior. Os exemplos são valores redondos de referência, não dados do TSE.
import { memo } from 'react'
import type { Patrimonio } from '../api'
import { grupoDoValor, nomeFaixa, quartis, reaisFaixa, taxaCurta } from './conta'

const EXEMPLOS = [
  { nome: 'Nada a declarar', valor: 0 },
  { nome: 'Uma moto', valor: 12_000 },
  { nome: 'Um carro popular', valor: 60_000 },
  { nome: 'Uma casa simples', valor: 200_000 },
  { nome: 'Casa e carro', valor: 450_000 },
  { nome: 'Uma fazenda', valor: 3_000_000 },
]
const MIN = 3 // 10^3 = R$ 1 mil
const MAX = 8 // 10^8 = R$ 100 mi

export const Voce = memo(function Voce({ dados, rotulo, valor, aoMudar }: { dados: Patrimonio; rotulo: string; valor: number | null; aoMudar: (v: number | null) => void }) {
  const qs = quartis(dados.grupos)
  const g = grupoDoValor(dados, valor)
  const i = g ? qs.indexOf(g) : -1
  const media = dados.resumo.candidatos ? (100 * dados.resumo.eleitos) / dados.resumo.candidatos : 0
  const posicao = valor && valor > 0 ? Math.min(MAX, Math.max(MIN, Math.log10(valor))) : MIN
  const comparacao = g ? (g.taxa > media * 1.1 ? 'acima da média' : g.taxa < media * 0.9 ? 'abaixo da média' : 'perto da média') : ''
  return (
    <section aria-labelledby="voce-titulo" className="mt-8 rounded-[20px] border border-linha bg-folha p-5 sm:p-6">
      <h3 id="voce-titulo" className="t-h2">E você, em que grupo cairia?</h3>
      <p className="mt-1 max-w-[62ch] text-[0.95rem] text-tinta-2">
        Escolha quanto valem as coisas que você tem e veja onde você entraria na fila dos {rotulo}.
      </p>
      <div role="radiogroup" aria-label="Exemplos de patrimônio" className="mt-4 flex flex-wrap gap-2">
        {EXEMPLOS.map((e) => {
          const ativo = valor === e.valor
          return (
            <button
              key={e.nome}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => aoMudar(e.valor)}
              className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[0.88rem] font-semibold transition-[background-color,color,transform] active:scale-[0.97] ${
                ativo ? 'selecionado-fita' : 'border-linha bg-papel text-tinta-2 hover:border-linha-2 hover:text-tinta'
              }`}
            >
              {e.nome}
              <span className={`tabular text-[0.78rem] font-medium ${ativo ? 'text-white' : 'text-tinta-3'}`}>{e.valor ? reaisFaixa(e.valor) : 'R$ 0'}</span>
            </button>
          )
        })}
      </div>
      <label className="mt-5 block max-w-[640px]">
        <span className="t-rotulo text-tinta-2">Ou arraste: {valor != null && valor > 0 ? <b className="tabular text-tinta">{reaisFaixa(valor)}</b> : 'de R$ 1 mil a R$ 100 mi'}</span>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.01}
          value={posicao}
          onChange={(e) => aoMudar(Math.round(10 ** Number(e.target.value) / 100) * 100)}
          aria-valuetext={valor ? reaisFaixa(valor) : 'nenhum valor'}
          className="regua-voce mt-2 w-full"
        />
        <span aria-hidden className="tabular mt-1 flex justify-between text-[0.75rem] text-tinta-3">
          <span>R$ 1 mil</span><span>R$ 10 mil</span><span>R$ 100 mil</span><span>R$ 1 mi</span><span>R$ 10 mi</span><span>R$ 100 mi</span>
        </span>
      </label>
      <p className="mt-5 min-h-[3.2em] max-w-[64ch] text-[1.05rem] leading-relaxed text-tinta-2" aria-live="polite">
        {!g || valor == null ? (
          'Escolha um exemplo para ver o resultado.'
        ) : g.tipo === 'sem_bens' ? (
          <>
            Quem não declara nenhum bem fica fora da fila. Entre os {rotulo} nessa situação, <b className="tabular text-tinta">{taxaCurta(g.taxa)}</b> se elegeram,{' '}
            {comparacao} ({taxaCurta(media)}).
          </>
        ) : (
          <>
            Com <b className="tabular text-tinta">{reaisFaixa(valor)}</b> você estaria entre <b className="text-tinta">{nomeFaixa(g, i, qs.length).nome.toLowerCase()}</b>.
            Nesse grupo, <b className="tabular text-tinta">{taxaCurta(g.taxa)}</b> se elegeram, {comparacao} ({taxaCurta(media)}).
          </>
        )}
      </p>
    </section>
  )
})
