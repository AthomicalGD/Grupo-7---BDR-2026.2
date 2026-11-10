// P8 x P2: para quem foi o dinheiro? Os candidatos em grupos de patrimônio declarado (os da P2: sem bens, R$ 0 e
// quartis de quem declarou bens) e a parte do dinheiro de cada eleição que cada grupo recebeu: só os fundos públicos
// (padrão) ou toda a receita. Primeiro o 1% mais rico em número grande; depois, na eleição escolhida, cada grupo com a
// parte dos candidatos (o que receberia se o dinheiro fosse igual para todos) ao lado da parte do dinheiro; por fim,
// uma barra de 100% por eleição, para ver se a concentração mudou. Conta em api/app.py (conta_patrimonio_recursos).
import { memo, useState } from 'react'
import type { EleicaoPatrimonioRecursos, GrupoPatrimonioRecursos, PatrimonioRecursos } from '../api'
import { Alternador } from '../atlas/PainelEstado'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, pct, plural, reaisCurto } from '../lib/formato'

export type Dinheiro = 'publico' | 'receita'

const NOME: Record<Dinheiro, string> = { publico: 'dos fundos públicos', receita: 'de toda a receita' }
// quartis: um azul só, do claro ao escuro (mais bens = mais escuro), em cores fixas para valer nos dois temas (a
// mistura com o fundo invertia a rampa no escuro); sem bens e R$ 0 ficam em cinza
const COR: Record<string, string> = {
  sem_bens: '#8a929b',
  zero: '#c3c8ce',
  q1: '#b4c6e8',
  q2: '#7896d2',
  q3: '#4269b9',
  q4: '#1d4fa0',
}
const ORDEM = ['sem_bens', 'zero', 'q1', 'q2', 'q3', 'q4']
const b = (t: string) => <b className="tabular font-bold text-tinta">{t}</b>
const CLARO = new Set(['sem_bens', 'zero', 'q1', 'q2'])   // fundo claro: texto escuro por cima (em qualquer tema)
const fatia = (g: { pct_publico: number | null; pct_receita: number | null }, d: Dinheiro) => (d === 'publico' ? g.pct_publico : g.pct_receita) ?? 0
const valor = (g: { publico: number; receita: number }, d: Dinheiro) => (d === 'publico' ? g.publico : g.receita)
const faixa = (g: GrupoPatrimonioRecursos) =>
  g.de == null ? 'sem registro de bens' : g.id === 'zero' ? 'R$ 0' : g.de === g.ate ? reaisCurto(g.de) : `${reaisCurto(g.de)} a ${reaisCurto(g.ate)}`
const nomeGrupo = (g: GrupoPatrimonioRecursos) => (g.id.startsWith('q') && g.rotulo.startsWith('Q') ? `${g.rotulo} de patrimônio` : g.rotulo)

/** O 1% mais rico em número grande. */
function UmPorCento({ e, dinheiro }: { e: EleicaoPatrimonioRecursos; dinheiro: Dinheiro }) {
  const u = e.um_por_cento
  if (!u) return <p className="text-tinta-2">Ninguém declarou bens acima de R$ 0 nesta eleição.</p>
  const parte = dinheiro === 'publico' ? u.pct_publico : u.pct_receita
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <p className="t-numero tabular text-[clamp(3rem,2.2rem+2.6vw,4.6rem)] leading-[.9]">{parte == null ? '-' : pct(parte, 1)}</p>
      <p className="max-w-[46ch] pb-1 text-[1rem] leading-snug text-tinta-2">
        {NOME[dinheiro]} de {e.ano} ({reaisCurto(valor(u, dinheiro))} de {reaisCurto(valor(e, dinheiro))}) ficou com{' '}
        <b className="text-tinta">{u.candidatos === 1 ? 'o candidato mais rico' : `os ${inteiro(u.candidatos)} candidatos mais ricos`}</b>, o 1% de maior
        patrimônio entre os {inteiro(e.com_bens)} que declararam bens (a partir de {reaisCurto(u.a_partir_de)}).{' '}
      </p>
      {e.com_bens < 100 && (
        <p className="w-full rounded-xl border border-escolha/50 bg-escolha-claro px-3.5 py-2 text-[0.85rem] text-tinta">
          <b>Poucos candidatos com bens ({inteiro(e.com_bens)}):</b> com menos de 100, o “1%” é só o candidato mais rico. Para um número mais sólido, veja todos os estados juntos.
        </p>
      )}
    </div>
  )
}

