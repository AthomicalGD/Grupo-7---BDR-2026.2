// De onde vem o viés de um estado (P7): cada voto válido (nominal ou de legenda, todos os cargos do
// 1º turno, ou só o cargo do filtro) vale o viés do partido. A balança mostra quanto cada partido puxa
// para a esquerda ou para a direita; a soma dá o viés do mapa. Cada partido abre os candidatos mais
// votados no estado; no pé da lista, "Mostrar mais" e, quando o partido tem mais gente, a busca pelo nome (#11).
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import { consultas, type CargoVies, type ComposicaoVies as Dados } from '../api'
import { Ciranda } from '../componentes/Ciranda'
import { Retrato } from '../componentes/Retrato'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargo as fmtCargo, decimal, inteiro, nomeProprio, pct, vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'

const VISIVEIS = 8
const PAGINA = 6

/** A busca espera a pessoa parar de digitar (250 ms) antes de perguntar à API. */
function useAtrasado(valor: string, ms = 250) {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return atrasado
}

/** Balança: os partidos que puxam para a esquerda empilhados à esquerda do zero, os da direita à
 *  direita; o traço escuro é o resultado (a soma). */
function Balanca({ d }: { d: Dados }) {
  const esq = d.partidos.filter((p) => p.contribuicao < 0).sort((a, b) => a.contribuicao - b.contribuicao)
  const dir = d.partidos.filter((p) => p.contribuicao > 0).sort((a, b) => b.contribuicao - a.contribuicao)
  const somaE = -esq.reduce((s, p) => s + p.contribuicao, 0), somaD = dir.reduce((s, p) => s + p.contribuicao, 0)
  const lado = Math.max(somaE, somaD, 1) * 1.08
  const x = (v: number) => 50 + (v / lado) * 50 // % da largura, 0 no meio
  const trecho = (lista: typeof esq, sinal: -1 | 1) => {
    let acc = 0
    return lista.map((p) => {
      const a = acc
      acc += Math.abs(p.contribuicao)
      const x0 = x(sinal * a), x1 = x(sinal * acc)
      return (
        <div
          key={p.sigla}
          className="absolute inset-y-0 border-folha first:border-0"
          style={{ left: `${Math.min(x0, x1)}%`, width: `${Math.abs(x1 - x0)}%`, background: corVies(p.vies), borderLeftWidth: sinal > 0 ? 1 : 0, borderRightWidth: sinal < 0 ? 1 : 0 }}
          title={`${p.sigla}: ${fmtVies(p.contribuicao)}`}
        />
      )
    })
  }
  return (
    <figure className="m-0">
      <div className="relative h-7 overflow-hidden rounded-md bg-papel-2" role="img" aria-label={`Partidos que puxam para a esquerda somam ${decimal(-somaE)}, para a direita ${decimal(somaD)}; o viés é ${fmtVies(d.vies)}`}>
        {trecho(esq, -1)}
        {trecho(dir, 1)}
        <div className="absolute inset-y-0 left-1/2 w-px bg-tinta/40" aria-hidden />
      </div>
      {d.vies != null && (
        <div className="relative h-7" aria-hidden>
          <div className="absolute top-0 h-2.5 w-[3px] -translate-x-1/2 rounded-b bg-tinta" style={{ left: `${x(d.vies)}%` }} />
          <p className="tabular absolute top-2.5 -translate-x-1/2 whitespace-nowrap text-[0.78rem] font-bold" style={{ left: `${Math.min(88, Math.max(12, x(d.vies)))}%` }}>
            = {fmtVies(d.vies)}
          </p>
        </div>
      )}
      <figcaption className="flex justify-between text-[0.74rem] text-tinta-3">
        <span>puxam para a esquerda: <b className="tabular text-tinta-2">{fmtVies(-somaE)}</b></span>
        <span>para a direita: <b className="tabular text-tinta-2">{fmtVies(somaD)}</b></span>
      </figcaption>
    </figure>
  )
}

