// Relevo do voto: municípios extrudados, altura = eleitorado apto (raiz quadrada, para que a
// capital não esconda o resto), cor = viés. Orbita com o mouse; clique abre o boletim.
import { Bounds, Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { geoConicEqualArea } from 'd3-geo'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Ano, Malha, UFDetalhe } from '../api'
import { inteiro, vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'
import { SATURA_RELATIVO, valorMunicipio } from '../atlas/valores'

const LADO = 100       // o estado cabe num quadrado de 100 unidades
const ALTURA_MAX = 14
const PASSO_MIN = 0.22 // descarta vértices mais próximos que isso (o relevo não precisa da malha máxima)

interface Bloco {
  ibge: number
  geometria: THREE.ExtrudeGeometry
  centro: [number, number]
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

function construir(malha: Malha): Bloco[] {
  const proj = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).fitExtent([[-LADO / 2, -LADO / 2], [LADO / 2, LADO / 2]], malha)
  const p = (c: [number, number]) => proj(c) as [number, number] | null
  return malha.features.map((f) => {
    const g = f.geometry
    const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    const formas: THREE.Shape[] = []
    for (const poligono of poligonos) {
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
    const geometria = new THREE.ExtrudeGeometry(formas, { depth: 1, bevelEnabled: false })
    geometria.computeBoundingBox()
    const bb = geometria.boundingBox!
    return { ibge: f.properties.codarea, geometria, centro: [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2] }
  })
}

function Coluna({ bloco, altura, cor, selecionado, aoPassar, aoClicar }: {
  bloco: Bloco
  altura: number
  cor: string
  selecionado: boolean
  aoPassar: (ibge: number | null) => void
  aoClicar: () => void
}) {
  const ref = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshStandardMaterial>(null)
  const alvo = useMemo(() => new THREE.Color(cor), [cor])
  // cresce do chão e acompanha a troca de ano com amortecimento
  useFrame((_, dt) => {
    const m = ref.current
    if (!m || !material.current) return
    const k = 1 - Math.exp(-dt * 5.5)
    m.scale.z += (altura - m.scale.z) * k
    material.current.color.lerp(alvo, k)
    material.current.emissiveIntensity += ((selecionado ? 0.35 : 0) - material.current.emissiveIntensity) * k
  })
  return (
    <mesh
      ref={ref}
      geometry={bloco.geometria}
      scale={[1, 1, 0.001]}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation()
        aoPassar(bloco.ibge)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        aoPassar(null)
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        e.stopPropagation()
        aoClicar()
      }}
    >
      <meshStandardMaterial ref={material} color={cor} roughness={0.62} metalness={0.02} emissive="#f7c21a" emissiveIntensity={0} />
    </mesh>
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
  const blocos = useMemo(() => construir(malha), [malha])
  const porIbge = useMemo(() => new Map(uf.municipios.map((m) => [m.ibge, m])), [uf])
  const maxAptos = useMemo(() => Math.max(1, ...uf.municipios.map((m) => m.aptos[ano] ?? 0)), [uf, ano])
  const [sobre, setSobre] = useState<number | null>(null)
  const vUF = uf.vies[ano]
  const mSobre = sobre != null ? porIbge.get(sobre) : undefined
  const bSobre = sobre != null ? blocos.find((b) => b.ibge === sobre) : undefined

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_at_50%_35%,#ffffff,#e6eaed_75%)]">
      <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [0, 78, 92], fov: 38, near: 1, far: 800 }} aria-label={`Relevo 3D dos municípios de ${uf.nome} em ${ano}`}>
        <hemisphereLight args={['#ffffff', '#c9d0d8', 1.05]} />
        <directionalLight position={[60, 120, 40]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} />
        <Bounds fit clip observe margin={1.08}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          {blocos.map((b) => {
            const m = porIbge.get(b.ibge)
            const altura = 0.35 + Math.sqrt((m?.aptos[ano] ?? 0) / maxAptos) * ALTURA_MAX
            const v = valorMunicipio(m, ano, relativo, vUF)
            return (
              <Coluna
                key={b.ibge}
                bloco={b}
                altura={altura}
                cor={v == null ? '#dfe3e7' : corVies(v, relativo ? SATURA_RELATIVO : undefined)}
                selecionado={b.ibge === ibge || b.ibge === sobre}
                aoPassar={setSobre}
                aoClicar={() => aoEscolher(b.ibge)}
              />
            )
          })}
          {mSobre && bSobre && (
            <Html position={[bSobre.centro[0], bSobre.centro[1], 0.35 + Math.sqrt((mSobre.aptos[ano] ?? 0) / maxAptos) * ALTURA_MAX + 1.5]} center zIndexRange={[20, 0]}>
              <div className="pointer-events-none w-max -translate-y-8 rounded-xl border border-linha bg-folha/95 px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
                <p className="font-bold">{mSobre.nome}</p>
                <p className="tabular">viés {fmtVies(mSobre.vies[ano])} · {inteiro(mSobre.aptos[ano])} eleitores</p>
              </div>
            </Html>
          )}
        </group>
        </Bounds>
        {/* chão das sombras fora do Bounds, para não entrar no enquadramento */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[LADO * 1.6, LADO * 1.6]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
        <OrbitControls makeDefault enablePan={false} minDistance={50} maxDistance={220} minPolarAngle={0.25} maxPolarAngle={1.25} autoRotate={sobre == null} autoRotateSpeed={0.35} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-3 left-4 rounded-full bg-folha/85 px-3 py-1 text-[0.75rem] font-semibold text-tinta-2">
        Altura: eleitores aptos em {ano} · arraste para girar
      </p>
    </div>
  )
}
