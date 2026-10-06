// Barras divergentes a partir do zero: regiões intermediárias (ou qualquer lista) no ano.
import { vies as fmtVies } from '../lib/formato'
import { corVies } from '../lib/vies'
import { TabelaAlternavel } from './TabelaAlternavel'

export interface ItemBarra {
  nome: string
  valor: number | undefined
}

export function BarrasDivergentes({ itens, titulo, destaque }: { itens: ItemBarra[]; titulo: string; destaque?: string }) {
  const validos = itens.filter((i) => i.valor != null).sort((a, b) => a.valor! - b.valor!)
  const max = Math.max(20, ...validos.map((i) => Math.abs(i.valor!)))
  const lim = Math.ceil((max * 1.25) / 10) * 10 // folga para o rótulo da barra mais longa
  const pos = (v: number) => 50 + (v / lim) * 50 // % da largura
  return (
    <figure className="m-0">
      <ul className="space-y-1.5" aria-label={titulo}>
        {validos.map((i) => {
          const v = i.valor!
          const a = Math.min(pos(0), pos(v)), b = Math.max(pos(0), pos(v))
          return (
            <li key={i.nome} className="grid grid-cols-[minmax(0,40%)_1fr] items-center gap-3 text-[0.82rem]">
              <span className={`truncate ${i.nome === destaque ? 'font-bold text-tinta' : 'text-tinta-2'}`} title={i.nome}>
                {i.nome}
              </span>
              <span className="relative block h-5">
                <span className="absolute inset-y-0 left-1/2 w-px bg-linha-2" aria-hidden />
                <span
                  className="absolute top-[4px] h-3 rounded-[3px]"
                  style={{ left: `${a}%`, width: `${Math.max(0.6, b - a)}%`, background: corVies(v) }}
                />
                <span
                  className="absolute top-0 text-[0.74rem] font-semibold tabular text-tinta-2"
                  style={v < 0 ? { right: `calc(${100 - a}% + 6px)` } : { left: `calc(${b}% + 6px)` }}
                >
                  {fmtVies(v)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <TabelaAlternavel titulo={titulo} colunas={['Região', 'Viés']} linhas={validos.map((i) => [i.nome, fmtVies(i.valor)])} />
    </figure>
  )
}
