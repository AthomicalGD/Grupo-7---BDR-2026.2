// Plenário da P1: cada cadeira é um eleito, a cor é quanto a campanha dele gastou (escala log).
// As cadeiras se sentam da esquerda para a direita quando a seleção muda e deslizam para o novo
// lugar quando a ordem muda (por gasto ou por partido). Teclado: setas percorrem, Enter abre.
import { animate, useReducedMotion } from 'motion/react'
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { Assento } from '../api'
import { Retrato } from '../componentes/Retrato'
import { inteiro, nomeProprio, reaisCurto } from '../lib/formato'
import { hemiciclo, medir, ordenar, posicionar, type EscalaGasto, type Ordem } from './geometria'

const W = 1000, H = 520, S = 468, CX = 500, CY = 500
const MUITAS = 400 // acima disso (prefeitos de vários estados): posição por atributo, sem transição por cadeira

interface Posto {
  a: Assento
  x: number
  y: number
  giro: number // graus: o encosto aponta para fora do hemiciclo
  d: number
  i: number
}

function postos(cadeiras: Assento[], ordem: Ordem): Posto[] {
  const { lugares, diametro } = hemiciclo(cadeiras.length)
  return ordenar(cadeiras, ordem).map((a, i) => {
    const l = lugares[i]
    return { a, i, x: CX + l.x * S, y: CY - l.y * S, giro: 90 - (l.ang * 180) / Math.PI, d: diametro * S }
  })
}

/** Uma cadeira vista de cima: assento na cor do gasto, encosto escuro. Pequena demais, vira um ponto. */
const Cadeira = memo(function Cadeira({ p, cor, total, leve }: { p: Posto; cor: string; total: number; leve: boolean }) {
  const vazio = p.a.gasto <= 0
  // o atraso de "sentar" vale o lugar na montagem; reordenar não reinicia a animação
  const [atraso] = useState(() => `${Math.round((p.i / Math.max(1, total)) * 650)}ms`)
  const lugar = leve
    ? { transform: `translate(${p.x} ${p.y}) rotate(${p.giro}) scale(${p.d})` }
    : { style: { transform: `translate(${p.x}px, ${p.y}px) rotate(${p.giro}deg) scale(${p.d})`, transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)' } }
  return (
    <g data-i={p.i} {...lugar}>
      <g className={leve ? undefined : 'cadeira-senta'} style={leve ? undefined : { animationDelay: atraso }}>
        {p.d >= 11 ? (
          <>
            <rect x={-0.44} y={-0.5} width={0.88} height={0.22} rx={0.08} fill="var(--color-tinta)" opacity={0.82} />
            <rect
              x={-0.37} y={-0.24} width={0.74} height={0.62} rx={0.15}
              fill={vazio ? 'var(--color-folha)' : cor}
              stroke="var(--color-tinta)" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke"
              strokeDasharray={vazio ? '2 2' : undefined}
            />
          </>
        ) : (
          <circle r={0.48} fill={vazio ? 'var(--color-folha)' : cor} stroke="var(--color-tinta)" strokeOpacity={0.3} strokeWidth={0.07} />
        )}
      </g>
    </g>
  )
})

/** Todas as cadeiras; memorizado para que o ponteiro (que muda a cada cadeira) não as re-renderize. */
const Bancada = memo(function Bancada({ lista, cores }: { lista: Posto[]; cores: Map<number, string> }) {
  const leve = lista.length > MUITAS
  const cadeiras = lista.map((p) => <Cadeira key={p.a.id} p={p} cor={cores.get(p.a.id)!} total={lista.length} leve={leve} />)
  return leve ? <g className="plenario-surge">{cadeiras}</g> : cadeiras
})

/** Rótulos dos partidos em volta do arco, só onde há espaço. */
function rotulosPartidos(lista: Posto[]) {
  const grupos: { sigla: string; de: number; ate: number }[] = []
  for (const p of lista) {
    const sigla = p.a.partido ?? '?'
    const g = grupos[grupos.length - 1]
    if (g && g.sigla === sigla) g.ate = p.i
    else grupos.push({ sigla, de: p.i, ate: p.i })
  }
  const ang = (p: Posto) => Math.atan2(CY - p.y, p.x - CX)
  return grupos.flatMap((g) => {
    const a0 = ang(lista[g.de]), a1 = ang(lista[g.ate])
    const arco = Math.abs(a0 - a1) * S * 1.07
    if (arco < g.sigla.length * 8 + 10) return []
    const meio = (a0 + a1) / 2
    return [{ sigla: g.sigla, x: CX + Math.cos(meio) * S * 1.075, y: CY - Math.sin(meio) * S * 1.075, meio }]
  })
}

function NumeroAnimado({ valor }: { valor: number | null }) {
  const ref = useRef<HTMLSpanElement>(null)
  const anterior = useRef(valor ?? 0)
  const reduz = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || valor == null) return
    if (reduz) {
      el.textContent = reaisCurto(valor)
      anterior.current = valor
      return
    }
    const ctl = animate(anterior.current, valor, {
      duration: 0.75,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = reaisCurto(v)),
    })
    anterior.current = valor
    return () => ctl.stop()
  }, [valor, reduz])
  return <span ref={ref}>{reaisCurto(valor)}</span>
}

