// Dois políticos lado a lado: os números da carreira com a diferença entre eles e as duas linhas do tempo no
// mesmo eixo (1994 a 2024). Os dois ficam no endereço (?a=&b=), então o link compartilhado abre a mesma comparação.
import { ArrowLeft, ArrowsLeftRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useId, useMemo, useState } from 'react'
import { consultas, type Candidatura, type Politico } from '../api'
import { ErroCarga } from '../componentes/ErroCarga'
import { Retrato } from '../componentes/Retrato'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, nomeProprio, reaisCurto } from '../lib/formato'
import { corVies } from '../lib/vies'

const ULTIMO = 2024

interface Medida {
  rotulo: string
  valor: (p: Politico) => number | null
  fmt: (n: number) => string
  /** quando mais não é "melhor" nem "pior", a diferença só diz quem tem mais */
}

const soma = (cs: Candidatura[], f: (c: Candidatura) => number | null) => {
  const vs = cs.map(f).filter((v): v is number => v != null)
  return vs.length ? vs.reduce((a, b) => a + b, 0) : null
}

const MEDIDAS: Medida[] = [
  { rotulo: 'Eleições disputadas', valor: (p) => p.resumo.candidaturas, fmt: inteiro },
  { rotulo: 'Vitórias', valor: (p) => p.resumo.vitorias, fmt: inteiro },
  { rotulo: 'Derrotas', valor: (p) => p.resumo.derrotas, fmt: inteiro },
  { rotulo: 'Reeleições', valor: (p) => p.resumo.reeleicoes, fmt: inteiro },
  { rotulo: 'Anos de carreira', valor: (p) => (p.resumo.primeiro_ano && p.resumo.ultimo_ano ? p.resumo.ultimo_ano - p.resumo.primeiro_ano : null), fmt: inteiro },
  { rotulo: 'Gasto declarado (desde 2018)', valor: (p) => soma(p.candidaturas, (c) => c.gasto), fmt: (n) => reaisCurto(n) },
  { rotulo: 'Votos somados', valor: (p) => soma(p.candidaturas, (c) => c.votos), fmt: inteiro },
]

