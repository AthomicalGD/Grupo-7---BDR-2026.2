// Relevo do voto: municípios extrudados, altura = eleitorado apto (raiz quadrada, para que a
// capital não esconda o resto), cor = viés. Orbita com o mouse; clique abre o boletim.
//
// Todas as colunas são uma malha só: um desenho por quadro, não um por município (eram até 853, e girar o mapa gastava
// o quadro trocando material e uniforme de cada uma). A altura, a cor e o brilho de cada município moram numa textura
// de dados que o shader lê; animar a troca de ano é escrever ~850 números nela. O município sob o ponteiro sai de um
// teste de caixas e, só nas poucas candidatas, de triângulos (o raycast do three em centenas de malhas travava o giro).
import { Bounds, Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { geoConicEqualArea } from 'd3-geo'
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Ano, Malha, UFDetalhe } from '../api'
import { inteiro, vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'
import { SATURA_RELATIVO, valorMunicipio } from '../atlas/valores'

const LADO = 100       // o estado cabe num quadrado de 100 unidades
const ALTURA_MAX = 14
const PASSO_MIN = 0.4 // descarta vértices mais próximos que isso (o relevo não precisa da malha máxima)

/** As colunas de uma malha, prontas para desenhar: uma geometria só, com o índice do município em cada vértice. */
export interface Relevo {
  geometria: THREE.BufferGeometry
  ibges: number[]
  indice: Map<number, number>
  /** centro (x, y) de cada município, para a etiqueta */
  centros: Float32Array
  /** caixa (x0, y0, x1, y1) de cada município, para achar o apontado */
  caixas: Float32Array
  /** primeiro vértice e quantos vértices de cada município */
  faixas: Uint32Array
}

function anelParaPontos(anel: number[][], proj: (p: [number, number]) => [number, number] | null) {
  const pts: THREE.Vector2[] = []
  let ultimo: [number, number] | null = null
  for (const c of anel) {
    const p = proj(c as [number, number])
    if (!p) continue
    if (ultimo && Math.hypot(p[0] - ultimo[0], p[1] - ultimo[1]) < PASSO_MIN) continue
    pts.push(new THREE.Vector2(p[0], -p[1]))
    ultimo = p
  }
  return pts
}

// cede a vez ao navegador (o quadro e o clique passam na frente) entre um lote de extrusões e outro
const folga = () => {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  return s?.yield ? s.yield() : new Promise<void>((r) => setTimeout(r, 0))
}

// as colunas já montadas de cada malha: reabrir o 3D (ou trocar de ano) não remonta as extrusões
const montados = new WeakMap<Malha, Promise<Relevo>>()

function construir(malha: Malha): Promise<Relevo> {
  let p = montados.get(malha)
  if (!p) {
    p = extrudar(malha)
    montados.set(malha, p)
  }
  return p
}

async function extrudar(malha: Malha): Promise<Relevo> {
  // o enquadramento sai de uma amostra dos vértices: projetar a malha inteira só para medir custava ~50 ms
  const amostra: number[][] = []
  for (const f of malha.features) {
    const g = f.geometry
    for (const pol of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) for (let i = 0; i < pol[0].length; i += 6) amostra.push(pol[0][i])
  }
  const proj = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0])
    .fitExtent([[-LADO / 2, -LADO / 2], [LADO / 2, LADO / 2]], { type: 'MultiPoint', coordinates: amostra })
  const p = (c: [number, number]) => proj(c) as [number, number] | null
  const n = malha.features.length
  const partes: { pos: ArrayLike<number>; nor: ArrayLike<number> }[] = []
  const ibges: number[] = []
  const centros = new Float32Array(n * 2)
  const caixas = new Float32Array(n * 4)
  let t0 = performance.now()
  for (let i = 0; i < n; i++) {
    const f = malha.features[i]
    const g = f.geometry
    const formas: THREE.Shape[] = []
    for (const poligono of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      const [externo, ...buracos] = poligono
      const pts = anelParaPontos(externo, p)
      if (pts.length < 3) continue
      const forma = new THREE.Shape(pts)
      for (const b of buracos) {
        const bp = anelParaPontos(b, p)
        if (bp.length >= 3) forma.holes.push(new THREE.Path(bp))
      }
      formas.push(forma)
    }
    const e = new THREE.ExtrudeGeometry(formas, { depth: 1, bevelEnabled: false })
    e.computeBoundingBox()
    const bb = e.boundingBox!
    caixas.set([bb.min.x, bb.min.y, bb.max.x, bb.max.y], i * 4)
    centros.set([(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2], i * 2)
    partes.push({ pos: e.attributes.position.array, nor: e.attributes.normal.array })
    ibges.push(f.properties.codarea)
    // um lote por fatia de ~8 ms: o estado grande (853 municípios) não vira uma tarefa longa
    if (performance.now() - t0 > 8) {
      await folga()
      t0 = performance.now()
    }
  }
  const total = partes.reduce((s, x) => s + x.pos.length / 3, 0)
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), mun = new Float32Array(total)
  const faixas = new Uint32Array(n * 2)
  let v = 0
  partes.forEach((x, i) => {
    const q = x.pos.length / 3
    pos.set(x.pos, v * 3)
    nor.set(x.nor, v * 3)
    mun.fill(i, v, v + q)
    faixas[i * 2] = v
    faixas[i * 2 + 1] = q
    v += q
  })
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometria.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geometria.setAttribute('municipio', new THREE.BufferAttribute(mun, 1))
  geometria.computeBoundingBox()
  geometria.computeBoundingSphere()
  return { geometria, ibges, indice: new Map(ibges.map((c, i) => [c, i])), centros, caixas, faixas }
}

