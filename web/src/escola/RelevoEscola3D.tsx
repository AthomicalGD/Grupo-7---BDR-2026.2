// O mapa da escolaridade em pé: cada forma (estado, na vista do Brasil; município, na do estado) sobe
// numa altura proporcional à parte com superior completo, na cor da escala da bandeira. Usa as mesmas
// colunas do relevo do atlas (uma malha só, que cresce do chão e só desenha sob demanda). Clique abre o estado ou o boletim.
import type { ReactNode } from 'react'
import type { Malha } from '../api'
import { PalcoRelevo, RelevoDe } from '../relevo/Relevo3D'

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
  return (
    <PalcoRelevo
      rotulo={`Mapa em 3D: ${legenda}`}
      margem={1.1}
      legenda={
        <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-folha/85 px-3 py-1 text-[0.75rem] font-semibold text-tinta-2">
          Altura: {legenda} · arraste para girar
        </p>
      }
    >
      <RelevoDe
        malha={malha}
        altura={(c) => 0.4 + (Math.min(teto, valor.get(c) ?? 0) / teto) * ALTURA_MAX}
        cor={(c) => cor(valor.get(c)) ?? '#dfe3e7'}
        selecionado={selecionado}
        aoEscolher={aoEscolher}
        etiqueta={rotulo}
      />
    </PalcoRelevo>
  )
}
