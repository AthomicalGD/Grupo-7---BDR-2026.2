// P6: idade do município x alternância de poder e idade dos eleitos: jovem vota no jovem?
// "O tempo na parede da prefeitura": a idade contada pelos objetos que envelhecem com a cidade, em quatro atos,
// cada um com a pergunta como título e a resposta calculada logo abaixo: (1) onde o Brasil é mais velho (o mapa
// sépia: o papel amarela com o tempo), (2) se lugar mais velho troca mais de prefeito (as passagens de mandato e a
// galeria dos ex-prefeitos), (3) se quem se elege é mais velho que quem vota (a pirâmide) e (4) se jovem vota no
// jovem (os halteres por terço de zonas). Fecha com o que a conta não diz. As contas são as de
// scripts/06_idade_alternancia.py, que a API importa.
import { ArrowRight, EyeSlash, GitMerge, Ruler, X } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ANOS, CARGOS_IDADE, consultas, type Ano, type EfeitoIdade } from '../api'
import { BuscaMunicipio } from '../atlas/BuscaMunicipio'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { Alternador } from '../atlas/PainelEstado'
import { Atrasado, EsqueletoBloco, EsqueletoPagina } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { SeletorEstado } from '../componentes/SeletorEstado'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { CAPITAIS } from '../lib/capitais'
import { inteiro, noEstado, pct } from '../lib/formato'
import type { BuscaIdade } from '../router'
import { Galeria, LegendaGaleria } from './Galeria'
import { HalteresIdade } from './HalteresIdade'
import { MapaIdade } from './MapaIdade'
import { Passagens, PorPorte, type Leitura } from './Passagens'
import { Piramide } from './Piramide'
import { anos, claro, comSinal, COR_TERCO, maiuscula, NOME_TERCO, resumoPassagens, SEPIA, tintaSobreSepia } from './sepia'

const TERESINA = 2211001
const MUNICIPAIS: Ano[] = [2020, 2024]

/** "+1,7 ano (de +1,2 a +2,3)": o efeito e o intervalo de 95% */
const efeitoTexto = (e: EfeitoIdade | null | undefined, unidade = 'ano') =>
  !e ? '-' : `${comSinal(e.b)} ${Math.abs(e.b) >= 2 ? `${unidade}s` : unidade} (de ${comSinal(e.lo)} a ${comSinal(e.hi)})`