// No shader: a altura do município estica a coluna (a extrusão tem 1 de profundidade), a cor tinge e o brilho acende o
// destaque. As normais não mudam (as paredes são verticais e as tampas, horizontais).
const LE_DADOS = `
  vec4 dadoColuna = texelFetch(uDados, ivec2(int(municipio), 0), 0);
  transformed.z *= dadoColuna.a;`

function materiais(textura: THREE.DataTexture) {
  const uDados = { value: textura }
  const cor = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02, emissive: '#f7c21a' })
  cor.onBeforeCompile = (s) => {
    s.uniforms.uDados = uDados
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float municipio;\nuniform sampler2D uDados;\nvarying vec3 vCor;\nvarying float vBrilho;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>${LE_DADOS}
  vCor = dadoColuna.rgb;
  vBrilho = texelFetch(uDados, ivec2(int(municipio), 1), 0).r;`)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCor;\nvarying float vBrilho;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vCor;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vBrilho;')
  }
  // a sombra precisa da mesma altura: senão o mapa de sombras veria as colunas achatadas
  const profundidade = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  profundidade.onBeforeCompile = (s) => {
    s.uniforms.uDados = uDados
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float municipio;\nuniform sampler2D uDados;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>${LE_DADOS}`)
  }
  return { cor, profundidade }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3()

/** O município sob o raio (no espaço das colunas: x, y no plano, z para cima até a altura atual), ou -1. */
function achaMunicipio(r: Relevo, altura: (i: number) => number, raio: THREE.Ray) {
  const o = raio.origin, d = raio.direction
  const ix = 1 / d.x, iy = 1 / d.y, iz = 1 / d.z
  const candidatas: number[] = [] // pares (entrada, índice)
  for (let i = 0; i < r.ibges.length; i++) {
    let t0 = (r.caixas[i * 4] - o.x) * ix, t1 = (r.caixas[i * 4 + 2] - o.x) * ix
    if (t0 > t1) [t0, t1] = [t1, t0]
    let u0 = (r.caixas[i * 4 + 1] - o.y) * iy, u1 = (r.caixas[i * 4 + 3] - o.y) * iy
    if (u0 > u1) [u0, u1] = [u1, u0]
    let w0 = -o.z * iz, w1 = (altura(i) - o.z) * iz
    if (w0 > w1) [w0, w1] = [w1, w0]
    const entra = Math.max(t0, u0, w0, 0), sai = Math.min(t1, u1, w1)
    if (sai >= entra) candidatas.push(entra, i)
  }
  const ordem = Array.from({ length: candidatas.length / 2 }, (_, k) => k).sort((a, b) => candidatas[a * 2] - candidatas[b * 2])
  const pos = r.geometria.attributes.position.array
  let melhor = -1, perto = Infinity
  for (const k of ordem) {
    if (candidatas[k * 2] > perto) break // as próximas caixas começam depois do triângulo já achado
    const i = candidatas[k * 2 + 1], h = altura(i)
    const ini = r.faixas[i * 2], fim = ini + r.faixas[i * 2 + 1]
    for (let v = ini; v < fim; v += 3) {
      _a.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2] * h)
      _b.set(pos[v * 3 + 3], pos[v * 3 + 4], pos[v * 3 + 5] * h)
      _c.set(pos[v * 3 + 6], pos[v * 3 + 7], pos[v * 3 + 8] * h)
      if (raio.intersectTriangle(_a, _b, _c, false, _p)) {
        const t = _p.distanceTo(o)
        if (t < perto) { perto = t; melhor = i }
      }
    }
  }
  return melhor
}

