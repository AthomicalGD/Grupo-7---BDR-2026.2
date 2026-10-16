// Cada cadeira, cada estado: 2022 ao lado de 2024. Para cada cargo e para cada um dos estados, a faixa
// dos eleitos com os 8 graus em fila (do analfabeto ao superior completo, na escala da bandeira), sob a
// faixa de quem votou, que é a régua de comparação. O número à direita é o "de 100 com superior".
// Os estados ficam numa tabela só, com os dois anos na mesma linha; clicar num estado aplica o filtro.
import type { ReactNode } from 'react'
import type { EscolaComparar } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargo as fmtCargo, inteiro, pct, plural } from '../lib/formato'
import { cem, cor, porCento, soma, SUPERIOR } from './escolaridade'

const ANOS = ['2022', '2024'] as const
const TIPO: Record<string, string> = { '2022': 'eleições gerais', '2024': 'eleições municipais' }
const PRESIDENTE = 1

const somar = (vs: number[][]) => Array.from({ length: 8 }, (_, i) => soma(vs.map((v) => v[i])))

/** A faixa de composição: os 8 graus em fila, do analfabeto ao superior completo. */
function Faixa({ valores, rotulos, altura = 22, leve = false }: { valores: number[]; rotulos: string[]; altura?: number; leve?: boolean }) {
  const p = porCento(valores)
  return (
    <div className={`flex overflow-hidden rounded-[4px] ${leve ? 'opacity-75' : ''}`} style={{ height: altura }} role="img" aria-label={rotulos.map((r, i) => `${r} ${pct(p[i])}`).join(', ')}>
      {p.map((x, i) =>
        x > 0 ? (
          <span key={i} className="h-full border-r border-folha/70 last:border-r-0" style={{ width: `${x}%`, background: cor(i + 1) }} title={`${rotulos[i]}: ${pct(x)}`} />
        ) : null,
      )}
    </div>
  )
}

function Linha({ rotulo, sub, valores, rotulos, forte = false }: {
  rotulo: ReactNode
  sub: string
  valores: number[]
  rotulos: string[]
  forte?: boolean
}) {
  const sup = cem(valores)[SUPERIOR - 1]
  const corpo = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-[0.88rem] leading-tight text-tinta">{rotulo}</span>
        <span className="tabular block text-[0.72rem] text-tinta-3">{sub}</span>
      </span>
      <Faixa valores={valores} rotulos={rotulos} altura={forte ? 18 : 12} leve={!forte} />
      <span className="flex items-baseline justify-end gap-1">
        <span className={`t-numero tabular ${forte ? 'text-[1.35rem] text-tinta' : 'text-[1.05rem] text-tinta-2'}`}>{sup}%</span>
      </span>
    </>
  )
  return <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.4rem] items-center gap-3 px-2 py-1">{corpo}</div>
}

/** Um estado num ano: a faixa, o "de 100" e, miúdos, quantos eleitos e quantos de 100 que votaram têm superior. */
function Celula({ ano, eleitos, votou, rotulos }: { ano: string; eleitos: number[]; votou: number; rotulos: string[] }) {
  return (
    <span className="grid grid-cols-[2.4rem_minmax(0,1fr)_2rem_5.2rem] items-center gap-2 lg:grid-cols-[minmax(0,1fr)_2rem_5.2rem]">
      <span className="tabular text-[0.72rem] text-tinta-3 lg:hidden">{ano}</span>
      <Faixa valores={eleitos} rotulos={rotulos} altura={14} />
      <span className="t-numero tabular text-right text-[1.2rem] text-tinta">{cem(eleitos)[SUPERIOR - 1]}</span>
      <span className="tabular text-[0.7rem] leading-tight text-tinta-3">
        {inteiro(soma(eleitos))} eleitos
        <span className="block">votou: {votou}%</span>
      </span>
    </span>
  )
}

