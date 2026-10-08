// P4: a régua dos 8 graus de escolaridade do TSE e a cor de cada um.
// A cor é o roxo do mimeógrafo, a tinta das provas e apostilas da escola brasileira: uma matiz só,
// do lilás quase papel (analfabeto) ao roxo fechado (superior completo). Não cruza com o viés
// (laranja e azul), com o gasto (amarelo e verde) nem com o verde de quem foi eleito.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { oklchParaHex } from '../lib/vies'

export const TINTA_ESCOLA = Array.from({ length: 8 }, (_, i) => {
  const t = i / 7
  return oklchParaHex(0.895 - 0.565 * t ** 0.95, 0.03 + 0.12 * (1 - (1 - t) ** 1.6), 306 - 6 * t)
})

/** Tinta do texto sobre cada tom: escura nos quatro claros, papel nos quatro escuros. */
export const tintaSobreGrau = (nivel: number) => (nivel <= 4 ? 'var(--color-tinta)' : 'var(--color-folha)')

export const cor = (nivel: number) => TINTA_ESCOLA[nivel - 1]

export const SUPERIOR = 8

export const soma = (v: number[]) => v.reduce((s, x) => s + x, 0)

/** Partes de 100 por grau. */
export const porCento = (v: number[]) => {
  const t = soma(v)
  return v.map((x) => (t ? (100 * x) / t : 0))
}

/**
 * Distribui 100 unidades entre os graus pelos maiores restos: a sala tem sempre 100 carteiras e
 * o quadro dos votos sempre 100 cédulas, sem sobrar nem faltar uma.
 */
export function cem(v: number[]): number[] {
  const p = porCento(v)
  const base = p.map(Math.floor)
  const ordem = p.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0])
  let falta = 100 - soma(base)
  for (let k = 0; falta > 0 && k < ordem.length; k++, falta--) base[ordem[k][1]]++
  return soma(v) ? base : v.map(() => 0)
}

/** Largura do elemento, acompanhando o redimensionamento (os gráficos da P4 se desenham na medida). */
export function useLargura<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [largura, setLargura] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // fora da tela (content-visibility: auto) a medida vem 0: guarda a última, o desenho não pisca ao voltar
    const obs = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      if (w > 0) setLargura(w)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, largura]
}