interface PropsColunas {
  relevo: Relevo
  /** por índice do relevo */
  alturas: ArrayLike<number>
  cores: string[]
  selecionado?: number | null
  sobre: number | null
  aoPassar: (ibge: number | null) => void
  aoEscolher: (ibge: number) => void
}

/** O estado animado das colunas: [r, g, b, altura] na linha 0 da textura e [brilho] na linha 1, e o alvo de cada um. */
class AnimacaoColunas {
  readonly dados: Float32Array
  readonly textura: THREE.DataTexture
  private readonly alvo: Float32Array
  private readonly n: number
  private primeira = true
  andando = true

  constructor(n: number) {
    this.n = n
    this.dados = new Float32Array(n * 8)
    for (let i = 0; i < n; i++) this.dados[i * 4 + 3] = 0.001 // nascem rentes ao chão
    this.alvo = new Float32Array(n * 5)
    this.textura = new THREE.DataTexture(this.dados, n, 2, THREE.RGBAFormat, THREE.FloatType)
    this.textura.magFilter = this.textura.minFilter = THREE.NearestFilter
    this.textura.needsUpdate = true
  }

  altura(i: number) {
    return this.dados[i * 4 + 3]
  }

  /** O novo alvo; diz se algo mudou (o pai pode redesenhar com os mesmos valores: aí nenhum quadro é pedido). */
  poeAlvo(alturas: ArrayLike<number>, cores: string[], iSel: number, iSobre: number) {
    const cor = new THREE.Color()
    let mudou = this.primeira
    for (let i = 0; i < this.n; i++) {
      cor.set(cores[i])
      const novo = [cor.r, cor.g, cor.b, alturas[i], i === iSel || i === iSobre ? 0.35 : 0]
      for (let c = 0; c < 5; c++) if (this.alvo[i * 5 + c] !== novo[c]) { this.alvo[i * 5 + c] = novo[c]; mudou = true }
      // a cor da primeira vez entra pronta (a coluna é que cresce)
      if (this.primeira) this.dados.set(novo.slice(0, 3), i * 4)
    }
    this.primeira = false
    if (mudou) this.andando = true
    return mudou
  }

  /** Um passo do amortecimento (o mesmo das colunas de antes); diz se alguma altura mudou (a sombra é refeita). */
  passo(dt: number) {
    const k = 1 - Math.exp(-Math.min(dt, 1 / 30) * 5.5)
    const { dados, alvo, n } = this
    let longe = false, cresce = false
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 4; c++) {
        const j = i * 4 + c, falta = alvo[i * 5 + c] - dados[j]
        if (falta === 0) continue
        const parado = c === 3 ? Math.abs(falta) < 0.01 : Math.abs(falta) < 0.0015
        dados[j] = parado ? alvo[i * 5 + c] : dados[j] + falta * k
        if (!parado) longe = true
        if (c === 3) cresce = true
      }
      const j = (n + i) * 4, falta = alvo[i * 5 + 4] - dados[j]
      if (falta !== 0) {
        dados[j] = Math.abs(falta) < 0.01 ? alvo[i * 5 + 4] : dados[j] + falta * k
        if (Math.abs(falta) >= 0.01) longe = true
      }
    }
    this.textura.needsUpdate = true
    this.andando = longe
    return cresce
  }
}

// a sombra só é refeita enquanto as colunas mudam de altura; paradas (ou só acendendo), ela fica congelada
function congelaSombra(gl: THREE.WebGLRenderer) {
  gl.shadowMap.autoUpdate = false
  gl.shadowMap.needsUpdate = true
}
function refazSombra(gl: THREE.WebGLRenderer) {
  gl.shadowMap.needsUpdate = true
}

