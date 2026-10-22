// O porquinho do cofrinho: o desenho (rosa, de porcelana, virado para a direita), as rachaduras de cada
// martelada e os cacos da quebra. Tudo no espaço do desenho (260 por 210). As rachaduras e os cacos saem de
// um gerador com semente: a mesma martelada desenha sempre a mesma rachadura, e os cacos se encaixam
// (as bordas de dois cacos vizinhos são a mesma linha serrilhada).
import { memo } from 'react'

export const PORCO = { W: 260, H: 210, base: 198 }
export const CORPO = { cx: 124, cy: 112, rx: 94, ry: 72 }

/** Gerador pseudoaleatório com semente (mulberry32). */
export function sorteio(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Leva um ponto para dentro do corpo (as rachaduras só existem na porcelana). */
export function dentroDoCorpo(x: number, y: number): [number, number] {
  const dx = (x - CORPO.cx) / (CORPO.rx * 0.8)
  const dy = (y - CORPO.cy) / (CORPO.ry * 0.8)
  const r = Math.hypot(dx, dy)
  if (r <= 1) return [x, y]
  return [CORPO.cx + (dx / r) * CORPO.rx * 0.8, CORPO.cy + (dy / r) * CORPO.ry * 0.8]
}

export interface Fio {
  d: string
  largura: number
}

/** Uma rachadura de verdade: três a cinco galhos que andam aos trancos a partir do golpe, mudando de
 * direção a cada passo, e soltam galhos menores; cada geração é mais fina. */
export function rachadura(x: number, y: number, semente: number): Fio[] {
  const r = sorteio(semente)
  const fios: Fio[] = []
  const crescer = (px: number, py: number, angulo: number, comprimento: number, largura: number, nivel: number) => {
    const pontos: [number, number][] = [[px, py]]
    let a = angulo
    let andado = 0
    while (andado < comprimento) {
      const passo = 4 + r() * 6
      a += (r() - 0.5) * 0.9
      px += Math.cos(a) * passo
      py += Math.sin(a) * passo
      andado += passo
      pontos.push([px, py])
      if (nivel < 2 && r() < 0.16) crescer(px, py, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), comprimento * (0.3 + r() * 0.3), largura * 0.55, nivel + 1)
    }
    fios.push({ d: 'M' + pontos.map(([a1, b1]) => `${a1.toFixed(1)} ${b1.toFixed(1)}`).join('L'), largura })
  }
  const galhos = 3 + Math.floor(r() * 3)
  const giro = r() * Math.PI * 2
  for (let i = 0; i < galhos; i++) {
    const angulo = giro + (i / galhos) * Math.PI * 2 + (r() - 0.5) * 0.8
    crescer(x, y, angulo, 26 + r() * 46, 1.9 + r() * 0.7, 0)
  }
  return fios
}

export interface Caco {
  pontos: string
  /** centro do caco, para saber para onde ele voa */
  centro: [number, number]
}

/** Os cacos: linhas de corte serrilhadas saem do golpe até a borda da caixa; cada caco é a fatia entre
 * duas linhas, fechada pela borda. Vizinhos dividem a mesma linha, então o porquinho inteiro se encaixa. */
