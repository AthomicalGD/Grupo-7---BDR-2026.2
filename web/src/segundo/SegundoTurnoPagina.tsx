// P12: o que muda no 2º turno. Todas as disputas de 2º turno de 2018 a 2024 (Presidência, governos e as
// prefeituras das cidades com mais de 200 mil eleitores): a largada mostra todas juntas, as fichas uma a uma (as
// linhas se cruzam quando há virada) e a disputa aberta vem com os votos, o comparecimento e o território.
import { Intersect, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { consultas, type Ano, type SegundoTurno } from '../api'
import { Escolha } from '../componentes/Escolha'
import { ErroCarga } from '../componentes/ErroCarga'
import { Atrasado, EsqueletoPagina } from '../componentes/Esqueleto'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargo as cargoBonito, decimal, inteiro, nomeProprio, pct, semAcento } from '../lib/formato'
import type { BuscaSegundoTurno } from '../router'
import { CARGOS, coresFinalistas, disputaNome, lugar, nomeUrna, parteVencedor, type ChaveCargo } from './comuns'
import { Disputa } from './Disputa'
import { Largada } from './Largada'

const ROTULO_CARGO: Record<ChaveCargo, string> = { presidente: 'Presidente', governador: 'Governador', prefeito: 'Prefeito' }
const LOTE = 24