function Resposta({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-[66ch] text-[clamp(1.04rem,0.95rem+0.35vw,1.2rem)] leading-[1.5] text-tinta-2">{children}</p>
}

export function IdadePagina() {
  const busca = useSearch({ from: '/idade' })
  const navegar = useNavigate({ from: '/idade' })
  const mudar = (s: Partial<BuscaIdade>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const ano: Ano = busca.ano ?? 2024
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  // o DF não é um recorte aqui: os terços dividem os municípios da UF e ele só tem Brasília
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR' && u.sigla !== 'DF'), [ufs])
  const uf = busca.uf && busca.uf !== 'DF' && (!ufs || carregadas.some((u) => u.sigla === busca.uf)) ? busca.uf : ''
  const ufInfo = carregadas.find((u) => u.sigla === uf)
  const onde = ufInfo ? ` ${noEstado(ufInfo.sigla, ufInfo.nome)}` : ''

  // o boletim e a galeria abrem na capital do estado escolhido (Teresina sem estado)
  const ibge = busca.ibge && (!ufInfo || Math.floor(busca.ibge / 100_000) === ufInfo.cd_ibge) ? busca.ibge : uf ? CAPITAIS[uf] : TERESINA
  const anoEleitos: 2020 | 2024 = busca.eleitos === 2020 ? 2020 : 2024
  const cargoVoto = CARGOS_IDADE.find((c) => c.cod === busca.cargo) ?? CARGOS_IDADE[0]
  const anoVoto = cargoVoto.anos.includes(busca.voto as Ano) ? (busca.voto as Ano) : cargoVoto.anos[cargoVoto.anos.length - 1]
  const [leitura, setLeitura] = useState<Leitura>('estrita')
  const [cargoPiramide, setCargoPiramide] = useState<'13' | '11'>('13')
  const [escolaridade, setEscolaridade] = useState<'como' | 'mesma'>('mesma')

  const perfil = useQuery({ ...consultas.idadePerfil(ano, uf), placeholderData: keepPreviousData })
  const alt = useQuery({ ...consultas.idadeAlternancia(uf), placeholderData: keepPreviousData })
  const eleitos = useQuery({ ...consultas.idadeEleitos(anoEleitos, uf), placeholderData: keepPreviousData })
  const voto = useQuery({ ...consultas.idadeVoto(cargoVoto.cod, anoVoto, uf), placeholderData: keepPreviousData })
  // a frase do topo usa sempre o teste mais limpo: deputado federal em 2022 (os mesmos candidatos em toda a UF)
  const votoTopo = useQuery({ ...consultas.idadeVoto(6, 2022, uf), placeholderData: keepPreviousData })
  const lugar = useQuery({ ...consultas.idadeMunicipio(ibge), placeholderData: keepPreviousData })

  useEffect(() => {
    document.title = 'Jovem vota no jovem? · Voto Aberto'
  }, [])

  const p = perfil.data
  if (perfil.error && !p) return <ErroCarga erro={perfil.error} />
  if (!p) return <Atrasado><EsqueletoPagina variante="mapa" rotulo="Abrindo o mapa da idade..." /></Atrasado>

  const selo = ufInfo && (
    <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-linha bg-folha py-0.5 pl-3 pr-1 text-[0.78rem] text-tinta-2">
      Recorte: {ufInfo.nome}
      <button type="button" onClick={() => mudar({ uf: undefined, ibge: undefined })} aria-label="Tirar o filtro de estado" className="grid size-6 place-items-center rounded-full hover:bg-papel focus-visible:outline-2 focus-visible:outline-acao">
        <X size={12} weight="bold" aria-hidden />
      </button>
    </p>
  )

  const topo = votoTopo.data?.efeitos.escolaridade
  const topoBruto = votoTopo.data?.efeitos.bruto
  const ultimo = p.linha[p.linha.length - 1], primeiro = p.linha[0]

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7" aria-busy={perfil.isPlaceholderData}>
      <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="t-display">Jovem vota no jovem?</h1>
          <p className="mt-3 max-w-[62ch] text-[clamp(1.08rem,0.95rem+0.5vw,1.32rem)] font-medium leading-[1.42] text-tinta-2" style={{ fontStretch: '96%' }}>
            {topo && claro(topo) === 1 ? (
              <>
                <b className="text-tinta">Pouco.</b> Comparando lugares de mesma escolaridade{onde}, zonas onde quem votou é 5 anos mais velho dão votos a deputados{' '}
                <b className="tabular text-tinta">{anos(topo.b)} {Math.abs(topo.b) >= 2 ? 'anos' : 'ano'}</b> mais velhos. Sem esse cuidado, quase nada muda
                {topoBruto ? <> ({comSinal(topoBruto.b)} ano)</> : null}.
              </>
            ) : topo ? (
              <>
                <b className="text-tinta">Não se vê.</b> Mesmo comparando lugares de mesma escolaridade{onde}, a idade de quem votou não muda a idade dos deputados votados ({comSinal(topo.b)} ano a cada 5 anos).
              </>
            ) : (
              'Calculando a resposta...'
            )}
          </p>
          <p className="mt-2 text-[0.82rem] text-tinta-3">
            Idade de quem compareceu no 1º turno (TSE, por zona), prefeitos eleitos desde 1996 e votos por zona · o voto é secreto: a conta compara lugares, não pessoas
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end lg:grid-cols-1">
          <fieldset>
            <legend className="t-rotulo mb-1.5 text-tinta-2">Eleição (mapa)</legend>
            <CedulaAnos ano={ano} anos={ANOS} linhaDoTempo={true} aoMudar={(a) => mudar({ ano: a })} />
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="t-rotulo mb-1.5 text-tinta-2">Estado</legend>
            <SeletorEstado malha={malha} ufs={carregadas} escolhida={uf} aoEscolher={(s) => mudar({ uf: s, ibge: undefined })} />
          </fieldset>
        </div>
      </header>

      {/* 1. onde o Brasil é mais velho: o mapa sépia, os extremos, os terços e o envelhecimento */}
      <section aria-labelledby="ato-1" className="mt-16">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="ato-1" className="t-h1">{ufInfo ? `Onde o eleitorado ${noEstado(ufInfo.sigla, ufInfo.nome)} é mais velho?` : 'Onde o Brasil é mais velho?'}</h2>
          {selo}
        </div>
        <Resposta>
          Em {ano}, quem votou{onde} tinha em média <b className="tabular text-tinta">{anos(p.ponderada)} anos</b>: de{' '}
          <b className="tabular text-tinta">{anos(p.mais_jovem.idade)}</b> em {p.mais_jovem.nome} ({p.mais_jovem.uf}) a{' '}
          <b className="tabular text-tinta">{anos(p.mais_velho.idade)}</b> em {p.mais_velho.nome} ({p.mais_velho.uf}). De {primeiro.ano} a {ultimo.ano}, a média dos municípios subiu de{' '}
          <b className="tabular text-tinta">{anos(primeiro.media)}</b> para <b className="tabular text-tinta">{anos(ultimo.media)} anos</b>.
        </Resposta>

        <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <MapaIdade municipios={p.municipios} ufs={ufInfo ? [ufInfo.sigla] : carregadas.map((u) => u.sigla)} ano={ano} selecionado={ibge} aoEscolher={(i) => mudar({ ibge: i })} />
          </div>
          <div className="min-w-0">
            <h3 className="t-h2">Três terços{ufInfo ? ` ${noEstado(ufInfo.sigla, ufInfo.nome)}` : ' de municípios'}</h3>
            <p className="mt-1.5 max-w-[52ch] text-[0.95rem] text-tinta-2">
              Os municípios em três grupos do mesmo tamanho pela idade média de quem votou em {ano}. A mesma divisão vale para os atos abaixo.
            </p>
            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-[10px] border border-linha">
              {([1, 2, 3] as const).map((k) => (
                <div key={k} className="px-3 py-3" style={{ background: COR_TERCO[k], color: tintaSobreSepia(k === 1 ? 1 : k === 2 ? 3 : 5) }}>
                  <p className="text-[0.86rem] font-bold">{maiuscula(NOME_TERCO[k])}</p>
                  <p className="tabular mt-0.5 text-[0.8rem]">
                    {k === 1 ? `até ${anos(p.limites[0])}` : k === 2 ? `${anos(p.limites[0])} a ${anos(p.limites[1])}` : `${anos(p.limites[1])} ou mais`}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.88rem] text-tinta-2">
              <b className="tabular text-tinta">{pct(p.estavel, 0)}</b> dos municípios ficam no mesmo terço de 2018 a 2024: a classificação é estável
              {p.r_censo != null ? <> e acompanha a idade da população no Censo 2022 (correlação de <b className="tabular text-tinta">{anos(p.r_censo, 2)}</b>)</> : null}.
            </p>

            <h3 className="t-h2 mt-10">O Brasil envelhecendo</h3>
            <p className="mt-1.5 max-w-[52ch] text-[0.95rem] text-tinta-2">
              Em cada eleição, a idade média de quem votou e a parte dos municípios onde votaram mais pessoas de 60 anos ou mais do que de 16 a 29.
            </p>
            <ol className="mt-4 grid grid-cols-4 gap-2">
              {p.linha.map((l) => (
                <li key={l.ano}>
                  <button
                    type="button"
                    onClick={() => mudar({ ano: l.ano })}
                    aria-pressed={l.ano === ano}
                    className={`block w-full rounded-[10px] border px-2.5 py-2.5 text-left transition-colors ${l.ano === ano ? 'border-selecao bg-selecao-claro' : 'border-linha bg-folha hover:border-linha-2'}`}
                  >
                    <span className="tabular block text-[0.78rem] font-bold text-tinta-2">{l.ano}</span>
                    <span className="t-numero tabular block text-[1.5rem] text-tinta">{anos(l.media)}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-papel-2" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${l.mais_velhos_pct}%`, background: SEPIA[5] }} />
                    </span>
                    <span className="tabular mt-1 block text-[0.72rem] text-tinta-3">{pct(l.mais_velhos_pct, 0)} com mais 60+</span>
                  </button>
                </li>
              ))}
            </ol>
            <TabelaAlternavel
              titulo="Idade média de quem votou e municípios com mais votantes de 60+ do que de 16 a 29"
              colunas={['Eleição', 'Média dos municípios', 'Média de quem votou', 'Municípios com mais 60+']}
              linhas={() => p.linha.map((l) => [String(l.ano), anos(l.media), anos(l.ponderada), `${inteiro(l.mais_velhos)} (${pct(l.mais_velhos_pct)})`])}
            />
          </div>
        </div>
      </section>

      {/* 2. lugar mais velho troca mais de prefeito? as passagens e a galeria dos ex-prefeitos */}
      <section aria-labelledby="ato-2" className="adiar mt-20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="ato-2" className="t-h1">Lugar mais velho troca mais de prefeito?</h2>
          {selo}
        </div>
        {alt.data ? (
          <>
            <Resposta>
              {claro(alt.data.efeitos.estrita) === 0 ? <b className="text-tinta">Não troca mais de partido.</b> : <b className="text-tinta">{claro(alt.data.efeitos.estrita) > 0 ? 'Troca um pouco mais de partido.' : 'Troca um pouco menos de partido.'}</b>}{' '}
              Desde 1996, a troca de partido fica em{' '}
              <b className="tabular text-tinta">{alt.data.tercos.map((t) => pct(leitura === 'estrita' ? t.troca_estrita : t.troca_ampla, 0)).join(', ')}</b> das passagens, do terço mais jovem ao mais velho
              {claro(alt.data.efeitos.pessoa) === 1 ? (
                <>. Troca um pouco mais de pessoa: a cada 5 anos a mais de quem votou, <b className="tabular text-tinta">{comSinal(alt.data.efeitos.pessoa!.b)} pontos</b> de prefeitos novos (reelege menos)</>
              ) : null}
              .
            </Resposta>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[0.82rem] text-tinta-3">Fusão de partidos conta como</span>
              <Alternador rotulo="Como contar a fusão de partidos" valor={leitura} aoMudar={setLeitura} opcoes={[{ valor: 'estrita', rotulo: 'troca' }, { valor: 'ampla', rotulo: 'continuidade' }]} />
            </div>
            <h3 className="t-h2 mt-8">As passagens de mandato, por terço</h3>
            <p className="mt-1.5 max-w-[66ch] text-[0.95rem] text-tinta-2">
              Cada passagem é um prefeito eleito sucedendo o anterior ({inteiro(alt.data.total.passagens)} desde 1996). Renomeações, como PMDB para MDB, contam como o mesmo partido; quando o partido anterior foi incorporado ao do novo entre as duas eleições, a troca fica marcada à parte ({inteiro(alt.data.total.fusao)}).
            </p>
            <div className="mt-5"><Passagens dados={alt.data} leitura={leitura} /></div>
            <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
              <div>
                <h3 className="t-h3">Por tamanho do município</h3>
                <p className="mt-1 text-[0.86rem] text-tinta-3">% das passagens com troca de partido (fusão conta como troca)</p>
                <div className="mt-3"><PorPorte dados={alt.data} /></div>
              </div>
              <div>
                <h3 className="t-h3">As trocas com ressalva</h3>
                <p className="mt-1 text-[0.86rem] text-tinta-3">O partido do prefeito anterior entrou no do novo entre as duas eleições</p>
                <ul className="mt-3 grid gap-y-1 text-[0.86rem]">
                  {alt.data.fusoes.slice(0, 6).map((f) => (
                    <li key={`${f.ano}${f.de}${f.para}`} className="flex items-baseline justify-between gap-3 border-b border-linha/70 py-1">
                      <span className="text-tinta"><span className="t-mono text-tinta-2">{f.de}</span> <span aria-hidden>→</span><span className="sr-only">para</span> <span className="t-mono text-tinta-2">{f.para}</span> <span className="text-tinta-3">({f.ano - 4} a {f.ano})</span></span>
                      <span className="tabular font-semibold text-tinta-2">{inteiro(f.n)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <Atrasado><EsqueletoBloco altura={260} rotulo="Contando as passagens de mandato..." /></Atrasado>
        )}

        <h3 className="t-h2 mt-12">A galeria dos ex-prefeitos</h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="w-full max-w-[22rem]">
            <BuscaMunicipio uf={uf} rotulo="Outro município" aoEscolher={(m) => m.carregada && mudar({ ibge: m.ibge })} />
          </div>
          <p className="text-[0.86rem] text-tinta-3">ou clique num município no mapa</p>
        </div>
        {lugar.data ? (
          <div className="mt-5 rounded-[16px] border border-linha bg-papel-2/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="t-h3 text-tinta">{lugar.data.nome} <span className="font-normal text-tinta-3">({lugar.data.uf})</span></p>
              {lugar.data.passagens && <p className="text-[0.88rem] text-tinta-2">{resumoPassagens(lugar.data.passagens)}</p>}
            </div>
            {lugar.data.anos['2024'] && (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.84rem] text-tinta-2">
                Quem votou em 2024: <b className="tabular text-tinta">{anos(lugar.data.anos['2024'].idade)} anos</b>
                <span className="rounded-full px-2 py-0.5 text-[0.76rem] font-semibold" style={{ background: COR_TERCO[lugar.data.anos['2024'].terco_uf], color: tintaSobreSepia(lugar.data.anos['2024'].terco_uf === 1 ? 1 : lugar.data.anos['2024'].terco_uf === 2 ? 3 : 5) }}>
                  terço {NOME_TERCO[lugar.data.anos['2024'].terco_uf]} na UF
                </span>
              </p>
            )}
            <div className="mt-4"><Galeria dados={lugar.data} /></div>
            <div className="mt-4"><LegendaGaleria /></div>
          </div>
        ) : (
          <Atrasado><EsqueletoBloco altura={200} rotulo="Pendurando os retratos..." /></Atrasado>
        )}
      </section>

      {/* 3. quem se elege é mais velho que quem vota? a pirâmide e o prêmio de idade */}
      <section aria-labelledby="ato-3" className="adiar mt-20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="ato-3" className="t-h1">Quem se elege é mais velho que quem vota?</h2>
          {selo}
        </div>
        {eleitos.data ? (() => {
          const e = eleitos.data
          const ver = e.cargos['13'], pre = e.cargos['11']
          const jovensVotou = (100 * e.quem_votou[0]) / e.quem_votou.reduce((a, b) => a + b, 0)
          const jovensVer = (100 * ver.eleitos[0]) / ver.eleitos.reduce((a, b) => a + b, 0)
          const premio = e.efeitos.premio_ver
          return (
            <>
              <Resposta>
                <b className="text-tinta">Sim.</b> Em {e.ano}{onde}, prefeitos eleitos tinham em média <b className="tabular text-tinta">{anos(pre.idade_eleitos)} anos</b>, vereadores{' '}
                <b className="tabular text-tinta">{anos(ver.idade_eleitos)}</b> e quem votou <b className="tabular text-tinta">{anos(e.idade_quem_votou)}</b>. Quem tem de 18 a 34 anos é{' '}
                <b className="tabular text-tinta">{pct(jovensVotou, 0)}</b> de quem votou e <b className="tabular text-tinta">{pct(jovensVer, 0)}</b> dos vereadores.
              </Resposta>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div role="radiogroup" aria-label="Cargo" className="flex flex-wrap gap-2">
                  <Escolha ativo={cargoPiramide === '13'} aoClicar={() => setCargoPiramide('13')}>Vereador</Escolha>
                  <Escolha ativo={cargoPiramide === '11'} aoClicar={() => setCargoPiramide('11')}>Prefeito</Escolha>
                </div>
                <Alternador rotulo="Eleição" valor={String(anoEleitos)} aoMudar={(v) => mudar({ eleitos: Number(v) as 2020 | 2024 })} opcoes={MUNICIPAIS.map((a) => ({ valor: String(a), rotulo: String(a) }))} />
              </div>
              <div className="mt-6 max-w-[56rem]"><Piramide dados={e} cargo={cargoPiramide} /></div>

              <h3 className="t-h2 mt-12">O prêmio de idade</h3>
              <p className="mt-1.5 max-w-[66ch] text-[0.95rem] text-tinta-2">
                A cada 5 anos a mais de quem votou, os vereadores eleitos são <b className="tabular text-tinta">{efeitoTexto(e.efeitos.eleitos_ver)}</b> mais velhos. Mas isso acompanha quem se candidata: os candidatos são <b className="tabular text-tinta">{efeitoTexto(e.efeitos.cand_ver)}</b> mais velhos.{' '}
                {claro(premio) === 0
                  ? 'Entre os candidatos, a escolha não favorece os mais velhos nem os mais novos.'
                  : claro(premio) > 0
                    ? 'Entre os candidatos, os lugares mais velhos escolhem os mais velhos.'
                    : 'Entre os candidatos, os lugares mais velhos escolhem os um pouco mais novos.'}
              </p>
              <div className="mt-5">
                <HalteresIdade
                  linhas={e.tercos.map((t) => ({
                    terco: t.terco,
                    rotulo: `Terço ${NOME_TERCO[t.terco]}`,
                    detalhe: `${inteiro(t.municipios)} municípios · prefeito: ${anos(t.prefeito)} anos`,
                    quemVotou: t.quem_votou,
                    alvo: t.eleitos,
                    extra: t.candidatos,
                  }))}
                  rotuloAlvo="vereadores eleitos"
                  rotuloExtra="candidatos a vereador"
                  descricao={(l) => `${l.rotulo}: quem votou ${anos(l.quemVotou)} anos, candidatos ${anos(l.extra)}, eleitos ${anos(l.alvo)}`}
                />
              </div>
              <TabelaAlternavel
                titulo={`Idade média por terço (${e.ano})`}
                colunas={['Terço (na UF)', 'Municípios', 'Quem votou', 'Candidatos a vereador', 'Vereadores eleitos', 'Prêmio', 'Prefeito eleito', 'Prefeitos com 60+']}
                linhas={() => e.tercos.map((t) => [NOME_TERCO[t.terco], inteiro(t.municipios), anos(t.quem_votou), anos(t.candidatos), anos(t.eleitos), comSinal(t.premio), anos(t.prefeito), pct(t.prefeito_60, 0)])}
              />
            </>
          )
        })() : (
          <Atrasado><EsqueletoBloco altura={300} rotulo="Montando a pirâmide..." /></Atrasado>
        )}
      </section>

      {/* 4. jovem vota no jovem? os halteres por terço de zonas, com e sem a escolaridade fixa */}
      <section aria-labelledby="ato-4" className="adiar mt-20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="ato-4" className="t-h1">Jovem vota no jovem?</h2>
          {selo}
        </div>
        {voto.data ? (() => {
          const v = voto.data
          const bruto = v.efeitos.bruto, fixa = v.efeitos.escolaridade
          const mesma = escolaridade === 'mesma'
          return (
            <>
              <Resposta>
                {claro(fixa) === 1 ? <b className="text-tinta">Um pouco.</b> : claro(fixa) === -1 ? <b className="text-tinta">Ao contrário, um pouco.</b> : <b className="text-tinta">Não se vê.</b>}{' '}
                Para {v.nome.toLowerCase()} em {v.ano}, entre {v.comparacao}: sem comparar a escolaridade, 5 anos a mais de quem votou mudam a idade dos votados em{' '}
                <b className="tabular text-tinta">{efeitoTexto(bruto)}</b>; comparando zonas de mesma escolaridade, em <b className="tabular text-tinta">{efeitoTexto(fixa)}</b>.
              </Resposta>
              <div className="-mx-4 mt-6 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="radiogroup" aria-label="Cargo">
                {CARGOS_IDADE.map((c) => (
                  <Escolha key={c.cod} ativo={c.cod === cargoVoto.cod} aoClicar={() => mudar({ cargo: c.cod, voto: undefined })}>{c.nome}</Escolha>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Alternador rotulo="Eleição" valor={String(anoVoto)} aoMudar={(a) => mudar({ voto: Number(a) as Ano })} opcoes={cargoVoto.anos.map((a) => ({ valor: String(a), rotulo: String(a) }))} />
                <Alternador
                  rotulo="Comparação"
                  valor={escolaridade}
                  aoMudar={setEscolaridade}
                  opcoes={[{ valor: 'como', rotulo: 'Como votaram' }, { valor: 'mesma', rotulo: 'Mesma escolaridade' }]}
                />
              </div>
              <p className="mt-3 max-w-[70ch] text-[0.9rem] text-tinta-2">
                {cargoVoto.cod === 6 || cargoVoto.cod === 7
                  ? 'Todas as zonas do estado têm os mesmos candidatos a deputado na urna: a diferença entre zonas vem de quem vota, não de quem se candidata.'
                  : 'Cada município tem os seus candidatos, então só se comparam zonas do mesmo município (cidades com 2 zonas ou mais).'}{' '}
                {v.r_escolaridade != null && <>Nas cidades, as zonas mais velhas são também as mais escolarizadas (correlação de <b className="tabular text-tinta">{anos(v.r_escolaridade, 2)}</b>), e a escolaridade puxa o voto para o outro lado.</>}
              </p>
              <div className="mt-6">
                <HalteresIdade
                  linhas={v.tercos.map((t) => ({
                    terco: t.terco,
                    rotulo: `Zonas ${t.terco === 1 ? 'mais jovens' : t.terco === 2 ? 'intermediárias' : 'mais velhas'}`,
                    detalhe: `${inteiro(t.zonas)} zonas em ${inteiro(t.municipios)} ${t.municipios === 1 ? 'município' : 'municípios'}`,
                    quemVotou: t.quem_votou,
                    alvo: mesma ? t.votada_fixa : t.votada,
                  }))}
                  rotuloAlvo={mesma ? 'votados, com a escolaridade fixa' : 'votados (idade média dos candidatos, pelos votos)'}
                  descricao={(l) => `${l.rotulo}: quem votou ${anos(l.quemVotou)} anos; votados ${anos(l.alvo)} anos`}
                />
              </div>
              <TabelaAlternavel
                titulo={`Efeito de 5 anos a mais de quem votou na idade dos votados (${v.nome.toLowerCase()}, ${v.ano})`}
                colunas={['Comparação', 'Efeito (anos)', 'Intervalo de 95%', 'Correlação parcial', 'Zonas']}
                linhas={() =>
                  ([
                    [`${v.comparacao}, como votaram`, v.efeitos.bruto],
                    [`${v.comparacao}, mesma escolaridade`, v.efeitos.escolaridade],
                    ...(v.efeitos.municipio_bruto !== undefined
                      ? [['zonas do mesmo município, como votaram', v.efeitos.municipio_bruto], ['zonas do mesmo município, mesma escolaridade', v.efeitos.municipio_escolaridade]]
                      : []),
                  ] as [string, EfeitoIdade | null | undefined][]).map(([rot, e]) => [rot, e ? comSinal(e.b, 2) : '-', e ? `${comSinal(e.lo, 2)} a ${comSinal(e.hi, 2)}` : '-', e ? anos(e.r, 2) : '-', e ? inteiro(e.n) : '-'])
                }
              />
            </>
          )
        })() : (
          <Atrasado><EsqueletoBloco altura={260} rotulo="Comparando as zonas..." /></Atrasado>
        )}
      </section>

      {/* o que a conta não diz */}
      <section aria-labelledby="nao-diz-p6" className="adiar mt-20">
        <h2 id="nao-diz-p6" className="t-h1">O que a conta não diz</h2>
        <ul className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-3">
          {[
            { Icone: EyeSlash, titulo: 'O voto é secreto', texto: 'A conta compara lugares, não pessoas: mostra para onde vão os votos de zonas mais velhas, não em quem cada eleitor votou.' },
            { Icone: Ruler, titulo: 'A idade vem em faixas', texto: 'O TSE dá a idade de quem votou por faixa (ano a ano até 20, depois de 5 em 5): a média usa o meio de cada faixa.' },
            { Icone: GitMerge, titulo: 'Fusão fica à parte', texto: 'Quando o partido do prefeito anterior entrou no do novo, a troca é marcada com ressalva e a conta sai nas duas leituras.' },
          ].map(({ Icone, titulo, texto }) => (
            <li key={titulo} className="lembrete flex items-start gap-3.5">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-selecao-claro text-selecao-tinta"><Icone size={26} weight="fill" aria-hidden /></span>
              <span>
                <span className="block font-bold text-tinta">{titulo}</span>
                <span className="mt-0.5 block text-[0.92rem] leading-snug text-tinta-2">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-10 border-t border-linha pt-4 text-[0.88rem]">
          <Link to="/metodologia" hash="m-idade" className="inline-flex items-center gap-1.5 font-semibold text-acao hover:underline">
            Como a conta é feita <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  )
}
