// Cinco câmaras: os municípios em cinco quintos pela escolaridade de quem votou, e para cada quinto
// um plenário de 100 cadeiras com os eleitos que têm superior completo no azul do topo da escala
// (2024). Em 2022, quando o deputado é eleito pelo estado, cada quinto mostra 100 votos para
// deputado como casas da cédula, marcadas com X as dos candidatos com superior completo.
// Embaixo, quem votou e os candidatos.
import type { Escola } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { decimal, pct } from '../lib/formato'
import { cor, SUPERIOR, useLargura } from './escolaridade'
import { Plenario } from './objetos'

const NOMES = ['Menos escolarizados', '2º quinto', '3º quinto', '4º quinto', 'Mais escolarizados']
const VAZIA = 'var(--color-folha)'
const CONTORNO = '#87919d' // 3,1:1 sobre a folha: as 100 unidades continuam contáveis

/** 100 votos como casas da cédula; o X (dois traços, como na cédula de anos) marca os votos em superior. */
function CemVotos({ k, largura }: { k: number; largura: number }) {
  const VAO = 2.5
  const w = (largura - 9 * VAO) / 10
  const m = w * 0.24
  return (
    <svg width={largura} height={10 * (w + VAO)} aria-hidden>
      {Array.from({ length: 100 }, (_, j) => {
        const x = (j % 10) * (w + VAO), y = Math.floor(j / 10) * (w + VAO)
        return (
          <g key={j}>
            <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={w - 1} rx={1.5} fill={VAZIA} stroke={j < k ? cor(SUPERIOR) : CONTORNO} strokeWidth={0.9} />
            {j < k && (
              <path d={`M${x + m},${y + m}L${x + w - m},${y + w - m}M${x + w - m},${y + m}L${x + m},${y + w - m}`} stroke={cor(SUPERIOR)} strokeWidth={1.6} strokeLinecap="round" />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Quinto({ dados, i, municipal, marcado }: { dados: Escola; i: number; municipal: boolean; marcado: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const q = dados.quintis[i]
  const alvo = municipal ? q.eleitos : q.votados
  const k = Math.round(alvo ?? 0)
  return (
    <li className={`min-w-0 rounded-xl p-3 transition-colors ${marcado ? 'bg-papel-2 outline-2 outline-marcador' : ''}`}>
      <p className="text-[0.88rem] font-bold leading-tight text-tinta">{NOMES[i]}</p>
      <p className="tabular text-[0.72rem] text-tinta-3">{decimal(q.de)} a {decimal(q.ate)}% votou com superior</p>
      <div ref={ref} className="mt-3" role="img" aria-label={`${NOMES[i]}: ${k} de cada 100 ${municipal ? 'eleitos' : 'votos para deputado'} com superior completo; quem votou, ${pct(q.votantes)}`}>
        {largura > 0 &&
          (municipal ? (
            <Plenario largura={largura} contorno={CONTORNO} cores={Array.from({ length: 100 }, (_, j) => (j < k ? cor(SUPERIOR) : VAZIA))} />
          ) : (
            <CemVotos k={k} largura={Math.min(largura, 120)} />
          ))}
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="t-numero tabular text-[1.7rem]">{k}</span>
        <span className="text-[0.78rem] text-tinta-2">de 100</span>
      </p>
      <p className="text-[0.76rem] leading-snug text-tinta-2">{municipal ? 'eleitos' : 'votos'} com superior</p>
      <p className="mt-1.5 text-[0.72rem] leading-snug text-tinta-3">com superior, de cada 100:</p>
      <dl className="tabular grid grid-cols-[auto_auto] justify-start gap-x-2 text-[0.74rem] text-tinta-3">
        <dt>quem votou</dt><dd className="font-semibold text-tinta-2">{Math.round(q.votantes ?? 0)}</dd>
        {municipal && <><dt>candidatos</dt><dd className="font-semibold text-tinta-2">{Math.round(q.candidatos ?? 0)}</dd></>}
      </dl>
    </li>
  )
}

export function CincoCamaras({ dados, quintilDoLugar }: { dados: Escola; quintilDoLugar?: number | null }) {
  const municipal = dados.medida === 'eleitos'
  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 max-sm:[&>li:last-child]:col-span-2">
        {dados.quintis.map((_, i) => (
          <Quinto key={i} dados={dados} i={i} municipal={municipal} marcado={quintilDoLugar === i + 1} />
        ))}
      </ol>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-tinta-3">
        <span className="flex items-center gap-1.5">
          {municipal ? (
            <span className="size-3 rounded-full" style={{ background: cor(SUPERIOR) }} aria-hidden />
          ) : (
            <svg width={12} height={12} aria-hidden><rect x={0.5} y={0.5} width={11} height={11} rx={1.5} fill={VAZIA} stroke={cor(SUPERIOR)} /><path d="M3,3L9,9M9,3L3,9" stroke={cor(SUPERIOR)} strokeWidth={1.6} strokeLinecap="round" /></svg>
          )}
          {municipal ? 'eleito com superior completo' : 'voto em candidato com superior completo'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`size-3 border ${municipal ? 'rounded-full' : 'rounded-[2px]'}`} style={{ borderColor: CONTORNO, background: 'var(--color-folha)' }} aria-hidden />
          outros graus
        </span>
        {quintilDoLugar && <span>Com contorno amarelo: o quinto do município do boletim.</span>}
      </p>
      <TabelaAlternavel
        titulo="% com superior completo, por quinto de municípios"
        colunas={municipal ? ['Grupo', 'Municípios', 'Quem votou', 'Candidatos', 'Eleitos'] : ['Grupo', 'Municípios', 'Quem votou', 'Votos para deputado']}
        linhas={() =>
          dados.quintis.map((q, i) => [
            `${NOMES[i]} (${decimal(q.de)} a ${decimal(q.ate)}%)`,
            String(q.municipios),
            pct(q.votantes),
            ...(municipal ? [pct(q.candidatos), pct(q.eleitos)] : [pct(q.votados)]),
          ])
        }
      />
    </div>
  )
}