export function CadaCadeira({ dados, uf, rotulos, aoEscolherUf }: {
  dados: EscolaComparar
  uf: string
  rotulos: string[]
  aoEscolherUf: (uf: string) => void
}) {
  const ufs = dados.ufs.map((u) => u.sigla)
  const recorte = uf ? [uf] : ufs
  const quemVotou = (a: string) => somar(recorte.map((s) => dados.anos[a][s]?.votantes ?? Array(8).fill(0)))
  // Presidente é nacional: vem sob "BR", o mesmo em qualquer estado
  const eleitosCargo = (a: string, cod: number) =>
    somar((cod === PRESIDENTE ? ['BR'] : recorte).map((s) => dados.anos[a][s]?.cargos[cod]?.eleitos ?? Array(8).fill(0)))
  const eleitosUf = (a: string, s: string) => somar(Object.values(dados.anos[a][s]?.cargos ?? {}).map((c) => c.eleitos))

  // o achado: o cargo com mais e com menos diploma (presidente fica de fora: um eleito só não é taxa)
  const todos = ANOS.flatMap((a) =>
    dados.cargos[a].filter((c) => c.cod !== PRESIDENTE).map((c) => ({ a, c, sup: porCento(eleitosCargo(a, c.cod))[SUPERIOR - 1] })),
  )
  const mais = todos.reduce((x, y) => (y.sup > x.sup ? y : x))
  const menos = todos.reduce((x, y) => (y.sup < x.sup ? y : x))
  const votou22 = Math.round(porCento(quemVotou('2022'))[SUPERIOR - 1])
  const votou24 = Math.round(porCento(quemVotou('2024'))[SUPERIOR - 1])

  return (
    <div>
      <p className="max-w-[76ch] text-[1.02rem] leading-relaxed text-tinta-2">
        Quanto mais alta a cadeira, mais diploma: <b className="text-tinta">{fmtCargo(mais.c.nome).toLowerCase()}</b> ({mais.a}) chega a{' '}
        <b className="tabular text-tinta">{Math.round(mais.sup)}%</b> dos eleitos com superior completo; <b className="text-tinta">{fmtCargo(menos.c.nome).toLowerCase()}</b>{' '}
        ({menos.a}), a <b className="tabular text-tinta">{Math.round(menos.sup)}%</b>. Entre quem votou: {votou22 === votou24 ? <>{votou22}%, nos dois anos</> : <>{votou22}% em 2022 e {votou24}% em 2024</>}.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
        {ANOS.map((a) => (
          <section key={a} aria-label={`${a}, ${TIPO[a]}`} className="min-w-0">
            <h3 className="flex items-baseline gap-2 border-b border-linha pb-1.5">
              <span className="t-numero tabular text-[1.75rem]">{a}</span>
              <span className="text-[0.86rem] text-tinta-3">{TIPO[a]}{uf ? `, ${uf}` : ''}</span>
            </h3>
            <div className="mt-2">
              <Linha rotulo="Quem votou" sub={`${inteiro(soma(quemVotou(a)))} pessoas`} valores={quemVotou(a)} rotulos={rotulos} />
              {dados.cargos[a].map((c) => {
                const e = eleitosCargo(a, c.cod)
                return <Linha key={c.cod} forte rotulo={fmtCargo(c.nome)} sub={plural(soma(e), 'eleito', 'eleitos')} valores={e} rotulos={rotulos} />
              })}
            </div>
          </section>
        ))}
      </div>

      <section aria-label="Eleitos por estado, 2022 e 2024" className="mt-7">
        <div className="grid grid-cols-1 items-end gap-x-12 border-b border-linha px-2 pb-1.5 lg:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)]">
          <p className="t-rotulo text-tinta-2">Eleitos por estado<span className="block text-[0.72rem] font-normal text-tinta-3">clique para filtrar</span></p>
          {ANOS.map((a) => (
            <p key={a} className="hidden items-baseline gap-2 lg:flex">
              <span className="t-numero tabular text-[1.1rem]">{a}</span>
              <span className="text-[0.76rem] text-tinta-3">% dos eleitos com superior</span>
            </p>
          ))}
        </div>
        <div className="mt-1 space-y-0.5">
          {ufs.map((s) => {
            const ativo = s === uf
            return (
              <button
                key={s}
                type="button"
                onClick={() => aoEscolherUf(ativo ? '' : s)}
                aria-pressed={ativo}
                className={`grid w-full grid-cols-1 gap-x-12 gap-y-1 rounded-lg px-2 py-1 text-left hover:bg-folha focus-visible:outline-2 focus-visible:outline-acao lg:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center ${ativo ? 'bg-folha outline-2 outline-marcador' : ''}`}
              >
                <span className={`truncate text-[0.88rem] ${ativo ? 'font-bold' : ''} text-tinta`}>{dados.ufs.find((u) => u.sigla === s)?.nome ?? s}</span>
                {ANOS.map((a) => (
                  <Celula key={a} ano={a} eleitos={eleitosUf(a, s)} votou={cem(dados.anos[a][s]?.votantes ?? Array(8).fill(0))[SUPERIOR - 1]} rotulos={rotulos} />
                ))}
              </button>
            )
          })}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-tinta-3">
        <span>{rotulos[0]}</span>
        {rotulos.map((_, i) => <span key={i} className="h-3 w-5 rounded-[2px]" style={{ background: cor(i + 1) }} aria-hidden />)}
        <span>{rotulos[SUPERIOR - 1]}</span>
        <span className="ml-3">A faixa de quem votou, mais fina e clara, é a régua; "votou" é o % de quem votou no estado com superior.</span>
      </div>
      <TabelaAlternavel
        titulo="% dos eleitos com superior completo, por cargo e por estado"
        colunas={['Ano', 'Grupo', 'Eleitos', 'Com superior (%)']}
        linhas={() =>
          ANOS.flatMap((a) => [
            ...dados.cargos[a].map((c) => [a, fmtCargo(c.nome), inteiro(soma(eleitosCargo(a, c.cod))), String(cem(eleitosCargo(a, c.cod))[SUPERIOR - 1])]),
            ...ufs.map((s) => [a, s, inteiro(soma(eleitosUf(a, s))), String(cem(eleitosUf(a, s))[SUPERIOR - 1])]),
          ])
        }
      />
    </div>
  )
}
