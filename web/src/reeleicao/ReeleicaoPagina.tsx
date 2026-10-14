// P10a: quem tenta a reeleição, volta? Por cargo, o que aconteceu com cada 100 eleitos (voltaram,
// tentaram e perderam, não tentaram); depois a taxa eleição a eleição e estado a estado.
// Conta de scripts/10a_taxa_reeleicao.py, servida por /api/reeleicao.
import { ArrowRight } from '@phosphor-icons/react'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { consultas, type ContaReeleicao, type Reeleicao, type UF } from '../api'
import { silhueta } from '../atlas/geo'
import { Ciranda, CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargoPlural, inteiro, noEstado, pct } from '../lib/formato'
import type { BuscaReeleicao } from '../router'

type Cargo = Reeleicao['cargos'][number]

// as três partes de cada 100 eleitos; a cor nunca vem sozinha (os números ficam embaixo da barra)
const PARTES = [
  { chave: 'voltaram', rotulo: '% voltaram', cor: 'var(--color-reeleito)' },
  { chave: 'perderam', rotulo: '% tentaram e perderam', cor: 'var(--color-linha-2)' },
  { chave: 'nao', rotulo: '% não tentaram', cor: 'var(--color-folha)' },
] as const
const HACHURA = 'repeating-linear-gradient(135deg, var(--color-linha) 0 2px, transparent 2px 7px)'
// cargos com menos tentativas que isso não entram na comparação da frase de abertura
const POUCOS = 10

const partes = (c: ContaReeleicao) => [c.reeleitos, c.tentaram - c.reeleitos, c.eleitos - c.tentaram]
const taxa = (n: number | null) => (n == null ? '-' : `${inteiro(Math.round(n))}%`)
// o ano que se lê é o da disputa da reeleição; o da eleição de origem vem miúdo
const anos = (c: Cargo) => `disputas de ${c.ciclos[0].disputa} a ${c.ciclos.at(-1)!.disputa}`

function Lede({ dados, nome }: { dados: Reeleicao; nome: string }) {
  const b = (t: string) => <b className="tabular font-bold text-tinta">{t}</b>
  const comparaveis = dados.cargos.filter((c) => c.total.tentaram >= POUCOS).toSorted((a, b) => b.total.taxa! - a.total.taxa!)
  const [maior, menor] = [comparaveis[0], comparaveis.at(-1)]
  const m = dados.municipais
  const Nome = nome.charAt(0).toUpperCase() + nome.slice(1)
  return (
    <p className="max-w-[56ch] text-[clamp(1.1rem,0.95rem+0.55vw,1.35rem)] font-medium leading-[1.42] text-tinta-2" style={{ fontStretch: '96%' }}>
      {maior && menor && maior !== menor ? (
        <>
          {Nome}, dos {cargoPlural(maior.nome)} que tentaram se reeleger, {b(taxa(maior.total.taxa))} conseguiram; dos {cargoPlural(menor.nome)}, {b(taxa(menor.total.taxa))}.
        </>
      ) : maior ? (
        <>
          {Nome}, dos {cargoPlural(maior.nome)} que tentaram se reeleger, {b(taxa(maior.total.taxa))} conseguiram.
        </>
      ) : (
        <>{Nome}, poucos eleitos tentaram a reeleição até agora.</>
      )}
      {m && m.taxa != null && (
        <>
          {' '}Nos municípios, prefeitos e vereadores somados, {b(inteiro(m.reeleitos))} de {b(inteiro(m.tentaram))} voltaram ({b(taxa(m.taxa))}).
        </>
      )}
    </p>
  )
}

/** De cada 100 eleitos: a barra inteira são os eleitos, dividida no que aconteceu na eleição seguinte. */
function Barra100({ conta }: { conta: ContaReeleicao }) {
  const p = partes(conta)
  return (
    <span className="block min-w-0">
      <span aria-hidden className="flex h-4 w-full overflow-hidden rounded-[4px] border border-linha-2 bg-folha">
        {p.map((v, i) =>
          v > 0 ? (
            <span
              key={PARTES[i].chave}
              className="h-full border-r border-folha last:border-r-0"
              style={{ width: `${(v / conta.eleitos) * 100}%`, background: PARTES[i].cor }}
            />
          ) : null,
        )}
      </span>
      <span className="mt-1.5 flex flex-wrap gap-x-3 text-[0.78rem] text-tinta-3 tabular">
        {p.map((v, i) => (
          <span key={PARTES[i].chave}>
            <b className="font-semibold text-tinta-2">{inteiro(Math.round((v / conta.eleitos) * 100))}</b> {PARTES[i].rotulo}
          </span>
        ))}
      </span>
    </span>
  )
}

