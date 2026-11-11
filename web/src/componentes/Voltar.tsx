// O "Voltar" das telas: leva à tela de onde se veio (o histórico do site, com a tela como estava), e só sem ela (link
// direto, aba nova) vai ao destino padrão. Quem chega à ficha de um político pelo Índices, pela Idade ou pelo
// Plenário volta para lá, não para a urna.
import { ArrowLeft } from '@phosphor-icons/react'
import { Link, useRouter, type LinkProps } from '@tanstack/react-router'
import { destinoDe, useOrigem } from '../lib/pilha'

export function Voltar({ para, rotulo, className }: { para: LinkProps['to']; rotulo: string; className: string }) {
  const origem = useOrigem()
  const router = useRouter()
  return origem ? (
    <button type="button" onClick={() => router.history.back()} className={className}>
      <ArrowLeft size={14} weight="bold" aria-hidden /> Voltar {destinoDe(origem)}
    </button>
  ) : (
    <Link to={para} className={className}>
      <ArrowLeft size={14} weight="bold" aria-hidden /> {rotulo}
    </Link>
  )
}
