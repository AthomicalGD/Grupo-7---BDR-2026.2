// O santinho da carreira como folha de papel de verdade, do jeito dos flipbooks em WebGL: a folha é uma malha contínua
// que curva, não um cartão rígido (CSS só gira um bloco inteiro; recortar em tiras deixava retângulos à vista).
//
// Como funciona: a frente e o verso do santinho são "fotografados" pelo próprio navegador (o HTML desenhado num SVG),
// uma vez por santinho, quando a pessoa chega perto dele. Durante a animação, um canvas WebGL único, compartilhado por
// todos os santinhos, é posto sobre o santinho e desenha a folha: 48 colunas, cada uma com o seu ângulo; a posição de
// cada coluna sai da integral do ângulo ao longo da folha, então a curva é lisa e o papel não estica. A luz de cada
// ponto vem de quanto ele vira. Parado, nada disso existe: volta o HTML nítido de sempre.
type THREE = typeof import('three')
const COLUNAS = 48
const MARGEM = 70                  // espaço em volta do santinho no canvas: a folha sobe e curva para fora dele
const PERSPECTIVA = 900            // a mesma do CSS (.santinho: perspective 900px)

const ocioso = (f: () => void, timeout = 2500) => {
  const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (ric) ric(f, { timeout }); else setTimeout(f, 300)
}

/* ---------- as fotos das faces, uma vez por santinho ----------
   Uma cópia leve das duas faces num SVG (foreignObject), desenhado num canvas. Cada elemento leva só as propriedades
   de estilo que um santinho usa, lidas do estilo calculado (sem folha de estilo no SVG, é isso que dá a aparência);
   a cópia do html-to-image levava as ~370 de cada elemento, e cada santinho travava a página ~350 ms. As duas faces
   vão numa imagem só, então as fontes embutidas são decodificadas uma vez por santinho. */
// as que nunca herdam: fora quando estão no valor inicial (nenhuma é mudada pelo estilo do navegador nos elementos
// de um santinho), o que deixa o SVG bem menor
const INICIAL: Record<string, string> = {
  top: 'auto', right: 'auto', bottom: 'auto', left: 'auto', 'z-index': 'auto', float: 'none',
  'min-width': 'auto', 'min-height': 'auto', 'max-width': 'none', 'max-height': 'none',
  opacity: '1', isolation: 'auto', 'mix-blend-mode': 'normal', 'background-image': 'none', 'background-size': 'auto',
  'background-position-x': '0%', 'background-position-y': '0%', 'background-repeat': 'repeat', 'background-clip': 'border-box',
  'background-origin': 'padding-box', 'box-shadow': 'none', filter: 'none', 'clip-path': 'none', transform: 'none',
  rotate: 'none', scale: 'none', translate: 'none', 'text-overflow': 'clip', '-webkit-line-clamp': 'none',
  '-webkit-box-orient': 'horizontal', 'flex-grow': '0', 'flex-shrink': '1', 'flex-basis': 'auto', order: '0',
  'row-gap': 'normal', 'column-gap': 'normal', 'grid-template-columns': 'none', 'grid-template-rows': 'none',
  'grid-auto-flow': 'row', 'grid-auto-columns': 'auto', 'grid-auto-rows': 'auto', 'grid-column-start': 'auto',
  'grid-column-end': 'auto', 'grid-row-start': 'auto', 'grid-row-end': 'auto', 'object-fit': 'fill',
  'object-position': '50% 50%', 'aspect-ratio': 'auto', 'outline-style': 'none', 'align-self': 'auto', 'justify-self': 'auto',
}
const PROPRIEDADES = [
  ...Object.keys(INICIAL),
  'display', 'position', 'box-sizing', 'width', 'height', 'overflow-x', 'overflow-y', 'vertical-align', 'appearance',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style',
  'border-bottom-style', 'border-left-style', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'background-color', 'transform-origin', 'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
  'text-decoration-thickness', 'text-underline-offset', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
  'align-content', 'justify-items',
  // as que herdam vão sempre (um filho pode voltar ao valor inicial que o pai mudou)
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variation-settings',
  'font-feature-settings', 'font-variant-numeric', 'font-optical-sizing', 'font-kerning', 'line-height', 'letter-spacing',
  'word-spacing', 'text-align', 'text-transform', 'text-indent', 'text-shadow', 'white-space-collapse', 'text-wrap-mode',
  'text-wrap-style', 'word-break', 'overflow-wrap', 'hyphens', 'writing-mode', 'text-orientation', 'direction',
  '-webkit-text-stroke-width', '-webkit-text-stroke-color', 'paint-order', 'visibility', 'list-style-type', 'fill', 'stroke',
]

