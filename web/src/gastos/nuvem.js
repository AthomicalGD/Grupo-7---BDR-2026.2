// P9: a chuva de santinhos dos gastos de uma candidatura (a nuvem de palavras do Voto Aberto).
// Cada tipo de gasto (a classificação de scripts/09_nuvem_despesas.py) vira um santinho tipográfico. A área é
// proporcional ao valor contratado, a cor segue a escala da bandeira (amarelo = pouco, azul fechado = muito) e o
// número em casas, como no visor da urna, é o valor. Os de propaganda levam o carimbo. "Jogar os santinhos" faz
// eles caírem balançando, como papel; tocar num santinho bate o bafo, ele vira, e as mãos o pegam para ler a cola.
// Só desenha quando algo se mexe (frameloop sob demanda), e tudo é desfeito em destroi().
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as clonaEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { audio as abreSom, preparaAudio } from '../lib/audio'
import { desisteDe, quandoParado } from '../lib/parado'

/* ---------- tokens (DESIGN.md do Voto Aberto) ---------- */
const TINTA = '#18202b', FOLHA = '#fcfdfd', CARIMBO = '#3f5419'
const FITAS = ['#5E881B', '#A2BD31', '#5D6B94', '#468BAF', '#76ACD0', '#F19929', '#FBC700']
// a escala da bandeira (escolaridade.ts): do amarelo ao verde e ao azul, a luz sempre caindo
export const BANDEIRA = ['#f9e99a', '#e4d948', '#a3cc4d', '#52b766', '#029e72', '#00808d', '#0d5c91', '#1c3e81']
const FONTE = '"Archivo Variable", Archivo, system-ui, sans-serif'
const MONO = '"Red Hat Mono Variable", "Red Hat Mono", ui-monospace, monospace'

/* ---------- números ---------- */
const nf = (casas) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const NF0 = nf(0), NF1 = nf(1), NF2 = nf(2)
export const reaisExato = (v) => `R$ ${NF2.format(v)}`
/** O valor nas casas da urna: até 3 algarismos e a unidade ("965" mil reais, "1,2" milhão). */
export function casasDoValor(v) {
  if (v >= 1e9) { const x = v / 1e9; return { digitos: x < 10 ? NF1.format(x) : NF0.format(x), unidade: x < 2 ? 'BILHÃO' : 'BILHÕES', curta: 'bi' } }
  if (v >= 1e6) { const x = v / 1e6; return { digitos: x < 10 ? NF1.format(x) : NF0.format(x), unidade: x < 2 ? 'MILHÃO' : 'MILHÕES', curta: 'mi' } }
  if (v >= 1e3) return { digitos: NF0.format(Math.round(v / 1e3)), unidade: 'MIL REAIS', curta: 'mil' }
  return { digitos: NF0.format(Math.round(v)), unidade: 'REAIS', curta: '' }
}
export const reaisCurto = (v) => { const c = casasDoValor(v); return `R$ ${c.digitos}${c.curta ? ' ' + c.curta : ''}` }

/* ---------- tamanhos e cores ---------- */
const RAZAO = 1.43           // o santinho 10 × 7 cm, deitado
const L_MAX = 4.4            // largura do maior, em unidades da cena
const L_PISO = 1.8           // o menor ainda legível (o nome de urna miúdo precisa de ~1,8)
export const MAX_SANTINHOS = 40
function tomDe(v, min, max) {
  if (max === min) return 6
  // em reais a diferença entre o maior e o menor é enorme: a escala de cor segue a raiz, como a área
  return 1 + Math.round(7 * (Math.sqrt(v) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min)))
}
/** itens: [{ palavra, n (valor), ...extra }], já do maior para o menor. */
export function dimensiona(itens) {
  const lista = itens.slice(0, MAX_SANTINHOS)
  if (!lista.length) return { lista: [], comPiso: false }
  const max = lista[0].n, min = lista[lista.length - 1].n
  let comPiso = false
  return {
    lista: lista.map((w, i) => {
      // área proporcional ao valor: largura = L_MAX · √(v / máx), com um piso legível
      let L = L_MAX * Math.sqrt(w.n / max)
      if (L < L_PISO) { L = L_PISO; comPiso = true }
      const tom = tomDe(w.n, min, max)
      return { ...w, rank: i + 1, L, A: L / RAZAO, tom, cor: BANDEIRA[tom - 1], tinta: tom <= 4 ? TINTA : FOLHA }
    }),
    get comPiso() { return comPiso },
  }
}

/* ---------- arranjo da nuvem: espiral, maiores no meio, nenhum cobre o outro ---------- */
function arranja(itens, alongamento) {
  const postos = []
  const cantos = (p) => {
    const c = Math.cos(p.ang), s = Math.sin(p.ang), hx = p.L / 2, hz = p.A / 2
    return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => [p.x + x * c - z * s, p.z + x * s + z * c])
  }
  const eixos = (cs) => [[cs[1][0] - cs[0][0], cs[1][1] - cs[0][1]], [cs[3][0] - cs[0][0], cs[3][1] - cs[0][1]]]
  const bate = (a, b) => {
    for (const e of [...eixos(a), ...eixos(b)]) {
      const pa = a.map(([x, z]) => x * e[0] + z * e[1]), pb = b.map(([x, z]) => x * e[0] + z * e[1])
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false
    }
    return true
  }
  const folga = 0.14
  for (const it of itens) {
    // jogado no chão: um pouco girado, os grandes menos que os pequenos
    const ang = (Math.random() - 0.5) * THREE.MathUtils.degToRad(it.L > 3 ? 10 : 22)
    const p = { ...it, ang, x: 0, z: 0 }
    const caixa = { ...p, L: p.L + folga, A: p.A + folga }
    // teste rápido por raio antes do exato (eixos separadores): quase todos os vizinhos estão longe
    const raio = Math.hypot(caixa.L, caixa.A) / 2
    let t = Math.random() * 6
    for (let k = 0; k < 6000; k++, t += 0.12) {
      const r = 0.16 * t
      caixa.x = Math.cos(t) * r * alongamento; caixa.z = Math.sin(t) * r
      let livre = true, cs = null
      for (const q of postos) {
        const dx = caixa.x - q.x, dz = caixa.z - q.z, soma = raio + q.raio
        if (dx * dx + dz * dz >= soma * soma) continue
        if (bate(cs || (cs = cantos(caixa)), q.cs)) { livre = false; break }
      }
      if (livre) break
    }
    p.x = caixa.x; p.z = caixa.z
    postos.push({ ...p, cs: cantos(caixa), raio })
  }
  if (!postos.length) return { postos, limites: { x0: -6, x1: 6, z0: -4, z1: 4 } }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const p of postos) for (const [x, z] of p.cs) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
  postos.forEach(p => { p.x -= cx; p.z -= cz })
  return { postos, limites: { x0: x0 - cx, x1: x1 - cx, z0: z0 - cz, z1: z1 - cz } }
}

/* ---------- desenho do santinho (frente e verso), num quadro de 400 × 280 ---------- */
const DW = 400, DH = 280
let reticula = null
function retangulo(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
function clareia(hex, k) { return '#' + new THREE.Color(hex).lerp(new THREE.Color(k > 0 ? 0xffffff : 0x000000), Math.abs(k)).getHexString() }
function fonte(g, peso, px, largura, familia = FONTE) { g.font = `${peso} ${px}px ${familia}`; try { g.fontStretch = largura } catch { /* navegador sem fontStretch */ } }
const LARGURAS = ['normal', 'semi-condensed', 'condensed', 'extra-condensed', 'ultra-condensed']
// A largura do texto cresce em linha com o tamanho da fonte: basta medir uma vez a 100 px em cada largura
// (5 medidas, não ~130 por rótulo), e o maior tamanho que cabe sai da proporção.
function cabe(g, texto, maxW, inicio, piso, peso = 860) {
  const limite = LARGURAS.map((w) => { fonte(g, peso, 100, w); return (maxW * 100) / g.measureText(texto).width })
  const px = Math.min(inicio, inicio - Math.ceil((inicio - Math.max(...limite)) / 2) * 2)
  if (px < piso) return null
  return { px, w: LARGURAS[limite.findIndex((l) => l >= px)] }
}
// o nome do tipo, como o nome de urna: numa linha, ou em duas quando é comprido ("Encargos financeiros, taxas...")
function escreveNome(g, nome, x, yBase, maxW, inicio, piso) {
  const uma = cabe(g, nome, maxW, inicio, piso)
  if (uma) { fonte(g, 860, uma.px, uma.w); g.letterSpacing = `${-uma.px * 0.01}px`; g.fillText(nome, x, yBase); g.letterSpacing = '0px'; return uma.px }
  const palavras = nome.split(' ')
  let melhor = null
  for (let i = 1; i < palavras.length; i++) {
    const a = palavras.slice(0, i).join(' '), b = palavras.slice(i).join(' ')
    const f = Math.min(...[a, b].map(t => (cabe(g, t, maxW, Math.round(inicio * 0.62), 12) || { px: 12 }).px))
    if (!melhor || f > melhor.px) melhor = { a, b, px: f }
  }
  const f2 = cabe(g, melhor.a.length > melhor.b.length ? melhor.a : melhor.b, maxW, melhor.px, 12) || { px: 12, w: 'ultra-condensed' }
  fonte(g, 860, f2.px, f2.w)
  g.fillText(melhor.a, x, yBase - f2.px * 0.98); g.fillText(melhor.b, x, yBase)
  return f2.px
}
// as casas da urna com o valor; a vírgula fica entre as casas, como no visor
function casas(g, digitos, x, y, cw, ch, gap, px, frente) {
  for (const d of digitos) {
    if (d === ',' || d === '.') {
      g.fillStyle = frente ? FOLHA : TINTA; fonte(g, 900, px * 0.8, 'condensed'); g.textAlign = 'center'
      if (frente) { g.save(); g.shadowColor = 'rgba(24,32,43,0.35)'; g.shadowBlur = 3 }
      g.fillText(d, x + 5, y + ch - 4); if (frente) g.restore()
      x += 12; continue
    }
    if (frente) {
      g.save(); g.shadowColor = 'rgba(24,32,43,0.22)'; g.shadowBlur = 6; g.shadowOffsetY = 2
      retangulo(g, x, y, cw, ch, 5); g.fillStyle = FOLHA; g.fill(); g.restore()
      g.fillStyle = 'rgba(24,32,43,0.13)'; g.fillRect(x + 3, y + ch - 4, cw - 6, 3)
    } else {
      retangulo(g, x, y, cw, ch, 6); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(24,32,43,0.75)'; g.stroke()
    }
    g.fillStyle = TINTA; fonte(g, 880, px, 'condensed'); g.textAlign = 'center'; g.fillText(d, x + cw / 2, y + ch * 0.81)
    x += cw + gap
  }
  g.textAlign = 'left'
  return x
}
function carimbo(g, x, y, escala = 1) {
  g.save(); g.translate(x, y); g.rotate(-8 * Math.PI / 180); g.scale(escala, escala)
  fonte(g, 900, 15, 'semi-condensed'); g.letterSpacing = '1.5px'
  const w = g.measureText('PROPAGANDA').width + 20
  retangulo(g, -w / 2, -14, w, 28, 4); g.fillStyle = 'rgba(238,243,223,0.94)'; g.fill()
  g.lineWidth = 2.6; g.strokeStyle = CARIMBO; g.stroke()
  g.fillStyle = CARIMBO; g.textAlign = 'center'; g.fillText('PROPAGANDA', 0, 6); g.letterSpacing = '0px'
  g.restore(); g.textAlign = 'left'
}

/* ---------- o santinho na cena: uma folha de papel que verga ---------- */
const DEFORMA = `
  float nx = position.x * 2.0, ny = position.y * 2.0;
  float zf = uDobra * nx * nx;
  zf += uOnda * sin(nx * 2.7 + uFase) * (0.45 + 0.55 * abs(nx));
  zf += uOnda * 0.5 * sin(ny * 2.2 - uFase * 0.7);
  zf += uTorce * nx * ny;
  float cc = max(0.0, (nx * uCantoDir.x + ny * uCantoDir.y) * 0.5 - 0.42) / 0.58;
  zf += uCanto * cc * cc;
  transformed.z += zf * uLado;
`
const UNIFORMES = 'uniform float uDobra, uOnda, uFase, uTorce, uCanto, uLado; uniform vec2 uCantoDir;\n'
const ease = {
  saida: (u) => 1 - Math.pow(1 - u, 3), entrada: (u) => u * u * u,
  meio: (u) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
  // passa um pouco do ponto e volta: o peso do braço ao parar
  volta: (u) => { const c = 1.4; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2) },
}
const mistura = (a, b, u) => a + (b - a) * u
const limita = (u) => Math.max(0, Math.min(1, u))
const suave01 = (u) => { const x = limita(u); return x * x * (3 - 2 * x) }