export function cacos(cx: number, cy: number, n: number, semente: number): Caco[] {
  const r = sorteio(semente)
  const { W, H } = PORCO
  const angulos = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + (r() - 0.5) * (Math.PI / n) * 0.9).sort((a, b) => a - b)
  // até onde o raio chega na borda da caixa
  const borda = (a: number): [number, number] => {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const t = Math.min(dx > 0 ? (W + 2 - cx) / dx : dx < 0 ? (-2 - cx) / dx : Infinity, dy > 0 ? (H + 2 - cy) / dy : dy < 0 ? (-2 - cy) / dy : Infinity)
    return [cx + dx * t, cy + dy * t]
  }
  const linhas = angulos.map((a) => {
    const [ex, ey] = borda(a)
    const passos = Math.max(4, Math.round(Math.hypot(ex - cx, ey - cy) / 11))
    const nx = -Math.sin(a)
    const ny = Math.cos(a)
    const pts: [number, number][] = [[cx, cy]]
    for (let k = 1; k < passos; k++) {
      const t = k / passos
      const desvio = (r() - 0.5) * 11
      pts.push([cx + (ex - cx) * t + nx * desvio, cy + (ey - cy) * t + ny * desvio])
    }
    pts.push([ex, ey])
    return pts
  })
  const cantos: [number, number][] = [[-2, -2], [W + 2, -2], [W + 2, H + 2], [-2, H + 2]]
  const anguloDe = ([x, y]: [number, number]) => Math.atan2(y - cy, x - cx)
  const norm = (a: number, base: number) => {
    while (a < base) a += Math.PI * 2
    while (a >= base + Math.PI * 2) a -= Math.PI * 2
    return a
  }
  return angulos.map((a0, i) => {
    const j = (i + 1) % n
    const a1 = norm(angulos[j], a0 + 1e-6)
    const meio = cantos.filter((c) => norm(anguloDe(c), a0) < a1).sort((p, q) => norm(anguloDe(p), a0) - norm(anguloDe(q), a0))
    const contorno = [...linhas[i], ...meio, ...linhas[j].slice().reverse()]
    const sx = contorno.reduce((s, p) => s + p[0], 0) / contorno.length
    const sy = contorno.reduce((s, p) => s + p[1], 0) / contorno.length
    return { pontos: contorno.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), centro: [sx, sy] as [number, number] }
  })
}

/** O desenho do porquinho, no estilo de ilustração chapada do cofrinho clássico: rosa salmão sem contorno
 * escuro (as formas se separam por tons), olho pequeno e escuro com um brilho (o olho é um grupo à parte, que
 * acompanha o cursor), bochecha corada, orelha dobrada para a frente, focinho com a ponta clara, rabinho
 * enrolado, patinhas curtas, o R$ em relevo no corpo e a fenda das moedas em cima. Virado para a direita. */
const ROSA = { corpo: '#f5a9ae', claro: '#fbd3d5', sombra: '#ea929a', fundo: '#e48890', detalhe: '#d8737d', fenda: '#b9566a', olho: '#3b2a30', bochecha: '#f07f8f' }
export const Desenho = memo(function Desenho({ p, olhar = true }: { p: string; olhar?: boolean }) {
  return (
    <>
      {/* patas e orelha do lado de lá, um tom mais escuro */}
      <path d="M66 150 h26 v38 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10 Z" fill={ROSA.fundo} />
      <path d="M154 150 h26 v38 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10 Z" fill={ROSA.fundo} />
      <path d="M172 62 C172 40 182 24 198 24 C208 25 212 36 207 47 C203 56 194 62 186 68 Z" fill={ROSA.fundo} />
      {/* rabinho enrolado */}
      <path d="M34 104 C16 96 4 112 12 121 C20 130 36 120 27 110 C20 103 11 110 17 116" fill="none" stroke={ROSA.sombra} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={CORPO.cx} cy={CORPO.cy} rx={CORPO.rx} ry={CORPO.ry} fill={`url(#${p}-corpo)`} />
      <g clipPath={`url(#${p}-silhueta)`}>
        {/* a barriga na sombra e o brilho do alto, em tons chapados */}
        <ellipse cx={CORPO.cx + 4} cy={CORPO.cy + 70} rx={98} ry={34} fill={ROSA.sombra} opacity={0.55} />
        <ellipse cx={92} cy={70} rx={34} ry={14} transform="rotate(-18 92 70)" fill={ROSA.claro} opacity={0.75} />
        {/* o R$ em relevo: a sombra embaixo, o claro em cima */}
        <text x={118} y={140} textAnchor="middle" fontSize={50} fontWeight={900} fill={ROSA.claro} opacity={0.65} style={{ fontStretch: '80%' }} transform="translate(-1.2 -1.4)">R$</text>
        <text x={118} y={140} textAnchor="middle" fontSize={50} fontWeight={900} fill={ROSA.detalhe} opacity={0.85} style={{ fontStretch: '80%' }}>R$</text>
      </g>
      <ellipse cx={86} cy={62} rx={7} ry={3.6} transform="rotate(-20 86 62)" fill="#fff" opacity={0.7} />
      {/* patinhas da frente */}
      <path d="M86 156 h28 v32 a10 10 0 0 1 -10 10 h-8 a10 10 0 0 1 -10 -10 Z" fill={`url(#${p}-pata)`} />
      <path d="M170 156 h28 v32 a10 10 0 0 1 -10 10 h-8 a10 10 0 0 1 -10 -10 Z" fill={`url(#${p}-pata)`} />
      {/* focinho: o cano do focinho e a ponta clara, com as narinas */}
      <path d="M206 98 C222 96 234 104 236 120 C238 136 226 146 208 144 Z" fill={ROSA.corpo} />
      <ellipse cx={234} cy={120} rx={11} ry={20} fill={ROSA.claro} />
      <ellipse cx={233} cy={113} rx={2.6} ry={4} fill={ROSA.detalhe} />
      <ellipse cx={233} cy={127} rx={2.6} ry={4} fill={ROSA.detalhe} />
      {/* bochecha corada */}
      <ellipse cx={196} cy={124} rx={11} ry={6.5} fill={ROSA.bochecha} opacity={0.55} />
      {/* o olho: pequeno, escuro, com um brilho (o grupo da pupila acompanha o cursor) */}
      <g className="porco-olho">
        <g className={olhar ? 'porco-pupila' : undefined}>
          <ellipse cx={192} cy={98} rx={6.2} ry={8} fill={ROSA.olho} />
          <circle cx={194.4} cy={94.6} r={2.3} fill="#fff" />
        </g>
      </g>
      {/* orelha do lado de cá, dobrada para a frente */}
      <path d="M150 64 C148 40 158 20 176 18 C190 17 196 30 190 44 C186 54 176 62 166 70 Z" fill={ROSA.corpo} />
      <path d="M176 18 C190 17 196 30 190 44 C186 52 178 58 172 62 C178 50 182 36 176 18 Z" fill={ROSA.sombra} />
      {/* a fenda das moedas */}
      <rect x={96} y={42} width={50} height={9} rx={4.5} fill={ROSA.fenda} transform="rotate(-4 121 46)" />
      <rect x={99} y={44} width={44} height={3.4} rx={1.7} fill="#7d3446" transform="rotate(-4 121 46)" />
    </>
  )
})

