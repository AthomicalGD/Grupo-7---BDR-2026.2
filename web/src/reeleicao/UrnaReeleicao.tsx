// A urna da reeleição (P10a): 100 cédulas, cada uma 1% dos eleitos do cargo. "Colocar na urna" leva as
// de quem tentou a reeleição num arco até a fenda; elas caem e se empilham dentro da urna de acrílico,
// à vista. "Apurar" tira cada uma de volta pela fenda: as que voltaram vão, verdes e carimbadas, para a
// pilha da direita; as que perderam, amarelas, logo abaixo. Quem não tentou fica de fora, em papel.
// Desempenho: as cédulas são <div> que só mudam transform pela Web Animations API (camada de composição,
// sem redesenhar o SVG); a urna é desenhada uma vez, em duas camadas (fundo e frente de acrílico).
import { Check } from '@phosphor-icons/react'
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ContaReeleicao, GrupoReeleicao } from '../api'
import { cargoPlural, inteiro } from '../lib/formato'
import { COR, emCem, type Destino } from './conta'

export type Fase = 0 | 1 | 2

const FITAS = ['#5e881b', '#a2bd31', '#5d6b94', '#468baf', '#76acd0', '#f19929', '#fbc700']
const PLANTAS = {
  largo: { W: 960, H: 384, c: 18, h: 24, px: 23, py: 29, esq: [24, 52], dir: [714, 52], urna: { x: 380, topo: 158, L: 200, A: 184, fundo: 34, alto: 40 }, pilha: 9 },
  estreito: { W: 360, H: 520, c: 11, h: 15, px: 14.5, py: 18.5, esq: [14, 44], dir: [201, 44], urna: { x: 92, topo: 336, L: 158, A: 150, fundo: 26, alto: 30 }, pilha: 6.5 },
} as const
type Planta = (typeof PLANTAS)[keyof typeof PLANTAS]

const consulta = '(max-width: 639px)'
const assinar = (f: () => void) => {
  const m = matchMedia(consulta)
  m.addEventListener('change', f)
  return () => m.removeEventListener('change', f)
}
const useEstreito = () => useSyncExternalStore(assinar, () => matchMedia(consulta).matches)
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches

type Pose = { x: number; y: number; r: number; s: number; dentro: boolean }
const pose = (p: Pose) => `translate(${p.x}px, ${p.y}px) rotate(${p.r}deg) scale(${p.s})`
const casa = (p: Planta, origem: readonly number[], i: number) => ({ x: origem[0] + (i % 10) * p.px, y: origem[1] + Math.floor(i / 10) * p.py })
// giro de cada cédula na pilha, fixo por posição (parece papel caído, e não muda a cada render)
const giro = (i: number) => ((i * 47) % 17) - 8

function posesDe(p: Planta, cem: Record<Destino, number>, fase: Fase): { poses: Pose[]; cores: ('papel' | 'voltou' | 'perdeu')[] } {
  const { x, topo, L, A } = p.urna
  const fundoPilha = topo + A - (p === PLANTAS.largo ? 58 : 44)
  const linhasVoltou = Math.ceil(cem.voltou / 10)
  const poses: Pose[] = []
  const cores: ('papel' | 'voltou' | 'perdeu')[] = []
  for (let i = 0; i < 100; i++) {
    const destino: Destino = i < cem.nao ? 'nao' : i < cem.nao + cem.voltou ? 'voltou' : 'perdeu'
    const fora = casa(p, p.esq, i)
    if (fase === 0 || destino === 'nao') {
      poses.push({ ...fora, r: 0, s: 1, dentro: false })
      cores.push('papel')
    } else if (fase === 1) {
      const k = i - cem.nao // a ordem de chegada empilha de baixo para cima
      const col = k % 8
      const lin = Math.floor(k / 8)
      // fileiras desencontradas como tijolos, com um tremor fixo por cédula: parece papel caído, não grade
      const passo = (L - 28 - p.c * 0.72) / 7.5
      const tremor = (((i * 29) % 7) - 3) * 0.8
      poses.push({
        x: x + 14 + col * passo + (lin % 2 ? passo / 2 : 0) + tremor,
        y: fundoPilha - lin * p.pilha - p.h * 0.72 + (((i * 13) % 5) - 2),
        r: giro(i) * 2,
        s: 0.72,
        dentro: true,
      })
      cores.push('papel')
    } else {
      const k = destino === 'voltou' ? i - cem.nao : i - cem.nao - cem.voltou
      poses.push({ ...casa(p, p.dir, destino === 'voltou' ? k : (linhasVoltou + (cem.voltou ? 1 : 0)) * 10 + k), r: 0, s: 1, dentro: false })
      cores.push(destino)
    }
  }
  return { poses, cores }
}

