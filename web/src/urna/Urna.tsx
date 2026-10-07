// Urna eletrônica (terminal do eleitor, modelo UE2020) desenhada em vetor, de frente, com as
// proporções medidas numa foto do equipamento: tela larga em moldura preta no alto, teclado numérico
// grafite com braile, a coluna BRANCO / CORRIGE / CONFIRMA e a área gravada no canto. No lugar do
// brasão e do nome do tribunal vai a marca do projeto (não é um equipamento oficial).
// As teclas são botões de verdade (mouse, toque, Tab + Enter); o visor é o canvas da busca.
import { memo, useEffect, useRef, useState } from 'react'
import { VISOR } from './visor'

export type IdTecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'branco' | 'corrige' | 'confirma'

// quadro do desenho; o corpo começa em (OX, OY)
const VW = 760, VH = 600, OX = 25, OY = 18
const CORPO = { w: 710, h: 505 }
const TELA = { x: 120, y: 22, w: 455, h: 214 } // área útil do visor, dentro da moldura

// braile: pontos de cada letra (1-3 coluna da esquerda, 4-6 da direita)
const BRAILE: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], r: [1, 2, 3, 5], '#': [3, 4, 5, 6],
}
const DIGITO_BRAILE = 'jabcdefghi' // 0 = j, 1 = a ... 9 = i (depois do sinal de número)

function Braile({ texto, x, y, passo = 7, r = 1.15, cor }: { texto: string; x: number; y: number; passo?: number; r?: number; cor: string }) {
  const d = r * 2.3
  return (
    <g fill={cor}>
      {[...texto].flatMap((letra, k) =>
        (BRAILE[letra] ?? []).map((p) => (
          <circle key={`${k}-${p}`} cx={x + k * passo + (p > 3 ? d : 0)} cy={y + ((p - 1) % 3) * d} r={r} />
        )),
      )}
    </g>
  )
}

interface Estilo {
  topo: [string, string]
  base: string
  borda: string
  rotulo: string
  braile: string
}
const GRAFITE: Estilo = { topo: ['#4b5056', '#2c3035'], base: '#141619', borda: '#1d2023', rotulo: '#f4f5f6', braile: '#8b9298' }
const FUNCAO: Record<'branco' | 'corrige' | 'confirma', Estilo> = {
  branco: { topo: ['#fdfdfc', '#e8e9e6'], base: '#b9bec1', borda: '#c9cdd0', rotulo: '#1b1d1f', braile: '#b2b7ba' },
  corrige: { topo: ['#f6964c', '#e8732a'], base: '#a9521a', borda: '#d36a26', rotulo: '#1b1d1f', braile: '#c25e1f' },
  confirma: { topo: ['#66dea8', '#3fc489'], base: '#268a5c', borda: '#38b37d', rotulo: '#0f2419', braile: '#2f9f6c' },
}