function Legenda() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-tinta-2">
      {PARTES.map((p) => (
        <li key={p.chave} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] border border-linha-2" style={{ background: p.cor }} />
          {p.rotulo}
        </li>
      ))}
    </ul>
  )
}

function PorCargo({ dados, cargo, aoEscolher }: { dados: Reeleicao; cargo: number; aoEscolher: (cod: number) => void }) {
  return (
    <ul className="divide-y divide-linha border-y border-linha">
      {dados.cargos.map((c) => {
        const ativo = c.cod === cargo
        return (
          <li key={c.cod}>
            <button
              type="button"
              aria-pressed={ativo}
              aria-label={`${c.nome}: de ${inteiro(c.total.eleitos)} eleitos, ${inteiro(c.total.tentaram)} tentaram a reeleição e ${inteiro(c.total.reeleitos)} voltaram (${taxa(c.total.taxa)}). Ver eleição a eleição.`}
              onClick={() => aoEscolher(c.cod)}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-3 py-4 text-left transition-colors sm:grid-cols-[12rem_minmax(0,1fr)_auto] ${ativo ? 'bg-folha' : 'hover:bg-folha/60'}`}
            >
              <span className="min-w-0">
                <span className={`block t-h3 ${ativo ? 'underline decoration-marcador decoration-4 underline-offset-[6px]' : ''}`}>{c.nome}</span>
                <span className="mt-1 block text-[0.8rem] text-tinta-3">
                  {inteiro(c.total.eleitos)} eleitos, {anos(c)}
                </span>
              </span>
              <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                <Barra100 conta={c.total} />
              </span>
              <span className="text-right">
                <span className="t-numero block text-[clamp(1.8rem,1.4rem+1vw,2.3rem)] text-tinta">{taxa(c.total.taxa)}</span>
                <span className="mt-1 block whitespace-nowrap text-[0.78rem] text-tinta-3 tabular">
                  {inteiro(c.total.reeleitos)} de {inteiro(c.total.tentaram)} que tentaram
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Uma coluna por eleição de origem: a altura é a taxa (reeleitos ÷ tentaram). */
function Ciclos({ cargo }: { cargo: Cargo }) {
  const geral = cargo.total.taxa
  return (
    <div className="grid grid-cols-[2.2rem_minmax(0,1fr)] gap-x-2">
      <div aria-hidden className="relative h-[220px] text-right text-[0.72rem] text-tinta-3 tabular">
        {[100, 50, 0].map((v) => (
          <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - v}%` }}>
            {v}%
          </span>
        ))}
      </div>
      <ol className="grid gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${cargo.ciclos.length}, minmax(0, 1fr))` }}>
        {cargo.ciclos.map((c) => (
          <li
            key={c.eleitos_em}
            aria-label={`Disputa de ${c.disputa}, eleitos em ${c.eleitos_em}: ${
              c.tentaram ? `${inteiro(c.reeleitos)} de ${inteiro(c.tentaram)} que tentaram voltaram (${pct(c.taxa)})` : 'nenhum eleito tentou'
            }${c.media_municipios != null ? `; média dos municípios ${pct(c.media_municipios)}` : ''}.`}
          >
            <div aria-hidden className="relative h-[220px] border-b border-tinta-3">
              {[50, 100].map((v) => (
                <span key={v} className="absolute inset-x-0 border-t border-linha" style={{ top: `${100 - v}%` }} />
              ))}
              {c.taxa == null ? (
                <span className="absolute inset-x-[12%] bottom-0 h-8 rounded-t-[4px]" style={{ background: HACHURA }} />
              ) : (
                <span
                  className="absolute inset-x-[12%] bottom-0 h-full origin-bottom rounded-t-[4px] bg-reeleito transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
                  style={{ transform: `scaleY(${c.taxa / 100})` }}
                />
              )}
              {c.media_municipios != null && (
                <span className="absolute inset-x-[4%] border-t-[3px] border-dotted border-tinta" style={{ bottom: `${c.media_municipios}%` }} />
              )}
              <span
                className="t-numero absolute inset-x-0 text-center text-[clamp(0.95rem,0.8rem+0.5vw,1.25rem)] text-tinta transition-[bottom] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
                style={{ bottom: `calc(${c.taxa == null ? 0 : c.taxa}% + ${c.taxa == null ? 38 : 6}px)` }}
              >
                {c.taxa == null ? 'ninguém' : taxa(c.taxa)}
              </span>
            </div>
            <p className="mt-2 text-center t-rotulo tabular">{c.disputa}</p>
            <p className="text-center text-[0.72rem] text-tinta-3 tabular">
              <span className="hidden sm:inline">eleitos em </span>
              <span className="sm:hidden">de </span>
              {c.eleitos_em}
            </p>
            <p className="mt-1 text-center text-[0.72rem] text-tinta-3 tabular">
              {inteiro(c.reeleitos)}/{inteiro(c.tentaram)}
            </p>
          </li>
        ))}
      </ol>
      <div className="col-start-2 mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-tinta-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] bg-reeleito" /> taxa de reeleição: voltaram ÷ tentaram
        </span>
        {cargo.municipal && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-4 border-t-[3px] border-dotted border-tinta" /> média das taxas dos municípios
          </span>
        )}
        <span>embaixo: voltaram / tentaram{geral != null ? `; somando tudo, ${pct(geral)}` : ''}</span>
      </div>
    </div>
  )
}

