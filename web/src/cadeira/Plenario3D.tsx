// Plenário em pé: cada cadeira sobe numa coluna com altura proporcional ao gasto (linear, para que
// a diferença de dinheiro apareça do tamanho que é). Mesmo lugar e mesma cor do plano.
// Em cima de cada coluna, a poltrona do plano: almofada na cor do gasto, encosto e dois braços em tinta.
// Colunas, almofadas, encostos e braços são InstancedMesh: até ~1.500 cadeiras sem pesar.
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Assento } from '../api'
import { CartaoAssento } from './Plenario'
import { hemiciclo, ordenar, posicionar, type EscalaGasto, type Ordem } from './geometria'
import { SombraAssentada, useAssentado } from '../relevo/sombra'

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
// cantos arredondados nas peças da poltrona (a coluna fica reta: é a barra do dado)
const almofada = new RoundedBoxGeometry(1, 1, 1, 2, 0.3)
const peca = new RoundedBoxGeometry(1, 1, 1, 2, 0.22)
const tmp = new THREE.Object3D()
const BRANCO = new THREE.Color('#ffffff')

function Bancada({ chave, cadeiras, escala, ordem, aoPassar, aoAbrir }: Omit<Props, 'fator'> & {
  aoPassar: (i: number | null, e?: ThreeEvent<PointerEvent>) => void
}) {
  const lista = useMemo(() => ordenar(cadeiras, ordem), [cadeiras, ordem])
  const { lugares, diametro } = useMemo(() => hemiciclo(lista.length), [lista.length])
  const max = useMemo(() => Math.max(1, ...lista.map((a) => a.gasto)), [lista])
  const colunas = useRef<THREE.InstancedMesh>(null)
  const assentos = useRef<THREE.InstancedMesh>(null)
  const encostos = useRef<THREE.InstancedMesh>(null)
  const bracos = useRef<THREE.InstancedMesh>(null) // dois por cadeira
  const tampos = useRef<THREE.InstancedMesh>(null) // a base clara da poltrona, que a separa da coluna
  const progresso = useRef(0)
  const reduz = useReducedMotion()
  const invalidar = useThree((s) => s.invalidate)
  const d = diametro * R
  // com centenas de cadeiras as poltronas viram uma mancha escura: fica só a coluna
  const assentosVisiveis = lista.length <= 300

  useLayoutEffect(() => {
    progresso.current = 0
    // seleção sem nenhuma cadeira (ex.: o DF não elege prefeito): sem instâncias, o three não cria a cor
    // por instância (instanceColor fica null) e não há o que desenhar
    const col = colunas.current, ass = assentos.current, enc = encostos.current, bra = bracos.current, tam = tampos.current
    if (!lista.length || !col || !ass || !enc || !bra || !tam) return
    const cor = new THREE.Color()
    tmp.scale.setScalar(0)
    tmp.updateMatrix()
    lista.forEach((a, i) => {
      col.setColorAt(i, cor.set(escala.cor(a.gasto)))
      // a almofada é a mesma cor um pouco mais clara, como o brilho do plano
      ass.setColorAt(i, cor.lerp(BRANCO, 0.3))
      for (const m of [col, ass, enc, tam]) m.setMatrixAt(i, tmp.matrix)
      bra.setMatrixAt(2 * i, tmp.matrix)
      bra.setMatrixAt(2 * i + 1, tmp.matrix)
    })
    for (const m of [col, ass]) if (m.instanceColor) m.instanceColor.needsUpdate = true
    invalidar()
  }, [lista, escala, chave, invalidar])

  // as colunas crescem do chão (com movimento reduzido, já nascem prontas)
  useFrame((estado, dt) => {
    const col = colunas.current, ass = assentos.current, enc = encostos.current, bra = bracos.current, tam = tampos.current
    if (progresso.current >= 1 || !lista.length || !col || !ass || !enc || !bra || !tam) return
    progresso.current = reduz ? 1 : Math.min(1, progresso.current + Math.min(dt, 1 / 30) / 0.9)
    if (progresso.current < 1) estado.invalidate() // o canvas só desenha sob demanda
    const k = 1 - (1 - progresso.current) ** 3
    lista.forEach((a, i) => {
      const l = lugares[i]
      const x = l.x * R, z = -l.y * R
      const h = (0.06 + (ALTURA * a.gasto) / max) * k
      const giro = Math.atan2(-z, x) // o encosto fica do lado de fora
      const fx = Math.cos(giro), fz = -Math.sin(giro) // para fora do hemiciclo
      const lx = Math.sin(giro), lz = Math.cos(giro) // ao longo da fileira
      const poe = (m: THREE.InstancedMesh, j: number, radial: number, lateral: number, y: number, sx: number, sy: number, sz: number) => {
        tmp.position.set(x + fx * radial + lx * lateral, y, z + fz * radial + lz * lateral)
        tmp.scale.set(sx, sy, sz)
        tmp.updateMatrix()
        m.setMatrixAt(j, tmp.matrix)
      }
      tmp.rotation.set(0, giro + Math.PI / 2, 0) // x da peça ao longo da fileira, z para fora
      poe(col, i, 0, 0, h / 2, d * 0.58, h, d * 0.58)
      poe(tam, i, 0, 0, h + 0.03, d * 0.86, 0.06, d * 0.86)
      poe(ass, i, -d * 0.03, 0, h + 0.13, d * 0.6, 0.17, d * 0.62)
      poe(enc, i, d * 0.33, 0, h + 0.33, d * 0.84, 0.52, d * 0.16)
      poe(bra, 2 * i, 0, -d * 0.37, h + 0.2, d * 0.13, 0.27, d * 0.62)
      poe(bra, 2 * i + 1, 0, d * 0.37, h + 0.2, d * 0.13, 0.27, d * 0.62)
    })
    for (const m of [col, ass, enc, bra, tam]) m.instanceMatrix.needsUpdate = true
    col.computeBoundingSphere()
  })

  const passar = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    aoPassar(e.instanceId ?? null, e)
  }
  const clicar = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.instanceId != null) aoAbrir(lista[e.instanceId].id)
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
        onClick={clicar}
      >
        <meshStandardMaterial roughness={0.55} metalness={0.02} />
      </instancedMesh>
      {/* a almofada também responde ao ponteiro: o índice da instância é o mesmo da coluna */}
      <instancedMesh
        key={`a-${chave}-${lista.length}`} ref={assentos} args={[almofada, undefined, lista.length]} castShadow visible={assentosVisiveis}
        onPointerMove={passar} onPointerOut={() => aoPassar(null)} onClick={clicar}
      >
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh key={`e-${chave}-${lista.length}`} ref={encostos} args={[peca, undefined, lista.length]} castShadow visible={assentosVisiveis}>
        <meshStandardMaterial color="#18202b" roughness={0.6} />
      </instancedMesh>
      <instancedMesh key={`t-${chave}-${lista.length}`} ref={tampos} args={[peca, undefined, lista.length]} castShadow visible={assentosVisiveis}>
        <meshStandardMaterial color="#e6eaed" roughness={0.7} />
      </instancedMesh>
      <instancedMesh key={`b-${chave}-${lista.length}`} ref={bracos} args={[peca, undefined, lista.length * 2]} castShadow visible={assentosVisiveis}>
        <meshStandardMaterial color="#2f3846" roughness={0.6} />
      </instancedMesh>
    </group>
  )
}