export function CartaoAssento({ a, fator, x, y, dica, alvo }: {
  a: Assento
  fator: number
  x: number
  y: number
  dica?: string
  /** quem segue o ponteiro move o cartão por este ref, sem render */
  alvo?: RefObject<HTMLDivElement | null>
}) {
  const proprio = useRef<HTMLDivElement>(null)
  const ref = alvo ?? proprio
  useLayoutEffect(() => {
    medir(ref.current)
    posicionar(ref.current, x, y)
  }, [ref, x, y, a])
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed left-0 top-0 z-40 flex w-[290px] gap-3 rounded-xl border border-linha bg-folha p-3 shadow-[var(--shadow-papel)] will-change-transform"
      style={{ transform: `translate3d(${x + 16}px, ${y + 16}px, 0)` }}
    >
      <Retrato foto={a.foto} nome={a.nome} tamanho={52} />
      <div className="min-w-0 text-[0.82rem]">
        <p className="font-bold leading-tight">{nomeProprio(a.nome)}</p>
        <p className="text-tinta-3">{[a.partido, a.local ?? a.uf].filter(Boolean).join(' · ')}</p>
        <p className="t-numero mt-1.5 text-[1.45rem]">{reaisCurto(a.gasto * fator)}</p>
        <p className="text-tinta-2">
          gastos na campanha
          {a.votos > 0 && <><br />{inteiro(a.votos)} votos · {reaisCurto((a.gasto * fator) / a.votos)} por voto</>}
        </p>
        {dica && <p className="mt-1.5 text-[0.74rem] font-semibold text-acao">{dica}</p>}
      </div>
    </div>
  )
}

/** Cartão da cadeira procurada, preso ao lado dela (posição em % do desenho, acompanha a rolagem). */
function CartaoFixo({ a, fator, x, y, aoAbrir }: { a: Assento; fator: number; x: number; y: number; aoAbrir: (id: number) => void }) {
  const direita = x / W > 0.55
  return (
    <div
      // em tela estreita o cartão cobriria o plenário: desce para baixo do desenho
      className="absolute z-20 flex w-[280px] gap-3 rounded-xl border border-linha bg-folha p-3 shadow-[var(--shadow-papel)] @max-xl:!static @max-xl:mt-4 @max-xl:w-full @max-xl:![transform:none]"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: `translate(${direita ? 'calc(-100% - 22px)' : '22px'}, -50%)` }}
      role="status"
    >
      <Retrato foto={a.foto} nome={a.nome} tamanho={48} />
      <div className="min-w-0 text-[0.82rem]">
        <p className="font-bold leading-tight">{nomeProprio(a.nome)}</p>
        <p className="text-tinta-3">{[a.partido, a.local ?? a.uf].filter(Boolean).join(' · ')}</p>
        <p className="t-numero mt-1 text-[1.3rem]">{reaisCurto(a.gasto * fator)}</p>
        <p className="text-tinta-2">{a.votos > 0 ? `${inteiro(a.votos)} votos · ${reaisCurto((a.gasto * fator) / a.votos)} por voto` : 'gastos na campanha'}</p>
        <button type="button" onClick={() => aoAbrir(a.id)} className="mt-1 text-[0.78rem] font-semibold text-acao hover:underline">Abrir a carreira</button>
      </div>
    </div>
  )
}

