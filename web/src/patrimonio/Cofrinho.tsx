// O cofrinho da P2, em quatro passos. (0) Todos os candidatos estão dentro de um porquinho de porcelana com a
// faixa das sete fitas; três marteladas (ou o botão) o racham e quebram em seis cacos. (1) As moedas voam e
// viram a fila: 100 barrinhas, cada uma 1 em cada 100 candidatos que declararam bens, do menor valor ao maior
// (altura em escala que cresce de 10 em 10 vezes). (2) A tesoura corta a fila em quatro grupos do mesmo
// tamanho, com o valor de cada corte, e a pessoa dá o palpite de qual grupo elegeu mais. (3) Cada grupo vira
// 100 bonequinhos (ou as pessoas de verdade, quando são menos de 30) e os eleitos acendem; o número conta e o
// carimbo "2,3x a chance" bate no grupo de mais bens. O React desenha sempre a pose final; a Web Animations API
// e o `animate` do motion só animam a chegada (transform, opacity e clip-path), então "reduzir movimento" vê a
// mesma cena sem o caminho.
import { Hammer, Scissors, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { animate } from 'motion'
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { GrupoPatrimonio, Patrimonio } from '../api'
import { inteiro } from '../lib/formato'
import { alternarSom, somLigado } from '../urna/som'
import { COR, limitesCurtos, moedas, nomeFaixa, POUCOS, quartis, reaisFaixa, taxaCurta } from './conta'
import { tocarCarimbo, tocarCorte, tocarGolpe, tocarPilhas, tocarQuebra } from './som'

export type Fase = 0 | 1 | 2 | 3

const FITAS = ['#5e881b', '#a2bd31', '#5d6b94', '#468baf', '#76acd0', '#f19929', '#fbc700']
// base: a linha de chão da fila; pitch: o passo de cada barrinha; vao: o espaço entre os grupos cortados
const PLANTAS = {
  largo: { W: 940, H: 440, chao: 314, porco: { x: 46, s: 1, grande: 1.3 }, fila: { x: 334, w: 606 }, base: 300, pitch: 5.4, vao: 22, alto: 150, slot: 150, texto: 450 },
  estreito: { W: 358, H: 950, chao: 214, porco: { x: 63, s: 0.89, grande: 1.15 }, fila: { x: 4, w: 350 }, base: 550, pitch: 3.5, vao: 0, alto: 150, slot: 176, texto: 8 },
} as const
type Planta = (typeof PLANTAS)[keyof typeof PLANTAS]
const PORCO = { W: 260, H: 210, base: 198 }
const CELULA = 14 // cada bonequinho na grade de 10 por 10

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
const RACHAS = ['118,52 104,0', '170,128 212,140 260,150', '88,86 46,98 0,92', '160,70 196,58 260,40', '152,160 150,210', '98,150 70,210']
const GOLPES = 3 // marteladas até quebrar; cada uma mostra mais duas rachaduras
const VOOS: [number, number, number][][] = [
  [[-70, -70, -30], [-46, 70, -24]],
  [[16, -110, 80], [66, 100, 172]],
  [[70, -60, 35], [58, 46, 26]],
  [[50, -6, 15], [40, 14, 10]],
  [[4, -16, -8], [-2, 8, -5]],
  [[-60, -20, -20], [-40, 18, -12]],
]
const pose = ([x, y, r]: [number, number, number], s: number) => `translate(${x * s}px, ${y * s}px) rotate(${r}deg)`

const Desenho = memo(function Desenho({ p }: { p: string }) {
  return (
    <>
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
      <rect x={78} y={154} width={26} height={44} rx={10} fill={`url(#${p}-pata)`} stroke="#8e99a5" strokeWidth={1.5} />
      <rect x={170} y={154} width={26} height={44} rx={10} fill={`url(#${p}-pata)`} stroke="#8e99a5" strokeWidth={1.5} />
      <ellipse cx={225} cy={116} rx={15} ry={21} fill="#e9edf0" stroke="#8e99a5" strokeWidth={1.6} />
      <ellipse cx={229} cy={108} rx={2.6} ry={4} fill="#8e99a5" />
      <ellipse cx={229} cy={124} rx={2.6} ry={4} fill="#8e99a5" />
      <ellipse cx={196} cy={132} rx={11} ry={6.5} fill="#f19929" opacity={0.22} />
      {/* o olho pisca uma vez quando o mouse chega (classe .porco-olho) */}
      <g className="porco-olho">
        <circle cx={193} cy={96} r={5.4} fill="#18202b" />
        <circle cx={194.8} cy={94.2} r={1.7} fill="#fff" />
      </g>
      <path d="M160 60 Q158 22 184 26 Q188 50 180 70 Z" fill="#fcfdfd" stroke="#8e99a5" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M166 56 Q166 34 180 32 Q182 48 177 60 Z" fill="#e3e7eb" />
      <rect x={100} y={46} width={48} height={8.5} rx={4.2} fill="#18202b" transform="rotate(-3 124 50)" />
    </>
  )
})

/** As barrinhas de um grupo da fila; só mudam com o recorte. */
const Barras = memo(function Barras({ hs, inicio, n, pitch }: { hs: number[]; inicio: number; n: number; pitch: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, j) => (
        <span key={j} className="barrinha absolute bottom-0" style={{ left: j * pitch, width: pitch * 0.72, height: hs[inicio + j] ?? 8 }} />
      ))}
    </>
  )
})

