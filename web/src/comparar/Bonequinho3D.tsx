// O bonequinho em 3D: um boneco "chibi" (cabeça grande, corpo pequeno) com sombreamento de desenho animado em três
// faixas (toon) e contorno de tinta, feito de primitivas arredondadas, sem modelo para baixar.
// Os traços vêm dos dados (tracos): gênero do TSE (cabelo comprido e saia, ou curto e calça), idade (o cabelo
// grisalha, rareia e vira coque; a partir dos 70, curvado e mais devagar), faixa pelo cargo, braço erguido se venceu.
// O rosto: a foto do TSE recortada num círculo que esmaece, sobre a cabeça pintada na cor de pele da própria foto
// (assim a borda some), ou um rosto desenhado. Por cima, o armário (pecas.ts).
// Só desenha quando algo muda (frameloop "demand"): parado não gasta nada; anima com o mouse em cima ou no "tocar".
import { Canvas, useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Politico } from '../api'
import { ROSTO, TINTA, tracos } from './Bonequinho'
import type { Animacao, Visual } from './pecas'

const OURO = '#e8b100'
const PRESIDENCIAL = ['#009c3b', '#f5b800']
const VOLTA = Math.PI * 2
// perfil do vestido (raio, altura a partir do quadril), girado em volta do eixo
const VESTIDO = new THREE.LatheGeometry(
  [[0, -0.08], [0.36, -0.08], [0.33, 0.0], [0.24, 0.12], [0.165, 0.22], [0.19, 0.3], [0.225, 0.38], [0.215, 0.46], [0.16, 0.53], [0.08, 0.57], [0, 0.575]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 28)

/* ---------- materiais: toon em três faixas e o contorno ---------- */
const GRADIENTE = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t
})()
// contorno de espessura fixa: a mesma peça por dentro do avesso, empurrada para fora pela normal
const CONTORNO = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide })
CONTORNO.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * 0.017;') }
CONTORNO.customProgramCacheKey = () => 'contorno'

type G = ThreeElements['group']
/** Uma peça: a malha em toon e, por trás, o contorno. `mat` troca o material (a key separa os tipos). */
function Peca({ geo, cor = '#fff', mat, borda = true, ...g }: { geo: ReactNode; cor?: string; mat?: ReactNode; borda?: boolean } & G) {
  return (
    <group {...g}>
      <mesh>{geo}{mat ?? <meshToonMaterial key="liso" color={cor} gradientMap={GRADIENTE} />}</mesh>
      {borda && <mesh material={CONTORNO}>{geo}</mesh>}
    </group>
  )
}

/* ---------- texturas desenhadas num canvas ---------- */
function canvasTex(w: number, h: number, desenha: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  desenha(cv.getContext('2d')!)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}
/** a cor é clara o bastante para pedir letra escura em cima? */
const claro = (c: string) => { const k = new THREE.Color(c); return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b > 0.45 }
const letra = (px: number) => `800 ${Math.round(px)}px "League Spartan", system-ui, sans-serif`
function rotulo(texto: string, cor: string, w: number, h: number, redondo: boolean, fundo = '#fff') {
  return canvasTex(w, h, (g) => {
    if (redondo) { g.fillStyle = fundo; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, VOLTA); g.fill(); g.lineWidth = 8; g.strokeStyle = TINTA; g.stroke() }
    g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = letra(h * (redondo ? (texto.length > 3 ? 0.25 : texto.length > 2 ? 0.34 : 0.46) : 0.62))
    g.fillText(texto, w / 2, h / 2 + h * 0.04)
  })
}
const listras = () => canvasTex(64, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f2ee' : '#1b1d22'; g.fillRect(0, 8 * i, 64, 8) } })
const bandeiraBR = () => canvasTex(140, 96, (g) => {
  g.fillStyle = '#009c3b'; g.fillRect(0, 0, 140, 96)
  g.fillStyle = '#ffdf00'; g.beginPath(); g.moveTo(70, 8); g.lineTo(130, 48); g.lineTo(70, 88); g.lineTo(10, 48); g.closePath(); g.fill()
  g.fillStyle = '#002776'; g.beginPath(); g.arc(70, 48, 23, 0, VOLTA); g.fill()
})

/* ---------- o rosto: uma calota na frente da cabeça; (u, v) do rosto -> ponto 3D ---------- */
const R = 0.43                                   // raio da cabeça
// a foto cobre quase toda a frente da cabeça (do alto do cabelo ao queixo); o desenho, só o miolo do rosto
const CALOTAS = {
  foto: { phi0: Math.PI / 2 - 1.2, phiL: 2.4, th0: 0.42, thL: 2.0, r: R + 0.004 },
  desenho: { phi0: Math.PI / 2 - 0.78, phiL: 1.56, th0: Math.PI / 2 - 0.68, thL: 1.42, r: R + 0.004 },
}
type Calota = typeof CALOTAS.foto
const naCalota = (cal: Calota, u: number, v: number, sobra = 0.03): [number, number, number] => {
  const phi = cal.phi0 + u * cal.phiL, th = cal.th0 + (1 - v) * cal.thL, r = cal.r + sobra
  return [-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th)]
}
// onde ficam os olhos e a boca em cada rosto (u da esquerda para a direita, v de baixo para cima)
const OLHOS = { foto: { u: 0.38, v: 0.53 }, desenho: { u: 0.35, v: 0.52 } }
const BOCA_V = { foto: 0.24, desenho: 0.3 }

const mediana = (v: number[]) => { const o = [...v].sort((x, y) => x - y); return o[Math.floor(o.length / 2)] ?? 0 }
function corMediana(px: [number, number, number][]) {
  return px.length ? `rgb(${mediana(px.map((c) => c[0]))}, ${mediana(px.map((c) => c[1]))}, ${mediana(px.map((c) => c[2]))})` : null
}

/**
 * A foto 3×4 do TSE vira rosto: o fundo (liso e claro) sai, pintado de dentro para fora a partir das bordas; a
 * cabeça é achada pelo topo e pelo pescoço (onde a silhueta afina); o recorte centra o rosto num círculo que
 * esmaece; e da própria foto saem a cor da pele (bochechas e nariz) e a do cabelo (logo abaixo do topo).
 * Se o fundo não for liso, cai num recorte fixo no meio da foto.
 */
