// Os objetos da eleição em miniatura, como unidades de contagem (Isotype, de cada 100): a assinatura
// no caderno de votação (quem votou), o santinho (quem se candidatou) e a cadeira do plenário (quem se
// elegeu). Cada unidade tem a cor do seu grau; as do grau em destaque ganham contorno de tinta e as
// outras recuam. Passar o ponteiro por uma unidade destaca o grau dela: os objetos são a própria chave.
import { hemiciclo } from '../cadeira/geometria'
import { alfa, cor } from './escolaridade'

const BORDA = 'rgb(24 32 43 / 0.2)' // os amarelos claros não somem na folha
const DESTAQUE = 'var(--color-tinta)'
const tracoSobre = (g: number) => (g <= 4 ? 'var(--color-tinta)' : 'var(--color-folha)')

interface Unidades {
  graus: number[]
  destaque: number | null
  largura: number
  aoDestacar?: (g: number) => void
}

// três rabiscos de assinatura, alternados pela linha, em frações da casa
const RABISCOS = [
  (x: number, y: number, w: number, h: number) =>
    `M${x + 4},${y + h * 0.62}c${w * 0.08},${-h * 0.5} ${w * 0.14},${h * 0.35} ${w * 0.22},${-h * 0.05}s${w * 0.12},${h * 0.3} ${w * 0.22},${-h * 0.15}s${w * 0.1},${h * 0.2} ${w * 0.18},0`,
  (x: number, y: number, w: number, h: number) =>
    `M${x + 4},${y + h * 0.5}c${w * 0.05},${h * 0.3} ${w * 0.12},${-h * 0.45} ${w * 0.2},${-h * 0.1}s${w * 0.06},${h * 0.35} ${w * 0.16},${h * 0.1}l${w * 0.24},${-h * 0.08}`,
  (x: number, y: number, w: number, h: number) =>
    `M${x + 4},${y + h * 0.66}l${w * 0.06},${-h * 0.36}l${w * 0.05},${h * 0.32}c${w * 0.1},${-h * 0.4} ${w * 0.2},${h * 0.25} ${w * 0.32},${-h * 0.06}`,
]

/** Folha do caderno de votação: 100 linhas de assinatura em 5 colunas, como quem votou assina. */
export function Caderno({ graus, destaque, largura, aoDestacar }: Unidades) {
  const PAD = 10, VAO = 4, COLS = 5, ALT = 8.5
  const w = (largura - 2 * PAD - (COLS - 1) * VAO) / COLS
  const linhas = Math.ceil(graus.length / COLS)
  const altura = PAD + 10 + linhas * (ALT + 2.6) + PAD
  return (
    <svg width={largura} height={altura} aria-hidden className="overflow-visible">
      <rect x={0.5} y={0.5} width={largura - 1} height={altura - 1} rx={6} fill="var(--color-folha)" stroke="var(--color-linha)" />
      {/* a pauta do caderno: a margem de cima */}
      <line x1={PAD} x2={largura - PAD} y1={PAD + 4} y2={PAD + 4} stroke="var(--color-linha-2)" />
      {graus.map((g, i) => {
        const x = PAD + (i % COLS) * (w + VAO)
        const y = PAD + 10 + Math.floor(i / COLS) * (ALT + 2.6)
        const ativo = g === destaque
        return (
          <g key={i} opacity={alfa(g, destaque)} className="transition-opacity duration-300" onPointerEnter={() => aoDestacar?.(g)}>
            <rect x={x} y={y} width={w} height={ALT} rx={2} fill={cor(g)} stroke={ativo ? DESTAQUE : BORDA} strokeWidth={ativo ? 1.2 : 0.6} />
            <path d={RABISCOS[i % 3](x, y, w, ALT)} fill="none" stroke={tracoSobre(g)} strokeOpacity={0.7} strokeWidth={1.1} strokeLinecap="round" />
          </g>
        )
      })}
    </svg>
  )
}