type Candidato = Dados['partidos'][number]['candidatos'][number]

function LinhaCandidato({ c }: { c: Candidato }) {
  return (
    <li>
      <Link to="/politico/$id" params={{ id: String(c.id) }} className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-papel">
        <Retrato foto={c.foto} nome={c.nome} tamanho={30} className="!rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.84rem] font-semibold">{nomeProprio(c.nome)}</span>
          <span className="block truncate text-[0.74rem] text-tinta-3">
            {fmtCargo(c.cargo)}{c.local ? ` · ${c.local}` : ''}{c.eleito ? ' · eleito' : ''}
          </span>
        </span>
        <span className="tabular text-right text-[0.8rem] text-tinta-2">{inteiro(c.votos)}</span>
      </Link>
    </li>
  )
}

/** Os candidatos do partido aberto: os 6 que já vieram com a composição e, sob demanda, mais e a busca.
 * A lista e os controles ficam dentro do partido; fechado, nada disso aparece. */
function CandidatosDoPartido({ p, sigla, ano, cargo }: { p: Dados['partidos'][number]; sigla: string; ano: number; cargo?: number }) {
  const [limite, setLimite] = useState(PAGINA)
  const [texto, setTexto] = useState('')
  const q = useAtrasado(texto.trim())
  const extra = limite > PAGINA || q.length >= 2
  const busca = useQuery({
    ...consultas.candidatosPartido(sigla, p.sigla, ano, cargo, q.length >= 2 ? q : '', limite),
    enabled: extra,
    placeholderData: keepPreviousData,
  })
  const lista = extra && busca.data ? busca.data.candidatos : p.candidatos
  const achados = extra && busca.data ? busca.data.achados : p.candidatos_total
  const faltam = Math.max(0, achados - lista.length)
  const procurando = q.length >= 2
  const comBusca = p.candidatos_total > PAGINA

  return (
    <div className="pb-3 pl-7 pr-1.5">
      {comBusca && (
        <label className="busca-partido relative mb-1.5 flex items-center">
          <MagnifyingGlass size={14} weight="bold" aria-hidden className="pointer-events-none absolute left-2.5 text-tinta-3" />
          <span className="sr-only">Procurar candidato do {p.sigla}</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setLimite(PAGINA) }}
            placeholder={`Procurar entre os ${inteiro(p.candidatos_total)} do ${p.sigla}`}
            className="h-9 w-full rounded-full border border-linha bg-folha pl-8 pr-3 text-[0.82rem] outline-none transition-colors placeholder:text-tinta-3 focus:border-tinta"
          />
        </label>
      )}
      <ul className={`grid gap-1 transition-opacity ${busca.isPlaceholderData ? 'opacity-60' : ''}`} aria-live="polite">
        {lista.map((c) => <LinhaCandidato key={`${c.id}-${c.cargo}`} c={c} />)}
      </ul>
      {procurando && !busca.isFetching && achados === 0 && (
        <p className="px-1 py-1.5 text-[0.8rem] text-tinta-3">Ninguém do {p.sigla} com “{q}” no nome em {ano}.</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {faltam > 0 ? (
          <button
            type="button"
            onClick={() => setLimite((l) => l + PAGINA)}
            disabled={busca.isFetching}
            className="rounded-md px-1 py-1 text-[0.8rem] font-semibold text-acao hover:bg-papel disabled:opacity-60"
          >
            Mostrar mais {Math.min(PAGINA, faltam)} <span className="font-normal text-tinta-3">· faltam {inteiro(faltam)}</span>
          </button>
        ) : <span />}
        <span className="text-[0.74rem] text-tinta-3">Nominais {inteiro(p.nominais)} · legenda {inteiro(p.legenda)}</span>
      </div>
    </div>
  )
}

