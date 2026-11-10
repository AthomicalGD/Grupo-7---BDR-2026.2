// P3: os índices do município andam com o lado do voto? Dois gráficos de dispersão, um ponto por município:
// o viés da eleição (-100 esquerda a +100 direita) contra o índice escolhido (IFDM do ano da eleição, as três áreas
// dele, PIB per capita, eleitores por habitante e isentos); e o desvio padrão do viés nas eleições municipais contra
// o IFDM mais recente, sem olhar o lado: o voto que se repete de eleição em eleição. Um estado ou todos os carregados.
// Cada pergunta abre com o veredito (a palavra-resposta) e o termômetro da correlação; a dispersão é o gráfico herói e
// o resto (como ler o r, a tabela, os rankings dos partidos) fica sob demanda. Dados de /api/indices; método em #m-indices.
import { ArrowRight, CaretDown } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, type ReactNode } from 'react'
import { consultas, type Ano, type IndicesVies } from '../api'
import { Atrasado, EsqueletoBloco, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { Termometro } from '../componentes/Termometro'
import { Veredito } from '../componentes/Veredito'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { decimal, inteiro, noEstado, ufsFrase, vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'
import { INDICES_P3, type BuscaIndices, type IndiceP3 } from '../router'
import { DesempenhoPartidos } from './DesempenhoPartidos'
import { DispersaoIndices } from './DispersaoIndices'
import { ajuste, forca, INDICES, type Ajuste, type Ponto } from './indices'
import { SemDado } from './SemDado'

const TODOS = 'TODOS'
const ANOS_P3 = [2018, 2020, 2022, 2024] as const
const sinal = (r: number) => `${r < 0 ? '−' : '+'}${decimal(Math.abs(r), 2)}`
const FAMILIA_IFDM: IndiceP3[] = ['ifdm', 'emprego_renda', 'educacao', 'saude']
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Como ler o r: o que o índice mede e o que a correlação quer dizer, sob demanda (o veredito já resumiu). */
function ComoLer({ aj, explica, titulo }: { aj: Ajuste; explica: string; titulo: string }) {
  return (
    <details className="peca mt-4 px-4 py-3">
      <summary className="alvo-44 flex cursor-pointer items-center gap-2 font-bold text-tinta">
        <CaretDown size={14} weight="bold" aria-hidden /> {titulo}
      </summary>
      <div className="mt-3 grid max-w-[64ch] gap-2 text-[0.92rem] leading-relaxed text-tinta-2">
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
    </details>
  )
}

function Painel({ children, aria }: { children: ReactNode; aria?: string }) {
  return <div className="peca mt-4 p-2 sm:p-3" aria-label={aria}>{children}</div>
}

function Titulo({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="t-h1">{children}</h2>
}

function Respostas({ d, ano, indice, noUF, trocando, aoTrocarIndice }: {
  d: IndicesVies; ano: number; indice: IndiceP3; noUF: string; trocando: boolean; aoTrocarIndice: (i: IndiceP3) => void
}) {
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
  const ifdmFora = semIfdm && FAMILIA_IFDM.includes(indice)

  // a frase do veredito 1: o lado para onde o índice puxa o voto, em palavras
  const forca1 = aj1.r == null ? null : forca(aj1.r)
  const lado1 = aj1.r == null ? '' : Math.abs(aj1.r) < 0.1
    ? `o ${def.eixo} quase não diz para que lado o município votou em ${ano}`
    : `onde o ${def.eixo} é mais alto, o voto em ${ano} tende a ficar ${forca1 === 'fraca' ? 'um pouco ' : ''}mais à ${aj1.r > 0 ? 'direita' : 'esquerda'}`
  const forca2 = aj2.r == null ? null : forca(aj2.r)
  const lado2 = aj2.r == null ? '' : Math.abs(aj2.r) < 0.1
    ? `o IFDM quase não separa quem repete o voto de quem muda`
    : `os municípios que mais mudaram de voto têm IFDM ${aj2.r > 0 ? 'um pouco maior' : 'um pouco menor'}`

  return (
    <div aria-busy={trocando} className={`transition-opacity duration-300 ${trocando ? 'opacity-55' : ''}`}>
      <section aria-labelledby="indice-vies" className="mt-10 scroll-mt-20">
        <Titulo id="indice-vies">O lado do voto acompanha o índice?</Titulo>
        {ifdmFora ? (
          <SemDado outro={{ rotulo: INDICES.pib_pc.rotulo, aoEscolher: () => aoTrocarIndice('pib_pc') }} />
        ) : (
          <div className="mt-2 grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:items-start">
            <div className="min-w-0">
              {aj1.r == null ? (
                <Veredito grande empilhado tom="branco" palavra="Sem dado.">
                  Poucos municípios {noUF} têm viés e {def.eixo} em {ano} para medir a relação.
                </Veredito>
              ) : (
                <Veredito grande empilhado tom="amarelo" palavra={`${maiuscula(forca1!)}.`}>
                  {maiuscula(lado1)}. Cada ponto é um município {noUF}; o tamanho é quantos eleitores ele tem.
                </Veredito>
              )}
              {aj1.r != null && (
                <Termometro
                  r={aj1.r}
                  esquerda={`mais ${def.eixo}, mais à esquerda`}
                  direita={`mais ${def.eixo}, mais à direita`}
                  descricao={`Correlação ${forca1} entre o viés político em ${ano} e ${def.eixo}: r = ${sinal(aj1.r)}`}
                />
              )}
              <ComoLer aj={aj1} explica={def.explica} titulo={`O que é ${def.rotulo === 'geral' ? 'o IFDM' : def.rotulo} e como ler o r`} />
            </div>
            <div className="min-w-0">
              <Painel>
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
                  <p className="px-4 py-16 text-center text-[0.95rem] text-tinta-2">Nenhum município com viés e {def.eixo} em {ano}.</p>
                )}
              </Painel>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-tinta-3">
                <span>{def.fonte(d, ano)}.</span>
                {def.log && <span>Escala logarítmica.</span>}
                <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-tinta" aria-hidden />tendência</span>
                {comVies > pontos1.length && <span>{inteiro(comVies - pontos1.length)} municípios sem o índice ficaram de fora.</span>}
                {ano === 2024 && <span>Em 2024 o viés usa a pesquisa de 2022.</span>}
              </p>
            </div>
          </div>
        )}
        {!ifdmFora && (
          <TabelaAlternavel
            titulo={`Viés em ${ano} e ${def.eixo}, por município ${noUF}`}
            colunas={['Município', 'UF', `Viés ${ano}`, def.eixo]}
            linhas={() => pontos1.toSorted((a, b) => a.x - b.x).map((p) => [p.nome, p.uf, fmtVies(p.x), def.formato(p.y)])}
          />
        )}
      </section>

      <section aria-labelledby="constancia" className="adiar mt-20 scroll-mt-20">
        <Titulo id="constancia">Quem repete o voto é mais desenvolvido?</Titulo>
        {semIfdm ? (
          <SemDado outro={{ rotulo: INDICES.pib_pc.rotulo, aoEscolher: () => aoTrocarIndice('pib_pc') }} />
        ) : (
          <div className="mt-2 grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:items-start">
            <div className="min-w-0">
              {aj2.r == null ? (
                <Veredito grande empilhado tom="branco" palavra="Sem dado.">Poucos municípios {noUF} têm viés em {anosDesvio} e IFDM para medir a relação.</Veredito>
              ) : (
                <Veredito grande empilhado tom="amarelo" palavra={`${maiuscula(forca2!)}.`}>
                  Entre as eleições municipais de {anosDesvio}, {lado2}. Cada ponto é um município {noUF}.
                </Veredito>
              )}
              {aj2.r != null && (
                <Termometro r={aj2.r} esquerda="muda mais, IFDM menor" direita="muda mais, IFDM maior" descricao={`Correlação ${forca2} entre o quanto o voto mudou e o IFDM: r = ${sinal(aj2.r)}`} />
              )}
              <ComoLer
                aj={aj2}
                titulo="O que é o desvio padrão do viés"
                explica={
                  `O desvio padrão do viés mede quanto o viés do município variou entre as eleições municipais de ${anosDesvio}, em pontos: ` +
                  `0 é o mesmo viés em todas, e quanto maior, mais ele mudou${d.anos_desvio.length === 2 ? ' (com duas eleições, é a metade da diferença entre os dois viéses)' : ''}. ` +
                  INDICES.ifdm.explica
                }
              />
            </div>
            <div className="min-w-0">
              <Painel>
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
                  <p className="px-4 py-16 text-center text-[0.95rem] text-tinta-2">Nenhum município com viés em {anosDesvio} e IFDM.</p>
                )}
              </Painel>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-tinta-3">
                <span>À esquerda, quem votou parecido em {anosDesvio}; à direita, quem mais mudou. Só eleições municipais (prefeito e vereador) e municípios com viés em todas.</span>
              </p>
            </div>
          </div>
        )}
        {!semIfdm && (
          <TabelaAlternavel
            titulo={`Desvio padrão do viés e IFDM, por município ${noUF}`}
            colunas={['Município', 'UF', 'Desvio padrão', `IFDM ${d.ifdm_recente ?? ''}`.trim()]}
            linhas={() => pontos2.toSorted((a, b) => a.x - b.x).map((p) => [p.nome, p.uf, decimal(p.x, 1), decimal(p.y, 3)])}
          />
        )}
        <Link to="/metodologia" hash="m-indices" className="alvo-44 mt-4 inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-acao hover:underline">
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
  const q = useQuery({ ...consultas.indices(sigla), enabled: carregadas.length > 0, placeholderData: keepPreviousData })
  // sem o IFDM no banco, a página abre no PIB per capita (que tem dado) em vez de no gráfico vazio
  const semIfdm = !!q.data && !Object.keys(q.data.ano_ifdm).length
  const indice = busca.indice ?? (semIfdm ? 'pib_pc' : 'ifdm')

  useEffect(() => {
    document.title = 'Os índices do município e o voto · Voto Aberto'
  }, [])

  if (ufs && !carregadas.length) return <ErroCarga erro={new Error('Nenhum estado carregado no banco. Carregue um com: python -m loader PI')} />
  if (!ufs) return <Atrasado><EsqueletoPagina /></Atrasado>

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header>
        <h1 className="t-display">Os índices do município e o voto</h1>
        <p className="apoio mt-4 text-[1.06rem] text-tinta-2">
          Município mais desenvolvido vota mais à esquerda ou à direita? E quem repete o voto a cada eleição é mais ou menos desenvolvido?
        </p>
      </header>

      <div className="peca mt-6 grid gap-x-6 gap-y-4 p-4 lg:grid-cols-[minmax(0,19rem)_auto_minmax(0,1fr)] lg:items-start" role="group" aria-label="Escolhas dos gráficos">
        <fieldset className="min-w-0">
          <legend className="t-rotulo mb-2 text-tinta-2">Estado</legend>
          <SeletorEstado malha={malha} ufs={carregadas} escolhida={uf?.sigla ?? ''} aoEscolher={(s) => mudar({ uf: s })} />
        </fieldset>
        <div>
          <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-ano">Eleição</p>
          <div role="radiogroup" aria-labelledby="rotulo-ano" className="flex gap-2 overflow-x-auto pb-1.5 sm:flex-wrap sm:overflow-visible [&>button]:shrink-0">
            {ANOS_P3.map((a) => (
              <Escolha key={a} ativo={a === ano} aoClicar={() => mudar({ ano: a === 2024 ? undefined : a })}>{a}</Escolha>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-indice">Índice no eixo vertical</p>
          <div role="radiogroup" aria-labelledby="rotulo-indice" className="flex snap-x gap-2 overflow-x-auto pb-1.5 sm:flex-wrap sm:overflow-visible [&>button]:shrink-0 [&>button]:snap-start">
            {INDICES_P3.map((i) => (
              <Escolha key={i} ativo={i === indice} aoClicar={() => mudar({ indice: i })}>
                {INDICES[i].rotulo}
                {semIfdm && FAMILIA_IFDM.includes(i) && <span className="rounded-full bg-papel-2 px-1.5 py-0.5 text-[0.66rem] font-semibold text-tinta-2">sem dado</span>}
              </Escolha>
            ))}
          </div>
        </div>
      </div>

      {q.error && q.data && (
        <p role="alert" className="mt-4 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
          Não foi possível abrir este recorte ({q.error.message}). Abaixo, o anterior.
        </p>
      )}
      {q.data ? (
        <Respostas d={q.data} ano={ano} indice={indice} noUF={noUF} trocando={q.isPlaceholderData} aoTrocarIndice={(i) => mudar({ indice: i })} />
      ) : q.error ? (
        <div className="mt-8"><ErroCarga erro={q.error} compacto aoTentar={q.refetch} /></div>
      ) : (
        <Atrasado><EsqueletoBloco altura="50dvh" linhas={0} rotulo="Juntando os índices..." /></Atrasado>
      )}

      <DesempenhoPartidos
        sigla={sigla}
        noUF={noUF}
        ano={busca.municipal ?? 2020}
        indice={indice}
        semIfdm={semIfdm}
        aoMudar={(a) => mudar({ municipal: a === 2020 ? undefined : a })}
        aoTrocarIndice={(i) => mudar({ indice: i })}
      />
    </div>
  )
}
