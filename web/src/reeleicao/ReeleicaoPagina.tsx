// P10a: quem tenta a reeleição, volta? Três atos: a urna da reeleição (100 cédulas de eleitos que entram
// na urna de acrílico se tentaram e saem apuradas), com a subtela de quem são; eleição a
// eleição numa fila de urnas; e estado a estado num quadro de calor. O método fica na Metodologia.
// Todos os estados carregados somados por padrão, ou um só. Conta de scripts/10a_taxa_reeleicao.py,
// servida por /api/reeleicao e /api/reeleicao/pessoas.
import { ArrowRight, UsersThree } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { consultas, type ContaReeleicao, type GrupoReeleicao, type Malha, type Reeleicao, type UF } from '../api'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { Ciranda, CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargoPlural, inteiro, noEstado, pct } from '../lib/formato'
import type { BuscaReeleicao } from '../router'
import { EstadoAEstado } from './EstadoAEstado'
import { CiclosUrnas } from './CiclosUrnas'
import { COR, emCem, POUCOS, TODOS } from './conta'
import { QuemSao } from './QuemSao'
import { UrnaReeleicao, type Fase } from './UrnaReeleicao'

type Cargo = Reeleicao['cargos'][number]

const taxa = (n: number | null) => (n == null ? '-' : `${inteiro(Math.round(n))}%`)
// o ano que se lê é o da disputa da reeleição; o da eleição de origem vem miúdo
const anos = (c: Cargo) => `disputas de ${c.ciclos[0].disputa} a ${c.ciclos.at(-1)!.disputa}`
const suave = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

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

/** As fichas de cargo: escolher uma troca o caminho e abre quem são. A tira embaixo é a mesma conta em
 * miniatura (voltaram, perderam, não tentaram), sem trilho de fundo. */
