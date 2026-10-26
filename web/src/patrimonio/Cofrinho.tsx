// O cofrinho da P2, em quatro passos. (0) Todos os candidatos estão dentro de um porquinho rosa de porcelana;
// cada martelada racha a porcelana a partir do ponto do golpe (rachadura com galhos, de semente fixa), solta
// lascas e, na terceira, o porquinho se parte em cacos serrilhados que mostram o branco da porcelana. (1) As
// moedas voam e viram a fila: 100 barrinhas, cada uma 1 em cada 100 candidatos que declararam bens, do menor
// valor ao maior. (2) A tesoura corta a fila em quatro grupos do mesmo tamanho e a pessoa dá o palpite. (3) Cada
// grupo vira 100 bonequinhos e os eleitos acendem; o número conta e o carimbo bate no grupo de mais bens.
// O React desenha sempre a pose final; a Web Animations API e o `animate` do motion só animam a chegada
// (transform, opacity e clip-path), e os efeitos de cada golpe (lascas, martelo) são elementos criados e
// removidos fora do React, sem re-render. "Reduzir movimento" vê a mesma cena sem o caminho.
import { Hammer, Scissors, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { animate } from 'motion/react'
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { GrupoPatrimonio, Patrimonio } from '../api'
import { inteiro } from '../lib/formato'
import { alternarSom, somLigado } from '../urna/som'
import { COR, limitesCurtos, moedas, nomeFaixa, POUCOS, quartis, reaisFaixa, taxaCurta } from './conta'
import { cacos, Desenho, dentroDoCorpo, Gradientes, PORCO, Rachaduras, sorteio } from './porquinho'
import { baixarSons, tocarCarimbo, tocarCorte, tocarGolpe, tocarPilhas, tocarQuebra } from './som'

export type Fase = 0 | 1 | 2 | 3

// base: a linha de chão da fila; pitch: o passo de cada barrinha; vao: o espaço entre os grupos cortados
const PLANTAS = {
  largo: { W: 940, H: 440, alturas: [322, 300, 300, 440], subidas: [50, 90, 90, 0], chao: 314, porco: { x: 46, s: 1, grande: 1.3 }, fila: { x: 334, w: 606 }, base: 300, baseFila: 300, pitch: 5, vao: 26, alto: 170, slot: 150, texto: 450 },
  estreito: { W: 358, H: 950, alturas: [560, 430, 950, 950], subidas: [0, 100, 0, 0], chao: 214, porco: { x: 63, s: 0.89, grande: 1.15 }, fila: { x: 4, w: 350 }, base: 550, baseFila: 450, pitch: 3.5, vao: 0, alto: 150, slot: 176, texto: 8 },
} as const
type Planta = (typeof PLANTAS)[keyof typeof PLANTAS]
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

const GOLPES = 3 // marteladas até quebrar
// onde cai cada martelada dada pelo teclado (sem ponto de clique): costas, flanco e barriga
const GOLPES_TECLADO: [number, number][] = [[112, 70], [150, 112], [96, 132]]
const SEMENTE = 20261017

type Golpe = { x: number; y: number; semente: number }

/** Para onde cada caco voa (meio do voo) e onde assenta no chão, a partir da direção do golpe ao caco. */
function voosDosCacos(lista: { centro: [number, number] }[], gx: number, gy: number, s: number) {
  const r = sorteio(SEMENTE + 7)
  return lista.map(({ centro: [cx, cy] }) => {
    const dx = cx - gx
    const dy = cy - gy
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d
    const giro = (r() - 0.5) * 70
    const queda = Math.max(4, (PORCO.base - 10 - cy) * 0.62)
    const meio = `translate(${(ux * 60) * s}px, ${(uy * 40 - 70) * s}px) rotate(${giro * 0.6}deg)`
    const fim = `translate(${(ux * 46) * s}px, ${queda * s}px) rotate(${giro}deg)`
    return { meio, fim, origem: `${cx * s}px ${cy * s}px` }
  })
}

/** Um metal de moeda: a face, a borda escura entre uma moeda e outra e o brilho da de cima. */
interface Metal { face: string; borda: string; brilho: string }
const OURO: Metal = { face: '#e8b52a', borda: '#9c6f06', brilho: '#ffe486' }
// do grupo com menos bens ao com mais: cobre, bronze, prata e ouro (a fila cortada em quatro)
const METAIS: Metal[] = [
  { face: '#c47a45', borda: '#7a4421', brilho: '#eab08a' },
  { face: '#b08a3e', borda: '#6e5320', brilho: '#ddc184' },
  { face: '#b9c1c9', borda: '#6f7a86', brilho: '#eef1f4' },
  OURO,
]

/** As pilhas de moedas de um grupo da fila (cada pilha é 1 em cada 100 candidatos, a altura são os bens);
 * só mudam com o recorte. Cada moeda tem 3px: a borda escura embaixo e a face; a de cima leva o brilho. */
const Barras = memo(function Barras({ hs, inicio, n, pitch, metal }: { hs: number[]; inicio: number; n: number; pitch: number; metal: Metal }) {
  const largura = Math.max(2, pitch - 1)
  const pilha = `linear-gradient(90deg, rgb(255 255 255 / .38), transparent 55%, rgb(0 0 0 / .12)), repeating-linear-gradient(to top, ${metal.borda} 0 1px, ${metal.face} 1px 3px)`
  return (
    <>
      {Array.from({ length: n }, (_, j) => (
        <span
          key={j}
          className="barrinha absolute bottom-0"
          style={{ left: j * pitch, width: largura, height: hs[inicio + j] ?? 8, background: pilha, borderTop: `2px solid ${metal.brilho}`, ['--j' as string]: inicio + j }}
        />
      ))}
    </>
  )
})

/** Os bonequinhos de um grupo: os que não se elegeram e os eleitos são camadas com a figura repetida a cada
 * 14px (máscara); os eleitos preenchem de baixo para cima e acendem linha a linha (recorte em degraus),
 * depois a última linha, incompleta, da esquerda para a direita. Duas animações por grupo, não uma por pessoa. */
const Grade = memo(function Grade({ pessoas, acesos, ordem }: { pessoas: number; acesos: number; ordem: number }) {
  const linhas = Math.max(1, Math.ceil(pessoas / 10))
  const resto = pessoas % 10
  const cheias = Math.floor(acesos / 10)
  const sobra = acesos % 10
  const inicio = 350 + ordem * 140
  return (
    <div className="relative" style={{ width: CELULA * 10, height: linhas * CELULA }}>
      <div className="bonecos-fundo absolute bottom-0 left-0" style={{ width: CELULA * 10, height: Math.floor(pessoas / 10) * CELULA }} />
      {resto > 0 && <div className="bonecos-fundo absolute left-0 top-0" style={{ width: resto * CELULA, height: CELULA }} />}
      {cheias > 0 && (
        <div
          className="bonecos-eleitos absolute bottom-0 left-0"
          style={{ width: CELULA * 10, height: cheias * CELULA, animation: `sobe-linhas ${cheias * 110}ms steps(${cheias}, end) ${inicio}ms both` }}
        />
      )}
      {sobra > 0 && (
        <div
          className="bonecos-eleitos absolute left-0"
          style={{ bottom: cheias * CELULA, width: sobra * CELULA, height: CELULA, animation: `enche-linha ${sobra * 70}ms steps(${sobra}, end) ${inicio + cheias * 110}ms both` }}
        />
      )}
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
  // a escolha vale para o gráfico inteiro: se um grupo tem poucas pessoas, todos mostram as pessoas de verdade
  // (antes cada grupo decidia sozinho e um mostrava "9 de 29" ao lado de porcentagens)
  const poucos = qs.some((g) => g.candidatos < POUCOS)
  return qs.map((g, i) => {
    const nome = nomeFaixa(g, i, qs.length)
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
  if (!cortada) return { x: centroFila, base: p.baseFila }
  if (estreito) {
    const col = gr.i % 2
    const lin = Math.floor(gr.i / 2)
    return { x: col ? 269 : 89, base: p.base + lin * 322 }
  }
  return { x: centroFila + (gr.i - (total - 1) / 2) * p.vao, base: p.base }
}

/** A escala da fila: cresce de 10 em 10 vezes, do menor ao maior valor. Dá a altura de cada barrinha e as
 * linhas de referência nas potências de 10 que caem dentro da fila (R$ 1 mil, R$ 10 mil...). */
function escalaFila(fila: number[], alto: number) {
  const lo = Math.log10(Math.max(1, fila[0] ?? 1))
  const hi = Math.log10(Math.max(10, fila.at(-1) ?? 10))
  const y = (v: number) => 6 + ((alto - 6) * (Math.log10(Math.max(1, v)) - lo)) / Math.max(0.5, hi - lo)
  const marcas: number[] = []
  for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) marcas.push(10 ** k)
  return { hs: fila.map(y), marcas: marcas.map((v) => ({ v, y: y(v) })) }
}

// os grupos cortados, do que declarou menos ao que declarou mais: um tom da ardósia cada, do claro ao escuro
// (rampa ordinal validada: claridade monótona, um só matiz, o mais claro a 2,2:1 do papel); a fila inteira é um tom só
const metalDoGrupo = (i: number, total: number) => (total === 4 ? METAIS[i] : METAIS[Math.round((i / Math.max(1, total - 1)) * 3)])

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
  const [golpes, setGolpes] = useState<Golpe[]>([])
  const [cortando, setCortando] = useState(false)
  const [imagem, setImagem] = useState<string | null>(null)
  const inteiro_ = useRef<SVGSVGElement>(null)
  const defs = useRef<SVGSVGElement>(null)
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
    if (fase === 0) {
      setGolpes([]) // eslint-disable-line react-hooks/set-state-in-effect
      setImagem(null)
    }
  }, [fase])
  // o palco encolhe para caber e, em telas largas, cresce até 1,2x: o cofrinho é o protagonista da página
  const escala = largura ? Math.min(estreito ? 1 : 1.2, largura / p.W) : 1
  const dica = useRef<HTMLDivElement>(null)
  const realce = useRef<HTMLSpanElement>(null)

  // os sons (~40 KB) já vêm quando a página abre; decodificam no primeiro toque
  useEffect(() => baixarSons(), [])

  useEffect(() => {
    const el = caixa.current
    if (fase !== 0 || !el || reduzido()) return
    let quadro = 0
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        const olho = el.querySelector<SVGGElement>('.porco-olho')
        const pupila = el.querySelector<SVGGElement>('.porco-pupila')
        if (!olho || !pupila) return
        const c = olho.getBoundingClientRect()
        const dx = e.clientX - (c.left + c.width / 2)
        const dy = e.clientY - (c.top + c.height / 2)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(1, d / 220)
        pupila.style.transform = `translate(${(dx / d) * 1.6 * k}px, ${(dy / d) * 1.6 * k}px)`
      })
    }
    window.addEventListener('pointermove', mover, { passive: true })
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('pointermove', mover)
    }
  }, [fase])

  const grupos = gruposDe(dados, estreito)
  // as taxas de cima ficam na mesma linha em todos os grupos, acima da grade mais alta
  const linhasMax = Math.max(1, ...grupos.map((gr) => Math.ceil(Math.min(100, gr.pessoas) / 10)))
  // as alturas só mudam com a fila: o memo mantém a mesma lista e as barrinhas (memo) não se redesenham
  const escalaY = useMemo(() => escalaFila(dados.fila, p.alto), [dados.fila, p.alto])
  const hs = escalaY.hs
  const s = p.porco.s
  const porcoY = p.chao - PORCO.base * s
  // o último golpe é o centro da quebra (sem martelada, o meio das costas)
  const centroQuebra = golpes.at(-1) ?? { x: 126, y: 86, semente: SEMENTE }
  const golpe = { x: p.porco.x + centroQuebra.x * s, y: porcoY + centroQuebra.y * s }
  const listaCacos = useMemo(() => cacos(centroQuebra.x, centroQuebra.y, 7, centroQuebra.semente), [centroQuebra.x, centroQuebra.y, centroQuebra.semente])
  const voosCacos = useMemo(() => voosDosCacos(listaCacos, centroQuebra.x, centroQuebra.y, s), [listaCacos, centroQuebra.x, centroQuebra.y, s])
  const cortada = fase >= 2 && !cortando
  const ultimo = grupos.at(-1)
  const primeiro = grupos[0]
  const sobe = !!(primeiro && ultimo && ultimo.g.taxa > primeiro.g.taxa && primeiro.g.taxa > 0 && grupos.length > 1)
  const media = dados.resumo.candidatos ? (100 * dados.resumo.eleitos) / dados.resumo.candidatos : 0

  // o valor da barrinha sob o cursor, nos passos da fila; um quadro por movimento, direto no DOM
  useEffect(() => {
    const el = cena.current
    if (!el || (fase !== 1 && fase !== 2) || cortando) return
    let quadro = 0
    const esconder = () => { dica.current?.classList.add('hidden'); realce.current?.classList.add('hidden') }
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        const caixaCena = el.getBoundingClientRect()
        const k = caixaCena.width / p.W
        const x = (e.clientX - caixaCena.left) / k
        const y = (e.clientY - caixaCena.top) / k
        const alvo = grupos.map((gr) => ({ gr, pos: lugar(p, gr, grupos.length, fase >= 2, estreito) })).find(({ gr, pos }) => x >= pos.x - (gr.n * p.pitch) / 2 && x < pos.x + (gr.n * p.pitch) / 2 && y > pos.base - p.alto - 20 && y < pos.base + 6)
        if (!alvo || !dica.current || !realce.current) return esconder()
        const { gr, pos } = alvo
        const j = Math.min(gr.n - 1, Math.floor((x - (pos.x - (gr.n * p.pitch) / 2)) / p.pitch))
        const indice = gr.inicio + j
        const h = hs[indice] ?? 8
        const bx = pos.x - (gr.n * p.pitch) / 2 + j * p.pitch
        realce.current.style.transform = `translate(${bx - 1.5}px, ${pos.base - h - 1.5}px)`
        realce.current.style.width = `${Math.max(1.5, p.pitch - 2) + 3}px`
        realce.current.style.height = `${h + 1.5}px`
        dica.current.innerHTML = `<b>${indice + 1}º de 100</b> na fila<br><span>declarou cerca de <b>${reaisFaixa(dados.fila[indice])}</b></span>${fase >= 2 ? `<br><span class="dica-grupo">${nomeFaixa(gr.g, gr.i, grupos.length).nome}</span>` : ''}`
        const esquerda = Math.min(p.W - 190, Math.max(0, bx - 80))
        dica.current.style.transform = `translate(${esquerda}px, ${Math.max(0, pos.base - h - 74)}px)`
        dica.current.classList.remove('hidden')
        realce.current.classList.remove('hidden')
      })
    }
    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerdown', mover)
    el.addEventListener('pointerleave', esconder)
    return () => {
      cancelAnimationFrame(quadro)
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerdown', mover)
      el.removeEventListener('pointerleave', esconder)
      esconder()
    }
  }, [fase, cortando, dados, estreito]) // eslint-disable-line react-hooks/exhaustive-deps


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
      todos('[data-caco]').forEach((c) => {
        const v = voosCacos[Number(c.dataset.caco)]
        if (v) anima(c, [{ transform: 'none' }, { transform: 'none', offset: 0.05 }, { transform: v.meio, offset: 0.42, easing: 'cubic-bezier(.3,0,.8,.6)' }, { transform: v.fim }], { duration: 1100, delay: 430, easing: 'cubic-bezier(.2,.7,.3,1)' })
      })
      // a poeira da porcelana: um anel que se abre no golpe
      todos('[data-poeira]').forEach((d) => anima(d, [{ opacity: 0.9, transform: 'scale(.2)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 700, delay: 430, easing: EASE, fill: 'both' }))
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
      // a fila se ergue em onda da esquerda para a direita (CSS .barrinha, atraso pelo índice da barrinha)
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

  // a imagem do porquinho rachado: o SVG do desenho com os gradientes, serializado uma vez
  useEffect(() => () => { if (imagem) URL.revokeObjectURL(imagem) }, [imagem])
  const quebrar = async () => {
    const svg = inteiro_.current
    if (svg && defs.current && !reduzido()) {
      const copia = svg.cloneNode(true) as SVGSVGElement
      copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      copia.insertBefore(defs.current.querySelector('defs')!.cloneNode(true), copia.firstChild)
      copia.querySelectorAll('.racha-nova').forEach((g) => g.removeAttribute('class'))
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copia)], { type: 'image/svg+xml' }))
      const img = new Image()
      img.src = url
      // a quebra espera a imagem ficar pronta (alguns milissegundos), para o primeiro quadro já ter os cacos
      await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 150))])
      setImagem(url)
    }
    aoMudarFase(1)
  }
  // efeitos de cada golpe fora do React: o martelo que desce, as lascas rosadas e a mossa (removidos ao acabar)
  const efeitosGolpe = (x: number, y: number) => {
    const el = cena.current
    if (!el || reduzido()) return
    const r = sorteio(Math.round(x * 31 + y * 17))
    const px = p.porco.x + x * s
    const py = porcoY + y * s
    // a cena inteira está sob o scale do porquinho grande: o ponto na tela usa o mesmo fator
    const g = p.porco.grande
    const ox = p.porco.x + (PORCO.W * s) / 2
    const oy = porcoY + PORCO.H * s * 0.95
    const tx = ox + (px - ox) * g
    const ty = oy + (py - oy) * g
    const martelo = document.createElement('span')
    martelo.className = 'martelo-golpe'
    martelo.style.left = `${tx}px`
    martelo.style.top = `${ty}px`
    el.appendChild(martelo)
    martelo.animate(
      [
        { transform: 'translate(-6px, -46px) rotate(-55deg)', opacity: 0 },
        { transform: 'translate(-6px, -40px) rotate(-60deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-6px, -30px) rotate(8deg)', opacity: 1, offset: 0.55 },
        { transform: 'translate(-6px, -34px) rotate(-12deg)', opacity: 0 },
      ],
      { duration: 420, easing: 'cubic-bezier(.5,0,.2,1)' },
    ).onfinish = () => martelo.remove()
    for (let k = 0; k < 7; k++) {
      const lasca = document.createElement('span')
      lasca.className = 'lasca'
      lasca.style.left = `${tx}px`
      lasca.style.top = `${ty}px`
      el.appendChild(lasca)
      const a = r() * Math.PI * 2
      const v = 18 + r() * 34
      const dx = Math.cos(a) * v
      const dy = Math.sin(a) * v - 26
      lasca.animate(
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${r() * 300}deg) scale(.9)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx * 1.3}px, ${dy + 46}px) rotate(${r() * 500}deg) scale(.6)`, opacity: 0 },
        ],
        { duration: 620 + r() * 200, delay: 150, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'backwards' },
      ).onfinish = () => lasca.remove()
    }
  }
  const martelar = (e: React.MouseEvent<HTMLButtonElement>) => {
    const porco = cena.current?.querySelector('[data-porco]')
    // o ponto do clique no espaço do desenho (o botão cobre o porquinho já com o scale); teclado usa pontos fixos
    let x: number
    let y: number
    if (e.detail > 0) {
      const caixaBotao = e.currentTarget.getBoundingClientRect()
      x = ((e.clientX - caixaBotao.left) / caixaBotao.width) * PORCO.W
      y = ((e.clientY - caixaBotao.top) / caixaBotao.height) * PORCO.H
    } else {
      ;[x, y] = GOLPES_TECLADO[golpes.length % GOLPES_TECLADO.length]
    }
    ;[x, y] = dentroDoCorpo(x, y)
    const novo = { x, y, semente: SEMENTE + golpes.length * 101 + Math.round(x + y) }
    const lista = [...golpes, novo]
    setGolpes(lista)
    tocarGolpe(lista.length)
    efeitosGolpe(x, y)
    if (lista.length >= GOLPES) {
      // a terceira quebra: deixa a rachadura aparecer antes
      setTimeout(quebrar, reduzido() ? 0 : 260)
      return
    }
    if (porco && !reduzido()) {
      const g = `scale(${p.porco.grande})`
      // squash and stretch: a pancada achata, o porquinho volta e balança com amplitude que diminui
      porco.animate(
        [
          { transform: g },
          { transform: `${g} scale(1.06, .9) translateY(4px)`, offset: 0.18 },
          { transform: `${g} scale(.97, 1.04) rotate(-5deg)`, offset: 0.42 },
          { transform: `${g} rotate(4deg)`, offset: 0.62 },
          { transform: `${g} rotate(-2deg)`, offset: 0.8 },
          { transform: g },
        ],
        { duration: 480, easing: 'ease-out' },
      )
    }
  }

  // moedas da quebra: caem no topo de barrinhas espalhadas pela fila
  const largFila = 100 * p.pitch
  const x0 = p.fila.x + (p.fila.w - largFila) / 2
  const nVoos = estreito ? 16 : 26
  const voos = Array.from({ length: nVoos }, (_, k) => {
    const j = Math.min(99, Math.round((k + 0.5) * (100 / nVoos)))
    return { x: x0 + j * p.pitch, y: p.baseFila - (hs[j] ?? 40) - 6, k }
  })

  return (
    <div ref={caixa} className="palco relative w-full" style={{ height: p.alturas[fase] * escala }}>
      <div
        ref={cena}
        className="cena absolute left-0 top-0 origin-top-left select-none transition-transform duration-500"
        style={{ width: p.W, height: p.H, transform: `translateY(${-p.subidas[fase] * escala}px) scale(${escala})`, left: Math.max(0, (largura - p.W * escala) / 2) }}
      >
        <svg ref={defs} width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <Gradientes p={id} />
            {listaCacos.map((c, i) => <clipPath key={i} id={`${id}-caco-${i}`}><polygon points={c.pontos} /></clipPath>)}
          </defs>
        </svg>

        <div aria-hidden className="absolute h-px bg-linha-2" style={{ top: p.chao, left: estreito ? 40 : 0, width: estreito ? p.W - 80 : 260 }} />

        {/* o porquinho: inteiro é um botão; quebrado, seis cacos no chão */}
        <div data-porco className="absolute" style={{ left: p.porco.x, top: porcoY, width: PORCO.W * s, height: PORCO.H * s, transformOrigin: '50% 95%', transform: fase === 0 ? `scale(${p.porco.grande})` : undefined }}>
          <svg aria-hidden className="absolute" width={PORCO.W * s} height={18 * s} viewBox="0 0 260 18" style={{ top: (PORCO.base - 9) * s }}>
            <ellipse cx={128} cy={9} rx={fase ? 116 : 96} ry={fase ? 7 : 8} fill="rgb(42 53 80 / .14)" />
          </svg>
          {fase === 0 ? (
            <svg ref={inteiro_} aria-hidden className="absolute left-0 top-0 overflow-visible" width={PORCO.W * s} height={PORCO.H * s} viewBox={`0 0 ${PORCO.W} ${PORCO.H}`}>
              <Desenho p={id} />
              <Rachaduras golpes={golpes} p={id} novas={golpes.length - 1} />
            </svg>
          ) : imagem ? (
            listaCacos.map((c, i) => (
              <div
                key={i}
                data-caco={i}
                aria-hidden
                className="caco absolute left-0 top-0"
                style={{
                  width: PORCO.W * s,
                  height: PORCO.H * s,
                  backgroundImage: `url(${imagem})`,
                  clipPath: `polygon(${c.pontos.split(' ').map((par) => { const [x, y] = par.split(','); return `${(Number(x) / PORCO.W) * 100}% ${(Number(y) / PORCO.H) * 100}%` }).join(',')})`,
                  transform: voosCacos[i]?.fim,
                  transformOrigin: voosCacos[i]?.origem,
                }}
              >
                {/* a borda quebrada: o recorte deixa só a metade de dentro do traço, o branco da porcelana */}
                <svg className="absolute inset-0" width="100%" height="100%" viewBox={`0 0 ${PORCO.W} ${PORCO.H}`}>
                  <g clipPath={`url(#${id}-silhueta)`}>
                    <polygon points={c.pontos} fill="none" stroke="#fff8fa" strokeWidth={5} strokeLinejoin="round" />
                  </g>
                </svg>
              </div>
            ))
          ) : (
            listaCacos.map((c, i) => (
              <svg
                key={i}
                data-caco={i}
                aria-hidden
                className="absolute left-0 top-0 overflow-visible"
                width={PORCO.W * s}
                height={PORCO.H * s}
                viewBox={`0 0 ${PORCO.W} ${PORCO.H}`}
                style={{ transform: voosCacos[i]?.fim, transformOrigin: voosCacos[i]?.origem }}
              >
                <g clipPath={`url(#${id}-caco-${i})`}>
                  <Desenho p={id} olhar={false} />
                  <Rachaduras golpes={golpes} p={id} />
                </g>
                {/* a borda quebrada mostra o branco da porcelana por dentro, com um fio de sombra */}
                <g clipPath={`url(#${id}-silhueta)`}>
                  <polygon points={c.pontos} fill="none" stroke="#fff8fa" strokeWidth={3.2} strokeLinejoin="round" />
                  <polygon points={c.pontos} fill="none" stroke="#c9607f" strokeWidth={0.8} strokeLinejoin="round" opacity={0.7} />
                </g>
              </svg>
            ))
          )}
          {fase > 0 && <span data-poeira aria-hidden className="poeira absolute" style={{ left: centroQuebra.x * s - 60, top: centroQuebra.y * s - 60 }} />}
          {fase === 0 && (
            <button
              type="button"
              onClick={martelar}
              aria-label={`Martelar o cofrinho (${golpes.length} de ${GOLPES} marteladas). Na terceira ele quebra e separa os ${inteiro(dados.resumo.candidatos)} ${rotulo}.`}
              className="porquinho-alvo absolute inset-0 rounded-[40%] focus-visible:outline-offset-4"
            />
          )}
        </div>

        {fase === 0 && (
          <div className="revela absolute" style={estreito ? { left: 8, right: 8, top: 236 } : { left: p.texto, right: 0, top: 90 }}>
            <p className="t-numero tabular text-[clamp(2.8rem,2rem+2vw,4rem)] text-tinta">{inteiro(dados.resumo.candidatos)}</p>
            <p className="mt-1 max-w-[30ch] text-[1.08rem] font-semibold leading-snug text-tinta">{rotulo} dentro do cofrinho</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button type="button" onClick={quebrar} className="botao-vivo h-12 px-6 text-[1rem]">
                <Hammer size={20} weight="fill" aria-hidden /> Quebrar o cofrinho
              </button>
              <span className="flex items-center gap-1.5 text-[0.84rem] text-tinta-2" aria-live="polite">
                {Array.from({ length: GOLPES }, (_, i) => (
                  <Hammer key={i} size={20} weight={i < golpes.length ? 'fill' : 'regular'} aria-hidden className={i < golpes.length ? 'martelada text-[#c9607f]' : 'text-tinta-3'} />
                ))}
                <span className="ml-1">{golpes.length ? `${golpes.length} de ${GOLPES} marteladas` : 'ou bata 3 vezes no porquinho'}</span>
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
            {/* linhas de referência: finas, sólidas, atrás das barras; o rótulo na ponta esquerda, onde a fila é baixa */}
            {fase === 1 && hs.length > 0 && (
              <div aria-hidden className="pointer-events-none">
                {escalaY.marcas.map(({ v, y }) => (
                  <div key={v} className="absolute h-px bg-linha" style={{ left: p.fila.x, width: p.fila.w, top: p.baseFila - y }}>
                    <span className="eixo-fila absolute -top-[15px] left-0 whitespace-nowrap text-[0.78rem] font-semibold text-tinta-3">{reaisFaixa(v)}</span>
                  </div>
                ))}
                <div className="absolute h-px bg-linha-2" style={{ left: p.fila.x, width: p.fila.w, top: p.baseFila }} />
              </div>
            )}
            {fase === 1 && hs.length > 0 && (
              <div data-legenda-fila aria-hidden>
                <span className="absolute text-[0.8rem] text-tinta-2" style={{ left: x0, top: p.baseFila + 10 }}>menos bens</span>
                <span className="absolute text-right text-[0.8rem] text-tinta-2" style={{ right: p.W - (x0 + largFila), top: p.baseFila + 10 }}>mais bens</span>
                <span className="absolute text-center text-[0.8rem] text-tinta-2" style={{ left: x0, width: largFila, top: p.baseFila + 34 }}>
                  cada pilha de moedas é 1 em cada 100 candidatos que declararam bens
                </span>
              </div>
            )}

            {/* o valor de cada barrinha: um balão e um contorno, movidos direto no DOM (sem re-render) */}
            <span ref={realce} aria-hidden className="realce-barra pointer-events-none absolute left-0 top-0 hidden" />
            <div ref={dica} aria-hidden className="dica-fila pointer-events-none absolute left-0 top-0 hidden" />

            {/* os cortes da tesoura, nas emendas da fila inteira */}
            {cortando && grupos.slice(1).map((gr) => {
              const x = x0 + gr.inicio * p.pitch - p.pitch * 0.14
              return (
                <div key={gr.g.id} data-corte data-x={x} aria-hidden className="absolute origin-bottom" style={{ left: x, top: p.baseFila - p.alto - 26, height: p.alto + 32 }}>
                  <div className="h-full border-l-2 border-dashed border-tinta" />
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-tinta px-2 py-0.5 text-[0.75rem] font-bold text-folha">{reaisFaixa(gr.g.de)}</span>
                </div>
              )
            })}
            {cortando && (
              <span data-tesoura aria-hidden className="absolute left-0 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-escolha text-tinta shadow-[var(--shadow-cartao)]" style={{ top: p.baseFila - p.alto - 64 }}>
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
              return (
                <div key={gr.g.id}>
                  {/* as barrinhas do grupo: andam juntas (uma transformação por grupo) */}
                  <div className="grupo-fila absolute left-0 top-0" style={{ width: w, height: p.alto, transform: `translate(${pos.x - w / 2}px, ${pos.base - p.alto}px)` }}>
                    <div data-barras className="absolute inset-0 origin-bottom transition-transform duration-500" style={{ transform: fase === 3 ? 'scaleY(.28)' : undefined }}>
                      <Barras hs={hs} inicio={gr.inicio} n={gr.n} pitch={p.pitch} metal={fase >= 2 && !cortando ? metalDoGrupo(gr.i, grupos.length) : OURO} />
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
                      <div className="absolute text-center" style={{ left: pos.x - 70, width: 140, top: pos.base - 50 - linhasMax * CELULA - 44 }}>
                        <span className="t-numero tabular inline-block text-[1.9rem]" style={{ color: COR.texto }}>
                          <span data-conta={gr.g.taxa} data-casas="1">{gr.g.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>%
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
              return (
                <div data-carimbo className="carimbo pointer-events-none absolute text-center" style={{ left: pos.x + (estreito ? -6 : 14), top: pos.base - 50 - linhasMax * CELULA + 14 }}>
                  <span className="t-numero block text-[1.6rem] leading-none">{(ultimo.g.taxa / primeiro.g.taxa).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×</span>
                  <span className="block whitespace-nowrap text-[0.78rem] font-bold uppercase tracking-[0.08em]">a chance</span>
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
