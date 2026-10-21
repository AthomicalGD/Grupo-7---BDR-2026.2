// O lugar: o boletim da escolaridade do município, no papel térmico do boletim de urna (cabeçalho em
// mono, picotes, linhas impressas em cascata e a borda serrilhada). Por grau: de cada 100 pessoas que
// votaram e, em 2024, quantos vereadores a câmara eleita tem; embaixo, a câmara no plenário (a cadeira
// do sistema, na cor do grau, e o prefeito no miolo). Em 2022, os votos para deputado no lugar da câmara.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { consultas, type EleitoEscola, type EscolaLugar } from '../api'
import { BuscaMunicipio } from '../atlas/BuscaMunicipio'
import { hemiciclo } from '../cadeira/geometria'
import { Atrasado, EsqueletoBloco } from '../componentes/Esqueleto'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { nomeProprio } from '../lib/formato'
import { cem, cor, SUPERIOR } from './escolaridade'
import { Cadeira } from './objetos'

const PREFEITO = 11
const GRAUS = [8, 7, 6, 5, 4, 3, 2, 1]

const Linha = ({ i, children, className = '' }: { i: number; children: ReactNode; className?: string }) => (
  <div className={`boletim-linha ${className}`} style={{ '--i': i } as CSSProperties}>{children}</div>
)
const Picote = () => <div className="my-3.5 border-t-[1.5px] border-dashed border-linha-2" aria-hidden />

