// O lugar: a sala de aula com 100 carteiras (quem votou no município, por grau de escolaridade)
// diante da câmara que ele elegeu (2024: vereadores no hemiciclo, com a cadeira do plenário, e o
// prefeito no miolo) ou dos 100 votos que ele deu para deputado (2022, quando o deputado é eleito
// pelo estado). Superior completo leva contorno em tinta: a cor nunca é o único sinal.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { consultas, type EleitoEscola, type EscolaLugar } from '../api'
import { BuscaMunicipio } from '../atlas/BuscaMunicipio'
import { hemiciclo } from '../cadeira/geometria'
import { Ciranda } from '../componentes/Ciranda'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, nomeProprio, plural } from '../lib/formato'
import { cem, cor, SUPERIOR } from './escolaridade'

const PREFEITO = 11

/** 100 carteiras (ou cédulas) em 10 fileiras, do superior completo (em cima) para baixo. */
function Cem({ valores, rotulo, lado = 17 }: { valores: number[]; rotulo: string; lado?: number }) {
  const n = cem(valores)
  const casas: number[] = []
  for (let g = 8; g >= 1; g--) for (let k = 0; k < n[g - 1]; k++) casas.push(g)
  const passo = lado + 3
  return (
    <svg width={passo * 10 - 1} height={passo * 10 - 1} role="img" aria-label={rotulo}>
      {casas.map((g, i) => (
        <rect
          key={i}
          x={(i % 10) * passo + 1}
          y={Math.floor(i / 10) * passo + 1}
          width={lado - 1}
          height={lado - 1}
          rx={2.5}
          fill={cor(g)}
          stroke={g === SUPERIOR ? 'var(--color-tinta)' : 'none'}
          strokeWidth={1.6}
        />
      ))}
    </svg>
  )
}

/** A cadeira do plenário vista de cima (encosto em tinta, assento na cor do grau), em unidades do diâmetro. */
function Assento({ nivel, foco }: { nivel: number | null; foco: boolean }) {
  return (
    <>
      <rect x={-0.44} y={-0.5} width={0.88} height={0.22} rx={0.08} fill="var(--color-tinta)" opacity={0.82} />
      <rect
        x={-0.37} y={-0.24} width={0.74} height={0.62} rx={0.15}
        fill={nivel ? cor(nivel) : 'var(--color-folha)'}
        stroke="var(--color-tinta)" strokeOpacity={nivel === SUPERIOR ? 1 : 0.35} strokeWidth={nivel === SUPERIOR ? 1.6 : 1}
        vectorEffect="non-scaling-stroke" strokeDasharray={nivel ? undefined : '2 2'}
      />
      {foco && <circle r={0.78} fill="none" stroke="var(--color-acao)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
    </>
  )
}

function Camara({ eleitos, rotulos, foco, aoFocar }: {
  eleitos: EleitoEscola[]
  rotulos: string[]
  foco: EleitoEscola | null
  aoFocar: (e: EleitoEscola | null) => void
}) {
  const toque = useRef(false)
  const jaFocada = useRef(false) // no toque o foco chega antes do clique: vale o estado de antes do dedo
  const vereadores = eleitos.filter((e) => e.cargo !== PREFEITO).sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0))
  const prefeito = eleitos.find((e) => e.cargo === PREFEITO)
  const { lugares, diametro } = hemiciclo(vereadores.length)
  const R = 150, cx = 162, cy = 166
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
        <Assento nivel={e.nivel} foco={foco?.id === e.id} />
      </g>
    </Link>
  )
  return (
    <svg width={2 * cx} height={cy + 12} role="group" aria-label="Câmara eleita" onPointerLeave={(ev) => ev.pointerType !== 'touch' && aoFocar(null)}>
      {vereadores.map((e, i) => {
        const l = lugares[i]
        return cadeira(e, cx + l.x * R, cy - l.y * R, 90 - (l.ang * 180) / Math.PI, d, `v${e.id}`)
      })}
      {prefeito && cadeira(prefeito, cx, cy - 16, 0, Math.max(d * 1.45, 22), `p${prefeito.id}`)}
    </svg>
  )
}