/** Na eleição escolhida: a parte dos candidatos e a parte do dinheiro de cada grupo, lado a lado. */
const Pares = memo(function Pares({ e, dinheiro }: { e: EleicaoPatrimonioRecursos; dinheiro: Dinheiro }) {
  const [foco, setFoco] = useState<string | null>(null)
  const teto = Math.max(1, ...e.grupos.flatMap((g) => [g.pct_candidatos ?? 0, fatia(g, dinheiro)]))
  // a maior barra ocupa ~80% da linha: sobra lugar para o número ao lado, mesmo no celular
  const larg = (v: number) => `${(80 * v) / teto}%`
  return (
    <figure className="m-0">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-tinta-2" aria-hidden>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-linha-2" /> parcela dos candidatos</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-5 rounded-[3px]" style={{ background: 'var(--azul)' }} /> parcela do dinheiro {NOME[dinheiro]}</span>
      </div>
      <ul className="mt-4 grid gap-3.5" aria-label={`Parte dos candidatos e parte do dinheiro ${NOME[dinheiro]} em ${e.ano}, por patrimônio`}>
        {e.grupos.map((g) => {
          const d = fatia(g, dinheiro)
          return (
            <li
              key={g.id}
              className={`grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-x-4 transition-opacity sm:grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)] ${foco && foco !== g.id ? 'opacity-50' : ''}`}
              onPointerEnter={() => setFoco(g.id)} onPointerLeave={() => setFoco(null)}
              aria-label={`${nomeGrupo(g)} (${faixa(g)}): ${pct(g.pct_candidatos, 1)} dos candidatos, ${pct(d, 1)} do dinheiro`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[0.9rem] font-semibold text-tinta">{nomeGrupo(g)}</span>
                <span className="block text-[0.78rem] leading-snug text-tinta-3">{faixa(g)}<br />{plural(g.candidatos, 'candidato', 'candidatos')}</span>
              </span>
              <span className="grid gap-1" aria-hidden>
                <span className="flex items-center gap-2">
                  <span className="h-2 rounded-full bg-linha-2" style={{ width: larg(g.pct_candidatos ?? 0) }} />
                  <span className="tabular text-[0.78rem] text-tinta-3">{pct(g.pct_candidatos, 1)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3.5 rounded-r-[4px]" style={{ width: larg(d), minWidth: d > 0 ? 2 : 0, background: 'var(--azul)' }} />
                  <span className="tabular text-[0.86rem] font-bold text-tinta">{pct(d, 1)}</span>
                  {foco === g.id && <span className="tabular text-[0.78rem] text-tinta-2">{reaisCurto(valor(g, dinheiro))}</span>}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
})

/** Uma barra de 100% por eleição, dividida entre os grupos de patrimônio. */
const PorEleicao = memo(function PorEleicao({ eleicoes, ano, dinheiro }: { eleicoes: EleicaoPatrimonioRecursos[]; ano: number; dinheiro: Dinheiro }) {
  const ids = [...new Set(eleicoes.flatMap((e) => e.grupos.map((g) => g.id)))].sort((x, y) => ORDEM.indexOf(x) - ORDEM.indexOf(y))
  const rotulos = Object.fromEntries(eleicoes.flatMap((e) => e.grupos.map((g) => [g.id, nomeGrupo(g)])))
  return (
    <figure className="m-0">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8rem] text-tinta-2">
        {ids.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px]" style={{ background: COR[id] ?? COR.q4 }} />
            {rotulos[id]}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {eleicoes.map((e) => (
          <div key={e.ano} className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-center gap-3">
            <span className={`tabular text-[0.95rem] ${e.ano === ano ? 'font-bold text-tinta' : 'text-tinta-2'}`}>{e.ano}</span>
            {valor(e, dinheiro) > 0 ? (
              <div
                role="img"
                aria-label={`${e.ano}: ${e.grupos.map((g) => `${nomeGrupo(g)} ${pct(fatia(g, dinheiro), 0)}`).join(', ')}`}
                className={`flex h-10 overflow-hidden rounded-[8px] ${e.ano === ano ? 'ring-2 ring-tinta ring-offset-2 ring-offset-papel' : ''}`}
              >
                {e.grupos.map((g) => {
                  const d = fatia(g, dinheiro)
                  return d > 0 ? (
                    <div
                      key={g.id}
                      title={`${nomeGrupo(g)}: ${pct(d, 1)} (${reaisCurto(valor(g, dinheiro))})`}
                      className="grid h-full place-items-center border-r-2 border-folha text-[0.78rem] font-bold last:border-r-0"
                      style={{ width: `${d}%`, background: COR[g.id] ?? COR.q4, color: CLARO.has(g.id) ? '#121417' : '#fff' }}
                    >
                      {d >= 7 && <span className="tabular">{pct(d, 0)}</span>}
                    </div>
                  ) : null
                })}
              </div>
            ) : (
              <p className="text-[0.88rem] text-tinta-3">Nenhum dinheiro {dinheiro === 'publico' ? 'dos fundos' : 'declarado'} nesta eleição.</p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[0.8rem] text-tinta-3">
        1% mais rico: {eleicoes.map((e) => `${e.ano}, ${e.um_por_cento ? pct(dinheiro === 'publico' ? e.um_por_cento.pct_publico : e.um_por_cento.pct_receita, 1) : '-'}`).join('; ')}.
        Valores da época; os quartis são refeitos em cada eleição.
      </p>
    </figure>
  )
})

export function PatrimonioRecursosSecao({ dados, dinheiro, aoDinheiro }: { dados: PatrimonioRecursos; dinheiro: Dinheiro; aoDinheiro: (d: Dinheiro) => void }) {
  const e = dados.eleicoes.find((x) => x.ano === dados.ano)
  if (!e || !e.candidatos) return <p className="mt-6 text-tinta-2">Nenhum candidato nesta seleção.</p>
  const q4 = e.grupos.find((g) => g.id === 'q4')
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Alternador
          rotulo="Dinheiro repartido"
          valor={dinheiro}
          aoMudar={aoDinheiro}
          opcoes={[{ valor: 'publico', rotulo: 'Fundos públicos' }, { valor: 'receita', rotulo: 'Toda a receita' }]}
        />
        {q4 && (
          <p className="max-w-[52ch] text-[0.92rem] text-tinta-2">
            O quarto mais rico de quem declarou bens ({pct(q4.pct_candidatos, 0)} dos candidatos) ficou com {b(pct(fatia(q4, dinheiro), 0))} do dinheiro {NOME[dinheiro]}.
          </p>
        )}
      </div>
      <div className="mt-8">
        <UmPorCento e={e} dinheiro={dinheiro} />
      </div>
      <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <h3 className="t-h3">Em {e.ano}</h3>
          <Pares key={`${e.ano}-${dinheiro}`} e={e} dinheiro={dinheiro} />
        </div>
        <div>
          <h3 className="t-h3">Em cada eleição</h3>
          <p className="mb-4 mt-1 text-[0.9rem] text-tinta-2">Todo o dinheiro {NOME[dinheiro]} de cada eleição, repartido entre os grupos.</p>
          <PorEleicao eleicoes={dados.eleicoes} ano={dados.ano} dinheiro={dinheiro} />
        </div>
      </div>
      <TabelaAlternavel sql="p8Patrimonio"
        titulo={`Dinheiro por grupo de patrimônio: ${dados.cargo.nome.toLowerCase()}`}
        colunas={['Eleição', 'Grupo', 'Patrimônio', 'Candidatos', '% dos candidatos', 'Fundos públicos', '% dos fundos', 'Receita', '% da receita']}
        linhas={() => dados.eleicoes.flatMap((x) => [
          ...x.grupos.map((g) => [String(x.ano), nomeGrupo(g), faixa(g), inteiro(g.candidatos), pct(g.pct_candidatos, 1), reaisCurto(g.publico), pct(g.pct_publico, 1), reaisCurto(g.receita), pct(g.pct_receita, 1)]),
          ...(x.um_por_cento ? [[String(x.ano), '1% mais rico', `a partir de ${reaisCurto(x.um_por_cento.a_partir_de)}`, inteiro(x.um_por_cento.candidatos), pct(x.um_por_cento.pct_candidatos, 1), reaisCurto(x.um_por_cento.publico), pct(x.um_por_cento.pct_publico, 1), reaisCurto(x.um_por_cento.receita), pct(x.um_por_cento.pct_receita, 1)]] : []),
        ])}
      />
    </>
  )
}
