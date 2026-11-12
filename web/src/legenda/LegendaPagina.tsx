// P5, "Como os partidos preencheram as cadeiras?": um jogo de cadeiras. Cada quadrado de azulejo é uma cadeira (azul:
// veio direto dos votos; amarelo: veio das sobras), a conta dos três passos usa os números de verdade do estado, e
// cada eleito aparece com os votos dele medidos contra o valor de uma cadeira. Dá para juntar vários estados
// (Ctrl + clique): as fileiras somam as cadeiras e a conta mostra um estado de cada vez.
import { MagnifyingGlass } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { consultas, type ContaLegenda, type EleitosLegenda, type ResumoLegenda, type SituacaoLegenda } from '../api'
import { Escolha } from '../componentes/Escolha'
import { Atrasado, EsqueletoBloco, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Retrato } from '../componentes/Retrato'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { Voltar } from '../componentes/Voltar'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, nomeProprio } from '../lib/formato'
import { ufsDe } from '../lib/ufs'
import type { BuscaLegenda } from '../router'
import { LinhaCadeiras, type DadoLinha } from './Cadeiras'
import { Conta } from './Conta'

const ROTULO_STATUS: Record<SituacaoLegenda, string> = {
  qp: 'pelo quociente',
  media: 'pelas sobras',
}

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
      className="carimbo inline-block text-center text-[0.57rem] font-black leading-[1.05] tracking-[0.08em]"
      style={{ color: media ? 'var(--color-corrige)' : 'var(--color-eleito)' }}
    >
      ELEITO {media ? 'PELAS' : 'PELO'}<br />{media ? 'MÉDIAS' : 'QUOCIENTE'}
    </span>
  )
}

/** Os votos do eleito, medidos contra o valor de uma cadeira: a barra cheia é uma cadeira inteira. */
function Votos({ votos, qe }: { votos: number; qe: number | null }) {
  const pct = qe ? Math.min(100, (votos / qe) * 100) : null
  const cadeiras = qe ? votos / qe : null
  return (
    <span className="mt-2 block">
      {cadeiras != null && (
        <span className="tabular block text-[0.86rem] leading-tight text-tinta">
          <b className="t-numero text-[1.35rem] leading-none">{cadeiras.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>{' '}
          {cadeiras >= 1.005 ? 'cadeiras' : 'de cadeira'} nos votos dele
        </span>
      )}
      <span className="tabular text-[0.84rem] text-tinta-2"><b className="text-tinta">{inteiro(votos)}</b> votos</span>
      {pct != null && (
        <span
          className="mt-1 block h-2 w-full overflow-hidden rounded-full border-2 border-tinta bg-folha"
          title={`Uma cadeira vale ${inteiro(qe ?? 0)} votos; ele teve ${pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% disso`}
          aria-hidden
        >
          <span className="block h-full bg-[var(--azul)]" style={{ width: `${Math.max(pct, 2)}%` }} />
        </span>
      )}
    </span>
  )
}

function CartaoCandidato({ c, maisVotado }: { c: EleitosLegenda['candidatos'][number]; maisVotado: boolean }) {
  return (
    <li>
      <Link
        to="/politico/$id"
        params={{ id: String(c.id) }}
        aria-label={`${nomeProprio(c.nome_urna || c.nome)}, ${c.partido}, ${inteiro(c.votos)} votos, ${c.situacao}, ${c.local}`}
        className="flex h-full items-start gap-3 rounded-[var(--canto)] border-[2.5px] border-tinta bg-folha p-3 transition-colors hover:bg-papel"
      >
        <Retrato foto={c.foto} nome={c.nome} tamanho={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-tinta">{nomeProprio(c.nome_urna || c.nome)}</span>
          {maisVotado && (
            <span className="mt-0.5 inline-block rounded-full bg-[var(--amarelo)] px-2 text-[0.68rem] font-extrabold leading-[1.45] text-tinta">mais votado</span>
          )}
          <Votos votos={c.votos} qe={c.qe} />
          <span className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-2">
            <Selo situacao={c.situacao} />
            <span className="text-[0.76rem] text-tinta-2">{c.partido}{c.numero != null ? ` · nº ${c.numero}` : ''}</span>
          </span>
          <span className="mt-1 block truncate text-[0.74rem] text-tinta-3">{c.local}</span>
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
    <div className={`mt-2 rounded-[var(--canto)] bg-papel-2 p-3 transition-opacity sm:p-4 ${q.isPlaceholderData ? 'opacity-55' : ''}`} aria-busy={q.isPlaceholderData}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.86rem] text-tinta-2">
          {inteiro(d.achados)} {d.achados === 1 ? 'candidato eleito' : 'candidatos eleitos'} {ROTULO_STATUS[situacao]}, do mais votado ao menos votado.
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
              className="h-10 w-full rounded-full border-[2.5px] border-tinta bg-folha pl-9 pr-3 text-[0.84rem] outline-none focus:border-[var(--azul)]"
            />
          </label>
        )}
      </div>
      {busca.length >= 2 && d.achados === 0 ? (
        <p className="rounded-lg bg-folha px-3 py-4 text-[0.86rem] text-tinta-2">Nenhum candidato encontrado com “{busca}”.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {d.candidatos.map((c, i) => <CartaoCandidato key={`${c.id}-${c.numero}`} c={c} maisVotado={i === 0 && !busca && d.desde === 0 && situacao === 'qp'} />)}
        </ul>
      )}
      {d.achados > limite && (
        <button
          type="button"
          onClick={() => setLimite((n) => n + 6)}
          disabled={q.isFetching}
          className="mt-3 rounded-full border-[2.5px] border-tinta bg-folha px-3 py-1.5 text-[0.84rem] font-bold text-tinta hover:bg-papel disabled:opacity-60"
        >
          Mostrar mais {Math.min(6, d.achados - limite)}
        </button>
      )}
      {q.error && <p role="alert" className="mt-3 text-[0.82rem] text-corrige">Falha ao atualizar os candidatos; mostrando os dados anteriores.</p>}
      {q.isPlaceholderData && <span className="sr-only" role="status">Atualizando candidatos...</span>}
    </div>
  )
}

