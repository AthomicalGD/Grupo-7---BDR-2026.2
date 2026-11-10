import { ArrowLeft, CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import { consultas, type EleitosLegenda, type PartidoLegenda, type SituacaoLegenda } from '../api'
import { Escolha } from '../componentes/Escolha'
import { Atrasado, EsqueletoBloco, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Retrato } from '../componentes/Retrato'
import { Veredito } from '../componentes/Veredito'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, nomeProprio } from '../lib/formato'
import type { BuscaLegenda } from '../router'
import { LegendaMosaico } from './Mosaico'

const ROTULO_STATUS: Record<SituacaoLegenda, string> = {
  qp: 'pelo quociente',
  media: 'pelas médias',
}

/** o mosaico não passa de ~330 pastilhas: acima disso, cada uma vale várias cadeiras */
const VISIVEIS = 8
const MAX_PASTILHAS = 330
const unidadeMosaico = (total: number) => (total > MAX_PASTILHAS ? Math.ceil(total / MAX_PASTILHAS) : 1)

const CARGOS_PLURAL: Record<number, string> = {
  6: 'deputados federais',
  7: 'deputados estaduais',
  13: 'vereadores',
}

function useAtrasado(valor: string, ms = 250) {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return atrasado
}

function Selo({ situacao }: { situacao: 'ELEITO POR QP' | 'ELEITO POR MÉDIA' }) {
  const media = situacao === 'ELEITO POR MÉDIA'
  return (
    <span
      aria-label={`Classificação do TSE: ${situacao}`}
      className={`carimbo inline-block text-center text-[0.57rem] font-black leading-[1.05] tracking-[0.08em] ${media ? 'text-corrige' : 'text-eleito'}`}
      style={{ color: media ? 'var(--color-corrige)' : 'var(--color-eleito)' }}
    >
      ELEITO {media ? 'PELAS' : 'PELO'}<br />{media ? 'MÉDIAS' : 'QUOCIENTE'}
    </span>
  )
}

function CartaoCandidato({ c }: { c: EleitosLegenda['candidatos'][number] }) {
  return (
    <li>
      <Link
        to="/politico/$id"
        params={{ id: String(c.id) }}
        aria-label={`${nomeProprio(c.nome_urna || c.nome)}, ${c.partido}, ${c.situacao}, ${c.local}`}
        className="flex h-full items-start gap-3 rounded-xl border border-linha bg-folha p-3 transition-colors hover:border-linha-2 hover:bg-papel"
      >
        <Retrato foto={c.foto} nome={c.nome} tamanho={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-tinta">{nomeProprio(c.nome_urna || c.nome)}</span>
          {c.nome_urna && c.nome_urna !== c.nome && (
            <span className="block truncate text-[0.76rem] text-tinta-3">{nomeProprio(c.nome)}</span>
          )}
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
            <Selo situacao={c.situacao} />
            <span className="text-[0.78rem] text-tinta-2">{c.partido}{c.numero != null ? ` · nº ${c.numero}` : ''}</span>
          </span>
          <span className="mt-2 block truncate text-[0.76rem] text-tinta-3">{c.local}</span>
          <span className="mt-1 block text-[0.68rem] text-tinta-3">Classificação TSE: {c.situacao}</span>
        </span>
        <span aria-hidden className="pt-1 text-tinta-3">↗</span>
      </Link>
    </li>
  )
}

function Candidatos({ partido, ano, cargo, uf, situacao }: {
  partido: string
  ano: number
  cargo: number
  uf: string
  situacao: SituacaoLegenda
}) {
  const [texto, setTexto] = useState('')
  const [limite, setLimite] = useState(6)
  const busca = useAtrasado(texto.trim())
  const q = useQuery({
    ...consultas.eleitosLegenda(partido, ano, cargo, uf, situacao, busca.length >= 2 ? busca : '', limite),
    placeholderData: keepPreviousData,
  })

  if (q.error && !q.data) return <ErroCarga erro={q.error} compacto />
  if (!q.data) return <Atrasado><EsqueletoBloco altura={116} linhas={2} rotulo="Buscando os eleitos..." /></Atrasado>
  const d = q.data

  return (
    <div className={`mt-4 border-t border-linha pt-4 transition-opacity ${q.isPlaceholderData ? 'opacity-55' : ''}`} aria-busy={q.isPlaceholderData}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.84rem] text-tinta-2">
          {inteiro(d.achados)} {d.achados === 1 ? 'candidato eleito' : 'candidatos eleitos'} {ROTULO_STATUS[situacao]}.
        </p>
        {d.total > 6 && (
          <label className="relative block w-full sm:w-72">
            <MagnifyingGlass size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3" />
            <span className="sr-only">Buscar candidato do {partido}</span>
            <input
              type="search"
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setLimite(6) }}
              placeholder="Buscar nome ou nome de urna"
              className="h-10 w-full rounded-full border border-linha bg-folha pl-9 pr-3 text-[0.84rem] outline-none focus:border-tinta"
            />
          </label>
        )}
      </div>
      {busca.length >= 2 && d.achados === 0 ? (
        <p className="rounded-lg bg-papel px-3 py-4 text-[0.86rem] text-tinta-2">Nenhum candidato encontrado com “{busca}”.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {d.candidatos.map((c) => <CartaoCandidato key={`${c.id}-${c.numero}`} c={c} />)}
        </ul>
      )}
      {d.achados > limite && (
        <button
          type="button"
          onClick={() => setLimite((n) => n + 6)}
          disabled={q.isFetching}
          className="mt-3 rounded-md px-2 py-1.5 text-[0.84rem] font-semibold text-acao hover:bg-papel disabled:opacity-60"
        >
          Mostrar mais {Math.min(6, d.achados - limite)}
        </button>
      )}
      {q.error && <p role="alert" className="mt-3 text-[0.82rem] text-corrige">Falha ao atualizar os candidatos; mostrando os dados anteriores.</p>}
      {q.isPlaceholderData && <span className="sr-only" role="status">Atualizando candidatos...</span>}
    </div>
  )
}

