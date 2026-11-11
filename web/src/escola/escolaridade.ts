// P4: os 8 graus de escolaridade do TSE e a cor de cada um.
// A escala vai do verde-claro (analfabeto) ao azul-meia-noite (superior completo), passando pelo verde-água,
// com a luminosidade caindo sempre: a ordem se lê do claro ao escuro. Quanto mais estudo, mais fundo o azul.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export const TINTA_ESCOLA = ['#edf7e1', '#cfeac3', '#a6d9a6', '#72c29a', '#1b7f90', '#2860b0', '#1d4fa0', '#0f2c5c'] // do verde (menos estudo) ao azul (mais)

/** Tinta do texto sobre cada tom: escura nos quatro claros, papel nos quatro escuros. */
export const tintaSobreGrau = (nivel: number) => (nivel <= 4 ? '#121417' : '#ffffff')

// no tema escuro os dois azuis mais fundos sumiriam no fundo: --grau-N (index.css) os clareia
export const cor = (nivel: number) => `var(--grau-${nivel}, ${TINTA_ESCOLA[nivel - 1]})`

/** A cor de verdade por trás de um "var(--x, reserva)", no tema atual: o 3D (three.js) não entende var(). */
export function corSolida(c: string): string {
  const m = /^var\((--[\w-]+),\s*([^)]+)\)$/.exec(c)
  if (!m) return c
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || m[2].trim()
}

/** De 0 a 100 nos 8 tons da escala (o mapa): cada tom cobre 12,5 pontos. */
export const corDe100 = (v: number | null | undefined) => (v == null ? null : cor(Math.min(8, Math.floor(v / 12.5) + 1)))

export const SUPERIOR = 8

/** Opacidade de uma unidade: cheia no grau em destaque, recuada nos outros. */
// os graus fora do destaque esmaecem; quanto, depende do tema (--apagado no index.css: sobre o escuro, 0,3 vira lama)
export const alfa = (g: number, destaque: number | null) => (destaque == null || g === destaque ? 1 : 'var(--apagado)')

export const soma = (v: number[]) => v.reduce((s, x) => s + x, 0)

/** Partes de 100 por grau. */
export const porCento = (v: number[]) => {
  const t = soma(v)
  return v.map((x) => (t ? (100 * x) / t : 0))
}

/**
 * Distribui 100 unidades entre os graus pelos maiores restos: o caderno tem sempre 100 assinaturas,
 * o plenário 100 cadeiras e o boletim soma 100, sem sobrar nem faltar uma.
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