// memorizada: o cursor do visor pisca duas vezes por segundo e não precisa redesenhar as teclas
const Tecla = memo(function Tecla({ id, x, y, w, h, estilo, rotulo, braile, pulso, aoApertar }: {
  id: IdTecla
  x: number
  y: number
  w: number
  h: number
  estilo: Estilo
  rotulo: string
  braile: string
  pulso: number
  aoApertar: (id: IdTecla) => void
}) {
  const [apertada, setApertada] = useState(false)
  const primeiro = useRef(true)
  // tecla apertada pelo teclado do computador ou pela lista: afunda por um instante
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false
      return
    }
    setApertada(true)
    const t = setTimeout(() => setApertada(false), 140)
    return () => clearTimeout(t)
  }, [pulso])
  const digito = /^[0-9]$/.test(id)
  const g = `tecla-${id}`
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={digito ? `Tecla ${id}` : rotulo}
      className="tecla"
      data-apertada={apertada}
      onClick={() => aoApertar(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          aoApertar(id)
        }
      }}
    >
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={estilo.topo[0]} />
          <stop offset="1" stopColor={estilo.topo[1]} />
        </linearGradient>
      </defs>
      {/* sombra no corpo e espessura da tecla (o que aparece embaixo quando ela não está apertada) */}
      <rect x={x - 1} y={y + 1} width={w + 2} height={h + 4} rx={6} fill="#000" opacity={0.16} />
      <rect x={x} y={y + 2.6} width={w} height={h} rx={5} fill={estilo.base} />
      <g className="tecla-topo">
        <rect x={x} y={y} width={w} height={h} rx={5} fill={`url(#${g})`} stroke={estilo.borda} strokeWidth={0.8} />
        <path d={`M${x + 5} ${y + 1.2}H${x + w - 5}`} stroke="#fff" strokeOpacity={digito ? 0.2 : 0.65} strokeWidth={1.2} strokeLinecap="round" />
        {digito ? (
          <>
            <text x={x + 7.5} y={y + 16.5} fill={estilo.rotulo} fontSize={15.5} fontWeight={700}>{id}</text>
            <Braile texto={`#${DIGITO_BRAILE[Number(id)]}`} x={x + 26} y={y + 9} passo={7.5} cor={estilo.braile} />
            {id === '5' && <rect x={x + w / 2 - 5} y={y + h - 6} width={10} height={2} rx={1} fill={estilo.braile} />}
          </>
        ) : (
          <>
            <text x={x + w / 2} y={y + 13.5} textAnchor="middle" fill={estilo.rotulo} fontSize={11.5} fontWeight={800} style={{ fontStretch: '86%', letterSpacing: '0.01em' }}>
              {rotulo}
            </text>
            <Braile texto={braile} x={x + w / 2 - (braile.length * 6.2) / 2 + 1} y={y + 20} passo={6.2} r={0.95} cor={estilo.braile} />
          </>
        )}
        <rect className="tecla-foco" x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={7} fill="none" stroke="var(--color-acao)" strokeWidth={2.5} />
      </g>
    </g>
  )
})

/** Marca do projeto gravada no plástico, no lugar do brasão: só relevo, sem cor. */
function AreaGravada() {
  const gravado = { fill: 'none', strokeWidth: 1.2 }
  return (
    <g>
      {[[104, 342, 169, 66], [104, 412, 169, 32]].map(([x, y, w, h]) => (
        <g key={y}>
          <rect x={x} y={y + 1} width={w} height={h} rx={4} stroke="#fbfcfc" {...gravado} />
          <rect x={x} y={y} width={w} height={h} rx={4} stroke="#b9c1c5" {...gravado} />
        </g>
      ))}
      <g transform="translate(118 352)">
        <circle cx={22} cy={23} r={20} fill="none" stroke="#fbfcfc" strokeWidth={2} transform="translate(0 1)" />
        <circle cx={22} cy={23} r={20} fill="none" stroke="#bcc4c8" strokeWidth={2} />
        <path d="M12 23l7 8 15-17" fill="none" stroke="#bcc4c8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <text x={52} y={20} fill="#bcc4c8" fontSize={17} fontWeight={600}>Voto</text>
        <text x={52} y={40} fill="#bcc4c8" fontSize={17} fontWeight={600}>Aberto</text>
      </g>
      <text x={188} y={434} textAnchor="middle" fill="#bcc4c8" fontSize={17} fontWeight={600} letterSpacing="0.08em">VA2026</text>
    </g>
  )
}

const DIGITOS: { id: IdTecla; col: number; lin: number }[] = [
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d, i) => ({ id: d as IdTecla, col: i % 3, lin: Math.floor(i / 3) })),
  { id: '0', col: 1, lin: 3 },
]

