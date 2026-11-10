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
import { LogoPartido as Logo } from '../componentes/LogoPartido'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, plural } from '../lib/formato'
import { INDICES_P3, MUNICIPAIS_P3, type EleicaoMunicipalP3, type IndiceP3 } from '../router'
import { INDICES } from './indices'
import { SemDado } from './SemDado'

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

const VISIVEIS = 8

function Ranking({ titulo, explica, nota, partidos, valor, comPopulacao, nomes, comUF, vazio }: {
  titulo: string
  explica: string
  nota: string
  partidos: PartidoRanking[] | null
  valor: (v: number) => string
  comPopulacao?: boolean
  nomes: Dados['municipios']
  comUF: boolean
  vazio: string
}) {
  const [todos, setTodos] = useState(false)
  const lista = partidos && !todos ? partidos.slice(0, VISIVEIS) : partidos
  return (
    <div className="min-w-0">
      <h3 className="t-h3">{titulo}</h3>
      <p className="mt-1 text-[0.9rem] leading-relaxed text-tinta-2">{explica}</p>
      {lista?.length ? (
        <>
          <ol className="mt-3 border-t border-linha">
            {lista.map((p, i) => (
              <li key={p.sigla} className="grid grid-cols-[1.6rem_minmax(0,1fr)_auto_1.75rem] items-center gap-x-3 border-b border-linha py-1.5">
                <span className="tabular text-[0.8rem] text-tinta-3">{i + 1}º</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Logo sigla={p.sigla} />
                  <div className="min-w-0">
                    <span className="block truncate text-[0.9rem] font-bold">{p.sigla}</span>
                    <span className="block text-[0.76rem] text-tinta-3">
                      {plural(p.prefeitos, 'prefeito', 'prefeitos')}
                      {comPopulacao && p.populacao != null && <> · {inteiro(p.populacao)} hab.</>}
                    </span>
                  </div>
                </div>
                <span className="tabular text-[0.92rem] font-bold">{valor(p.media)}</span>
                <Cidades sigla={p.sigla} cidades={p.cidades} nomes={nomes} comUF={comUF} />
              </li>
            ))}
          </ol>
          {partidos && partidos.length > VISIVEIS && (
            <button type="button" onClick={() => setTodos((t) => !t)} className="peca peca-link alvo-44 mt-3 px-4 text-[0.9rem] font-bold text-tinta">
              {todos ? 'Mostrar só os 8 primeiros' : `Ver os ${partidos.length} partidos`}
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

export function DesempenhoPartidos({ sigla, noUF, ano, indice, semIfdm, aoMudar, aoTrocarIndice }: {
  /** uma UF ou TODOS */
  sigla: string
  noUF: string
  ano: EleicaoMunicipalP3
  /** o índice escolhido no alto da página: os rankings seguem a mesma escolha dos gráficos */
  indice: IndiceP3
  semIfdm: boolean
  aoMudar: (ano: EleicaoMunicipalP3) => void
  aoTrocarIndice: (i: IndiceP3) => void
}) {
  const q = useQuery({ ...consultas.indicesPartidos(sigla, ano), placeholderData: keepPreviousData })
  const def = INDICES[indice]
  const d = q.data
  const r = d?.indices[indice]
  const comUF = (d?.ufs.length ?? 0) > 1

  return (
    <section aria-labelledby="desempenho-partidos" className="adiar mt-20 scroll-mt-20">
      <h2 id="desempenho-partidos" className="t-h1">Os partidos que elegem prefeito acham cidades de que tipo?</h2>
      <p className="apoio mt-2 text-[1rem] text-tinta-2">
        Só eleições municipais. Cada partido aparece com os municípios {noUF} onde elegeu o prefeito, e cada município pesa o mesmo
        na média. O índice é o escolhido no alto da página ({def.rotulo === 'geral' ? 'IFDM' : def.rotulo}). Toque no <b>?</b> para ver os municípios.
      </p>

      <div className="mt-4">
        <p className="t-rotulo mb-2 text-tinta-2" id="rotulo-municipal">Eleição municipal</p>
        <div role="radiogroup" aria-labelledby="rotulo-municipal" className="flex flex-wrap gap-2">
          {MUNICIPAIS_P3.map((a) => (
            <Escolha key={a} ativo={a === ano} aoClicar={() => aoMudar(a)}>{a}</Escolha>
          ))}
        </div>
      </div>

      {q.error && d && (
        <p role="alert" className="mt-4 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
          Não foi possível abrir este recorte ({q.error.message}). Abaixo, o anterior.
        </p>
      )}
      {semIfdm && ['ifdm', 'emprego_renda', 'educacao', 'saude'].includes(indice) ? (
        <SemDado titulo="Os rankings precisam do IFDM" outro={{ rotulo: INDICES.pib_pc.rotulo, aoEscolher: () => aoTrocarIndice('pib_pc') }} />
      ) : d && r ? (
        <div aria-busy={q.isPlaceholderData} className={`mt-6 transition-opacity duration-300 ${q.isPlaceholderData ? 'opacity-55' : ''}`}>
          <details className="peca px-4 py-3">
            <summary className="alvo-44 flex cursor-pointer items-center gap-2 font-bold text-tinta">
              <CaretDown size={14} weight="bold" aria-hidden /> O que é {def.rotulo === 'geral' ? 'o IFDM' : def.rotulo} e de que anos vêm os dados
            </summary>
            <p className="mt-3 max-w-[64ch] text-[0.9rem] leading-relaxed text-tinta-2">{def.explica}</p>
            <div className="mt-4"><AnosReferencia d={d} escolhido={indice} /></div>
          </details>
          <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-8">
            <Ranking
              titulo="Perfil de índice"
              explica={`A média do ${def.eixo} nos municípios onde cada partido elegeu o prefeito em ${d.ano}, da maior para a menor.`}
              nota={r.perfil
                ? `${def.eixo} de ${r.perfil.ano}${r.perfil.ano !== d.ano ? ` (o mais perto da eleição de ${d.ano})` : ''}. ` +
                  (d.ano_populacao ? `População de ${d.ano_populacao}.` : 'Sem população dentro das regras de ano para esta eleição.')
                : ''}
              partidos={r.perfil?.partidos ?? null}
              valor={def.formato}
              comPopulacao
              nomes={d.municipios}
              comUF={comUF}
              vazio={`Sem ${def.eixo} entre ${d.ano - 2} e ${d.ano + 1}, a distância máxima da eleição de ${d.ano}.`}
            />
            <Ranking
              titulo="Evolução de índice"
              explica={`A média da variação do ${def.eixo} durante o mandato, nos municípios onde cada partido elegeu o prefeito em ${d.ano}, da maior para a menor.`}
              nota={r.evolucao ? `Variação de ${r.evolucao.de} a ${r.evolucao.ate}, ${UNIDADE[indice]}.` : ''}
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
            colunas={['Partido', 'Prefeitos (perfil)', 'População', `Perfil: ${def.eixo}${r.perfil ? ` ${r.perfil.ano}` : ''}`, 'Prefeitos (evolução)',
              `Evolução${r.evolucao ? ` ${r.evolucao.de}–${r.evolucao.ate}` : ''}`]}
            linhas={() => {
              const evol = new Map((r.evolucao?.partidos ?? []).map((p) => [p.sigla, p]))
              const siglas = [...new Set([...(r.perfil?.partidos ?? []).map((p) => p.sigla), ...evol.keys()])]
              const perf = new Map((r.perfil?.partidos ?? []).map((p) => [p.sigla, p]))
              return siglas.map((s) => {
                const p = perf.get(s), e = evol.get(s)
                return [s, p ? inteiro(p.prefeitos) : '-', p?.populacao != null ? inteiro(p.populacao) : '-', p ? def.formato(p.media) : '-',
                  e ? inteiro(e.prefeitos) : '-', e ? def.variacao(e.media) : '-']
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
