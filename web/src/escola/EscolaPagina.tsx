// P4: escolaridade do candidato x escolaridade de quem vota (2022 e 2024), contada pelos objetos da
// eleição em três atos: do caderno de votação ao plenário (quem votou, quem se candidatou, quem se
// elegeu, grau a grau), os 100 santinhos (a chance de cada grau virar cadeira) e as cinco câmaras
// com o boletim do município escolhido. A cor é a escala da bandeira, do amarelo ao azul da marca.
import { ArrowRight } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { consultas, type Ano, type Escola } from '../api'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { silhueta } from '../atlas/geo'
import { CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { CAPITAIS } from '../lib/capitais'
import { cargo as fmtCargo, decimal, inteiro, noEstado, pct } from '../lib/formato'
import type { BuscaEscola } from '../router'
import { CemSantinhos } from './CemSantinhos'
import { porCento, soma, SUPERIOR } from './escolaridade'
import { CincoCamaras } from './CincoCamaras'
import { DoCadernoAoPlenario } from './DoCadernoAoPlenario'
import { Lugar } from './Lugar'

const ANOS: Ano[] = [2022, 2024]
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
  // abre em 2022: o contraste mais forte (11 de 100 que votaram, 79 de 100 eleitos com superior completo)
  const ano: Ano = busca.ano === 2024 ? 2024 : 2022
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), [ufs])
  const silhuetas = useMemo(() => new Map(malha ? carregadas.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 22)]) : []), [malha, carregadas])
  // antes da lista de UFs chegar vale o endereço; a API recusa UF sem dados
  const uf = busca.uf && (!ufs || carregadas.some((u) => u.sigla === busca.uf)) ? busca.uf : ''
  const ufInfo = carregadas.find((u) => u.sigla === uf)
  const q = useQuery({ ...consultas.escola(ano, uf), placeholderData: keepPreviousData })
  const [destaque, setDestaque] = useState(SUPERIOR)
  const d = q.data
  // o boletim abre na capital do estado escolhido (Teresina sem estado); um município de outra UF não vale
  const ibge = busca.ibge && (!ufInfo || Math.floor(busca.ibge / 100_000) === ufInfo.cd_ibge) ? busca.ibge : uf ? CAPITAIS[uf] : TERESINA
  const { data: lugar } = useQuery({ ...consultas.escolaLugar(ibge, ano), placeholderData: keepPreviousData })

  useEffect(() => {
    document.title = 'Quanto estudou quem senta na cadeira? · Voto Aberto'
  }, [])

  const rotulos = useMemo(() => d?.niveis.map((n) => n.rotulo) ?? [], [d])
  if (q.error && !d) return <ErroCarga erro={q.error} />
  if (!d) return <CirandaTela rotulo="Abrindo o caderno de votação..." />

  const cargoObjetos = d.cargos.find((c) => c.cod === busca.cargo)
  const cargo100 = d.cargos.find((c) => c.cod === busca.santinho) ?? d.cargos[0]
  const recorte = somaCargos(d, cargoObjetos?.cod)
  const todos = somaCargos(d)
  const chance = recorte.candidatos.map((c, i) => (c ? (100 * recorte.eleitos[i]) / c : null))
  const sup = (v: number[]) => porCento(v)[SUPERIOR - 1]
  const nomeCargo = (n: string) => fmtCargo(n)
  const taxa = (n: number) => Math.round((100 * cargo100.eleitos[n - 1]) / cargo100.candidatos[n - 1])
  // só entram na frase os graus com 30 candidatos ou mais (a mesma regra dos quadros)
  const conta = (n: number) => cargo100.candidatos[n - 1] >= 30
  const menor = [2, 3, 4].find(conta)
  const COM: Record<number, string> = { 2: 'entre os que só leem e escrevem', 3: 'com fundamental incompleto', 4: 'com fundamental completo', 6: 'com médio completo' }
  const razao = conta(8) && conta(6) ? taxa(8) / Math.max(taxa(6), 0.5) : null
  const veredito = razao == null ? null : razao >= 2 ? 'Existe relação, e forte' : razao >= 1.2 ? 'Existe relação' : 'Aqui a relação quase some'
  const q1 = d.quintis[0], q5 = d.quintis[4]
  // o quinto do município, entre os quintos que a página mostra (os do estado, se houver filtro)
  const vLugar = lugar?.ano === ano ? lugar.pct.votantes : null
  const quintilDoLugar = vLugar == null ? null : d.quintis.findIndex((x) => vLugar <= x.ate + 0.05) + 1 || 5

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-8 md:px-[72px] md:pt-10" aria-busy={q.isPlaceholderData}>
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="t-display">Quanto estudou quem senta na cadeira?</h1>
          <p className="mt-4 max-w-[56ch] text-[clamp(1.15rem,1rem+0.7vw,1.5rem)] font-medium leading-[1.42] text-tinta-2" style={{ fontStretch: '96%' }}>
            Em {ano}{ufInfo ? `, ${noEstado(ufInfo.sigla, ufInfo.nome)},` : ''} quem tinha superior completo era <b className="tabular font-bold text-tinta">{pct(sup(d.votantes), 0)}</b> de quem votou,{' '}
            <b className="tabular font-bold text-tinta">{pct(sup(todos.candidatos), 0)}</b> de quem se candidatou e{' '}
            <b className="tabular font-bold text-tinta">{pct(sup(todos.eleitos), 0)}</b> de quem se elegeu.
          </p>
          <p className="mt-3 text-[0.86rem] text-tinta-3">
            {lista(d.ufs)} · comparecimento do 1º turno e candidaturas aptas, com a escolaridade declarada ao TSE
          </p>
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end lg:grid-cols-1">
          <fieldset>
            <legend className="t-rotulo mb-2 text-tinta-2">Eleição</legend>
            <CedulaAnos ano={ano} anos={ANOS} linhaDoTempo={false} aoMudar={(a) => mudar({ ano: a, cargo: undefined, santinho: undefined })} />
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="t-rotulo mb-2 text-tinta-2">Estado</legend>
            <div role="radiogroup" aria-label="Estado" className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 lg:grid lg:grid-cols-4 [&>button]:shrink-0 [&>button]:snap-start">
              <Escolha ativo={!uf} aoClicar={() => mudar({ uf: undefined, ibge: undefined })}>Todos</Escolha>
              {carregadas.map((u) => (
                <Escolha key={u.sigla} rotulo={u.nome} ativo={u.sigla === uf} aoClicar={() => mudar({ uf: u.sigla, ibge: undefined })}>
                  <svg width={20} height={20} viewBox="0 0 22 22" aria-hidden className="shrink-0">
                    <path d={silhuetas.get(u.sigla)} fill="currentColor" opacity={0.85} />
                  </svg>
                  {u.sigla}
                </Escolha>
              ))}
            </div>
          </fieldset>
        </div>
      </header>

      {/* ato 1: do caderno de votação ao plenário */}
      <section aria-label="Do caderno de votação ao plenário" className="mt-7">
        <div role="radiogroup" aria-label="Cargo" className="-mx-4 mb-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>button]:shrink-0 [&>button]:snap-start">
          <Escolha ativo={!cargoObjetos} aoClicar={() => mudar({ cargo: undefined })}>Todos os cargos</Escolha>
          {d.cargos.map((c) => (
            <Escolha key={c.cod} ativo={c.cod === cargoObjetos?.cod} aoClicar={() => mudar({ cargo: c.cod })}>{nomeCargo(c.nome)}</Escolha>
          ))}
        </div>
        <DoCadernoAoPlenario
          chave={`${ano}-${cargoObjetos?.cod ?? 'todos'}`}
          rotulos={rotulos}
          chance={chance}
          destaque={destaque}
          aoDestacar={setDestaque}
          grupos={[
            { titulo: 'Quem votou assina o caderno', total: `${milhoes(soma(d.votantes))} de pessoas, de cada 100`, valores: d.votantes },
            { titulo: 'Quem se candidatou', total: `${inteiro(soma(recorte.candidatos))} santinhos, de cada 100`, valores: recorte.candidatos },
            { titulo: 'Quem se elegeu', total: `${inteiro(soma(recorte.eleitos))} cadeiras, de cada 100`, valores: recorte.eleitos },
          ]}
        />
        <TabelaAlternavel
          titulo="Quem votou, candidatos e eleitos por grau de escolaridade"
          colunas={['Escolaridade', 'Quem votou', 'Candidatos', 'Eleitos', 'Chance de se eleger']}
          linhas={() => {
            const [v, c, e] = [porCento(d.votantes), porCento(recorte.candidatos), porCento(recorte.eleitos)]
            return rotulos.map((r, i) => [r, pct(v[i]), pct(c[i]), pct(e[i]), chance[i] == null ? '-' : pct(chance[i])]).reverse()
          }}
        />
      </section>

      {/* ato 2: os 100 santinhos */}
      <section aria-labelledby="santinhos-p4" className="adiar mt-24">
        <h2 id="santinhos-p4" className="t-h1">De cada 100 santinhos, quantos viram cadeira</h2>
        <p className="mt-3 max-w-[64ch] text-[1.02rem] leading-relaxed text-tinta-2">
          {veredito ? (
            <>
              {veredito}: para {nomeCargo(cargo100.nome).toLowerCase()}, de cada 100 candidatos com superior completo,{' '}
              <b className="tabular text-tinta">{taxa(8)}</b> se elegeram; {COM[6]}, <b className="tabular text-tinta">{taxa(6)}</b>
              {menor && <>; {COM[menor]}, <b className="tabular text-tinta">{taxa(menor)}</b></>}.
            </>
          ) : (
            <>
              Para {nomeCargo(cargo100.nome).toLowerCase()}, quase todo candidato tem superior completo:{' '}
              <b className="tabular text-tinta">{pct(porCento(cargo100.candidatos)[7], 0)}</b> dos candidatos e{' '}
              <b className="tabular text-tinta">{pct(porCento(cargo100.eleitos)[7], 0)}</b> dos eleitos.
            </>
          )}
        </p>
        <div role="radiogroup" aria-label="Cargo dos santinhos" className="mb-5 mt-5 flex flex-wrap gap-2">
          {d.cargos.map((c) => (
            <Escolha key={c.cod} ativo={c.cod === cargo100.cod} aoClicar={() => mudar({ santinho: c.cod })}>{nomeCargo(c.nome)}</Escolha>
          ))}
        </div>
        <CemSantinhos candidatos={cargo100.candidatos} eleitos={cargo100.eleitos} rotulos={rotulos} destaque={destaque} aoDestacar={setDestaque} />
      </section>

      {/* ato 3: as cinco câmaras e o boletim do município */}
      <section aria-labelledby="lugar-p4" className="adiar mt-24">
        <h2 id="lugar-p4" className="t-h1">{d.medida === 'eleitos' ? 'O lugar e quem ele elege' : 'O lugar e em quem ele vota'}</h2>
        <p className="mt-3 max-w-[64ch] text-[1.02rem] leading-relaxed text-tinta-2">
          {d.medida === 'eleitos' ? (
            <>
              Onde quem vota estudou menos, a câmara tem menos gente com diploma: <b className="tabular text-tinta">{pct(q1.eleitos, 0)}</b> dos
              eleitos no quinto menos escolarizado, <b className="tabular text-tinta">{pct(q5.eleitos, 0)}</b> no mais. Mas em todos o eleito
              estudou bem mais que o eleitor, e mais que os outros candidatos do próprio município.
            </>
          ) : (
            <>
              Deputado é eleito pelo estado, então aqui conta em quem cada município votou. O voto quase não muda com a escolaridade do lugar:
              de <b className="tabular text-tinta">{pct(q1.votados, 0)}</b> a <b className="tabular text-tinta">{pct(q5.votados, 0)}</b> dos votos
              foram para candidatos com superior completo.
            </>
          )}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="min-w-0">
            <CincoCamaras dados={d} quintilDoLugar={quintilDoLugar} />
            <p className="mt-4 text-[0.86rem] text-tinta-3">
              Correlação entre os {inteiro(d.todos.municipios)} municípios: <b className="tabular text-tinta-2">{decimal(Math.abs(d.correlacao ?? 0) < 0.005 ? 0 : d.correlacao, 2)}</b>
              {d.medida === 'eleitos' ? ' (0 seria nenhuma relação, 1 seria a mesma ordem).' : ' (0 seria nenhuma relação).'} O Censo 2022 dá o mesmo resultado.
            </p>
          </div>
          <div className="min-w-0">
            <Lugar ibge={ibge} ano={ano} uf={uf} quintil={quintilDoLugar} rotulos={rotulos} aoMudar={(i) => mudar({ ibge: i })} />
          </div>
        </div>
      </section>

      <footer className="mt-16 border-t border-linha pt-6">
        <Link to="/metodologia" hash="m-escolaridade" className="inline-flex items-center gap-1.5 font-semibold text-acao hover:underline">
          Como medimos a escolaridade <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </footer>
    </div>
  )
}