function Partido({ p, sigla, ano, cargo }: { p: Dados['partidos'][number]; sigla: string; ano: number; cargo?: number }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  return (
    <li className="border-t border-linha first:border-0">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        aria-label={`${p.sigla}: ${pct(p.pct)} dos votos válidos, viés ${fmtVies(p.vies)}, puxa ${fmtVies(p.contribuicao)}. ${aberto ? 'Fechar' : 'Ver'} os candidatos`}
        className="grid w-full grid-cols-[minmax(0,1fr)_3.6rem_3.6rem_3.6rem_1rem] items-center gap-2 rounded-lg px-1.5 py-2 text-left text-[0.86rem] hover:bg-papel"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-3.5 shrink-0 rounded-[4px] border border-tinta/25" style={{ background: corVies(p.vies) }} aria-hidden />
          <span className="truncate font-bold">{p.sigla}</span>
        </span>
        <span className="tabular text-right">{pct(p.pct)}</span>
        <span className="tabular text-right text-tinta-2">{fmtVies(p.vies)}</span>
        <span className="tabular text-right font-bold">{fmtVies(p.contribuicao)}</span>
        <CaretDown size={13} weight="bold" aria-hidden className={`text-tinta-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div id={id} className="abre-partido">
          <CandidatosDoPartido p={p} sigla={sigla} ano={ano} cargo={cargo} />
        </div>
      )}
    </li>
  )
}

export function ComposicaoVies({ sigla, nome, ano, cargo }: { sigla: string; nome: string; ano: number; cargo?: CargoVies }) {
  const { data: d, isLoading, error } = useQuery(consultas.composicao(sigla, ano, cargo?.cod))
  const [todos, setTodos] = useState(false)
  if (error) return <p className="text-[0.86rem] text-tinta-2">Não foi possível abrir a composição do viés.</p>
  if (isLoading || !d) return <div className="grid place-items-center py-6"><Ciranda rotulo="Somando os votos..." tamanho={72} /></div>
  const lista = todos ? d.partidos : d.partidos.slice(0, VISIVEIS)
  return (
    <div className="space-y-4">
      <p className="text-[0.88rem] leading-relaxed text-tinta-2">
        {cargo ? (
          <>Em {ano}, {nome} teve {inteiro(d.votos)} votos válidos para {cargo.nome.toLowerCase()}. </>
        ) : (
          <>Em {ano}, {nome} teve {inteiro(d.votos)} votos válidos somando todos os cargos do 1º turno (cada eleitor vota uma vez por
          cargo). </>
        )}
        Cada voto vale o viés do partido; o partido puxa a média pelo tanto de votos que teve.
      </p>
      <Balanca d={d} />
      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_3.6rem_3.6rem_3.6rem_1rem] gap-2 px-1.5 pb-1 text-[0.72rem] font-semibold text-tinta-3" aria-hidden>
          <span>Partido</span>
          <span className="text-right">% votos</span>
          <span className="text-right">Viés</span>
          <span className="text-right">Puxa</span>
          <span />
        </div>
        <ul>{lista.map((p) => <Partido key={p.sigla} p={p} sigla={sigla} ano={ano} cargo={cargo?.cod} />)}</ul>
        {d.partidos.length > VISIVEIS && (
          <button type="button" onClick={() => setTodos((t) => !t)} className="mt-1 rounded-md px-1.5 py-1 text-[0.82rem] font-semibold text-acao hover:bg-papel">
            {todos ? 'Mostrar só os maiores' : `Ver todos os ${d.partidos.length} partidos`}
          </button>
        )}
      </div>
      <TabelaAlternavel
        titulo={`Partidos e o viés de ${nome} em ${ano}`}
        colunas={['Partido', 'Votos válidos', '% dos votos', 'Viés', 'Puxa a média']}
        linhas={() => d.partidos.map((p) => [p.sigla, inteiro(p.votos), pct(p.pct), fmtVies(p.vies), fmtVies(p.contribuicao)])}
      />
    </div>
  )
}
