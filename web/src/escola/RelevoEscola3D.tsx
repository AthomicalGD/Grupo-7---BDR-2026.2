// O mapa da escolaridade em pé: cada forma (estado, na vista do Brasil; município, na do estado) sobe
// numa altura proporcional à parte com superior completo, na cor da escala da bandeira. Usa as mesmas
// colunas do relevo do atlas (crescem do chão e só desenham sob demanda). Clique abre o estado ou o boletim.
import { AdaptiveDpr, Bounds, Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState, type ReactNode } from 'react'
import type { Malha } from '../api'
import { Coluna, construir, useCursorDeVolta } from '../relevo/Relevo3D'
import { SombraAssentada } from '../relevo/sombra'

const ALTURA_MAX = 16

export default function RelevoEscola3D({ malha, valor, cor, teto, rotulo, selecionado, aoEscolher, legenda }: {
  malha: Malha
  /** valor de cada forma (código do IBGE), de 0 a `teto` */
  valor: Map<number, number | null>
  cor: (v: number | null | undefined) => string | null
  teto: number
  rotulo: (codigo: number) => ReactNode
  selecionado?: number | null
  aoEscolher: (codigo: number) => void
  legenda: string
}) {
  const blocos = useMemo(() => construir(malha), [malha])
  const [sobre, setSobre] = useState<number | null>(null)
  useCursorDeVolta()
  const altura = (v: number | null | undefined) => 0.4 + (Math.min(teto, v ?? 0) / teto) * ALTURA_MAX
  const bSobre = sobre != null ? blocos.find((b) => b.ibge === sobre) : undefined
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_70%_55%_at_50%_92%,#fff6d6_0%,transparent_70%),linear-gradient(180deg,#e4edf3_0%,#f1f5f6_48%,#f6f8ef_100%)]">
      <Canvas frameloop="demand" shadows="percentage" dpr={[1, 1.5]} performance={{ min: 0.6 }} camera={{ position: [0, 78, 92], fov: 38, near: 1, far: 800 }} aria-label={`Mapa em 3D: ${legenda}`}>
        <AdaptiveDpr />
        <SombraAssentada chave={`${malha.features.length}-${teto}-${valor.size}`} />
        <hemisphereLight args={['#ffffff', '#cfd6e2', 1.05]} />
        <directionalLight position={[60, 120, 40]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} />
        <Bounds fit clip observe margin={1.1}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {blocos.map((b) => {
              const v = valor.get(b.ibge)
              return (
                <Coluna
                  key={b.ibge}
                  bloco={b}
                  altura={altura(v)}
                  cor={cor(v) ?? '#dfe3e7'}
                  selecionado={b.ibge === selecionado || b.ibge === sobre}
                  aoPassar={setSobre}
                  aoClicar={() => aoEscolher(b.ibge)}
                />
              )
            })}
            {bSobre && (
              <Html position={[bSobre.centro[0], bSobre.centro[1], altura(valor.get(bSobre.ibge)) + 1.5]} center zIndexRange={[20, 0]}>
                <div className="pointer-events-none w-max -translate-y-8 rounded-xl border border-linha bg-folha/95 px-3 py-2 text-[0.8rem] shadow-[var(--shadow-papel)]">
                  {rotulo(bSobre.ibge)}
                </div>
              </Html>
            )}
          </group>
        </Bounds>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[160, 160]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
        <OrbitControls makeDefault regress enablePan={false} minDistance={50} maxDistance={220} minPolarAngle={0.25} maxPolarAngle={1.25} />
      </Canvas>
      <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-folha/85 px-3 py-1 text-[0.75rem] font-semibold text-tinta-2">
        Altura: {legenda} · arraste para girar
      </p>
    </div>
  )
}
