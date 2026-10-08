// P4: escolaridade do candidato x escolaridade de quem vota (2022 e 2024), em três atos:
// a peneira (quem votou, quem se candidatou, quem se elegeu, grau a grau), os 100 santinhos
// (a chance de cada grau virar cadeira) e a régua dos municípios com o lugar escolhido.
import { ArrowRight } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { consultas, type Ano, type Escola } from '../api'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargo as fmtCargo, decimal, inteiro, pct } from '../lib/formato'
import type { BuscaEscola } from '../router'
import { CemSantinhos } from './CemSantinhos'
import { porCento, soma, SUPERIOR } from './escolaridade'
import { Lugar } from './Lugar'
import { Peneira } from './Peneira'
import { Regua } from './Regua'

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
  // abre em 2022: a peneira mais forte (11% de quem votou, 79% dos eleitos com superior completo)
  const ano: Ano = busca.ano === 2024 ? 2024 : 2022
  const q = useQuery({ ...consultas.escola(ano), placeholderData: keepPreviousData })
  const [destaque, setDestaque] = useState(SUPERIOR)
  const d = q.data

  useEffect(() => {
    document.title = 'Quem passa pela peneira da urna? · Voto Aberto'
  }, [])

  const rotulos = useMemo(() => d?.niveis.map((n) => n.rotulo) ?? [], [d])
  if (q.error && !d) return <ErroCarga erro={q.error} />
  if (!d) return <CirandaTela rotulo="Peneirando as candidaturas..." />

  const cargoPeneira = d.cargos.find((c) => c.cod === busca.cargo)
  const cargo100 = d.cargos.find((c) => c.cod === busca.santinho) ?? d.cargos[0]
  const peneira = somaCargos(d, cargoPeneira?.cod)
  const todos = somaCargos(d)
  const chance = peneira.candidatos.map((c, i) => (c ? (100 * peneira.eleitos[i]) / c : null))
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

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-8 md:px-[72px] md:pt-10" aria-busy={q.isPlaceholderData}>
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="t-display">Quem passa pela peneira da urna?</h1>
          <p className="mt-4 max-w-[56ch] text-[clamp(1.15rem,1rem+0.7vw,1.5rem)] font-medium leading-[1.42] text-tinta-2" style={{ fontStretch: '96%' }}>
            Em {ano}, quem tinha superior completo era <b className="tabular font-bold text-tinta">{pct(sup(d.votantes), 0)}</b> de quem votou,{' '}
            <b className="tabular font-bold text-tinta">{pct(sup(todos.candidatos), 0)}</b> de quem se candidatou e{' '}
            <b className="tabular font-bold text-tinta">{pct(sup(todos.eleitos), 0)}</b> de quem se elegeu.
          </p>
          <p className="mt-3 text-[0.86rem] text-tinta-3">
            {lista(d.ufs)} · comparecimento do 1º turno e candidaturas aptas, com a escolaridade declarada ao TSE
          </p>
        </div>
        <fieldset>
          <legend className="t-rotulo mb-2 text-tinta-2">Eleição</legend>
          <CedulaAnos ano={ano} anos={ANOS} linhaDoTempo={false} aoMudar={(a) => mudar({ ano: a, cargo: undefined, santinho: undefined })} />
        </fieldset>
      </header>

      {/* ato 1: a peneira */}
      <section aria-label="A peneira" className="mt-10">
        <div role="radiogroup" aria-label="Cargo da peneira" className="mb-6 flex flex-wrap gap-2">
          <Escolha ativo={!cargoPeneira} aoClicar={() => mudar({ cargo: undefined })}>Todos os cargos</Escolha>
          {d.cargos.map((c) => (
            <Escolha key={c.cod} ativo={c.cod === cargoPeneira?.cod} aoClicar={() => mudar({ cargo: c.cod })}>{nomeCargo(c.nome)}</Escolha>
          ))}
        </div>
        <Peneira
          chave={`${ano}-${cargoPeneira?.cod ?? 'todos'}`}
          rotulos={rotulos}
          chance={chance}
          destaque={destaque}
          aoDestacar={setDestaque}
          postes={[
            { titulo: 'Quem votou', total: `${milhoes(soma(d.votantes))} de pessoas`, curto: milhoes(soma(d.votantes)), valores: d.votantes },
            { titulo: 'Candidatos', total: `${inteiro(soma(peneira.candidatos))} candidaturas`, curto: `${inteiro(soma(peneira.candidatos))} cand.`, valores: peneira.candidatos },
            { titulo: 'Eleitos', total: `${inteiro(soma(peneira.eleitos))} cadeiras`, curto: `${inteiro(soma(peneira.eleitos))} cadeiras`, valores: peneira.eleitos },
          ]}
        />
        <TabelaAlternavel
          titulo="Quem votou, candidatos e eleitos por grau de escolaridade"
          colunas={['Escolaridade', 'Quem votou', 'Candidatos', 'Eleitos', 'Chance de se eleger']}
          linhas={() => {
            const [v, c, e] = [porCento(d.votantes), porCento(peneira.candidatos), porCento(peneira.eleitos)]
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

      {/* ato 3: a régua e o lugar */}
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
        <div className="mt-8 grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <RecorteRegua d={d} ibge={busca.ibge ?? TERESINA} />
            <p className="mt-4 text-[0.86rem] text-tinta-3">
              Correlação entre os {inteiro(d.todos.municipios)} municípios: <b className="tabular text-tinta-2">{decimal(d.correlacao ?? 0, 2)}</b>
              {d.medida === 'eleitos' ? ' (0 seria nenhuma relação, 1 seria a mesma ordem).' : ' (0 seria nenhuma relação).'} O Censo 2022 dá o mesmo resultado.
            </p>
          </div>
          <div className="min-w-0">
            <Lugar ibge={busca.ibge ?? TERESINA} ano={ano} rotulos={rotulos} aoMudar={(ibge) => mudar({ ibge })} />
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

/** A régua com o município escolhido na última linha (os dados do lugar vêm do mesmo cache do painel ao lado). */
function RecorteRegua({ d, ibge }: { d: Escola; ibge: number }) {
  const { data: lugar } = useQuery({ ...consultas.escolaLugar(ibge, d.ano), placeholderData: keepPreviousData })
  return <Regua dados={d} lugar={lugar?.ano === d.ano ? lugar : undefined} />
}
