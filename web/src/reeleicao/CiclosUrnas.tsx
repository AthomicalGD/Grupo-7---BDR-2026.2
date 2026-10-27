// Eleição a eleição como uma fila de urnas: cada urna guarda quem tentou a reeleição naquela disputa;
// o verde sobe até a taxa (voltaram ÷ tentaram) e o resto é o cinza de quem perdeu.
// Urna vazia e hachurada quando ninguém tentou; o tracejado em tinta é a média das taxas dos municípios. Clicar numa urna abre quem são os eleitos dela.
import type { Reeleicao } from '../api'
import { inteiro, pct } from '../lib/formato'
import { COR } from './conta'

type Cargo = Reeleicao['cargos'][number]
const W = 92, H = 132
const CORPO = { x: 14, y: 40, w: 60, h: 78 }
const FUNDO = 12, ALTO = 14

function MiniUrna({ taxa, media, ativa }: { taxa: number | null; media: number | null; ativa: boolean }) {
  const { x, y, w, h } = CORPO
  const id = `u${Math.round((taxa ?? -1) * 10)}${Math.round((media ?? -1) * 10)}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[92px]" aria-hidden>
      <defs>
        <clipPath id={`corpo-${id}`}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
        <pattern id={`hachura-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#d9dee2" strokeWidth="2" />
        </pattern>
      </defs>
      <ellipse cx={x + w / 2 + FUNDO / 2} cy={y + h + 6} rx={w * 0.62} ry={5} fill="rgb(42 53 80 / .12)" />
      <polygon points={`${x + w},${y} ${x + w + FUNDO},${y - ALTO} ${x + w + FUNDO},${y + h - ALTO} ${x + w},${y + h}`} fill="#dfe4e8" stroke="#aeb6bf" />
      <polygon points={`${x},${y} ${x + w},${y} ${x + w + FUNDO},${y - ALTO} ${x + FUNDO},${y - ALTO}`} fill="#f7f9fa" stroke="#aeb6bf" />
      <polygon points={`${x + 16},${y - 5} ${x + w - 8},${y - 5} ${x + w - 4},${y - 9} ${x + 20},${y - 9}`} fill="#18202b" />
      <g clipPath={`url(#corpo-${id})`}>
        {taxa == null ? (
          <rect x={x} y={y} width={w} height={h} fill={`url(#hachura-${id})`} />
        ) : (
          <>
            <rect x={x} y={y} width={w} height={h} fill={COR.perdeu} />
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={COR.voltou}
              className="transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
              style={{ transform: `scaleY(${taxa / 100})`, transformOrigin: `0 ${y + h}px` }}
            />
          </>
        )}
        {media != null && <line x1={x - 2} x2={x + w + 2} y1={y + h - (h * media) / 100} y2={y + h - (h * media) / 100} stroke="#18202b" strokeWidth={2} strokeDasharray="3 3" />}
      </g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={ativa ? '#18202b' : '#aeb6bf'} strokeWidth={ativa ? 2.2 : 1} />
    </svg>
  )
}

export function CiclosUrnas({ cargo, ativo, aoEscolher }: { cargo: Cargo; ativo: number | null; aoEscolher: (eleitosEm: number) => void }) {
  return (
    <div>
      <ol className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0" style={{ gridTemplateColumns: `repeat(${cargo.ciclos.length}, minmax(0, 1fr))` }}>
        {cargo.ciclos.map((c) => {
          const marcada = c.eleitos_em === ativo
          return (
            <li key={c.eleitos_em} className="w-[88px] shrink-0 snap-start sm:w-auto">
              <button
                type="button"
                onClick={() => aoEscolher(c.eleitos_em)}
                aria-pressed={marcada}
                aria-label={`Disputa de ${c.disputa}, eleitos em ${c.eleitos_em}: ${
                  c.tentaram ? `${inteiro(c.reeleitos)} de ${inteiro(c.tentaram)} que tentaram voltaram (${pct(c.taxa)})` : 'nenhum eleito tentou'
                }${c.pendentes ? `; ${inteiro(c.pendentes)} aguardam o 2º turno, ainda não publicado` : ''}${c.media_municipios != null ? `; média dos municípios ${pct(c.media_municipios)}` : ''}. Ver quem são.`}
                className={`group flex w-full flex-col items-center rounded-2xl px-1 pb-2 pt-3 transition-colors hover:bg-folha focus-visible:outline-[3px] focus-visible:outline-acao ${marcada ? 'bg-folha shadow-[inset_0_-3px_0_var(--color-acao)]' : ''}`}
              >
                <span className={`t-numero text-[clamp(1.3rem,1rem+0.8vw,1.75rem)] tabular ${c.taxa == null ? 'text-tinta-3' : 'text-tinta'}`}>
                  {c.taxa == null ? 'ninguém' : `${inteiro(Math.round(c.taxa))}%`}
                </span>
                <MiniUrna taxa={c.taxa} media={c.media_municipios} ativa={marcada} />
                <span className="t-rotulo tabular text-tinta">{c.disputa}</span>
                <span className="text-[0.78rem] tabular text-tinta-3">eleitos em {c.eleitos_em}</span>
                <span className="mt-0.5 text-[0.78rem] tabular text-tinta-3">
                  {inteiro(c.reeleitos)} de {inteiro(c.tentaram)}
                </span>
                {!!c.pendentes && <span className="text-[0.72rem] leading-tight text-tinta-3">+{inteiro(c.pendentes)} no 2º turno</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-tinta-2">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3.5 w-2.5 rounded-[2px]" style={{ background: COR.voltou }} /> voltaram
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3.5 w-2.5 rounded-[2px]" style={{ background: COR.perdeu }} /> tentaram e perderam
        </li>
        {cargo.municipal && (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-5 border-t-2 border-dashed border-tinta" />
            média das taxas dos municípios
          </li>
        )}
        <li>A urna é quem tentou; a altura do verde é a taxa de reeleição.</li>
      </ul>
    </div>
  )
}
