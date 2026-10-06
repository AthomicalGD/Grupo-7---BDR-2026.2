// Urna eletrônica em 3D, modelada com primitivas: corpo, visor (textura do canvas), teclado
// numérico e as teclas BRANCO, CORRIGE e CONFIRMA nas cores da urna real.
// Inclina com o ponteiro, flutua em repouso e as teclas afundam no clique ou pelo teclado.
import { Bounds, ContactShadows, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { VISOR } from './visor'

export type IdTecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'branco' | 'corrige' | 'confirma'

const rotulos = new Map<string, THREE.CanvasTexture>()
function texturaRotulo(texto: string, cor: string, tamanho = 120, largura = 256) {
  const chave = `${texto}|${cor}|${tamanho}|${largura}`
  let t = rotulos.get(chave)
  if (!t) {
    const cv = document.createElement('canvas')
    cv.width = largura
    cv.height = 128
    const c = cv.getContext('2d')!
    c.fillStyle = cor
    c.font = `900 ${tamanho}px "Archivo Variable", Archivo, system-ui, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(texto, largura / 2, 70)
    t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    rotulos.set(chave, t)
  }
  return t
}

interface TeclaProps {
  id: IdTecla
  pos: [number, number]
  tam: [number, number]
  cor: string
  rotulo: string
  corRotulo: string
  tamRotulo?: number
  pulso: number
  aoApertar: (id: IdTecla) => void
}

function Tecla({ id, pos, tam, cor, rotulo, corRotulo, tamRotulo = 120, pulso, aoApertar }: TeclaProps) {
  const ref = useRef<THREE.Group>(null)
  const [sobre, setSobre] = useState(false)
  const apertada = useRef(0)
  useEffect(() => {
    if (pulso) apertada.current = performance.now()
  }, [pulso])
  useFrame(() => {
    if (!ref.current) return
    const pressionada = performance.now() - apertada.current < 150
    const alvo = pressionada ? -0.09 : sobre ? 0.025 : 0
    ref.current.position.z += (alvo - ref.current.position.z) * 0.35
  })
  const larguraTextura = tam[0] / tam[1] > 2 ? 512 : 256
  return (
    <group position={[pos[0], pos[1], 0.72]}>
      <group ref={ref}>
        <RoundedBox
          args={[tam[0], tam[1], 0.2]}
          radius={0.06}
          smoothness={3}
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
          <meshStandardMaterial color={cor} roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, -0.01, 0.105]}>
          <planeGeometry args={[tam[0] * 0.92, (tam[0] * 0.92 * 128) / larguraTextura]} />
          <meshBasicMaterial map={texturaRotulo(rotulo, corRotulo, tamRotulo, larguraTextura)} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function Corpo({ canvas, versao, pulsos, aoApertar }: { canvas: HTMLCanvasElement; versao: number; pulsos: Partial<Record<IdTecla, number>>; aoApertar: (id: IdTecla) => void }) {
  const grupo = useRef<THREE.Group>(null)
  const textura = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [canvas])
  useEffect(() => {
    // padrão do three.js: avisar a GPU que o canvas mudou (mutar a textura é o esperado aqui)
    // oxlint-disable-next-line
    textura.needsUpdate = true
  }, [versao, textura])

  useFrame((estado, dt) => {
    const g = grupo.current
    if (!g) return
    const k = 1 - Math.exp(-dt * 3)
    g.rotation.y += (estado.pointer.x * 0.32 - g.rotation.y) * k
    g.rotation.x += (-0.26 - estado.pointer.y * 0.14 - g.rotation.x) * k
    g.position.y = Math.sin(estado.clock.elapsedTime * 0.9) * 0.07
  })

  const digitos: [IdTecla, number, number][] = [
    ['1', 0, 0], ['2', 1, 0], ['3', 2, 0], ['4', 0, 1], ['5', 1, 1], ['6', 2, 1], ['7', 0, 2], ['8', 1, 2], ['9', 2, 2], ['0', 1, 3],
  ]
  const kx = 2.42, ky = 1.62 // canto superior esquerdo do teclado
  return (
    <group ref={grupo} rotation={[-0.26, 0, 0]}>
      <RoundedBox args={[7.6, 4.9, 1.3]} radius={0.32} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color="#e2e6e9" roughness={0.55} metalness={0.02} />
      </RoundedBox>
      {/* base escura, como a da urna */}
      <RoundedBox args={[7.0, 0.42, 1.05]} radius={0.16} smoothness={3} position={[0, -2.6, -0.06]} castShadow>
        <meshStandardMaterial color="#2b3442" roughness={0.6} />
      </RoundedBox>
      {/* rótulo da marca */}
      <mesh position={[-1.45, 2.08, 0.655]}>
        <planeGeometry args={[2.6, 0.325]} />
        <meshBasicMaterial map={texturaRotulo('VOTO ABERTO', '#4b5566', 74, 1024)} transparent toneMapped={false} />
      </mesh>
      {/* moldura e visor */}
      <RoundedBox args={[4.55, 3.42, 0.14]} radius={0.16} smoothness={3} position={[-1.3, 0.12, 0.62]}>
        <meshStandardMaterial color="#2b3442" roughness={0.4} />
      </RoundedBox>
      <mesh position={[-1.3, 0.12, 0.695]}>
        <planeGeometry args={[4.2, (4.2 * VISOR.altura) / VISOR.largura]} />
        <meshBasicMaterial map={textura} toneMapped={false} />
      </mesh>
      {/* fenda do boletim */}
      <RoundedBox args={[3.6, 0.16, 0.06]} radius={0.05} position={[-1.3, -1.92, 0.64]}>
        <meshStandardMaterial color="#1a212b" roughness={0.8} />
      </RoundedBox>
      {/* teclado */}
      <RoundedBox args={[2.5, 4.28, 0.12]} radius={0.16} smoothness={3} position={[2.48, 0, 0.62]}>
        <meshStandardMaterial color="#2b3442" roughness={0.45} />
      </RoundedBox>
      {digitos.map(([id, c, l]) => (
        <Tecla key={id} id={id} pos={[kx - 0.68 + c * 0.68, ky - l * 0.6]} tam={[0.56, 0.46]} cor="#f4f5f2" rotulo={id} corRotulo="#18202b" pulso={pulsos[id] ?? 0} aoApertar={aoApertar} />
      ))}
      <Tecla id="branco" pos={[kx - 0.52, ky - 2.58]} tam={[0.94, 0.46]} cor="#f4f5f2" rotulo="BRANCO" corRotulo="#18202b" tamRotulo={66} pulso={pulsos.branco ?? 0} aoApertar={aoApertar} />
      <Tecla id="corrige" pos={[kx + 0.52, ky - 2.58]} tam={[0.94, 0.46]} cor="#e5732a" rotulo="CORRIGE" corRotulo="#18202b" tamRotulo={66} pulso={pulsos.corrige ?? 0} aoApertar={aoApertar} />
      <Tecla id="confirma" pos={[kx, ky - 3.26]} tam={[1.98, 0.6]} cor="#3f7f2a" rotulo="CONFIRMA" corRotulo="#ffffff" tamRotulo={84} pulso={pulsos.confirma ?? 0} aoApertar={aoApertar} />
    </group>
  )
}

export default function Urna3D(props: { canvas: HTMLCanvasElement; versao: number; pulsos: Partial<Record<IdTecla, number>>; aoApertar: (id: IdTecla) => void }) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.6, 11.2], fov: 33 }}
      role="img"
      aria-label="Urna eletrônica em 3D. O visor mostra a consulta digitada no campo ao lado."
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      <hemisphereLight args={['#ffffff', '#c7ced6', 1.1]} />
      <directionalLight position={[4, 7, 8]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 2, 4]} intensity={0.35} />
      {/* enquadra a urna inteira em qualquer proporção de tela */}
      <Bounds fit clip observe margin={1.12}>
        <Corpo {...props} />
      </Bounds>
      <ContactShadows position={[0, -3.1, 0]} opacity={0.28} scale={14} blur={2.6} far={4.5} color="#2a3550" />
    </Canvas>
  )
}