function tabelaCiclos(cargo: Cargo) {
  const linha = (disputa: string, origem: string, c: ContaReeleicao) => [
    disputa,
    origem,
    inteiro(c.eleitos),
    inteiro(c.tentaram),
    pct(c.eleitos ? (100 * c.tentaram) / c.eleitos : null),
    inteiro(c.reeleitos),
    pct(c.taxa),
    ...(cargo.municipal ? [pct(c.media_municipios)] : []),
  ]
  return {
    colunas: ['Disputa', 'Eleitos em', 'Eleitos', 'Tentaram', '% dos eleitos', 'Reeleitos', 'Taxa', ...(cargo.municipal ? ['Média municípios'] : [])],
    linhas: () => [...cargo.ciclos.map((c) => linha(String(c.disputa), String(c.eleitos_em), c)), linha('Total', '', cargo.total)],
  }
}

/** Um cargo por linha, um estado por coluna: a taxa somada de todas as eleições. */
function Estados({ siglas, uf, aoEscolher }: { siglas: string[]; uf: string; aoEscolher: (sigla: string) => void }) {
  const qs = useQueries({ queries: siglas.map((s) => consultas.reeleicao(s)) })
  const porUF = new Map(siglas.map((s, i) => [s, qs[i]]))
  const cargos = qs.find((q) => q.data)?.data?.cargos.map((c) => ({ cod: c.cod, nome: c.nome })) ?? []
  if (!cargos.length) return <div className="grid h-40 place-items-center"><Ciranda rotulo="Contando os estados..." tamanho={72} /></div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[0.86rem] tabular">
        <caption className="sr-only">Taxa de reeleição por cargo e estado, somando todas as eleições</caption>
        <thead>
          <tr>
            <th scope="col" className="py-2 pr-3 text-left t-rotulo text-tinta-3">Cargo</th>
            {siglas.map((s) => (
              <th key={s} scope="col" className="px-1 py-2">
                <button
                  type="button"
                  onClick={() => aoEscolher(s)}
                  aria-pressed={s === uf}
                  className={`w-full rounded-full px-2 py-1 font-semibold transition-colors ${s === uf ? 'bg-tinta text-white' : 'text-tinta-2 hover:bg-folha hover:text-tinta'}`}
                >
                  {s}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargos.map((c) => (
            <tr key={c.cod} className="border-t border-linha">
              <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-tinta">{c.nome}</th>
              {siglas.map((s) => {
                const q = porUF.get(s)!
                const t = q.data?.cargos.find((x) => x.cod === c.cod)?.total
                return (
                  <td key={s} className={`px-2 py-2.5 align-top ${s === uf ? 'bg-folha' : ''}`} aria-busy={q.isPending}>
                    {q.isPending ? (
                      <span className="text-tinta-3">...</span>
                    ) : !t || t.taxa == null ? (
                      <span className="text-tinta-3">-</span>
                    ) : (
                      <>
                        <span className={`block font-bold ${t.tentaram < POUCOS ? 'text-tinta-2' : 'text-tinta'}`}>{taxa(t.taxa)}</span>
                        <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-papel-2">
                          <span className="block h-full rounded-full bg-reeleito" style={{ width: `${t.taxa}%` }} />
                        </span>
                        <span className="mt-1 block text-[0.72rem] text-tinta-3">
                          {inteiro(t.reeleitos)}/{inteiro(t.tentaram)}
                        </span>
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Resposta({ dados, uf, carregadas, cargoPedido, mudar, erro, trocando }: {
  dados: Reeleicao
  uf: UF
  carregadas: UF[]
  cargoPedido?: number
  mudar: (s: Partial<BuscaReeleicao>) => void
  erro: Error | null
  trocando: boolean
}) {
  const ufDados = carregadas.find((u) => u.sigla === dados.uf) ?? uf
  const cargo = dados.cargos.find((c) => c.cod === cargoPedido) ?? dados.cargos[0]
  const tab = tabelaCiclos(cargo)
  const escolherCargo = (cod: number) => {
    mudar({ cargo: cod })
    document.getElementById('ciclos')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mt-4 max-w-[1180px] rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
          Não foi possível abrir {uf.nome} ({erro.message}). Abaixo, o estado anterior.
        </p>
      )}

      <section aria-labelledby="por-cargo" aria-busy={trocando} className={`relative mt-8 max-w-[1180px] transition-opacity duration-300 ${trocando ? 'opacity-55' : ''}`}>
        {trocando && <div className="absolute right-0 top-0"><Ciranda rotulo="Contando..." tamanho={56} /></div>}
        <Lede dados={dados} nome={noEstado(ufDados.sigla, ufDados.nome)} />
        <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h2 id="por-cargo" className="t-h2">De cada 100 eleitos, na eleição seguinte</h2>
            <p className="mt-1 text-[0.9rem] text-tinta-2">À direita, a taxa de reeleição: dos que tentaram, quantos voltaram. Toque num cargo para ver eleição a eleição.</p>
          </div>
          <Legenda />
        </div>
        <div className="mt-4">
          <PorCargo dados={dados} cargo={cargo.cod} aoEscolher={escolherCargo} />
        </div>
      </section>

      <section aria-labelledby="ciclos" className="mt-16 max-w-[1180px] scroll-mt-24">
        <h2 id="ciclos" className="t-h2 scroll-mt-24">Eleição a eleição</h2>
        <p className="mt-1 max-w-[64ch] text-[0.9rem] text-tinta-2">
          Cada coluna é uma eleição {noEstado(ufDados.sigla, ufDados.nome)}: a parte dos {cargoPlural(cargo.nome)} que estavam no cargo, tentaram se reeleger nela e venceram
          {cargo.municipal ? ' (somando todos os municípios)' : ''}. Embaixo, o ano em que eles tinham se elegido{cargo.cod === 5 ? ' (oito anos antes, porque o mandato de senador é de oito anos)' : ''}.
        </p>
        <div role="radiogroup" aria-label="Cargo" className="mt-4 flex flex-wrap gap-2">
          {dados.cargos.map((c) => (
            <Escolha key={c.cod} ativo={c.cod === cargo.cod} aoClicar={() => mudar({ cargo: c.cod })}>
              {c.nome}
            </Escolha>
          ))}
        </div>
        <div className="mt-8">
          <Ciclos cargo={cargo} />
        </div>
        <TabelaAlternavel titulo={`Reeleição de ${cargoPlural(cargo.nome)} ${noEstado(ufDados.sigla, ufDados.nome)}, eleição a eleição`} colunas={tab.colunas} linhas={tab.linhas} />
      </section>

      <section aria-labelledby="estados" className="adiar mt-16 max-w-[1180px]">
        <h2 id="estados" className="t-h2">Estado a estado</h2>
        <p className="mb-5 mt-1 max-w-[64ch] text-[0.9rem] text-tinta-2">
          A taxa de cada cargo somando todas as eleições, nos {carregadas.length} estados carregados no banco. Em cinza, cargos com menos de {POUCOS} tentativas: poucos casos mudam muito a taxa.
        </p>
        <Estados siglas={carregadas.map((u) => u.sigla)} uf={uf.sigla} aoEscolher={(s) => mudar({ uf: s })} />
      </section>

      <section aria-labelledby="conta" className="adiar mt-16 max-w-[1180px]">
        <h2 id="conta" className="t-h2">Como a conta é feita</h2>
        <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-[0.95rem] leading-relaxed text-tinta-2 [&_b]:text-tinta">
          <li><b>Tentou a reeleição:</b> foi candidato ao mesmo cargo, na mesma UF ou município, na eleição ordinária seguinte (senador, oito anos depois). O banco não guarda a marca de reeleição do TSE, então candidaturas indeferidas ou renunciadas também contam.</li>
          <li><b>Fora da conta:</b> eleições suplementares, presidente (disputa nacional) e vices e suplentes, que o TSE só marca como eleitos a partir de 2012 e 2014.</li>
          <li>
            <b>A mesma pessoa:</b> ligada entre eleições pelo título eleitoral. Em 1994 e 1996 metade das candidaturas não tem título; {noEstado(ufDados.sigla, ufDados.nome)}, {inteiro(dados.ligados_por_nome)} tentativas foram achadas pelo nome ou pela data de nascimento.
          </li>
          {dados.fora.length > 0 && (
            <li>
              <b>Ainda sem a eleição seguinte:</b> {dados.fora.map((f) => `${f.cargo.toLowerCase()} eleito em ${f.eleitos_em}`).join(', ')}.
            </li>
          )}
        </ul>
        <Link to="/metodologia" hash="m-carreira" className="mt-4 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-acao hover:underline">
          Metodologia e consultas <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </section>
    </>
  )
}

export function ReeleicaoPagina() {
  const busca = useSearch({ from: '/reeleicao' })
  const navegar = useNavigate({ from: '/reeleicao' })
  const mudar = (s: Partial<BuscaReeleicao>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), [ufs])
  const silhuetas = useMemo(() => new Map(malha ? carregadas.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 22)]) : []), [malha, carregadas])

  const uf = carregadas.find((u) => u.sigla === busca.uf) ?? carregadas.find((u) => u.sigla === 'PI') ?? carregadas[0]
  const q = useQuery({ ...consultas.reeleicao(uf?.sigla ?? ''), enabled: !!uf, placeholderData: keepPreviousData })
  const dados = q.data

  useEffect(() => {
    document.title = 'Quem tenta a reeleição, volta? · Voto Aberto'
  }, [])

  if (ufs && !uf) return <ErroCarga erro={new Error('Nenhum estado carregado no banco. Carregue um com: python -m loader PI')} />
  if (!uf) return <CirandaTela rotulo="Abrindo a página..." />

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 md:px-[72px] md:pt-7">
      <header>
        <h1 className="t-display">Quem tenta a reeleição, volta?</h1>
        <p className="mt-3 max-w-[60ch] text-[1.06rem] text-tinta-2">
          Dos eleitos em cada eleição, quantos disputaram o mesmo cargo, no mesmo lugar, na eleição seguinte, e quantos venceram de novo.
        </p>
      </header>

      <fieldset className="mt-6 min-w-0">
        <legend className="t-rotulo mb-2 text-tinta-2">Estado</legend>
        <div role="radiogroup" aria-label="Estado" className="flex flex-wrap gap-2">
          {carregadas.map((u) => (
            <Escolha key={u.sigla} rotulo={u.nome} ativo={u.sigla === uf.sigla} aoClicar={() => mudar({ uf: u.sigla })}>
              <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden className="shrink-0">
                <path d={silhuetas.get(u.sigla)} fill="currentColor" opacity={0.85} />
              </svg>
              {u.sigla}
            </Escolha>
          ))}
        </div>
      </fieldset>

      {dados ? (
        <Resposta dados={dados} uf={uf} carregadas={carregadas} cargoPedido={busca.cargo} mudar={mudar} erro={q.error} trocando={q.isPlaceholderData} />
      ) : q.error ? (
        <div className="mt-8"><ErroCarga erro={q.error} compacto /></div>
      ) : (
        <div className="grid min-h-[50dvh] place-items-center"><Ciranda rotulo="Contando as reeleições..." /></div>
      )}
    </div>
  )
}