/**
 * Monta a cena no palco. aoMudar recebe { total, noChao, sob, fase, lida } a cada mudança visível.
 */
export function criaNuvem({ palco, canvas, dica, aoMudar = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  // Desempenho: 1,5 de densidade no máximo (acima disso o custo cresce com o quadrado e o papel não ganha
  // nitidez visível); papel fosco em MeshLambertMaterial, sem mapa de ambiente PMREM (o Standard custava
  // muito mais por pixel e gerar o ambiente travava a abertura); e o mapa de sombra só é refeito quando um
  // santinho ou uma mão se mexe: o balanço da câmera com o mouse não muda a sombra.
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(DPR)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.toneMapping = THREE.NeutralToneMapping
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd6e2, 1.55))
  const sol = new THREE.DirectionalLight(0xffffff, 1.35)
  sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024)
  sol.shadow.bias = -0.0003; sol.shadow.normalBias = 0.01; sol.shadow.radius = 6
  scene.add(sol, sol.target)
  const ANISO = renderer.capabilities.getMaxAnisotropy()
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)')
  const descartaveis = []
  let sombraSuja = true

  /* ---------- o chão: piso quase branco com borda em ardósia ---------- */
  let piso = null
  function montaPiso(b) {
    if (piso) { scene.remove(piso); piso.traverse(o => { o.geometry?.dispose(); o.material?.dispose() }) }
    piso = new THREE.Group()
    const m = 0.6, w = b.x1 - b.x0 + 2 * m, d = b.z1 - b.z0 + 2 * m, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2
    const forma = (W, D, r) => {
      const s = new THREE.Shape(); const x = -W / 2, y = -D / 2
      s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.quadraticCurveTo(x + W, y, x + W, y + r); s.lineTo(x + W, y + D - r)
      s.quadraticCurveTo(x + W, y + D, x + W - r, y + D); s.lineTo(x + r, y + D); s.quadraticCurveTo(x, y + D, x, y + D - r)
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s
    }
    const laje = (W, D, r, alt, cor, y) => {
      const g = new THREE.ExtrudeGeometry(forma(W, D, r), { depth: alt, bevelEnabled: false, curveSegments: 10 })
      g.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: cor }))
      mesh.position.set(cx, y, cz); mesh.receiveShadow = true; piso.add(mesh)
    }
    laje(w + 0.5, d + 0.5, 1.0, 0.3, 0xc3cce0, -0.42)
    laje(w, d, 0.8, 0.3, 0xf3f5f7, -0.3)
    scene.add(piso)
  }

  /* ---------- estado ---------- */
  let palavras = [], totalTipos = 0, total = 0, comPiso = false, limites = { x0: -6, x1: 6, z0: -4, z1: 4 }
  const santinhos = []
  let pousados = 0, sob = null, filtro = null
  const pctTexto = (v) => { const p = total ? 100 * v / total : 0; return `${p.toLocaleString('pt-BR', { maximumFractionDigits: p < 10 ? 1 : 0 })}%` }

  /* ---------- texturas ---------- */
  function texturaFrente(p) {
    // o dobro dos pixels que o santinho ocupa na tela: o chão é visto de lado, e o texto miúdo só fica nítido
    // com sobra para o filtro anisotrópico (com 1,3 o nome borrava); nunca menos que 1,2 nem mais que 2,6
    const S = Math.min(2.6, Math.max(1.2, (p.L * pxPorUnidade * 2.4) / DW))
    const cv = document.createElement('canvas'); cv.width = DW * S; cv.height = DH * S
    const g = cv.getContext('2d'); g.scale(S, S)
    retangulo(g, 0, 0, DW, DH, 12); g.clip()
    // fundo de gráfica: o tom da escala em degradê, a retícula de meio-tom e o brilho do papel
    const fundo = g.createLinearGradient(0, 0, DW * 0.35, DH * 1.1)
    fundo.addColorStop(0, clareia(p.cor, 0.14)); fundo.addColorStop(1, clareia(p.cor, -0.1))
    g.fillStyle = fundo; g.fillRect(0, 0, DW, DH)
    if (!reticula) {
      reticula = document.createElement('canvas'); reticula.width = reticula.height = 5; const r = reticula.getContext('2d')
      r.fillStyle = 'rgba(255,255,255,0.15)'; r.beginPath(); r.arc(2.5, 2.5, 0.95, 0, Math.PI * 2); r.fill()
    }
    g.fillStyle = g.createPattern(reticula, 'repeat'); g.fillRect(0, 0, DW, DH)
    const brilho = g.createLinearGradient(0, 0, DW * 0.5, DH); brilho.addColorStop(0, 'rgba(255,255,255,0.18)'); brilho.addColorStop(0.42, 'rgba(255,255,255,0)')
    g.fillStyle = brilho; g.fillRect(0, 0, DW, DH)
    // a inicial enorme, na própria cor
    g.save(); g.globalAlpha = 0.16; g.fillStyle = p.tinta; fonte(g, 900, 330, 'ultra-condensed')
    g.textAlign = 'right'; g.fillText(p.palavra[0].toUpperCase(), DW + 8, DH + 52); g.restore()
    // as sete fitas em onda, descendo da esquerda para a direita, como a faixa dos santinhos
    g.lineWidth = 6.2
    FITAS.forEach((c, i) => {
      g.strokeStyle = c; g.beginPath()
      for (let x = -8; x <= DW + 8; x += 6) {
        const y = 128 + i * 5.6 + 16 * (x / DW) + Math.sin((x / 190) * 2 * Math.PI + 0.6) * 4.5
        if (x === -8) g.moveTo(x, y); else g.lineTo(x, y)
      }
      g.stroke()
    })
    g.fillStyle = p.tinta; g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    // a linha miúda do cargo vira a posição do gasto
    fonte(g, 700, 13, 'normal'); g.letterSpacing = '2px'
    g.fillText(`${p.rank}º MAIOR GASTO`, 22, 32)
    g.letterSpacing = '0px'
    if (p.propaganda) carimbo(g, DW - 78, 30)
    escreveNome(g, p.palavra.toLocaleUpperCase('pt-BR'), 20, 114, DW - 44, 82, 30)
    // o valor em casas, como na tela da urna
    const c = casasDoValor(p.n)
    const x = casas(g, c.digitos, 22, 184, 40, 58, 6, 48, true)
    g.fillStyle = p.tinta; fonte(g, 800, 14, 'normal'); g.letterSpacing = '1.4px'
    const [u1, u2] = c.unidade.split(' ')
    if (u2) { g.fillText(u1, x + 4, 184 + 58 - 22); g.fillText(u2, x + 4, 184 + 58 - 5) } else g.fillText(u1, x + 4, 184 + 58 - 6)
    g.letterSpacing = '0px'
    // a pílula branca com a bolinha: a parte do gasto total
    const rotulo = `${pctTexto(p.n)} do gasto`
    fonte(g, 800, 14, 'semi-condensed')
    const pw = g.measureText(rotulo).width + 34, px0 = DW - 20 - pw, py0 = 216
    retangulo(g, px0, py0, pw, 26, 13); g.fillStyle = FOLHA; g.fill()
    g.fillStyle = p.cor; g.beginPath(); g.arc(px0 + 14, py0 + 13, 5, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(24,32,43,0.25)'; g.lineWidth = 1; g.stroke()
    g.fillStyle = TINTA; g.fillText(rotulo, px0 + 25, py0 + 18)
    // a letra miúda no lugar do CNPJ da gráfica
    g.fillStyle = p.tinta; g.globalAlpha = 0.78; fonte(g, 500, 9.5, 'normal')
    g.fillText('Prestação de contas ao TSE · não é material de campanha', 22, DH - 12); g.globalAlpha = 1
    // os tons claros levam contorno de tinta, para não sumirem no chão claro
    retangulo(g, 0.75, 0.75, DW - 1.5, DH - 1.5, 11.5); g.lineWidth = 1.5; g.strokeStyle = p.tom <= 2 ? 'rgba(24,32,43,0.24)' : 'rgba(24,32,43,0.1)'; g.stroke()
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t
  }
  // o verso é a cola do gasto, para ler de longe: o tipo, o valor nas casas, a parte do total em número
  // grande, a posição numa frase e quem recebeu mais
  function texturaVerso(p) {
    // a cola na mão ocupa ~55% da largura do palco (65% no celular)
    const S = Math.min(2.6, Math.max(1.2, (0.66 * palco.clientWidth * DPR) / DW))
    const cv = document.createElement('canvas'); cv.width = DW * S; cv.height = DH * S
    const g = cv.getContext('2d'); g.scale(S, S)
    retangulo(g, 0, 0, DW, DH, 12); g.clip()
    g.fillStyle = FOLHA; g.fillRect(0, 0, DW, DH)
    FITAS.forEach((c, i) => { g.fillStyle = c; g.fillRect((DW / 7) * i, 0, DW / 7 + 1, 9) })
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    g.fillStyle = '#5f6878'; fonte(g, 600, 14, 'normal', MONO); g.letterSpacing = '2.4px'
    g.fillText('COLA DO GASTO', 22, 36); g.letterSpacing = '0px'
    if (p.propaganda) carimbo(g, DW - 74, 32, 0.9)
    g.fillStyle = TINTA; escreveNome(g, p.palavra.toLocaleUpperCase('pt-BR'), 20, 88, DW - 44, 54, 26)
    const c = casasDoValor(p.n); const y = 102
    const x = casas(g, c.digitos, 22, y, 46, 64, 6, 52, false)
    fonte(g, 800, 15, 'normal'); g.fillStyle = TINTA
    const [u1, u2] = c.unidade.split(' ')
    if (u2) { g.fillText(u1.toLowerCase(), x + 4, y + 64 - 24); g.fillText(u2.toLowerCase(), x + 4, y + 64 - 6) } else g.fillText(u1.toLowerCase(), x + 4, y + 64 - 8)
    // a parte do gasto, em número grande, à direita
    g.textAlign = 'right'
    fonte(g, 860, 44, 'condensed'); g.fillText(pctTexto(p.n), DW - 22, y + 42)
    fonte(g, 600, 15, 'normal'); g.fillStyle = '#4b5566'; g.fillText('do gasto', DW - 22, y + 62)
    g.textAlign = 'left'
    g.setLineDash([4, 4]); g.strokeStyle = '#aeb6bf'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(22, 184); g.lineTo(DW - 22, 184); g.stroke(); g.setLineDash([])
    fonte(g, 700, 17, 'normal'); g.fillStyle = TINTA
    g.fillText(`${p.rank}º maior de ${totalTipos} tipos · ${p.quantidade} ${p.quantidade === 1 ? 'despesa' : 'despesas'}`, 22, 208)
    const f = p.fornecedores?.[0]
    if (f) {
      fonte(g, 500, 13, 'normal'); g.fillStyle = '#4b5566'
      let nome = f.nome
      const rot = `Quem mais recebeu (${reaisCurto(f.valor)}): `
      const larg = DW - 44 - g.measureText(rot).width
      fonte(g, 700, 13, 'normal')
      while (nome.length > 4 && g.measureText(nome).width > larg) nome = nome.slice(0, -2).trimEnd() + '…'
      fonte(g, 500, 13, 'normal'); g.fillText(rot, 22, 232)
      fonte(g, 700, 13, 'normal'); g.fillStyle = TINTA; g.fillText(nome, 22 + DW - 44 - larg, 232)
    }
    g.fillStyle = '#5f6878'; fonte(g, 500, 11.5, 'normal')
    g.fillText(`Valor exato: ${reaisExato(p.n)}. Clique fora para devolver.`, 22, DH - 16)
    retangulo(g, 0.75, 0.75, DW - 1.5, DH - 1.5, 11.5); g.lineWidth = 1.5; g.strokeStyle = 'rgba(24,32,43,0.22)'; g.stroke()
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t
  }

  /* ---------- santinhos ---------- */
  const geoFolha = new THREE.PlaneGeometry(1, 1, 20, 14)
  descartaveis.push(geoFolha)
  const branco = new THREE.DataTexture(new Uint8Array([252, 253, 253, 255]), 1, 1); branco.needsUpdate = true; branco.colorSpace = THREE.SRGBColorSpace
  descartaveis.push(branco)
  function criaSantinho(p) {
    const grupo = new THREE.Group()           // posição e giro no chão
    const pivo = new THREE.Group()            // balanço da queda, levantar e virar
    grupo.add(pivo)
    const u = {
      uDobra: { value: 0 }, uOnda: { value: 0 }, uFase: { value: Math.random() * 6 }, uTorce: { value: 0 }, uCanto: { value: 0 }, uLado: { value: 1 },
      uCantoDir: { value: new THREE.Vector2(Math.random() < 0.5 ? -1 : 1, Math.random() < 0.5 ? -1 : 1) }, mapVerso: { value: branco },
    }
    // a frente é desenhada no quadro em que o santinho entra em cena (frente()), não todas de uma vez
    const mat = new THREE.MeshLambertMaterial({ map: branco, side: THREE.DoubleSide, alphaTest: 0.5, flatShading: true })
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u)
      sh.vertexShader = UNIFORMES + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + DEFORMA)
      sh.fragmentShader = 'uniform sampler2D mapVerso;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = gl_FrontFacing ? texture2D( map, vMapUv ) : texture2D( mapVerso, vec2( vMapUv.x, 1.0 - vMapUv.y ) );
          diffuseColor *= sampledDiffuseColor;
        #endif`)
    }
    mat.customProgramCacheKey = () => 'folha'
    const profundidade = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide })
    profundidade.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.vertexShader = UNIFORMES + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + DEFORMA) }
    profundidade.customProgramCacheKey = () => 'folha-sombra'
    const folha = new THREE.Mesh(geoFolha, mat)
    folha.rotation.x = -Math.PI / 2; folha.scale.set(p.L, p.A, 1); folha.castShadow = true; folha.customDepthMaterial = profundidade
    pivo.add(folha)
    grupo.visible = false
    scene.add(grupo)
    const papel = { dobra: (0.012 + Math.random() * 0.02) * p.L, canto: (0.06 + Math.random() * 0.14) * Math.min(1.6, p.A) }
    const s = { ...p, grupo, pivo, folha, u, papel, versoPronto: false, estado: 'fora', virado: 0, viraAlvo: 0, ergue: 0, ergueAlvo: 0 }
    folha.userData.s = s
    return s
  }
  function frente(s) {
    if (s.frentePronta) return
    s.folha.material.map = texturaFrente(s); s.frentePronta = true
  }
  function descarta(s) {
    scene.remove(s.grupo)
    if (s.folha.material.map !== branco) s.folha.material.map.dispose(); if (s.u.mapVerso.value !== branco) s.u.mapVerso.value.dispose()
    s.folha.material.dispose(); s.folha.customDepthMaterial.dispose()
  }
  let dtGlobal = 0.016
  function aplicaPapel(s, a) {
    const k = Math.min(1, dtGlobal * 9), u = s.u
    u.uDobra.value += (a.dobra - u.uDobra.value) * k
    u.uOnda.value += (a.onda - u.uOnda.value) * k
    u.uTorce.value += (a.torce - u.uTorce.value) * k
    u.uCanto.value += (a.canto - u.uCanto.value) * k
    if (a.fase != null) u.uFase.value = a.fase
    // a curva sobe sempre para o céu, de frente ou de costas
    u.uLado.value = Math.cos(s.pivo.rotation.x) >= 0 ? 1 : -1
    return Math.abs(a.dobra - u.uDobra.value) + Math.abs(a.onda - u.uOnda.value) + Math.abs(a.canto - u.uCanto.value) > 0.003
  }

  let ultimoAviso = ''
  function avisa() {
    // durante a chuva cada pouso chamava o React; agora só o que muda o painel
    const chave = [santinhos.some(s => s.estado === 'chao' || s.estado === 'caindo' || s.estado === 'segura' || s.estado === 'bafo'),
      santinhos.length, sob && sob.palavra, segura && segura.fase, !!batida, segura && segura.s.palavra].join('|')
    if (chave === ultimoAviso) return
    ultimoAviso = chave
    aoMudar({ total: santinhos.length, noChao: santinhos.some(s => s.estado === 'chao' || s.estado === 'caindo' || s.estado === 'segura' || s.estado === 'bafo'),
      sob: sob ? sob.palavra : null, fase: segura ? segura.fase : batida ? 'bafo' : 'livre', lida: segura ? segura.s.palavra : null })
  }

  let pxPorUnidade = 60
  // "Jogar de novo": um novo arranjo com os mesmos santinhos; as texturas ficam (antes eram refeitas, ~600 ms)
  function rearranja() {
    soltaTudo()
    const along = Math.max(0.55, Math.min(2.2, (palco.clientWidth / Math.max(1, palco.clientHeight)) * 0.95))
    const arr = arranja(santinhos.map(({ L, A }) => ({ L, A })), along)
    arr.postos.forEach((p, i) => { const s = santinhos[i]; s.x = p.x; s.z = p.z; s.ang = p.ang })
    limites = arr.limites
    montaPiso(limites)
    posicionaSol()
    enquadra()
    sombraSuja = true
  }
  function carrega(itens) {
    const d = dimensiona(itens)
    palavras = d.lista; comPiso = d.comPiso; totalTipos = itens.length
    total = itens.reduce((a, w) => a + w.n, 0)
    soltaTudo()
    santinhos.splice(0).forEach(descarta)
    sob = null
    // a nuvem toma a forma do palco: larga no computador, alta no celular
    const along = Math.max(0.55, Math.min(2.2, (palco.clientWidth / Math.max(1, palco.clientHeight)) * 0.95))
    const arr = arranja(palavras, along)
    limites = arr.limites
    pxPorUnidade = (palco.clientWidth * DPR) / (limites.x1 - limites.x0 + 2.5)
    for (const p of arr.postos) santinhos.push(criaSantinho(p))
    montaPiso(limites)
    posicionaSol()
    enquadra()
    sombraSuja = true
    pousados = 0
    avisa()
    return { comPiso }
  }
  function posicionaSol() {
    const cx = (limites.x0 + limites.x1) / 2, cz = (limites.z0 + limites.z1) / 2, r = Math.max(limites.x1 - limites.x0, limites.z1 - limites.z0) / 2 + 3
    sol.position.set(cx - 6, 24, cz + 10); sol.target.position.set(cx, 0, cz)
    Object.assign(sol.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 70 }); sol.shadow.camera.updateProjectionMatrix()
  }

  /* ---------- a chuva ---------- */
  const passa = (s) => !filtro || filtro(s)
  function joga(soEstes) {
    // os maiores começam a cair primeiro, mas misturados, como um maço jogado para o alto
    const lista = (soEstes || santinhos).filter(passa)
    const ordem = lista.slice().sort((a, b) => (b.L + Math.random() * 1.6) - (a.L + Math.random() * 1.6))
    ordem.forEach((s, i) => {
      s.virado = s.viraAlvo = 0; s.ergue = s.ergueAlvo = 0
      s.estado = 'caindo'; s.grupo.visible = true
      s.atraso = reduzido.matches ? 0 : i * 0.085 + Math.random() * 0.12
      s.duracao = reduzido.matches ? 0.001 : 1.7 + Math.random() * 0.9 + (4.4 - s.L) * 0.1
      s.altura = 9 + Math.random() * 5
      s.deriva = [(Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 2.2]
      s.balanco = { amp: 0.9 + Math.random() * 0.9, freq: 1.2 + Math.random() * 0.8, fase: Math.random() * Math.PI * 2, giro: (Math.random() - 0.5) * 5 }
      s.inicio = relogio + s.atraso; s.pousou = false
    })
    if (!soEstes) pousados = 0
    avisa(); acorda()
  }
  function soltaTudo() {
    agendadas.length = 0
    if (batida) { maos.forEach(m => { m.mao.visible = false }); batida = null }
    if (segura) { const s0 = segura.s; segura = null; maos.forEach(m => { m.mao.visible = false }); s0.estado = 'chao'; s0.viraAlvo = s0.virado = 0 }
  }
  function varre(soEstes) {
    soltaTudo()
    liberaAudio()
    const lista = soEstes || santinhos
    lista.forEach((s, i) => {
      if (!s.grupo.visible) return
      if (s.estado === 'chao' || s.estado === 'caindo') pousados = Math.max(0, pousados - (s.pousou ? 1 : 0))
      s.estado = 'varrendo'; s.inicio = relogio + (reduzido.matches ? 0 : i * 0.02); s.duracao = reduzido.matches ? 0.001 : 0.7
      s.de = s.grupo.position.clone(); s.viraAlvo = 0
    })
    if (!soEstes) pousados = 0
    avisa(); acorda()
  }
  function anima(agora) {
    let mexendo = false
    for (const s of santinhos) {
      const pa = { dobra: s.papel.dobra, onda: 0, torce: 0, canto: s.papel.canto, fase: null }
      if (s.estado === 'caindo') {
        mexendo = true
        const u = (agora - s.inicio) / s.duracao
        if (u < 0) { s.grupo.visible = false; continue }
        frente(s)
        s.grupo.visible = true
        const k = Math.min(1, u)
        // papel caindo: desce quase em velocidade constante e balança, inclinando para o lado do balanço;
        // o balanço morre perto do chão e ele pousa plano
        const resto = 1 - k
        const tempo = agora - s.inicio
        const b = s.balanco, onda = Math.sin(tempo * b.freq * Math.PI * 2 + b.fase), ondaD = Math.cos(tempo * b.freq * Math.PI * 2 + b.fase)
        const amp = b.amp * Math.pow(resto, 1.2)
        const y = s.altura * Math.pow(resto, 1.12) + 0.02
        s.grupo.position.set(s.x + s.deriva[0] * resto * resto + onda * amp, y, s.z + s.deriva[1] * resto * resto)
        s.grupo.rotation.y = -s.ang + b.giro * resto * resto
        s.pivo.rotation.z = ondaD * 0.75 * Math.pow(resto, 0.8)
        s.pivo.rotation.x = Math.sin(tempo * b.freq * Math.PI + b.fase) * 0.35 * resto
        pa.dobra = s.papel.dobra + ondaD * 0.16 * s.L * resto; pa.onda = 0.09 * s.L * resto; pa.fase = tempo * 7 + b.fase; pa.torce = onda * 0.12 * s.L * resto; pa.canto = s.papel.canto * k
        s.pivo.position.y = 0
        if (k >= 1 && !s.pousou) {
          s.pousou = true; s.estado = 'chao'; pousados++
          s.grupo.position.set(s.x, 0.02, s.z); s.grupo.rotation.y = -s.ang; s.pivo.rotation.set(0, 0, 0)
          s.quique = agora; avisa()
        }
      } else if (s.estado === 'varrendo') {
        mexendo = true
        const u = Math.max(0, (agora - s.inicio) / s.duracao), k = Math.min(1, u)
        // o vento leva: sobe um pouco, desliza e some pela borda
        const e = k * k
        s.grupo.position.set(s.de.x + e * 26, s.de.y + Math.sin(k * Math.PI) * 1.6, s.de.z - e * 6)
        s.pivo.rotation.z = -k * 2.2; s.pivo.rotation.x = k * 0.8
        pa.onda = 0.18 * s.L * Math.sin(k * Math.PI); pa.fase = k * 20; pa.dobra = 0.2 * s.L * k
        if (k >= 1) { s.estado = 'fora'; s.grupo.visible = false; s.pivo.rotation.set(0, 0, 0); avisa() }
      } else if (s.estado === 'bafo') {
        // o pulo do bafo: sobe em arco, gira uma volta e meia e cai do outro lado
        mexendo = true
        const f = s.bafo, u = Math.min(1, (agora - f.t0) / f.dur)
        const giro = (f.de + (f.para - f.de) * 3 * ease.meio(u)) * Math.PI
        const alt = f.altura * 4 * u * (1 - u)
        const estica = Math.sin(u * Math.PI) * 0.16
        s.pivo.rotation.x = giro
        s.pivo.rotation.z = Math.sin(u * Math.PI * 2) * 0.18
        s.pivo.position.y = alt + Math.abs(Math.sin(giro)) * (s.A / 2 + 0.06)
        s.pivo.scale.set(1 - estica * 0.25, 1, 1 + estica * 0.6)
        pa.dobra = s.papel.dobra + Math.sin(u * Math.PI) * 0.22 * s.L; pa.onda = Math.sin(u * Math.PI) * 0.06 * s.L; pa.fase = u * 14; pa.torce = Math.sin(u * Math.PI * 2) * 0.1 * s.L
        if (u >= 1) {
          s.estado = 'chao'; s.viraAlvo = s.virado = f.para; s.pivo.rotation.z = 0; s.pivo.scale.set(1, 1, 1)
          // virou de costas: as mãos voltam, pegam o santinho e trazem para perto, para ler a cola
          if (f.para === 1) agenda(0.06, () => pega(s))
          s.quique = agora; s.amassa = agora
        }
      } else if (s.estado === 'chao') {
        const q = s.quique ? agora - s.quique : 9
        let quique = q < 0.5 ? Math.sin(q * 18) * Math.exp(-q * 9) * 0.06 : 0
        if (q < 0.5) mexendo = true
        // o pulinho do tranco quando a mão bate num vizinho
        if (s.pulo) { const w = agora - s.pulo; if (w >= 0 && w < 0.32) { quique += Math.sin((w / 0.32) * Math.PI) * s.puloAlt; mexendo = true } else if (w >= 0.32) s.pulo = 0; else mexendo = true }
        const am = s.amassa ? agora - s.amassa : 9
        const ach = am < 0.4 ? Math.sin(am * 22) * Math.exp(-am * 10) * 0.18 : 0
        s.pivo.scale.set(1 + ach * 0.5, 1, 1 + ach * 0.5)
        if (am < 0.4) mexendo = true
        // passar o mouse levanta o canto, como quem vai pegar
        pa.canto = s.papel.canto + s.ergue * 0.22 * Math.min(1.6, s.A)
        s.virado += (s.viraAlvo - s.virado) * Math.min(1, dtGlobal * 7)
        s.ergue += (s.ergueAlvo - s.ergue) * Math.min(1, dtGlobal * 10)
        if (Math.abs(s.viraAlvo - s.virado) > 0.002 || Math.abs(s.ergueAlvo - s.ergue) > 0.002) mexendo = true
        // virar: levanta o suficiente para o santinho girar em pé sobre o chão e assentar do outro lado
        const giro = s.virado * Math.PI
        s.pivo.rotation.x = giro
        s.pivo.position.y = Math.abs(Math.sin(giro)) * (s.A / 2 + 0.08) + s.ergue * 0.28 + Math.abs(quique)
        s.grupo.position.set(s.x, 0.02, s.z); s.grupo.rotation.set(0, -s.ang, 0)
      }
      if (s.estado === 'segura') Object.assign(pa, s.paSegura)
      if (s.grupo.visible && aplicaPapel(s, pa)) mexendo = true
    }
    if (animaMao(agora)) mexendo = true
    if (animaSegura(agora)) mexendo = true
    for (const m of maos) if (m.mao.visible) acimaDaMesa(m)
    if (animaEfeitos(agora)) mexendo = true
    return mexendo
  }

  /* ---------- som ----------
     Só a batida do bafo (o tapa das mãos): o papel caindo, pousando ou sendo pego não faz barulho. */
  // o contexto de áudio é o do site (lib/audio.ts): aberto de antemão, num momento parado, e não no clique do bafo
  let audio = null, somLigado = true, ruido = null
  function liberaAudio() {
    try {
      audio = abreSom()
      if (!ruido) { ruido = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 }
    } catch { /* sem áudio */ }
  }
  preparaAudio()
  const ocioso = (f) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 300))
  function ruidoFiltrado(tipo, freq, pico, ataque, fim, rampa) {
    if (!audio || audio.state !== 'running' || !ruido) return
    const t = audio.currentTime, src = audio.createBufferSource(); src.buffer = ruido
    const f = audio.createBiquadFilter(); f.type = tipo; f.frequency.setValueAtTime(freq, t); if (rampa) rampa(f, t)
    const g = audio.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pico, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + fim)
    src.connect(f).connect(g).connect(audio.destination); src.start(t); src.stop(t + fim + 0.05)
  }

  /* ---------- as mãos ----------
     Os materiais de desenho (sombreado em degraus e contorno em tinta) que pintam a mão humana, a manga e os
     efeitos do bafo. A mão em si vem do modelo glTF (abaixo). No espaço da mão, os dedos apontam para −z, o braço
     sai para +z e a palma olha para −y; a mão 0 é a direita, a 1 é a esquerda (a direita espelhada). */
  const rampa = (() => {
    const d = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255])
    const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t
  })()
  descartaveis.push(rampa)
  const desenho = (cor) => { const m = new THREE.MeshToonMaterial({ color: cor, gradientMap: rampa }); descartaveis.push(m); return m }
  function matContorno(largura) {
    const m = new THREE.MeshBasicMaterial({ color: 0x18202b, side: THREE.BackSide })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uL = { value: largura }
      sh.vertexShader = 'uniform float uL;\n' + sh.vertexShader.replace('#include <project_vertex>',
        'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\nmvPosition.xyz += normalize(normalMatrix * normal) * uL;\ngl_Position = projectionMatrix * mvPosition;')
    }
    descartaveis.push(m)
    return m
  }
  const contornoMao = matContorno(0.03)
  const geos = (g) => { descartaveis.push(g); return g }
  function comContorno(mesh) { const c = new THREE.Mesh(mesh.geometry, contornoMao); mesh.add(c); mesh.castShadow = true; return mesh }
  const pele = desenho(0xd99a6c), manga = desenho(0x5a9cc2), barra = desenho(0xfcfdfd)
  /* Mãos humanas de verdade: o modelo "generic-hand" (WebXR Input Profiles, MIT; origem em
     public/modelos/CREDITOS.txt), com a anatomia certa (palma, metacarpos, três falanges por dedo, polegar
     oponível), pintado em tons chapados com contorno, como o resto da cena. O esqueleto do modelo é plano (cada
     junta solta, como nas mãos de realidade virtual), então a pose dos dedos é cinemática feita aqui: cada dedo é
     uma cadeia (base, meio, ponta) que dobra no eixo anatômico, perpendicular à direção do dedo e à normal da
     palma; o polegar abre para a frente da palma, cruza por cima dela e dobra as duas juntas. A mão 1 é a 0
     espelhada. No espaço do corpo: dedos para −x, palma para −y (a face y = 0 é a que bate), polegar no +z. */
  const ESCALA_MAO = 10
  // do modelo (dedos −y, palma −x, polegar −z) para o corpo (dedos −x, palma −y, polegar +z)
  const R_MODELO = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)))
  const DEDOS = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']
  // o contorno em tinta da malha com ossos: o casco empurrado pela normal já deformada pelo esqueleto
  const contornoPele = new THREE.MeshBasicMaterial({ color: 0x18202b, side: THREE.BackSide })
  contornoPele.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
      'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\nmvPosition.xyz += normalize(normalMatrix * objectNormal) * 0.028;\ngl_Position = projectionMatrix * mvPosition;')
  }
  descartaveis.push(contornoPele)
  const maos = []
  const vFK = new THREE.Vector3(), qFK = new THREE.Quaternion()
  function cadeias(ossos) {
    const P = (n) => ossos[n].position.clone()
    const frente = P('middle-finger-phalanx-proximal').sub(P('wrist')).normalize()
    const lado = P('pinky-finger-phalanx-proximal').sub(P('index-finger-phalanx-proximal')).normalize()
    const palma = new THREE.Vector3().crossVectors(frente, lado).normalize()   // para onde os dedos fecham
    const cadeia = (nomes) => {
      const b = nomes.map((n) => ossos[n])
      const p0 = b.map((o) => o.position.clone()), q0 = b.map((o) => o.quaternion.clone())
      const v = p0.slice(1).map((q, i) => q.clone().sub(p0[i]))
      const eixo = new THREE.Vector3().crossVectors(v[0].clone().normalize(), palma).normalize()
      return { b, p0, q0, v, eixo }
    }
    const c = {}
    for (const f of DEDOS) c[f] = cadeia(['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'].map((j) => `${f}-${j}`))
    c.thumb = cadeia(['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'].map((j) => `thumb-${j}`))
    return { c, palma }
  }
  // cinemática direta de uma cadeia: cada junta soma o ângulo dela; `base` gira a cadeia inteira na raiz
  function curva(cad, angs, base) {
    const p = cad.p0[0].clone()
    let A = 0
    for (let i = 0; i < cad.b.length; i++) {
      if (i < angs.length) A += angs[i]
      qFK.setFromAxisAngle(cad.eixo, A)
      if (base) qFK.premultiply(base)
      cad.b[i].position.copy(p); cad.b[i].quaternion.copy(qFK).multiply(cad.q0[i])
      if (i < cad.v.length) p.add(vFK.copy(cad.v[i]).applyQuaternion(qFK))
    }
  }
  /** As poses das mãos: d = dobra das três juntas dos dedos; t = polegar (abre para a frente da palma, cruza por
   * cima dela, e as juntas). O mindinho fecha um pouco mais que o indicador, como numa mão de verdade. */
  const POSES = {
    reto: { d: [0.1, 0.12, 0.06], t: { abre: 0.2, cruza: 0, j: [0, 0.08, 0.06] } },
    concha: { d: [0.22, 0.28, 0.12], t: { abre: 0.3, cruza: 0.05, j: [0, 0.12, 0.1] } },
    sobre: { d: [0.3, 0.35, 0.18], t: { abre: 0.4, cruza: 0.1, j: [0, 0.18, 0.12] } },
    // na pinça os dedos ficam esticados ao longo da borda, por fora do papel; só o polegar aperta por cima
    pinca: { d: [0.22, 0.28, 0.18], t: { abre: 0.4, cruza: -0.6, j: [0.1, 0.3, 0.25] } },
    leitura: { d: [0, -0.05, 0], t: { abre: 1.5, cruza: -1.0, j: [0, 0.25, 0.2] } },
  }
  const misturaPose = (A, B, u) => ({
    d: A.d.map((x, i) => mistura(x, B.d[i], u)),
    t: { abre: mistura(A.t.abre, B.t.abre, u), cruza: mistura(A.t.cruza, B.t.cruza, u), j: A.t.j.map((x, i) => mistura(x, B.t.j[i], u)) },
  })
  const qPolegar = new THREE.Quaternion(), qCruza = new THREE.Quaternion()
  function poseDedos(m, pose) {
    if (!m.cad) return
    DEDOS.forEach((f, i) => { const k = 1 + i * 0.07; curva(m.cad.c[f], pose.d.map((a) => a * k)) })
    const t = m.cad.c.thumb
    qPolegar.setFromAxisAngle(t.eixo, pose.t.abre).premultiply(qCruza.setFromAxisAngle(m.cad.palma, pose.t.cruza))
    curva(t, [0, ...pose.t.j.slice(1)], qPolegar)
  }
  function fazMao(modelo, espelho) {
    const mao = new THREE.Group()         // posição e orientação no mundo
    const giro = new THREE.Group()        // dedos para −z
    const corpo = new THREE.Group()       // dobra do pulso e o achatar na batida
    mao.add(giro); giro.add(corpo); giro.rotation.y = -Math.PI / 2
    const sinal = espelho ? -1 : 1
    const cena = clonaEsqueleto(modelo)
    const suporte = new THREE.Group(); suporte.add(cena)
    suporte.quaternion.copy(R_MODELO); suporte.scale.setScalar(ESCALA_MAO); suporte.position.set(-0.01, -0.17, 0.09)
    corpo.add(suporte)
    let malha = null
    const ossos = {}
    cena.traverse((o) => { if (o.isSkinnedMesh) malha = o; if (o.isBone) ossos[o.name] = o })
    malha.material = pele; malha.castShadow = true; malha.frustumCulled = false
    const contorno = new THREE.SkinnedMesh(malha.geometry, contornoPele)
    contorno.bind(malha.skeleton, malha.bindMatrix); contorno.frustumCulled = false
    contorno.position.copy(malha.position); contorno.quaternion.copy(malha.quaternion); contorno.scale.copy(malha.scale)
    malha.parent.add(contorno)
    // o antebraço afina até o pulso do modelo; a manga curta da camiseta com a barra branca
    const ante = comContorno(new THREE.Mesh(geos(new THREE.CylinderGeometry(0.4, 0.24, 5.2, 20, 1, false)), pele))
    ante.rotation.z = -Math.PI / 2; ante.position.set(0.5 + 2.6, 0.22, 0); corpo.add(ante)
    const mg = comContorno(new THREE.Mesh(geos(new THREE.CylinderGeometry(0.6, 0.64, 3.4, 20, 1, false)), manga)); mg.rotation.z = -Math.PI / 2; mg.position.set(5.5 + 1.7, 0.22, 0); corpo.add(mg)
    const bb = comContorno(new THREE.Mesh(geos(new THREE.TorusGeometry(0.58, 0.1, 10, 28)), barra)); bb.rotation.y = Math.PI / 2; bb.position.set(5.55, 0.22, 0); corpo.add(bb)
    corpo.scale.z = sinal
    mao.visible = false; scene.add(mao)
    const m = { mao, corpo, sinal, cad: cadeias(ossos), ossos: Object.values(ossos), esqueleto: malha.skeleton }
    poseDedos(m, POSES.reto)
    return m
  }
  // o modelo (~92 KB) é baixado ao montar a cena; até chegar, o bafo espera
  new GLTFLoader().loadAsync('/modelos/mao-right.glb').then((g) => {
    if (!vivo) return
    maos.push(fazMao(g.scene, false), fazMao(g.scene, true))
    // a geometria é dividida pelas duas cópias; o material original (PBR) não é usado
    g.scene.traverse((o) => { if (o.isMesh) { descartaveis.push(o.geometry); o.material.dispose() } })
    // os shaders das mãos (pele com ossos, contorno, sombra) ficam prontos antes do primeiro bafo
    precompila().then(() => { ocioso(aquece); quandoParado(ensaia, () => acordado || !vivo) })
  }).catch((erro) => { console.warn('Voto Aberto: as mãos não carregaram (/modelos/mao-right.glb); o bafo vira o santinho sozinho.', erro) })
  // A mão nunca atravessa a mesa: depois de posta no quadro, se algum osso (descontada a espessura do dedo e da
  // palma em volta dele) fica abaixo do tampo, a mão inteira sobe o que falta. Vale para todas as fases.
  const vMesa = new THREE.Vector3()
  function acimaDaMesa(m) {
    m.mao.updateMatrixWorld(true)
    let min = Infinity
    for (const o of m.ossos) { vMesa.setFromMatrixPosition(o.matrixWorld); if (vMesa.y < min) min = vMesa.y }
    const falta = 0.03 + 0.16 * m.mao.scale.x - min
    if (falta > 0) { m.mao.position.y += falta; m.mao.updateMatrixWorld(true) }
  }
  function maoNeutra(m) { poseDedos(m, POSES.reto); m.corpo.rotation.set(0, 0, 0); m.corpo.scale.set(1, 1, m.sinal) }

  // a estrela do "PÁ!"
  const estrela = (() => {
    const g = new THREE.Group()
    const forma = new THREE.Shape(); const pontas = 11
    for (let i = 0; i <= pontas * 2; i++) { const r = i % 2 ? 0.62 : 1; const a = (i / (pontas * 2)) * Math.PI * 2; const x = Math.cos(a) * r * (1 + (i % 4 === 0 ? 0.12 : 0)), y = Math.sin(a) * r; if (i) forma.lineTo(x, y); else forma.moveTo(x, y) }
    const geo = geos(new THREE.ShapeGeometry(forma))
    const mat = (c) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false, toneMapped: false }); descartaveis.push(m); return m }
    const fundo = new THREE.Mesh(geo, mat(0x18202b)); fundo.scale.setScalar(1.12)
    const frente = new THREE.Mesh(geo, mat(0xfbc700)); frente.position.z = 0.001
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d')
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 96px ${FONTE}`; try { c.fontStretch = 'condensed' } catch { /* sem fontStretch */ }
    c.lineWidth = 14; c.lineJoin = 'round'; c.strokeStyle = '#18202b'; c.strokeText('PÁ!', 128, 70); c.fillStyle = '#fcfdfd'; c.fillText('PÁ!', 128, 70)
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; descartaveis.push(tx)
    const tm = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, toneMapped: false }); descartaveis.push(tm)
    const texto = new THREE.Mesh(geos(new THREE.PlaneGeometry(1.5, 0.75)), tm); texto.position.z = 0.002; texto.rotation.z = 0.12
    g.add(fundo, frente, texto); g.traverse(o => { o.renderOrder = 50 }); g.visible = false; scene.add(g)
    return g
  })()
  const geoNuvem = geos(new THREE.SphereGeometry(1, 16, 12))
  const nuvens = []
  const matNuvem = desenho(0xf4f6f8)
  for (let i = 0; i < 8; i++) { const m = comContorno(new THREE.Mesh(geoNuvem, matNuvem)); m.castShadow = false; m.visible = false; scene.add(m); nuvens.push({ m }) }

  /* ---------- o bafo ---------- */
  let batida = null, tremor = 0
  function bate(s) {
    if (s.estado !== 'chao' || batida) return
    // se a cola está aberta, ela volta para o chão e só então a mão bate
    if (segura) { devolve(() => bate(s)); return }
    preparaVerso(s)
    const e = Math.min(1.25, Math.max(0.75, s.L / 3.0))
    batida = { s, t0: relogio, e, bateu: false, c: new THREE.Vector3(s.x, 0, s.z), vaiPegar: !s.viraAlvo }
    maos.forEach(m => { maoNeutra(m); poseDedos(m, POSES.concha); m.mao.scale.setScalar(e); m.mao.visible = true })
    if (reduzido.matches || !maos.length) { batida = null; maos.forEach(m => { m.mao.visible = false }); s.viraAlvo = s.virado = 1; pega(s) }
    avisa(); acorda()
  }
  const TEMPOS = { arma: 0.26, bate: 0.36, segura: 0.42, sai: 0.7 }
  function animaMao(agora) {
    if (!batida) return false
    const b = batida, e = b.e, c = b.c
    let fim = true
    maos.forEach((m, i) => {
      const lado = i ? -1 : 1, t = agora - b.t0 - i * 0.03
      const longe = [c.x + lado * 1.4 * e, 1.6, c.z + 12], armada = [c.x + lado * 0.62 * e, 2.3 * e, c.z + 1.9 * e], batendo = [c.x + lado * 0.6 * e, 0.06, c.z + 0.55 * e]
      let p, incl, achata = 0
      if (t < 0) { p = longe; incl = 0.3 }
      else if (t < TEMPOS.arma) { const u = ease.saida(t / TEMPOS.arma); p = longe.map((v, k) => mistura(v, armada[k], u)); incl = mistura(0.25, 0.8, u) }
      else if (t < TEMPOS.bate) { const u = ease.entrada((t - TEMPOS.arma) / (TEMPOS.bate - TEMPOS.arma)); p = armada.map((v, k) => mistura(v, batendo[k], u)); incl = mistura(0.8, -0.08, u) }
      else if (t < TEMPOS.segura) { const u = (t - TEMPOS.bate) / (TEMPOS.segura - TEMPOS.bate); p = batendo; incl = -0.08; achata = Math.sin(u * Math.PI) * 0.3 }
      else if (b.vaiPegar) {
        // sobem do tapa e ficam pairando sobre o lugar onde ele vai cair, prontas para pegar
        const u = ease.saida(Math.min(1, (t - TEMPOS.segura) / (TEMPOS.sai - TEMPOS.segura)))
        // para os lados e para perto de quem olha: o santinho gira no ar entre elas, sem passar por dentro
        const pairando = [c.x + lado * (b.s.L / 2 + 0.55 * e), 1.7 * e, c.z + b.s.A / 2 + 1.9 * e]
        p = batendo.map((v, k) => mistura(v, pairando[k], u)); incl = mistura(-0.08, 0.3, u)
      }
      else { const u = ease.entrada(Math.min(1, (t - TEMPOS.segura) / (TEMPOS.sai - TEMPOS.segura))); p = batendo.map((v, k) => mistura(v, longe[k], u)); incl = mistura(-0.08, 0.5, u) }
      m.mao.position.set(p[0], p[1], p[2])
      m.mao.rotation.set(0, lado * 0.12, -lado * 0.14)
      m.corpo.rotation.z = -incl
      m.corpo.scale.set(1 + achata * 0.5, 1 - achata, (1 + achata * 0.3) * m.sinal)
      if (t < TEMPOS.sai) fim = false; else if (!b.vaiPegar) m.mao.visible = false
    })
    if (!b.bateu && agora - b.t0 >= TEMPOS.bate) { b.bateu = true; impacto(b) }
    if (fim) batida = null
    return true
  }
  function impacto(b) {
    const s = b.s
    s.estado = 'bafo'; s.bafo = { t0: relogio, de: s.virado, para: s.viraAlvo ? 0 : 1, altura: 2.3 + Math.max(0, 3 - s.L) * 0.45, dur: 0.78 }
    estrela.visible = true; estrela.userData.t0 = relogio; estrela.position.set(s.x - 0.2 * b.e, 1.5 * b.e, s.z + 0.4); estrela.userData.e = b.e
    nuvens.forEach((n, i) => {
      const a = (i / nuvens.length) * Math.PI * 2 + Math.random() * 0.4, r = Math.max(s.L, s.A) * 0.55
      n.m.visible = true; n.t0 = relogio; n.de = [s.x + Math.cos(a) * r * 0.7, s.z + Math.sin(a) * r * 0.6]; n.dir = [Math.cos(a), Math.sin(a)]; n.tam = 0.18 + Math.random() * 0.16
    })
    for (const o of santinhos) if (o !== s && o.estado === 'chao') { const d = Math.hypot(o.x - s.x, o.z - s.z); if (d < 4.2) { o.pulo = relogio + d * 0.03; o.puloAlt = 0.35 * (1 - d / 4.2) } }
    tremor = 0.16
    tapa()
  }
  function animaEfeitos(agora) {
    let vivo = false
    if (estrela.visible) {
      const u = (agora - estrela.userData.t0) / 0.42; vivo = true
      const k = u < 0.25 ? ease.saida(u / 0.25) * 1.15 : u < 0.4 ? mistura(1.15, 1, (u - 0.25) / 0.15) : 1
      estrela.scale.setScalar(Math.max(0.001, k * 0.95 * estrela.userData.e))
      estrela.quaternion.copy(camera.quaternion)
      const op = u > 0.7 ? Math.max(0, 1 - (u - 0.7) / 0.3) : 1
      estrela.children.forEach(m => { m.material.opacity = op })
      if (u >= 1) estrela.visible = false
    }
    for (const n of nuvens) {
      if (!n.m.visible) continue; vivo = true
      const u = (agora - n.t0) / 0.55
      const ida = ease.saida(Math.min(1, u)) * 1.1
      n.m.position.set(n.de[0] + n.dir[0] * ida, 0.15 + ida * 0.25, n.de[1] + n.dir[1] * ida * 0.8)
      n.m.scale.setScalar(Math.max(0.001, n.tam * (u < 0.3 ? u / 0.3 * 1.4 : mistura(1.4, 0, (u - 0.3) / 0.7))))
      if (u >= 1) n.m.visible = false
    }
    if (tremor > 0) { tremor = Math.max(0, tremor - dtGlobal); vivo = true }
    return vivo
  }
  function tapa() {
    if (!somLigado || !audio || audio.state !== 'running' || !ruido) return
    const t = audio.currentTime
    ruidoFiltrado('bandpass', 1800, 0.16, 0.004, 0.1)
    const o = audio.createOscillator(), g2 = audio.createGain(); o.type = 'sine'
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.14)
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.1, t + 0.008); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g2).connect(audio.destination); o.start(t); o.stop(t + 0.2)
    const o2 = audio.createOscillator(), g3 = audio.createGain(); o2.type = 'triangle'
    o2.frequency.setValueAtTime(520, t + 0.05); o2.frequency.exponentialRampToValueAtTime(1500, t + 0.4)
    g3.gain.setValueAtTime(0.0001, t + 0.05); g3.gain.exponentialRampToValueAtTime(0.02, t + 0.1); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
    o2.connect(g3).connect(audio.destination); o2.start(t + 0.05); o2.stop(t + 0.45)
  }

  /* ---------- pegar na mão para ler a cola ----------
     A pegada é uma só do começo ao fim: cada mão segura uma borda lateral, o polegar por cima (do lado da cola)
     e os dedos por baixo, com o braço saindo para o lado de quem olha. Ela fica presa ao papel em coordenadas
     do próprio santinho, então nada gira solto: no chão, o braço sobe em diagonal para a câmera (passa por cima
     dos vizinhos); em pé, desce para quem lê. As mãos chegam e vão embora ao longo do próprio braço, como quem
     estica e recolhe, e por isso nunca cruzam a mesa nem o papel.
     Pegar: chegam por cima da borda (0,45 s), descem e fecham os dedos, o papel arqueia na pinça (0,2 s), sobem
     com ele em arco até a altura de leitura, virando de frente (0,8 s), e assentam com um pequeno balanço.
     Devolver: descem com ele de volta ao lugar, de costas, soltam (os dedos abrem), recolhem o braço, e o
     santinho vira sozinho, de frente, no chão. */
  let segura = null
  const ALFA = 0.25                                     // inclinação da pegada: o braço sobe ~14° do papel
  const F_LOCAL = new THREE.Vector3(0, -Math.sin(ALFA), -Math.cos(ALFA))   // dedos, no espaço do santinho
  const qTmp = new THREE.Quaternion(), vTmp = new THREE.Vector3(), mTmp = new THREE.Matrix4()
  function poseChao(s) {
    // de costas no chão (o pivô sempre virado em π)
    return { p: new THREE.Vector3(s.x, 0.02, s.z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -s.ang, 0)) }
  }
  function poseLeitura(s) {
    // de frente para a câmera, a uma distância em que a cola ocupa ~55% da largura (65% no celular)
    camera.updateMatrixWorld()
    const e = camera.matrixWorld.elements
    const dir = new THREE.Vector3(e[0], e[1], e[2]), cima = new THREE.Vector3(e[4], e[5], e[6]), atras = new THREE.Vector3(e[8], e[9], e[10])
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const fr = camera.aspect < 1 ? 0.64 : 0.54
    const d = Math.max(s.L / (fr * 2 * t * camera.aspect), s.A / (0.62 * 2 * t))
    const p = camera.position.clone().addScaledVector(atras, -d).addScaledVector(cima, -0.04 * 2 * d * t)
    mTmp.makeBasis(dir, atras, cima.clone().negate())
    return { p, q: new THREE.Quaternion().setFromRotationMatrix(mTmp) }
  }
  // a pegada de uma mão, no espaço do santinho: ponto na borda e orientação (dedos F, palma para dentro)
  const pinca = [new THREE.Vector3(-0.62, 0.32, -0.42), new THREE.Vector3(0.62, 0.32, -0.42)]   // ponto da pinça no espaço da mão
  // orientação da mão a partir da direção dos dedos (F) e da palma (P), no espaço do santinho
  function orientacao(F, P) {
    const Z = F.clone().normalize().negate(), Y = P.clone().negate()
    Y.addScaledVector(Z, -Y.dot(Z)).normalize()
    return new THREE.Quaternion().setFromRotationMatrix(mTmp.makeBasis(new THREE.Vector3().crossVectors(Y, Z), Y, Z))
  }
  // "sobre": palma para baixo, dedos para a frente e um pouco para dentro (de cima, a mão inteira aparece);
  // "pinca": palma para o meio do papel, polegar por cima, dedos por baixo
  const ORIENTA = {
    sobre: [0, 1].map((i) => orientacao(new THREE.Vector3(-(i ? -1 : 1) * 0.3, -0.35, -1), new THREE.Vector3(0, -1, 0))),
    // a palma para dentro e um pouco para baixo (a mão inclinada, como quem pega um papel da mesa): o mindinho
    // não desce até o tampo
    pinca: [0, 1].map((i) => orientacao(F_LOCAL, new THREE.Vector3(-(i ? -1 : 1), -0.8, 0))),
  }
  // a mão de leitura: perto da borda lateral (a base do polegar fica por fora da folha), atrás do plano, segurando um
  // pouco acima da borda de baixo, com os dedos levemente para trás (medido quadro a quadro: nenhum atravessa o papel)
  const ATRAS = { x: 0.25, y: -0.55, z: -0.8, f: -0.08 }
  function poseAtras(i, s, pose, e) {
    const lado = i ? -1 : 1
    // dentro do contorno do papel (nada sobra pela lateral), com o pulso logo abaixo da borda de baixo
    // a mão um pouco atrás do plano: os dedos inclinam para a folha sem furar, e o braço desce para trás
    const local = new THREE.Vector3(lado * (s.L / 2 - ATRAS.x * e), ATRAS.y * e, s.A / 2 + ATRAS.z * e)
    const q = orientacao(new THREE.Vector3(0, ATRAS.f, -1), new THREE.Vector3(0, 1, 0))
    return { p: local.applyQuaternion(pose.q).add(pose.p), q: pose.q.clone().multiply(q) }
  }
  /** A mão segurando o santinho: w = 0 na pinça da borda (no chão), 1 atrás do papel (na leitura). */
  function maoSegurando(m, i, s, pose, e, w) {
    const a = poseDaMao(i, s, pose, e, 'pinca')
    if (w > 0) {
      // da pinça (por fora da borda) para trás da folha: a mão vai primeiro para trás (y rápido) e só depois para
      // dentro (x devagar), então os dedos contornam a borda em vez de atravessar o papel
      const b = poseAtras(i, s, pose, e)
      const inv = pose.q.clone().invert()
      const la = a.p.clone().sub(pose.p).applyQuaternion(inv), lb = b.p.clone().sub(pose.p).applyQuaternion(inv)
      la.set(mistura(la.x, lb.x, w * w), mistura(la.y, lb.y, Math.sqrt(w)), mistura(la.z, lb.z, w))
      // no meio da passagem a mão escorrega para fora pela borda: o polegar contorna a quina em vez de cruzar a folha
      la.x += (i ? -1 : 1) * 0.6 * e * Math.sin(Math.PI * w)
      a.p.copy(la.applyQuaternion(pose.q).add(pose.p)); a.q.slerp(b.q, w)
    }
    m.mao.position.copy(a.p); m.mao.quaternion.copy(a.q)
    // o polegar abre para a frente cedo: fica sempre do lado da cola, nunca cruza a folha
    const pd = misturaPose(POSES.pinca, POSES.leitura, w)
    // a ordem de uma mão de verdade: o polegar sai pela borda (cruza para fora), vai para a frente da folha (abre, que
    // termina em 62% da passagem) e só então volta para dentro (o desvio acaba em 80%), deitando sobre a cola
    pd.t.abre = mistura(POSES.pinca.t.abre, POSES.leitura.t.abre, Math.min(1, w * 1.6))
    pd.t.cruza -= 1.9 * Math.sin(Math.PI * Math.min(1, w * 1.25))
    poseDedos(m, pd)
  }
  /** Onde a mão i fica, no mundo, segurando (ou prestes a segurar) a borda do santinho na pose dada. */
  function poseDaMao(i, s, pose, e, tipo, sobe = 0, recuo = 0, fora = 0) {
    const lado = i ? -1 : 1                             // a direita (0) na borda +x, a esquerda (1) na −x
    // a borda acompanha a curva do papel (o mesmo deslocamento do shader nas pontas), e a mão vai junto
    // na pinça a mão fica um pouco abaixo da borda (há vão entre o papel e a mesa): os dedos entram por baixo
    const borda = new THREE.Vector3(lado * (s.L / 2 + (0.12 + fora) * e), s.u.uDobra.value * 0.94 - (tipo === 'pinca' ? 0.06 * e : 0), s.A * 0.3)
    const q = pose.q.clone().multiply(ORIENTA[tipo][i])
    // o ponto da pinça na borda; recuo afasta a mão ao longo do braço; sobe a levanta da borda
    const p = borda.applyQuaternion(pose.q).add(pose.p).sub(pinca[i].clone().multiplyScalar(e).applyQuaternion(q))
    if (recuo) p.addScaledVector(vTmp.set(0, 0, 1).applyQuaternion(q), recuo * e)
    if (sobe) p.addScaledVector(vTmp.set(0, 1, 0).applyQuaternion(pose.q), sobe * e)
    return { p, q }
  }
  function pega(s) {
    if (segura || s.estado !== 'chao' || !santinhos.includes(s)) return
    const e = Math.min(1.05, Math.max(0.55, s.A * 0.4))
    // as mãos partem de onde estão (pairando depois do bafo), com a escala e o pulso de lá: sem salto
    const de = maos.map(m => m.mao.visible ? { p: m.mao.position.clone(), q: m.mao.quaternion.clone(), esc: m.mao.scale.x, incl: m.corpo.rotation.z } : null)
    segura = { s, fase: 'pegando', t0: relogio, e, chao: poseChao(s), de }
    s.estado = 'segura'; s.paSegura = { dobra: s.papel.dobra, onda: 0, torce: 0, canto: 0, fase: null }
    s.pivo.position.set(0, 0, 0); s.pivo.rotation.set(Math.PI, 0, 0); s.pivo.scale.set(1, 1, 1)
    maos.forEach(m => { m.corpo.scale.set(1, 1, m.sinal); m.mao.visible = true })
    if (reduzido.matches) segura.t0 -= 10
    avisa(); acorda()
  }
  function devolve(depois) {
    if (!segura || segura.fase !== 'na-mao') { if (depois) agenda(0.3, depois); return }
    segura.fase = 'devolvendo'; segura.t0 = relogio; segura.depois = depois
    segura.de = { p: segura.s.grupo.position.clone(), q: segura.s.grupo.quaternion.clone() }
    segura.fim = poseChao(segura.s)
    if (reduzido.matches) segura.t0 -= 10
    avisa(); acorda()
  }
  const T_PEGA = { chega: 0.42, fecha: 0.64, sobe: 1.4 }, T_SOLTA = { desce: 0.75, abre: 1.1, sai: 1.5 }
  function animaSegura(agora) {
    if (!segura) return false
    const g = segura, s = g.s, e = g.e, t = agora - g.t0
    let pose = g.chao
    const ps = s.paSegura
    if (g.fase === 'pegando') {
      if (t < T_PEGA.chega) {
        // de onde estão até logo acima das bordas, palma para baixo e dedos abertos, num arco curto
        const u = ease.meio(t / T_PEGA.chega)
        maos.forEach((m, i) => {
          const alvo = poseDaMao(i, s, pose, e, 'sobre', 0.55)
          const de = g.de[i] || { ...poseDaMao(i, s, pose, e, 'pinca', 0.9, 9), esc: e, incl: 0 }
          m.mao.position.lerpVectors(de.p, alvo.p, u); m.mao.position.y += Math.sin(u * Math.PI) * 0.35 * e
          m.mao.quaternion.slerpQuaternions(de.q, alvo.q, u)
          m.mao.scale.setScalar(mistura(de.esc, e, u))
          m.corpo.rotation.z = mistura(de.incl, -0.15, u)
          poseDedos(m, misturaPose(POSES.concha, POSES.sobre, u))
        })
        ps.dobra = s.papel.dobra; ps.canto = s.papel.canto * (1 - u)
      } else if (t < T_PEGA.fecha) {
        // descem na borda girando o punho para a pinça e fecham: o papel arqueia entre as mãos e descola do chão
        const u = ease.meio((t - T_PEGA.chega) / (T_PEGA.fecha - T_PEGA.chega))
        // o polegar aperta e a folha descola: a borda sobe (dobra) e o santinho sai da mesa; os dedos esperam do
        // lado de fora e só deslizam para baixo da borda na segunda metade, quando já há vão entre papel e mesa
        pose = { p: g.chao.p.clone().add(new THREE.Vector3(0, 0.45 * ease.saida(u), 0)), q: g.chao.q }
        const fora = 0.45 * (1 - suave01((u - 0.45) / 0.55))
        maos.forEach((m, i) => {
          const a = poseDaMao(i, s, pose, e, 'sobre', 0.55), b = poseDaMao(i, s, pose, e, 'pinca', 0, 0, fora)
          m.mao.position.lerpVectors(a.p, b.p, u); m.mao.quaternion.slerpQuaternions(a.q, b.q, u)
          m.mao.scale.setScalar(e); m.corpo.rotation.z = mistura(-0.15, 0, u)
          poseDedos(m, misturaPose(POSES.sobre, POSES.pinca, u))
        })
        ps.dobra = s.papel.dobra + 0.14 * s.L * u; ps.canto = 0   // as bordas sobem na pinça: o dedo entra por baixo
      } else {
        // sobe em arco até a altura de leitura e vira de frente; chega com o peso do braço (passa e volta)
        const u = limita((t - T_PEGA.fecha) / (T_PEGA.sobe - T_PEGA.fecha))
        g.leitura = poseLeitura(s)
        const k = ease.volta(ease.meio(u) * 0.35 + u * 0.65)
        const base = g.chao.p.clone().add(new THREE.Vector3(0, 0.45, 0))
        pose = { p: new THREE.Vector3().lerpVectors(base, g.leitura.p, k), q: g.chao.q.clone().slerp(g.leitura.q, limita(ease.meio(u) * 1.04)) }
        pose.p.y += Math.sin(limita(k) * Math.PI) * 1.2
        const w = suave01((u - 0.3) / 0.55)
        maos.forEach((m, i) => maoSegurando(m, i, s, pose, e, w))
        // o papel verga ao ser levantado (o ar empurra o meio) e assenta curvadinho na mão
        const ar = Math.sin(u * Math.PI)
        // a curvatura da pinça (bordas para cima) vira a da leitura (bordas para trás) cedo, antes do polegar chegar à frente
        ps.dobra = mistura(s.papel.dobra + 0.14 * s.L, -0.04 * s.L, Math.min(1, u * 1.7)) + ar * 0.05 * s.L
        ps.onda = ar * 0.025 * s.L; s.uFase = (s.uFase || 0) + dtGlobal * 8; ps.fase = s.uFase
        if (u >= 1) { g.fase = 'na-mao'; g.t0 = agora; avisa() }
      }
    } else if (g.fase === 'na-mao') {
      // balança de leve, como quem segura e lê (para sozinho em alguns segundos: nada roda em loop)
      g.leitura = poseLeitura(s)
      const amor = reduzido.matches ? 0 : Math.exp(-t * 0.45)
      const bal = Math.sin(t * 1.6) * 0.035 * amor, sobe = Math.sin(t * 1.1) * 0.04 * amor
      pose = { p: g.leitura.p.clone().add(new THREE.Vector3(0, sobe * s.A, 0)), q: g.leitura.q.clone().multiply(qTmp.setFromEuler(new THREE.Euler(bal * 0.6, 0, bal))) }
      maos.forEach((m, i) => maoSegurando(m, i, s, pose, e, 1))
      ps.dobra = -0.04 * s.L; ps.onda = 0; ps.fase = null
      s.grupo.position.copy(pose.p); s.grupo.quaternion.copy(pose.q)
      return amor > 0.02
    } else if (g.fase === 'devolvendo') {
      if (t < T_SOLTA.desce) {
        // desce em arco até logo acima do lugar (ainda de costas), com vão entre o papel e a mesa para os dedos saírem
        const u = t / T_SOLTA.desce, k = ease.meio(u)
        const alto = g.fim.p.clone().add(new THREE.Vector3(0, 0.45, 0))
        pose = { p: new THREE.Vector3().lerpVectors(g.de.p, alto, k), q: g.de.q.clone().slerp(g.fim.q, k) }
        pose.p.y += Math.sin(k * Math.PI) * 0.9
        const w = 1 - suave01(u / 0.5)
        maos.forEach((m, i) => maoSegurando(m, i, s, pose, e, w))
        ps.dobra = mistura(-0.04 * s.L, s.papel.dobra + 0.14 * s.L, k) + Math.sin(u * Math.PI) * 0.06 * s.L; ps.onda = Math.sin(u * Math.PI) * 0.03 * s.L
        s.uFase = (s.uFase || 0) + dtGlobal * 9; ps.fase = s.uFase
      } else {
        ps.onda = 0; ps.fase = null
        if (t < T_SOLTA.abre) {
          // solta: os dedos saem de lado de baixo da borda, a mão sobe, e só então a folha cai no tampo
          const u = (t - T_SOLTA.desce) / (T_SOLTA.abre - T_SOLTA.desce)
          const cai = ease.entrada(suave01((u - 0.45) / 0.55))
          pose = { p: g.fim.p.clone().add(new THREE.Vector3(0, 0.45 * (1 - cai), 0)), q: g.fim.q }
          ps.dobra = mistura(s.papel.dobra + 0.14 * s.L, s.papel.dobra, cai)
          const fora = 0.6 * suave01(u / 0.5), sobe = 0.4 * suave01((u - 0.35) / 0.65)
          maos.forEach((m, i) => {
            const a = poseDaMao(i, s, g.fim, e, 'pinca', sobe + 0.45 / e, 0, fora)
            m.mao.position.copy(a.p); m.mao.quaternion.copy(a.q)
            poseDedos(m, misturaPose(POSES.pinca, POSES.sobre, suave01(u)))
          })
        } else {
          pose = g.fim
          ps.dobra = s.papel.dobra
          // recolhe o braço pelo mesmo caminho; o santinho vira sozinho, de frente
          const u = limita((t - T_SOLTA.abre) / (T_SOLTA.sai - T_SOLTA.abre))
          // vira só quando as mãos já se afastaram da borda
          if (!g.virou && u < 0.3) { s.grupo.position.copy(pose.p); s.grupo.quaternion.copy(pose.q) }
          else if (!g.virou) {
            g.virou = true
            s.estado = 'chao'; s.viraAlvo = 0; s.virado = 1; s.pivo.rotation.set(Math.PI, 0, 0)
            s.grupo.position.set(s.x, 0.02, s.z); s.grupo.rotation.set(0, -s.ang, 0)
          }
          maos.forEach((m, i) => {
            const a = poseDaMao(i, s, pose, e, 'pinca', 0.4 + 0.45 / e, mistura(0, 9, ease.entrada(u)), 0.6)
            m.mao.position.copy(a.p); m.mao.quaternion.copy(a.q); poseDedos(m, POSES.sobre)
          })
          if (u >= 1) {
            maos.forEach(m => { m.mao.visible = false; maoNeutra(m) })
            const depois = g.depois; segura = null; avisa(); if (depois) agenda(0.06, depois)
          }
          return true
        }
      }
    }
    s.grupo.position.copy(pose.p); s.grupo.quaternion.copy(pose.q)
    return true
  }

  /* ---------- interação ---------- */
  const raio = new THREE.Raycaster(); const ndc = new THREE.Vector2()
  function aponta(e) {
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raio.setFromCamera(ndc, camera)
    const h = raio.intersectObjects(santinhos.filter(s => s.estado === 'chao').map(s => s.folha), false)
    return h.length ? h[0].object.userData.s : null
  }
  function marca(s) {
    if (sob === s) return
    if (sob) sob.ergueAlvo = 0
    sob = s; if (s) s.ergueAlvo = 1
    canvas.style.cursor = s ? 'pointer' : 'default'
    if (s) versoQuandoParar(s)
    avisa(); acorda()
  }
  // o verso (a cola) é desenhado e enviado à GPU quando o ponteiro para sobre o santinho: no clique, a mão já o tem
  // (antes, o primeiro bafo de cada santinho perdia um quadro nisso). Só os 4 últimos assim ficam guardados: cada um
  // ocupa ~1,5 MB de memória de vídeo
  const versosRecentes = []
  function preparaVerso(s) {
    if (!s.versoPronto) {
      s.u.mapVerso.value = texturaVerso(s); s.versoPronto = true
      renderer.initTexture(s.u.mapVerso.value)
    }
    const i = versosRecentes.indexOf(s); if (i >= 0) versosRecentes.splice(i, 1)
    versosRecentes.push(s)
    while (versosRecentes.length > 4) {
      const v = versosRecentes.shift()
      if (v === segura?.s || v === batida?.s || v.virado > 0.01 || !santinhos.includes(v)) continue // em uso: fica
      v.u.mapVerso.value.dispose(); v.u.mapVerso.value = branco; v.versoPronto = false
    }
  }
  const versoQuandoParar = (s) => setTimeout(() => ocioso(() => { if (vivo && sob === s && santinhos.includes(s)) preparaVerso(s) }), 150)
  function mostraDica(s, x, y) {
    const r = palco.getBoundingClientRect()
    dica.querySelector('b').textContent = s.palavra
    dica.querySelector('span').textContent = `${reaisExato(s.n)}, ${pctTexto(s.n)} do gasto, em ${s.quantidade} ${s.quantidade === 1 ? 'despesa' : 'despesas'}. Clique para bater o bafo e ler a cola.`
    const px = Math.min(r.width - 110, Math.max(110, x - r.left)), py = y - r.top
    dica.style.transform = `translate(${px}px, ${py - 16}px) translate(-50%, -100%)`
    dica.hidden = false
  }
  const escondeDica = () => { dica.hidden = true }
  // o raio do mouse roda uma vez por quadro de tela, não a cada evento (o mouse dispara 120+ por segundo)
  let movPendente = null, quadroMouse = 0
  const aoMover = (e) => {
    if (e.pointerType !== 'mouse') return
    if (!movPendente) quadroMouse = requestAnimationFrame(() => {
      const ev = movPendente; movPendente = null
      if (!ev) return
      const s = segura ? null : aponta(ev); marca(s)
      if (s) mostraDica(s, ev.clientX, ev.clientY); else escondeDica()
    })
    movPendente = { clientX: e.clientX, clientY: e.clientY }
  }
  const aoSair = () => { movPendente = null; marca(null); escondeDica() }
  const aoClicar = (e) => {
    liberaAudio(); escondeDica()
    // com um santinho na mão, clicar em qualquer lugar da mesa o põe de volta
    if (segura) { if (segura.fase === 'na-mao') devolve(); return }
    const s = aponta(e)
    if (s) bate(s)
  }
  const aoTeclar = (e) => { if (e.key === 'Escape' && segura && segura.fase === 'na-mao') devolve() }
  window.addEventListener('keydown', aoTeclar)
  canvas.addEventListener('pointermove', aoMover)
  canvas.addEventListener('pointerleave', aoSair)
  canvas.addEventListener('click', aoClicar)

  /* ---------- câmera: de cima, em três quartos, enquadrando a nuvem inteira ---------- */
  let ELEVACAO = THREE.MathUtils.degToRad(58)
  const mira = new THREE.Vector3()
  let distancia = 30
  const ponteiro = { x: 0, y: 0 }, suaveP = { x: 0, y: 0 }
  const aoMoverPalco = (e) => { if (e.pointerType !== 'mouse') return; const r = palco.getBoundingClientRect(); ponteiro.x = (e.clientX - r.left) / r.width - 0.5; ponteiro.y = (e.clientY - r.top) / r.height - 0.5; acorda() }
  const aoSairPalco = () => { ponteiro.x = ponteiro.y = 0; acorda() }
  palco.addEventListener('pointermove', aoMoverPalco)
  palco.addEventListener('pointerleave', aoSairPalco)
  function colocaCamera(d, az = 0, el = ELEVACAO) {
    camera.position.set(mira.x + Math.sin(az) * Math.cos(el) * d, mira.y + Math.sin(el) * d, mira.z + Math.cos(az) * Math.cos(el) * d)
    camera.lookAt(mira); camera.updateMatrixWorld()
  }
  function enquadra() {
    const w = palco.clientWidth, h = palco.clientHeight; if (!w || !h) return
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
    ELEVACAO = THREE.MathUtils.degToRad(w / h < 1 ? 64 : 58)
    const m = 0.55, b = { x0: limites.x0 - m, x1: limites.x1 + m, z0: limites.z0 - m, z1: limites.z1 + m }
    mira.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2 + 0.3)
    const pts = []
    for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.6, z))
    let lo = 4, hi = 200; const v = new THREE.Vector3()
    for (let i = 0; i < 30; i++) {
      const d = (lo + hi) / 2; colocaCamera(d)
      const ok = pts.every(p => { v.copy(p).project(camera); return Math.abs(v.x) <= 0.97 && v.y <= 0.9 && v.y >= -0.97 })
      if (ok) hi = d; else lo = d
    }
    distancia = hi; colocaCamera(distancia); acorda()
  }
  const observador = new ResizeObserver(enquadra)
  observador.observe(palco)

  /* ---------- laço de quadros: só desenha quando algo se mexe ---------- */
  let relogio = 0, ultimo = performance.now(), acordado = false, ociosoDesde = 0, quadroId = 0, vivo = true
  const agendadas = []
  function agenda(seg, fn) { agendadas.push({ t: relogio + seg, fn }); acorda() }
  function rodaAgenda() { for (let i = agendadas.length - 1; i >= 0; i--) if (relogio >= agendadas[i].t) { const a = agendadas.splice(i, 1)[0]; a.fn() } }
  // fora da tela não desenha: a animação para no relógio dela e continua quando o palco volta
  let naTela = true
  const vigia = new IntersectionObserver(([e]) => { naTela = e.isIntersecting; if (naTela) acorda() })
  vigia.observe(palco)
  function desenha() {
    if (sombraSuja) { renderer.shadowMap.needsUpdate = true; sombraSuja = false }
    renderer.render(scene, camera)
  }
  function acorda() { if (!vivo || !naTela) return; if (!acordado) { acordado = true; ultimo = performance.now(); quadroId = requestAnimationFrame(quadro) } }
  function passo(dt) {
    dtGlobal = dt; relogio += dt; rodaAgenda()
    const mexendo = anima(relogio)
    if (mexendo) sombraSuja = true
    const mov = reduzido.matches ? 0 : 1
    suaveP.x += (ponteiro.x * mov - suaveP.x) * Math.min(1, dtGlobal * 4)
    suaveP.y += (ponteiro.y * mov - suaveP.y) * Math.min(1, dtGlobal * 4)
    const tr = tremor > 0 ? tremor * 0.08 : 0
    colocaCamera(distancia, suaveP.x * 0.1 + (Math.random() - 0.5) * tr, ELEVACAO - suaveP.y * 0.05 + (Math.random() - 0.5) * tr)
    return mexendo || agendadas.length > 0
  }
  function quadro(agoraMs) {
    const dt = Math.min(0.05, Math.max(0, agoraMs - ultimo) / 1000) * (window.__velocidade || 1); ultimo = agoraMs
    if (!naTela) { acordado = false; return }
    const mexendo = passo(dt)
    desenha()
    const mov = reduzido.matches ? 0 : 1
    const quieto = !mexendo && Math.abs(ponteiro.x * mov - suaveP.x) < 0.002 && Math.abs(ponteiro.y * mov - suaveP.y) < 0.002
    if (quieto) { if (!ociosoDesde) ociosoDesde = agoraMs } else ociosoDesde = 0
    if (quieto && agoraMs - ociosoDesde > 400) { acordado = false; return }
    quadroId = requestAnimationFrame(quadro)
  }

  /* ---------- shaders compilados antes de precisar ----------
     Na primeira vez que um material aparece, o shader dele é compilado e o quadro espera: no D3D11 do Windows são
     dezenas de ms por shader (a chuva começava com ~120 ms parada e as mãos entravam com ~250 ms). Aqui eles são
     compilados em paralelo (KHR_parallel_shader_compile), antes de a cena precisar deles: os da tela e os do mapa de
     sombra, estes com os mesmos parâmetros do passe de sombra (um alvo de desenho ligado, e o material de
     profundidade com o lado, o mapa e o alphaTest que o WebGLShadowMap copia do material da malha). */
  const LADO_SOMBRA = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide }
  const alvoSombra = new THREE.WebGLRenderTarget(1, 1); descartaveis.push(alvoSombra)
  const naSombra = new Set()
  function precompila() {
    const sombra = new THREE.Scene()
    scene.traverse((o) => {
      if (!o.isMesh || !o.castShadow) return
      const m = o.material, lado = m.shadowSide ?? LADO_SOMBRA[m.side]
      const chave = [o.customDepthMaterial ? o.customDepthMaterial.customProgramCacheKey() : 'comum', o.isSkinnedMesh, lado, !!m.map, m.alphaTest > 0].join('|')
      if (naSombra.has(chave)) return
      naSombra.add(chave)
      const p = o.customDepthMaterial || new THREE.MeshDepthMaterial()
      // o de cópia fica vivo até o fim: descartá-lo soltaria o programa antes de o passe de sombra usá-lo
      if (!o.customDepthMaterial) descartaveis.push(p)
      p.side = lado; p.map = m.map; p.alphaMap = m.alphaMap; p.alphaTest = m.alphaTest
      const copia = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, p) : new THREE.Mesh(o.geometry, p)
      if (o.isSkinnedMesh) copia.bind(o.skeleton, o.bindMatrix)
      sombra.add(copia)
    })
    const tela = renderer.compileAsync(scene, camera)
    renderer.setRenderTarget(alvoSombra)
    const passe = renderer.compileAsync(sombra, sol.shadow.camera, scene)
    renderer.setRenderTarget(null)
    return Promise.all([tela, passe])
  }
  // compilado não é usado ainda: o primeiro uso de cada programa lê do driver os uniformes, em chamadas que esperam o
  // processo da GPU (até ~100 ms com ele ocupado). Feito com a cena parada, não no meio da chuva ou do bafo
  const aquece = () => { if (vivo) for (const p of renderer.info.programs) p.getUniforms() }
  // o ensaio: as mãos, a estrela e as nuvens do bafo desenhadas uma vez num único pixel (tesoura de 1×1), com a sombra:
  // o driver de vídeo termina de montar os shaders, os ossos e as malhas no primeiro desenho de verdade, e o primeiro
  // bafo da página parava ~100 ms nisso. O quadro normal é desenhado logo em seguida, na mesma tarefa
  function ensaia() {
    if (!vivo || batida || segura || !maos.length) return
    const extras = [...maos.map((m) => m.mao), estrela, ...nuvens.map((n) => n.m)]
    extras.forEach((o) => { o.visible = true })
    renderer.shadowMap.needsUpdate = true
    renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1)
    renderer.render(scene, camera)
    renderer.setScissorTest(false)
    extras.forEach((o) => { o.visible = false })
    sombraSuja = true
    desenha()
  }
  // as frentes dos santinhos são desenhadas e enviadas à GPU nos intervalos ociosos, os maiores (que caem antes)
  // primeiro: na chuva, o quadro em que um santinho entra só o posiciona
  function preparaFrentes() {
    const fila = santinhos.filter((s) => !s.frentePronta).sort((a, b) => b.L - a.L)
    const lote = (prazo) => {
      const t0 = performance.now()
      const resta = () => (prazo?.timeRemaining ? prazo.timeRemaining() : 8 - (performance.now() - t0))
      while (fila.length && resta() > 3) {
        const s = fila.shift()
        if (!vivo || s.frentePronta || !santinhos.includes(s)) continue
        frente(s)
        renderer.initTexture(s.folha.material.map)
      }
      if (fila.length && vivo) ocioso(lote)
    }
    ocioso(lote)
  }
  let geracao = 0

  function assentaTodos() {
    for (const s of santinhos) {
      if (!passa(s)) continue
      frente(s)
      s.estado = 'chao'; s.grupo.visible = true; s.pousou = true; s.quique = 0
      s.grupo.position.set(s.x, 0.02, s.z); s.grupo.rotation.y = -s.ang; s.pivo.rotation.set(0, 0, 0)
    }
    pousados = santinhos.filter(s => s.estado === 'chao').length; avisa(); acorda()
  }

  const api = {
    /** Carrega os tipos e faz a chuva (ou já assenta, com movimento reduzido ou chuva = false). */
    mostra(itens, chuva = true) {
      const r = carrega(itens)
      // a chuva começa quando os shaders ficam prontos (compilados em paralelo: o primeiro quadro não trava); uma
      // troca de campanha no meio da espera vale só a última
      const g = ++geracao
      const comeca = () => {
        if (!vivo || g !== geracao) return
        aquece()
        if (chuva && !reduzido.matches) joga(); else assentaTodos()
      }
      preparaFrentes()
      precompila().then(comeca, comeca)
      return r
    },
    joga: () => { liberaAudio(); rearranja(); joga() },
    varre: () => varre(),
    /** Só os santinhos que passam no filtro ficam no chão; os outros o vento leva (e voltam ao tirar o filtro). */
    filtra(fn, jogar = true) {
      filtro = fn
      if (fn) varre(santinhos.filter(s => !fn(s) && s.grupo.visible))
      else if (jogar) joga(santinhos.filter(s => s.estado === 'fora'))
    },
    vira(palavra) {
      const s = santinhos.find(x => x.palavra === palavra); if (!s) return
      liberaAudio()
      if (segura && segura.s === s) { if (segura.fase === 'na-mao') devolve(); return }
      if (s.estado === 'chao') bate(s)
    },
    devolve: () => devolve(),
    destaca(palavra) {
      const s = palavra ? santinhos.find(x => x.palavra === palavra && x.estado === 'chao') : null
      if (sob && sob !== s) sob.ergueAlvo = 0
      sob = s || null; if (s) { s.ergueAlvo = 1; versoQuandoParar(s) }
      acorda()
    },
    som(ligado) { somLigado = ligado; if (ligado) liberaAudio() },
    get noChao() { return pousados },
    // para medir: quantos programas de shader existem (um bafo que cria programa novo compilou no meio da animação)
    get programas() { return renderer.info.programs.length },
    get fase() { return segura ? segura.fase : (batida ? 'bafo' : 'livre') },
    // para os testes das mãos: o ponto mais baixo dos ossos (acima de 0 = não atravessa a mesa) e, com um santinho
    // na mão, de que lado do papel estão as pontas dos dedos (negativo = atrás) e a do polegar (positivo = na frente)
    get maoDebug() {
      // juntas de cada mão: altura no mundo e, com um santinho na mão, o lado da folha (y em relação à superfície
      // curva; + = lado da cola) e se está sobre o contorno dela (só aí trocar de lado é atravessar o papel)
      scene.updateMatrixWorld(true)
      const v = new THREE.Vector3(), inv = new THREE.Matrix4()
      let minY = Infinity
      const juntas = []
      if (segura) inv.copy(segura.s.grupo.matrixWorld).invert()
      maos.forEach((m, i) => {
        if (!m.mao.visible) return
        for (const o of m.ossos) {
          o.getWorldPosition(v); minY = Math.min(minY, v.y)
          if (!segura || o.name === 'wrist') continue
          const l = v.clone().applyMatrix4(inv), ss = segura.s
          juntas.push({ k: i + o.name, y: +(l.y - ss.u.uDobra.value * (2 * l.x / ss.L) ** 2).toFixed(3), x: +(l.x / (ss.L / 2)).toFixed(2), z: +(l.z / (ss.A / 2)).toFixed(2), dentro: Math.abs(l.x) < ss.L / 2 && Math.abs(l.z) < ss.A / 2 })
        }
      })
      return { maos: maos.length, minY: +minY.toFixed(3), juntas }
    },
    // para os testes quadro a quadro: anda a animação n passos de dt segundos e desenha
    avanca: (dt, n = 1) => { for (let i = 0; i < n; i++) { passo(dt); desenha() } },
    destroi() {
      vivo = false; cancelAnimationFrame(quadroId); cancelAnimationFrame(quadroMouse); observador.disconnect(); vigia.disconnect()
      agendadas.length = 0
      window.removeEventListener('keydown', aoTeclar)
      desisteDe(ensaia)
      canvas.removeEventListener('pointermove', aoMover); canvas.removeEventListener('pointerleave', aoSair); canvas.removeEventListener('click', aoClicar)
      palco.removeEventListener('pointermove', aoMoverPalco); palco.removeEventListener('pointerleave', aoSairPalco)
      santinhos.splice(0).forEach(descarta)
      if (piso) piso.traverse(o => { o.geometry?.dispose(); o.material?.dispose() })
      descartaveis.forEach(d => d.dispose())
      // o que o descarte das listas não pega: o mapa de sombra e a textura de ossos de cada mão. O contexto não é
      // forçado a morrer: o canvas é do React e volta na remontagem (StrictMode), e um contexto perdido quebra ela
      sol.shadow.dispose()
      maos.forEach(m => m.esqueleto?.dispose())
      renderer.dispose()
      if (window.__nuvem === api) delete window.__nuvem
    },
  }
  window.__nuvem = api
  return api
}
