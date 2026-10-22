// Estado pequeno fora do React (hover do mapa): só quem lê re-renderiza.
import { useSyncExternalStore } from 'react'

export function criarLoja<T>(inicial: T) {
  let valor = inicial
  const ouvintes = new Set<() => void>()
  return {
    get: () => valor,
    set(novo: T) {
      if (novo === valor) return
      valor = novo
      ouvintes.forEach((f) => f())
    },
    assinar(f: () => void) {
      ouvintes.add(f)
      return () => void ouvintes.delete(f)
    },
  }
}

export function useLoja<T>(loja: ReturnType<typeof criarLoja<T>>): T {
  return useSyncExternalStore(loja.assinar, loja.get, loja.get)
}
