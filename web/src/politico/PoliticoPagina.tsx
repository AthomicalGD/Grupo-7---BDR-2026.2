// Ficha da carreira (P10): retrato 3x4 com o carimbo da situação atual, a fita da carreira (uma
// casa por eleição, preenchida quando venceu), a resposta em texto, a trajetória por cargo com a
// faixa dos partidos, as campanhas com custo (P1) e para onde foi o dinheiro (P9), e os santinhos.
import { ArrowLeft, ArrowRight, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { consultas, type Candidatura, type Politico } from '../api'
import { Atrasado, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Retrato } from '../componentes/Retrato'
import { Trajetoria } from '../graficos/Trajetoria'
import { duracaoMandato, situacao } from '../lib/carreira'
import { cargo as fmtCargo, cargoPlural, inteiro, nomeProprio, plural } from '../lib/formato'
import { GastosCampanha } from '../gastos/GastosCampanha'
import { Santinho } from './Santinho'

const ANO_ATUAL = 2026
// cargo do contexto da reeleição (nome do TSE) -> código, para abrir a página da P10a nele
const COD_CARGO_P10: Record<string, number> = { GOVERNADOR: 3, SENADOR: 5, 'DEPUTADO FEDERAL': 6, 'DEPUTADO ESTADUAL': 7, PREFEITO: 11, VEREADOR: 13 }
const idSantinho = (c: Candidatura) => `santinho-${c.ano}-${c.cod_cargo}`

interface Leitura {
  ordem: Candidatura[]
  sequencia: number
  emMandato?: Candidatura
  ultimoMandato?: Candidatura
  anosMandato: number
  partidos: string[]
}

/** O que a carreira diz: maior sequência de vitórias, anos com mandato, mandato atual, partidos. */
function ler(p: Politico): Leitura {
  const ordem = [...p.candidaturas].sort((a, b) => a.ano - b.ano || a.cod_cargo - b.cod_cargo)
  let sequencia = 0, atual = 0
  for (const c of ordem) {
    atual = c.eleito ? atual + 1 : 0
    sequencia = Math.max(sequencia, atual)
  }
  const eleitas = ordem.filter((c) => c.eleito && !c.suplementar)
  // anos com mandato, sem contar duas vezes os que se sobrepõem (ex.: senador eleito governador)
  const anos = new Set<number>()
  for (const c of eleitas) for (let a = c.ano + 1; a < Math.min(ANO_ATUAL + 1, c.ano + 1 + duracaoMandato(c.cod_cargo)); a++) anos.add(a)
  const emMandato = eleitas.filter((c) => c.ano + 1 <= ANO_ATUAL && ANO_ATUAL < c.ano + 1 + duracaoMandato(c.cod_cargo)).at(-1)
  const partidos = [...new Set(ordem.map((c) => c.partido).filter((x): x is string => !!x))]
  return { ordem, sequencia, emMandato, ultimoMandato: eleitas.at(-1), anosMandato: anos.size, partidos }
}

/** Carimbo da situação atual, na mesma tinta dos carimbos dos santinhos. */
function Carimbo({ l }: { l: Leitura }) {
  const [texto, cor] = l.emMandato
    ? [`Em mandato · ${fmtCargo(l.emMandato.cargo).toLowerCase()} até ${l.emMandato.ano + duracaoMandato(l.emMandato.cod_cargo)}`, 'var(--color-eleito)']
    : l.ultimoMandato
      ? [`Sem mandato desde ${l.ultimoMandato.ano + duracaoMandato(l.ultimoMandato.cod_cargo)}`, 'var(--color-tinta-3)']
      : ['Nunca eleito', 'var(--color-tinta-3)']
  return (
    <span
      className="inline-block -rotate-2 rounded-[5px] border-2 px-2.5 py-1 text-[0.74rem] font-black uppercase tracking-[0.08em]"
      style={{ color: cor, borderColor: cor }}
    >
      {texto}
    </span>
  )
}

/** Fita da carreira: uma casa por eleição, em ordem; cheia quando venceu. Leva ao santinho. */
function FitaCarreira({ ordem }: { ordem: Candidatura[] }) {
  const reduz = useReducedMotion()
  return (
    <ol className="flex flex-wrap gap-x-1.5 gap-y-3" aria-label="Eleições disputadas, em ordem">
      {ordem.map((c, i) => {
        const cor = c.reeleito ? 'var(--color-reeleito)' : 'var(--color-eleito)'
        return (
          <motion.li
            key={`${c.ano}-${c.cod_cargo}-${i}`}
            className="list-none"
            initial={reduz ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
          >
            <a
              href={`#${idSantinho(c)}`}
              className="group flex w-[46px] flex-col items-center gap-1 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-acao"
              aria-label={`${c.ano}, ${fmtCargo(c.cargo)}, ${situacao(c).toLowerCase()}. Ver o santinho`}
            >
              <span
                className="grid size-[30px] place-items-center rounded-[6px] border-2 text-[0.62rem] font-black text-white transition-transform group-hover:-translate-y-0.5"
                style={c.eleito ? { background: cor, borderColor: cor } : { borderColor: 'var(--color-linha-2)', background: 'var(--color-folha)' }}
              >
                {c.reeleito ? 'RE' : ''}
              </span>
              <span className="tabular text-[0.72rem] font-semibold text-tinta-2">{c.ano}</span>
            </a>
          </motion.li>
        )
      })}
    </ol>
  )
}

function Resposta({ p, l }: { p: Politico; l: Leitura }) {
  const b = (t: ReactNode) => <b className="font-bold text-tinta">{t}</b>
  const r = p.resumo
  const ctx = p.contexto_reeleicao
  return (
    <div className="max-w-[60ch] space-y-3 text-[clamp(1rem,0.92rem+0.3vw,1.12rem)] leading-[1.55] text-tinta-2">
      <p>
        Desde {b(String(r.primeiro_ano))}, disputou {b(plural(r.candidaturas, 'eleição', 'eleições'))} e venceu {b(inteiro(r.vitorias))}
        {r.reeleicoes > 0 && <>, com {b(plural(r.reeleicoes, 'reeleição', 'reeleições'))}</>}.{' '}
        {l.anosMandato > 0 && <>Teve mandato em {b(plural(l.anosMandato, 'ano', 'anos'))}{l.sequencia > 1 && <> e chegou a {b(`${l.sequencia} vitórias seguidas`)}</>}.</>}{' '}
        {l.partidos.length === 1 ? <>Concorreu sempre pelo {b(l.partidos[0])}.</> : l.partidos.length > 1 ? <>Passou por {b(plural(l.partidos.length, 'partido', 'partidos'))}: {l.partidos.join(', ')}.</> : null}
      </p>
      {ctx && (
        <p className="text-[0.95em]">
          Para comparar: {ctx.uf === 'BR' ? 'no país' : `no ${ctx.uf}`}, dos {cargoPlural(ctx.cargo)} eleitos que tentaram a reeleição,{' '}
          {b(`${inteiro(ctx.reeleitos)} de ${inteiro(ctx.tentaram)}`)} {ctx.reeleitos === 1 ? 'conseguiu' : 'conseguiram'} ({b(`${inteiro(Math.round(ctx.taxa))}%`)}).{' '}
          <Link
            to="/reeleicao"
            search={{ uf: ctx.uf, cargo: COD_CARGO_P10[ctx.cargo] }}
            className="inline-flex items-center gap-1 font-semibold text-acao hover:underline"
          >
            Reeleição por cargo e estado <ArrowRight size={13} weight="bold" aria-hidden />
          </Link>
        </p>
      )}
    </div>
  )
}

function Santinhos({ recentes, nome }: { recentes: Candidatura[]; nome: string }) {
  const trilho = useRef<HTMLOListElement>(null)
  const [pontas, setPontas] = useState({ inicio: true, fim: false })
  const medir = () => {
    const t = trilho.current
    if (!t) return
    const inicio = t.scrollLeft < 8, fim = t.scrollLeft + t.clientWidth > t.scrollWidth - 8
    setPontas((p) => (p.inicio === inicio && p.fim === fim ? p : { inicio, fim }))
  }
  useEffect(medir, [recentes])
  const rolar = (sentido: number) => trilho.current?.scrollBy({ left: sentido * 500, behavior: 'smooth' })
  const botao = 'grid size-10 place-items-center rounded-full border border-linha-2 bg-folha text-tinta transition hover:border-tinta disabled:opacity-35 disabled:hover:border-linha-2'
  return (
    <section aria-labelledby="santinhos" className="fila-santinhos adiar mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="santinhos" className="t-h2">Santinhos de cada eleição</h2>
          <p className="mt-2 text-tinta-2">Do mais recente ao mais antigo. Os municipais abrem o boletim do município.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={botao} onClick={() => rolar(-1)} disabled={pontas.inicio} aria-label="Santinhos mais recentes">
            <CaretLeft size={18} weight="bold" aria-hidden />
          </button>
          <button type="button" className={botao} onClick={() => rolar(1)} disabled={pontas.fim} aria-label="Santinhos mais antigos">
            <CaretRight size={18} weight="bold" aria-hidden />
          </button>
        </div>
      </div>
      <ol
        ref={trilho}
        onScroll={medir}
        className="-mx-4 mt-5 flex snap-x snap-mandatory scroll-pl-4 items-stretch gap-5 overflow-x-auto px-4 pb-8 pt-3 md:-mx-[var(--casca-margem)] md:scroll-pl-[var(--casca-margem)] md:px-[var(--casca-margem)]"
      >
        {recentes.map((c, i) => (
          <li key={`${c.ano}-${c.cod_cargo}-${i}`} id={idSantinho(c)} className="flex scroll-mt-20 list-none" style={{ ['--i' as string]: Math.min(i, 6) }}>
            <Santinho c={c} nome={nome} inclinacao={i % 2 ? -1.2 : 0.9} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export function PoliticoPagina() {
  const { id } = useParams({ from: '/politico/$id' })
  const busca = useSearch({ from: '/politico/$id' })
  const { data: p, error, isLoading } = useQuery(consultas.politico(Number(id)))
  const { data: partidos } = useQuery(consultas.partidos())
  const viesPartido = useMemo(() => (partidos ? new Map(partidos.map((x) => [x.sigla, x.vies])) : undefined), [partidos])
  const reduz = useReducedMotion()

  useEffect(() => {
    if (p) document.title = `${nomeProprio(p.nome)} · Voto Aberto`
  }, [p])

  if (error) return <ErroCarga erro={error} />
  if (isLoading || !p) return <Atrasado><EsqueletoPagina variante="carreira" rotulo="Abrindo a carreira..." /></Atrasado>

  const nome = nomeProprio(p.nome)
  const l = ler(p)
  const recentes = [...p.candidaturas].sort((a, b) => b.ano - a.ano || a.cod_cargo - b.cod_cargo)
  const local = p.ufs.length ? p.ufs.join(', ') : 'Brasil'

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-16 pt-6 md:px-[var(--casca-margem)]">
      <Link to="/urna" className="inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-acao hover:underline">
        <ArrowLeft size={14} weight="bold" aria-hidden /> Nova consulta na urna
      </Link>

      <header className="mt-4 grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        <div className="flex gap-5 sm:gap-7">
          <motion.div
            className="shrink-0"
            initial={reduz ? false : { opacity: 0, scale: 0.94, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* retrato 3x4 com borda de papel, como a foto da ficha de candidatura */}
            <div className="rounded-[14px] bg-folha p-1.5 shadow-[var(--shadow-cartao)]">
              <Retrato foto={p.foto} nome={p.nome} tamanho={112} className="rounded-[10px] sm:hidden" />
              <Retrato foto={p.foto} nome={p.nome} tamanho={148} className="hidden rounded-[10px] sm:block" />
            </div>
          </motion.div>
          <div className="min-w-0 pt-1">
            <h1 className="t-h1 text-balance">{nome}</h1>
            <p className="mt-2 text-tinta-2">
              {p.nascimento_ano ? `Nasceu em ${p.nascimento_ano}` : 'Ano de nascimento não informado'} · {local}
            </p>
            <div className="mt-4">
              <Carimbo l={l} />
            </div>
          </div>
        </div>

        <div className="lg:pt-2">
          <Resposta p={p} l={l} />
          <div className="mt-6">
            <FitaCarreira ordem={l.ordem} />
            <p className="mt-1 text-[0.78rem] text-tinta-3">
              Cada casa é uma eleição: cheia quando venceu (RE = reeleição), vazia quando perdeu. Toque para ver o santinho.
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="trajetoria" className="mt-12">
        <h2 id="trajetoria" className="t-h2">Trajetória por cargo</h2>
        <p className="mb-5 mt-2 max-w-[66ch] text-tinta-2">
          Cada ponto é uma candidatura, ligada à seguinte; a barra é o mandato. Embaixo, o partido de cada eleição na cor do seu viés.
        </p>
        <Trajetoria candidaturas={p.candidaturas} viesPartido={viesPartido} />
      </section>

      <GastosCampanha campanhas={[...l.ordem].reverse()} inicial={busca.gasto} />
      <Santinhos recentes={recentes} nome={p.nome} />
    </div>
  )
}