interface Props {
  /** Muda quando a seleção (ano, cargo, lugar) muda: as cadeiras se sentam de novo. */
  chave: string
  cadeiras: Assento[]
  escala: EscalaGasto
  fator: number
  ordem: Ordem
  custo: number | null
  legenda: string // "por cadeira de deputado federal"
  aoAbrir: (id: number) => void
  /** eleito procurado pelo nome (id do político): a cadeira fica destacada até limpar a busca */
  destaque?: number | null
}

export function Plenario({ chave, cadeiras, escala, fator, ordem, custo, legenda, aoAbrir, destaque }: Props) {
  const id = useId()
  const lista = useMemo(() => postos(cadeiras, ordem), [cadeiras, ordem])
  const cores = useMemo(() => new Map(cadeiras.map((a) => [a.id, escala.cor(a.gasto)])), [cadeiras, escala])
  const rotulos = useMemo(() => (ordem === 'partido' ? rotulosPartidos(lista) : []), [lista, ordem])
  const [foco, setFoco] = useState<{ i: number; x: number; y: number; toque?: boolean; teclado?: boolean } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const cartao = useRef<HTMLDivElement>(null)
  // no toque não há hover: o primeiro toque mostra a cadeira, o segundo abre a carreira
  const toque = useRef(false)
  const achado = destaque != null ? lista.find((p) => p.a.id === destaque) : undefined
  // ao achar, rola até o plenário (sem animar se a pessoa pediu menos movimento)
  useEffect(() => {
    if (destaque == null) return
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    svg.current?.scrollIntoView({ block: 'center', behavior: reduz ? 'auto' : 'smooth' })
  }, [destaque])

  const naTela = (p: Posto) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: r.left + (p.x / W) * r.width, y: r.top + (p.y / H) * r.height }
  }
  const ir = (i: number) => {
    const p = lista[Math.max(0, Math.min(lista.length - 1, i))]
    if (p) setFoco({ i: p.i, ...naTela(p), teclado: true })
  }
  const teclado = (e: KeyboardEvent) => {
    if (!lista.length) return
    const atual = foco?.i ?? -1
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[e.key]
    if (passo) {
      e.preventDefault()
      ir(atual < 0 ? 0 : atual + passo)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      ir(e.key === 'Home' ? 0 : lista.length - 1)
    } else if (e.key === 'Enter' && foco) {
      aoAbrir(lista[foco.i].a.id)
    } else if (e.key === 'Escape') {
      setFoco(null)
    }
  }
  const sob = (alvo: EventTarget) => (alvo as Element).closest?.('[data-i]')?.getAttribute('data-i')
  const atual = foco ? lista[foco.i] : undefined

  return (
    <div className="relative [container-type:inline-size]">
      <div
        tabIndex={0}
        role="group"
        aria-label={`Plenário com ${cadeiras.length} cadeiras. Use as setas para percorrer e Enter para abrir a carreira.`}
        aria-describedby={`${id}-vivo`}
        onKeyDown={teclado}
        onBlur={() => setFoco(null)}
        className="relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-acao"
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full cursor-pointer select-none overflow-visible"
          aria-hidden
          onPointerDown={(e) => (toque.current = e.pointerType !== 'mouse')}
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse') return
            const s = sob(e.target)
            // o estado só muda ao entrar em outra cadeira; entre elas, o cartão só acompanha o ponteiro
            if (s != null) {
              const i = Number(s), x = e.clientX, y = e.clientY
              setFoco((f) => (f && f.i === i && !f.toque && !f.teclado ? f : { i, x, y }))
            }
            posicionar(cartao.current, e.clientX, e.clientY)
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setFoco(null)
          }}
          onClick={(e) => {
            const i = sob(e.target)
            if (i == null) return
            if (toque.current && foco?.i !== Number(i)) setFoco({ i: Number(i), x: e.clientX, y: e.clientY, toque: true })
            else aoAbrir(lista[Number(i)].a.id)
          }}
        >
          <g key={chave}>
            <Bancada lista={lista} cores={cores} />
          </g>
          {rotulos.map((r) => (
            <text
              key={r.sigla + r.x}
              x={r.x}
              y={r.y}
              textAnchor={Math.cos(r.meio) > 0.25 ? 'start' : Math.cos(r.meio) < -0.25 ? 'end' : 'middle'}
              className="fill-tinta-2 text-[15px] font-bold"
              style={{ fontStretch: '92%' }}
            >
              {r.sigla}
            </text>
          ))}
        </svg>
        {/* cadeira procurada: as outras escurecem e ela ganha um anel amarelo */}
        {achado && (
          <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-x-0 top-0 block w-full overflow-visible" aria-hidden>
            <defs>
              <mask id={`${id}-furo`}>
                <rect width={W} height={H} fill="white" />
                <circle cx={achado.x} cy={achado.y} r={Math.max(16, achado.d * 1.05)} fill="black" />
              </mask>
            </defs>
            {/* só dentro do desenho: a legenda e os controles embaixo continuam legíveis */}
            <rect width={W} height={H} fill="var(--color-papel)" opacity={0.72} mask={`url(#${id}-furo)`} />
            <circle className="destaque-anel" cx={achado.x} cy={achado.y} r={Math.max(14, achado.d * 0.95)} fill="none" stroke="var(--color-marcador)" strokeWidth={4} />
            <circle cx={achado.x} cy={achado.y} r={Math.max(14, achado.d * 0.95) + 3} fill="none" stroke="var(--color-tinta)" strokeWidth={1.5} />
          </svg>
        )}
        {/* o destaque do ponteiro fica num SVG à parte: mexer nele não obriga a recalcular as centenas de cadeiras */}
        {atual && (
          <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-x-0 top-0 block w-full overflow-visible" aria-hidden>
            <circle cx={atual.x} cy={atual.y} r={Math.max(7, atual.d * 0.66)} fill="none" stroke="var(--color-tinta)" strokeWidth={2.5} />
          </svg>
        )}
      </div>
      {/* no miolo do hemiciclo; em telas estreitas o miolo é pequeno demais e o número desce para baixo dele */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center @max-xl:static @max-xl:mt-4">
        {/* o número cabe no miolo: o tamanho cai com o comprimento do texto ("R$ 6,2 mi" x "R$ 562,9 mil") */}
        <p className="t-numero leading-none @max-xl:!text-[2.6rem]" style={{ fontSize: `clamp(1.5rem, ${Math.min(7.4, 62 / reaisCurto((custo ?? 0) * fator).length).toFixed(2)}cqw, 5.2rem)` }}>
          <NumeroAnimado valor={custo == null ? null : custo * fator} />
        </p>
        <p className="mt-1.5 max-w-[30cqw] text-[clamp(0.72rem,1.6cqw,1rem)] font-semibold leading-snug text-tinta-2 @max-xl:max-w-none @max-xl:text-[0.9rem]">{legenda}</p>
      </div>
      <p id={`${id}-vivo`} className="sr-only" aria-live="polite">
        {atual && foco?.teclado ? `${nomeProprio(atual.a.nome)}, ${atual.a.partido ?? ''}: gastou ${reaisCurto(atual.a.gasto * fator)}, ${inteiro(atual.a.votos)} votos.` : ''}
      </p>
      {atual && foco && (
        <CartaoAssento a={atual.a} fator={fator} x={foco.x} y={foco.y} alvo={cartao} dica={foco.toque ? 'Toque de novo para abrir a carreira' : 'Clique para abrir a carreira'} />
      )}
      {achado && !foco && <CartaoFixo a={achado.a} fator={fator} x={achado.x} y={achado.y} aoAbrir={aoAbrir} />}
    </div>
  )
}
