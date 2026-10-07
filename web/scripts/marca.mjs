// Geometria da marca (gerada por scripts/gerar-marca.mjs).
// Símbolo = barras crescentes (o dado) + V (o voto) + visto (o voto confirmado).
// Coordenadas num quadro de 304 x 248.




const COR = { tinta: '#18202B', papel: '#F2F4F5', branco: '#FCFDFD' }

// borda de cima do braço esquerdo do V; as barras pousam nela com uma folga
const bordaV = (x) => 97 + (x - 7) * 0.34
const FOLGA = 8
const BARRAS = [[7, 19, 50], [23, 36, 34], [40, 54, 18], [59, 83, 2]] // [x0, x1, topo]

const pts = (lista) => 'M' + lista.map((p) => p.map((v) => +v.toFixed(1)).join(' ')).join('L') + 'Z'

export const GEO = {
  barras: BARRAS.map(([x0, x1, topo]) => pts([[x0, topo], [x1, topo], [x1, bordaV(x1) - FOLGA], [x0, bordaV(x0) - FOLGA]])),
  v: pts([[7, 97], [95, 127], [120, 134], [223, 92], [227, 110], [133, 244], [107, 244]]),
  visto: pts([[103, 47], [122, 47], [122, 106], [240, 2], [297, 2], [222, 85], [124, 126], [103, 122]]),
}

// Referência à bandeira (escolha do grupo): o V amarelo é a metade de baixo do losango,
// o globo azul com a faixa branca e três estrelas fica dentro dele, as barras são verdes e amarelas.
const BANDEIRA = { verde: '#1F9A4E', amarelo: '#FBC700', azul: '#2B4C8C' }
const VARIANTES = {
  cor: { barras: [BANDEIRA.verde, BANDEIRA.verde, BANDEIRA.amarelo, BANDEIRA.amarelo], v: BANDEIRA.amarelo, globo: true, visto: COR.tinta },
  negativo: { barras: [BANDEIRA.verde, BANDEIRA.verde, BANDEIRA.amarelo, BANDEIRA.amarelo], v: BANDEIRA.amarelo, globo: true, visto: COR.branco },
  mono: { barras: Array(4).fill(COR.tinta), v: COR.tinta, globo: false, visto: COR.tinta },
  mono_negativo: { barras: Array(4).fill(COR.branco), v: COR.branco, globo: false, visto: COR.branco },
}

function estrela(cx, cy, r) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r
    return `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`
  })
  return 'M' + pts.join('L') + 'Z'
}

export const ESTRELAS = [[-14, 20, 5], [12, 12, 4], [2, 30, 3.4]].map(([dx, dy, r]) => estrela(124 + dx, 158 + dy, r))

/** Globo da bandeira recortado pelo V: disco azul, faixa branca em arco e três estrelas. */
function globo(id) {
  const cx = 124, cy = 158, r = 46
  return {
    defs: `<clipPath id="${id}"><path d="${GEO.v}"/></clipPath><clipPath id="${id}-d"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`,
    corpo: `<g clip-path="url(#${id})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${BANDEIRA.azul}"/>` +
      `<path clip-path="url(#${id}-d)" d="M${cx - r - 4} ${cy + 4}Q${cx} ${(cy - r * 0.62).toFixed(1)} ${cx + r + 4} ${cy - 6}" stroke="${COR.branco}" stroke-width="7.5" fill="none"/>` +
      ESTRELAS.map((d) => `<path d="${d}" fill="${COR.branco}"/>`).join('') + '</g>',
  }
}

export function simboloSVG(variante = 'cor', { x = 0, y = 0, escala = 1, id = 'va-globo' } = {}) {
  const c = VARIANTES[variante]
  const g = c.globo ? globo(id) : { defs: '', corpo: '' }
  const barras = GEO.barras.map((d, i) => `<path d="${d}" fill="${c.barras[i]}"/>`).join('')
  return `${g.defs ? `<defs>${g.defs}</defs>` : ''}<g transform="translate(${x} ${y}) scale(${escala})">${barras}<path d="${GEO.v}" fill="${c.v}"/>${g.corpo}<path d="${GEO.visto}" fill="${c.visto}"/></g>`
}

export { BANDEIRA }

const svg = (w, h, corpo, titulo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${titulo}"><title>${titulo}</title>${corpo}</svg>\n`

// ícone: símbolo dentro de um quadrado arredondado (favicon e app)
export function iconeSVG(fundo = 'escuro') {
  const escuro = fundo === 'escuro'
  const caixa = `<rect width="512" height="512" rx="116" fill="${escuro ? COR.tinta : COR.branco}"/>`
  return svg(512, 512, caixa + simboloSVG(escuro ? 'negativo' : 'cor', { x: 49, y: 87, escala: 1.36 }), 'Voto Aberto')
}

export { COR, svg }