/** A rampa dos 8 graus com as pontas nomeadas embaixo; o superior completo com o contorno que o marca. */
function Legenda({ rotulos }: { rotulos: string[] }) {
  return (
    <div className="mt-5 w-[184px] text-[0.76rem] text-tinta-3">
      <svg width={184} height={16} role="img" aria-label="Escala de escolaridade, do analfabeto ao superior completo, que tem contorno">
        {rotulos.map((_, i) => (
          <rect key={i} x={i * 23 + 1} y={1} width={20} height={14} rx={2} fill={cor(i + 1)} stroke={i + 1 === SUPERIOR ? 'var(--color-tinta)' : 'none'} strokeWidth={1.6} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between gap-2" aria-hidden>
        <span>{rotulos[0]}</span>
        <span>{rotulos[SUPERIOR - 1]}</span>
      </div>
    </div>
  )
}

export function Lugar({ ibge, ano, rotulos, aoMudar }: {
  ibge: number
  ano: number
  rotulos: string[]
  aoMudar: (ibge: number) => void
}) {
  const q = useQuery({ ...consultas.escolaLugar(ibge, ano), placeholderData: keepPreviousData })
  const [aviso, setAviso] = useState('')
  const [foco, setFoco] = useState<EleitoEscola | null>(null)
  const d: EscolaLugar | undefined = q.data

  return (
    <div>
      <BuscaMunicipio
        rotulo="Procure um município"
        aoEscolher={(m) => {
          setAviso(m.carregada ? '' : `${m.nome} (${m.uf}) ainda não foi carregado no banco.`)
          if (m.carregada) aoMudar(m.ibge)
        }}
      />
      {aviso && <p role="status" className="mt-2 text-[0.86rem] text-tinta-2">{aviso}</p>}
      {!d ? (
        <div className="grid h-64 place-items-center"><Ciranda rotulo="Abrindo a sala..." /></div>
      ) : (
        <Sala d={d} rotulos={rotulos} foco={foco} aoFocar={setFoco} carregando={q.isPlaceholderData} />
      )}
    </div>
  )
}

function Sala({ d, rotulos, foco, aoFocar, carregando }: {
  d: EscolaLugar
  rotulos: string[]
  foco: EleitoEscola | null
  aoFocar: (e: EleitoEscola | null) => void
  carregando: boolean
}) {
  const sup = cem(d.votantes)[SUPERIOR - 1]
  const vereadores = d.eleitos.filter((e) => e.cargo !== PREFEITO)
  const supVer = vereadores.filter((e) => e.nivel === SUPERIOR).length
  const prefeito = d.eleitos.find((e) => e.cargo === PREFEITO)
  const supVotos = cem(d.votados)[SUPERIOR - 1]
  const municipal = d.ano === 2024
  const grau = (n: number | null) => (n ? rotulos[n - 1].toLowerCase() : 'escolaridade não divulgada')

  return (
    <div className={`mt-6 transition-opacity ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
      <h3 className="t-h3">{d.nome} <span className="font-normal text-tinta-3">({d.uf})</span></h3>
      <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-6">
        <figure>
          <figcaption className="t-rotulo mb-2 text-tinta-2">Quem votou, de cada 100</figcaption>
          <Cem valores={d.votantes} rotulo={`De cada 100 pessoas que votaram em ${d.nome}, ${sup} têm superior completo`} />
          <p className="tabular mt-2 text-[0.82rem] text-tinta-2"><b className="text-tinta">{sup}</b> com superior completo</p>
        </figure>
        <figure>
          <figcaption className="t-rotulo mb-2 text-tinta-2">
            {municipal ? `A câmara eleita, ${plural(vereadores.length, 'vereador', 'vereadores')}` : 'Os votos para deputado, de cada 100'}
          </figcaption>
          {municipal ? (
            <Camara eleitos={d.eleitos} rotulos={rotulos} foco={foco} aoFocar={aoFocar} />
          ) : (
            <Cem valores={d.votados} rotulo={`De cada 100 votos para deputado em ${d.nome}, ${supVotos} foram para candidatos com superior completo`} />
          )}
          <p className="tabular mt-2 text-[0.82rem] text-tinta-2">
            <b className="text-tinta">{municipal ? `${supVer} de ${vereadores.length}` : supVotos}</b> com superior completo
          </p>
        </figure>
      </div>
      <Legenda rotulos={rotulos} />
      {municipal && (
        <p aria-live="polite" className="mt-3 min-h-[1.4em] text-[0.84rem] text-tinta-2">
          {foco ? (
            <><b className="text-tinta">{nomeProprio(foco.nome_urna ?? foco.nome)}</b>{foco.partido ? ` (${foco.partido})` : ''}, {foco.cargo === PREFEITO ? 'prefeito' : 'vereador'}: {grau(foco.nivel)}. Clique de novo para ver a carreira.</>
          ) : (
            'Toque ou passe o mouse pelas cadeiras; o prefeito senta no meio.'
          )}
        </p>
      )}
      <p className="mt-3 max-w-[56ch] text-[1rem] leading-relaxed text-tinta-2">
        Em {d.nome}, <b className="tabular text-tinta">{sup} de cada 100</b> pessoas que votaram têm superior completo.{' '}
        {municipal ? (
          <>
            Na câmara eleita, <b className="tabular text-tinta">{supVer} de {vereadores.length}</b> vereadores têm
            {prefeito ? <>; o prefeito, {grau(prefeito.nivel)}.</> : '.'}
          </>
        ) : (
          <>Dos votos para deputado, <b className="tabular text-tinta">{supVotos} de cada 100</b> foram para candidatos com superior completo.</>
        )}
        {d.quintil && <> Na régua, está no {d.quintil}º quinto.</>}
      </p>
      <TabelaAlternavel
        titulo={`${d.nome}: escolaridade de quem votou e de ${municipal ? 'quem foi eleito' : 'quem recebeu os votos para deputado'}`}
        colunas={municipal ? ['Escolaridade', 'Quem votou', 'Vereadores', 'Prefeito'] : ['Escolaridade', 'Quem votou', 'Votos para deputado']}
        linhas={() => {
          const [v, vo] = [cem(d.votantes), cem(d.votados)]
          return [8, 7, 6, 5, 4, 3, 2, 1].map((n) =>
            municipal
              ? [rotulos[n - 1], `${v[n - 1]} de 100`, inteiro(vereadores.filter((e) => e.nivel === n).length), prefeito?.nivel === n ? 'sim' : '']
              : [rotulos[n - 1], `${v[n - 1]} de 100`, `${vo[n - 1]} de 100`],
          )
        }}
      />
    </div>
  )
}
