// O santinho da carreira como folha de papel de verdade, do jeito dos flipbooks em WebGL: a folha é uma malha contínua
// que curva, não um cartão rígido (CSS só gira um bloco inteiro; recortar em tiras deixava retângulos à vista).
//
// Como funciona: a frente e o verso do santinho são "fotografados" pelo próprio navegador (html-to-image, que desenha o
// HTML num SVG), uma vez por santinho, quando a pessoa chega perto dele. Durante a animação, um canvas WebGL único,
// compartilhado por todos os santinhos, é posto sobre o santinho e desenha a folha: 48 colunas, cada uma com o seu
// ângulo; a posição de cada coluna sai da integral do ângulo ao longo da folha, então a curva é lisa e o papel não
// estica. A luz de cada ponto vem de quanto ele vira. Parado, nada disso existe: volta o HTML nítido de sempre.
import { getFontEmbedCSS, toCanvas } from 'html-to-image'

type THREE = typeof import('three')
const COLUNAS = 48
const MARGEM = 70                  // espaço em volta do santinho no canvas: a folha sobe e curva para fora dele
const PERSPECTIVA = 900            // a mesma do CSS (.santinho: perspective 900px)

/* ---------- as fotos das faces, uma vez por santinho ---------- */
const fotos = new WeakMap<HTMLElement, Promise<[HTMLCanvasElement, HTMLCanvasElement]>>()
let fontes: Promise<string> | null = null
function fotografa(frente: HTMLElement, verso: HTMLElement) {
  let p = fotos.get(frente)
  if (!p) {
    fontes ??= getFontEmbedCSS(frente).catch(() => '')
    const opcoes = (css: string) => ({
      pixelRatio: Math.min(2, window.devicePixelRatio || 1), fontEmbedCSS: css, cacheBust: false,
      // a fibra do papel (ruído SVG em modo multiplicar) sai muito mais forte na foto que na página: fica de fora
      filter: (no: HTMLElement) => !(no.classList && no.classList.contains('santinho-reticula')),
      // a face do verso vem girada e com a face de trás escondida pelo CSS: na foto, as duas de frente e inteiras
      style: { transform: 'none', backfaceVisibility: 'visible', visibility: 'visible', boxShadow: 'none', inset: '0' },
    })
    p = fontes.then((css) => Promise.all([toCanvas(frente, opcoes(css)), toCanvas(verso, opcoes(css))]))
    fotos.set(frente, p)
    p.catch(() => fotos.delete(frente))
  }
  return p
}
/** Fotografa as faces no tempo ocioso, antes do primeiro toque (chamado quando o santinho chega perto da tela). */
export function preparaFolha(frente: HTMLElement, verso: HTMLElement) {
  const ocioso = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (ocioso) ocioso(() => void fotografa(frente, verso), { timeout: 2500 })
  else setTimeout(() => void fotografa(frente, verso), 400)
}

/* ---------- o palco WebGL único ---------- */
interface Palco {
  T: THREE
  renderer: InstanceType<THREE['WebGLRenderer']>
  scene: InstanceType<THREE['Scene']>
  camera: InstanceType<THREE['PerspectiveCamera']>
  geo: InstanceType<THREE['PlaneGeometry']>
  matFrente: InstanceType<THREE['MeshBasicMaterial']>
  matVerso: InstanceType<THREE['MeshBasicMaterial']>
  ocupado: boolean
}
let palcoP: Promise<Palco> | null = null
function palco() {
  palcoP ??= import('three').then((T) => {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    // por cima da página inteira (a fileira dos santinhos rola na horizontal e recortaria a folha que sobe)
    canvas.style.cssText = 'position:fixed;pointer-events:none;z-index:40;'
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.outputColorSpace = T.SRGBColorSpace
    const scene = new T.Scene()
    const camera = new T.PerspectiveCamera(30, 1, 10, 4000)
    // a folha: colunas ao longo da largura, poucas linhas (só dobra em torno do eixo vertical); a cor de cada vértice
    // é a luz daquele ponto
    const geo = new T.PlaneGeometry(1, 1, COLUNAS, 6)
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3))
    const matFrente = new T.MeshBasicMaterial({ side: T.FrontSide, vertexColors: true, transparent: true })
    const matVerso = new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true, transparent: true })
    const frente = new T.Mesh(geo, matFrente), verso = new T.Mesh(geo, matVerso)
    frente.frustumCulled = verso.frustumCulled = false
    scene.add(frente, verso)
    return { T, renderer, scene, camera, geo, matFrente, matVerso, ocupado: false }
  })
  return palcoP
}

/** Põe a folha na pose: `angulo(s)` é o ângulo (rad) da folha no ponto s ∈ [-1, 1] (do centro para cada borda). */
function curva(P: Palco, larg: number, alt: number, angulo: (s: number) => number, sobe: number, perto: number) {
  const pos = P.geo.attributes.position
  const cor = P.geo.attributes.color
  const n = COLUNAS, metade = n / 2, passo = larg / n
  // integra o ângulo do centro para cada lado: x e z de cada coluna (a folha não estica)
  const X = new Float32Array(n + 1), Z = new Float32Array(n + 1), L = new Float32Array(n + 1)
  for (const lado of [1, -1]) {
    let x = 0, z = 0
    for (let k = 0; k <= metade; k++) {
      const c = metade + lado * k
      if (k > 0) {
        const a = angulo((lado * (k - 0.5)) / metade)
        x += lado * Math.cos(a) * passo; z -= lado * Math.sin(a) * passo
      }
      const a = angulo((lado * k) / metade)
      X[c] = x; Z[c] = z
      // a luz: a folha de frente para a câmera fica clara; virando de lado, escurece (papel fosco)
      L[c] = 0.6 + 0.4 * Math.abs(Math.cos(a))
    }
  }
  for (let i = 0; i < pos.count; i++) {
    const c = i % (n + 1), linha = Math.floor(i / (n + 1))
    pos.setXYZ(i, X[c], (0.5 - linha / 6) * alt + sobe, Z[c] + perto)
    cor.setXYZ(i, L[c], L[c], L[c])
  }
  pos.needsUpdate = true; cor.needsUpdate = true
}

