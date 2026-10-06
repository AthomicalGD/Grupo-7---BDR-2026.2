import { useLayoutEffect, useRef, useState } from 'react'
import type { Ano, MunicipioResumo, UF } from '../api'
import { inteiro, vies as fmtVies } from '../lib/formato'
import { useLoja } from '../lib/loja'
import { corVies, ladoVies, SATURA } from '../lib/vies'
import { SATURA_RELATIVO, valorMunicipio } from './valores'

import { hover } from './hover'

/** Régua mínima do viés: onde o valor cai entre esquerda e direita. */
export function Regua({ valor, satura = SATURA, largura = 132 }: { valor: number; satura?: number; largura?: number }) {
  const x = ((Math.max(-satura, Math.min(satura, valor)) + satura) / (2 * satura)) * largura
  return (
    <svg width={largura} height={14} aria-hidden className="block">
      <rect x={0} y={6} width={largura} height={2} rx={1} fill="var(--color-linha)" />
      <rect x={largura / 2 - 0.5} y={3} width={1} height={8} fill="var(--color-linha-2)" />
      <circle cx={x} cy={7} r={5} fill={corVies(valor, satura)} stroke="var(--color-folha)" strokeWidth={2} />
    </svg>
  )
}

interface Props {
  ufPorCodigo: Map<number, UF>
  munPorIbge: Map<number, MunicipioResumo>
  ano: Ano
  relativo: boolean
  vUF?: number
}

export function Dica({ ufPorCodigo, munPorIbge, ano, relativo, vUF }: Props) {
  const foco = useLoja(hover)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    if (!foco || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    const margem = 14
    let left = foco.x + margem, top = foco.y + margem
    if (left + width > window.innerWidth - 8) left = foco.x - width - margem
    if (top + height > window.innerHeight - 8) top = foco.y - height - margem
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [foco])

  if (!foco) return null
  let conteudo
  if (foco.tipo === 'uf') {
    const uf = ufPorCodigo.get(foco.codigo)
    if (!uf) return null
    const v = uf.vies[ano]
    conteudo = uf.carregada ? (
      <>
        <p className="t-rotulo text-tinta-2">{uf.nome} · {ano}</p>
        <p className="t-numero mt-1 text-[1.9rem]">{fmtVies(v)}</p>
        <p className="text-[0.82rem] text-tinta-2">{ladoVies(v)}</p>
        {v != null && <div className="mt-2"><Regua valor={v} /></div>}
      </>
    ) : (
      <>
        <p className="t-rotulo text-tinta-2">{uf.nome}</p>
        <p className="mt-1 font-semibold">Sem dados carregados</p>
        <p className="mt-1 text-[0.8rem] text-tinta-3">
          <code className="t-mono">python -m loader {uf.sigla}</code>
        </p>
      </>
    )
  } else {
    const m = munPorIbge.get(foco.codigo)
    if (!m) return null
    const v = m.vies[ano]
    const rel = valorMunicipio(m, ano, true, vUF)
    conteudo = (
      <>
        <p className="t-rotulo text-tinta-2">{m.nome} · {ano}</p>
        <p className="t-numero mt-1 text-[1.9rem]">{fmtVies(v)}</p>
        <p className="text-[0.82rem] text-tinta-2">
          {relativo && rel != null ? `${fmtVies(rel)} em relação ao estado` : ladoVies(v)}
        </p>
        {v != null && (
          <div className="mt-2">
            <Regua valor={relativo && rel != null ? rel : v} satura={relativo ? SATURA_RELATIVO : SATURA} />
          </div>
        )}
        {m.aptos[ano] != null && <p className="mt-2 text-[0.78rem] text-tinta-3">{inteiro(m.aptos[ano])} eleitores aptos</p>}
      </>
    )
  }
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-40 min-w-[156px] rounded-xl border border-linha bg-folha/97 px-3.5 py-3 shadow-[var(--shadow-papel)]"
      style={{ left: pos.left, top: pos.top }}
    >
      {conteudo}
    </div>
  )
}
