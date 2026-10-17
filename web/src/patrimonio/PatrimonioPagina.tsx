// P2: a taxa de sucesso eleitoral por faixa de patrimônio declarado.
// A página mantém a leitura em camadas do site: resposta curta, gráfico legível e tabela sob demanda.
import { ArrowRight } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { CARGOS_P2, consultas, type Ano, type GrupoPatrimonio, type Patrimonio } from '../api'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, pct, reais } from '../lib/formato'
import type { BuscaPatrimonio } from '../router'

const ANOS_GERAIS: Ano[] = [2018, 2022]
const ANOS_MUNICIPAIS: Ano[] = [2020, 2024]

function limites(g: GrupoPatrimonio) {
  if (g.de == null || g.ate == null) return 'fora dos quartis'
  return `${reais(g.de)} a ${reais(g.ate)}`
}

function FraseResposta({ dados }: { dados: Patrimonio }) {
  const quartis = dados.grupos.filter((g) => g.tipo === 'quartil')
  const q1 = quartis[0]
  const q4 = quartis[quartis.length - 1]
  if (!q1 || !q4) return null
  const lugar = dados.escopo.nacional ? 'na disputa presidencial nacional' : dados.escopo.uf ? `em ${dados.escopo.uf}` : 'nas UFs carregadas'
  return (
    <p className="max-w-[66ch] text-[clamp(1.05rem,0.95rem+0.45vw,1.28rem)] font-medium leading-[1.45] text-tinta-2" style={{ fontStretch: '96%' }}>
      {dados.sintese.maior_supera_menor ? (
        <>
          <b className="text-tinta">Sim, neste recorte.</b> {lugar}, a taxa de eleição foi de{' '}
          <b className="tabular text-tinta">{pct(q1.taxa)}</b> no menor quartil e{' '}
          <b className="tabular text-tinta">{pct(q4.taxa)}</b> no maior: uma diferença de{' '}
          <b className="tabular text-tinta">{pct(dados.sintese.diferenca_pp, 1)}</b>.
        </>
      ) : (
        <>
          <b className="text-tinta">Não de forma linear neste recorte.</b> {lugar}, o menor e o maior quartil tiveram{' '}
          <b className="tabular text-tinta">{pct(q1.taxa)}</b> e <b className="tabular text-tinta">{pct(q4.taxa)}</b>, respectivamente.
        </>
      )}
    </p>
  )
}

function BarraPatrimonio({ grupo, teto }: { grupo: GrupoPatrimonio; teto: number }) {
  const largura = grupo.taxa ? Math.max(2, (100 * grupo.taxa) / teto) : 0
  const quartil = grupo.tipo === 'quartil'
  return (
    <li>
      <div className="grid gap-x-4 gap-y-1 rounded-xl px-2 py-2 hover:bg-papel-2/55 sm:grid-cols-[15rem_minmax(0,1fr)_6.5rem] sm:items-center">
        <div className="min-w-0">
          <p className={`truncate text-[0.92rem] leading-tight ${quartil ? 'font-bold text-tinta' : 'font-semibold text-tinta-2'}`}>{grupo.rotulo}</p>
          <p className="tabular text-[0.75rem] text-tinta-3">{limites(grupo)}</p>
        </div>
        <div className="relative h-8 overflow-hidden rounded-md bg-papel-2 max-sm:mt-1" aria-hidden>
          <span
            className={`absolute inset-y-0 left-0 rounded-md transition-[width] duration-500 ${quartil ? 'bg-eleito' : 'bg-tinta-3/35'}`}
            style={{ width: `${largura}%` }}
          />
        </div>
        <div className="flex items-baseline justify-end gap-2 sm:block sm:text-right">
          <span className="t-numero tabular text-[1.55rem] text-tinta">{pct(grupo.taxa)}</span>
          <span className="tabular text-[0.76rem] text-tinta-3">{inteiro(grupo.eleitos)} de {inteiro(grupo.candidatos)}</span>
        </div>
      </div>
    </li>
  )
}

function Resumo({ dados }: { dados: Patrimonio }) {
  const cards = [
    { rotulo: 'Candidaturas aptas', valor: inteiro(dados.resumo.candidatos) },
    { rotulo: 'Eleitos', valor: inteiro(dados.resumo.eleitos) },
    { rotulo: 'Com bens registrados', valor: `${pct(dados.resumo.cobertura_pct)}` },
    { rotulo: 'Sem registro de bens', valor: inteiro(dados.resumo.sem_bens) },
  ]
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.rotulo} className="rounded-2xl border border-linha bg-folha px-4 py-3 shadow-[var(--shadow-cartao)]">
          <p className="t-rotulo text-tinta-3">{card.rotulo}</p>
          <p className="mt-1 t-numero tabular text-[1.75rem]">{card.valor}</p>
        </div>
      ))}
    </div>
  )
}