/** Uma disputa em miniatura: as duas linhas (vencedor e derrotado) do 1º ao 2º turno; cruzam quando virou. */
function Placar({ d, ufs, aberta, aoAbrir }: { d: SegundoTurno; ufs: Map<string, string>; aberta: boolean; aoAbrir: () => void }) {
  const { t1, t2 } = parteVencedor(d)
  const W = 220, H = 92, X1 = 12, X2 = W - 12
  const y = (v: number) => 8 + ((70 - Math.min(70, Math.max(30, v))) / 40) * (H - 16)
  const [a, b] = d.finalistas
  const [ca, cb] = coresFinalistas(d)
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-pressed={aberta}
      aria-label={`${disputaNome(d, ufs)}, ${d.ano}: ${nomeUrna(a)} venceu${d.virada ? ' de virada' : ''}, ${nomeUrna(b)} ficou em segundo`}
      className={`group flex flex-col rounded-[16px] border bg-folha p-4 text-left transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-14px_rgb(42_53_80/0.35)] ${aberta ? 'border-tinta ring-2 ring-tinta' : d.virada ? 'border-escolha-2' : 'border-linha'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[1rem] font-bold">{lugar(d, ufs)}</span>
          <span className="text-[0.8rem] text-tinta-3">{cargoBonito(d.cargo)} · {d.ano}</span>
        </span>
        {d.virada && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-escolha px-2 py-0.5 text-[0.72rem] font-bold text-tinta"><Intersect size={12} weight="bold" aria-hidden />Virou</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" aria-hidden>
        <line x1={X1} x2={X2} y1={y(50)} y2={y(50)} stroke="var(--color-linha)" strokeDasharray="3 4" />
        <line x1={X1} y1={y(100 - t1)} x2={X2} y2={y(100 - t2)} stroke={cb.cor} strokeWidth={3.5} strokeLinecap="round" />
        <line x1={X1} y1={y(t1)} x2={X2} y2={y(t2)} stroke={ca.cor} strokeWidth={4} strokeLinecap="round" />
        {[[X1, t1], [X2, t2]].map(([x, v]) => (
          <g key={x}>
            <circle cx={x} cy={y(100 - v)} r={4.5} fill={cb.cor} />
            <circle cx={x} cy={y(v)} r={4.5} fill={ca.cor} />
          </g>
        ))}
      </svg>
      <div className="mt-2 space-y-1 text-[0.82rem]">
        <p className="flex items-center justify-between gap-2"><span className="truncate font-bold">{nomeUrna(a)}</span><span className="tabular shrink-0 text-tinta-2">{decimal(t1, 0)}% → <b className="text-tinta">{decimal(t2, 0)}%</b></span></p>
        <p className="flex items-center justify-between gap-2 text-tinta-2"><span className="truncate">{nomeUrna(b)}</span><span className="tabular shrink-0">{decimal(100 - t1, 0)}% → {decimal(100 - t2, 0)}%</span></p>
      </div>
    </button>
  )
}

export function SegundoTurnoPagina() {
  const busca = useSearch({ from: '/segundo-turno' })
  const navegar = useNavigate({ from: '/segundo-turno' })
  const mudar = (s: Partial<BuscaSegundoTurno>) => navegar({ search: (x) => ({ ...x, ...s }), replace: true, resetScroll: false })
  const q = useQuery(consultas.segundoTurno())
  const { data: listaUfs } = useQuery(consultas.ufs())
  const ufs = useMemo(() => new Map((listaUfs ?? []).map((u) => [u.sigla, u.nome])), [listaUfs])
  const [texto, setTexto] = useState('')
  const [mostrando, setMostrando] = useState(LOTE)
  const detalhe = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'O que muda no 2º turno? · Voto Aberto'
  }, [])

  const todas = q.data?.disputas ?? []
  // sem disputa no endereço, abre a maior virada (o vencedor mais atrás no 1º turno)
  const maiorVirada = useMemo(() => todas.filter((d) => d.virada).sort((x, y) => parteVencedor(x).t1 - parteVencedor(y).t1)[0], [todas])
  const aberta = todas.find((d) => d.id === busca.d) ?? maiorVirada

  const filtradas = useMemo(() => {
    const t = semAcento(texto.trim())
    const lista = todas.filter((d) =>
      (!busca.cargo || d.cod_cargo === busca.cargo) &&
      (!busca.ano || d.ano === busca.ano) &&
      (!busca.viradas || d.virada) &&
      (!t || semAcento(`${lugar(d, ufs)} ${d.finalistas.map((f) => `${f.nome} ${f.nome_urna ?? ''} ${f.partido ?? ''}`).join(' ')}`).includes(t)))
    const ordem = busca.ordem ?? 'recentes'
    return [...lista].sort((x, y) =>
      ordem === 'viradas' ? Number(y.virada) - Number(x.virada) || parteVencedor(x).t1 - parteVencedor(y).t1
        : ordem === 'crescimento' ? (y.finalistas[0].crescimento ?? 0) - (x.finalistas[0].crescimento ?? 0)
          : y.ano - x.ano || x.cod_cargo - y.cod_cargo || lugar(x, ufs).localeCompare(lugar(y, ufs)))
  }, [todas, busca.cargo, busca.ano, busca.viradas, busca.ordem, texto, ufs])
  useEffect(() => setMostrando(LOTE), [busca.cargo, busca.ano, busca.viradas, busca.ordem, texto])

  const abrir = (id: number) => {
    mudar({ d: id })
    requestAnimationFrame(() => detalhe.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
  }

  if (q.error) return <div className="mx-auto max-w-[var(--casca-max)] px-4 py-10 md:px-[var(--casca-margem)]"><ErroCarga erro={q.error} aoTentar={q.refetch} /></div>
  if (!q.data) return <Atrasado><EsqueletoPagina rotulo="Juntando os dois turnos de cada disputa..." /></Atrasado>

  const viradas = todas.filter((d) => d.virada).length
  const anos = [...new Set(todas.map((d) => d.ano))].sort()
  const filtrando = !!(busca.cargo || busca.ano || busca.viradas || texto)

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header>
        <div>
          <h1 className="t-display">O que muda no 2º turno?</h1>
          <p className="mt-4 max-w-[58ch] text-[1.08rem] text-tinta-2">
            Quando ninguém passa da metade dos votos válidos, os dois mais votados disputam de novo. De {anos[0]} a {anos.at(-1)} foram{' '}
            <b className="text-tinta">{todas.length} segundos turnos</b>, e em <b className="text-tinta">{viradas}</b> deles ({pct((100 * viradas) / todas.length, 0)}) quem
            liderou o 1º turno perdeu: houve <b className="text-tinta">virada</b>.
          </p>
        </div>
      </header>

      <section aria-label="De onde o vencedor partiu" className="mt-8">
        <Largada disputas={todas} ufs={ufs} aoAbrir={abrir} />
      </section>

      {aberta && (
        <div ref={detalhe} className="mt-14 scroll-mt-24">
          <Disputa key={aberta.id} d={aberta} ufs={ufs} />
        </div>
      )}

      <section aria-labelledby="todas" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="todas" className="t-h1">{filtrando ? `${filtradas.length} de ${todas.length} disputas` : `As ${todas.length} disputas`}</h2>
          <label className="relative block w-full max-w-[340px]">
            <span className="sr-only">Procurar disputa</span>
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-3" aria-hidden />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cidade, estado, candidato ou partido"
              className="h-12 w-full rounded-full border border-linha-2 bg-folha pl-11 pr-10 text-[0.95rem] placeholder:text-tinta-3 focus:border-acao focus:outline-none" />
            {texto && (
              <button type="button" onClick={() => setTexto('')} aria-label="Limpar a busca" className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-tinta-3 hover:bg-papel hover:text-tinta">
                <X size={14} weight="bold" aria-hidden />
              </button>
            )}
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div role="radiogroup" aria-label="Cargo" className="flex flex-wrap gap-2">
            <Escolha ativo={!busca.cargo} aoClicar={() => mudar({ cargo: undefined })}>Todos</Escolha>
            {(Object.keys(ROTULO_CARGO) as ChaveCargo[]).map((k) => (
              <Escolha key={k} ativo={busca.cargo === CARGOS[k]} aoClicar={() => mudar({ cargo: CARGOS[k] })}>{ROTULO_CARGO[k]}</Escolha>
            ))}
          </div>
          <div role="radiogroup" aria-label="Ano" className="flex flex-wrap gap-2">
            <Escolha ativo={!busca.ano} aoClicar={() => mudar({ ano: undefined })}>Todos os anos</Escolha>
            {anos.map((a) => <Escolha key={a} ativo={busca.ano === a} aoClicar={() => mudar({ ano: a as Ano })}>{a}</Escolha>)}
          </div>
          <button type="button" aria-pressed={!!busca.viradas} onClick={() => mudar({ viradas: busca.viradas ? undefined : true })}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[0.86rem] font-semibold transition-colors ${busca.viradas ? 'border-escolha-2 bg-escolha text-tinta' : 'border-linha bg-folha text-tinta-2 hover:border-linha-2 hover:text-tinta'}`}>
            <Intersect size={16} weight="bold" aria-hidden /> Só as viradas
          </button>
          <label className="inline-flex items-center gap-2 text-[0.86rem] font-semibold text-tinta-2">
            Ordem
            <select value={busca.ordem ?? 'recentes'} onChange={(e) => mudar({ ordem: e.target.value === 'recentes' ? undefined : (e.target.value as BuscaSegundoTurno['ordem']) })}
              className="h-10 rounded-full border border-linha bg-folha px-3 text-tinta focus:border-acao focus:outline-none">
              <option value="recentes">Mais recentes</option>
              <option value="viradas">Maiores viradas</option>
              <option value="crescimento">Quem mais cresceu</option>
            </select>
          </label>
        </div>

        {filtradas.length ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtradas.slice(0, mostrando).map((d) => <Placar key={d.id} d={d} ufs={ufs} aberta={aberta?.id === d.id} aoAbrir={() => abrir(d.id)} />)}
            </div>
            {mostrando < filtradas.length && (
              <div className="mt-6 flex justify-center">
                <button type="button" onClick={() => setMostrando((n) => n + LOTE)} className="botao-contorno h-11 px-5 text-[0.92rem] font-semibold">
                  Mostrar mais {Math.min(LOTE, filtradas.length - mostrando)} de {filtradas.length - mostrando}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-[16px] border border-dashed border-linha-2 bg-folha p-8 text-center">
            <p className="text-[1rem] font-semibold">Nenhuma disputa com esses filtros.</p>
            <button type="button" onClick={() => { setTexto(''); mudar({ cargo: undefined, ano: undefined, viradas: undefined }) }} className="mt-3 text-[0.92rem] font-semibold text-acao hover:underline">
              Limpar os filtros
            </button>
          </div>
        )}
      </section>

      <section aria-label="Tabela das disputas" className="mt-10">
        <TabelaAlternavel
          titulo="Os segundos turnos de 2018 a 2024"
          sql="p12SegundoTurno"
          colunas={['Ano', 'Cargo', 'Lugar', 'Vencedor', 'Partido', '% no 1º turno', '% no 2º turno', 'Crescimento', 'Derrotado', 'Partido', 'Virada']}
          linhas={() => filtradas.map((d) => {
            const [a, b] = d.finalistas
            return [String(d.ano), cargoBonito(d.cargo), lugar(d, ufs), nomeUrna(a), a.partido ?? '-', pct(a.pct_t1), pct(a.pct_t2),
              a.crescimento == null ? '-' : `${decimal(a.crescimento, 0)}%`, nomeUrna(b), b.partido ?? '-', d.virada ? 'sim' : 'não']
          })}
        />
        <p className="mt-3 max-w-[70ch] text-[0.82rem] text-tinta-3">
          Votos nominais por zona do TSE, de 2018 a 2024 (antes disso o banco não tem os votos por zona). % no 1º turno: entre todos os candidatos;
          no 2º, entre os dois. Comparecimento, brancos, nulos e faltas: somados nos municípios da disputa. {inteiro(todas.length)} disputas.
          {q.data.incompletas.length > 0 && (
            <> Ficaram de fora, por não terem no banco os votos do 1º turno: {q.data.incompletas.map((x) => `${nomeProprio(x.municipio ?? x.uf ?? '')}${x.municipio ? ` (${x.uf})` : ''} ${x.ano}`).join(' e ')}.</>
          )}
        </p>
      </section>
    </div>
  )
}