/** As colunas: crescem do chão e acompanham as trocas com amortecimento; só pedem quadro enquanto andam. */
function Colunas({ relevo, alturas, cores, selecionado, sobre, aoPassar, aoEscolher }: PropsColunas) {
  const n = relevo.ibges.length
  const gl = useThree((s) => s.gl)
  // os eventos chegam na caixa do canvas (é nela que a órbita prende o ponteiro ao arrastar)
  const fonte = useThree((s) => s.events.connected) as HTMLElement | undefined
  const cena = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidar = useThree((s) => s.invalidate)
  const malha = useRef<THREE.Mesh>(null)
  const anim = useMemo(() => new AnimacaoColunas(n), [n])
  const mats = useMemo(() => materiais(anim.textura), [anim])
  useEffect(() => () => { mats.cor.dispose(); mats.profundidade.dispose(); anim.textura.dispose() }, [mats, anim])

  // o alvo: a cor e a altura de cada município, e o brilho do escolhido e do apontado
  useEffect(() => {
    const iSel = selecionado != null ? relevo.indice.get(selecionado) ?? -1 : -1
    const iSobre = sobre != null ? relevo.indice.get(sobre) ?? -1 : -1
    if (anim.poeAlvo(alturas, cores, iSel, iSobre)) invalidar()
  }, [relevo, alturas, cores, selecionado, sobre, anim, invalidar])

  useEffect(() => congelaSombra(gl), [gl])

  useFrame((_, dt) => {
    if (!anim.andando) return
    if (anim.passo(dt)) refazSombra(gl)
    if (anim.andando) invalidar()
  })

  // o shader é compilado em paralelo (KHR_parallel_shader_compile) antes do primeiro desenho: sem a travada da
  // compilação no meio da página (a malha fica escondida até lá)
  const [pronta, setPronta] = useState(false)
  useEffect(() => {
    let vivo = true
    gl.compileAsync(cena, camera).then(() => { if (vivo) { setPronta(true); invalidar() } })
    return () => { vivo = false }
  }, [gl, cena, camera, invalidar])

  // o ponteiro: no máximo um teste por quadro, nenhum durante o giro (arrastando)
  const aoPassarRef = useRef(aoPassar), aoEscolherRef = useRef(aoEscolher)
  useEffect(() => { aoPassarRef.current = aoPassar; aoEscolherRef.current = aoEscolher })
  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4(), raio = new THREE.Ray()
    const altura = (i: number) => anim.altura(i)
    const aponta = (x: number, y: number) => {
      const m = malha.current
      if (!m) return -1
      const r = el.getBoundingClientRect()
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      raio.copy(raycaster.ray).applyMatrix4(inv.copy(m.matrixWorld).invert())
      return achaMunicipio(relevo, altura, raio)
    }
    let atual = -1, quadro = 0, ultimo: PointerEvent | null = null
    let apertou: { i: number; x: number; y: number } | null = null
    const marca = (i: number) => {
      if (i === atual) return
      atual = i
      el.style.cursor = i >= 0 ? 'pointer' : '' // no canvas, não no body: mudar o body recalculava o estilo da página
      aoPassarRef.current(i >= 0 ? relevo.ibges[i] : null)
    }
    const mover = (e: PointerEvent) => {
      if (apertou && Math.hypot(e.clientX - apertou.x, e.clientY - apertou.y) >= 6) { apertou = null; marca(-1) }
      if (e.buttons) return
      ultimo = e
      quadro ||= requestAnimationFrame(() => { quadro = 0; if (ultimo) marca(aponta(ultimo.clientX, ultimo.clientY)) })
    }
    // vale o município onde o ponteiro APERTOU, se ele não andou 6 px até soltar: girar (arrastar) não abre nada
    const apertar = (e: PointerEvent) => { if (e.button === 0) apertou = { i: aponta(e.clientX, e.clientY), x: e.clientX, y: e.clientY } }
    const soltar = (e: PointerEvent) => {
      const a = apertou
      apertou = null
      if (a && a.i >= 0 && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 6) aoEscolherRef.current(relevo.ibges[a.i])
    }
    const sair = () => { ultimo = null; marca(-1) }
    const alvo = fonte ?? el
    alvo.addEventListener('pointermove', mover)
    alvo.addEventListener('pointerdown', apertar)
    alvo.addEventListener('pointerleave', sair)
    window.addEventListener('pointerup', soltar)
    return () => {
      cancelAnimationFrame(quadro)
      alvo.removeEventListener('pointermove', mover)
      alvo.removeEventListener('pointerdown', apertar)
      alvo.removeEventListener('pointerleave', sair)
      window.removeEventListener('pointerup', soltar)
      el.style.cursor = ''
    }
  }, [gl, fonte, camera, relevo, anim])

  return (
    <mesh
      ref={malha}
      geometry={relevo.geometria}
      material={mats.cor}
      customDepthMaterial={mats.profundidade}
      dispose={null} // a geometria fica guardada para a próxima vez (construir); não descartar ao desmontar
      frustumCulled={false} // a caixa da geometria é a da extrusão rasa; o shader é que estica as colunas
      visible={pronta}
      castShadow
      receiveShadow
    />
  )
}

