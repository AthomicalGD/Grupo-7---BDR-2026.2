// Alinhamento nas votações da Câmara: a mesma conta do viés com a posição dos partidos no SVD das votações
// nominais. Fica sempre separado do viés, com outra paleta, e com o aviso de que não mede ideologia.
import type { Ano, PorAno } from '../api'
import { corAlinhamento, ladoAlinhamento, POLOS_ALINHAMENTO } from '../lib/alinhamento'
import { type Medida, ViesTempo } from './ViesTempo'

const MEDIDA_ALINHAMENTO: Medida = {
  nome: 'Alinhamento na Câmara',
  cor: corAlinhamento,
  lado: ladoAlinhamento,
  negativo: POLOS_ALINHAMENTO.negativo,
  positivo: POLOS_ALINHAMENTO.positivo,
  limite: 80,
}

export function AlinhamentoCamara({ nome, valores, contexto, anoAtivo }: {
  nome: string
  valores: PorAno<number>
  contexto?: { nome: string; valores: PorAno<number> }
  anoAtivo?: Ano
}) {
  return (
    <div className="space-y-2">
      <ViesTempo principal={{ nome, valores }} contexto={contexto} anoAtivo={anoAtivo} medida={MEDIDA_ALINHAMENTO} />
      <p className="text-[0.8rem] leading-relaxed text-tinta-3">
        Não é o viés. Mede de que lado os partidos votados ficaram nas votações nominais do Plenário da Câmara, na
        legislatura antes de cada eleição. Isso acompanha quem é governo e quem é oposição: o mesmo partido muda dezenas
        de pontos de um governo para outro.
      </p>
    </div>
  )
}
