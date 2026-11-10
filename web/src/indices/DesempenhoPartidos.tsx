// P3: desempenho municipal dos partidos. Só eleições municipais: para cada partido que elegeu prefeitos, dois rankings
// do índice escolhido: o perfil (a média do índice nos municípios onde ganhou, no ano mais perto da eleição) e a
// evolução (a média da variação do índice durante o mandato). As regras de ano ficam na API (desempenho_partidos)
// e na Metodologia (#m-indices).
import { CaretDown, Question } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { consultas, type DesempenhoPartidos as Dados, type PartidoRanking } from '../api'
import { Atrasado, EsqueletoBloco } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, plural } from '../lib/formato'
import { INDICES_P3, MUNICIPAIS_P3, PORTES_P3, type EleicaoMunicipalP3, type IndiceP3, type PorteP3 } from '../router'
import { INDICES } from './indices'

/** Em que unidade sai a variação de cada índice. */
const UNIDADE: Record<IndiceP3, string> = {
  ifdm: 'em pontos do índice (de 0 a 1)',
  emprego_renda: 'em pontos do índice (de 0 a 1)',
  educacao: 'em pontos do índice (de 0 a 1)',
  saude: 'em pontos do índice (de 0 a 1)',
  pib_pc: 'em %, em valores nominais (sem descontar a inflação)',
  eleitores_pop: 'em eleitores por 100 habitantes',
  isentos: 'em pontos percentuais, no voto para prefeito',
}

/** O logo ao lado da sigla, num fundo branco (vários são escuros ou transparentes, e sumiriam no tema escuro).
 *  Sem logo, só o espaço vazio, para as siglas continuarem alinhadas. */
function Logo({ sigla }: { sigla: string }) {
  const { data } = useQuery(consultas.logosPartidos())
  const [falhou, setFalhou] = useState(false)
  const logo = data?.[sigla]
  return (
    <span className="grid h-7 w-11 shrink-0 place-items-center" aria-hidden>
      {logo && !falhou && (
        <span className="size-full overflow-hidden rounded-md bg-white p-0.5 ring-1 ring-linha">
          <img src={logo.url} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)}
            title={`Logo: ${logo.fonte === 'camara' ? 'Câmara dos Deputados' : `Wikimedia Commons${logo.licenca ? ` (${logo.licenca})` : ''}`}`}
            className="block size-full object-contain" />
        </span>
      )}
    </span>
  )
}