export function PatrimonioPagina() {
  const busca = useSearch({ from: '/patrimonio' })
  const navegar = useNavigate({ from: '/patrimonio' })
  const mudar = (s: Partial<BuscaPatrimonio>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const { data: ufs } = useQuery(consultas.ufs())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), [ufs])
  const cargo = CARGOS_P2.find((c) => c.cod === busca.cargo) ?? CARGOS_P2[CARGOS_P2.length - 1]
  const anos = cargo.municipal ? ANOS_MUNICIPAIS : ANOS_GERAIS
  const ano = busca.ano && anos.includes(busca.ano) ? busca.ano : anos[anos.length - 1]
  const uf = !cargo.nacional && busca.uf && carregadas.some((u) => u.sigla === busca.uf) ? busca.uf : ''
  const q = useQuery({ ...consultas.patrimonio(ano, cargo.cod, uf), placeholderData: keepPreviousData })
  const dados = q.data

  useEffect(() => {
    document.title = 'Patrimônio e chance de eleição · Voto Aberto'
  }, [])

  if (q.error && !dados) return <ErroCarga erro={q.error} />
  if (!dados) return <CirandaTela rotulo="Somando os bens declarados..." />

  const grupos = dados.grupos
  const teto = Math.max(10, Math.ceil(Math.max(...grupos.map((g) => g.taxa), 0) / 5) * 5)
  const lugar = dados.escopo.nacional ? 'Brasil' : dados.escopo.uf ?? `${dados.escopo.ufs.length} estados`
  const tabela = grupos.map((g) => [g.rotulo, limites(g), inteiro(g.candidatos), inteiro(g.eleitos), pct(g.taxa)])

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7" aria-busy={q.isPlaceholderData}>
      <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="mb-2 inline-flex rounded-full border border-escolha/50 bg-escolha-claro px-3 py-1 text-[0.74rem] font-bold uppercase tracking-[0.08em] text-tinta">
            Protótipo temporário · P2
          </p>
          <h1 className="t-display">Patrimônio e chance de eleição</h1>
          <div className="mt-4"><FraseResposta dados={dados} /></div>
          <p className="mt-2 text-[0.82rem] text-tinta-3">
            {dados.ano} · {dados.cargo.nome} · {lugar} · patrimônio declarado ao TSE
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end lg:grid-cols-1">
          <fieldset>
            <legend className="t-rotulo mb-1.5 text-tinta-2">Eleição</legend>
            <CedulaAnos ano={ano} anos={anos} linhaDoTempo={false} aoMudar={(a) => mudar({ ano: a })} />
          </fieldset>
        </div>
      </header>

      <div className="mt-7 space-y-5">
        <fieldset>
          <legend className="t-rotulo mb-2 text-tinta-2">Cargo</legend>
          <div role="radiogroup" aria-label="Cargo" className="flex flex-wrap gap-2">
            {CARGOS_P2.map((c) => (
              <Escolha key={c.cod} ativo={c.cod === cargo.cod} aoClicar={() => mudar({ cargo: c.cod, ano: undefined, uf: undefined })}>
                {c.nome}
              </Escolha>
            ))}
          </div>
        </fieldset>
        {!cargo.nacional && (
          <fieldset>
            <legend className="t-rotulo mb-2 text-tinta-2">Onde</legend>
            <div role="radiogroup" aria-label="Estado" className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible">
              <Escolha ativo={!uf} aoClicar={() => mudar({ uf: undefined })}>{carregadas.length} estados</Escolha>
              {carregadas.map((u) => (
                <Escolha key={u.sigla} rotulo={u.nome} ativo={u.sigla === uf} aoClicar={() => mudar({ uf: u.sigla })}>{u.sigla}</Escolha>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <main className="mt-12 space-y-12">
        <Resumo dados={dados} />

        <section aria-labelledby="faixas-patrimonio" className="space-y-4">
          <div>
            <h2 id="faixas-patrimonio" className="t-h1">A taxa sobe com o patrimônio?</h2>
            <p className="mt-3 max-w-[70ch] text-[0.98rem] leading-relaxed text-tinta-2">
              Os quartis são calculados apenas entre os patrimônios positivos deste recorte. A barra mostra a proporção de candidaturas aptas que terminou eleita; o número ao lado mantém o tamanho real de cada grupo visível.
            </p>
          </div>
          <ol className="grid gap-y-1" aria-label="Taxa de eleição por faixa de patrimônio">
            {grupos.map((grupo) => <BarraPatrimonio key={grupo.id} grupo={grupo} teto={teto} />)}
          </ol>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-linha pt-3 text-[0.82rem] text-tinta-3">
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-eleito" aria-hidden /> Quartis de patrimônio positivo</span>
            <span>Sem registro e zero declarado ficam fora dos quartis.</span>
          </div>
          <TabelaAlternavel titulo="Taxa de sucesso por patrimônio declarado" colunas={['Faixa', 'Limites', 'Candidatos', 'Eleitos', 'Taxa']} linhas={tabela} />
        </section>

        <section className="grid gap-5 border-t border-linha pt-8 md:grid-cols-2">
          <div className="rounded-2xl border border-linha bg-folha p-5">
            <h2 className="t-h2">Como ler</h2>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-tinta-2">
              “Sem registro de bens” significa que não apareceu uma linha de bem para a candidatura. Não é correto transformar automaticamente essa ausência em patrimônio zero. O zero declarado é um grupo separado.
            </p>
          </div>
          <div className="rounded-2xl border border-linha bg-folha p-5">
            <h2 className="t-h2">Cuidado com a conclusão</h2>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-tinta-2">
              A comparação mostra associação entre patrimônio declarado e eleição dentro de cada disputa. Ela não prova que patrimônio causa vitória e não representa patrimônio real ou renda do candidato.
            </p>
          </div>
        </section>

        <p className="border-t border-linha pt-4 text-[0.84rem] leading-relaxed text-tinta-3">
          {dados.resumo.sem_bens ? <><b className="text-tinta">{pct(100 - dados.resumo.cobertura_pct)} das candidaturas</b> deste recorte não têm bens registrados.</> : 'Todas as candidaturas deste recorte têm bens registrados.'}{' '}
          <Link to="/metodologia" hash="m-patrimonio" className="inline-flex items-center gap-1 font-semibold text-acao hover:underline">Como medimos <ArrowRight size={14} weight="bold" aria-hidden /></Link>
        </p>
      </main>
    </div>
  )
}
