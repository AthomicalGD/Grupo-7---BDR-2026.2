// Letreiro "VOTO / ABERTO" em contornos (não depende de fonte instalada).
// Archivo variável do Google Fonts (OFL, scripts/fontes/OFL.txt): VOTO leve, ABERTO pesado.
// O primeiro A de ABERTO vira um Λ com um triângulo verde dentro, como na referência da marca.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fontkit from 'fontkit'
import { BANDEIRA, COR, simboloSVG } from './marca.mjs'

const FONTE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fontes', 'Archivo[wdth,wght].ttf')
const r = (v) => +v.toFixed(2)

// Λ e triângulo em unidades da fonte, a partir do contorno externo do A pesado:
// p0 pé esquerdo, p1/p2 topo, p3 pé direito, p4 pé interno direito, p7 pé interno esquerdo.
function lambda(g) {
  const p = g.path.commands.slice(0, 8).map((c) => c.args.slice(-2))
  const inc = (p[1][0] - p[0][0]) / (p[1][1] - p[0][1])     // inclinação das pernas (dx/dy)
  const pernaE = p[7][0], pernaD = p[4][0], meio = (pernaE + pernaD) / 2
  const folga = 0.18 * (pernaD - pernaE)
  const tE = pernaE + folga, tD = pernaD - folga
  return {
    letra: [p[0], p[1], p[2], p[3], [pernaD, 0], [meio, (pernaD - pernaE) / (2 * inc)], [pernaE, 0]],
    triangulo: [[tE, 0], [tD, 0], [meio, (tD - tE) / (2 * inc)]],
  }
}

function linha(fonte, texto, { corpo, x, base, espaco = 0, lambdaNoPrimeiroA = false }) {
  const s = corpo / fonte.unitsPerEm
  const run = fonte.layout(texto)
  let cursor = 0, d = '', extra = ''
  run.glyphs.forEach((g, i) => {
    const gx = x + cursor * s
    if (lambdaNoPrimeiroA && i === 0 && texto[0] === 'A') {
      const forma = lambda(g)
      const poli = (lista) => 'M' + lista.map(([u, v]) => `${r(gx + u * s)} ${r(base - v * s)}`).join('L') + 'Z'
      d += poli(forma.letra)
      extra = poli(forma.triangulo)
    } else {
      d += g.path.scale(s, -s).translate(gx, base).toSVG()
    }
    cursor += run.positions[i].xAdvance + (i < run.glyphs.length - 1 ? espaco : 0)
  })
  return { d, triangulo: extra, largura: cursor * s }
}

// medidas tiradas da referência: altura de maiúscula 0,335 (VOTO) e 0,375 (ABERTO) da altura do símbolo
export async function gerarLetreiro() {
  const base = fontkit.openSync(FONTE)
  const leve = base.getVariation({ wght: 380, wdth: 110 })
  const forte = base.getVariation({ wght: 840, wdth: 112 })
  const capLeve = leve.capHeight || 686, capForte = forte.capHeight || 686
  const H = 248                                            // altura do símbolo
  const capVoto = 0.335 * H, capAberto = 0.375 * H
  const corpoVoto = (capVoto / capLeve) * 1000, corpoAberto = (capAberto / capForte) * 1000

  function texto(x, topo, alinhar = 'esq', largura = 0) {
    const l1 = linha(leve, 'VOTO', { corpo: corpoVoto, x: 0, base: 0, espaco: 40 })
    const l2 = linha(forte, 'ABERTO', { corpo: corpoAberto, x: 0, base: 0, espaco: 12, lambdaNoPrimeiroA: true })
    const w = Math.max(l1.largura, l2.largura)
    const x1 = alinhar === 'centro' ? x + (largura - l1.largura) / 2 : x
    const x2 = alinhar === 'centro' ? x + (largura - l2.largura) / 2 : x
    const b1 = topo + capVoto, b2 = b1 + 0.075 * H + capAberto
    const v = linha(leve, 'VOTO', { corpo: corpoVoto, x: x1, base: b1, espaco: 40 })
    const a = linha(forte, 'ABERTO', { corpo: corpoAberto, x: x2, base: b2, espaco: 12, lambdaNoPrimeiroA: true })
    return { w, h: b2 - topo, partes: (cor) => `<path d="${v.d}${a.d}" fill="${cor}"/><path d="${a.triangulo}" fill="${BANDEIRA.verde}"/>` }
  }

  const out = {}
  for (const [sufixo, simbolo, tinta, fundo] of [['', 'cor', COR.tinta, null], ['-negativo', 'negativo', COR.branco, COR.tinta]]) {
    // horizontal: símbolo à esquerda, texto centrado na altura do símbolo
    const t = texto(0, 0)
    const gap = 30, W = 304 + gap + t.w, topo = (H - t.h) / 2 + 4
    const th = texto(304 + gap, topo)
    const pad = fundo ? 40 : 0
    const caixa = fundo ? `<rect x="${-pad}" y="${-pad}" width="${r(W + 2 * pad)}" height="${H + 2 * pad}" fill="${fundo}"/>` : ''
    out[`letreiro-horizontal${sufixo}.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${r(W + 2 * pad)} ${H + 2 * pad}" role="img" aria-label="Voto Aberto"><title>Voto Aberto</title>${caixa}${simboloSVG(simbolo)}${th.partes(tinta)}</svg>
`
    // empilhado: símbolo em cima, texto centrado embaixo
    const We = Math.max(304, t.w), xs = (We - 304) / 2
    const te = texto(0, H + 46, 'centro', We)
    const He = H + 46 + te.h + 10
    const caixaE = fundo ? `<rect x="${-pad}" y="${-pad}" width="${We + 2 * pad}" height="${He + 2 * pad}" fill="${fundo}"/>` : ''
    out[`letreiro-empilhado${sufixo}.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${r(We + 2 * pad)} ${r(He + 2 * pad)}" role="img" aria-label="Voto Aberto"><title>Voto Aberto</title>${caixaE}${simboloSVG(simbolo, { x: xs })}${te.partes(tinta)}</svg>\n`
  }
  return out
}