export function Urna({ canvas, versao, pulsos, aoApertar }: {
  canvas: HTMLCanvasElement
  versao: number
  pulsos: Partial<Record<IdTecla, number>>
  aoApertar: (id: IdTecla) => void
}) {
  const visor = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    visor.current?.getContext('2d')?.drawImage(canvas, 0, 0)
  }, [canvas, versao])
  const pct = (v: number, total: number) => `${(100 * v) / total}%`

  return (
    <div className="relative mx-auto w-full max-w-[760px] select-none">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full" role="group" aria-label="Urna de consulta: teclado">
        <defs>
          <linearGradient id="urna-corpo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef0f1" />
            <stop offset="0.5" stopColor="#e4e8ea" />
            <stop offset="0.93" stopColor="#dce1e3" />
            <stop offset="1" stopColor="#c8cfd3" />
          </linearGradient>
          <linearGradient id="urna-lado" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.02" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.975" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="urna-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdd3d6" />
            <stop offset="1" stopColor="#aeb6bb" />
          </linearGradient>
          <linearGradient id="urna-moldura" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d2124" />
            <stop offset="1" stopColor="#101214" />
          </linearGradient>
          {/* grão fosco do plástico */}
          <filter id="urna-grao" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.38  0 0 0 0 0.4  0 0 0 0.09 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <filter id="urna-sombra" x="-10%" y="-200%" width="120%" height="500%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <clipPath id="urna-recorte">
            <rect width={CORPO.w} height={CORPO.h} rx={12} />
          </clipPath>
        </defs>

        <ellipse cx={OX + CORPO.w / 2} cy={OY + CORPO.h + 30} rx={CORPO.w * 0.53} ry={16} fill="#1c2630" opacity={0.28} filter="url(#urna-sombra)" />

        <g transform={`translate(${OX} ${OY})`}>
          {/* base */}
          <rect x={-8} y={CORPO.h - 6} width={CORPO.w + 16} height={34} rx={6} fill="url(#urna-base)" />
          <rect x={-8} y={CORPO.h + 25} width={CORPO.w + 16} height={3} rx={1.5} fill="#8f989d" />
          {/* corpo */}
          <rect width={CORPO.w} height={CORPO.h} rx={12} fill="url(#urna-corpo)" />
          <rect width={CORPO.w} height={CORPO.h} rx={12} fill="#fff" filter="url(#urna-grao)" clipPath="url(#urna-recorte)" />
          <rect width={CORPO.w} height={CORPO.h} rx={12} fill="url(#urna-lado)" />
          <rect x={0.6} y={0.6} width={CORPO.w - 1.2} height={CORPO.h - 1.2} rx={11.5} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.2} />
          <path d={`M10 ${CORPO.h - 0.5}H${CORPO.w - 10}`} stroke="#8d969b" strokeWidth={1.4} />
          {/* indicadores laterais */}
          <rect x={-1} y={362} width={5} height={11} rx={1} fill="#5b646b" />
          <rect x={CORPO.w - 4} y={362} width={5} height={11} rx={1} fill="#5b646b" />

          {/* moldura preta da tela */}
          <rect x={75} y={6} width={545} height={249} rx={4} fill="url(#urna-moldura)" />
          <rect x={75.5} y={6.5} width={544} height={248} rx={3.5} fill="none" stroke="#2b3034" strokeWidth={1} />
          <rect x={TELA.x - 1} y={TELA.y - 1} width={TELA.w + 2} height={TELA.h + 2} fill="#0a0b0c" />

          <AreaGravada />

          {DIGITOS.map((t) => (
            <Tecla key={t.id} id={t.id} x={301 + t.col * 63} y={285 + t.lin * 41} w={50} h={34} estilo={GRAFITE} rotulo={t.id} braile="" pulso={pulsos[t.id] ?? 0} aoApertar={aoApertar} />
          ))}
          <Tecla id="branco" x={491} y={284} w={76} h={34} estilo={FUNCAO.branco} rotulo="BRANCO" braile="branco" pulso={pulsos.branco ?? 0} aoApertar={aoApertar} />
          <Tecla id="corrige" x={491} y={326} w={76} h={34} estilo={FUNCAO.corrige} rotulo="CORRIGE" braile="corrige" pulso={pulsos.corrige ?? 0} aoApertar={aoApertar} />
          <Tecla id="confirma" x={491} y={368} w={76} h={48} estilo={FUNCAO.confirma} rotulo="CONFIRMA" braile="confirma" pulso={pulsos.confirma ?? 0} aoApertar={aoApertar} />
        </g>
      </svg>

      {/* visor: o canvas da busca, na posição exata da tela, com um leve reflexo do vidro */}
      <div
        className="pointer-events-none absolute overflow-hidden"
        style={{ left: pct(OX + TELA.x, VW), top: pct(OY + TELA.y, VH), width: pct(TELA.w, VW), height: pct(TELA.h, VH) }}
      >
        <canvas ref={visor} width={VISOR.largura} height={VISOR.altura} className="block h-full w-full" aria-hidden />
        <div className="absolute inset-0 bg-[linear-gradient(118deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_38%,rgb(255_255_255/0)_70%,rgb(255_255_255/0.05))]" />
      </div>
    </div>
  )
}