/** Um santinho em miniatura: o cartão na cor do grau, a janela da foto e a linha do nome. */
export function MiniSantinho({ x, y, w, fundo, opacidade = 1, ativo = false }: {
  x: number; y: number; w: number; fundo: string; opacidade?: number; ativo?: boolean
}) {
  const h = w * 1.45
  return (
    <g opacity={opacidade} className="transition-opacity duration-300">
      <rect x={x} y={y} width={w} height={h} rx={Math.min(2, w / 6)} fill={fundo} stroke={ativo ? DESTAQUE : BORDA} strokeWidth={ativo ? 1.2 : 0.7} />
      <rect x={x + w * 0.18} y={y + h * 0.1} width={w * 0.64} height={h * 0.44} rx={Math.min(1.2, w / 10)} fill="var(--color-folha)" opacity={0.86} />
      <rect x={x + w * 0.18} y={y + h * 0.66} width={w * 0.64} height={Math.max(1, h * 0.07)} fill="var(--color-folha)" opacity={0.6} />
    </g>
  )
}

/** 100 santinhos em 10 fileiras, do superior completo (em cima) para baixo. */
export function Santinhos({ graus, destaque, largura, aoDestacar }: Unidades) {
  const VAO = 2.5
  const w = (largura - 9 * VAO) / 10
  const h = w * 1.45
  return (
    <svg width={largura} height={10 * (h + VAO)} aria-hidden>
      {graus.map((g, i) => (
        <g key={i} onPointerEnter={() => aoDestacar?.(g)}>
          <MiniSantinho x={(i % 10) * (w + VAO)} y={Math.floor(i / 10) * (h + VAO)} w={w} fundo={cor(g)} opacidade={alfa(g, destaque)} ativo={g === destaque} />
        </g>
      ))}
    </svg>
  )
}

/** A cadeira do plenário vista de cima (encosto em tinta, assento na cor), em unidades do diâmetro. */
export function Cadeira({ fundo, contorno }: { fundo: string; contorno?: string }) {
  return (
    <>
      <rect x={-0.44} y={-0.5} width={0.88} height={0.22} rx={0.08} fill="var(--color-tinta)" opacity={0.82} />
      <rect
        x={-0.37} y={-0.24} width={0.74} height={0.62} rx={0.15}
        fill={fundo} stroke={contorno ?? 'var(--color-tinta)'} strokeOpacity={contorno ? 1 : 0.35} strokeWidth={contorno ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
    </>
  )
}

/**
 * Um plenário de `cores.length` cadeiras, da esquerda para a direita. Pequenas demais, as cadeiras
 * viram pontos (como no plenário da P1); `sentar` faz as cadeiras se sentarem em varredura.
 */
export function Plenario({ cores, largura, opacidades, ativas, contorno, sentar = false, aoPassar }: {
  cores: string[]
  largura: number
  opacidades?: number[]
  /** cadeiras com contorno de tinta (o grau em destaque) */
  ativas?: boolean[]
  /** contorno de todas as cadeiras (as unidades vazias dos quintos) */
  contorno?: string
  sentar?: boolean
  aoPassar?: (i: number) => void
}) {
  const { lugares, diametro } = hemiciclo(cores.length)
  const R = largura / 2 - 6
  const d = diametro * R
  const altura = R + d + 8
  return (
    <svg width={largura} height={altura} aria-hidden>
      {lugares.map((l, i) => {
        const x = largura / 2 + l.x * R, y = altura - 4 - d / 2 - l.y * R
        const giro = 90 - (l.ang * 180) / Math.PI
        const ativa = ativas?.[i]
        return (
          <g
            key={i}
            transform={`translate(${x} ${y}) rotate(${giro}) scale(${d})`}
            opacity={opacidades?.[i] ?? 1}
            className="transition-opacity duration-300"
            onPointerEnter={aoPassar ? () => aoPassar(i) : undefined}
          >
            <g className={sentar ? 'cadeira-senta' : undefined} style={sentar ? { animationDelay: `${Math.round((i / cores.length) * 650)}ms` } : undefined}>
              {d >= 11 ? (
                <Cadeira fundo={cores[i]} contorno={ativa ? DESTAQUE : contorno} />
              ) : (
                <circle
                  r={0.48}
                  fill={cores[i]}
                  stroke={ativa ? DESTAQUE : (contorno ?? 'var(--color-tinta)')}
                  strokeOpacity={ativa || contorno ? 1 : 0.3}
                  strokeWidth={ativa ? 0.14 : contorno ? 0.1 : 0.07}
                />
              )}
            </g>
          </g>
        )
      })}
    </svg>
  )
}
