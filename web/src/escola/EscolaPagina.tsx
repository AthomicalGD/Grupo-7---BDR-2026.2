// P4: escolaridade do candidato x escolaridade de quem vota (2022 e 2024), contada pelos objetos da
// eleição em três atos: do caderno de votação ao plenário (quem votou, quem se candidatou, quem se
// elegeu, grau a grau), os 100 santinhos (a chance de cada grau virar cadeira) e as cinco câmaras
// com o boletim do município escolhido. A cor é a escala da bandeira, do amarelo ao azul da marca.
import { ArrowRight, X } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useLembrado } from '../lib/pilha'
import { consultas, semMunicipal, type Ano, type Escola } from '../api'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { Alternador } from '../atlas/PainelEstado'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { Atrasado, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { CAPITAIS } from '../lib/capitais'
import { cargo as fmtCargo, decimal, inteiro, noEstado, pct } from '../lib/formato'
import type { BuscaEscola } from '../router'
import { CadaCadeira } from './CadaCadeira'
import { porCento, soma, SUPERIOR } from './escolaridade'
import { Dispersao } from './Dispersao'
import { Chance } from './Chance'
import { Distancia } from './Distancia'
import { Regua } from './Regua'
import { Lugar } from './Lugar'
import { MapaEscola } from './MapaEscola'
import { Partidos } from './Partidos'
import { Ranking } from './Ranking'

const ANOS: Ano[] = [2022, 2024, 2026]
const TERESINA = 2211001

const milhoes = (n: number) => `${decimal(n / 1e6, 1)} mi`

/** "AC, BA, GO, PE, PI, PR e RS" */
const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs.join(''))

function somaCargos(d: Escola, cod?: number) {
  const cs = d.cargos.filter((c) => cod == null || c.cod === cod)
  const candidatos = Array.from({ length: 8 }, (_, i) => soma(cs.map((c) => c.candidatos[i])))
  const eleitos = Array.from({ length: 8 }, (_, i) => soma(cs.map((c) => c.eleitos[i])))
  return { candidatos, eleitos }
}