function FichasCargo({ cargos, ativo, aoEscolher }: { cargos: Cargo[]; ativo: number; aoEscolher: (cod: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Cargo" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {cargos.map((c) => {
        const marcada = c.cod === ativo
        const cem = emCem(c.total)
        return (
          <button
            key={c.cod}
            type="button"
            role="radio"
            aria-checked={marcada}
            aria-label={`${c.nome}: de ${inteiro(c.total.eleitos)} eleitos, ${inteiro(c.total.tentaram)} tentaram a reeleição e ${inteiro(c.total.reeleitos)} voltaram (${taxa(c.total.taxa)}). Ver quem são.`}
            onClick={() => aoEscolher(c.cod)}
            className={`w-[11.5rem] shrink-0 snap-start rounded-2xl border px-3.5 pb-3 pt-2.5 text-left transition-[background-color,border-color,transform] active:scale-[0.985] lg:w-full ${
              marcada ? 'selecionado-fita' : 'border-linha bg-folha text-tinta hover:border-linha-2'
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-bold">{c.nome}</span>
                <span className={`block text-[0.75rem] tabular ${marcada ? 'text-white/85' : 'text-tinta-3'}`}>{inteiro(c.total.eleitos)} eleitos</span>
              </span>
              <span className="t-numero text-[1.7rem] tabular">{taxa(c.total.taxa)}</span>
            </span>
            <span aria-hidden className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full">
              <span style={{ width: `${cem.voltou}%`, background: marcada ? '#d2e19a' : COR.voltou }} />
              <span style={{ width: `${cem.perdeu}%`, background: marcada ? '#eae8e4' : COR.perdeu }} />
              <span className={marcada ? 'bg-white/25' : 'bg-linha'} style={{ width: `${cem.nao}%` }} />
            </span>
          </button>
        )
      })}
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

function Resposta({ dados, sigla, noUF, estados, malha, cargoPedido, mudar, erro, trocando }: {
  dados: Reeleicao
  /** a UF escolhida ou TODOS */
  sigla: string
  /** "no Piauí", "nos 6 estados carregados" */
  noUF: string
  estados: UF[]
  malha: Malha | undefined
  cargoPedido?: number
  mudar: (s: Partial<BuscaReeleicao>) => void
  erro: Error | null
  trocando: boolean
}) {
  const cargo = dados.cargos.find((c) => c.cod === cargoPedido) ?? dados.cargos[0]
  const tab = tabelaCiclos(cargo)
  const [aberta, setAberta] = useState(false)
  const [ciclo, setCiclo] = useState<number | null>(null)
  const [destaque, setDestaque] = useState<GrupoReeleicao | null>(null)
  const [fase, setFase] = useState<Fase>(0)

  const abrir = (g: GrupoReeleicao | null, eleitosEm: number | null = ciclo) => {
    setCiclo(eleitosEm)
    setDestaque(g)
    setAberta(true)
    // a subtela fica sob o caminho: rola até ela depois que abre
    setTimeout(() => document.getElementById('quem-sao')?.scrollIntoView({ behavior: suave(), block: 'nearest' }), 80)
  }
  const escolherCargo = (cod: number) => {
    mudar({ cargo: cod })
    setCiclo(null)
    setDestaque(null)
    setAberta(true)
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mt-4 max-w-[var(--miolo-max)] rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
          Não foi possível abrir este recorte ({erro.message}). Abaixo, o anterior.
        </p>
      )}

      <section aria-labelledby="caminho" aria-busy={trocando} className={`relative mt-10 max-w-[var(--miolo-max)] transition-opacity duration-300 ${trocando ? 'opacity-55' : ''}`}>
        {trocando && <div className="absolute right-0 top-0 z-10"><Ciranda rotulo="Contando..." tamanho={56} /></div>}
        <h2 id="caminho" className="t-h2">A urna da reeleição</h2>
        <p className="mt-1 max-w-[64ch] text-[0.95rem] text-tinta-2">
          Escolha um cargo, ponha na urna as cédulas de quem tentou se reeleger e apure. Toque em quem voltou, perdeu ou não tentou para ver quem são.
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <FichasCargo cargos={dados.cargos} ativo={cargo.cod} aoEscolher={escolherCargo} />
          <div className="min-w-0">
            <UrnaReeleicao conta={cargo.total} cargo={cargo.nome} uf={sigla === TODOS ? `${estados.length} ESTADOS` : sigla} anos={`${cargo.ciclos[0].disputa}-${cargo.ciclos.at(-1)!.disputa}`} fase={fase} aoMudarFase={setFase} aoAbrir={(g) => abrir(g)} />
            {fase === 2 && cargo.total.taxa != null && (
              <p className="revela mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="t-numero text-[clamp(2.4rem,1.8rem+1.6vw,3.4rem)] tabular" style={{ color: COR.texto }}>{taxa(cargo.total.taxa)}</span>
                <span className="max-w-[46ch] text-[1rem] text-tinta-2">
                  dos {cargoPlural(cargo.nome)} que <b className="font-semibold text-tinta">tentaram</b> a reeleição {noUF} voltaram ({inteiro(cargo.total.reeleitos)} de {inteiro(cargo.total.tentaram)}, {anos(cargo)}).
                  {' '}Na urna, são as {emCem(cargo.total).voltou} das {emCem(cargo.total).voltou + emCem(cargo.total).perdeu} cédulas que entraram.
                </span>
              </p>
            )}
            {!aberta && (
              <button type="button" onClick={() => abrir(null)} className="mt-3 inline-flex items-center gap-2 text-[0.92rem] font-semibold text-acao hover:underline">
                <UsersThree size={18} weight="bold" aria-hidden /> Quem são os {cargoPlural(cargo.nome)}?
              </button>
            )}
          </div>
        </div>
        {/* eleição a eleição fica logo abaixo da urna, no mesmo fluxo: escolher uma eleição abre quem são logo
            embaixo, sem ter de subir a página */}
        <section aria-labelledby="ciclos" className="mt-10 border-t border-linha pt-6">
          <h3 id="ciclos" className="t-h2 scroll-mt-24">Eleição a eleição</h3>
          <p className="mt-1 max-w-[64ch] text-[0.95rem] text-tinta-2">
            Cada urna é uma disputa {noUF}: dentro, os {cargoPlural(cargo.nome)} que tentaram se reeleger{cargo.municipal ? ', somando todos os municípios' : ''}. Toque numa urna para ver quem são.
            {cargo.cod === 5 ? ' O mandato de senador é de oito anos, então a disputa é oito anos depois da eleição.' : ''}
          </p>
          <div className="mt-5">
            <CiclosUrnas cargo={cargo} ativo={aberta ? (ciclo ?? cargo.ciclos.at(-1)!.eleitos_em) : null} aoEscolher={(e) => abrir(null, e)} />
          </div>
          <TabelaAlternavel titulo={`Reeleição de ${cargoPlural(cargo.nome)} ${noUF}, eleição a eleição`} colunas={tab.colunas} linhas={tab.linhas} />
        </section>
        <QuemSao
          key={`${sigla}-${cargo.cod}`}
          uf={sigla}
          ufNome={noUF}
          cargo={cargo}
          eleitosEm={ciclo}
          destaque={destaque}
          aoEscolherCiclo={setCiclo}
          aberta={aberta}
          aoFechar={() => setAberta(false)}
        />
      </section>

      <section aria-labelledby="estados" className="adiar mt-16 max-w-[var(--miolo-max)]">
        <h2 id="estados" className="t-h2">Estado a estado</h2>
        <p className="mb-5 mt-1 max-w-[64ch] text-[0.95rem] text-tinta-2">
          A taxa de cada cargo somando todas as eleições: primeiro os {estados.length} estados juntos, depois cada um.
        </p>
        <EstadoAEstado ufs={estados} malha={malha} aoAbrir={(s) => { mudar({ uf: s }); window.scrollTo({ top: 0, behavior: suave() }) }} />
        <Link to="/metodologia" hash="m-reeleicao" className="mt-6 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-acao hover:underline">
          Como a conta é feita <ArrowRight size={14} weight="bold" aria-hidden />
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

  // sem estado no endereço: todos os carregados somados
  const uf = carregadas.find((u) => u.sigla === busca.uf)
  const sigla = uf?.sigla ?? TODOS
  const noUF = uf ? noEstado(uf.sigla, uf.nome) : `nos ${carregadas.length} estados carregados`
  const q = useQuery({ ...consultas.reeleicao(sigla), enabled: carregadas.length > 0, placeholderData: keepPreviousData })
  const dados = q.data

  useEffect(() => {
    document.title = 'Quem tenta a reeleição, volta? · Voto Aberto'
  }, [])

  if (ufs && !carregadas.length) return <ErroCarga erro={new Error('Nenhum estado carregado no banco. Carregue um com: python -m loader PI')} />
  if (!ufs) return <CirandaTela rotulo="Abrindo a página..." />

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header>
        <h1 className="t-display">Quem tenta a reeleição, volta?</h1>
      </header>
      {/* a resposta fica ao lado da abertura no largo: o caminho aparece mais cedo na janela */}
      <div className="mt-4 grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="max-w-[60ch] text-[1.06rem] text-tinta-2">
            Dos eleitos em cada eleição, quantos disputaram o mesmo cargo, no mesmo lugar, na eleição seguinte, e quantos venceram de novo.
          </p>
          <fieldset className="mt-5 min-w-0">
            <legend className="t-rotulo mb-2 text-tinta-2">Estado</legend>
            <SeletorEstado malha={malha} ufs={carregadas} escolhida={uf?.sigla ?? ''} aoEscolher={(s) => mudar({ uf: s })} />
          </fieldset>
        </div>
        {dados && <Lede dados={dados} nome={noUF} />}
      </div>

      {dados ? (
        <Resposta
          dados={dados}
          sigla={sigla}
          noUF={noUF}
          estados={carregadas}
          malha={malha}
          cargoPedido={busca.cargo}
          mudar={mudar}
          erro={q.error}
          trocando={q.isPlaceholderData}
        />
      ) : q.error ? (
        <div className="mt-8"><ErroCarga erro={q.error} compacto /></div>
      ) : (
        <div className="grid min-h-[50dvh] place-items-center"><Ciranda rotulo="Contando as reeleições..." /></div>
      )}
    </div>
  )
}