function LinhaPartido({
  p, maximo, aberto, situacao, aoAbrir, ano, cargo, uf,
}: {
  p: PartidoLegenda
  maximo: number
  aberto: boolean
  situacao: SituacaoLegenda
  aoAbrir: (tipo: SituacaoLegenda) => void
  ano: number
  cargo: number
  uf: string
}) {
  const id = useId()
  const total = p.total || 1
  return (
    <li id={`linha-${p.sigla}`} className="scroll-mt-24 border-t border-linha py-3 first:border-0">
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-[minmax(7rem,0.7fr)_minmax(0,2fr)] sm:items-center">
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <span className="truncate font-bold text-tinta" title={p.nome ?? p.sigla}>{p.sigla}</span>
          <span className="tabular shrink-0 text-[0.82rem] text-tinta-2 sm:mt-0.5 sm:block">{inteiro(p.total)} eleitos</span>
        </div>
        <div>
          <div className="flex h-8 w-full overflow-hidden rounded-md bg-papel-2" role="group" aria-label={`Eleitos do ${p.sigla}: ${p.qp} pelo quociente e ${p.media} pelas médias`}>
            {p.qp > 0 && (
              <button
                type="button"
                aria-expanded={aberto && situacao === 'qp'}
                aria-controls={aberto && situacao === 'qp' ? id : undefined}
                aria-label={`${p.sigla}: ${p.qp} eleitos pelo quociente. ${aberto && situacao === 'qp' ? 'Fechar' : 'Ver'} candidatos`}
                title={`${p.qp} eleitos pelo quociente`}
                onClick={() => aoAbrir('qp')}
                className="min-w-[3px] shrink-0 overflow-hidden border-r border-folha/40 bg-eleito transition-[filter] hover:brightness-90 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-tinta"
                style={{ width: `${(p.qp / maximo) * 100}%` }}
              />
            )}
            {p.media > 0 && (
              <button
                type="button"
                aria-expanded={aberto && situacao === 'media'}
                aria-controls={aberto && situacao === 'media' ? id : undefined}
                aria-label={`${p.sigla}: ${p.media} eleitos pelas médias. ${aberto && situacao === 'media' ? 'Fechar' : 'Ver'} candidatos`}
                title={`${p.media} eleitos pelas médias`}
                onClick={() => aoAbrir('media')}
                className="min-w-[3px] shrink-0 overflow-hidden border-l border-folha/50 transition-[filter] hover:brightness-90 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-tinta"
                style={{
                  width: `${(p.media / maximo) * 100}%`,
                  backgroundImage: 'repeating-linear-gradient(135deg, var(--color-fita-laranja) 0 3px, var(--color-fita-amarelo) 3px 6px)',
                }}
              />
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-[0.74rem] text-tinta-3">
            <span><span className="mr-1 inline-block size-2 rounded-sm bg-eleito" aria-hidden />Quociente {inteiro(p.qp)}</span>
            <span><span className="mr-1 inline-block size-2 rounded-sm" style={{ background: 'var(--color-fita-laranja)' }} aria-hidden />Médias {inteiro(p.media)}</span>
            {total !== p.qp + p.media && <span className="text-corrige">Atenção: total divergente</span>}
          </div>
        </div>
      </div>
      {aberto && (
        <div id={id} className="mt-3 sm:ml-[calc(23.33%+1.25rem)]">
          <Candidatos partido={p.sigla} ano={ano} cargo={cargo} uf={uf} situacao={situacao} />
        </div>
      )}
    </li>
  )
}

export function LegendaPagina() {
  const busca = useSearch({ from: '/cadeira/legenda' })
  const navegar = useNavigate({ from: '/cadeira/legenda' })
  const mudar = (s: Partial<BuscaLegenda>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const q = useQuery({ ...consultas.legenda(busca.uf ?? ''), placeholderData: keepPreviousData })
  const ufs = useQuery(consultas.ufs())
  const dados = q.data
  const [todos, setTodos] = useState(false)

  useEffect(() => {
    document.title = 'Eleitos pelo sistema proporcional · Voto Aberto'
  }, [])

  if (q.error && !dados) return <ErroCarga erro={q.error} />
  if (!dados || !ufs.data) return <Atrasado><EsqueletoPagina rotulo="Contando os eleitos por partido..." /></Atrasado>

  const recortes = dados.recortes
  const anos = [...new Set(recortes.map((r) => r.ano))].sort((a, b) => a - b)
  const ano = busca.ano_p5 && anos.includes(busca.ano_p5) ? busca.ano_p5 : anos[anos.length - 1]
  const cargos = recortes.filter((r) => r.ano === ano).map((r) => r.cargo)
  const cargo = cargos.find((c) => c.cod === busca.cargo) ?? cargos[0]
  const recorte = recortes.find((r) => r.ano === ano && r.cargo.cod === cargo?.cod)
  const abertos = recorte?.partidos ?? []
  const partidoAberto = abertos.find((p) => p.sigla === busca.partido)
  const situacao = busca.situacao ?? 'qp'
  const maximo = Math.max(1, ...abertos.map((p) => p.total))
  const nomesUF = new Map(ufs.data.filter((u) => dados.ufs.includes(u.sigla)).map((u) => [u.sigla, u.nome]))
  const escopoLocal = recorte?.ufs_com_dados.length === 1
    ? nomesUF.get(recorte.ufs_com_dados[0]) ?? recorte.ufs_com_dados[0]
    : `${recorte?.ufs_com_dados.length ?? 0} estados com dados`

  const escolherAno = (novo: number) => {
    const proximo = recortes.find((r) => r.ano === novo)
    mudar({ ano_p5: novo, cargo: proximo?.cargo.cod, partido: undefined, situacao: undefined })
  }
  const escolherCargo = (novo: number) => mudar({ cargo: novo, partido: undefined, situacao: undefined })
  const escolherUF = (novo: string) => mudar({ uf: novo || undefined, ano_p5: undefined, cargo: undefined, partido: undefined, situacao: undefined })
  const abrir = (sigla: string, tipo: SituacaoLegenda) => {
    if (busca.partido === sigla && situacao === tipo) mudar({ partido: undefined, situacao: undefined })
    else mudar({ partido: sigla, situacao: tipo })
  }
  // vindo do mosaico: abre os eleitos do partido e leva a tela até a linha dele
  const abrirDoMosaico = (sigla: string, tipo: SituacaoLegenda) => {
    mudar({ partido: sigla, situacao: tipo })
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(() => document.getElementById(`linha-${sigla}`)?.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' }), 60)
  }
  // a concentração: quantos partidos, dos maiores para os menores, juntam metade das cadeiras
  const ordenados = [...abertos].sort((a, b) => b.total - a.total)
  const metade = (recorte?.total.eleitos ?? 0) / 2
  const grandes = ordenados.filter((_, i) => ordenados.slice(0, i).reduce((t, p) => t + p.total, 0) < metade)
  const lista = grandes.map((p) => p.sigla)
  const unidade = unidadeMosaico(recorte?.total.eleitos ?? 0)

  return (
    <main className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header>
        <Link to="/cadeira" className="alvo-44 mb-2 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[0.86rem] font-semibold text-acao hover:bg-papel">
          <ArrowLeft size={15} weight="bold" aria-hidden /> Quanto custa uma cadeira?
        </Link>
        <h1 className="t-display">Como os partidos preencheram as cadeiras?</h1>
        <p className="apoio mt-3 text-[1.06rem] text-tinta-2">Eleitos pelo sistema proporcional, agrupados pelo partido de filiação.</p>
      </header>

      <div className="peca mt-6 grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(13rem,1fr)] lg:items-start" role="group" aria-label="Escolhas do mosaico">
        <fieldset className="min-w-0">
          <legend className="t-rotulo mb-2 text-tinta-2">Eleição</legend>
          <div role="radiogroup" aria-label="Eleição" className="flex flex-wrap gap-2">
            {anos.map((a) => <Escolha key={a} ativo={a === ano} aoClicar={() => escolherAno(a)}>{a}</Escolha>)}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="t-rotulo mb-2 text-tinta-2">Cargo</legend>
          <div role="radiogroup" aria-label="Cargo" className="flex gap-2 overflow-x-auto pb-1.5 sm:flex-wrap sm:overflow-visible [&>button]:shrink-0">
            {cargos.map((c) => <Escolha key={c.cod} ativo={c.cod === cargo?.cod} aoClicar={() => escolherCargo(c.cod)}>{c.nome}</Escolha>)}
          </div>
        </fieldset>
        <label className="grid content-start gap-2 sm:col-span-2 lg:col-span-1">
          <span className="t-rotulo text-tinta-2">Estado</span>
          <select
            value={busca.uf ?? ''}
            onChange={(e) => escolherUF(e.target.value)}
            className="h-11 w-full rounded-xl border border-linha bg-folha px-3 text-[0.9rem] text-tinta outline-none focus:border-tinta focus-visible:outline-2 focus-visible:outline-acao"
          >
            <option value="">Todos os estados com dados</option>
            {[...dados.ufs].sort().map((sigla) => <option key={sigla} value={sigla}>{nomesUF.get(sigla) ?? sigla}</option>)}
          </select>
        </label>
      </div>

      {q.error && (
        <p role="alert" className="mt-5 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.88rem]">
          Não foi possível atualizar esta seleção. Os números abaixo são da seleção anterior.
        </p>
      )}
      {!recorte ? (
        <p className="mt-8 rounded-xl border border-linha bg-folha px-5 py-4 text-tinta-2">Não há resultados proporcionais neste recorte.</p>
      ) : (
        <section aria-labelledby="resumo-legenda" aria-busy={q.isPlaceholderData} className={`mt-8 transition-opacity ${q.isPlaceholderData ? 'opacity-55' : ''}`}>
          <div>
            <h2 id="resumo-legenda" className="sr-only">Eleitos proporcionais por partido</h2>
            {abertos.length > 0 && recorte.total.eleitos > 0 && (
              <Veredito grande tom="amarelo" palavra={<>{lista.length} <span className="block text-[0.5em] leading-none">{lista.length === 1 ? 'partido' : 'partidos'}</span></>}>
                {lista.length === 1 ? 'sozinho ficou' : 'ficaram'} com metade das cadeiras: <b className="text-tinta">{lista.join(', ')}</b>.{' '}
                Em {ano}, {escopoLocal}, foram eleitos <b className="tabular text-tinta">{inteiro(recorte.total.eleitos)}</b> {CARGOS_PLURAL[cargo.cod]}:
                {' '}<b className="tabular text-tinta">{inteiro(recorte.total.qp)}</b> pelo quociente e{' '}
                <b className="tabular text-tinta">{inteiro(recorte.total.media)}</b> pelas médias.
              </Veredito>
            )}

            <div className={`peca mt-6 p-4 sm:p-5 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
              <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.88rem] text-tinta-2" aria-label="Como ler o mosaico">
                <span className="inline-flex items-center gap-2"><span className="size-4 rounded-[3px] bg-eleito" aria-hidden />pelo quociente</span>
                <span className="inline-flex items-center gap-2"><span className="size-4 rounded-[3px] bg-[var(--amarelo)]" aria-hidden />pelas médias</span>
                <span className="text-tinta-3">{unidade === 1 ? 'Cada pastilha é uma cadeira.' : `Cada pastilha são ${unidade} cadeiras.`} Toque num partido para ver quem foi eleito.</span>
              </div>
              <LegendaMosaico partidos={ordenados} unidade={unidade} aberto={partidoAberto?.sigla} aoAbrir={abrirDoMosaico} />
            </div>

            <h3 className="t-h2 mt-10">Partido por partido</h3>
            <p className="apoio mt-1 text-[0.95rem] text-tinta-2">As barras comparam o total de cada um. Toque num trecho para ver os eleitos.</p>
            <div className={`mt-3 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
              <ul aria-label={`Partidos com eleitos: ${ano}, ${cargo.nome}`}>
                {recorte.partidos.filter((p, i) => todos || i < VISIVEIS || p.sigla === partidoAberto?.sigla).map((p) => (
                  <LinhaPartido
                    key={p.sigla}
                    p={p}
                    maximo={maximo}
                    aberto={partidoAberto?.sigla === p.sigla}
                    situacao={situacao}
                    aoAbrir={(tipo) => abrir(p.sigla, tipo)}
                    ano={ano}
                    cargo={cargo.cod}
                    uf={busca.uf ?? ''}
                  />
                ))}
              </ul>
              {recorte.partidos.length > VISIVEIS && (
                <button type="button" onClick={() => setTodos((t) => !t)} className="peca peca-link alvo-44 mt-3 px-4 text-[0.9rem] font-bold text-tinta">
                  {todos ? `Mostrar só os ${VISIVEIS} maiores` : `Ver os ${recorte.partidos.length} partidos`}
                </button>
              )}
              <TabelaAlternavel
                titulo={`Candidatos eleitos por partido, ${cargo.nome}, ${ano}`}
                colunas={['Partido', 'Por quociente', 'Pelas médias', 'Total']}
                linhas={() => recorte.partidos.map((p) => [p.sigla, inteiro(p.qp), inteiro(p.media), inteiro(p.total)])}
              />
            </div>

            <details className="mt-8 rounded-xl border border-linha bg-folha px-4 py-3">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-tinta">
                <CaretDown size={14} weight="bold" aria-hidden /> O que significam quociente e médias?
              </summary>
              <div className="mt-3 space-y-3 text-[0.88rem] leading-relaxed text-tinta-2">
                <p><b className="text-tinta">Pelo quociente:</b> eleito na distribuição inicial das cadeiras conquistadas pelo partido ou grupo eleitoral.</p>
                <p><b className="text-tinta">Pelas médias:</b> eleito na distribuição das cadeiras restantes, conforme as regras eleitorais.</p>
                <p>O voto de legenda aumenta o total do partido ou grupo, mas não é atribuído individualmente a um candidato. Os carimbos usam a classificação oficial do TSE.</p>
                <p>O partido exibido é o de filiação do candidato. Em 2018, as cadeiras foram calculadas com votos de coligações proporcionais; em 2022, 2024 e 2026, com votos de federações. Em 2020 não houve coligações proporcionais.</p>
              </div>
            </details>
          </div>
          {q.isPlaceholderData && <span className="sr-only" role="status">Atualizando os resultados...</span>}
        </section>
      )}
    </main>
  )
}