function estilo(el: Element, extra = '') {
  const cs = getComputedStyle(el)
  let s = ''
  for (const p of PROPRIEDADES) {
    const v = cs.getPropertyValue(p)
    if (v && INICIAL[p] !== v) s += `${p}:${v};`
  }
  return s + extra
}

// fotos do TSE e fontes viram data: (o SVG desenhado num canvas não busca nada fora dele); uma vez por endereço
const dados = new Map<string, Promise<string>>()
function comoDados(url: string) {
  let p = dados.get(url)
  if (!p) {
    p = fetch(url).then((r) => r.blob()).then((b) => new Promise<string>((ok, erro) => {
      const f = new FileReader()
      f.onload = () => ok(f.result as string)
      f.onerror = erro
      f.readAsDataURL(b)
    }))
    dados.set(url, p)
    p.catch(() => dados.delete(url))
  }
  return p
}

// só as fontes do santinho, e só o alfabeto latino (com os acentos, até o latino estendido B): as outras faixas
// (cirílico, vietnamita...) não aparecem nele. O navegador escreve as faixas como "U+0-FF, U+131, U+4??"
const latina = (faixa: string) => !faixa || faixa.split(',').some((parte) => {
  const [a, b = a] = parte.trim().replace(/^U\+/i, '').split('-')
  return parseInt(a.replace(/\?/g, '0'), 16) <= 0x24f && parseInt(b.replace(/\?/g, 'f'), 16) >= 0x20
})
// já codificadas para o endereço data: (são ~150 kB: codificar a cada foto custava mais que o resto do SVG)
let fontes: Promise<string> | null = null
function fontesEmbutidas() {
  fontes ??= Promise.all(
    Array.from(document.styleSheets).flatMap((folha) => {
      let regras: CSSRule[] = []
      try { regras = Array.from(folha.cssRules) } catch { /* folha de outra origem */ }
      return regras.filter((r): r is CSSFontFaceRule => r instanceof CSSFontFaceRule).filter((r) =>
        /Archivo|Red Hat Mono/i.test(r.style.getPropertyValue('font-family')) && latina(r.style.getPropertyValue('unicode-range')),
      ).map(async (r) => {
        const url = /url\(["']?([^"')]+)["']?\)/.exec(r.style.getPropertyValue('src'))?.[1]
        if (!url) return ''
        const d = await comoDados(new URL(url, folha.href ?? location.href).href)
        return r.cssText.replace(/src:[^;]+;/, `src: url("${d}");`)
      })
    }),
  ).then((partes) => encodeURIComponent(partes.join('\n'))).catch(() => '')
  return fontes
}

