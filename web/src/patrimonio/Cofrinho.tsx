// O cofrinho da P2: todos os candidatos do recorte começam dentro de um porquinho de porcelana com a faixa
// das sete fitas. Quebrar o cofrinho (clique, toque ou Enter) o chacoalha, racha e parte em seis cacos que
// caem no chão; as moedas voam para as sacolas, uma por faixa de patrimônio, da que declarou menos à que
// declarou mais (as quatro têm o mesmo número de candidatos; a sacola é mais gorda quanto mais bens). Quem
// não registrou bens fica com a sacola vazia, tracejada. "Ver quem se elegeu" empilha sobre cada sacola as
// moedas dos eleitos: cada moeda é 1 eleito em cada 100 candidatos da faixa, e o tracejado é a média.
// O React desenha sempre a pose final de cada fase; a Web Animations API só anima a chegada nela (transform
// e opacity), então "reduzir movimento" vê a mesma cena sem o caminho.
import { Hammer, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { GrupoPatrimonio, Patrimonio } from '../api'
import { inteiro, plural } from '../lib/formato'
import { alternarSom, somLigado } from '../urna/som'
import { COR, limitesCurtos, moedas, naCena, nomeFaixa, quartis } from './conta'
import { tocarPilhas, tocarQuebra } from './som'

export type Fase = 0 | 1 | 2

const FITAS = ['#5e881b', '#a2bd31', '#5d6b94', '#468baf', '#76acd0', '#f19929', '#fbc700']
const PLANTAS = {
  largo: { W: 940, H: 398, chao: 314, porco: { x: 50, s: 1, grande: 1.3 }, colunas: [404, 526, 634, 742, 850], largura: 104, sacola: [46, 70], alturaSacola: 50, topoPilha: 20 },
  estreito: { W: 358, H: 640, chao: 532, porco: { x: 63, s: 0.89, grande: 1.15 }, colunas: [33, 113, 177, 241, 305], largura: 64, sacola: [34, 48], alturaSacola: 38, topoPilha: 238 },
} as const
type Planta = (typeof PLANTAS)[keyof typeof PLANTAS]
const PORCO = { W: 260, H: 210, base: 198 } // caixa do desenho; a base é onde as patas tocam o chão

const consulta = '(max-width: 639px)'
const assinar = (f: () => void) => {
  const m = matchMedia(consulta)
  m.addEventListener('change', f)
  return () => m.removeEventListener('change', f)
}
const useEstreito = () => useSyncExternalStore(assinar, () => matchMedia(consulta).matches)
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const EASE = 'cubic-bezier(.16,1,.3,1)'

// Os seis cacos: polígonos que cobrem a caixa do desenho e se encontram no ponto do golpe, perto da fenda.
const GOLPE = [132, 78]
const CACOS = [
  '132,78 118,52 104,0 0,0 0,92 46,98 88,86',
  '132,78 118,52 104,0 260,0 260,40 196,58 160,70',
  '132,78 160,70 196,58 260,40 260,150 212,140 170,128',
  '132,78 170,128 212,140 260,150 260,210 150,210 152,160',
  '132,78 152,160 150,210 70,210 98,150',
  '132,78 98,150 70,210 0,210 0,92 46,98 88,86',
]
const RACHAS = ['118,52 104,0', '160,70 196,58 260,40', '170,128 212,140 260,150', '152,160 150,210', '98,150 70,210', '88,86 46,98 0,92']
// voo de cada caco: [meio do voo, pouso no chão] em px do desenho, com o giro em graus
const VOOS: [number, number, number][][] = [
  [[-70, -70, -30], [-46, 70, -24]],
  [[16, -110, 80], [66, 100, 172]],
  [[70, -60, 35], [58, 46, 26]],
  [[50, -6, 15], [40, 14, 10]],
  [[4, -16, -8], [-2, 8, -5]],
  [[-60, -20, -20], [-52, 20, -14]],
]
const pose = ([x, y, r]: [number, number, number], s: number) => `translate(${x * s}px, ${y * s}px) rotate(${r}deg)`

/** O porquinho de porcelana, virado para a direita. Os gradientes vêm do <defs> da cena. */
function Desenho({ p }: { p: string }) {
  return (
    <>
      {/* patas e orelha do lado de lá, atrás do corpo */}
      <rect x={58} y={150} width={24} height={46} rx={9} fill="#dfe4e8" stroke="#8e99a5" strokeWidth={1.5} />
      <rect x={150} y={150} width={24} height={46} rx={9} fill="#dfe4e8" stroke="#8e99a5" strokeWidth={1.5} />
      <path d="M180 62 Q186 26 208 34 Q204 56 194 72 Z" fill="#dfe4e8" stroke="#8e99a5" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M30 102 C14 96 8 114 19 118 C30 122 33 106 22 106" fill="none" stroke="#8e99a5" strokeWidth={3.6} strokeLinecap="round" />
      <ellipse cx={122} cy={112} rx={96} ry={68} fill={`url(#${p}-corpo)`} />
      <g clipPath={`url(#${p}-silhueta)`}>
        {FITAS.map((cor, i) => {
          const x = 128 + i * 3.2
          return <path key={cor} d={`M${x} 38 C${x - 12} 90 ${x - 12} 140 ${x} 186`} stroke={cor} strokeWidth={3.4} fill="none" />
        })}
        <ellipse cx={122} cy={166} rx={90} ry={22} fill="rgb(42 53 80 / .07)" />
      </g>
      <ellipse cx={122} cy={112} rx={96} ry={68} fill="none" stroke="#8e99a5" strokeWidth={1.6} />
      <ellipse cx={88} cy={76} rx={28} ry={10} transform="rotate(-18 88 76)" fill="#fff" opacity={0.85} />
      {/* patas do lado de cá */}
      <rect x={78} y={154} width={26} height={44} rx={10} fill={`url(#${p}-pata)`} stroke="#8e99a5" strokeWidth={1.5} />
      <rect x={170} y={154} width={26} height={44} rx={10} fill={`url(#${p}-pata)`} stroke="#8e99a5" strokeWidth={1.5} />
      {/* focinho, olho, bochecha e orelha */}
      <ellipse cx={225} cy={116} rx={15} ry={21} fill="#e9edf0" stroke="#8e99a5" strokeWidth={1.6} />
      <ellipse cx={229} cy={108} rx={2.6} ry={4} fill="#8e99a5" />
      <ellipse cx={229} cy={124} rx={2.6} ry={4} fill="#8e99a5" />
      <ellipse cx={196} cy={132} rx={11} ry={6.5} fill="#f19929" opacity={0.22} />
      <circle cx={193} cy={96} r={5.4} fill="#18202b" />
      <circle cx={194.8} cy={94.2} r={1.7} fill="#fff" />
      <path d="M160 60 Q158 22 184 26 Q188 50 180 70 Z" fill="#fcfdfd" stroke="#8e99a5" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M166 56 Q166 34 180 32 Q182 48 177 60 Z" fill="#e3e7eb" />
      {/* a fenda das moedas */}
      <rect x={100} y={46} width={48} height={8.5} rx={4.2} fill="#18202b" transform="rotate(-3 124 50)" />
    </>
  )
}

/** A sacola de pano com o cifrão; vazia (tracejada e murcha) para quem não registrou bens. */
function Sacola({ largura, altura, vazia }: { largura: number; altura: number; vazia: boolean }) {
  if (vazia)
    return (
      <svg width={largura} height={altura} viewBox="0 0 60 56" preserveAspectRatio="none" aria-hidden className="overflow-visible">
        <path d="M6 46 C6 34 16 30 30 30 C44 30 54 34 54 46 C54 54 44 56 30 56 C16 56 6 54 6 46 Z" fill="#f2f4f5" stroke="#87919d" strokeWidth={1.6} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        <path d="M22 31 C24 26 36 26 38 31" fill="none" stroke="#87919d" strokeWidth={1.6} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  return (
    <svg width={largura} height={altura} viewBox="0 0 60 56" preserveAspectRatio="none" aria-hidden className="overflow-visible">
      <path d="M19 15 C9 23 2 34 4 44 C6 54 17 56 30 56 C43 56 54 54 56 44 C58 34 51 23 41 15 Z" fill="#e9e4d8" stroke="#8e8676" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d="M19 15 L41 15 L46 5 C39 9 21 9 14 5 Z" fill="#e2dccd" stroke="#8e8676" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <rect x={17} y={12.5} width={26} height={5} rx={2.5} fill="#4b5566" />
      <path d="M12 30 C14 26 18 23 22 21" fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <text x={30} y={45} textAnchor="middle" fontSize={15} fontWeight={800} fill="#7d7566" style={{ fontStretch: '80%' }}>R$</text>
    </svg>
  )
}

interface Coluna {
  g: GrupoPatrimonio
  x: number
  nome: string
  limites: string
  sacolaL: number
  moedaL: number
  n: number
}

function colunasDe(dados: Patrimonio, p: Planta, estreito: boolean): Coluna[] {
  const grupos = naCena(dados)
  const qs = quartis(grupos)
  const sem = grupos.find((g) => g.tipo === 'sem_bens')
  const xs = p.colunas.slice(p.colunas.length - qs.length)
  const [min, max] = p.sacola
  const cols: Coluna[] = qs.map((g, i) => {
    const nome = nomeFaixa(g, i, qs.length)
    const l = qs.length > 1 ? min + ((max - min) * i) / (qs.length - 1) : max
    return { g, x: xs[i], nome: estreito ? nome.curto : nome.nome, limites: limitesCurtos(g, i, qs.length), sacolaL: l, moedaL: l * 0.62, n: moedas(g.taxa) }
  })
  if (sem) {
    const nome = nomeFaixa(sem, 0, 1)
    cols.unshift({ g: sem, x: p.colunas[0], nome: estreito ? nome.curto : nome.nome, limites: estreito ? 'nenhum bem' : 'nenhum bem na declaração', sacolaL: min, moedaL: min * 0.62, n: moedas(sem.taxa) })
  }
  return cols
}

export function Cofrinho({ dados, rotulo, fase, aoMudarFase }: {
  dados: Patrimonio
  /** "candidatos a vereador em 2024 nos 6 estados" */
  rotulo: string
  fase: Fase
  aoMudarFase: (f: Fase) => void
}) {
  const id = useId().replace(/:/g, '')
  const estreito = useEstreito()
  const p: Planta = estreito ? PLANTAS.estreito : PLANTAS.largo
  const caixa = useRef<HTMLDivElement>(null)
  const cena = useRef<HTMLDivElement>(null)
  const anterior = useRef<{ fase: Fase; dados: Patrimonio }>({ fase, dados })
  const [largura, setLargura] = useState(0)

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const escala = largura ? Math.min(1, largura / p.W) : 1

  const cols = colunasDe(dados, p, estreito)
  const s = p.porco.s
  const porcoY = (estreito ? 214 : p.chao) - PORCO.base * s
  const golpe = { x: p.porco.x + GOLPE[0] * s, y: porcoY + GOLPE[1] * s }
  // a altura de cada moeda empilhada: a maior pilha cabe entre a sacola e o topo da área das pilhas
  const maiorPilha = Math.max(1, ...cols.map((c) => c.n))
  const baseMoedas = p.chao - p.alturaSacola + 6
  const passo = Math.min(6.5, (baseMoedas - p.topoPilha - 46) / maiorPilha)
  const media = dados.resumo.candidatos ? (100 * dados.resumo.eleitos) / dados.resumo.candidatos : 0
  const qsCols = cols.filter((c) => c.g.tipo !== 'sem_bens')

  // anima só a chegada na fase nova (ou a troca de recorte com as pilhas à vista)
  useLayoutEffect(() => {
    const antes = anterior.current
    anterior.current = { fase, dados }
    const el = cena.current
    if (!el || reduzido()) return
    const todos = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel))
    const animacoes: Animation[] = []
    const anima = (alvo: Element, quadros: Keyframe[], opcoes: KeyframeAnimationOptions) => animacoes.push(alvo.animate(quadros, { fill: 'backwards', ...opcoes }))

    if (antes.fase === 0 && fase >= 1) {
      tocarQuebra()
      const porco = el.querySelector('[data-porco]')
      const g = `scale(${p.porco.grande})`
      if (porco) anima(porco, [{ transform: g }, { transform: `${g} rotate(-5deg)` }, { transform: `${g} rotate(5deg) translateY(-3px)` }, { transform: `${g} rotate(-4deg)` }, { transform: 'scale(1.06) rotate(3deg)' }, { transform: 'none' }], { duration: 420, easing: 'ease-in-out' })
      todos('[data-racha]').forEach((r) => {
        const path = r as unknown as SVGPathElement
        const L = path.getTotalLength?.() ?? 200
        anima(r, [{ strokeDasharray: `${L}`, strokeDashoffset: `${L}`, opacity: 1 }, { strokeDasharray: `${L}`, strokeDashoffset: '0', opacity: 1 }, { strokeDasharray: `${L}`, strokeDashoffset: '0', opacity: 0 }], { duration: 520, delay: 300, easing: 'ease-out', fill: 'both' })
      })
      todos('[data-caco]').forEach((c) => {
        const i = Number(c.dataset.caco)
        const [meio, fim] = VOOS[i]
        anima(c, [{ transform: 'none' }, { transform: 'none', offset: 0.05 }, { transform: pose(meio, s), offset: 0.42, easing: 'cubic-bezier(.3,0,.8,.6)' }, { transform: pose(fim, s) }], { duration: 1100, delay: 520, easing: 'cubic-bezier(.2,.7,.3,1)' })
      })
      todos('[data-moeda-voo]').forEach((m, k) => {
        const x = Number(m.dataset.x) - golpe.x
        const y = Number(m.dataset.y) - golpe.y
        const alto = Math.min(y, 0) - 90 - (k % 4) * 14
        animacoes.push(m.animate(
          [
            { transform: 'translate(0,0) scale(.4)', opacity: 0 },
            { transform: `translate(${x * 0.45}px, ${alto}px) scale(1) rotateY(360deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${x}px, ${y}px) scale(.7) rotateY(900deg)`, opacity: 1, offset: 0.92 },
            { transform: `translate(${x}px, ${y + 8}px) scale(.5) rotateY(900deg)`, opacity: 0 },
          ],
          { duration: 820, delay: 640 + k * 34, easing: 'cubic-bezier(.33,0,.4,1)', fill: 'both' },
        ))
      })
      todos('[data-sacola]').forEach((sac, i) => anima(sac, [{ transform: 'scale(.3, 0)', opacity: 0 }, { transform: 'scale(1.08, .92)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 900 + i * 110, easing: EASE }))
      todos('[data-legenda]').forEach((l, i) => anima(l, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 1200 + i * 90, easing: EASE }))
    }
    const pilhasNovas = fase === 2 && (antes.fase < 2 || antes.dados !== dados)
    if (pilhasNovas) {
      const atraso = antes.fase === 0 ? 1700 : 0
      tocarPilhas(cols.length)
      todos('[data-pilha]').forEach((pilha, c) => {
        Array.from(pilha.children).forEach((m, j) => anima(m, [{ transform: 'translateY(-34px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: atraso + c * 120 + j * 18, easing: EASE }))
      })
      const fim = atraso + cols.length * 120 + maiorPilha * 18
      todos('[data-taxa]').forEach((t, c) => anima(t, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: Math.min(fim, atraso + c * 120 + 400), easing: EASE }))
      todos('[data-media]').forEach((m) => anima(m, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: fim, easing: 'ease' }))
    }
    return () => animacoes.forEach((a) => a.finish())
    // as poses dependem só da fase e do recorte; a planta muda junto com a tela
  }, [fase, dados, estreito]) // eslint-disable-line react-hooks/exhaustive-deps

  const quebrar = () => aoMudarFase(1)

  // moedas que voam do golpe até a boca de cada sacola (nenhuma para a sacola vazia)
  const voos = qsCols.flatMap((c) => Array.from({ length: estreito ? 4 : 6 }, (_, k) => ({ x: c.x + (k % 3 - 1) * 6, y: p.chao - p.alturaSacola + 10, k: `${c.g.id}-${k}` })))
  const ordemVoo = voos.toSorted((a, b) => (a.k.slice(-1) + a.x).localeCompare(b.k.slice(-1) + b.x))

  return (
    <div ref={caixa} className="relative w-full" style={{ height: p.H * escala }}>
      <div
        ref={cena}
        className="absolute left-0 top-0 origin-top-left select-none"
        style={{ width: p.W, height: p.H, transform: escala < 1 ? `scale(${escala})` : undefined, left: escala < 1 ? 0 : Math.max(0, (largura - p.W) / 2) }}
      >
        <svg width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <radialGradient id={`${id}-corpo`} cx="38%" cy="32%" r="78%">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".55" stopColor="#f1f3f5" />
              <stop offset="1" stopColor="#cfd6dc" />
            </radialGradient>
            <linearGradient id={`${id}-pata`} x1="0" x2="1">
              <stop offset="0" stopColor="#fcfdfd" />
              <stop offset="1" stopColor="#dde2e7" />
            </linearGradient>
            <clipPath id={`${id}-silhueta`}><ellipse cx={122} cy={112} rx={96} ry={68} /></clipPath>
            {CACOS.map((c, i) => <clipPath key={c} id={`${id}-caco-${i}`}><polygon points={c} /></clipPath>)}
          </defs>
        </svg>

        {/* chão */}
        <div aria-hidden className="absolute left-0 right-0 h-px bg-linha-2" style={{ top: p.chao }} />
        {estreito && <div aria-hidden className="absolute h-px bg-linha-2" style={{ top: 214, left: 40, right: 40 }} />}

        {/* o porquinho: inteiro é um botão; quebrado, seis cacos no chão */}
        <div data-porco className="absolute" style={{ left: p.porco.x, top: porcoY, width: PORCO.W * s, height: PORCO.H * s, transformOrigin: '50% 95%', transform: fase === 0 ? `scale(${p.porco.grande})` : undefined }}>
          <svg aria-hidden className="absolute" width={PORCO.W * s} height={18 * s} viewBox="0 0 260 18" style={{ top: (PORCO.base - 9) * s }}>
            <ellipse cx={128} cy={9} rx={fase ? 116 : 96} ry={fase ? 7 : 8} fill="rgb(42 53 80 / .14)" />
          </svg>
          {CACOS.map((_, i) => (
            <svg
              key={i}
              data-caco={i}
              aria-hidden
              className="absolute left-0 top-0 overflow-visible"
              width={PORCO.W * s}
              height={PORCO.H * s}
              viewBox={`0 0 ${PORCO.W} ${PORCO.H}`}
              style={{ transform: fase ? pose(VOOS[i][1], s) : undefined, transformOrigin: `${GOLPE[0] * s}px ${GOLPE[1] * s}px` }}
            >
              <g clipPath={`url(#${id}-caco-${i})`}><Desenho p={id} /></g>
              {fase > 0 && <polygon points={CACOS[i]} fill="none" stroke="#aeb6bf" strokeWidth={1.2} clipPath={`url(#${id}-silhueta)`} />}
            </svg>
          ))}
          {fase > 0 && (
            <svg aria-hidden className="pointer-events-none absolute left-0 top-0" width={PORCO.W * s} height={PORCO.H * s} viewBox={`0 0 ${PORCO.W} ${PORCO.H}`} style={{ opacity: 0 }}>
              <g clipPath={`url(#${id}-silhueta)`}>
                {RACHAS.map((r) => <path key={r} data-racha d={`M${GOLPE.join(' ')} L${r.replace(/ /g, ' L')}`} fill="none" stroke="#18202b" strokeWidth={2.2} strokeLinejoin="round" />)}
              </g>
            </svg>
          )}
          {fase === 0 && (
            <button
              type="button"
              onClick={quebrar}
              aria-label={`Quebrar o cofrinho e separar os ${inteiro(dados.resumo.candidatos)} ${rotulo} pelos bens que declararam`}
              className="porquinho-alvo absolute inset-0 rounded-[40%] focus-visible:outline-offset-4"
            />
          )}
        </div>

        {/* antes de quebrar: o que tem dentro e o convite */}
        {fase === 0 && (
          <div
            className="revela absolute"
            style={estreito ? { left: 8, right: 8, top: 236 } : { left: 450, right: 0, top: 40 }}
          >
            <p className="t-numero tabular text-[clamp(2.8rem,2rem+2vw,4rem)] text-tinta">{inteiro(dados.resumo.candidatos)}</p>
            <p className="mt-1 max-w-[30ch] text-[1.08rem] font-semibold leading-snug text-tinta">{rotulo} estão aqui dentro, misturados.</p>
            <p className="mt-3 max-w-[44ch] text-[0.98rem] leading-relaxed text-tinta-2">
              Quebre o cofrinho para separá-los pelo patrimônio que cada um declarou ao TSE e ver se quem tem mais bens se elege mais.
            </p>
            <button type="button" onClick={quebrar} className="botao-vivo mt-6 h-12 px-6 text-[1rem]">
              <Hammer size={20} weight="fill" aria-hidden /> Quebrar o cofrinho
            </button>
            <p className="mt-2.5 text-[0.82rem] text-tinta-3">ou clique no porquinho</p>
          </div>
        )}

        {/* moedas em voo: só existem durante a quebra */}
        {fase > 0 && ordemVoo.map((v) => (
          <span
            key={v.k}
            data-moeda-voo
            data-x={v.x}
            data-y={v.y}
            aria-hidden
            className="moeda-voo pointer-events-none absolute"
            style={{ left: golpe.x - 9, top: golpe.y - 9, opacity: 0 }}
          />
        ))}

        {fase > 0 && (
          <>
            {/* a divisória entre quem não registrou bens e as faixas */}
            {cols[0]?.g.tipo === 'sem_bens' && (
              <div aria-hidden className="absolute w-px border-l border-dashed border-linha-2" style={{ left: (cols[0].x + (cols[1]?.x ?? cols[0].x + 80)) / 2, top: p.topoPilha + 8, height: p.chao - p.topoPilha - 8 }} />
            )}
            {cols.map((c) => {
              const vazia = c.g.tipo === 'sem_bens'
              const alturaPilha = c.n * passo
              return (
                <div key={c.g.id}>
                  <div data-sacola className="absolute" style={{ left: c.x - c.sacolaL / 2, top: p.chao - p.alturaSacola, transformOrigin: '50% 100%' }}>
                    <Sacola largura={c.sacolaL} altura={p.alturaSacola} vazia={vazia} />
                  </div>
                  {fase === 2 && (
                    <>
                      <div data-pilha aria-hidden className="absolute" style={{ left: c.x - c.moedaL / 2, top: 0 }}>
                        {Array.from({ length: c.n }, (_, j) => (
                          <span
                            key={j}
                            className={`moeda-pilha absolute ${vazia ? 'moeda-tracejada' : ''}`}
                            style={{ width: c.moedaL, height: c.moedaL * 0.34, top: baseMoedas - c.moedaL * 0.34 - j * passo, left: ((j * 7) % 5) - 2 }}
                          />
                        ))}
                      </div>
                      <div data-taxa className="absolute text-center" style={{ left: c.x - 60, width: 120, top: baseMoedas - alturaPilha - c.moedaL * 0.34 - (estreito ? 34 : 50) }}>
                        <span className="t-numero tabular relative z-[2] inline-block rounded bg-papel/90 px-1" style={{ color: vazia ? '#4b5566' : COR.texto, fontSize: estreito ? '1.35rem' : '2rem' }}>
                          {c.g.taxa.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                        </span>
                        {!estreito && <span className="tabular relative z-[2] mx-auto block w-fit rounded bg-papel/90 px-1 text-[0.72rem] text-tinta-3">{plural(c.g.eleitos, 'eleito', 'eleitos')}</span>}
                      </div>
                    </>
                  )}
                  <div
                    data-legenda
                    className="absolute text-center"
                    style={{ left: c.x - p.largura / 2, width: p.largura, top: p.chao + 10 }}
                  >
                    <span className={`block font-bold leading-tight text-tinta ${estreito ? 'text-[0.72rem]' : 'text-[0.82rem]'}`}>{c.nome}</span>
                    <span className={`tabular block leading-tight text-tinta-2 ${estreito ? 'mt-0.5 text-[0.66rem]' : 'mt-1 text-[0.76rem]'}`}>{c.limites}</span>
                    <span className={`tabular block leading-tight text-tinta-3 ${estreito ? 'mt-0.5 text-[0.64rem]' : 'mt-0.5 text-[0.72rem]'}`}>
                      {estreito ? inteiro(c.g.candidatos) : plural(c.g.candidatos, 'candidato', 'candidatos')}
                    </span>
                  </div>
                </div>
              )
            })}
            {fase === 2 && qsCols.length > 0 && (
              <div data-media aria-hidden className="absolute" style={{ left: qsCols[0].x - p.largura / 2 + 4, width: qsCols.at(-1)!.x - qsCols[0].x + p.largura - 8, top: baseMoedas - Math.round(media) * passo - 2 }}>
                <div className="border-t-[1.5px] border-dashed border-tinta/70" />
                <span className="absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap text-[0.7rem] font-semibold leading-tight text-tinta-2">média<br />{media.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}

/** Liga e desliga o som (a mesma preferência da urna). */
export function BotaoSom() {
  const [som, setSom] = useState(somLigado)
  return (
    <button
      type="button"
      onClick={() => setSom(alternarSom())}
      aria-pressed={som}
      aria-label={som ? 'Desligar o som' : 'Ligar o som'}
      title={som ? 'Desligar o som' : 'Ligar o som'}
      className="grid size-10 place-items-center rounded-full border border-linha bg-folha text-tinta-2 hover:border-linha-2 hover:text-tinta"
    >
      {som ? <SpeakerHigh size={18} weight="bold" aria-hidden /> : <SpeakerSlash size={18} weight="bold" aria-hidden />}
    </button>
  )
}

/** Os três passos da cena, clicáveis: a pessoa sempre sabe onde está e pode voltar ou pular. */
export function Passos({ fase, aoMudar }: { fase: Fase; aoMudar: (f: Fase) => void }) {
  const passos: { f: Fase; nome: string; curto: string }[] = [
    { f: 0, nome: 'O cofrinho', curto: 'Cofrinho' },
    { f: 1, nome: 'Separar pelos bens', curto: 'Separar' },
    { f: 2, nome: 'Ver quem se elegeu', curto: 'Eleitos' },
  ]
  return (
    <ol className="flex items-center gap-x-1" aria-label="Passos do cofrinho">
      {passos.map(({ f, nome, curto }, i) => {
        const atual = f === fase
        const feito = f < fase
        return (
          <li key={f} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className={`h-px w-3 sm:mx-1 sm:w-5 ${feito || atual ? 'bg-selecao' : 'bg-linha-2'}`} />}
            <button
              type="button"
              onClick={() => aoMudar(f)}
              aria-current={atual ? 'step' : undefined}
              aria-label={nome}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full pl-1.5 pr-2.5 sm:gap-2 sm:pr-3 text-[0.84rem] font-semibold transition-colors ${
                atual ? 'bg-selecao-claro text-selecao-tinta' : 'text-tinta-2 hover:bg-papel-2 hover:text-tinta'
              }`}
            >
              <span
                aria-hidden
                className={`grid size-6 place-items-center rounded-full text-[0.74rem] font-bold tabular ${
                  atual ? 'bg-selecao text-white' : feito ? 'bg-selecao-claro text-selecao-tinta ring-1 ring-selecao/40' : 'bg-folha text-tinta-3 ring-1 ring-linha-2'
                }`}
              >
                {i + 1}
              </span>
              <span className="sm:hidden">{curto}</span>
              <span className="max-sm:hidden">{nome}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
