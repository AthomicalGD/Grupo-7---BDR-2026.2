// Peças da interface simples: régua do viés, estados de carga e a busca de município.
import { CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId, useState, type ReactNode } from 'react'
import { consultas } from '../api'
import { vies as fmtVies } from '../lib/formato'
import { SATURA } from '../lib/vies'
import { corVies } from './cores'

/** Viés com sinal e uma régua de −SATURA a +SATURA: a barra sai do centro na cor do lado. */
export function Vies({ valor, regua = true }: { valor: number | null | undefined; regua?: boolean }) {
  if (valor == null) return <span className="text-tinta-3">sem dados</span>
  const f = Math.min(1, Math.abs(valor) / SATURA) * 50
  return (
    <span className="inline-flex items-center justify-end gap-2 tabular-nums">
      <span className="w-[3.2rem] text-right font-semibold">{fmtVies(valor)}</span>
      {regua && (
        <span aria-hidden className="relative hidden h-2 w-14 rounded-sm bg-papel-2 sm:block">
          <span className="absolute inset-y-[-2px] left-1/2 w-px bg-linha-2" />
          <span
            className="absolute inset-y-0 rounded-sm"
            style={{ background: corVies(valor), width: `${f}%`, [valor < 0 ? 'right' : 'left']: '50%' }}
          />
        </span>
      )}
    </span>
  )
}

export function Carregando() {
  return <p className="py-8 text-tinta-2" role="status">Carregando...</p>
}

export function Erro({ erro }: { erro: unknown }) {
  return (
    <p className="my-6 rounded-md border border-corrige/50 bg-folha px-4 py-3 text-tinta" role="alert">
      {(erro as Error)?.message ?? 'Não foi possível carregar os dados.'}
    </p>
  )
}

export function Titulo({ children, sub, lado }: { children: ReactNode; sub?: ReactNode; lado?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div className="min-w-0 max-w-[44rem]">
        <h1 className="text-[2rem] font-[780] leading-[1.05] tracking-[-0.02em] [text-wrap:balance] sm:text-[2.75rem]">{children}</h1>
        {sub && <div className="mt-3 text-[1.05rem] text-tinta-2">{sub}</div>}
      </div>
      {lado}
    </header>
  )
}

export function Secao({ titulo, nota, children, acao }: { titulo: string; nota?: ReactNode; children: ReactNode; acao?: ReactNode }) {
  return (
    <section className="mt-14 border-t border-linha pt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-[44rem]">
          <h2 className="text-[1.3rem] font-bold leading-tight">{titulo}</h2>
          {nota && <p className="mt-1 text-[0.95rem] text-tinta-2">{nota}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

/** Uma linha de números lado a lado: o rótulo em cima, o valor grande embaixo. */
export function Fatos({ itens }: { itens: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      {itens.map((i) => (
        <div key={i.rotulo} className="min-w-0">
          <dt className="text-[0.85rem] text-tinta-2">{i.rotulo}</dt>
          <dd className="mt-0.5 text-[1.45rem] font-bold leading-tight tabular-nums">{i.valor}</dd>
          {i.detalhe && <dd className="text-[0.8rem] text-tinta-3">{i.detalhe}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** Em volta de tabelas longas: fechada por padrão, para o gráfico vir primeiro. */
export function VerTabela({ rotulo = 'Ver tabela', children }: { rotulo?: string; children: ReactNode }) {
  return (
    <details className="group mt-5">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[0.92rem] font-semibold text-acao hover:underline">
        <CaretRight aria-hidden weight="bold" className="transition-transform group-open:rotate-90" />
        {rotulo}
      </summary>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </details>
  )
}

export function Trilha({ itens }: { itens: { rotulo: string; para?: ReactNode }[] }) {
  return (
    <nav aria-label="Você está em" className="mb-3 text-[0.9rem] text-tinta-2">
      {itens.map((i, n) => (
        <span key={n}>
          {n > 0 && <span aria-hidden> / </span>}
          {i.para ?? <span aria-current="page">{i.rotulo}</span>}
        </span>
      ))}
    </nav>
  )
}

export const campo =
  'h-12 w-full rounded-lg border border-linha-2 bg-folha px-3 text-tinta placeholder:text-tinta-3 focus:border-tinta focus:outline-none'

/** Escolha em botões (anos, cargos): todas as opções à vista, a marcada em tinta. */
export function Opcoes<T extends string | number>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string
  valor: T
  opcoes: readonly { valor: T; rotulo: string }[]
  aoMudar: (v: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.85rem] font-semibold text-tinta-2">{rotulo}</legend>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={o.valor === valor}
            onClick={() => aoMudar(o.valor)}
            className={`h-9 rounded-md border px-3 text-[0.92rem] ${o.valor === valor ? 'border-tinta bg-tinta font-semibold text-folha' : 'border-linha-2 bg-folha text-tinta hover:border-tinta'}`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function BuscaMunicipio({ uf = '' }: { uf?: string }) {
  const [q, setQ] = useState('')
  const id = useId()
  const { data, isFetching } = useQuery(consultas.buscaMunicipios(q, uf))
  const ativo = q.trim().length >= 2
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.85rem] font-semibold text-tinta-2">
        Buscar município
      </label>
      <div className="relative">
        <MagnifyingGlass aria-hidden size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3" />
        <input id={id} className={`${campo} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite ao menos 2 letras" autoComplete="off" />
      </div>
      {ativo && (
        <ul className="mt-2 divide-y divide-linha rounded-md border border-linha bg-folha" aria-live="polite">
          {data?.length === 0 && <li className="px-3 py-2.5 text-tinta-2">Nenhum município com esse nome.</li>}
          {!data && isFetching && <li className="px-3 py-2.5 text-tinta-2">Procurando...</li>}
          {data?.map((m) => (
            <li key={m.ibge}>
              {m.carregada ? (
                <Link
                  to="/uf/$sigla/$ibge"
                  params={{ sigla: m.uf, ibge: String(m.ibge) }}
                  className="flex justify-between px-3 py-2.5 hover:bg-papel"
                >
                  <span className="font-semibold text-acao">{m.nome}</span>
                  <span className="text-tinta-2">{m.uf}</span>
                </Link>
              ) : (
                <span className="flex justify-between px-3 py-2.5 text-tinta-2">
                  <span>{m.nome}</span>
                  <span>{m.uf}, sem dados carregados</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const tabela = 'w-full border-collapse text-[0.95rem]'
export const th = 'border-b-2 border-tinta py-2 pr-3 text-left text-[0.85rem] font-semibold text-tinta-2'
export const td = 'border-b border-linha py-2 pr-3 align-top'