let interromper = false
let livre: Promise<void> = Promise.resolve()
const meio = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

/**
 * Roda uma animação da folha sobre `caixa`: `angulo(t, s)` em radianos, `sobe(t)` em px. Esconde `folha` (o HTML) do
 * primeiro quadro desenhado ao último, e devolve o HTML no fim.
 */
async function roda(caixa: HTMLElement, frente: HTMLElement, verso: HTMLElement, folha: HTMLElement, dur: number,
  angulo: (t: number, s: number) => number, sobe: (t: number) => number, comeca: () => void) {
  const [P, [fotoFrente, fotoVerso]] = await Promise.all([palco(), fotografa(frente, verso)])
  // uma folha por vez: a nova interrompe a que está no meio e espera o palco ficar livre
  if (P.ocupado) { interromper = true; await livre }
  if (!caixa.isConnected) return comeca()
  let solta = () => {}
  livre = new Promise<void>((r) => { solta = r })
  P.ocupado = true
  const { T, renderer, scene, camera } = P
  const canvas = renderer.domElement
  const tf = new T.CanvasTexture(fotoFrente), tv = new T.CanvasTexture(fotoVerso)
  try {
    const larg = caixa.offsetWidth, alt = caixa.offsetHeight
    const W = larg + 2 * MARGEM, H = alt + 2 * MARGEM
    renderer.setSize(W, H, false)
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
    canvas.style.rotate = getComputedStyle(caixa).rotate   // a inclinação do santinho não muda durante o giro
    // alinhada ao santinho a cada quadro (centro com centro), mesmo se a página rolar
    const alinha = () => {
      const r = caixa.getBoundingClientRect()
      canvas.style.left = `${r.left + r.width / 2 - W / 2}px`; canvas.style.top = `${r.top + r.height / 2 - H / 2}px`
    }
    // a câmera na distância da perspectiva do CSS, com o campo de visão que faz 1 unidade = 1 px no plano da folha
    camera.aspect = W / H; camera.fov = (2 * Math.atan(H / 2 / PERSPECTIVA) * 180) / Math.PI
    camera.position.set(0, 0, PERSPECTIVA); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix()
    for (const t of [tf, tv]) { t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4 }
    // o verso é visto por trás: a imagem espelhada na horizontal
    tv.wrapS = T.RepeatWrapping; tv.repeat.x = -1; tv.offset.x = 1
    P.matFrente.map = tf; P.matVerso.map = tv; P.matFrente.needsUpdate = P.matVerso.needsUpdate = true
    const desenha = (t: number) => { alinha(); curva(P, larg, alt, (s) => angulo(t, s), sobe(t), sobe(t) * 1.4); renderer.render(scene, camera) }
    desenha(0)
    // a troca acontece no mesmo quadro: a folha WebGL entra, o HTML some e só então o santinho "vira" por baixo
    document.body.appendChild(canvas)
    folha.style.visibility = 'hidden'
    comeca()
    const t0 = performance.now()
    await new Promise<void>((pronto) => {
      const quadro = (agora: number) => {
        // saiu da página no meio (outra ficha, outra tela): para na hora
        if (!caixa.isConnected) return pronto()
        const t = Math.min(1, (agora - t0) / dur)
        desenha(t)
        if (t < 1 && !interromper) requestAnimationFrame(quadro); else pronto()
      }
      requestAnimationFrame(quadro)
    })
  } finally {
    folha.style.visibility = ''
    canvas.remove()
    tf.dispose(); tv.dispose()
    P.ocupado = false; interromper = false
    solta()
  }
}

/**
 * O giro: a folha sobe, vira 180° em torno do eixo vertical e as bordas atrasam (ela faz um "C" no ar, como papel
 * fino), depois assenta com uma ondulação que amortece.
 */
export function giraFolha(caixa: HTMLElement, frente: HTMLElement, verso: HTMLElement, folha: HTMLElement, paraOVerso: boolean, comeca: () => void, dur = 1000) {
  const [de, para] = paraOVerso ? [0, Math.PI] : [Math.PI, 2 * Math.PI]
  const angulo = (t: number, s: number) => {
    const giro = de + (para - de) * meio(t)
    const borda = Math.pow(Math.abs(s), 1.6)
    // as bordas atrasam enquanto a folha gira rápido; no fim, a onda que corre do centro às bordas e morre
    const atraso = -Math.sin(Math.PI * Math.min(1, t * 1.06)) * 0.55 * borda
    const onda = t > 0.62 ? Math.sin((t - 0.62) * 30 - Math.abs(s) * 3.2) * Math.exp(-(t - 0.62) * 8) * 0.16 * borda : 0
    return giro + atraso + onda
  }
  return roda(caixa, frente, verso, folha, dur, angulo, (t) => Math.sin(Math.PI * t) * 14, comeca)
}