/** A cópia de uma face com o estilo calculado de cada elemento; as fotos entram como data: depois. */
function copiaFace(face: HTMLElement, imagens: Promise<void>[]) {
  const copia = (no: Node): Node | null => {
    if (no.nodeType === Node.TEXT_NODE) return no.cloneNode()
    if (!(no instanceof Element)) return null
    // a fibra do papel (ruído SVG em modo multiplicar) sai muito mais forte na foto que na página: fica de fora
    if (no.classList.contains('santinho-reticula')) return null
    // um desenho SVG (as fitas, a faixa, os ícones) vai inteiro: os atributos dele já dizem como ele é
    if (no instanceof SVGSVGElement) {
      const c = no.cloneNode(true) as SVGSVGElement
      c.setAttribute('style', estilo(no))
      return c
    }
    const c = no.cloneNode(false) as HTMLElement
    c.setAttribute('style', estilo(no))
    if (no instanceof HTMLImageElement) {
      c.removeAttribute('loading')
      c.removeAttribute('srcset')
      imagens.push(comoDados(no.currentSrc || no.src).then((d) => c.setAttribute('src', d), () => undefined))
    }
    for (const f of Array.from(no.childNodes)) {
      const x = copia(f)
      if (x) c.appendChild(x)
    }
    return c
  }
  const c = copia(face) as HTMLElement
  // a face do verso vem girada e com a face de trás escondida pelo CSS: na foto, as duas de frente e inteiras
  c.style.cssText += 'position:absolute;inset:0;transform:none;backface-visibility:visible;visibility:visible;box-shadow:none;'
  return c
}

const fotos = new WeakMap<HTMLElement, Promise<[HTMLCanvasElement, HTMLCanvasElement]>>()
function fotografa(frente: HTMLElement, verso: HTMLElement) {
  let p = fotos.get(frente)
  if (!p) {
    p = (async () => {
      const css = await fontesEmbutidas()
      const imagens: Promise<void>[] = []
      const w = frente.offsetWidth, h = frente.offsetHeight
      const [cf, cv] = [copiaFace(frente, imagens), copiaFace(verso, imagens)]
      await Promise.all(imagens)
      const xml = new XMLSerializer()
      const caixa = (x: number, c: HTMLElement) =>
        `<foreignObject x="${x}" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${w}px;height:${h}px">${xml.serializeToString(c)}</div></foreignObject>`
      const abre = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h}"><style>`
      const fecha = `</style>${caixa(0, cf)}${caixa(w, cv)}</svg>`
      // como data: (um blob: deixa o canvas "contaminado" e o WebGL recusa a foto como textura)
      const img = new Image()
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(abre) + css + encodeURIComponent(fecha)
      await img.decode()
      const pr = Math.min(2, window.devicePixelRatio || 1)
      return [0, 1].map((i) => {
        const c = document.createElement('canvas')
        c.width = Math.round(w * pr); c.height = Math.round(h * pr)
        c.getContext('2d')!.drawImage(img, i * w, 0, w, h, 0, 0, c.width, c.height)
        return c
      }) as [HTMLCanvasElement, HTMLCanvasElement]
    })()
    fotos.set(frente, p)
    p.catch(() => fotos.delete(frente))
  }
  return p
}
/**
 * Fotografa as faces no tempo ocioso, antes do primeiro toque (chamado quando o santinho chega perto da tela). Uma
 * foto por vez, cada uma no seu intervalo ocioso: várias juntas viravam um quadro de 100 ms no meio da rolagem.
 */
let filaFotos: Promise<unknown> = Promise.resolve()
export function preparaFolha(frente: HTMLElement, verso: HTMLElement) {
  filaFotos = filaFotos.then(() => new Promise<void>((pronto) => ocioso(() => {
    fotografa(frente, verso).then(() => ocioso(aquecePalco)).catch(() => undefined).finally(pronto)
  })))
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
// o palco nasce e os shaders da folha são compilados (em paralelo) no tempo ocioso, depois da primeira foto: o primeiro
// giro não espera o WebGL ser criado nem compilar (~90 ms parados no clique)
let aquecido = false
function aquecePalco() {
  if (aquecido) return
  aquecido = true
  void palco().then(async (P) => {
    // uma textura qualquer no lugar das fotos: o programa compilado é o mesmo do giro (com mapa)
    const provisoria = new P.T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    provisoria.colorSpace = P.T.SRGBColorSpace
    if (!P.ocupado) { P.matFrente.map = provisoria; P.matVerso.map = provisoria }
    await P.renderer.compileAsync(P.scene, P.camera)
    // o primeiro uso de cada programa lê os uniformes do driver (chamadas que esperam a GPU): agora, não no giro
    ocioso(() => { for (const p of P.renderer.info.programs ?? []) p.getUniforms() })
  })
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
