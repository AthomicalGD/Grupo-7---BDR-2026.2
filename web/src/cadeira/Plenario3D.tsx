// Plenário em pé: cada cadeira sobe numa coluna com altura proporcional ao gasto (linear, para que
// a diferença de dinheiro apareça do tamanho que é). Mesmo lugar e mesma cor do plano.
// Colunas, assentos e encostos são InstancedMesh: até ~1.500 cadeiras sem pesar.
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Assento } from '../api'
import { CartaoAssento } from './Plenario'
import { hemiciclo, ordenar, posicionar, type EscalaGasto, type Ordem } from './geometria'

const R = 10, ALTURA = 5.2

interface Props {
  chave: string
  cadeiras: Assento[]
  escala: EscalaGasto
  fator: number
  ordem: Ordem
  aoAbrir: (id: number) => void
}

const caixa = new THREE.BoxGeometry(1, 1, 1)
const tmp = new THREE.Object3D()

function Bancada({ chave, cadeiras, escala, ordem, aoPassar, aoAbrir }: Omit<Props, 'fator'> & {
  aoPassar: (i: number | null, e?: ThreeEvent<PointerEvent>) => void
}) {
  const lista = useMemo(() => ordenar(cadeiras, ordem), [cadeiras, ordem])
  const { lugares, diametro } = useMemo(() => hemiciclo(lista.length), [lista.length])
  const max = useMemo(() => Math.max(1, ...lista.map((a) => a.gasto)), [lista])
  const colunas = useRef<THREE.InstancedMesh>(null)
  const assentos = useRef<THREE.InstancedMesh>(null)
  const encostos = useRef<THREE.InstancedMesh>(null)
  const progresso = useRef(0)
  const reduz = useReducedMotion()
  const invalidar = useThree((s) => s.invalidate)
  const d = diametro * R
  // com centenas de cadeiras os assentos viram uma mancha escura: fica só a coluna
  const assentosVisiveis = lista.length <= 300

  useLayoutEffect(() => {
    progresso.current = 0
    const cor = new THREE.Color()
    tmp.scale.setScalar(0)
    tmp.updateMatrix()
    lista.forEach((a, i) => {
      colunas.current!.setColorAt(i, cor.set(escala.cor(a.gasto)))
      for (const m of [colunas, assentos, encostos]) m.current!.setMatrixAt(i, tmp.matrix)
    })
    colunas.current!.instanceColor!.needsUpdate = true
    invalidar()
  }, [lista, escala, chave, invalidar])

  // as colunas crescem do chão (com movimento reduzido, já nascem prontas)
  useFrame((estado, dt) => {
    if (progresso.current >= 1 || !colunas.current) return
    progresso.current = reduz ? 1 : Math.min(1, progresso.current + Math.min(dt, 1 / 30) / 0.9)
    if (progresso.current < 1) estado.invalidate() // o canvas só desenha sob demanda
    const k = 1 - (1 - progresso.current) ** 3
    lista.forEach((a, i) => {
      const l = lugares[i]
      const x = l.x * R, z = -l.y * R
      const h = (0.06 + (ALTURA * a.gasto) / max) * k
      const giro = Math.atan2(-z, x) // o encosto fica do lado de fora
      tmp.position.set(x, h / 2, z)
      tmp.rotation.set(0, giro + Math.PI / 2, 0)
      tmp.scale.set(d * 0.62, h, d * 0.62)
      tmp.updateMatrix()
      colunas.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x, h + 0.06, z)
      tmp.scale.set(d * 0.66, 0.12, d * 0.66)
      tmp.updateMatrix()
      assentos.current!.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x + Math.cos(giro) * d * 0.3, h + 0.28, z - Math.sin(giro) * d * 0.3)
      tmp.scale.set(d * 0.7, 0.44, d * 0.12)
      tmp.updateMatrix()
      encostos.current!.setMatrixAt(i, tmp.matrix)
    })
    colunas.current.instanceMatrix.needsUpdate = true
    assentos.current!.instanceMatrix.needsUpdate = true
    encostos.current!.instanceMatrix.needsUpdate = true
    colunas.current.computeBoundingSphere()
  })

  const passar = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    aoPassar(e.instanceId ?? null, e)
  }
  return (
    <group>
      <instancedMesh
        key={`c-${chave}-${lista.length}`}
        ref={colunas}
        args={[caixa, undefined, lista.length]}
        castShadow
        onPointerMove={passar}
        onPointerOut={() => aoPassar(null)}
        onClick={(e) => {
          e.stopPropagation()
          if (e.instanceId != null) aoAbrir(lista[e.instanceId].id)
        }}
      >
        <meshStandardMaterial roughness={0.55} metalness={0.02} />
      </instancedMesh>
      <instancedMesh key={`a-${chave}-${lista.length}`} ref={assentos} args={[caixa, undefined, lista.length]} castShadow visible={assentosVisiveis}>
        <meshStandardMaterial color="#2a313c" roughness={0.7} />
      </instancedMesh>
      <instancedMesh key={`e-${chave}-${lista.length}`} ref={encostos} args={[caixa, undefined, lista.length]} castShadow visible={assentosVisiveis}>
        <meshStandardMaterial color="#18202b" roughness={0.7} />
      </instancedMesh>
    </group>
  )
}

export default function Plenario3D(props: Props) {
  const [foco, setFoco] = useState<{ i: number; x: number; y: number } | null>(null)
  const cartao = useRef<HTMLDivElement>(null)
  const lista = useMemo(() => ordenar(props.cadeiras, props.ordem), [props.cadeiras, props.ordem])
  return (
    <div className="relative h-full w-full">
      {/* câmera fixa: o Bounds mediria as colunas ainda com altura zero, no começo da animação */}
      <Canvas frameloop="demand" shadows="percentage" dpr={[1, 1.5]} camera={{ position: [0, 13.5, 17.5], fov: 36 }} aria-label="Plenário em 3D: a altura de cada cadeira é o gasto da campanha">
        <hemisphereLight args={['#ffffff', '#c9d0d8', 1.1]} />
        <directionalLight position={[8, 18, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
        <Bancada
          {...props}
          aoPassar={(i, e) => {
            if (i == null || !e) return setFoco(null)
            const x = e.nativeEvent.clientX, y = e.nativeEvent.clientY
            setFoco((f) => (f?.i === i ? f : { i, x, y })) // só muda ao trocar de coluna
            posicionar(cartao.current, x, y)
          }}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <circleGeometry args={[R * 1.12, 96, 0, Math.PI]} />
          <meshStandardMaterial color="#e6eaed" roughness={0.95} />
        </mesh>
        <ContactShadows position={[0, 0, 0]} opacity={0.25} scale={30} blur={2.4} far={8} />
        <OrbitControls makeDefault target={[0, 1.6, -4]} enablePan={false} minDistance={10} maxDistance={40} minPolarAngle={0.35} maxPolarAngle={1.32} minAzimuthAngle={-1} maxAzimuthAngle={1} />
      </Canvas>
      {foco && lista[foco.i] && <CartaoAssento a={lista[foco.i]} fator={props.fator} x={foco.x} y={foco.y} alvo={cartao} dica="Clique para abrir a carreira" />}
      <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-folha/85 px-3 py-1 text-[0.75rem] font-semibold text-tinta-2">
        Altura: gasto da campanha · arraste para girar
      </p>
    </div>
  )
}