function Camara({ eleitos, rotulos, foco, aoFocar }: {
  eleitos: EleitoEscola[]
  rotulos: string[]
  foco: EleitoEscola | null
  aoFocar: (e: EleitoEscola | null) => void
}) {
  const toque = useRef(false)
  const jaFocada = useRef(false) // no toque o foco chega antes do clique: vale o estado de antes do dedo
  const vereadores = eleitos.filter((e) => e.cargo !== PREFEITO).sort((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0))
  const prefeito = eleitos.find((e) => e.cargo === PREFEITO)
  const { lugares, diametro } = hemiciclo(vereadores.length)
  const R = 118, cx = 128, cy = 132
  const d = diametro * R
  const rotulo = (e: EleitoEscola) =>
    `${nomeProprio(e.nome_urna ?? e.nome)}, ${e.cargo === PREFEITO ? 'prefeito' : 'vereador'}${e.partido ? `, ${e.partido}` : ''}: ${e.nivel ? rotulos[e.nivel - 1].toLowerCase() : 'escolaridade não divulgada'}`
  const cadeira = (e: EleitoEscola, x: number, y: number, giro: number, escala: number, chave: string) => (
    <Link
      key={chave}
      to="/politico/$id"
      params={{ id: String(e.id) }}
      aria-label={rotulo(e)}
      onPointerDown={(ev) => {
        toque.current = ev.pointerType === 'touch'
        jaFocada.current = foco?.id === e.id
      }}
      // no toque, o primeiro mostra e o segundo abre (como no plenário)
      onClick={(ev) => {
        if (toque.current && !jaFocada.current) {
          ev.preventDefault()
          aoFocar(e)
        }
      }}
      onPointerEnter={(ev) => ev.pointerType !== 'touch' && aoFocar(e)}
      onFocus={() => aoFocar(e)}
      className="outline-none"
    >
      <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${escala})`}>
        <Cadeira fundo={e.nivel ? cor(e.nivel) : 'var(--color-folha)'} contorno={foco?.id === e.id ? 'var(--color-acao)' : undefined} />
      </g>
    </Link>
  )
  return (
    <svg width={2 * cx} height={cy + 12} role="group" aria-label="Câmara eleita" className="max-w-full" viewBox={`0 0 ${2 * cx} ${cy + 12}`}
      onPointerLeave={(ev) => ev.pointerType !== 'touch' && aoFocar(null)}>
      {vereadores.map((e, i) => {
        const l = lugares[i]
        return cadeira(e, cx + l.x * R, cy - l.y * R, 90 - (l.ang * 180) / Math.PI, d, `v${e.id}`)
      })}
      {prefeito && cadeira(prefeito, cx, cy - 14, 0, Math.max(d * 1.45, 20), `p${prefeito.id}`)}
    </svg>
  )
}

export function Lugar({ ibge, ano, uf, quintil, rotulos, aoMudar }: {
  ibge: number
  ano: number
  /** com estado escolhido, a busca fica nele */
  uf: string
  /** o quinto do município entre os quintos que a página mostra */
  quintil: number | null
  rotulos: string[]
  aoMudar: (ibge: number) => void
}) {
  const q = useQuery({ ...consultas.escolaLugar(ibge, ano), placeholderData: keepPreviousData })
  const [aviso, setAviso] = useState('')
  const d: EscolaLugar | undefined = q.data

  return (
    <div>
      <BuscaMunicipio
        uf={uf}
        rotulo={uf ? `Procure um município (${uf})` : 'Procure um município'}
        aoEscolher={(m) => {
          setAviso(m.carregada ? '' : `${m.nome} (${m.uf}) ainda não foi carregado no banco.`)
          if (m.carregada) aoMudar(m.ibge)
        }}
      />
      {aviso && <p role="status" className="mt-2 text-[0.86rem] text-tinta-2">{aviso}</p>}
      {!d ? (
        <Atrasado><EsqueletoBloco altura={256} linhas={0} rotulo="Imprimindo o boletim..." /></Atrasado>
      ) : (
        <BoletimEscola key={`${d.ibge}-${d.ano}`} d={d} quintil={quintil} rotulos={rotulos} carregando={q.isPlaceholderData} />
      )}
    </div>
  )
}

function BoletimEscola({ d, quintil, rotulos, carregando }: { d: EscolaLugar; quintil: number | null; rotulos: string[]; carregando: boolean }) {
  const [foco, setFoco] = useState<EleitoEscola | null>(null)
  const votou = cem(d.votantes)
  const votos = cem(d.votados)
  const vereadores = d.eleitos.filter((e) => e.cargo !== PREFEITO)
  const prefeito = d.eleitos.find((e) => e.cargo === PREFEITO)
  const supVer = vereadores.filter((e) => e.nivel === SUPERIOR).length
  const municipal = d.ano === 2024
  const grau = (n: number | null) => (n ? rotulos[n - 1].toLowerCase() : 'escolaridade não divulgada')

  return (
    <div className={`relative mt-4 transition-opacity ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
      <div className="h-3 rounded-full bg-tinta shadow-[inset_0_-2px_0_rgb(255_255_255/0.08)]" aria-hidden />
      <div className="mx-3 -mt-1.5 [filter:drop-shadow(0_14px_22px_rgb(42_53_80/0.16))_drop-shadow(0_1px_1px_rgb(42_53_80/0.08))]">
        <article aria-label={`Boletim da escolaridade de ${d.nome}`} className="boletim-papel relative bg-folha px-5 pb-10 pt-5 sm:px-7">
          <Linha i={0}>
            <p className="t-mono text-[0.74rem] tracking-[0.2em] text-tinta-2">BOLETIM DA ESCOLARIDADE</p>
            <h3 className="t-h1 mt-1">{d.nome}</h3>
            <p className="t-mono mt-1 text-[0.72rem] uppercase tracking-[0.06em] text-tinta-3">
              {d.uf} · {d.ano} · {municipal ? 'prefeito e vereadores' : 'deputados federal e estadual'}
              {quintil ? ` · ${quintil}º quinto` : ''}
            </p>
          </Linha>
          <Picote />
          <Linha i={1}>
            <table className="w-full text-[0.82rem]">
              <thead>
                <tr className="t-mono text-left text-[0.66rem] tracking-[0.08em] text-tinta-3">
                  <th scope="col" className="pb-1.5 font-medium">GRAU</th>
                  <th scope="col" className="pb-1.5 text-right font-medium">VOTOU<span className="block">(%)</span></th>
                  <th scope="col" className="pb-1.5 text-right font-medium">{municipal ? <>CÂMARA<span className="block">CADEIRAS</span></> : <>VOTOS<span className="block">(%)</span></>}</th>
                </tr>
              </thead>
              <tbody>
                {GRAUS.map((n) => {
                  const camara = vereadores.filter((e) => e.nivel === n).length
                  return (
                    <tr key={n} className={n === SUPERIOR ? 'border-y border-linha font-bold text-tinta' : 'text-tinta-2'}>
                      <th scope="row" className={`py-[2px] text-left ${n === SUPERIOR ? 'font-bold' : 'font-normal'}`}>{rotulos[n - 1]}</th>
                      <td className="t-mono tabular py-[1.5px] text-right">{votou[n - 1]}</td>
                      <td className="t-mono tabular py-[1.5px] text-right">{municipal ? camara : votos[n - 1]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Linha>
          {municipal && (
            <>
              <Picote />
            <Linha i={2}>
              <p className="t-mono text-[0.68rem] tracking-[0.12em] text-tinta-3">A CÂMARA ELEITA</p>
              <div className="mt-1 flex justify-center">
                <Camara eleitos={d.eleitos} rotulos={rotulos} foco={foco} aoFocar={setFoco} />
              </div>
              <p aria-live="polite" className="mt-1 min-h-[2.6em] text-center text-[0.8rem] text-tinta-2">
                {foco ? (
                  <><b className="text-tinta">{nomeProprio(foco.nome_urna ?? foco.nome)}</b>{foco.partido ? ` (${foco.partido})` : ''}, {foco.cargo === PREFEITO ? 'prefeito' : 'vereador'}: {grau(foco.nivel)}. Clique de novo para ver a carreira.</>
                ) : (
                  <>
                    <b className="tabular text-tinta">{supVer} de {vereadores.length}</b> vereadores com superior completo{prefeito ? `; prefeito: ${grau(prefeito.nivel)}` : ''}.
                    <span className="block text-tinta-3">Toque ou passe o mouse pelas cadeiras; o prefeito senta no meio.</span>
                  </>
                )}
              </p>
            </Linha>
            </>
          )}
        </article>
      </div>
      <TabelaAlternavel
        titulo={`${d.nome}: escolaridade de quem votou e de ${municipal ? 'quem foi eleito' : 'quem recebeu os votos para deputado'}`}
        colunas={municipal ? ['Escolaridade', 'Quem votou (%)', 'Vereadores', 'Prefeito'] : ['Escolaridade', 'Quem votou (%)', 'Votos para deputado (%)']}
        linhas={() =>
          GRAUS.map((n) =>
            municipal
              ? [rotulos[n - 1], String(votou[n - 1]), String(vereadores.filter((e) => e.nivel === n).length), prefeito?.nivel === n ? 'sim' : '']
              : [rotulos[n - 1], String(votou[n - 1]), String(votos[n - 1])],
          )
        }
      />
    </div>
  )
}
