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

/** O desenho do porquinho: rosa, redondo, olhos grandes com brilho (as pupilas são um grupo à parte, que
 * segue o cursor), bochechas, sorriso, orelhas, patinhas e o rabinho em espiral; a coleira tem as sete fitas. */
export const Desenho = memo(function Desenho({ p, olhar = true }: { p: string; olhar?: boolean }) {
  return (
    <>
      {/* patas e orelha do lado de lá */}
      <rect x={62} y={156} width={26} height={40} rx={12} fill="#f2a0b8" stroke="#c9607f" strokeWidth={2} />
      <rect x={150} y={156} width={26} height={40} rx={12} fill="#f2a0b8" stroke="#c9607f" strokeWidth={2} />
      <path d="M176 58 Q182 22 210 32 Q206 56 194 70 Z" fill="#f2a0b8" stroke="#c9607f" strokeWidth={2} strokeLinejoin="round" />
      {/* rabinho em espiral */}
      <path d="M33 104 C18 98 12 116 22 121 C33 126 37 108 26 107 C20 106 19 113 24 114" fill="none" stroke="#c9607f" strokeWidth={3.4} strokeLinecap="round" />
      <ellipse cx={CORPO.cx} cy={CORPO.cy} rx={CORPO.rx} ry={CORPO.ry} fill={`url(#${p}-corpo)`} />
      <g clipPath={`url(#${p}-silhueta)`}>
        {/* barriga mais clara e a coleira das fitas */}
        <ellipse cx={CORPO.cx + 6} cy={CORPO.cy + 46} rx={70} ry={30} fill="#ffe3ea" opacity={0.75} />
        {['#5e881b', '#a2bd31', '#5d6b94', '#468baf', '#76acd0', '#f19929', '#fbc700'].map((cor, i) => {
          const x = 160 + i * 2.6
          return <path key={cor} d={`M${x} 40 C${x - 9} 90 ${x - 9} 140 ${x} 188`} stroke={cor} strokeWidth={2.8} fill="none" />
        })}
      </g>
      <ellipse cx={CORPO.cx} cy={CORPO.cy} rx={CORPO.rx} ry={CORPO.ry} fill="none" stroke="#c9607f" strokeWidth={2.2} />
      {/* brilho da porcelana */}
      <ellipse cx={86} cy={70} rx={30} ry={11} transform="rotate(-20 86 70)" fill="#fff" opacity={0.75} />
      <ellipse cx={116} cy={58} rx={7} ry={4} transform="rotate(-12 116 58)" fill="#fff" opacity={0.7} />
      {/* patinhas da frente */}
      <rect x={82} y={160} width={28} height={38} rx={13} fill={`url(#${p}-pata)`} stroke="#c9607f" strokeWidth={2} />
      <rect x={172} y={160} width={28} height={38} rx={13} fill={`url(#${p}-pata)`} stroke="#c9607f" strokeWidth={2} />
      <path d="M89 194 h14 M179 194 h14" stroke="#c9607f" strokeWidth={1.6} strokeLinecap="round" />
      {/* focinho */}
      <ellipse cx={224} cy={120} rx={19} ry={22} fill="#f7a6bd" stroke="#c9607f" strokeWidth={2.2} />
      <ellipse cx={226} cy={111} rx={9} ry={5} fill="#fff" opacity={0.35} />
      <ellipse cx={219} cy={121} rx={3.4} ry={5.4} fill="#b8506d" />
      <ellipse cx={231} cy={121} rx={3.4} ry={5.4} fill="#b8506d" />
      {/* bochecha e sorriso */}
      <ellipse cx={190} cy={138} rx={13} ry={8} fill="#ff6f98" opacity={0.42} />
      <path d="M196 148 Q205 155 213 147" fill="none" stroke="#a8475f" strokeWidth={2.2} strokeLinecap="round" />
      {/* olho grande: o branco, a pupila que segue o cursor e os dois brilhos */}
      <g className="porco-olho">
        <ellipse cx={186} cy={94} rx={11} ry={12.5} fill="#fff" stroke="#c9607f" strokeWidth={1.4} />
        <g className={olhar ? 'porco-pupila' : undefined}>
          <ellipse cx={188} cy={96} rx={7} ry={8.4} fill="#2a1a20" />
          <circle cx={191} cy={92} r={2.8} fill="#fff" />
          <circle cx={185.5} cy={100} r={1.3} fill="#fff" />
        </g>
      </g>
      <path d="M176 78 Q185 72 195 76" fill="none" stroke="#a8475f" strokeWidth={2} strokeLinecap="round" />
      {/* orelha do lado de cá */}
      <path d="M152 58 Q150 18 180 22 Q186 48 176 68 Z" fill="#f7b0c4" stroke="#c9607f" strokeWidth={2} strokeLinejoin="round" />
      <path d="M158 54 Q158 30 176 28 Q179 46 173 60 Z" fill="#f07a9c" opacity={0.7} />
      {/* a fenda das moedas */}
      <rect x={96} y={42} width={50} height={9} rx={4.5} fill="#5a2635" transform="rotate(-4 121 46)" />
      <rect x={98} y={43} width={46} height={3} rx={1.5} fill="#2a1a20" transform="rotate(-4 121 46)" />
    </>
  )
})

/** Os gradientes do porquinho, uma vez por cena. */
export function Gradientes({ p }: { p: string }) {
  return (
    <>
      <radialGradient id={`${p}-corpo`} cx="36%" cy="30%" r="80%">
        <stop offset="0" stopColor="#ffe1e9" />
        <stop offset=".45" stopColor="#fbb7ca" />
        <stop offset="1" stopColor="#ef8fad" />
      </radialGradient>
      <linearGradient id={`${p}-pata`} x1="0" x2="1">
        <stop offset="0" stopColor="#ffc6d5" />
        <stop offset="1" stopColor="#f29ab4" />
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