/** Os gradientes do porquinho, uma vez por cena. */
export function Gradientes({ p }: { p: string }) {
  return (
    <>
      <radialGradient id={`${p}-corpo`} cx="38%" cy="32%" r="78%">
        <stop offset="0" stopColor="#f9bcc0" />
        <stop offset=".6" stopColor={ROSA.corpo} />
        <stop offset="1" stopColor="#ef9da3" />
      </radialGradient>
      <linearGradient id={`${p}-pata`} x1="0" x2="1">
        <stop offset="0" stopColor="#f6b0b5" />
        <stop offset="1" stopColor={ROSA.sombra} />
      </linearGradient>
      <clipPath id={`${p}-silhueta`}><ellipse cx={CORPO.cx} cy={CORPO.cy} rx={CORPO.rx} ry={CORPO.ry} /></clipPath>
    </>
  )
}

/** As rachaduras de todas as marteladas: o fio escuro e, colado a ele, o brilho da borda da porcelana.
 * `novas` marca as da última martelada, que se desenham a partir do golpe. */
export const Rachaduras = memo(function Rachaduras({ golpes, p, novas = -1 }: { golpes: { x: number; y: number; semente: number }[]; p: string; novas?: number }) {
  return (
    <g clipPath={`url(#${p}-silhueta)`}>
      {golpes.map((g, i) => (
        <g key={g.semente} className={i === novas ? 'racha-nova' : undefined}>
          {/* a mossa do golpe */}
          <ellipse cx={g.x} cy={g.y} rx={4.2} ry={3.4} fill="#a8475f" opacity={0.35} />
          {rachadura(g.x, g.y, g.semente).map((f, k) => (
            <g key={k}>
              <path d={f.d} fill="none" stroke="#fff6f8" strokeWidth={f.largura + 1.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} transform="translate(.7 .9)" pathLength={1} strokeDasharray={1} />
              <path d={f.d} fill="none" stroke="#5a2635" strokeWidth={f.largura} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} />
            </g>
          ))}
        </g>
      ))}
    </g>
  )
})
