// P3: os índices do município andam com o lado do voto? Dois gráficos de dispersão, um ponto por município:
// o viés da eleição (-100 esquerda a +100 direita) contra o índice escolhido (IFDM do ano da eleição, as três áreas
// dele, PIB per capita, eleitores por habitante e isentos); e o desvio padrão do viés nas eleições municipais contra
// o IFDM mais recente, sem olhar o lado: o voto que se repete de eleição em eleição. Um estado ou todos os carregados.
// Dados de /api/indices; o método fica na Metodologia (#m-indices).
import { ArrowRight } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { consultas, type Ano, type IndicesVies } from '../api'
import { Atrasado, EsqueletoBloco, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { decimal, inteiro, noEstado, ufsFrase, vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'
import { INDICES_P3, type BuscaIndices, type IndiceP3 } from '../router'
import { DesempenhoPartidos } from './DesempenhoPartidos'
import { DispersaoIndices } from './DispersaoIndices'
import { ajuste, forca, INDICES, type Ajuste, type Ponto } from './indices'

const TODOS = 'TODOS'
const ANOS_P3 = [2018, 2020, 2022, 2024] as const
const sinal = (r: number) => `${r < 0 ? '−' : '+'}${decimal(Math.abs(r), 2)}`

function Correlacao({ aj, explica }: { aj: Ajuste; explica: string }) {
  return (
    <div className="grid max-w-[64ch] gap-2 text-[0.95rem] leading-relaxed text-tinta-2">
      <p>{explica}</p>
      {aj.r == null ? (
        <p>Poucos municípios com dado para medir a correlação.</p>
      ) : (
        <p>
          Correlação <b className="text-tinta">{forca(aj.r)}</b> (r = <b className="tabular text-tinta">{sinal(aj.r)}</b>, {inteiro(aj.n)} municípios).
          O r de Pearson vai de −1 a +1; quanto mais longe de 0, mais os dois eixos variam juntos.
        </p>
      )}
    </div>
  )
}

function Resposta({ d, ano, indice, noUF, trocando }: { d: IndicesVies; ano: number; indice: IndiceP3; noUF: string; trocando: boolean }) {
  const navegar = useNavigate()
  const def = INDICES[indice]
  const abrir = (p: Ponto, comAno: boolean) =>
    navegar({ to: '/uf/$sigla/$ibge', params: { sigla: p.uf, ibge: String(p.ibge) }, search: comAno ? { ano: ano as Ano } : {} })

  const pontos1 = useMemo(
    () =>
      d.municipios.flatMap((m) => {
        const x = m.vies[ano], y = def.valor(m, ano)
        return x != null && y != null && (!def.log || y > 0) ? [{ ibge: m.ibge, nome: m.nome, uf: m.uf, x, y, peso: m.aptos[ano] ?? 0 }] : []
      }),
    [d, ano, def],
  )
  const aj1 = useMemo(() => ajuste(pontos1, def.log ? Math.log : undefined), [pontos1, def])
  const comVies = d.municipios.filter((m) => m.vies[ano] != null).length

  const pontos2 = useMemo(
    () =>
      d.municipios.flatMap((m) =>
        m.desvio != null && m.ifdm_recente != null
          ? [{ ibge: m.ibge, nome: m.nome, uf: m.uf, x: m.desvio, y: m.ifdm_recente, peso: m.aptos['2024'] ?? m.aptos['2020'] ?? 0 }]
          : [],
      ),
    [d],
  )
  const aj2 = useMemo(() => ajuste(pontos2), [pontos2])
  // as eleições do desvio padrão: só as municipais (mesmos cargos), "2020 e 2024"
  const anosDesvio = d.anos_desvio.length > 1 ? `${d.anos_desvio.slice(0, -1).join(', ')} e ${d.anos_desvio.at(-1)}` : String(d.anos_desvio[0] ?? '')
  const maxDesvio = Math.max(5, ...pontos2.map((p) => p.x))
  const passo = maxDesvio > 40 ? 10 : 5
  const topo = Math.ceil(maxDesvio / passo) * passo

  const semIfdm = !Object.keys(d.ano_ifdm).length

  return (
    <div aria-busy={trocando} className={`transition-opacity duration-300 ${trocando ? 'opacity-55' : ''}`}>
      {semIfdm && (
        <p role="status" className="mt-6 max-w-[var(--miolo-max)] rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem] text-tinta-2">
          O IFDM ainda não foi carregado no banco. Baixe a série histórica da Firjan, salve em <code className="t-mono">dados/firjan/</code> e
          rode <code className="t-mono">python -m loader.ifdm</code> (ver a Metodologia). Enquanto isso, os outros índices funcionam.
        </p>
      )}

      <section aria-labelledby="indice-vies" className="mt-10 max-w-[var(--miolo-max)]">
        <h2 id="indice-vies" className="t-h2">O índice e o lado do voto</h2>
        <p className="mt-1 max-w-[64ch] text-[0.95rem] text-tinta-2">
          Cada ponto é um município {noUF}: à esquerda ou à direita pelo viés do voto em {ano}, mais alto ou mais baixo pelo {def.eixo}.
          O tamanho é quantos eleitores ele tem.
        </p>
        <div className="mt-4">
          <Correlacao aj={aj1} explica={def.explica} />
        </div>
        <div className="mt-4">
          {pontos1.length ? (
            <DispersaoIndices
              pontos={pontos1}
              x={{ dominio: [-100, 100], marcas: [-100, -50, 0, 50, 100], formato: fmtVies, rotulo: 'viés político', pontas: ['esquerda', 'direita'] }}
              y={{ formato: def.formato, rotulo: def.eixo, log: def.log }}
              ajuste={aj1}
              cor={(p) => corVies(p.x)}
              rotulo={`Dispersão de ${pontos1.length} municípios ${noUF}: viés político em ${ano} contra ${def.eixo}`}
              aoEscolher={(p) => abrir(p, true)}
            />
          ) : (
            <p className="rounded-xl border border-linha bg-folha px-4 py-10 text-center text-[0.92rem] text-tinta-2">Nenhum município com viés e {def.eixo} em {ano}.</p>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.76rem] text-tinta-3">
          <span>{def.fonte(d, ano)}.</span>
          {def.log && <span>Escala logarítmica.</span>}
          <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-tinta" aria-hidden />tendência</span>
          {comVies > pontos1.length && <span>{inteiro(comVies - pontos1.length)} municípios sem o índice ficaram de fora.</span>}
          {ano === 2024 && <span>Em 2024 o viés usa a pesquisa de 2022.</span>}
        </p>
        <TabelaAlternavel
          titulo={`Viés em ${ano} e ${def.eixo}, por município ${noUF}`}
          colunas={['Município', 'UF', `Viés ${ano}`, def.eixo]}
          linhas={() => pontos1.toSorted((a, b) => a.x - b.x).map((p) => [p.nome, p.uf, fmtVies(p.x), def.formato(p.y)])}
        />
      </section>

      <section aria-labelledby="constancia" className="adiar mt-16 max-w-[var(--miolo-max)]">
        <h2 id="constancia" className="t-h2">O IFDM e a variação de viés</h2>
        <p className="mt-1 max-w-[64ch] text-[0.95rem] text-tinta-2">
          Agora sem olhar o lado e só nas eleições municipais: à esquerda ficam os municípios que votaram parecido em {anosDesvio} (o
          viés quase não mudou), à direita os que mais mudaram. Na altura, o IFDM{d.ifdm_recente ? ` de ${d.ifdm_recente}` : ''}, o mais recente.
        </p>
        <div className="mt-4">
          <Correlacao
            aj={aj2}
            explica={
              `O desvio padrão do viés mede quanto o viés do município variou entre as eleições municipais de ${anosDesvio}, em pontos: ` +
              `0 é o mesmo viés em todas, e quanto maior, mais ele mudou${d.anos_desvio.length === 2 ? ' (com duas eleições, é a metade da diferença entre os dois viéses)' : ''}. ` +
              INDICES.ifdm.explica
            }
          />
        </div>
        <div className="mt-4">
          {pontos2.length ? (
            <DispersaoIndices
              pontos={pontos2}
              x={{ dominio: [0, topo], marcas: Array.from({ length: topo / passo + 1 }, (_, i) => i * passo), formato: (v) => decimal(v, 0), rotulo: `desvio padrão do viés, ${anosDesvio} (pontos)` }}
              y={{ formato: (v) => decimal(v, 3), rotulo: `IFDM ${d.ifdm_recente ?? ''}`.trim() }}
              ajuste={aj2}
              cor={() => 'var(--color-acao)'}
              rotulo={`Dispersão de ${pontos2.length} municípios ${noUF}: desvio padrão do viés nas eleições municipais de ${anosDesvio} contra o IFDM mais recente`}
              aoEscolher={(p) => abrir(p, false)}
            />
          ) : (
            <p className="rounded-xl border border-linha bg-folha px-4 py-10 text-center text-[0.92rem] text-tinta-2">
              {semIfdm ? 'Sem o IFDM no banco, este gráfico fica vazio.' : `Nenhum município com viés em ${anosDesvio} e IFDM.`}
            </p>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.76rem] text-tinta-3">
          <span>Desvio padrão do viés nas eleições municipais de {anosDesvio} (prefeito e vereador); só entram municípios com viés em todas.</span>
          <span>As eleições gerais ficam de fora, para não misturar a troca de cargos com a mudança do voto.</span>
        </p>
        <TabelaAlternavel
          titulo={`Desvio padrão do viés e IFDM, por município ${noUF}`}
          colunas={['Município', 'UF', 'Desvio padrão', `IFDM ${d.ifdm_recente ?? ''}`.trim()]}
          linhas={() => pontos2.toSorted((a, b) => a.x - b.x).map((p) => [p.nome, p.uf, decimal(p.x, 1), decimal(p.y, 3)])}
        />
        <Link to="/metodologia" hash="m-indices" className="mt-6 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-acao hover:underline">
          Como a conta é feita <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </section>
    </div>
  )
}

export function IndicesPagina() {
  const busca = useSearch({ from: '/indices' })
  const navegar = useNavigate({ from: '/indices' })
  const mudar = (s: Partial<BuscaIndices>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), [ufs])

  const uf = carregadas.find((u) => u.sigla === busca.uf)
  const sigla = uf?.sigla ?? TODOS
  const noUF = uf ? noEstado(uf.sigla, uf.nome) : ufsFrase(carregadas, 'nos')
  const ano = busca.ano ?? 2024
  const indice = busca.indice ?? 'ifdm'
  const q = useQuery({ ...consultas.indices(sigla), enabled: carregadas.length > 0, placeholderData: keepPreviousData })

  useEffect(() => {
    document.title = 'Os índices do município e o voto · Voto Aberto'
  }, [])

  if (ufs && !carregadas.length) return <ErroCarga erro={new Error('Nenhum estado carregado no banco. Carregue um com: python -m loader PI')} />
  if (!ufs) return <Atrasado><EsqueletoPagina /></Atrasado>

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header>
        <h1 className="t-display">Os índices do município e o voto</h1>
        <p className="mt-4 max-w-[60ch] text-[1.06rem] text-tinta-2">
          Municípios mais desenvolvidos votam mais à esquerda ou à direita? E os que repetem o voto a cada eleição são mais ou menos
          desenvolvidos? Escolha o estado, a eleição e o índice.
        </p>
      </header>

      <div className="mt-5 grid gap-5">
        <fieldset className="min-w-0">
          <legend className="t-rotulo mb-2 text-tinta-2">Estado</legend>
          <SeletorEstado malha={malha} ufs={carregadas} escolhida={uf?.sigla ?? ''} aoEscolher={(s) => mudar({ uf: s })} />
        </fieldset>
      </div>

      <DesempenhoPartidos
        sigla={sigla}
        noUF={noUF}
        ano={busca.municipal ?? 2020}
        indice={busca.ranking ?? 'ifdm'}
        porte={busca.porte}
        aoMudar={(s) => mudar({
          ...('ano' in s && { municipal: s.ano === 2020 ? undefined : s.ano }),
          ...('indice' in s && { ranking: s.indice === 'ifdm' ? undefined : s.indice }),
          ...('porte' in s && { porte: s.porte }),
        })}
      />

      {/* daqui para baixo, os gráficos do viés do voto, com as próprias escolhas */}
      <div className="mt-16 grid max-w-[var(--miolo-max)] gap-5 border-t border-linha pt-8">
        <div>
          <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-ano">Eleição</p>
          <div role="radiogroup" aria-labelledby="rotulo-ano" className="flex flex-wrap gap-2">
            {ANOS_P3.map((a) => (
              <Escolha key={a} ativo={a === ano} aoClicar={() => mudar({ ano: a === 2024 ? undefined : a })}>{a}</Escolha>
            ))}
          </div>
        </div>
        <div>
          <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-indice">Índice no eixo vertical</p>
          <div role="radiogroup" aria-labelledby="rotulo-indice" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>button]:shrink-0 [&>button]:snap-start">
            {INDICES_P3.map((i) => (
              <Escolha key={i} ativo={i === indice} aoClicar={() => mudar({ indice: i === 'ifdm' ? undefined : i })}>{INDICES[i].rotulo}</Escolha>
            ))}
          </div>
        </div>
      </div>

      {q.error && q.data && (
        <p role="alert" className="mt-4 max-w-[var(--miolo-max)] rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
          Não foi possível abrir este recorte ({q.error.message}). Abaixo, o anterior.
        </p>
      )}
      {q.data ? (
        <Resposta d={q.data} ano={ano} indice={indice} noUF={noUF} trocando={q.isPlaceholderData} />
      ) : q.error ? (
        <div className="mt-8"><ErroCarga erro={q.error} compacto aoTentar={q.refetch} /></div>
      ) : (
        <Atrasado><EsqueletoBloco altura="50dvh" linhas={0} rotulo="Juntando os índices..." /></Atrasado>
      )}
    </div>
  )
}