/** O fundo da urna: tampo com a fenda, lateral e o interior. Fica atrás das cédulas. */
function UrnaFundo({ p }: { p: Planta }) {
  const { x, topo, L, A, fundo, alto } = p.urna
  const cx = x + L / 2
  return (
    <svg className="absolute left-0 top-0 overflow-visible" width={p.W} height={p.H} aria-hidden>
      <defs>
        <linearGradient id="urna-lado" x1="0" x2="1">
          <stop offset="0" stopColor="#dfe5ea" />
          <stop offset="1" stopColor="#c9d1d8" />
        </linearGradient>
      </defs>
      <ellipse cx={cx + fundo / 2} cy={topo + A + 12} rx={L * 0.7} ry={13} fill="rgb(42 53 80 / .16)" />
      {/* parede do fundo e chão do interior, vistos através do acrílico */}
      <polygon points={`${x + fundo},${topo - alto} ${x + L + fundo},${topo - alto} ${x + L + fundo},${topo + A - alto} ${x + fundo},${topo + A - alto}`} fill="#eef2f5" stroke="#c3cad1" />
      <polygon points={`${x},${topo + A} ${x + L},${topo + A} ${x + L + fundo},${topo + A - alto} ${x + fundo},${topo + A - alto}`} fill="#e3e8ec" />
      <polygon points={`${x + L},${topo} ${x + L + fundo},${topo - alto} ${x + L + fundo},${topo + A - alto} ${x + L},${topo + A}`} fill="url(#urna-lado)" opacity={0.75} />
    </svg>
  )
}

/** A frente de acrílico, o tampo com a fenda e a etiqueta: fica por cima das cédulas que estão dentro. */
function UrnaFrente({ p, fase, cargo, uf, dentro, detalhe }: { p: Planta; fase: Fase; cargo: string; uf: string; dentro: number; detalhe: string }) {
  const { x, topo, L, A, fundo, alto } = p.urna
  const cx = x + L / 2
  const s = L / 200
  const banda = 7 * 4 * s
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={p.W} height={p.H} aria-hidden>
      <defs>
        <linearGradient id="acrilico" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".62" />
          <stop offset=".45" stopColor="#ffffff" stopOpacity=".18" />
          <stop offset=".55" stopColor="#ffffff" stopOpacity=".42" />
          <stop offset="1" stopColor="#dbe8fb" stopOpacity=".3" />
        </linearGradient>
      </defs>
      {/* tampo */}
      <polygon points={`${x},${topo} ${x + L},${topo} ${x + L + fundo},${topo - alto} ${x + fundo},${topo - alto}`} fill="#f7f9fa" stroke="#9aa5b1" strokeWidth={1.2} />
      <polygon
        points={`${cx - 44 * s + fundo * 0.42},${topo - alto * 0.42} ${cx + 44 * s + fundo * 0.42},${topo - alto * 0.42} ${cx + 44 * s + fundo * 0.6},${topo - alto * 0.6} ${cx - 44 * s + fundo * 0.6},${topo - alto * 0.6}`}
        fill="#18202b"
      />
      {/* frente de acrílico com reflexo */}
      <rect x={x} y={topo} width={L} height={A} fill="url(#acrilico)" stroke="#7d8996" strokeWidth={1.4} />
      <line x1={x + L * 0.08} y1={topo + 8} x2={x + L * 0.08} y2={topo + A - banda - 8} stroke="#fff" strokeOpacity=".8" strokeWidth={3} strokeLinecap="round" />
      {/* etiqueta: o rótulo da urna, o cargo em destaque e uma linha curta que acompanha a fase */}
      {(() => {
        const ex = x + 16 * s
        const ew = L - 32 * s
        const linha = fase === 1 ? `${dentro} cédulas dentro` : fase === 2 ? `apurada · ${dentro} cédulas` : detalhe
        // cada linha encolhe para caber, sem cortar ("DEPUTADO ESTADUAL · 6 ESTADOS")
        const ajusta = (t: string, base: number, largura: number) => base * s * Math.min(1, (ew - 16 * s) / (t.length * largura * base * s))
        const titulo = `${cargo.toUpperCase()} · ${uf}`
        return (
          <g>
            <rect x={ex} y={topo + 14 * s} width={ew} height={76 * s} rx={6} fill="#fff" stroke="#18202b" strokeWidth={1.4} />
            <rect x={ex} y={topo + 14 * s} width={ew} height={17 * s} rx={6} fill="#18202b" />
            <rect x={ex} y={topo + 24 * s} width={ew} height={7 * s} fill="#18202b" />
            <text x={cx} y={topo + 26.5 * s} textAnchor="middle" fill="#fcfdfd" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 9.5 * s, letterSpacing: '0.22em' }}>
              REELEIÇÃO
            </text>
            <text x={cx} y={topo + 52 * s} textAnchor="middle" fill="#18202b" style={{ fontFamily: 'var(--font-sans)', fontWeight: 820, fontStretch: '86%', fontSize: ajusta(titulo, 17, 0.56) }}>
              {titulo}
            </text>
            <line x1={ex + 14 * s} x2={ex + ew - 14 * s} y1={topo + 62 * s} y2={topo + 62 * s} stroke="#d9dee2" strokeDasharray="3 3" />
            <text x={cx} y={topo + 79 * s} textAnchor="middle" fill="#4b5566" style={{ fontFamily: 'var(--font-sans)', fontWeight: 650, fontSize: ajusta(linha, 11, 0.52) }}>
              {linha}
            </text>
          </g>
        )
      })()}
      {/* a faixa das fitas */}
      {FITAS.map((cor, i) => (
        <rect key={cor} x={x} y={topo + A - banda + i * 4 * s} width={L} height={4 * s} fill={cor} />
      ))}
      <rect x={x} y={topo} width={L} height={A} fill="none" stroke="#7d8996" strokeWidth={1.4} />
    </svg>
  )
}

