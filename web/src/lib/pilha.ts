// A pilha de navegação. Cada entrada do histórico (a chave que o roteador dá a cada navegação) guarda de onde se
// chegou a ela e o estado das telas: "Voltar" leva à tela anterior (o boletim, o plenário, a escola...) e não a um
// ponto fixo do site, e a tela volta como estava (a busca digitada, o porquinho quebrado, a aba escolhida), não
// reiniciada. Uma navegação nova começa do zero; ir e voltar no histórico devolve o que havia.
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export interface Origem {
  pathname: string
  href: string
}

const origens = new Map<string, Origem>()

/** Chamado pelo roteador antes de cada navegação; só a primeira vez de cada entrada conta (voltar não reescreve). */
export function registraOrigem(chave: string | undefined, de: Origem | undefined) {
  if (chave && de && !origens.has(chave)) origens.set(chave, de)
}

const chaveAtual = (s: { location: { state: { __TSR_key?: string }; href: string } }) => s.location.state.__TSR_key ?? s.location.href

/** De onde se chegou a esta tela, se foi por dentro do site. */
export function useOrigem(): Origem | undefined {
  const chave = useRouterState({ select: chaveAtual })
  return origens.get(chave)
}

/** "ao boletim", "à urna"...: para onde o Voltar leva. */
export function destinoDe(o: Origem): string {
  const p = o.pathname
  if (/^\/uf\/[^/]+\/\d+/.test(p)) return 'ao boletim'
  if (p.startsWith('/uf/')) return 'ao estado'
  if (p === '/') return 'ao mapa'
  if (p.startsWith('/urna')) return 'à urna'
  if (p.startsWith('/cadeira')) return 'ao plenário'
  if (p.startsWith('/escola')) return 'à escola'
  if (p.startsWith('/patrimonio')) return 'ao patrimônio'
  if (p.startsWith('/reeleicao')) return 'à reeleição'
  if (p.startsWith('/metodologia')) return 'à metodologia'
  if (p.startsWith('/politico')) return 'ao político anterior'
  if (p.startsWith('/comparar')) return 'à comparação'
  return ''
}

const guardados = new Map<string, unknown>()

/**
 * Um useState que a pilha guarda: ao voltar para esta entrada do histórico, a tela recebe o valor que tinha.
 * `nome` diferencia os estados de uma mesma tela (e as instâncias de um mesmo componente).
 */
export function useLembrado<T>(nome: string, inicial: T | (() => T)) {
  const entrada = useRouterState({ select: chaveAtual })
  const chave = `${entrada}|${nome}`
  const [valor, setValor] = useState<T>(() =>
    guardados.has(chave) ? (guardados.get(chave) as T) : typeof inicial === 'function' ? (inicial as () => T)() : inicial,
  )
  useEffect(() => {
    guardados.set(chave, valor)
  }, [chave, valor])
  return [valor, setValor] as const
}