function Escolher({ lado, aoEscolher }: { lado: 'a' | 'b'; aoEscolher: (id: number) => void }) {
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const id = useId()
  useEffect(() => {
    const t = setTimeout(() => setQ(texto), 250)
    return () => clearTimeout(t)
  }, [texto])
  const r = useQuery(consultas.buscaPoliticos(q, {}, 6))
  return (
    <div className="rounded-2xl border border-dashed border-linha-2 bg-folha p-4">
      <label htmlFor={id} className="t-rotulo text-tinta-2">{lado === 'a' ? 'Primeiro político' : 'Comparar com'}</label>
      <div className="relative mt-2">
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3" aria-hidden />
        <input
          id={id}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite um nome (3 letras ou mais)"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-linha bg-folha pl-9 pr-3 text-[0.95rem] outline-none focus:border-tinta"
        />
      </div>
      {q.trim().length >= 3 && (
        <ul className="mt-2 divide-y divide-linha" aria-live="polite">
          {r.isLoading && <li className="py-2 text-[0.88rem] text-tinta-3">Procurando...</li>}
          {r.data?.length === 0 && <li className="py-2 text-[0.88rem] text-tinta-3">Ninguém com esse nome.</li>}
          {r.data?.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => aoEscolher(p.id)} className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-papel">
                <Retrato foto={p.foto} nome={p.nome} tamanho={32} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{nomeProprio(p.nome)}</span>
                  <span className="block text-[0.8rem] text-tinta-3">
                    {p.ufs.join(', ') || 'Brasil'} · {p.primeiro_ano}–{p.ultimo_ano} · {inteiro(p.vitorias)} de {inteiro(p.candidaturas)} vitórias
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Cabeca({ p, aoTirar }: { p: Politico; aoTirar: () => void }) {
  return (
    <div className="flex items-start gap-4">
      <Retrato foto={p.foto} nome={p.nome} tamanho={72} />
      <div className="min-w-0 flex-1">
        <Link to="/politico/$id" params={{ id: String(p.id) }} className="t-h2 block leading-tight hover:underline">{nomeProprio(p.nome)}</Link>
        <p className="mt-1 text-[0.9rem] text-tinta-3">
          {p.nascimento_ano ? `Nasceu em ${p.nascimento_ano} · ` : ''}{p.ufs.join(', ') || 'Brasil'}
        </p>
      </div>
      <button type="button" onClick={aoTirar} aria-label={`Trocar ${nomeProprio(p.nome)}`} className="grid size-9 shrink-0 place-items-center rounded-full text-tinta-3 hover:bg-papel-2 hover:text-tinta">
        <X size={16} weight="bold" aria-hidden />
      </button>
    </div>
  )
}

/** As duas carreiras no mesmo eixo de anos: um ponto por eleição (cheio quando venceu), na cor do partido. */
function LinhasDoTempo({ a, b }: { a: Politico; b: Politico }) {
  const W = 960, H = 150, E = 120, D = 16
  // o eixo começa pouco antes da primeira eleição dos dois (antes de 2018 o banco pode não ter a carreira toda)
  const anos = [a, b].flatMap((p) => p.candidaturas.map((c) => c.ano))
  const PRIMEIRO = Math.max(1994, Math.min(ULTIMO - 8, Math.min(...anos) - 2) - ((Math.min(ULTIMO - 8, Math.min(...anos) - 2)) % 2))
  const x = (ano: number) => E + ((ano - PRIMEIRO) / (ULTIMO - PRIMEIRO)) * (W - E - D)
  const [foco, setFoco] = useState<{ c: Candidatura; x: number; y: number } | null>(null)
  const linhas = [a, b]
  return (
    <figure className="m-0">
      <div className="relative -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[620px]" role="img" aria-label={`Linhas do tempo de ${nomeProprio(a.nome)} e ${nomeProprio(b.nome)}, de ${PRIMEIRO} a ${ULTIMO}`} onPointerLeave={() => setFoco(null)}>
          {Array.from({ length: (ULTIMO - PRIMEIRO) / 2 + 1 }, (_, i) => PRIMEIRO + i * 2).map((ano) => (
            <g key={ano}>
              <line x1={x(ano)} x2={x(ano)} y1={18} y2={H - 26} stroke="var(--color-linha)" />
              {(ULTIMO - ano) % 4 === 0 && <text x={x(ano)} y={H - 8} textAnchor="middle" className="tabular fill-tinta-3 text-[12px]">{ano}</text>}
            </g>
          ))}
          {linhas.map((p, i) => {
            const y = 42 + i * 56
            const cs = [...p.candidaturas].filter((c) => !c.suplementar).sort((m, n) => m.ano - n.ano)
            return (
              <g key={p.id}>
                <text x={E - 14} y={y + 5} textAnchor="end" className="fill-tinta text-[14px] font-bold">{nomeProprio(p.nome).split(' ')[0]}</text>
                {cs.length > 1 && <polyline points={cs.map((c) => `${x(c.ano)},${y}`).join(' ')} fill="none" stroke="var(--color-linha-2)" strokeWidth={2} />}
                {cs.map((c) => {
                  const cor = corVies(c.vies)
                  return (
                    <circle
                      key={c.id_candidatura}
                      cx={x(c.ano)} cy={y} r={c.eleito ? 10 : 8}
                      fill={c.eleito ? cor : 'var(--color-folha)'} stroke={cor} strokeWidth={c.eleito ? 0 : 3}
                      tabIndex={0}
                      aria-label={`${c.ano}: ${c.cargo}, ${c.partido ?? 'sem partido'}, ${c.eleito ? 'eleito' : 'não eleito'}`}
                      onPointerEnter={() => setFoco({ c, x: x(c.ano), y })}
                      onFocus={() => setFoco({ c, x: x(c.ano), y })}
                      onBlur={() => setFoco(null)}
                      className="cursor-default outline-none focus-visible:stroke-tinta"
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
        {foco && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-linha bg-folha px-2.5 py-2 text-[0.82rem] shadow-[var(--shadow-cartao)]"
            style={{ left: `${(foco.x / W) * 100}%`, top: `${((foco.y + 16) / H) * 100}%`, transform: foco.x > W * 0.6 ? 'translateX(-100%)' : undefined }}
          >
            <p className="font-bold">{foco.c.ano} · {foco.c.cargo}</p>
            <p className="text-tinta-2">{[foco.c.partido, foco.c.local].filter(Boolean).join(' · ')}</p>
            <p className="text-tinta-2">{foco.c.situacao}{foco.c.votos != null ? ` · ${inteiro(foco.c.votos)} votos` : ''}</p>
          </div>
        )}
      </div>
      <figcaption className="mt-2 text-[0.82rem] text-tinta-3">Ponto cheio: venceu. Vazado: perdeu. A cor é o viés do partido naquela eleição.</figcaption>
    </figure>
  )
}

function Diferenca({ a, b, m }: { a: Politico; b: Politico; m: Medida }) {
  const va = m.valor(a), vb = m.valor(b)
  const maior = va != null && vb != null && va !== vb ? (va > vb ? 'a' : 'b') : null
  const celula = (v: number | null, lado: 'a' | 'b') => (
    <td className={`py-2.5 text-right tabular ${maior === lado ? 'font-bold text-tinta' : 'text-tinta-2'}`}>
      {v == null ? '-' : m.fmt(v)}
    </td>
  )
  return (
    <tr className="border-t border-linha">
      {celula(va, 'a')}
      <th scope="row" className="px-4 py-2.5 text-center text-[0.86rem] font-semibold text-tinta-3">
        <span className="inline-flex items-center gap-1.5">
          {maior === 'a' && <ArrowLeft size={13} weight="bold" className="text-acao" aria-hidden />}
          {m.rotulo}
          {maior === 'b' && <ArrowLeft size={13} weight="bold" className="rotate-180 text-acao" aria-hidden />}
        </span>
        {maior && <span className="sr-only"> (maior: {maior === 'a' ? nomeProprio(a.nome) : nomeProprio(b.nome)})</span>}
      </th>
      {celula(vb, 'b')}
    </tr>
  )
}

export function CompararPagina() {
  const busca = useSearch({ from: '/comparar' })
  const navegar = useNavigate({ from: '/comparar' })
  const mudar = (s: { a?: number; b?: number }) => navegar({ search: (x) => ({ ...x, ...s }), replace: true, resetScroll: false })
  const qa = useQuery({ ...consultas.politico(busca.a ?? 0), enabled: !!busca.a })
  const qb = useQuery({ ...consultas.politico(busca.b ?? 0), enabled: !!busca.b })
  const a = qa.data, b = qb.data

  useEffect(() => {
    document.title = a && b ? `${nomeProprio(a.nome)} × ${nomeProprio(b.nome)} · Voto Aberto` : 'Comparar dois políticos · Voto Aberto'
  }, [a, b])

  const linhas = useMemo(
    () => () =>
      [a, b].flatMap((p) => (p ? p.candidaturas.map((c) => [nomeProprio(p.nome), String(c.ano), c.cargo, c.partido ?? '-', c.local, c.situacao, c.votos == null ? '-' : inteiro(c.votos), c.gasto == null ? '-' : reaisCurto(c.gasto)]) : [])),
    [a, b],
  )

  const lado = (q: typeof qa, p: Politico | undefined, l: 'a' | 'b') =>
    !busca[l] ? (
      <Escolher lado={l} aoEscolher={(id) => mudar({ [l]: id })} />
    ) : q.error ? (
      <ErroCarga erro={q.error} compacto aoTentar={q.refetch} />
    ) : p ? (
      <Cabeca p={p} aoTirar={() => mudar({ [l]: undefined })} />
    ) : (
      <div className="h-[90px] animate-pulse rounded-2xl bg-papel-2" aria-label="Carregando" />
    )

  return (
    <div className="mx-auto max-w-[var(--miolo-max)] px-4 pb-20 pt-8 md:px-[var(--casca-margem)] md:pt-12">
      <h1 className="t-display">Comparar dois políticos</h1>
      <p className="mt-3 max-w-[56ch] text-[1.05rem] text-tinta-2">Os números da carreira lado a lado, com as duas linhas do tempo no mesmo eixo.</p>

      <div className="mt-8 grid items-start gap-5 md:grid-cols-[1fr_auto_1fr]">
        {lado(qa, a, 'a')}
        <button
          type="button"
          onClick={() => mudar({ a: busca.b, b: busca.a })}
          disabled={!busca.a && !busca.b}
          aria-label="Trocar os dois de lado"
          className="mx-auto grid size-11 place-items-center rounded-full border border-linha bg-folha text-tinta-2 hover:border-tinta hover:text-tinta disabled:opacity-40 md:mt-6"
        >
          <ArrowsLeftRight size={18} weight="bold" aria-hidden />
        </button>
        {lado(qb, b, 'b')}
      </div>

      {a && b && (
        <>
          <section aria-labelledby="numeros" className="mt-12">
            <h2 id="numeros" className="t-h2">Os números</h2>
            <table className="mt-4 w-full max-w-[720px] text-[1rem]">
              <caption className="sr-only">Carreira de {nomeProprio(a.nome)} e de {nomeProprio(b.nome)}</caption>
              <thead>
                <tr className="text-[0.86rem] text-tinta-3">
                  <th scope="col" className="pb-2 text-right font-semibold">{nomeProprio(a.nome).split(' ')[0]}</th>
                  <th scope="col" className="pb-2"><span className="sr-only">Medida</span></th>
                  <th scope="col" className="pb-2 text-right font-semibold">{nomeProprio(b.nome).split(' ')[0]}</th>
                </tr>
              </thead>
              <tbody>
                {MEDIDAS.map((m) => <Diferenca key={m.rotulo} a={a} b={b} m={m} />)}
              </tbody>
            </table>
            <p className="mt-2 text-[0.82rem] text-tinta-3">A seta aponta para quem tem mais. Gasto só existe a partir de 2018.</p>
          </section>

          <section aria-labelledby="tempo" className="mt-12">
            <h2 id="tempo" className="t-h2">As duas carreiras no tempo</h2>
            <div className="mt-4">
              <LinhasDoTempo a={a} b={b} />
            </div>
            <TabelaAlternavel
              sql="p10Carreira"
              titulo={`Candidaturas de ${nomeProprio(a.nome)} e ${nomeProprio(b.nome)}`}
              colunas={['Político', 'Ano', 'Cargo', 'Partido', 'Onde', 'Resultado', 'Votos', 'Gasto']}
              linhas={linhas}
            />
          </section>
        </>
      )}
      {(!a || !b) && (
        <p className="mt-10 text-[0.92rem] text-tinta-3">
          Escolha os dois para ver a comparação. Também dá para começar da ficha de um político, em "Comparar com outro".{' '}
          <Link to="/urna" className="font-semibold text-acao hover:underline">Procurar na urna</Link>
        </p>
      )}
    </div>
  )
}