/** O "?" da linha: os municípios onde o partido elegeu o prefeito, ao passar o mouse, focar ou tocar. */
function Cidades({ sigla, cidades, nomes, comUF }: { sigla: string; cidades: number[]; nomes: Dados['municipios']; comUF: boolean }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  const lista = cidades
    .map((c) => ({ ibge: c, ...(nomes[c] ?? { nome: String(c), uf: '' }) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return (
    <div
      className="relative"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setAberto(false)}
      onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
    >
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={`Municípios onde o ${sigla} elegeu o prefeito`}
        onClick={() => setAberto((a) => !a)}
        onFocus={() => setAberto(true)}
        className="grid size-7 place-items-center rounded-full text-tinta-3 hover:bg-papel hover:text-acao aria-expanded:bg-acao-claro aria-expanded:text-acao"
      >
        <Question size={16} weight="bold" aria-hidden />
      </button>
      {aberto && (
        // o pt-1 (e não mt-1) deixa o mouse ir do botão à lista sem sair do bloco
        <div id={id} className="absolute right-0 top-full z-30 w-64 pt-1">
          <div className="max-h-64 overflow-y-auto rounded-xl border border-linha bg-folha p-3 text-[0.82rem] shadow-lg">
            <p className="mb-1.5 font-semibold text-tinta">
              {sigla}: {plural(lista.length, 'município', 'municípios')}
            </p>
            <ul className="grid gap-0.5">
              {lista.map((c) => (
                <li key={c.ibge}>
                  <Link to="/uf/$sigla/$ibge" params={{ sigla: c.uf, ibge: String(c.ibge) }} search={{}} className="text-tinta-2 hover:text-acao hover:underline">
                    {c.nome}{comUF && <span className="text-tinta-3"> · {c.uf}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

/** Os anos de referência de cada índice na eleição escolhida: o do perfil e o par da evolução. */
function AnosReferencia({ d, escolhido }: { d: Dados; escolhido: IndiceP3 }) {
  return (
    <div className="max-w-[40rem] overflow-x-auto">
      <table className="w-full text-[0.84rem] tabular">
        <caption className="mb-1.5 text-left text-[0.86rem] font-semibold text-tinta">Anos de referência na eleição de {d.ano}</caption>
        <thead>
          <tr className="text-left text-tinta-3">
            <th scope="col" className="py-1 pr-4 font-semibold">Índice</th>
            <th scope="col" className="py-1 pr-4 font-semibold">Perfil</th>
            <th scope="col" className="py-1 font-semibold">Evolução</th>
          </tr>
        </thead>
        <tbody>
          {INDICES_P3.map((i) => {
            const r = d.indices[i]
            return (
              <tr key={i} className={`border-t border-linha ${i === escolhido ? 'font-bold text-tinta' : 'text-tinta-2'}`}>
                <th scope="row" className={`py-1 pr-4 text-left ${i === escolhido ? 'font-bold' : 'font-normal'}`}>{INDICES[i].rotulo}</th>
                <td className="py-1 pr-4">{r?.perfil ? r.perfil.ano : <span className="text-tinta-3">sem dado</span>}</td>
                <td className="py-1">{r?.evolucao ? `${r.evolucao.de} → ${r.evolucao.ate}` : <span className="text-tinta-3">sem dado</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Quantos partidos cada ranking mostra antes do botão "ver os demais". */
const TOPO = 5

const NOME_PORTE: Record<PorteP3, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' }

/** A faixa de população de cada porte (os cortes de 50 mil e 100 mil habitantes vêm da API). */
function faixaPorte(porte: PorteP3, [medio, grande]: [number, number]) {
  const mil = (n: number) => `${inteiro(n / 1000)} mil`
  if (porte === 'pequeno') return `menos de ${mil(medio)} hab.`
  if (porte === 'medio') return `${inteiro(medio / 1000)} a ${mil(grande)} hab.`
  return `mais de ${mil(grande)} hab.`
}

function Ranking({ titulo, explica, nota, partidos, valor, diferenca, referencia, porteRotulo = '', nomes, comUF, vazio }: {
  titulo: string
  explica: string
  nota: string
  partidos: PartidoRanking[] | null
  valor: (v: number) => string
  /** a diferença de um partido para a referência, com sinal */
  diferenca: (v: number) => string
  /** a média de todos os municípios do porte (ou de todos): a referência de cada partido */
  referencia: { valor: number; rotulo: string } | null
  /** " do porte" quando há porte escolhido */
  porteRotulo?: string
  nomes: Dados['municipios']
  comUF: boolean
  vazio: string
}) {
  // fechado de novo a cada eleição ou índice: quem chama troca a key do ranking
  const [todos, setTodos] = useState(false)
  const id = useId()
  const resto = Math.max(0, (partidos?.length ?? 0) - TOPO)
  const visiveis = todos ? partidos : partidos?.slice(0, TOPO)
  return (
    <div className="min-w-0">
      <h3 className="t-h3">{titulo}</h3>
      <p className="mt-1 text-[0.9rem] leading-relaxed text-tinta-2">{explica}</p>
      {partidos?.length ? (
        <>
          {referencia && (
            <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-papel-2 px-3 py-1.5 text-[0.82rem] text-tinta-2">
              <span>{referencia.rotulo}</span>
              <b className="tabular text-tinta">{valor(referencia.valor)}</b>
            </p>
          )}
          <ol id={id} className="mt-2 border-t border-linha">
            {visiveis!.map((p, i) => (
              <li key={p.sigla} className="grid grid-cols-[1.6rem_minmax(0,1fr)_auto_1.75rem] items-center gap-x-3 border-b border-linha py-1.5">
                <span className="tabular text-[0.8rem] text-tinta-3">{i + 1}º</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Logo sigla={p.sigla} />
                  <div className="min-w-0">
                    <span className="block truncate text-[0.9rem] font-bold">{p.sigla}</span>
                    <span className="block text-[0.76rem] text-tinta-3">
                      {plural(p.prefeitos, 'prefeito', 'prefeitos')}
                      {p.populacao != null && <> · {inteiro(p.populacao)} hab.</>}
                    </span>
                  </div>
                </div>
                <span className="text-right">
                  <span className="tabular block text-[0.92rem] font-bold">{valor(p.media)}</span>
                  {referencia && (
                    <span className="tabular block text-[0.72rem] text-tinta-3" title={`Diferença para: ${referencia.rotulo.toLowerCase()}`}>
                      {diferenca(p.media - referencia.valor)} vs. média{porteRotulo}
                    </span>
                  )}
                </span>
                <Cidades sigla={p.sigla} cidades={p.cidades} nomes={nomes} comUF={comUF} />
              </li>
            ))}
          </ol>
          {resto > 0 && (
            <button
              type="button"
              aria-expanded={todos}
              aria-controls={id}
              onClick={() => setTodos((t) => !t)}
              className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[0.86rem] font-semibold text-acao hover:bg-papel"
            >
              <CaretDown size={14} weight="bold" aria-hidden className={`transition-transform duration-200 ${todos ? 'rotate-180' : ''}`} />
              {todos ? `Mostrar só os ${TOPO} primeiros` : `Ver os outros ${plural(resto, 'partido', 'partidos')}`}
            </button>
          )}
          <p className="mt-2 text-[0.76rem] text-tinta-3">{nota}</p>
        </>
      ) : (
        <p className="mt-3 rounded-xl border border-linha bg-folha px-4 py-8 text-center text-[0.88rem] text-tinta-2">{vazio}</p>
      )}
    </div>
  )
}

export function DesempenhoPartidos({ sigla, noUF, ano, indice, porte, aoMudar }: {
  /** uma UF ou TODOS */
  sigla: string
  noUF: string
  ano: EleicaoMunicipalP3
  indice: IndiceP3
  /** o porte dos municípios no índice; sem ele, todos */
  porte?: PorteP3
  aoMudar: (s: { ano?: EleicaoMunicipalP3; indice?: IndiceP3; porte?: PorteP3 }) => void
}) {
  const q = useQuery({ ...consultas.indicesPartidos(sigla, ano, porte ?? 'todos'), placeholderData: keepPreviousData })
  const def = INDICES[indice]
  const d = q.data
  const r = d?.indices[indice]
  const comUF = (d?.ufs.length ?? 0) > 1
  const menor = r?.menor_melhor ?? false
  const ordem = menor ? 'do menor para o maior (aqui, quanto menos, melhor)' : 'da maior para a menor'
  const doPorte = porte ? `dos municípios de porte ${NOME_PORTE[porte].toLowerCase()}` : 'de todos os municípios'
  // a diferença no perfil sai na unidade do índice; na evolução, na da variação (pontos, ou pontos percentuais no PIB)
  // (no PIB per capita a variação é em %, então a diferença do perfil sai em reais, com o formato do próprio índice)
  const difPerfil = indice === 'pib_pc' ? (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${def.formato(Math.abs(v))}` : def.variacao

  return (
    <section aria-labelledby="desempenho-partidos" className="mt-10 max-w-[var(--miolo-max)]">
      <h2 id="desempenho-partidos" className="t-h2">Desempenho municipal dos partidos</h2>
      <p className="mt-1 max-w-[64ch] text-[0.95rem] text-tinta-2">
        Só eleições municipais. Cada partido aparece com os municípios {noUF} onde elegeu o prefeito na eleição escolhida, e cada
        município pesa o mesmo na média. Passe o mouse (ou toque) no <b>?</b> para ver os municípios.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-municipal">Eleição municipal</p>
          <div role="radiogroup" aria-labelledby="rotulo-municipal" className="flex flex-wrap gap-2">
            {MUNICIPAIS_P3.map((a) => (
              <Escolha key={a} ativo={a === ano} aoClicar={() => aoMudar({ ano: a })}>{a}</Escolha>
            ))}
          </div>
        </div>
        <div>
          <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-ranking">Índice dos rankings</p>
          <div role="radiogroup" aria-labelledby="rotulo-ranking" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>button]:shrink-0 [&>button]:snap-start">
            {INDICES_P3.map((i) => (
              <Escolha key={i} ativo={i === indice} aoClicar={() => aoMudar({ indice: i })}>{INDICES[i].rotulo}</Escolha>
            ))}
          </div>
        </div>
        <div>
          <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-porte">Porte dos municípios (população)</p>
          <div role="radiogroup" aria-labelledby="rotulo-porte" className="flex flex-wrap gap-2">
            <Escolha ativo={!porte} aoClicar={() => aoMudar({ porte: undefined })}>Todos</Escolha>
            {PORTES_P3.map((p) => (
              <Escolha key={p} ativo={p === porte} aoClicar={() => aoMudar({ porte: p })}
                rotulo={d?.portes ? `${NOME_PORTE[p]}: ${faixaPorte(p, d.portes.limites)}, ${plural(d.portes.municipios[p], 'município', 'municípios')}` : NOME_PORTE[p]}>
                {NOME_PORTE[p]}
                {d?.portes && <span className="tabular text-[0.76rem] font-normal opacity-80">{faixaPorte(p, d.portes.limites)}</span>}
              </Escolha>
            ))}
          </div>
          {d?.portes && (
            <p className="mt-2 max-w-[64ch] text-[0.8rem] text-tinta-3">
              Pela população de {d.portes.ano}, entre os municípios que elegeram prefeito em {d.ano}:{' '}
              {PORTES_P3.map((p) => `${inteiro(d.portes!.municipios[p])} ${NOME_PORTE[p].toLowerCase()}${d.portes!.municipios[p] === 1 ? '' : 's'}`).join(', ')}.
              O porte vale para todos os índices.
            </p>
          )}
        </div>
      </div>

      {q.error && d && (
        <p role="alert" className="mt-4 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
          Não foi possível abrir este recorte ({q.error.message}). Abaixo, o anterior.
        </p>
      )}
      {d && r ? (
        <div aria-busy={q.isPlaceholderData} className={`mt-6 transition-opacity duration-300 ${q.isPlaceholderData ? 'opacity-55' : ''}`}>
          <AnosReferencia d={d} escolhido={indice} />
          <p className="mt-5 max-w-[64ch] text-[0.9rem] leading-relaxed text-tinta-2">{def.explica}</p>
          <div className="mt-5 grid gap-10 lg:grid-cols-2 lg:gap-8">
            <Ranking
              key={`perfil-${d.ano}-${indice}-${d.porte}`}
              titulo="Perfil de índice"
              explica={`A média do ${def.eixo} nos municípios${porte ? ` de porte ${NOME_PORTE[porte].toLowerCase()}` : ''} onde cada partido elegeu o prefeito em ${d.ano}, ${ordem}.`}
              diferenca={difPerfil}
              porteRotulo={porte ? ' do porte' : ''}
              referencia={r.perfil?.media_porte != null ? { valor: r.perfil.media_porte, rotulo: `Média ${doPorte} (${inteiro(r.perfil.municipios)})` } : null}
              nota={r.perfil
                ? `${def.eixo} de ${r.perfil.ano}${r.perfil.ano !== d.ano ? ` (o mais perto da eleição de ${d.ano})` : ''}. ` +
                  (d.ano_populacao ? `População de ${d.ano_populacao}.` : 'Sem população dentro das regras de ano para esta eleição.')
                : ''}
              partidos={r.perfil?.partidos ?? null}
              valor={def.formato}
              nomes={d.municipios}
              comUF={comUF}
              vazio={`Sem ${def.eixo} entre ${d.ano - 2} e ${d.ano + 1}, a distância máxima da eleição de ${d.ano}.`}
            />
            <Ranking
              key={`evolucao-${d.ano}-${indice}-${d.porte}`}
              titulo="Evolução de índice"
              explica={`A média da variação do ${def.eixo} durante o mandato, nos municípios${porte ? ` de porte ${NOME_PORTE[porte].toLowerCase()}` : ''} onde cada partido elegeu o prefeito em ${d.ano}, ${ordem}.`}
              diferenca={def.variacao}
              porteRotulo={porte ? ' do porte' : ''}
              referencia={r.evolucao?.media_porte != null ? { valor: r.evolucao.media_porte, rotulo: `Variação média ${doPorte} (${inteiro(r.evolucao.municipios)})` } : null}
              nota={r.evolucao
                ? `Variação de ${r.evolucao.de} a ${r.evolucao.ate}, ${UNIDADE[indice]}. ` +
                  (d.ano_populacao ? `População de ${d.ano_populacao}, só dos municípios com a variação.` : 'Sem população dentro das regras de ano para esta eleição.')
                : ''}
              partidos={r.evolucao?.partidos ?? null}
              valor={def.variacao}
              nomes={d.municipios}
              comUF={comUF}
              vazio={`Sem dois valores do ${def.eixo} dentro das regras: o primeiro entre ${d.ano - 2} e ${d.ano + 1}, e o segundo depois da eleição, até ${d.ano + 4}.`}
            />
          </div>
          <p className="mt-4 max-w-[64ch] text-[0.76rem] text-tinta-3">
            Partidos com poucos prefeitos têm médias que mudam muito com um município só: veja o número de prefeitos de cada linha.
            Eleições suplementares ficam de fora. Logos: Câmara dos Deputados e, para os partidos que ela não tem, Wikimedia
            Commons (a licença de cada um aparece ao passar o mouse).
          </p>
          <TabelaAlternavel
            titulo={`${def.eixo} por partido, prefeitos eleitos em ${d.ano} ${noUF}`}
            colunas={['Partido', 'Prefeitos (perfil)', 'População (perfil)', `Perfil: ${def.eixo}${r.perfil ? ` ${r.perfil.ano}` : ''}`, 'Prefeitos (evolução)',
              'População (evolução)', `Evolução${r.evolucao ? ` ${r.evolucao.de}–${r.evolucao.ate}` : ''}`]}
            linhas={() => {
              const evol = new Map((r.evolucao?.partidos ?? []).map((p) => [p.sigla, p]))
              const siglas = [...new Set([...(r.perfil?.partidos ?? []).map((p) => p.sigla), ...evol.keys()])]
              const perf = new Map((r.perfil?.partidos ?? []).map((p) => [p.sigla, p]))
              return siglas.map((s) => {
                const p = perf.get(s), e = evol.get(s)
                return [s, p ? inteiro(p.prefeitos) : '-', p?.populacao != null ? inteiro(p.populacao) : '-', p ? def.formato(p.media) : '-',
                  e ? inteiro(e.prefeitos) : '-', e?.populacao != null ? inteiro(e.populacao) : '-', e ? def.variacao(e.media) : '-']
              })
            }}
          />
        </div>
      ) : q.error ? (
        <div className="mt-6"><ErroCarga erro={q.error} compacto aoTentar={q.refetch} /></div>
      ) : (
        <Atrasado><EsqueletoBloco altura="40dvh" linhas={0} rotulo="Juntando os prefeitos..." /></Atrasado>
      )}
    </section>
  )
}