/** Os bonequinhos de um grupo: os que não se elegeram são uma camada só (máscara repetida), e só os eleitos
 * são elementos, preenchendo de baixo para cima (flex com wrap-reverse), para acenderem um a um. */
const Grade = memo(function Grade({ pessoas, acesos, ordem }: { pessoas: number; acesos: number; ordem: number }) {
  const linhas = Math.max(1, Math.ceil(pessoas / 10))
  const resto = pessoas % 10
  return (
    <div className="relative" style={{ width: CELULA * 10, height: linhas * CELULA }}>
      {/* o fundo: linhas cheias numa camada, e a última, incompleta, no topo */}
      <div className="bonecos-fundo absolute bottom-0 left-0" style={{ width: CELULA * 10, height: Math.floor(pessoas / 10) * CELULA }} />
      {resto > 0 && <div className="bonecos-fundo absolute left-0 top-0" style={{ width: resto * CELULA, height: CELULA }} />}
      <div className="absolute inset-0 flex flex-wrap-reverse content-start">
        {Array.from({ length: acesos }, (_, k) => (
          <span key={k} className="boneco-eleito" style={{ ['--d' as string]: `${350 + ordem * 140 + k * 14}ms` }} />
        ))}
      </div>
    </div>
  )
})

/** Barrinhas por grupo, repartidas pelo maior resto (com quatro grupos iguais, 25 cada). */
function repartir(qs: GrupoPatrimonio[]): number[] {
  const total = qs.reduce((s, g) => s + g.candidatos, 0) || 1
  const exato = qs.map((g) => (100 * g.candidatos) / total)
  const n = exato.map(Math.floor)
  const sobra = 100 - n.reduce((a, b) => a + b, 0)
  exato.map((e, i) => [e - n[i], i]).sort((a, b) => b[0] - a[0]).slice(0, sobra).forEach(([, i]) => n[i]++)
  return n
}

interface Grupo {
  g: GrupoPatrimonio
  i: number
  nome: string
  limites: string
  n: number // barrinhas na fila
  inicio: number // posição da primeira barrinha na fila
  pessoas: number // bonequinhos: 100, ou as pessoas de verdade quando são poucas
  acesos: number
}

function gruposDe(dados: Patrimonio, estreito: boolean): Grupo[] {
  const qs = quartis(dados.grupos)
  const ns = repartir(qs)
  let inicio = 0
  return qs.map((g, i) => {
    const nome = nomeFaixa(g, i, qs.length)
    const poucos = g.candidatos < POUCOS
    const item = {
      g, i, nome: estreito ? nome.curto : nome.nome, limites: limitesCurtos(g, i, qs.length), n: ns[i], inicio,
      pessoas: poucos ? g.candidatos : 100, acesos: poucos ? g.eleitos : moedas(g.taxa),
    }
    inicio += ns[i]
    return item
  })
}