/** Os anos, os cargos e o recorte escolhido, a partir do que a API devolveu. */
function derivar(dados: ResumoLegenda | undefined, busca: BuscaLegenda) {
  const recortes = dados?.recortes ?? []
  const anos = [...new Set(recortes.map((r) => r.ano))].sort((a, b) => a - b)
  const ano = busca.ano_p5 && anos.includes(busca.ano_p5) ? busca.ano_p5 : anos[anos.length - 1]
  const cargos = recortes.filter((r) => r.ano === ano).map((r) => r.cargo)
  const cargo = cargos.find((c) => c.cod === busca.cargo) ?? cargos[0]
  const recorte = recortes.find((r) => r.ano === ano && r.cargo.cod === cargo?.cod)
  return { recortes, anos, ano, cargos, cargo, recorte }
}

function SemCadeira({ conta }: { conta: ContaLegenda }) {
  const sem = conta.partidos.filter((p) => p.cadeiras === 0 && p.votos > 0)
  if (sem.length === 0) return null
  return (
    <details className="mt-4 rounded-[var(--canto)] border-[2.5px] border-tinta bg-folha px-4 py-3">
      <summary className="cursor-pointer font-bold text-tinta">Quem ficou sem cadeira ({sem.length} {sem.length === 1 ? 'partido' : 'partidos'})</summary>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {sem.map((p) => (
          <li key={p.sigla} className="tabular flex items-baseline justify-between gap-3 border-b border-linha py-1 text-[0.84rem]">
            <b className="text-tinta">{p.sigla}</b>
            <span className="text-tinta-2">{inteiro(p.votos)} votos · {p.quocientes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cadeiras</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function LegendaPagina() {
  const busca = useSearch({ from: '/cadeira/legenda' })
  const navegar = useNavigate({ from: '/cadeira/legenda' })
  const mudar = (s: Partial<BuscaLegenda>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const q = useQuery({ ...consultas.legenda(busca.uf ?? ''), placeholderData: keepPreviousData })
  const ufs = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const dados = q.data
  const { recortes, anos, ano, cargos, cargo, recorte } = derivar(dados, busca)

  const escolhidos = ufsDe(busca.uf)
  const [focoPedido, setFocoPedido] = useState<string | null>(null)
  const foco = escolhidos.length ? (focoPedido && escolhidos.includes(focoPedido) ? focoPedido : escolhidos[0]) : null
  const contaQ = useQuery({ ...consultas.contaLegenda(ano ?? 0, cargo?.cod ?? 0, foco ?? ''), enabled: !!foco && !!cargo, placeholderData: keepPreviousData })
  const conta = contaQ.data && contaQ.data.ano === ano && contaQ.data.cargo.cod === cargo?.cod && contaQ.data.uf === foco ? contaQ.data : undefined

  useEffect(() => {
    document.title = 'Eleitos pelo sistema proporcional · Voto Aberto'
  }, [])

  if (q.error && !dados) return <ErroCarga erro={q.error} />
  if (!dados || !ufs.data) return <Atrasado><EsqueletoPagina rotulo="Contando os eleitos por partido..." /></Atrasado>

  const partidos = recorte?.partidos ?? []
  const partidoAberto = partidos.find((p) => p.sigla === busca.partido)
  const situacao = busca.situacao ?? 'qp'
  const nomesUF = new Map(ufs.data.map((u) => [u.sigla, u.nome]))
  // a lista vem de todos os estados carregados, não da consulta (que já vem filtrada pelos escolhidos)
  const carregadasUF = ufs.data.filter((u) => u.carregada && u.sigla !== 'BR')
  const nomesEscolhidos = escolhidos.map((s) => nomesUF.get(s) ?? s)
  const escopoLocal = !recorte ? '' : escolhidos.length === 1 ? nomesEscolhidos[0]
    : escolhidos.length > 1 && escolhidos.length <= 3 ? nomesEscolhidos.join(' + ')
    : `${recorte.ufs_com_dados.length} estados com dados`
  // com um estado só, cada fileira ganha os votos do partido e a fração de cadeira que sobrou para ele
  const rico = escolhidos.length === 1 && cargo?.cod !== 13 && !!conta
  const porSigla = new Map((rico ? conta.partidos : []).map((p) => [p.sigla, p]))
  const linhas: DadoLinha[] = partidos.map((p) => {
    const c = porSigla.get(p.sigla)
    return {
      ...p, votos: c?.votos, quocientes: c?.quocientes, federado: c?.federado,
      cadeirasCandidatos: c && conta ? c.nominais / conta.qe : undefined,
      cadeirasLegenda: c && conta ? c.legenda / conta.qe : undefined,
    }
  })

  const escolherAno = (novo: number) => {
    const proximo = recortes.find((r) => r.ano === novo)
    mudar({ ano_p5: novo, cargo: proximo?.cargo.cod, partido: undefined, situacao: undefined })
  }
  const escolherCargo = (novo: number) => mudar({ cargo: novo, partido: undefined, situacao: undefined })
  const escolherUFs = (siglas: string[]) => mudar({ uf: siglas.length ? siglas.join(',') : undefined, partido: undefined, situacao: undefined })
  const abrir = (sigla: string, tipo: SituacaoLegenda) => {
    if (busca.partido === sigla && situacao === tipo) mudar({ partido: undefined, situacao: undefined })
    else mudar({ partido: sigla, situacao: tipo })
  }

  return (
    <main className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header className="max-w-[68ch]">
        <Voltar para="/cadeira" rotulo="Quanto custa uma cadeira?" className="mb-4 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[0.82rem] font-semibold text-acao hover:bg-papel" />
        <h1 className="t-display">Como os partidos preencheram as cadeiras?</h1>
        <p className="mt-3 text-[1.06rem] text-tinta-2">Cada quadrado é uma cadeira. O azul veio direto dos votos, o amarelo veio das sobras.</p>
      </header>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="t-rotulo mb-2 text-tinta-2">Eleição</legend>
          <div role="radiogroup" aria-label="Eleição" className="flex flex-wrap gap-2">
            {anos.map((a) => <Escolha key={a} ativo={a === ano} aoClicar={() => escolherAno(a)}>{a}</Escolha>)}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="t-rotulo mb-2 text-tinta-2">Cargo</legend>
          <div role="radiogroup" aria-label="Cargo" className="flex flex-wrap gap-2">
            {cargos.map((c) => <Escolha key={c.cod} ativo={c.cod === cargo?.cod} aoClicar={() => escolherCargo(c.cod)}>{c.nome}</Escolha>)}
          </div>
        </fieldset>
      </div>
      <fieldset className="mt-5 min-w-0">
        <legend className="t-rotulo mb-2 text-tinta-2">Estado</legend>
        <SeletorEstado malha={malha} ufs={carregadasUF} escolhida={escolhidos[0] ?? ''} aoEscolher={() => undefined} escolhidas={escolhidos} aoEscolherVarias={escolherUFs} />
      </fieldset>

      {q.error && (
        <p role="alert" className="mt-5 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.88rem]">
          Não foi possível atualizar esta seleção. Os números abaixo são da seleção anterior.
        </p>
      )}
      {!recorte || !cargo ? (
        <p className="mt-8 rounded-xl border border-linha bg-folha px-5 py-4 text-tinta-2">Não há resultados proporcionais neste recorte.</p>
      ) : (
        <>
          {foco && (
            <>
              {escolhidos.length > 1 && (
                <div role="radiogroup" aria-label="Ver a conta de qual estado" className="mt-8 flex flex-wrap items-center gap-2">
                  <span className="text-[0.86rem] font-semibold text-tinta-2">Ver a conta de</span>
                  {escolhidos.map((s) => <Escolha key={s} ativo={s === foco} aoClicar={() => setFocoPedido(s)}>{nomesUF.get(s) ?? s}</Escolha>)}
                </div>
              )}
              {conta ? (
                <Conta conta={conta} />
              ) : contaQ.error ? (
                <p role="alert" className="mt-6 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.88rem]">Não há a conta das cadeiras para este estado e eleição.</p>
              ) : (
                <Atrasado><EsqueletoBloco altura={180} linhas={2} rotulo="Fazendo a conta das cadeiras..." /></Atrasado>
              )}
            </>
          )}

          <section aria-labelledby="resumo-legenda" aria-busy={q.isPlaceholderData} className={`mt-10 transition-opacity ${q.isPlaceholderData ? 'opacity-55' : ''}`}>
            <h2 id="resumo-legenda" className="t-h2">As cadeiras de cada partido</h2>
            <p className="mt-2 max-w-[72ch] text-[clamp(1.02rem,0.95rem+0.35vw,1.2rem)] leading-relaxed text-tinta-2">
              Em {ano}, {escopoLocal}, foram eleitos <b className="tabular text-tinta">{inteiro(recorte.total.eleitos)}</b> {CARGOS_PLURAL[cargo.cod]}:
              {' '}<b className="tabular text-tinta">{inteiro(recorte.total.qp)}</b> direto dos votos e{' '}
              <b className="tabular text-tinta">{inteiro(recorte.total.media)}</b> pelas sobras.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.82rem] text-tinta-2" aria-label="Como ler">
              <span className="inline-flex items-center gap-2"><span className="size-4 rounded-[4px] border-2 border-tinta bg-[var(--azul)]" aria-hidden />direto dos votos</span>
              <span className="inline-flex items-center gap-2"><span className="size-4 rounded-[4px] border-2 border-tinta bg-[var(--amarelo)]" aria-hidden />das sobras</span>
              {rico && <span className="inline-flex items-center gap-2"><span className="size-4 rounded-[4px] border-2 border-dashed border-tinta-3 bg-folha" aria-hidden />quase uma cadeira</span>}
              <span className="text-tinta-3">Toque numa fileira para ver quem foi eleito.</span>
            </div>

            <div className={`mt-4 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
              <ul aria-label={`Partidos com eleitos: ${ano}, ${cargo.nome}`}>
                {linhas.map((p) => (
                  <LinhaCadeiras
                    key={p.sigla}
                    p={p}
                    aberto={partidoAberto?.sigla === p.sigla}
                    situacao={situacao}
                    aoAbrir={(tipo) => abrir(p.sigla, tipo)}
                    lista={rico ? conta?.lista ?? null : null}
                    filho={<Candidatos partido={p.sigla} ano={ano} cargo={cargo.cod} uf={busca.uf ?? ''} situacao={situacao} />}
                  />
                ))}
              </ul>
              {rico && conta && <SemCadeira conta={conta} />}
              <TabelaAlternavel
                titulo={`Candidatos eleitos por partido, ${cargo.nome}, ${ano}`}
                colunas={rico ? ['Partido', 'Votos', 'Direto dos votos', 'Pelas sobras', 'Total'] : ['Partido', 'Direto dos votos', 'Pelas sobras', 'Total']}
                linhas={() => linhas.map((p) => (rico
                  ? [p.sigla, inteiro(p.votos ?? 0), inteiro(p.qp), inteiro(p.media), inteiro(p.total)]
                  : [p.sigla, inteiro(p.qp), inteiro(p.media), inteiro(p.total)]))}
              />
            </div>
          </section>
          {q.isPlaceholderData && <span className="sr-only" role="status">Atualizando os resultados...</span>}
        </>
      )}
    </main>
  )
}
