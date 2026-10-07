// Urna eletrônica em 3D, modelada a partir da foto oficial do modelo UE2020 (TSE, domínio
// público): corpo de plástico claro e fosco, tela larga em moldura preta no topo, teclado
// numérico grafite com o número branco e o braile em relevo, ressalto tátil na tecla 5 e a
// coluna BRANCO / CORRIGE / CONFIRMA. A área gravada no canto traz o nome do sistema, nunca
// o de um órgão oficial. Inclina com o ponteiro e as teclas afundam no clique ou pelo teclado.
import { Bounds, ContactShadows, Environment, Lightformer, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { VISOR } from './visor'

export type IdTecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'branco' | 'corrige' | 'confirma'

// medidas tiradas da foto (1 unidade = 100 px da foto de 1280 px); origem no centro da face
const CORPO = { w: 7.2, h: 5.0, d: 1.5 }
const FACE = CORPO.d / 2
const COR = { plastico: '#e3e6e8', grafite: '#2a2d31', moldura: '#111315', branco: '#f2f3f1', corrige: '#ee7a21', confirma: '#2fb46c', base: '#3a3f45' }

// ───────── texturas desenhadas em canvas (rótulos, braile, plástico) ─────────

const BRAILE: Record<string, number[]> = {
  '1': [1], '2': [1, 2], '3': [1, 4], '4': [1, 4, 5], '5': [1, 5],
  '6': [1, 2, 4], '7': [1, 2, 4, 5], '8': [1, 2, 5], '9': [2, 4], '0': [2, 4, 5],
}
const SINAL_NUMERO = [3, 4, 5, 6]

/** Pontos de uma cela braile (1-3 na coluna esquerda, 4-6 na direita). */
function cela(c: CanvasRenderingContext2D, x: number, y: number, pontos: number[], r: number) {
  for (const p of pontos) {
    const col = p > 3 ? 1 : 0, lin = (p - 1) % 3
    c.beginPath()
    c.arc(x + col * r * 2.7, y + lin * r * 2.7, r, 0, Math.PI * 2)
    c.fill()
  }
}

function canvas(w: number, h: number) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  return [cv, cv.getContext('2d')!] as const
}

function textura(cv: HTMLCanvasElement, cor = true) {
  const t = new THREE.CanvasTexture(cv)
  if (cor) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

interface Rotulo {
  mapa: THREE.CanvasTexture
  relevo: THREE.CanvasTexture
}
const cache = new Map<string, Rotulo>()

/**
 * Rótulo da tecla: o desenho colorido e um mapa de relevo (os pontos do braile ficam altos).
 * Dígitos: número branco no canto e o braile à direita, como no UE2020.
 * Funções: o nome centralizado e uma fileira de pontos embaixo.
 */
function rotuloTecla(texto: string, corTexto: string, proporcao: number): Rotulo {
  const chave = `${texto}|${corTexto}|${proporcao.toFixed(2)}`
  const pronto = cache.get(chave)
  if (pronto) return pronto
  const H = 160, W = Math.round(H * proporcao)
  const [cv, c] = canvas(W, H)
  const [rv, r] = canvas(W, H)
  r.fillStyle = '#000'
  r.fillRect(0, 0, W, H)
  c.fillStyle = corTexto
  r.fillStyle = '#fff'
  const digito = texto.length === 1
  if (digito) {
    c.font = `700 74px "Archivo Variable", Archivo, Arial, sans-serif`
    c.textBaseline = 'top'
    c.fillText(texto, 18, 14)
    c.globalAlpha = 0.85
    for (const ctx of [c, r]) {
      cela(ctx, W - 92, 30, SINAL_NUMERO, 6.5)
      cela(ctx, W - 50, 30, BRAILE[texto], 6.5)
    }
  } else {
    // o nome tem de caber na tecla com folga: mede e reduz a fonte se preciso
    const fonte = (px: number) => `800 ${px}px "Archivo Variable", Archivo, Arial, sans-serif`
    c.font = fonte(100)
    const px = Math.min(H * 0.34, (100 * W * 0.84) / c.measureText(texto).width)
    c.font = fonte(Math.floor(px))
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(texto, W / 2, H * 0.38)
    c.globalAlpha = 0.55
    for (const ctx of [c, r]) for (let i = 0; i < Math.min(9, texto.length + 2); i++) cela(ctx, W / 2 - 4 * 26 + i * 26, H * 0.72, [1], 5.5)
  }
  const pronto2 = { mapa: textura(cv), relevo: textura(rv, false) }
  cache.set(chave, pronto2)
  return pronto2
}

/** Granulado fino do plástico injetado (relevo e aspereza). */
function texturaPlastico() {
  const [cv, c] = canvas(256, 256)
  const img = c.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 30
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  c.putImageData(img, 0, 0)
  const t = textura(cv, false)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 4)
  return t
}