function rostoDaFoto(img: HTMLImageElement) {
  const w = img.naturalWidth, h = img.naturalHeight
  const fonte = document.createElement('canvas'); fonte.width = w; fonte.height = h
  const gf = fonte.getContext('2d', { willReadFrequently: true })!
  gf.drawImage(img, 0, 0)
  const d = gf.getImageData(0, 0, w, h).data
  // o fundo: a cor dos cantos de cima (os de baixo são a roupa), espalhada pelos vizinhos parecidos
  const cantos = [[2, 2], [w - 3, 2]].map(([x, y]) => (y * w + x) * 4)
  const ref = [0, 1, 2].map((k) => cantos.reduce((t, i) => t + d[i + k], 0) / 2)
  const parecido = (i: number) => Math.abs(d[i] - ref[0]) + Math.abs(d[i + 1] - ref[1]) + Math.abs(d[i + 2] - ref[2]) < 60
  const fundo = new Uint8Array(w * h), fila: number[] = []
  const semeia = (x: number, y: number) => { const j = y * w + x; if (!fundo[j] && parecido(j * 4)) { fundo[j] = 1; fila.push(j) } }
  for (let x = 0; x < w; x++) semeia(x, 0)
  for (let y = 0; y < h; y++) { semeia(0, y); semeia(w - 1, y) }
  while (fila.length) {
    const j = fila.pop()!, x = j % w, y = (j - x) / w
    if (x > 0) semeia(x - 1, y); if (x < w - 1) semeia(x + 1, y); if (y > 0) semeia(x, y - 1); if (y < h - 1) semeia(x, y + 1)
  }
  // a silhueta, linha a linha: o topo da cabeça e a largura dela (o primeiro alargamento que volta a afinar,
  // antes dos ombros); a altura sai da proporção de uma cabeça com cabelo (1,3 × a largura)
  const largura: number[] = [], meio: number[] = []
  for (let y = 0; y < h; y++) {
    let e = -1, dd = -1
    for (let x = 0; x < w; x++) if (!fundo[y * w + x]) { if (e < 0) e = x; dd = x }
    largura.push(e < 0 ? 0 : dd - e); meio.push(e < 0 ? w / 2 : (e + dd) / 2)
  }
  const topo = largura.findIndex((l) => l > w * 0.08)
  let cx = w / 2, cy = 0.41 * h, lado = 0.66 * w, achou = false, alto = 0
  if (topo >= 0 && fundo.reduce((t, v) => t + v, 0) > w * h * 0.12) {
    let maior = 0, linhaMaior = topo
    for (let y = topo; y < Math.min(h, topo + h * 0.6); y++) {
      if (largura[y] > maior) { maior = largura[y]; linhaMaior = y }
      else if (largura[y] < maior * 0.9) break
    }
    if (maior > w * 0.2 && maior < w * 0.95) {
      alto = maior * 1.3
      cy = topo + alto * 0.5; lado = alto * 1.05; cx = meio[linhaMaior]; achou = true
    }
  }
  const largo = lado * 1.2, sx = cx - largo / 2, sy = cy - lado / 2
  const cv = document.createElement('canvas'); cv.width = cv.height = 256
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.drawImage(fonte, sx, sy, largo, lado, 0, 0, 256, 256)
  const out = g.getImageData(0, 0, 256, 256), o = out.data
  const pele: [number, number, number][] = [], fio: [number, number, number][] = []
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4
    const fx = Math.floor(sx + (x / 256) * largo), fy = Math.floor(sy + (y / 256) * lado)
    const deFundo = fx < 0 || fy < 0 || fx >= w || fy >= h || (achou && fundo[fy * w + fx])
    if (deFundo) { o[i + 3] = 0; continue }
    const lum = 0.3 * o[i] + 0.59 * o[i + 1] + 0.11 * o[i + 2]
    // pele: nariz e bochechas, sem os tons muito escuros (barba, sombra) nem muito claros (brilho)
    if (y > 135 && y < 172 && x > 96 && x < 160 && lum > 70 && lum < 235 && o[i] > o[i + 2]) pele.push([o[i], o[i + 1], o[i + 2]])
  }
  if (achou) {
    // cabelo: um pouco abaixo do topo (a borda mistura com o fundo), no meio, sem o que parece fundo
    for (let y = topo + 3; y < Math.min(h, topo + 3 + Math.max(3, alto * 0.08)); y++) for (let x = Math.round(meio[y] - largura[y] / 4); x < meio[y] + largura[y] / 4; x++) {
      const i = (y * w + x) * 4
      if (!fundo[y * w + x] && !parecido(i)) fio.push([d[i], d[i + 1], d[i + 2]])
    }
  }
  g.putImageData(out, 0, 0)
  g.globalCompositeOperation = 'destination-in'
  const borda = g.createRadialGradient(128, 128, 106, 128, 128, 128)
  borda.addColorStop(0, 'rgba(0,0,0,1)'); borda.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = borda; g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return { tex: t, pele: corMediana(pele) ?? ROSTO, cabelo: corMediana(fio) }
}

/** O rosto desenhado: olhos com brilho, sobrancelhas da cor do cabelo, bochechas e a boca do resultado. */
function rostoDesenhado(venceu: boolean, mulher: boolean, cabelo: string) {
  return canvasTex(256, 256, (g) => {
    const ox = OLHOS.desenho.u * 256, oy = (1 - OLHOS.desenho.v) * 256
    for (const x of [ox, 256 - ox]) {
      g.fillStyle = '#1a1c22'; g.beginPath(); g.ellipse(x, oy, 13, 18, 0, 0, VOLTA); g.fill()
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4, oy - 6, 5, 0, VOLTA); g.fill()
      if (mulher) { g.strokeStyle = '#1a1c22'; g.lineWidth = 3.5; g.lineCap = 'round'; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + d * 10, oy - 12); g.lineTo(x + d * 17, oy - 18); g.stroke() } }
      // sobrancelha: reta e erguida em quem venceu, caída para fora em quem perdeu
      g.strokeStyle = cabelo === '#e6e9ec' ? '#a7adb5' : cabelo; g.lineWidth = 7; g.lineCap = 'round'
      const fora = x < 128 ? -1 : 1
      g.beginPath(); g.moveTo(x - fora * 12, oy - 30 - (venceu ? 2 : -3)); g.lineTo(x + fora * 13, oy - 30 + (venceu ? -3 : 4)); g.stroke()
    }
    g.fillStyle = 'rgba(255,120,120,0.45)'
    for (const x of [ox - 18, 256 - ox + 18]) { g.beginPath(); g.ellipse(x, oy + 30, 17, 10, 0, 0, VOLTA); g.fill() }
    const by = (1 - BOCA_V.desenho) * 256
    if (venceu) {
      g.fillStyle = mulher ? '#b8324f' : '#7a1f1f'; g.beginPath(); g.ellipse(128, by - 4, 24, 20, 0, 0, Math.PI); g.fill()
      g.fillStyle = '#ff8a8a'; g.beginPath(); g.ellipse(128, by + 8, 12, 6, 0, 0, Math.PI); g.fill()
    } else {
      g.strokeStyle = mulher ? '#b8324f' : '#1a1c22'; g.lineWidth = 6; g.lineCap = 'round'
      g.beginPath(); g.moveTo(108, by + 6); g.quadraticCurveTo(128, by - 6, 148, by + 6); g.stroke()
    }
  })
}