export function UrnaReeleicao({ conta, cargo, uf, anos, fase, aoMudarFase, aoAbrir }: {
  conta: ContaReeleicao
  cargo: string
  uf: string
  /** as disputas somadas, "1998-2022" */
  anos: string
  fase: Fase
  aoMudarFase: (f: Fase) => void
  aoAbrir: (g: GrupoReeleicao) => void
}) {
  const p = useEstreito() ? PLANTAS.estreito : PLANTAS.largo
  const cem = emCem(conta)
  const { poses, cores } = posesDe(p, cem, fase)
  const tentaram = cem.voltou + cem.perdeu

  // a cena é desenhada em coordenadas fixas e escalada para a largura do contêiner
  const caixa = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setEscala(e.contentRect.width / p.W))
    obs.observe(el)
    return () => obs.disconnect()
  }, [p.W])

  // a cada mudança, cada cédula voa da pose anterior até a nova: em arco pela fenda quando entra ou
  // sai da urna, em linha reta quando só troca de lugar do lado de fora
  const cedulas = useRef<(HTMLDivElement | null)[]>([])
  const anteriores = useRef<Pose[] | null>(null)
  const planta = useRef(p)
  useLayoutEffect(() => {
    const antes = anteriores.current
    anteriores.current = poses
    if (!antes || planta.current !== p || reduzido()) {
      planta.current = p
      return
    }
    const { x, topo, L, fundo, alto } = p.urna
    const fenda = { x: x + L / 2 + fundo * 0.5 - (p.c * 0.6) / 2, y: topo - alto * 0.5 - p.h * 0.5 }
    const acima = { x: fenda.x, y: fenda.y - (p === PLANTAS.largo ? 70 : 46) }
    let entra = 0
    let sai = 0
    poses.forEach((novo, i) => {
      const el = cedulas.current[i]
      const velho = antes[i]
      if (!el || (velho.x === novo.x && velho.y === novo.y && velho.r === novo.r)) return
      el.getAnimations().forEach((a) => a.cancel())
      let quadros: Keyframe[]
      let atraso: number
      if (!velho.dentro && novo.dentro) {
        quadros = [
          { transform: pose(velho) },
          { transform: pose({ ...acima, r: -10, s: 0.9, dentro: false }), offset: 0.45 },
          { transform: pose({ ...fenda, r: 0, s: 0.6, dentro: false }), offset: 0.62 },
          { transform: pose(novo) },
        ]
        atraso = Math.min(entra++ * 16, 900)
      } else if (velho.dentro && !novo.dentro) {
        quadros = [
          { transform: pose(velho) },
          { transform: pose({ ...fenda, r: 0, s: 0.6, dentro: false }), offset: 0.3 },
          { transform: pose({ ...acima, r: 8, s: 0.95, dentro: false }), offset: 0.52 },
          { transform: pose(novo) },
        ]
        atraso = 180 + Math.min(sai++ * 16, 900)
      } else {
        quadros = [{ transform: pose(velho) }, { transform: pose(novo) }]
        atraso = Math.min(i * 3, 300)
      }
      el.animate(quadros, { duration: quadros.length > 2 ? 980 : 620, delay: atraso, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' })
    })
  }, [poses, p])

  const rotulo = (texto: string, x: number, y: number, cor: string, grupo?: GrupoReeleicao) => {
    const estilo = { left: x, top: y - (p === PLANTAS.largo ? 30 : 24), fontSize: p === PLANTAS.largo ? 13 : 10.5 }
    return grupo ? (
      <button
        type="button"
        onClick={() => aoAbrir(grupo)}
        className="urna-rotulo absolute inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-bold transition-[background-color,transform] hover:-translate-y-px hover:bg-white active:translate-y-px"
        style={{ ...estilo, color: cor }}
      >
        {texto} {p === PLANTAS.largo && <span className="font-semibold text-tinta-3">· ver quem são</span>}
      </button>
    ) : (
      <span className="absolute whitespace-nowrap px-2 py-0.5 font-bold" style={{ ...estilo, color: cor }}>{texto}</span>
    )
  }
  const yPerdeu = p.dir[1] + (Math.ceil(cem.voltou / 10) + (cem.voltou ? 1 : 0)) * p.py

  const proxima = fase === 0
    ? { texto: 'Colocar na urna', alvo: 1 as Fase }
    : fase === 1
      ? { texto: 'Apurar', alvo: 2 as Fase }
      : { texto: 'Esvaziar a urna', alvo: 0 as Fase }
  const resumo = [
    `100 cédulas, cada uma 1% dos ${inteiro(conta.eleitos)} ${cargoPlural(cargo)} eleitos.`,
    fase >= 1 ? `${tentaram}% tentaram a reeleição e entraram na urna; ${cem.nao}% não tentaram.` : '',
    fase === 2 ? `Na apuração, ${cem.voltou}% voltaram e ${cem.perdeu}% perderam.` : '',
  ].join(' ')

  return (
    <div>
      <div ref={caixa} className="relative w-full" style={{ height: p.H * escala }} role="img" aria-label={resumo}>
        <div className="absolute left-0 top-0" style={{ width: p.W, height: p.H, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
          <UrnaFundo p={p} />
          {poses.map((ps, i) => {
            const cor = cores[i]
            return (
              <div
                key={i}
                ref={(el) => {
                  cedulas.current[i] = el
                }}
                className={`cedula-urna absolute left-0 top-0 ${cor === 'papel' ? '' : `cedula-${cor}`}`}
                style={{ width: p.c, height: p.h, transform: pose(ps), background: cor === 'papel' ? undefined : COR[cor] }}
                aria-hidden
              >
                {cor === 'voltou' && <Check className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-tinta" size={p.c * 0.62} weight="bold" />}
              </div>
            )
          })}
          <UrnaFrente p={p} fase={fase} cargo={cargo} uf={uf} dentro={tentaram} detalhe={`${inteiro(conta.eleitos)} eleitos · disputas ${anos}`} />
          <div className="absolute inset-0" aria-hidden={false}>
            {rotulo(fase === 0 ? 'Os eleitos, em 100 cédulas' : `${cem.nao}% dos eleitos não tentaram`, p.esq[0] - 8, p.esq[1], '#4b5566', fase === 0 ? undefined : 'nao')}
            {fase === 2 && cem.voltou > 0 && rotulo(`${cem.voltou}% dos eleitos voltaram`, p.dir[0] - 8, p.dir[1], COR.texto, 'voltaram')}
            {fase === 2 && cem.perdeu > 0 && rotulo(`${cem.perdeu}% dos eleitos perderam`, p.dir[0] - 8, yPerdeu, '#5f574a', 'perderam')}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{resumo}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => aoMudarFase(proxima.alvo)} className="botao-vivo h-11 px-6 text-[0.95rem]">
          {proxima.texto}
        </button>
        {fase === 1 && (
          <button type="button" onClick={() => aoMudarFase(0)} className="botao-contorno h-11 px-5 text-[0.9rem]">
            Tirar da urna
          </button>
        )}
        <span className="text-[0.85rem] text-tinta-3">Cada cédula vale 1% dos {inteiro(conta.eleitos)} eleitos.</span>
      </div>
    </div>
  )
}