export function EscolaPagina() {
  const busca = useSearch({ from: '/escola' })
  const navegar = useNavigate({ from: '/escola' })
  const mudar = (s: Partial<BuscaEscola>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  // abre em 2022: o contraste mais forte (9% de quem votou, 77% dos eleitos com superior completo)
  const ano: Ano = busca.ano === 2024 || busca.ano === 2026 ? busca.ano : 2022
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  // o DF não é um recorte aqui: os quintos dividem os municípios da UF e ele só tem Brasília (entra em todos)
  const carregadas = useMemo(() => semMunicipal((ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), true), [ufs])
  // antes da lista de UFs chegar vale o endereço; a API recusa UF sem dados
  const uf = busca.uf && busca.uf !== 'DF' && (!ufs || carregadas.some((u) => u.sigla === busca.uf)) ? busca.uf : ''
  const ufInfo = carregadas.find((u) => u.sigla === uf)
  const q = useQuery({ ...consultas.escola(ano, uf), placeholderData: keepPreviousData })
  const [destaque, setDestaque] = useLembrado('escola:destaque', SUPERIOR)
  const vista = busca.vista ?? 'mapa'
  const setVista = (v: 'mapa' | 'dispersao') => mudar({ vista: v === 'dispersao' ? 'dispersao' : undefined })
  const d = q.data
  const { data: municipios } = useQuery({ ...consultas.escolaMunicipios(ano, uf), placeholderData: keepPreviousData })
  const { data: partidos } = useQuery({ ...consultas.escolaPartidos(ano, uf), placeholderData: keepPreviousData })
  const { data: comparar } = useQuery(consultas.escolaComparar())
  // o boletim abre na capital do estado escolhido (Teresina sem estado); um município de outra UF não vale
  const ibge = busca.ibge && (!ufInfo || Math.floor(busca.ibge / 100_000) === ufInfo.cd_ibge) ? busca.ibge : uf ? CAPITAIS[uf] : TERESINA
  const { data: lugar } = useQuery({ ...consultas.escolaLugar(ibge, ano), placeholderData: keepPreviousData })

  useEffect(() => {
    document.title = 'Quanto estudou quem senta na cadeira? · Voto Aberto'
  }, [])

  const rotulos = useMemo(() => d?.niveis.map((n) => n.rotulo) ?? [], [d])
  if (q.error && !d) return <ErroCarga erro={q.error} aoTentar={q.refetch} />
  if (!d) return <Atrasado><EsqueletoPagina rotulo="Abrindo o caderno de votação..." /></Atrasado>

  const cargoObjetos = d.cargos.find((c) => c.cod === busca.cargo)
  const recorte = somaCargos(d, cargoObjetos?.cod)
  const todos = somaCargos(d)
  const chance = recorte.candidatos.map((c, i) => (c ? (100 * recorte.eleitos[i]) / c : null))
  const sup = (v: number[]) => porCento(v)[SUPERIOR - 1]
  const nomeCargo = (n: string) => fmtCargo(n)
  const taxa = (n: number) => Math.round((100 * recorte.eleitos[n - 1]) / recorte.candidatos[n - 1])
  // só entram na frase os graus com 30 candidatos ou mais (a mesma regra dos quadros)
  const conta = (n: number) => recorte.candidatos[n - 1] >= 30
  const menor = [2, 3, 4].find(conta)
  const COM: Record<number, string> = { 2: 'entre os que só leem e escrevem', 3: 'com fundamental incompleto', 4: 'com fundamental completo', 6: 'com médio completo' }
  const razao = conta(8) && conta(6) ? taxa(8) / Math.max(taxa(6), 0.5) : null
  const veredito = razao == null ? null : razao >= 2 ? 'Sim, e forte' : razao >= 1.2 ? 'Sim' : 'Aqui, quase não'
  const q1 = d.quintis[0], q5 = d.quintis[4]
  const vezes = sup(todos.eleitos) / Math.max(sup(d.votantes), 0.1)
  const onde = ufInfo ? ` ${noEstado(ufInfo.sigla, ufInfo.nome)}` : ''
  // com estado escolhido, cada ato lembra o recorte e deixa tirar o filtro
  const selo = ufInfo && (
    <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-linha bg-folha py-0.5 pl-3 pr-1 text-[0.78rem] text-tinta-2">
      Recorte: {ano} · {ufInfo.nome}
      <button type="button" onClick={() => mudar({ uf: undefined, ibge: undefined })} aria-label="Tirar o filtro de estado" className="grid size-6 place-items-center rounded-full hover:bg-papel focus-visible:outline-2 focus-visible:outline-acao">
        <X size={12} weight="bold" aria-hidden />
      </button>
    </p>
  )
  // o quinto do município, entre os quintos que a página mostra (os do estado, se houver filtro)
  const vLugar = lugar?.ano === ano ? lugar.pct.votantes : null
  const quintilDoLugar = vLugar == null ? null : d.quintis.findIndex((x) => vLugar <= x.ate + 0.05) + 1 || 5

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7" aria-busy={q.isPlaceholderData}>
      <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="t-display">Quanto estudou quem senta na cadeira?</h1>
          <p className="mt-3 max-w-[60ch] text-[clamp(1.08rem,0.95rem+0.5vw,1.32rem)] font-medium leading-[1.42] text-tinta-2" style={{ fontStretch: '96%' }}>
            Em {ano}{ufInfo ? `, ${noEstado(ufInfo.sigla, ufInfo.nome)},` : ''} quem se elegeu tinha{' '}
            <b className="tabular font-bold text-tinta">{decimal(vezes, vezes >= 5 ? 0 : 1)} vezes</b> mais diploma do que quem votou: superior completo era{' '}
            <b className="tabular font-bold text-tinta">{pct(sup(d.votantes), 0)}</b> de quem votou,{' '}
            <b className="tabular font-bold text-tinta">{pct(sup(todos.candidatos), 0)}</b> de quem se candidatou e{' '}
            <b className="tabular font-bold text-tinta">{pct(sup(todos.eleitos), 0)}</b> de quem se elegeu.
          </p>
          <p className="mt-2 text-[0.82rem] text-tinta-3">
            {lista(d.ufs)} · comparecimento do 1º turno e candidaturas aptas, com a escolaridade declarada ao TSE
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end lg:grid-cols-1">
          <fieldset>
            <legend className="t-rotulo mb-1.5 text-tinta-2">Eleição</legend>
            <CedulaAnos ano={ano} anos={ANOS} linhaDoTempo={false} aoMudar={(a) => mudar({ ano: a, cargo: undefined, santinho: undefined })} />
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="t-rotulo mb-1.5 text-tinta-2">Estado</legend>
            <SeletorEstado malha={malha} ufs={carregadas} escolhida={uf ?? ''} aoEscolher={(s) => mudar({ uf: s, ibge: undefined })} />
          </fieldset>
        </div>
      </header>

      {/* (A) o diploma e a chance de se eleger: um só seletor de cargo para a régua e para a chance */}
      <section aria-labelledby="pergunta-a" className="mt-16">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="pergunta-a" className="t-h1">O diploma ajuda a se eleger?</h2>
          {selo}
        </div>
        <p className="mt-3 max-w-[64ch] text-[clamp(1.04rem,0.95rem+0.35vw,1.2rem)] leading-[1.5] text-tinta-2">
          {veredito ? (
            <>
              <b className="text-tinta">{veredito}.</b> {cargoObjetos ? `Para ${nomeCargo(cargoObjetos.nome).toLowerCase()}, dos` : 'Dos'} candidatos com superior completo,{' '}
              <b className="tabular text-tinta">{taxa(8)}%</b> se elegeram; {COM[6]}, <b className="tabular text-tinta">{taxa(6)}%</b>
              {menor && <>; {COM[menor]}, <b className="tabular text-tinta">{taxa(menor)}%</b></>}.
            </>
          ) : (
            <>
              {cargoObjetos ? `Para ${nomeCargo(cargoObjetos.nome).toLowerCase()}, quase` : 'Quase'} todo candidato tem superior completo:{' '}
              <b className="tabular text-tinta">{pct(sup(recorte.candidatos), 0)}</b> dos candidatos e{' '}
              <b className="tabular text-tinta">{pct(sup(recorte.eleitos), 0)}</b> dos eleitos.
            </>
          )}
        </p>
        <div role="radiogroup" aria-label="Cargo" className="-mx-4 mt-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>button]:shrink-0 [&>button]:snap-start">
          <Escolha ativo={!cargoObjetos} aoClicar={() => mudar({ cargo: undefined })}>Todos os cargos</Escolha>
          {d.cargos.map((c) => (
            <Escolha key={c.cod} ativo={c.cod === cargoObjetos?.cod} aoClicar={() => mudar({ cargo: c.cod })}>{nomeCargo(c.nome)}</Escolha>
          ))}
        </div>

        <div className="mt-12 grid gap-y-12">
          <section aria-labelledby="regua-p4" className="min-w-0">
            <h3 id="regua-p4" className="t-h2">Do eleitor ao eleito</h3>
            <p className="mt-1.5 max-w-[60ch] text-[0.95rem] text-tinta-2">Em cada etapa, o % de cada grau de escolaridade.</p>
            <div className="mt-4">
              <Regua
                rotulos={rotulos}
                chance={chance}
                destaque={destaque}
                aoDestacar={setDestaque}
                grupos={[
                  { titulo: 'Quem votou', total: `${milhoes(soma(d.votantes))} de pessoas`, valores: d.votantes },
                  { titulo: 'Quem se candidatou', total: `${inteiro(soma(recorte.candidatos))} candidatos`, valores: recorte.candidatos },
                  { titulo: 'Quem se elegeu', total: `${inteiro(soma(recorte.eleitos))} cadeiras`, valores: recorte.eleitos },
                ]}
              />
            </div>
            <TabelaAlternavel sql="p4Lugar"
              titulo="Quem votou, candidatos e eleitos por grau de escolaridade"
              colunas={['Escolaridade', 'Quem votou', 'Candidatos', 'Eleitos', 'Chance de se eleger']}
              linhas={() => {
                const [v, c, e] = [porCento(d.votantes), porCento(recorte.candidatos), porCento(recorte.eleitos)]
                return rotulos.map((r, i) => [r, pct(v[i]), pct(c[i]), pct(e[i]), chance[i] == null ? '-' : pct(chance[i])]).reverse()
              }}
            />
          </section>
          <section aria-labelledby="santinhos-p4" className="min-w-0">
            <h3 id="santinhos-p4" className="t-h2">Quantos % dos candidatos se elegem</h3>
            <p className="mt-1.5 max-w-[60ch] text-[0.95rem] text-tinta-2">A chance de cada grau virar cadeira{cargoObjetos ? `, para ${nomeCargo(cargoObjetos.nome).toLowerCase()}` : ', somando os cargos'}.</p>
            <div className="mt-4">
              <Chance candidatos={recorte.candidatos} eleitos={recorte.eleitos} rotulos={rotulos} destaque={destaque} aoDestacar={setDestaque} />
            </div>
          </section>
        </div>
      </section>

      {/* (B) o lugar: os cinco grupos de municípios, o mapa com o boletim e o ranking */}
      <section aria-labelledby="lugar-p4" className="adiar mt-16">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="lugar-p4" className="t-h1">Onde se estudou menos, se elege menos diploma?</h2>
          {selo}
        </div>
        <p className="mt-3 max-w-[64ch] text-[clamp(1.04rem,0.95rem+0.35vw,1.2rem)] leading-[1.5] text-tinta-2">
          {d.medida === 'eleitos' ? (
            <>
              <b className="text-tinta">Um pouco, mas em todo lugar o eleito estudou bem mais que o eleitor.</b> No quinto de municípios menos escolarizado,{' '}
              <b className="tabular text-tinta">{pct(q1.eleitos, 0)}</b> dos eleitos têm superior completo; no mais escolarizado,{' '}
              <b className="tabular text-tinta">{pct(q5.eleitos, 0)}</b>. Entre quem votou, a maior marca é {pct(q5.votantes, 0)}.
            </>
          ) : (
            <>
              <b className="text-tinta">Não.</b> Deputado é eleito pelo estado, então aqui conta em quem cada município votou, e o voto quase não muda com a escolaridade do lugar: de{' '}
              <b className="tabular text-tinta">{pct(q1.votados, 0)}</b> a <b className="tabular text-tinta">{pct(q5.votados, 0)}</b> dos votos foram para candidatos com superior completo.
            </>
          )}
        </p>

        <h3 className="t-h2 mt-12">{d.medida === 'eleitos' ? 'Cinco grupos de municípios' : 'Cinco grupos de municípios e o voto para deputado'}</h3>
        <p className="mt-1.5 max-w-[70ch] text-[0.95rem] text-tinta-2">
          Os {inteiro(d.todos.municipios)} municípios{ufInfo ? ` ${noEstado(ufInfo.sigla, ufInfo.nome)}` : ''} em cinco grupos do mesmo tamanho, do eleitorado menos ao mais escolarizado. A haste é a distância entre quem votou e {d.medida === 'eleitos' ? 'quem se elegeu' : 'em quem se votou'}.
        </p>
        <div className="mt-5">
          <Distancia dados={d} quintilDoLugar={quintilDoLugar} />
          <p className="mt-4 text-[0.86rem] text-tinta-3">
            Correlação entre os {inteiro(d.todos.municipios)} municípios: <b className="tabular text-tinta-2">{decimal(Math.abs(d.correlacao ?? 0) < 0.005 ? 0 : d.correlacao, 2)}</b>
            {d.medida === 'eleitos' ? ' (0 seria nenhuma relação, 1 seria a mesma ordem).' : ' (0 seria nenhuma relação).'} O Censo 2022 dá o mesmo resultado.
          </p>
        </div>

        <h3 className="t-h2 mt-12">Município a município</h3>
        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Alternador
                rotulo="Vista dos municípios"
                valor={vista}
                aoMudar={setVista}
                opcoes={[{ valor: 'mapa', rotulo: 'Mapa' }, { valor: 'dispersao', rotulo: 'Dispersão' }]}
              />
            </div>
            <div className="mt-3">
              {!municipios ? (
                <p className="text-tinta-3">Abrindo os municípios...</p>
              ) : vista === 'mapa' ? (
                <MapaEscola municipios={municipios} ufs={d.ufs} medida={d.medida} selecionado={ibge} aoEscolher={(i) => mudar({ ibge: i })} colonial={d.colonial} />
              ) : (
                <Dispersao municipios={municipios} medida={d.medida} selecionado={ibge} aoEscolher={(i) => mudar({ ibge: i })} />
              )}
            </div>

          </div>
          <div className="min-w-0">
            <Lugar ibge={ibge} ano={ano} uf={uf} quintil={quintilDoLugar} rotulos={rotulos} aoMudar={(i) => mudar({ ibge: i })} />
          </div>
        </div>

        <h3 className="t-h2 mt-12">O ranking dos municípios</h3>
        <div className="mt-2">
          {municipios && <Ranking municipios={municipios} medida={d.medida} selecionado={ibge} aoEscolher={(i) => mudar({ ibge: i })} />}
        </div>
      </section>

      {/* para ir além: cada cargo e cada estado (2022 ao lado de 2024) e os partidos na ordem do viés */}
      <section aria-labelledby="cadeiras-p4" className="adiar mt-16">
        <h2 id="cadeiras-p4" className="t-h1">Cada cadeira, cada estado</h2>
        <div className="mt-2">
          {comparar ? (
            <CadaCadeira dados={comparar} uf={uf} rotulos={rotulos} aoEscolherUf={(s) => mudar({ uf: s || undefined, ibge: undefined })} />
          ) : (
            <p className="text-tinta-3">Comparando as eleições...</p>
          )}
        </div>
      </section>

      <section aria-labelledby="partidos-p4" className="adiar mt-16">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="partidos-p4" className="t-h1">Os partidos e o diploma</h2>
          {selo}
        </div>
        <div className="mt-2">{partidos ? <Partidos partidos={partidos} onde={onde} /> : <p className="text-tinta-3">Contando os partidos...</p>}</div>
      </section>

      <footer className="mt-12 border-t border-linha pt-5">
        <Link to="/metodologia" hash="m-escolaridade" className="inline-flex items-center gap-1.5 font-semibold text-acao hover:underline">
          Como medimos a escolaridade <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </footer>
    </div>
  )
}