/* ---------- as poses: cada animação diz onde ficam corpo, cabeça e braços no instante t ---------- */
// ax/az: giro dos braços [esquerdo, direito] para a frente (x) e para o lado (z); f é o lado do braço de fora
interface Pose { y: number; ry: number; tx: number; tz: number; cx: number; cz: number; ax: number[]; az: number[] }
type Quadro = Partial<Pose> & { giro?: number }
const deFora = (f: number, deles: number, outro: number) => (f < 0 ? [deles, outro] : [outro, deles])
const POSES: Record<Exclude<Animacao, 'auto'>, (t: number, f: number) => Quadro> = {
  acena: (t, f) => ({ az: deFora(f, f * (2.5 + 0.35 * Math.sin(t * 7)), -f * 0.15), ry: 0.15 * Math.sin(t * 1.5), cz: 0.1 * Math.sin(t * 3.5) }),
  danca: (t) => {
    const s = Math.sin(t * 4)
    return { tz: 0.16 * s, y: 0.06 * Math.abs(s), cz: -0.16 * s, az: [-(0.8 + 0.6 * s), 0.8 - 0.6 * s], ax: [-0.5 * Math.cos(t * 4), 0.5 * Math.cos(t * 4)] }
  },
  pula: (t) => { const s = Math.max(0, Math.sin(t * 5)); return { y: 0.42 * s, az: [-(0.3 + 1.6 * s), 0.3 + 1.6 * s], tx: -0.1 * s, cx: -0.1 * s } },
  gira: (t) => ({ giro: t * 4.5, az: [-1.4, 1.4], y: 0.05 * Math.abs(Math.sin(t * 9)) }),
  comemora: (t) => { const s = 0.25 * Math.sin(t * 11); return { az: [-2.8 - s, 2.8 + s], y: 0.08 * Math.abs(Math.sin(t * 11)), cx: -0.15 } },
  discursa: (t, f) => {
    const bate = Math.sin(t * 6)
    return { ax: deFora(f, -1.3 + 0.35 * bate, 0), az: deFora(f, f * 0.25, -f * 0.15), cx: 0.1 * bate, ry: 0.14 * Math.sin(t * 1.2) }
  },
  // a mão de dentro no queixo (a de fora pode estar segurando algo), a cabeça de lado
  pensa: (t, f) => ({ ax: deFora(f, 0, -2.3), az: deFora(f, f * 0.15, f * 0.75), cz: 0.18 + 0.05 * Math.sin(t * 1.4), cx: 0.1, ry: 0.1 * Math.sin(t * 0.9) }),
  // braços abrem e sobem devagar, o corpo inclina de um lado para o outro
  alonga: (t) => { const s = Math.sin(t * 1.6); return { az: [-(1.6 + 1.1 * s), 1.6 + 1.1 * s], tz: 0.22 * Math.sin(t * 0.8), cz: 0.12 * Math.sin(t * 0.8), y: 0.03 * s } },
  cabisbaixo: (t) => ({ cx: 0.5, tx: 0.16, az: [-0.04, 0.04], ry: 0.12 * Math.sin(t * 1.3), y: -0.02 }),
}