/** Área gravada no canto esquerdo (no UE2020, o selo e o modelo; aqui, o nome do sistema). */
function texturaGravacao(): Rotulo {
  const W = 512, H = 360
  const [cv, c] = canvas(W, H)
  const [rv, r] = canvas(W, H)
  r.fillStyle = '#808080'
  r.fillRect(0, 0, W, H)
  const tracar = (ctx: CanvasRenderingContext2D, cor: string) => {
    ctx.strokeStyle = cor
    ctx.fillStyle = cor
    ctx.lineWidth = 3
    ctx.strokeRect(6, 6, W - 12, 218)
    ctx.strokeRect(6, 244, W - 12, 108)
    ctx.beginPath()
    ctx.arc(104, 116, 66, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 9 // o visto do símbolo, gravado no selo
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(72, 104)
    ctx.lineTo(97, 146)
    ctx.lineTo(142, 84)
    ctx.stroke()
    ctx.lineWidth = 3
    ctx.font = `600 54px "Archivo Variable", Archivo, Arial, sans-serif`
    ctx.fillText('Voto', 194, 108)
    ctx.fillText('Aberto', 194, 168)
    ctx.font = `600 64px "Archivo Variable", Archivo, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('VA2026', W / 2, 322)
    ctx.textAlign = 'left'
  }
  tracar(c, 'rgba(120,128,136,0.55)')
  tracar(r, '#4a4a4a') // gravado: um pouco abaixo da superfície
  return { mapa: textura(cv), relevo: textura(rv, false) }
}

// ───────── peças ─────────

interface TeclaProps {
  id: IdTecla
  pos: [number, number]
  tam: [number, number]
  cor: string
  rotulo: string
  corRotulo: string
  pulso: number
  ressalto?: boolean
  aoApertar: (id: IdTecla) => void
}

function Tecla({ id, pos, tam, cor, rotulo, corRotulo, pulso, ressalto, aoApertar }: TeclaProps) {
  const ref = useRef<THREE.Group>(null)
  const [sobre, setSobre] = useState(false)
  const apertada = useRef(0)
  const r = useMemo(() => rotuloTecla(rotulo, corRotulo, tam[0] / tam[1]), [rotulo, corRotulo, tam])
  useEffect(() => {
    if (pulso) apertada.current = performance.now()
  }, [pulso])
  useFrame(() => {
    if (!ref.current) return
    const pressionada = performance.now() - apertada.current < 140
    const alvo = pressionada ? -0.07 : sobre ? 0.015 : 0 // curso da tecla mecânica
    ref.current.position.z += (alvo - ref.current.position.z) * 0.4
  })
  const prof = 0.13
  return (
    <group position={[pos[0], pos[1], FACE]}>
      <group ref={ref}>
        <RoundedBox
          args={[tam[0], tam[1], prof]}
          radius={0.035}
          smoothness={3}
          position={[0, 0, prof / 2 - 0.01]}
          castShadow
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            setSobre(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setSobre(false)
            document.body.style.cursor = ''
          }}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            apertada.current = performance.now()
            aoApertar(id)
          }}
        >
          <meshPhysicalMaterial color={cor} roughness={0.42} clearcoat={0.35} clearcoatRoughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0, prof - 0.009]}>
          <planeGeometry args={[tam[0] - 0.05, tam[1] - 0.05]} />
          <meshStandardMaterial map={r.mapa} bumpMap={r.relevo} bumpScale={0.6} transparent roughness={0.5} />
        </mesh>
        {ressalto && (
          <mesh position={[0, -tam[1] * 0.3, prof - 0.004]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.012, 0.07, 4, 8]} />
            <meshStandardMaterial color={cor} roughness={0.4} />
          </mesh>
        )}
      </group>
    </group>
  )
}

function Corpo({ canvas: tela, versao, pulsos, aoApertar }: { canvas: HTMLCanvasElement; versao: number; pulsos: Partial<Record<IdTecla, number>>; aoApertar: (id: IdTecla) => void }) {
  const grupo = useRef<THREE.Group>(null)
  const textura = useMemo(() => {
    const t = new THREE.CanvasTexture(tela)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [tela])
  const grao = useMemo(() => texturaPlastico(), [])
  const gravacao = useMemo(() => texturaGravacao(), [])
  useEffect(() => {
    // padrão do three.js: avisar a GPU que o canvas mudou (mutar a textura é o esperado aqui)
    // oxlint-disable-next-line
    textura.needsUpdate = true
  }, [versao, textura])

  useFrame((estado, dt) => {
    const g = grupo.current
    if (!g) return
    const k = 1 - Math.exp(-dt * 3)
    g.rotation.y += (estado.pointer.x * 0.28 - g.rotation.y) * k
    g.rotation.x += (-0.2 - estado.pointer.y * 0.12 - g.rotation.x) * k
    g.position.y = Math.sin(estado.clock.elapsedTime * 0.8) * 0.04
  })

  // teclado: colunas e linhas medidas na foto
  const colunas = [-0.25, 0.38, 1.01], linhas = [-0.45, -0.86, -1.27, -1.68]
  const digitos: [IdTecla, number, number][] = [
    ['1', 0, 0], ['2', 1, 0], ['3', 2, 0], ['4', 0, 1], ['5', 1, 1], ['6', 2, 1], ['7', 0, 2], ['8', 1, 2], ['9', 2, 2], ['0', 1, 3],
  ]
  return (
    <group ref={grupo} rotation={[-0.2, 0, 0]}>
      {/* corpo de plástico fosco */}
      <RoundedBox args={[CORPO.w, CORPO.h, CORPO.d]} radius={0.2} smoothness={5} castShadow receiveShadow>
        <meshPhysicalMaterial color={COR.plastico} roughness={0.62} roughnessMap={grao} bumpMap={grao} bumpScale={0.004} clearcoat={0.12} clearcoatRoughness={0.7} />
      </RoundedBox>
      {/* base escura e indicadores laterais */}
      <RoundedBox args={[6.6, 0.16, CORPO.d * 0.9]} radius={0.06} position={[0, -CORPO.h / 2 - 0.05, -0.05]} castShadow>
        <meshStandardMaterial color={COR.base} roughness={0.7} />
      </RoundedBox>
      {[-1, 1].map((l) => (
        <mesh key={l} position={[l * (CORPO.w / 2 - 0.09), -1.12, FACE + 0.001]}>
          <planeGeometry args={[0.07, 0.12]} />
          <meshStandardMaterial color="#4a4f55" roughness={0.6} />
        </mesh>
      ))}
      {/* moldura preta da tela, encostada no topo */}
      <RoundedBox args={[5.45, 2.5, 0.05]} radius={0.04} smoothness={2} position={[-0.03, CORPO.h / 2 - 1.25 - 0.03, FACE + 0.02]}>
        <meshPhysicalMaterial color={COR.moldura} roughness={0.3} clearcoat={0.6} clearcoatRoughness={0.2} />
      </RoundedBox>
      {/* tela TFT com a consulta */}
      <mesh position={[-0.03, CORPO.h / 2 - 1.24, FACE + 0.047]}>
        <planeGeometry args={[4.55, (4.55 * VISOR.altura) / VISOR.largura]} />
        <meshBasicMaterial map={textura} toneMapped={false} />
      </mesh>
      {/* vidro: só um brilho sutil por cima */}
      <mesh position={[-0.03, CORPO.h / 2 - 1.26, FACE + 0.05]}>
        <planeGeometry args={[5.4, 2.47]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.07} roughness={0.06} metalness={0} clearcoat={1} depthWrite={false} />
      </mesh>
      {/* área gravada */}
      <mesh position={[-1.62, -1.32, FACE + 0.002]}>
        <planeGeometry args={[1.7, 1.2]} />
        <meshStandardMaterial map={gravacao.mapa} bumpMap={gravacao.relevo} bumpScale={0.8} transparent roughness={0.62} />
      </mesh>
      {/* teclado numérico */}
      {digitos.map(([id, c, l]) => (
        <Tecla key={id} id={id} pos={[colunas[c], linhas[l]]} tam={[0.5, 0.34]} cor={COR.grafite} rotulo={id} corRotulo="#ffffff" ressalto={id === '5'} pulso={pulsos[id] ?? 0} aoApertar={aoApertar} />
      ))}
      <Tecla id="branco" pos={[1.8, linhas[0]]} tam={[0.76, 0.34]} cor={COR.branco} rotulo="BRANCO" corRotulo="#141414" pulso={pulsos.branco ?? 0} aoApertar={aoApertar} />
      <Tecla id="corrige" pos={[1.8, linhas[1]]} tam={[0.76, 0.34]} cor={COR.corrige} rotulo="CORRIGE" corRotulo="#141414" pulso={pulsos.corrige ?? 0} aoApertar={aoApertar} />
      <Tecla id="confirma" pos={[1.8, -1.34]} tam={[0.76, 0.48]} cor={COR.confirma} rotulo="CONFIRMA" corRotulo="#141414" pulso={pulsos.confirma ?? 0} aoApertar={aoApertar} />
    </group>
  )
}

export default function Urna3D(props: { canvas: HTMLCanvasElement; versao: number; pulsos: Partial<Record<IdTecla, number>>; aoApertar: (id: IdTecla) => void }) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.5, 11], fov: 32 }}
      role="img"
      aria-label="Urna eletrônica em 3D, no estilo do modelo UE2020. A tela mostra a consulta digitada no campo ao lado."
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      {/* estúdio claro: reflexos suaves no plástico e no vidro, sem baixar nada da rede */}
      <Environment resolution={128}>
        <Lightformer intensity={2.2} position={[0, 4, 6]} scale={[12, 4, 1]} />
        <Lightformer intensity={0.9} position={[-6, 1, 3]} rotation-y={Math.PI / 3} scale={[6, 6, 1]} />
        <Lightformer intensity={0.7} position={[6, 0, 2]} rotation-y={-Math.PI / 3} scale={[6, 6, 1]} />
        <Lightformer intensity={0.4} position={[0, -5, 2]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} color="#dfe5ea" />
      </Environment>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 7, 8]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <Bounds fit clip observe margin={1.1}>
        <Corpo {...props} />
      </Bounds>
      <ContactShadows position={[0, -2.75, 0]} opacity={0.32} scale={13} blur={2.4} far={4} color="#2a3550" />
    </Canvas>
  )
}
