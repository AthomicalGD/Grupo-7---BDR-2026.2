// A fileira de cadeiras de cada partido: cada quadrado de azulejo é uma cadeira. Azul veio direto dos votos
// (quociente), amarelo veio das sobras (maior média) e o quadrado tracejado é a sobra do partido, a fração de
// cadeira que ele juntou mas não bastou. Dá para ler sem uma linha de explicação.
import { Armchair } from '@phosphor-icons/react'
import { useId, type ReactNode } from 'react'
import { LogoPartido } from '../componentes/LogoPartido'
import { inteiro } from '../lib/formato'
import type { SituacaoLegenda } from '../api'

const MAX_PECAS = 14   // acima disso a fileira vira um quadrado com o número (uma bancada grande não cabe em quadradinhos)

function Peca({ tipo, fracao = 0, i }: { tipo: 'qp' | 'media' | 'sobra'; fracao?: number; i: number }) {
  const base = 'cadeira-peca relative grid size-[34px] shrink-0 place-items-center overflow-hidden rounded-[7px] border-[2.5px] max-sm:size-[30px]'
  const estilo = { '--i': i } as React.CSSProperties
  if (tipo === 'sobra') {
    return (
      <span aria-hidden className={`${base} border-dashed border-tinta-3 bg-folha`} style={estilo}>
        <span className="absolute inset-x-0 bottom-0 bg-[var(--azul)]/30" style={{ height: `${Math.round(fracao * 100)}%` }} />
        <Armchair size={19} weight="regular" className="relative text-tinta-3" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={`${base} border-tinta ${tipo === 'qp' ? 'bg-[var(--azul)] text-white' : 'bg-[var(--amarelo)] text-tinta'}`}
      style={estilo}
    >
      <Armchair size={20} weight="fill" />
    </span>
  )
}

function Bloco({ n, tipo, i }: { n: number; tipo: 'qp' | 'media'; i: number }) {
  return (
    <span
      aria-hidden
      className={`cadeira-peca inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[7px] border-[2.5px] border-tinta px-2.5 text-[0.95rem] font-extrabold tabular max-sm:h-[30px] ${
        tipo === 'qp' ? 'bg-[var(--azul)] text-white' : 'bg-[var(--amarelo)] text-tinta'
      }`}
      style={{ '--i': i } as React.CSSProperties}
    >
      <Armchair size={18} weight="fill" /> {inteiro(n)}
    </span>
  )
}

/** Federação (2022 em diante) ou coligação (2018): o nome (só as federações têm), os partidos e a soma dos votos deles. */
export interface GrupoLinha {
  nome: string | null
  membros: { sigla: string; votos?: number }[]
  total?: number
  quocientes?: number
}

export interface DadoLinha {
  sigla: string
  nome: string | null
  qp: number
  media: number
  total: number
  /** só quando há a conta de um estado: votos do partido e quantas cadeiras eles valem (votos ÷ quociente) */
  votos?: number
  quocientes?: number
  federado?: boolean
  /** com quem o partido somou votos */
  grupo?: GrupoLinha | null
  /** de onde vêm as cadeiras de votos: dos votos nos candidatos e dos votos de legenda */
  cadeirasCandidatos?: number
  cadeirasLegenda?: number
}

const dec = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Uma federação (ou coligação) é um bloco só: o cabeçalho diz quem são e quanto somam, e as fileiras dos membros ficam dentro. */
export function GrupoCadeiras({ grupo, lista, children }: { grupo: GrupoLinha; lista: string; children: ReactNode }) {
  const tipo = lista === 'federação' ? 'Federação' : 'Coligação'
  const siglas = grupo.membros.map((m) => m.sigla)
  const nomes = siglas.length > 1 ? `${siglas.slice(0, -1).join(', ')} e ${siglas[siglas.length - 1]}` : siglas[0]
  return (
    <li className="my-3 rounded-[var(--canto)] border-2 border-l-[6px] border-linha border-l-[var(--azul)] bg-folha px-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5 border-b-2 border-papel-2 py-3">
        <span className="flex basis-full flex-wrap gap-1" aria-hidden>
          {grupo.membros.map((m) => <LogoPartido key={m.sigla} sigla={m.sigla} tamanho="p" reservar={false} />)}
        </span>
        <div className="min-w-[12rem] flex-1">
          <p className="t-numero text-[1.1rem] leading-tight text-tinta">{tipo}{grupo.nome ? ` ${grupo.nome}` : ''}</p>
          <p className="mt-0.5 text-[0.8rem] text-tinta-2">{nomes} somam os votos</p>
        </div>
        {grupo.total != null && (
          <p className="tabular text-[0.82rem] leading-snug text-tinta-2 sm:text-right">
            <b className="t-numero text-[1.15rem] text-tinta">{inteiro(grupo.total)}</b> votos juntos
            {grupo.quocientes != null && <span className="block">valem {dec(grupo.quocientes)} cadeiras de votos</span>}
          </p>
        )}
      </div>
      <ul aria-label={`${tipo}: ${nomes}`}>{children}</ul>
    </li>
  )
}

export function LinhaCadeiras({ p, aberto, situacao, aoAbrir, filho }: {
  p: DadoLinha
  aberto: boolean
  situacao: SituacaoLegenda
  aoAbrir: (tipo: SituacaoLegenda) => void
  filho?: ReactNode
}) {
  const id = useId()
  const sobra = p.quocientes != null ? p.quocientes - p.qp : null
  const mostraSobra = p.media === 0 && sobra != null && sobra >= 0.08 && sobra < 1
  const grupo = (tipo: SituacaoLegenda, n: number, inicio: number) => {
    if (n === 0) return null
    const aqui = aberto && situacao === tipo
    const nome = tipo === 'qp' ? 'pelo quociente' : 'pelas sobras (maior média)'
    return (
      <button
        type="button"
        aria-expanded={aqui}
        aria-controls={aqui ? id : undefined}
        aria-label={`${p.sigla}: ${n} ${n === 1 ? 'eleito' : 'eleitos'} ${nome}. ${aqui ? 'Fechar' : 'Ver'} candidatos`}
        title={`${n} ${nome}`}
        onClick={() => aoAbrir(tipo)}
        className={`flex flex-wrap gap-1 rounded-[10px] p-1 transition-colors hover:bg-papel-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta ${aqui ? 'bg-papel-2 ring-[2.5px] ring-tinta' : ''}`}
      >
        {n > MAX_PECAS
          ? <Bloco n={n} tipo={tipo} i={inicio} />
          : Array.from({ length: n }, (_, k) => <Peca key={k} tipo={tipo} i={inicio + k} />)}
      </button>
    )
  }
  return (
    <li className="border-t-[3px] border-papel-2 py-3 first:border-0">
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-[minmax(8.5rem,0.7fr)_minmax(0,2.3fr)] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <LogoPartido sigla={p.sigla} reservar={false} />
            <span className="t-numero truncate text-[1.3rem] leading-none text-tinta" title={p.nome ?? p.sigla}>{p.sigla}</span>
          </div>
          <p className="tabular mt-1 text-[0.82rem] text-tinta-2">
            {p.votos != null ? <><b className="text-tinta">{inteiro(p.votos)}</b> votos</> : <>{inteiro(p.total)} {p.total === 1 ? 'eleito' : 'eleitos'}</>}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1" role="group" aria-label={`Cadeiras do ${p.sigla}: ${p.qp} pelo quociente e ${p.media} pelas sobras`}>
          {grupo('qp', p.qp, 0)}
          {grupo('media', p.media, p.qp)}
          {mostraSobra && <Peca tipo="sobra" fracao={sobra} i={p.qp + p.media} />}
          {p.quocientes != null && (
            <span className="tabular ml-2 text-[0.8rem] leading-snug text-tinta-2" title="votos do partido ÷ votos de uma cadeira">
              <b className="t-numero text-[1.05rem] text-tinta">{dec(p.quocientes)}</b> cadeiras de votos
              {p.cadeirasCandidatos != null && p.cadeirasLegenda != null && (
                <span className="block text-tinta-3">
                  {dec(p.cadeirasCandidatos)} dos candidatos + {dec(p.cadeirasLegenda)} da legenda
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      {aberto && filho && <div id={id} className="mt-3 sm:ml-[calc(23.33%+1.25rem)]">{filho}</div>}
    </li>
  )
}