function Boneco({ p, cor, lado, ativo, visual }: { p: Politico; cor: string; lado: 'a' | 'b'; ativo: boolean; visual: Visual }) {
  const { ultima, venceu, idade, cabelo: cabeloIdade, faixa: faixaDado, mulher } = tracos(p, cor)
  const invalidate = useThree((s) => s.invalidate)
  const raiz = useRef<THREE.Group>(null), tronco = useRef<THREE.Group>(null), cabeca = useRef<THREE.Group>(null)
  const bracoE = useRef<THREE.Group>(null), bracoD = useRef<THREE.Group>(null)
  const bracos = [bracoE, bracoD]                       // [esquerdo (−x), direito (+x)]
  const naMao = useRef<THREE.Group>(null), chuva = useRef<THREE.Group>(null)
  const virado = lado === 'a' ? 0.32 : -0.32          // olha para o "VS", no meio
  const fora = lado === 'a' ? -1 : 1                    // o braço de fora (o que sobe e segura as coisas)
  const iFora = fora < 0 ? 0 : 1
  const velho = idade != null && idade >= 70
  const curvado = velho ? 0.1 : 0
  const ritmo = velho ? 0.65 : 1
  const faixa = visual.faixa === false ? null : faixaDado ?? (visual.faixa ? PRESIDENCIAL : null)
  const anim: Exclude<Animacao, 'auto'> = visual.animacao === 'auto' ? (venceu ? 'acena' : 'cabisbaixo') : visual.animacao
  const astronauta = visual.roupa === 'astronauta'

  // a foto vira rosto recortado e dá a cor da pele; sem foto, pele de brinquedo e rosto desenhado
  const [daFoto, setDaFoto] = useState<ReturnType<typeof rostoDaFoto> | null>(null)
  useEffect(() => {
    if (!p.foto) return
    let vivo = true
    const img = new Image()
    img.onload = () => { if (vivo) { setDaFoto(rostoDaFoto(img)); invalidate() } }
    img.src = p.foto
    return () => { vivo = false }
  }, [p.foto, invalidate])
  useEffect(() => () => daFoto?.tex.dispose(), [daFoto])
  const desenho = useMemo(() => rostoDesenhado(venceu, mulher, cabeloIdade), [venceu, mulher, cabeloIdade])
  useEffect(() => () => desenho.dispose(), [desenho])
  const comFoto = visual.rosto === 'foto' && !!daFoto
  const pele = daFoto?.pele ?? ROSTO
  const cabelo = (comFoto && daFoto?.cabelo) || cabeloIdade
  const olho = OLHOS[comFoto ? 'foto' : 'desenho']
  const cal = CALOTAS[comFoto ? 'foto' : 'desenho']

  const tex = useMemo(() => ({
    numero: ultima?.numero != null ? rotulo(String(ultima.numero), TINTA, 128, 128, true) : null,
    // a letra sobre fundo claro escurece a cor do lado; na plaquinha, letra escura se a cor for clara
    partido: ultima?.partido ? rotulo(ultima.partido, '#' + new THREE.Color(cor).multiplyScalar(0.62).getHexString(), 256, 56, false) : null,
    placa: rotulo(`VOTE ${ultima?.numero ?? ''}`.trim(), claro(cor) ? TINTA : '#fff', 256, 128, false),
    listras: listras(), bandeira: bandeiraBR(), heroi: rotulo('V', TINTA, 128, 128, true, '#f5b800'),
  }), [ultima?.numero, ultima?.partido, cor])
  useEffect(() => () => Object.values(tex).forEach((t) => t?.dispose()), [tex])

  // "tocar": a animação roda ~3 s mesmo sem o mouse em cima
  const [tocando, setTocando] = useState(false)
  useEffect(() => {
    if (!visual.toca) return
    setTocando(true); invalidate()
    const id = setTimeout(() => setTocando(false), 3400)
    return () => clearTimeout(id)
  }, [visual.toca, invalidate])
  const anima = ativo || tocando

  // a pose anda em direção à da animação (quando anima) ou à de descanso, e para de desenhar quando chega
  const t0 = useRef(0), giro = useRef(0)
  const atual = useRef<Pose>({ y: 0, ry: virado, tx: curvado, tz: 0, cx: 0, cz: 0, ax: [0, 0], az: [-0.15, 0.15] })
  useFrame((_, dt) => {
    const r = raiz.current, tr = tronco.current, ca = cabeca.current
    if (!r || !tr || !ca) return
    dt = Math.min(dt, 0.05)
    // descanso: quem venceu fica com o braço de fora erguido; quem segura algo mostra para a frente
    const az = [-0.15, 0.15], ax = [0, 0]
    if (venceu) az[iFora] = fora * 2.5
    else if (visual.mao !== 'nada') { az[iFora] = fora * 0.35; ax[iFora] = -0.9 }
    let alvo: Pose = { y: 0, ry: virado, tx: curvado, tz: 0, cx: 0, cz: 0, ax, az }
    let girando = 0
    if (anima) {
      t0.current += dt * ritmo
      const { giro: g, ...o } = POSES[anim](t0.current, fora)
      alvo = { ...alvo, ...o, ry: virado + (o.ry ?? 0), tx: curvado + (o.tx ?? 0) }
      if (g != null) girando = g
    }
    const k = Math.min(1, dt * 9), a = atual.current
    const vai = (de: number, para: number) => de + (para - de) * k
    a.y = vai(a.y, alvo.y); a.ry = vai(a.ry, alvo.ry); a.tx = vai(a.tx, alvo.tx); a.tz = vai(a.tz, alvo.tz); a.cx = vai(a.cx, alvo.cx); a.cz = vai(a.cz, alvo.cz)
    for (const i of [0, 1]) { a.ax[i] = vai(a.ax[i], alvo.ax[i]); a.az[i] = vai(a.az[i], alvo.az[i]) }
    // o giro termina na volta inteira mais próxima, para não parar de costas
    const voltaInteira = Math.round(giro.current / VOLTA) * VOLTA
    giro.current = girando || vai(giro.current, voltaInteira)
    r.position.y = a.y; r.rotation.y = a.ry + giro.current - virado
    tr.rotation.set(a.tx, 0, a.tz); ca.rotation.set(a.cx, 0, a.cz)
    bracos.forEach((b, i) => b.current?.rotation.set(a.ax[i], 0, a.az[i]))
    // o que está na mão fica de pé, desfazendo o giro do braço
    const m = naMao.current, b = bracos[iFora].current
    if (m && b) m.rotation.set(-b.rotation.x, 0, -b.rotation.z, 'ZYX')
    // a chuva de votos cai enquanto anima
    if (chuva.current && anima) chuva.current.children.forEach((c, i) => {
      c.position.y = 2.9 - ((t0.current * 0.9 + i * 0.37) % 2.9)
      c.rotation.set(t0.current * (1 + (i % 3)), t0.current * 2 + i, 0)
    })
    const perto = (x: number, y: number) => Math.abs(x - y) < 0.002
    const chegou = perto(a.ry, alvo.ry) && perto(a.y, alvo.y) && perto(a.cx, alvo.cx) && perto(a.tx, alvo.tx) && perto(a.tz, alvo.tz) &&
      perto(a.az[iFora], alvo.az[iFora]) && perto(a.ax[iFora], alvo.ax[iFora]) && perto(giro.current, voltaInteira)
    if (anima || !chegou) invalidate()
  })
  useEffect(() => { invalidate() }, [anima, visual, invalidate])

  /* ---------- materiais da roupa ---------- */
  const toon = (c: string) => <meshToonMaterial key="liso" color={c} gradientMap={GRADIENTE} />
  const listrado = <meshToonMaterial key="listrado" map={tex.listras} gradientMap={GRADIENTE} />
  const corRoupa = { terno: '#1f2633', selecao: '#f8d417', astronauta: '#eef1f5', super: cor, padrao: cor, presidiario: '' }[visual.roupa]
  const corCalca = { terno: '#1f2633', selecao: '#1d4fa0', astronauta: '#eef1f5', super: '#1f2633', padrao: '#2f3846', presidiario: '' }[visual.roupa]
  const roupa = visual.roupa === 'presidiario' ? listrado : toon(corRoupa)
  const calca = visual.roupa === 'presidiario' ? listrado : toon(corCalca)
  const duplo = (c: string) => <meshToonMaterial key="duplo" color={c} gradientMap={GRADIENTE} side={THREE.DoubleSide} />
  const vidro = (c: string, o: number) => <meshBasicMaterial key="vidro" color={c} transparent opacity={o} depthWrite={false} />

  /* ---------- cabelo: pelo gênero e pela idade ---------- */
  const estilo = p.id % 3
  const coque = idade != null && idade >= 65
  const mechas = mulher && !coque && (
    <>
      <Peca geo={<capsuleGeometry args={[0.3, estilo === 1 ? 0.06 : 0.3, 6, 14]} />} cor={cabelo} position={[0, estilo === 1 ? -0.02 : -0.16, -0.2]} scale={[1.38, 1, 0.7]} />
      {[-1, 1].map((s) => <Peca key={s} geo={<capsuleGeometry args={[0.085, estilo === 1 ? 0.16 : 0.36, 4, 12]} />} cor={cabelo}
        position={[s * 0.34, estilo === 1 ? -0.2 : -0.3, 0.1]} rotation={[0.15, 0, s * 0.12]} />)}
    </>
  )
  const brincos = mulher && [-1, 1].map((s) => <Peca key={`b${s}`} geo={<sphereGeometry args={[0.035, 10, 8]} />} cor={OURO} position={[s * 0.42, -0.14, 0.06]} />)
  const cabeloPeca = comFoto ? (
    <>
      <Peca geo={<sphereGeometry args={[R + 0.002, 32, 16, 0, VOLTA, 0, 2.0]} />} cor={cabelo} />
      {mulher && coque && <Peca geo={<sphereGeometry args={[0.15, 16, 12]} />} cor={cabelo} position={[0, 0.4, -0.2]} />}
      {mechas}{brincos}
    </>
  ) : mulher ? (
    <>
      <Peca geo={<sphereGeometry args={[R + 0.035, 24, 12, 0, VOLTA, 0, 1.15]} />} cor={cabelo} position={[0, 0.02, -0.02]} />
      {/* coque no alto, atrás, depois dos 65; antes, as mechas */}
      {coque && <Peca geo={<sphereGeometry args={[0.15, 16, 12]} />} cor={cabelo} position={[0, 0.4, -0.18]} />}
      {mechas}{brincos}
    </>
  ) : (
    <>
      {/* depois dos 65 o cabelo recua; antes, uma franja que muda com a pessoa */}
      <Peca geo={<sphereGeometry args={[R + 0.03, 24, 12, 0, VOLTA, 0, idade != null && idade >= 65 ? 0.95 : 1.12]} />} cor={cabelo}
        position={[0, 0.02, idade != null && idade >= 65 ? -0.07 : -0.03]} rotation={[idade != null && idade >= 65 ? -0.25 : -0.12, 0, 0]} />
      {(idade == null || idade < 65) && estilo !== 2 && (
        <Peca geo={<sphereGeometry args={[0.2, 16, 10]} />} cor={cabelo} position={[estilo === 1 ? 0.12 : 0, 0.33, 0.2]} scale={[1.3, 0.55, 0.8]} rotation={[0.5, 0, estilo === 1 ? -0.3 : 0]} />
      )}
      {[-1, 1].map((s) => <Peca key={s} geo={<capsuleGeometry args={[0.05, 0.1, 4, 8]} />} cor={cabelo} position={[s * 0.41, 0.0, 0.0]} />)}
    </>
  )

  /* ---------- chapéus (desenhados para uma cabeça de raio 0,27 e aumentados) ---------- */
  const chapeus: Record<Visual['chapeu'], ReactNode> = {
    nenhum: null,
    cartola: <group position={[0, 0.2, 0]}>
      <Peca geo={<cylinderGeometry args={[0.38, 0.38, 0.03, 24]} />} cor={TINTA} />
      <Peca geo={<cylinderGeometry args={[0.23, 0.24, 0.38, 20]} />} cor={TINTA} position={[0, 0.2, 0]} />
      <Peca geo={<cylinderGeometry args={[0.245, 0.245, 0.06, 20]} />} cor="#d6382a" position={[0, 0.06, 0]} borda={false} />
    </group>,
    bone: <group position={[0, 0.06, 0]} rotation={[-0.12, 0, 0]}>
      <Peca geo={<sphereGeometry args={[0.3, 20, 10, 0, VOLTA, 0, 1.45]} />} cor={cor} />
      <Peca geo={<cylinderGeometry args={[0.2, 0.2, 0.02, 20, 1, false, Math.PI / 2, Math.PI]} />} cor={cor} position={[0, 0.03, 0.17]} rotation={[0.15, 0, 0]} />
      <Peca geo={<sphereGeometry args={[0.04, 10, 8]} />} cor="#fff" position={[0, 0.3, 0]} />
    </group>,
    coroa: <group position={[0, 0.24, 0]}>
      <Peca geo={<cylinderGeometry args={[0.21, 0.2, 0.13, 20, 1, true]} />} mat={duplo(OURO)} />
      {[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * VOLTA; return <Peca key={i} geo={<coneGeometry args={[0.05, 0.13, 8]} />} cor={OURO} position={[Math.sin(a) * 0.2, 0.12, Math.cos(a) * 0.2]} /> })}
      <Peca geo={<sphereGeometry args={[0.035, 10, 8]} />} cor="#d6382a" position={[0, 0, 0.21]} />
    </group>,
    // a meia-lua levantada na frente, com a estrela no meio
    cangaceiro: <group position={[0, 0.16, 0]}>
      <Peca geo={<sphereGeometry args={[0.29, 20, 10, 0, VOLTA, 0, 1.35]} />} cor="#8b5a2b" />
      <Peca geo={<cylinderGeometry args={[0.42, 0.42, 0.04, 24, 1, false, Math.PI / 2, Math.PI]} />} cor="#6e4520" position={[0, 0.04, 0.12]} rotation={[Math.PI / 2 - 0.08, 0, 0]} />
      <Peca geo={<cylinderGeometry args={[0.1, 0.1, 0.02, 5]} />} cor={OURO} position={[0, 0.2, 0.16]} rotation={[Math.PI / 2 - 0.08, 0, 0]} />
    </group>,
    palha: <group position={[0, 0.2, 0]}>
      <Peca geo={<cylinderGeometry args={[0.48, 0.5, 0.025, 28]} />} cor="#e8c872" />
      <Peca geo={<cylinderGeometry args={[0.18, 0.24, 0.2, 18]} />} cor="#e8c872" position={[0, 0.1, 0]} />
      <Peca geo={<cylinderGeometry args={[0.245, 0.245, 0.05, 18]} />} cor="#d6382a" position={[0, 0.05, 0]} borda={false} />
    </group>,
    // o panamá branco do Lula na campanha de 2026: copa vincada, aba curta caída na frente e a fita preta
    panama: <group position={[0, 0.13, 0.01]} rotation={[0.1, 0, 0]}>
      <Peca geo={<cylinderGeometry args={[0.4, 0.42, 0.022, 28]} />} cor="#f6f3ea" />
      <Peca geo={<cylinderGeometry args={[0.2, 0.245, 0.22, 20]} />} cor="#f6f3ea" position={[0, 0.11, 0]} />
      <Peca geo={<sphereGeometry args={[0.2, 20, 8]} />} cor="#f6f3ea" position={[0, 0.2, 0]} scale={[1, 0.28, 1.1]} />
      {/* o vinco de cima e os dois apertos da frente */}
      <Peca geo={<capsuleGeometry args={[0.022, 0.2, 4, 8]} />} cor="#e2ddd0" position={[0, 0.235, -0.01]} rotation={[Math.PI / 2, 0, 0]} borda={false} />
      {[-1, 1].map((l) => <Peca key={l} geo={<sphereGeometry args={[0.05, 10, 8]} />} cor="#e2ddd0" position={[l * 0.09, 0.16, 0.17]} scale={[0.6, 1.2, 0.5]} borda={false} />)}
      <Peca geo={<cylinderGeometry args={[0.247, 0.247, 0.05, 20]} />} cor={TINTA} position={[0, 0.04, 0]} borda={false} />
    </group>,
    capacete: <group position={[0, 0.06, 0]}>
      <Peca geo={<sphereGeometry args={[0.31, 20, 10, 0, VOLTA, 0, 1.5]} />} cor="#f5c400" />
      <Peca geo={<torusGeometry args={[0.32, 0.03, 8, 28]} />} cor="#f5c400" position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Peca geo={<capsuleGeometry args={[0.035, 0.42, 4, 8]} />} cor="#e0b000" position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>,
    festa: <group position={[0.05, 0.42, 0]} rotation={[0, 0, -0.2]}>
      <Peca geo={<coneGeometry args={[0.14, 0.4, 16]} />} mat={<meshToonMaterial key="festa" map={tex.listras} color="#f5b800" gradientMap={GRADIENTE} />} />
      <Peca geo={<sphereGeometry args={[0.05, 10, 8]} />} cor="#d6382a" position={[0, 0.22, 0]} />
    </group>,
    formatura: <group position={[0, 0.2, 0]} rotation={[-0.08, 0, 0]}>
      <Peca geo={<cylinderGeometry args={[0.24, 0.26, 0.14, 20]} />} cor={TINTA} />
      <Peca geo={<boxGeometry args={[0.6, 0.03, 0.6]} />} cor={TINTA} position={[0, 0.08, 0]} rotation={[0, Math.PI / 4, 0]} />
      <Peca geo={<capsuleGeometry args={[0.012, 0.2, 2, 6]} />} cor={OURO} position={[0.24, -0.02, 0.1]} borda={false} />
    </group>,
  }

  /* ---------- óculos, na altura dos olhos de cada rosto ---------- */
  const [ex, ey, ez] = naCalota(cal, olho.u, olho.v)
  const aro = (s: number, c: string, raio = 0.085, tubo = 0.011) => <mesh key={s} renderOrder={4} position={[s * Math.abs(ex), ey, ez]} rotation={[0, s * 0.18, 0]}><torusGeometry args={[raio, tubo, 8, 28]} /><meshBasicMaterial color={c} /></mesh>
  const lente = (s: number, c: string, o: number, sx = 1, sy = 1) => <mesh key={`l${s}`} renderOrder={3} position={[s * Math.abs(ex), ey, ez - 0.004]} rotation={[0, s * 0.18, 0]} scale={[sx, sy, 1]}><circleGeometry args={[0.083, 24]} />{vidro(c, o)}</mesh>
  const ponte = (c: string) => <mesh position={[0, ey + 0.01, ez + 0.012]}><capsuleGeometry args={[0.008, Math.abs(ex) * 2 - 0.17, 2, 6]} /><meshBasicMaterial color={c} /></mesh>
  const coracao = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(0, -0.07)
    s.bezierCurveTo(-0.11, 0.0, -0.08, 0.09, 0, 0.04); s.bezierCurveTo(0.08, 0.09, 0.11, 0.0, 0, -0.07)
    return s
  }, [])
  const oculos: Record<Visual['oculos'], ReactNode> = {
    nenhum: null,
    leitura: <group>{[-1, 1].map((s) => [aro(s, OURO, 0.08, 0.008), lente(s, '#dff0ff', 0.18)])}{ponte(OURO)}</group>,
    aviador: <group>{[-1, 1].map((s) => [aro(s, OURO, 0.088, 0.009), lente(s, '#3a4a5c', 0.82, 1.05, 0.92)])}{ponte(OURO)}</group>,
    escuros: <group>{[-1, 1].map((s) => [aro(s, TINTA, 0.09, 0.016), lente(s, '#101216', 0.95, 1.08, 0.86)])}{ponte(TINTA)}</group>,
    coracao: <group>{[-1, 1].map((s) => (
      <mesh key={s} renderOrder={3} position={[s * Math.abs(ex), ey, ez]} rotation={[0, s * 0.18, 0]} scale={1.05}><shapeGeometry args={[coracao]} /><meshBasicMaterial color="#ff4f8b" transparent opacity={0.9} /></mesh>
    ))}{ponte('#ff4f8b')}</group>,
  }

  /* ---------- o que vai na mão ---------- */
  const objetos: Record<Visual['mao'], ReactNode> = {
    nada: null,
    bandeira: <group>
      <Peca geo={<cylinderGeometry args={[0.014, 0.014, 0.75, 8]} />} cor="#8b5a2b" position={[0, 0.27, 0]} />
      <mesh position={[fora * 0.2, 0.52, 0]}><planeGeometry args={[0.38, 0.26, 6, 1]} /><meshToonMaterial map={tex.bandeira} gradientMap={GRADIENTE} side={THREE.DoubleSide} /></mesh>
    </group>,
    trofeu: <group position={[0, 0.12, 0]}>
      <Peca geo={<cylinderGeometry args={[0.12, 0.05, 0.17, 18]} />} cor={OURO} position={[0, 0.13, 0]} />
      {[-1, 1].map((s) => <Peca key={s} geo={<torusGeometry args={[0.045, 0.013, 6, 14]} />} cor={OURO} position={[s * 0.13, 0.14, 0]} rotation={[0, 0, Math.PI / 2]} />)}
      <Peca geo={<cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />} cor={OURO} position={[0, 0.02, 0]} />
      <Peca geo={<cylinderGeometry args={[0.07, 0.08, 0.05, 16]} />} cor={TINTA} position={[0, -0.02, 0]} />
    </group>,
    microfone: <group position={[0, 0.1, 0.03]}>
      <Peca geo={<cylinderGeometry args={[0.025, 0.018, 0.2, 10]} />} cor={TINTA} />
      <Peca geo={<sphereGeometry args={[0.055, 14, 10]} />} cor="#9aa1aa" position={[0, 0.13, 0]} />
    </group>,
    constituicao: <group position={[0, 0.11, 0.05]}>
      <Peca geo={<boxGeometry args={[0.2, 0.27, 0.05]} />} cor="#1d4fa0" />
      <mesh position={[0, 0.04, 0.026]}><planeGeometry args={[0.12, 0.05]} /><meshBasicMaterial color={OURO} /></mesh>
    </group>,
    plaquinha: <group>
      <Peca geo={<cylinderGeometry args={[0.015, 0.015, 0.62, 8]} />} cor="#8b5a2b" position={[0, 0.26, 0]} />
      <Peca geo={<boxGeometry args={[0.48, 0.25, 0.02]} />} cor={cor} position={[0, 0.6, 0.01]} />
      <mesh position={[0, 0.6, 0.022]}><planeGeometry args={[0.44, 0.22]} /><meshBasicMaterial map={tex.placa} transparent /></mesh>
    </group>,
    megafone: <group position={[0, 0.08, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
      <Peca geo={<cylinderGeometry args={[0.12, 0.035, 0.27, 16, 1, true]} />} mat={duplo('#f2f2ee')} position={[0, 0.1, 0]} />
      <Peca geo={<cylinderGeometry args={[0.035, 0.035, 0.08, 10]} />} cor="#d6382a" position={[0, -0.05, 0]} />
    </group>,
    balao: <group>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.004, 0.004, 0.9, 4]} /><meshBasicMaterial color={TINTA} /></mesh>
      <Peca geo={<sphereGeometry args={[0.19, 20, 14]} />} cor={cor} position={[0, 1.0, 0]} scale={[1, 1.15, 1]} />
      <Peca geo={<coneGeometry args={[0.035, 0.05, 8]} />} cor={cor} position={[0, 0.79, 0]} rotation={[Math.PI, 0, 0]} />
    </group>,
  }

  return (
    <group rotation={[0, virado, 0]}>
      {/* sombra e pedestal com o partido (não pulam nem giram com o corpo) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}><circleGeometry args={[0.66, 32]} /><meshBasicMaterial color="#000" transparent opacity={0.12} /></mesh>
      <Peca geo={<cylinderGeometry args={[0.54, 0.58, 0.18, 36]} />} cor="#ffffff" position={[0, 0.09, 0]} />
      {tex.partido && <mesh position={[0, 0.09, 0.585]}><planeGeometry args={[0.8, 0.175]} /><meshBasicMaterial map={tex.partido} transparent /></mesh>}

      <group ref={raiz}>
        {/* pés e pernas; ela de saia */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (mulher ? 0.1 : 0.11), 0, 0]}>
            <Peca geo={<sphereGeometry args={[0.1, 16, 10]} />} cor={astronauta ? '#c9ced6' : TINTA} position={[0, 0.235, 0.04]} scale={mulher ? [0.78, 0.55, 1.3] : [1, 0.62, 1.45]} />
            <Peca geo={<capsuleGeometry args={[mulher ? 0.055 : 0.075, 0.18, 4, 12]} />} mat={mulher && !astronauta && visual.roupa !== 'presidiario' ? toon(pele) : calca} position={[0, 0.4, 0]} />
          </group>
        ))}

        {/* do quadril para cima: curva um pouco com a idade */}
        <group ref={tronco} position={[0, 0.5, 0]} rotation={[curvado, 0, 0]}>
          {mulher ? <>
            <Peca geo={<primitive object={VESTIDO} attach="geometry" />} mat={roupa} />
            {/* o cinto marca a cintura */}
            <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.168, 0.02, 6, 28]} />{toon(visual.roupa === 'padrao' ? TINTA : '#ffffff')}</mesh>
          </> : <Peca geo={<capsuleGeometry args={[0.245, 0.08, 8, 20]} />} mat={roupa} position={[0, 0.27, 0]} />}
          {/* gola, camisa e gravata ou broche */}
          {(visual.roupa === 'terno' || visual.roupa === 'selecao') && <Peca geo={<coneGeometry args={[0.1, 0.08, 3]} />} cor={visual.roupa === 'selecao' ? '#009c3b' : '#ffffff'} position={[0, 0.47, 0.17]} rotation={[-0.6, 0, Math.PI]} borda={false} />}
          {visual.roupa === 'super' && <>
            <Peca geo={<cylinderGeometry args={[0.3, 0.42, 0.62, 20, 1, true, Math.PI * 0.7, Math.PI * 0.6]} />} mat={duplo('#f5b800')} position={[0, 0.2, 0]} />
            <mesh position={[0, 0.3, 0.25]}><circleGeometry args={[0.1, 24]} /><meshBasicMaterial map={tex.heroi} transparent /></mesh>
          </>}
          {astronauta && <Peca geo={<boxGeometry args={[0.38, 0.4, 0.15]} />} cor="#d5dae1" position={[0, 0.28, -0.28]} />}
          {faixa ? (
            // a faixa atravessa o peito, do ombro ao quadril, como as de verdade
            <group rotation={[0, 0, -0.75 * fora]} position={[0, mulher ? 0.32 : 0.27, 0]}>
              <Peca geo={<torusGeometry args={[mulher ? 0.215 : 0.258, 0.035, 8, 36]} />} cor={faixa[0]} rotation={[Math.PI / 2, 0, 0]} />
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><torusGeometry args={[mulher ? 0.219 : 0.262, 0.01, 4, 36]} />{toon(faixa[1])}</mesh>
            </group>
          ) : visual.roupa === 'terno' || (!mulher && visual.roupa === 'padrao') ? (
            <Peca geo={<coneGeometry args={[0.045, 0.24, 4]} />} cor={visual.roupa === 'terno' ? '#b3261e' : TINTA} position={[0, 0.3, 0.245]} rotation={[Math.PI + 0.1, Math.PI / 4, 0]} borda={false} />
          ) : mulher && visual.roupa === 'padrao' ? (
            <group position={[0, 0.5, 0]}>{Array.from({ length: 11 }, (_, k) => { const a = Math.PI * (0.15 + (k / 10) * 0.7); return (
              <mesh key={k} position={[Math.cos(a) * 0.15, -Math.sin(a) * 0.05, Math.sin(a) * 0.14]}><sphereGeometry args={[0.022, 8, 6]} />{toon('#fbf7ee')}</mesh>) })}</group>
          ) : null}
          {tex.numero && visual.roupa !== 'super' && <mesh position={mulher ? [-fora * 0.09, 0.33, 0.215] : [-fora * 0.1, 0.2, 0.243]} rotation={[0.05, -fora * 0.35, 0]}><circleGeometry args={[0.08, 24]} /><meshBasicMaterial map={tex.numero} transparent /></mesh>}

          {/* braços: o de fora sobe quando venceu e segura o que estiver na mão */}
          {[-1, 1].map((s, i) => (
            <group key={s} ref={bracos[i]} position={[s * (mulher ? 0.24 : 0.27), 0.46, 0]} rotation={[0, 0, s * 0.15]}>
              <Peca geo={<capsuleGeometry args={[mulher ? 0.056 : 0.068, 0.2, 4, 12]} />} mat={roupa} position={[0, -0.17, 0]} />
              <Peca geo={<sphereGeometry args={[0.078, 14, 10]} />} cor={astronauta ? '#c9ced6' : pele} position={[0, -0.36, 0]} />
              {s === fora && <group position={[0, -0.36, 0]}><group ref={naMao} scale={1.05}>{objetos[visual.mao]}</group></group>}
            </group>
          ))}

          {/* a cabeça */}
          <group ref={cabeca} position={[0, 0.94, 0]}>
            <Peca geo={<sphereGeometry args={[R, 32, 24]} />} cor={pele} />
            {[-1, 1].map((s) => <Peca key={s} geo={<sphereGeometry args={[0.07, 12, 10]} />} cor={pele} position={[s * 0.42, -0.02, 0.02]} scale={[0.6, 1, 0.9]} />)}
            <mesh renderOrder={2}>
              <sphereGeometry key={comFoto ? 'foto' : 'desenho'} args={[cal.r, 32, 24, cal.phi0, cal.phiL, cal.th0, cal.thL]} />
              <meshToonMaterial key={comFoto ? 'foto' : 'desenho'} map={comFoto ? daFoto!.tex : desenho} gradientMap={GRADIENTE} transparent depthWrite={false} />
            </mesh>
            {cabeloPeca}
            {oculos[visual.oculos]}
            {visual.bigode && (() => { const [, by, bz] = naCalota(cal, 0.5, BOCA_V[comFoto ? 'foto' : 'desenho'] + 0.08); return (
              <group position={[0, by, bz]}>{[-1, 1].map((s) => <Peca key={s} geo={<capsuleGeometry args={[0.035, 0.09, 4, 8]} />} cor={idade != null && idade >= 60 ? cabelo : '#3a2a1e'} position={[s * 0.06, 0, 0]} rotation={[0, 0, s * 1.25]} />)}</group>
            ) })()}
            {astronauta ? <>
              <mesh renderOrder={3}><sphereGeometry args={[0.62, 32, 24]} />{vidro('#cfe3ff', 0.22)}</mesh>
              <Peca geo={<torusGeometry args={[0.3, 0.06, 10, 28]} />} cor="#c9ced6" position={[0, -0.44, 0]} rotation={[Math.PI / 2, 0, 0]} />
            </> : <group scale={1.55} position={[0, 0.02, 0]}>{chapeus[visual.chapeu]}</group>}
          </group>
        </group>
      </group>

      {/* a chuva de votos: papeizinhos que caem em volta enquanto anima */}
      {visual.chuva && <group ref={chuva}>
        {Array.from({ length: 20 }, (_, i) => {
          const a = i * 2.4, r = 0.55 + (i % 4) * 0.12
          return <mesh key={i} position={[Math.sin(a) * r, 2.9 - ((i * 0.37) % 2.9), Math.cos(a) * r * 0.6]} rotation={[i, i * 2, 0]}>
            <planeGeometry args={[0.12, 0.08]} /><meshBasicMaterial color={i % 3 ? '#ffffff' : i % 2 ? '#f5b800' : cor} side={THREE.DoubleSide} />
          </mesh>
        })}
      </group>}
    </group>
  )
}

/** Ocupa o tamanho da caixa em que está (uma só tela 3D por bonequinho). */
export default function Bonequinho3D({ p, cor, lado, visual, className = '', perto = false }: { p: Politico; cor: string; lado: 'a' | 'b'; visual: Visual; className?: string; perto?: boolean }) {
  const [ativo, setAtivo] = useState(false)
  const calmo = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className={className} onPointerEnter={() => !calmo && setAtivo(true)} onPointerLeave={() => setAtivo(false)}>
      <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ position: [0, 1.4, perto ? 6.2 : 6.4], fov: 26 }} onCreated={({ camera }) => camera.lookAt(0, 1.28, 0)} gl={{ antialias: true, alpha: true }}
        aria-label={`Bonequinho de ${p.nome}`}>
        <hemisphereLight args={['#ffffff', '#c9d3e6', 1.6]} />
        <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
        {/* a cor escolhida no armário pinta o boneco; sem ela, a cor do lado */}
        <Boneco p={p} cor={visual.cor ?? cor} lado={lado} ativo={ativo} visual={visual} />
      </Canvas>
    </div>
  )
}