/** Onde fica cada grupo: centro e linha de chão, na fila inteira ou cortada. */
function lugar(p: Planta, gr: Grupo, total: number, cortada: boolean, estreito: boolean) {
  const largura = 100 * p.pitch
  const x0 = p.fila.x + (p.fila.w - largura) / 2
  const centroFila = x0 + (gr.inicio + gr.n / 2) * p.pitch
  if (!cortada) return { x: centroFila, base: p.base }
  if (estreito) {
    const col = gr.i % 2
    const lin = Math.floor(gr.i / 2)
    return { x: col ? 269 : 89, base: p.base + lin * 322 }
  }
  return { x: centroFila + (gr.i - (total - 1) / 2) * p.vao, base: p.base }
}

/** Altura de cada barrinha: escala que cresce de 10 em 10 vezes, do menor ao maior valor da fila. */
function alturas(fila: number[], alto: number) {
  if (!fila.length) return []
  const lo = Math.log10(Math.max(1, fila[0]))
  const hi = Math.log10(Math.max(10, fila[fila.length - 1]))
  return fila.map((v) => 6 + ((alto - 6) * (Math.log10(Math.max(1, v)) - lo)) / Math.max(0.5, hi - lo))
}

export function Cofrinho({ dados, rotulo, fase, aoMudarFase, palpite, aoPalpitar, voce }: {
  dados: Patrimonio
  rotulo: string
  fase: Fase
  aoMudarFase: (f: Fase) => void
  palpite: string | null
  aoPalpitar: (id: string) => void
  /** o grupo em que a pessoa cairia ("E você?"), se ela escolheu um valor */
  voce: string | null
}) {
  const id = useId().replace(/:/g, '')
  const estreito = useEstreito()
  const p: Planta = estreito ? PLANTAS.estreito : PLANTAS.largo
  const caixa = useRef<HTMLDivElement>(null)
  const cena = useRef<HTMLDivElement>(null)
  const anterior = useRef<{ fase: Fase; dados: Patrimonio }>({ fase, dados })
  const [largura, setLargura] = useState(0)
  const [golpes, setGolpes] = useState(0)
  const [cortando, setCortando] = useState(false)
  // do passo 1 para o 2 (botão da página ou número do passo), a tesoura corta antes de os grupos se afastarem
  const [faseVista, setFaseVista] = useState(fase)
  if (faseVista !== fase) {
    setFaseVista(fase)
    setCortando(faseVista === 1 && fase === 2 && !reduzido())
  }

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // voltar ao cofrinho inteiro zera as marteladas
  useEffect(() => {
    if (fase === 0) setGolpes(0) // eslint-disable-line react-hooks/set-state-in-effect
  }, [fase])
  const escala = largura ? Math.min(1, largura / p.W) : 1

  const grupos = gruposDe(dados, estreito)
  // as alturas só mudam com a fila: o memo mantém a mesma lista e as barrinhas (memo) não se redesenham
  const hs = useMemo(() => alturas(dados.fila, p.alto), [dados.fila, p.alto])
  const s = p.porco.s
  const porcoY = p.chao - PORCO.base * s
  const golpe = { x: p.porco.x + GOLPE[0] * s, y: porcoY + GOLPE[1] * s }
  const cortada = fase >= 2 && !cortando
  const ultimo = grupos.at(-1)
  const primeiro = grupos[0]
  const sobe = !!(primeiro && ultimo && ultimo.g.taxa > primeiro.g.taxa && primeiro.g.taxa > 0 && grupos.length > 1)
  const media = dados.resumo.candidatos ? (100 * dados.resumo.eleitos) / dados.resumo.candidatos : 0

  // a chegada de cada passo
  useLayoutEffect(() => {
    const antes = anterior.current
    anterior.current = { fase, dados }
    const el = cena.current
    if (!el || reduzido()) return
    const todos = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel))
    const animacoes: Animation[] = []
    const anima = (alvo: Element, quadros: Keyframe[], opcoes: KeyframeAnimationOptions) => animacoes.push(alvo.animate(quadros, { fill: 'backwards', ...opcoes }))
    const paradas: (() => void)[] = []

    if (antes.fase === 0 && fase >= 1) {
      tocarQuebra()
      const porco = el.querySelector('[data-porco]')
      const g = `scale(${p.porco.grande})`
      if (porco) anima(porco, [{ transform: g }, { transform: `${g} rotate(-8deg)` }, { transform: `${g} rotate(7deg) translateY(-4px)` }, { transform: `${g} rotate(-5deg)` }, { transform: 'scale(1.08) rotate(4deg)' }, { transform: 'scale(1.02) rotate(-2deg)' }, { transform: 'none' }], { duration: 450, easing: 'ease-out' })
      todos('[data-racha]').forEach((r) => {
        anima(r, [{ strokeDashoffset: '1', opacity: 1 }, { strokeDashoffset: '0', opacity: 1 }, { strokeDashoffset: '0', opacity: 0 }], { duration: 480, delay: 300, easing: 'ease-out', fill: 'both' })
      })
      todos('[data-caco]').forEach((c) => {
        const [meio, fim] = VOOS[Number(c.dataset.caco)]
        anima(c, [{ transform: 'none' }, { transform: 'none', offset: 0.05 }, { transform: pose(meio, s), offset: 0.42, easing: 'cubic-bezier(.3,0,.8,.6)' }, { transform: pose(fim, s) }], { duration: 1100, delay: 480, easing: 'cubic-bezier(.2,.7,.3,1)' })
      })
      // as moedas saem do golpe e caem na fila; com a pancada, achatam e voltam (squash and stretch)
      todos('[data-moeda-voo]').forEach((m, k) => {
        const x = Number(m.dataset.x) - golpe.x
        const y = Number(m.dataset.y) - golpe.y
        const alto = Math.min(y, 0) - 110 - (k % 5) * 12
        animacoes.push(m.animate(
          [
            { transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 0 },
            { transform: `translate(${x * 0.45}px, ${alto}px) scale(1) rotate(260deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${x}px, ${y}px) scale(1.1, .7) rotate(540deg)`, opacity: 1, offset: 0.9 },
            { transform: `translate(${x}px, ${y}px) scale(.3) rotate(540deg)`, opacity: 0 },
          ],
          { duration: 860, delay: 600 + k * 28, easing: 'cubic-bezier(.33,0,.4,1)', fill: 'both' },
        ))
      })
      // a fila se ergue da esquerda para a direita: um recorte por grupo, não um por barrinha
      todos('[data-barras]').forEach((b, i) => anima(b, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 520, delay: 1350 + i * 200, easing: 'cubic-bezier(.65,0,.35,1)' }))
      todos('[data-legenda-fila]').forEach((l) => anima(l, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 2200, easing: EASE }))
    }

    // a tesoura: anda pela fila e corta nos três pontos; os grupos se afastam depois do último corte
    if (antes.fase === 1 && fase === 2) {
      const tesoura = el.querySelector<HTMLElement>('[data-tesoura]')
      const cortes = todos('[data-corte]')
      if (tesoura && cortes.length) {
        const total = 1700
        const xs = cortes.map((c) => Number(c.dataset.x))
        const passo = total / (xs.length + 1)
        const quadros: Keyframe[] = [{ transform: `translateX(${p.fila.x - 10}px)`, offset: 0 }]
        xs.forEach((x, i) => {
          quadros.push({ transform: `translateX(${x}px)`, offset: ((i + 1) * passo - 160) / total })
          quadros.push({ transform: `translateX(${x}px) rotate(-14deg)`, offset: ((i + 1) * passo - 60) / total })
          quadros.push({ transform: `translateX(${x}px)`, offset: ((i + 1) * passo) / total })
          const t = setTimeout(tocarCorte, (i + 1) * passo - 60)
          paradas.push(() => clearTimeout(t))
        })
        quadros.push({ transform: `translateX(${p.fila.x + p.fila.w + 20}px)`, opacity: 0, offset: 1 })
        anima(tesoura, quadros, { duration: total, easing: 'linear', fill: 'both' })
        cortes.forEach((c, i) => anima(c, [{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 220, delay: (i + 1) * passo - 60, easing: EASE, fill: 'both' }))
        const t = setTimeout(() => setCortando(false), total + 50)
        paradas.push(() => {
          clearTimeout(t)
          setCortando(false)
        })
      }
    }

    // o resultado: as grades surgem, os eleitos acendem (CSS, com atraso por índice), os números contam e o carimbo bate
    if (fase === 3 && (antes.fase < 3 || antes.dados !== dados)) {
      const atraso = antes.fase === 3 ? 0 : 150
      tocarPilhas(grupos.length)
      todos('[data-grade]').forEach((g, i) => anima(g, [{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: atraso + i * 140, easing: EASE }))
      todos('[data-conta]').forEach((n, i) => {
        const alvo = Number(n.dataset.conta)
        const casas = n.dataset.casas === '1'
        const fmt = (v: number) => (casas ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Math.round(v).toLocaleString('pt-BR'))
        const ctrl = animate(0, alvo, { duration: 1.1, delay: (atraso + 300 + i * 140) / 1000, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { n.textContent = fmt(v) } })
        paradas.push(() => { ctrl.stop(); n.textContent = fmt(alvo) })
      })
      const carimbo = el.querySelector('[data-carimbo]')
      if (carimbo) {
        const quando = atraso + 1500 + grupos.length * 140
        anima(carimbo, [{ opacity: 0, transform: 'scale(2.4) rotate(-22deg)' }, { opacity: 1, transform: 'scale(.92) rotate(-8deg)', offset: 0.7 }, { opacity: 1, transform: 'rotate(-8deg)' }], { duration: 380, delay: quando, easing: 'cubic-bezier(.5,0,.75,0)' })
        const t = setTimeout(tocarCarimbo, quando + 250)
        paradas.push(() => clearTimeout(t))
      }
    }
    return () => {
      animacoes.forEach((a) => a.finish())
      paradas.forEach((f) => f())
    }
  }, [fase, dados, estreito]) // eslint-disable-line react-hooks/exhaustive-deps

  const quebrar = () => aoMudarFase(1)
  const martelar = () => {
    const el = cena.current?.querySelector('[data-porco]')
    const proximo = golpes + 1
    if (proximo >= GOLPES) return quebrar()
    setGolpes(proximo)
    tocarGolpe(proximo)
    if (el && !reduzido()) {
      const g = `scale(${p.porco.grande})`
      el.animate([{ transform: g }, { transform: `${g} rotate(-6deg) translateY(2px)` }, { transform: `${g} rotate(5deg)` }, { transform: `${g} rotate(-3deg)` }, { transform: g }], { duration: 380, easing: 'ease-out' })
    }
  }

  // moedas da quebra: caem no topo de barrinhas espalhadas pela fila
  const largFila = 100 * p.pitch
  const x0 = p.fila.x + (p.fila.w - largFila) / 2
  const nVoos = estreito ? 16 : 26
  const voos = Array.from({ length: nVoos }, (_, k) => {
    const j = Math.min(99, Math.round((k + 0.5) * (100 / nVoos)))
    return { x: x0 + j * p.pitch, y: p.base - (hs[j] ?? 40) - 6, k }
  })

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

        <div aria-hidden className="absolute h-px bg-linha-2" style={{ top: p.chao, left: estreito ? 40 : 0, width: estreito ? p.W - 80 : 260 }} />

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
          {/* rachaduras: as das marteladas ficam; na quebra, todas se desenham e somem com os cacos */}
          {(fase > 0 || golpes > 0) && (
            <svg aria-hidden className="pointer-events-none absolute left-0 top-0" width={PORCO.W * s} height={PORCO.H * s} viewBox={`0 0 ${PORCO.W} ${PORCO.H}`} style={{ opacity: fase > 0 ? 0 : 1 }}>
              <g clipPath={`url(#${id}-silhueta)`}>
                {RACHAS.slice(0, fase > 0 ? RACHAS.length : golpes * 2).map((r) => (
                  <path
                    key={r}
                    data-racha={fase > 0 ? '' : undefined}
                    className={fase === 0 ? 'racha-nova' : undefined}
                    d={`M${GOLPE.join(' ')} L${r.replace(/ /g, ' L')}`}
                    fill="none"
                    stroke="#18202b"
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                    pathLength={1}
                    strokeDasharray={1}
                  />
                ))}
              </g>
            </svg>
          )}
          {fase === 0 && (
            <button
              type="button"
              onClick={martelar}
              aria-label={`Martelar o cofrinho (${golpes} de ${GOLPES} marteladas). Na terceira ele quebra e separa os ${inteiro(dados.resumo.candidatos)} ${rotulo}.`}
              className="porquinho-alvo absolute inset-0 rounded-[40%] focus-visible:outline-offset-4"
            />
          )}
        </div>

        {fase === 0 && (
          <div className="revela absolute" style={estreito ? { left: 8, right: 8, top: 236 } : { left: p.texto, right: 0, top: 40 }}>
            <p className="t-numero tabular text-[clamp(2.8rem,2rem+2vw,4rem)] text-tinta">{inteiro(dados.resumo.candidatos)}</p>
            <p className="mt-1 max-w-[30ch] text-[1.08rem] font-semibold leading-snug text-tinta">{rotulo} estão aqui dentro, misturados.</p>
            <p className="mt-3 max-w-[44ch] text-[0.98rem] leading-relaxed text-tinta-2">
              Bata três vezes no porquinho para quebrá-lo. Os candidatos vão sair em fila, do que declarou menos bens ao que declarou mais.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button type="button" onClick={quebrar} className="botao-vivo h-12 px-6 text-[1rem]">
                <Hammer size={20} weight="fill" aria-hidden /> Quebrar o cofrinho
              </button>
              <span className="flex items-center gap-1.5 text-[0.84rem] text-tinta-2" aria-live="polite">
                {Array.from({ length: GOLPES }, (_, i) => (
                  <Hammer key={i} size={18} weight={i < golpes ? 'fill' : 'regular'} aria-hidden className={i < golpes ? 'martelada text-tinta' : 'text-tinta-3'} />
                ))}
                <span className="ml-1">{golpes ? `${golpes} de ${GOLPES} marteladas` : 'ou clique no porquinho'}</span>
              </span>
            </div>
          </div>
        )}

        {fase > 0 && voos.map((v) => (
          <span key={v.k} data-moeda-voo data-x={v.x} data-y={v.y} aria-hidden className="moeda-voo pointer-events-none absolute" style={{ left: golpe.x - 9, top: golpe.y - 9, opacity: 0 }} />
        ))}

        {fase > 0 && (
          <>
            {/* a fila inteira: os valores das pontas e o que é cada barrinha */}
            {fase === 1 && hs.length > 0 && (
              <div data-legenda-fila aria-hidden>
                <span className="absolute text-[0.75rem] font-semibold text-tinta-2" style={{ left: x0, top: p.base + 8 }}>← {reaisFaixa(dados.fila[0])}</span>
                <span className="absolute text-right text-[0.75rem] font-semibold text-tinta-2" style={{ right: p.W - (x0 + largFila), top: p.base + 8 }}>{reaisFaixa(dados.fila[99])} →</span>
                <span className="absolute text-center text-[0.8rem] text-tinta-2" style={{ left: x0, width: largFila, top: p.base + 30 }}>
                  cada barrinha é 1 em cada 100 candidatos que declararam bens
                </span>
              </div>
            )}

            {/* os cortes da tesoura, nas emendas da fila inteira */}
            {cortando && grupos.slice(1).map((gr) => {
              const x = x0 + gr.inicio * p.pitch - p.pitch * 0.14
              return (
                <div key={gr.g.id} data-corte data-x={x} aria-hidden className="absolute origin-bottom" style={{ left: x, top: p.base - p.alto - 26, height: p.alto + 32 }}>
                  <div className="h-full border-l-2 border-dashed border-tinta" />
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-tinta px-2 py-0.5 text-[0.75rem] font-bold text-folha">{reaisFaixa(gr.g.de)}</span>
                </div>
              )
            })}
            {cortando && (
              <span data-tesoura aria-hidden className="absolute left-0 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-escolha text-tinta shadow-[var(--shadow-cartao)]" style={{ top: p.base - p.alto - 64 }}>
                <Scissors size={22} weight="fill" style={{ transform: 'rotate(90deg)' }} />
              </span>
            )}

            {grupos.map((gr) => {
              const pos = lugar(p, gr, grupos.length, cortada, estreito)
              const w = gr.n * p.pitch
              const escolhido = palpite === gr.g.id
              const meu = voce === gr.g.id && fase >= 2
              const grade = Math.min(100, gr.pessoas)
              const linhas = Math.max(1, Math.ceil(grade / 10))
              const poucos = gr.pessoas < 100
              return (
                <div key={gr.g.id}>
                  {/* as barrinhas do grupo: andam juntas (uma transformação por grupo) */}
                  <div className="grupo-fila absolute left-0 top-0" style={{ width: w, height: p.alto, transform: `translate(${pos.x - w / 2}px, ${pos.base - p.alto}px)` }}>
                    <div data-barras className="absolute inset-0 origin-bottom transition-transform duration-500" style={{ transform: fase === 3 ? 'scaleY(.28)' : undefined }}>
                      <Barras hs={hs} inicio={gr.inicio} n={gr.n} pitch={p.pitch} />
                    </div>
                  </div>

                  {fase === 2 && !cortando && (
                    <button
                      type="button"
                      onClick={() => aoPalpitar(gr.g.id)}
                      aria-label={`Palpite: ${nomeFaixa(gr.g, gr.i, grupos.length).nome} (${gr.limites}) elegeu mais`}
                      className={`palpite-alvo absolute rounded-2xl border-2 ${escolhido ? 'border-selecao bg-selecao-claro/60' : 'border-dashed border-linha-2 hover:border-acao hover:bg-acao-claro/40'}`}
                      style={{ left: pos.x - p.slot / 2 + 4, top: pos.base - p.alto - 12, width: p.slot - 8, height: p.alto + 22, ['--i' as string]: gr.i }}
                    />
                  )}

                  {fase === 3 && (
                    <>
                      <div className="absolute text-center" style={{ left: pos.x - 70, width: 140, top: pos.base - 50 - linhas * CELULA - 44 }}>
                        <span className="t-numero tabular inline-block text-[1.9rem]" style={{ color: COR.texto }}>
                          {poucos ? (
                            <><span data-conta={gr.acesos}>{inteiro(gr.acesos)}</span><span className="text-[1.1rem] text-tinta-2"> de {inteiro(gr.pessoas)}</span></>
                          ) : (
                            <><span data-conta={gr.g.taxa} data-casas="1">{gr.g.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>%</>
                          )}
                        </span>
                      </div>
                      <div data-grade aria-hidden className="absolute" style={{ left: pos.x - (CELULA * 10) / 2, top: pos.base - 50 - linhas * CELULA }}>
                        <Grade pessoas={grade} acesos={Math.min(gr.acesos, grade)} ordem={gr.i} />
                      </div>
                    </>
                  )}

                  {cortada && (
                    <div className="absolute text-center" style={{ left: pos.x - p.slot / 2, width: p.slot, top: pos.base + 8 }}>
                      <span className="block text-[0.82rem] font-bold leading-tight text-tinta">{gr.nome}</span>
                      <span className="tabular mt-0.5 block text-[0.76rem] leading-tight text-tinta-2">{gr.limites}</span>
                      <span className="tabular mt-0.5 block text-[0.75rem] leading-tight text-tinta-3">
                        {fase === 3 ? `${inteiro(gr.g.eleitos)} de ${inteiro(gr.g.candidatos)}` : `${inteiro(gr.g.candidatos)} candidatos`}
                      </span>
                      {(escolhido || meu) && (
                        <span className="mt-1 inline-flex flex-wrap justify-center gap-1">
                          {escolhido && <span className="rounded-full bg-selecao px-2 py-0.5 text-[0.75rem] font-bold text-white">seu palpite</span>}
                          {meu && <span className="voce-pino rounded-full bg-escolha px-2 py-0.5 text-[0.75rem] font-bold text-tinta">você aqui</span>}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {fase === 3 && grupos.length > 1 && !estreito && (
              <div aria-hidden className="absolute text-[0.75rem] font-semibold text-tinta-2" style={{ right: 0, top: 2 }}>
                média de todos: {taxaCurta(media)}
              </div>
            )}

            {/* o carimbo do veredito, no grupo de mais bens */}
            {fase === 3 && sobe && ultimo && primeiro && (() => {
              const pos = lugar(p, ultimo, grupos.length, true, estreito)
              const linhas = Math.ceil(Math.min(100, ultimo.pessoas) / 10)
              return (
                <div data-carimbo className="carimbo pointer-events-none absolute text-center" style={{ left: pos.x + (estreito ? -6 : 14), top: pos.base - 50 - linhas * CELULA + 14 }}>
                  <span className="t-numero block text-[1.6rem] leading-none">{(ultimo.g.taxa / primeiro.g.taxa).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×</span>
                  <span className="block whitespace-nowrap text-[0.66rem] font-bold uppercase tracking-[0.08em]">a chance</span>
                </div>
              )
            })()}
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
      aria-label={som ? 'Som ligado (desligar)' : 'Som desligado (ligar)'}
      className="inline-flex h-11 items-center gap-1.5 rounded-full border border-linha bg-folha px-3.5 text-[0.84rem] font-semibold text-tinta-2 hover:border-linha-2 hover:text-tinta"
    >
      {som ? <SpeakerHigh size={18} weight="bold" aria-hidden /> : <SpeakerSlash size={18} weight="bold" aria-hidden />}
      Som
    </button>
  )
}

/** Os quatro passos da cena, clicáveis: a pessoa sempre sabe onde está e pode voltar ou pular. */
export function Passos({ fase, aoMudar }: { fase: Fase; aoMudar: (f: Fase) => void }) {
  const passos: { f: Fase; nome: string; curto: string }[] = [
    { f: 0, nome: 'Quebrar', curto: 'Quebrar' },
    { f: 1, nome: 'A fila', curto: 'Fila' },
    { f: 2, nome: 'Seu palpite', curto: 'Palpite' },
    { f: 3, nome: 'Quem se elegeu', curto: 'Eleitos' },
  ]
  return (
    <ol className="flex items-center gap-x-0.5" aria-label="Passos do cofrinho">
      {passos.map(({ f, nome, curto }, i) => {
        const atual = f === fase
        const feito = f < fase
        return (
          <li key={f} className="flex items-center">
            {i > 0 && <span aria-hidden className={`h-0.5 w-2.5 rounded-full transition-colors duration-500 sm:w-5 ${feito || atual ? 'bg-selecao' : 'bg-linha-2'}`} />}
            <button
              type="button"
              onClick={() => aoMudar(f)}
              aria-current={atual ? 'step' : undefined}
              aria-label={nome}
              className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-1.5 text-[0.84rem] font-semibold transition-colors sm:gap-2 sm:pr-3 ${
                atual ? 'bg-selecao-claro pr-3 text-selecao-tinta' : 'text-tinta-2 hover:bg-papel-2 hover:text-tinta sm:pr-3'
              }`}
            >
              <span
                aria-hidden
                className={`grid size-7 place-items-center rounded-full text-[0.78rem] font-bold tabular transition-colors duration-300 ${
                  atual ? 'bg-selecao text-white' : feito ? 'bg-selecao-claro text-selecao-tinta ring-1 ring-selecao/40' : 'bg-folha text-tinta-3 ring-1 ring-linha-2'
                }`}
              >
                {i + 1}
              </span>
              <span className={atual ? 'sm:hidden' : 'hidden'}>{curto}</span>
              <span className="max-sm:hidden">{nome}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