export default function Plenario3D(props: Props) {
  const [foco, setFoco] = useState<{ i: number; x: number; y: number } | null>(null)
  const cartao = useRef<HTMLDivElement>(null)
  const lista = useMemo(() => ordenar(props.cadeiras, props.ordem), [props.cadeiras, props.ordem])
  const cena = `${props.chave}-${props.ordem}-${lista.length}`
  const assentado = useAssentado(cena, 1600)
  return (
    <div className="relative h-full w-full">
      {/* câmera fixa: o Bounds mediria as colunas ainda com altura zero, no começo da animação */}
      {/* sem baixar a resolução ao girar (o regress do drei): redimensionar o canvas a cada giro custava mais que
          desenhar as três malhas instanciadas em resolução cheia, e a cena borrava e voltava */}
      <Canvas frameloop="demand" shadows="percentage" dpr={[1, 1.5]} camera={{ position: [0, 13.5, 17.5], fov: 36 }} aria-label="Plenário em 3D: a altura de cada cadeira é o gasto da campanha">
        <SombraAssentada chave={cena} ms={1600} />
        <hemisphereLight args={['#ffffff', '#cfd6e2', 1.1]} />
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
        {/* piso claro com a borda em ardósia (o azul de ação): as colunas verdes não se confundem com o chão */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[R * 1.2, 96, 0, Math.PI]} />
          <meshStandardMaterial color="#c3cce0" roughness={0.95} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <circleGeometry args={[R * 1.12, 96, 0, Math.PI]} />
          <meshStandardMaterial color="#f3f5f7" roughness={0.95} />
        </mesh>
        {/* a sombra de contato refaz a cena inteira com desfoque a cada quadro: assentada, é feita uma vez */}
        <ContactShadows key={assentado ? 'fixa' : 'viva'} frames={assentado ? 1 : Infinity} position={[0, 0, 0]} opacity={0.25} scale={30} blur={2.4} far={8} />
        <OrbitControls makeDefault target={[0, 1.6, -4]} enablePan={false} minDistance={10} maxDistance={40} minPolarAngle={0.35} maxPolarAngle={1.32} minAzimuthAngle={-1} maxAzimuthAngle={1} />
      </Canvas>
      {foco && lista[foco.i] && <CartaoAssento a={lista[foco.i]} fator={props.fator} x={foco.x} y={foco.y} alvo={cartao} dica="Clique para abrir a carreira" />}
      <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-folha/85 px-3 py-1 text-[0.75rem] font-semibold text-tinta-2">
        Altura: gasto da campanha · arraste para girar
      </p>
    </div>
  )
}
