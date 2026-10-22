// P4: os 8 graus de escolaridade do TSE e a cor de cada um.
// A escala é a da bandeira, feita das âncoras da marca: do amarelo (analfabeto) ao verde e ao azul
// da marca (superior completo), com a luminosidade caindo sempre (OKLCH 0,93 → 0,38), então a ordem
// se lê do claro ao escuro. Quanto mais estudo, mais fundo o azul.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export const TINTA_ESCOLA = ['#f9e99a', '#e4d948', '#a3cc4d', '#52b766', '#029e72', '#00808d', '#0d5c91', '#1c3e81']

/** Tinta do texto sobre cada tom: escura nos quatro claros, papel nos quatro escuros. */
export const tintaSobreGrau = (nivel: number) => (nivel <= 4 ? 'var(--color-tinta)' : 'var(--color-folha)')

export const cor = (nivel: number) => TINTA_ESCOLA[nivel - 1]

/** De 0 a 100 nos 8 tons da escala (o mapa): cada tom cobre 12,5 pontos. */
export const corDe100 = (v: number | null | undefined) => (v == null ? null : cor(Math.min(8, Math.floor(v / 12.5) + 1)))

export const SUPERIOR = 8

/** Opacidade de uma unidade: cheia no grau em destaque, recuada nos outros. */
export const alfa = (g: number, destaque: number | null) => (destaque == null || g === destaque ? 1 : 0.3)

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