/** Fundo, luz, chão das sombras e órbita, iguais nos dois relevos (o do atlas e o da escolaridade). */
export function PalcoRelevo({ rotulo, margem, legenda, children }: { rotulo: string; margem: number; legenda: ReactNode; children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_70%_55%_at_50%_92%,#fff6d6_0%,transparent_70%),linear-gradient(180deg,#e4edf3_0%,#f1f5f6_48%,#f6f8ef_100%)]">
      <Canvas frameloop="demand" shadows="percentage" dpr={[1, 1.5]} camera={{ position: [0, 78, 92], fov: 38, near: 1, far: 800 }} aria-label={rotulo}>
        <hemisphereLight args={['#ffffff', '#cfd6e2', 1.05]} />
        <directionalLight position={[60, 120, 40]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} />
        {/* as colunas chegam quando a extrusão termina (em fatias, sem travar a página); o resto da cena já está lá */}
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={margem}>
            <group rotation={[-Math.PI / 2, 0, 0]}>{children}</group>
          </Bounds>
        </Suspense>
        {/* chão das sombras fora do Bounds, para não entrar no enquadramento */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[LADO * 1.6, LADO * 1.6]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
        <OrbitControls makeDefault enablePan={false} minDistance={50} maxDistance={220} minPolarAngle={0.25} maxPolarAngle={1.25} />
      </Canvas>
      {legenda}
    </div>
  )
}

/** As colunas de uma malha com a etiqueta do apontado: o miolo comum aos dois relevos. */
export function RelevoDe({ malha, altura, cor, selecionado, aoEscolher, etiqueta }: {
  malha: Malha
  altura: (ibge: number) => number
  cor: (ibge: number) => string
  selecionado?: number | null
  aoEscolher: (ibge: number) => void
  etiqueta: (ibge: number) => ReactNode
}) {
  const relevo = use(construir(malha))
  const [sobre, setSobre] = useState<number | null>(null)
  const alturas = useMemo(() => relevo.ibges.map(altura), [relevo, altura])
  const cores = useMemo(() => relevo.ibges.map(cor), [relevo, cor])
  const i = sobre != null ? relevo.indice.get(sobre) : undefined
  return (
    <>
      <Colunas relevo={relevo} alturas={alturas} cores={cores} selecionado={selecionado} sobre={sobre} aoPassar={setSobre} aoEscolher={aoEscolher} />
      {i != null && sobre != null && (
        <Html position={[relevo.centros[i * 2], relevo.centros[i * 2 + 1], alturas[i] + 1.5]} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none w-max -translate-y-8 rounded-xl border border-linha bg-folha/95 px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
            {etiqueta(sobre)}
          </div>
        </Html>
      )}
    </>
  )
}

interface Props {
  malha: Malha
  uf: UFDetalhe
  ano: Ano
  relativo: boolean
  ibge?: number
  aoEscolher: (ibge: number) => void
}

export default function Relevo3D({ malha, uf, ano, relativo, ibge, aoEscolher }: Props) {
  const porIbge = useMemo(() => new Map(uf.municipios.map((m) => [m.ibge, m])), [uf])
  const maxAptos = useMemo(() => Math.max(1, ...uf.municipios.map((m) => m.aptos[ano] ?? 0)), [uf, ano])
  const vUF = uf.vies[ano]
  const altura = useCallback((c: number) => 0.35 + Math.sqrt((porIbge.get(c)?.aptos[ano] ?? 0) / maxAptos) * ALTURA_MAX, [porIbge, ano, maxAptos])
  const cor = useCallback((c: number) => {
    const v = valorMunicipio(porIbge.get(c), ano, relativo, vUF)
    return v == null ? '#dfe3e7' : corVies(v, relativo ? SATURA_RELATIVO : undefined)
  }, [porIbge, ano, relativo, vUF])
  const etiqueta = useCallback((c: number) => {
    const m = porIbge.get(c)
    return m && (
      <>
        <p className="font-bold">{m.nome}</p>
        <p className="tabular">viés {fmtVies(m.vies[ano])} · {inteiro(m.aptos[ano])} eleitores</p>
      </>
    )
  }, [porIbge, ano])
  return (
    <PalcoRelevo
      rotulo={`Relevo 3D dos municípios de ${uf.nome} em ${ano}`}
      margem={1.08}
      legenda={
        <p className="pointer-events-none absolute bottom-3 left-4 rounded-full bg-folha/85 px-3 py-1 text-[0.75rem] font-semibold text-tinta-2">
          Altura: eleitores aptos em {ano} · arraste para girar
        </p>
      }
    >
      <RelevoDe malha={malha} altura={altura} cor={cor} selecionado={ibge} aoEscolher={aoEscolher} etiqueta={etiqueta} />
    </PalcoRelevo>
  )
}
