import { MagnifyingGlass } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { consultas } from '../../api'
import { Retrato } from '../../componentes/Retrato'
import { nomeProprio, plural } from '../../lib/formato'
import { campo, Titulo } from '../ui'

export function Politicos() {
  const [q, setQ] = useState('')
  const id = useId()
  const { data, isFetching, error } = useQuery(consultas.buscaPoliticos(q))
  const ativo = q.trim().length >= 3
  return (
    <>
      <Titulo sub="Todas as candidaturas e mandatos de 1994 a 2024. A busca ignora acentos e usa o nome civil registrado no TSE.">
        A carreira de um político
      </Titulo>
      <div className="max-w-xl">
        <label htmlFor={id} className="mb-1.5 block text-[0.85rem] font-semibold text-tinta-2">
          Nome do político
        </label>
        <div className="relative">
          <MagnifyingGlass aria-hidden size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3" />
          <input id={id} className={`${campo} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Wellington Barroso" autoComplete="off" />
        </div>
        {!ativo && <p className="mt-2 text-[0.9rem] text-tinta-3">Digite ao menos 3 letras.</p>}
      </div>
      {ativo && (
        <ul className="mt-8 grid gap-x-6 gap-y-2 sm:grid-cols-2" aria-live="polite">
          {error && <li className="py-3 text-tinta">{(error as Error).message}</li>}
          {!data && isFetching && <li className="py-3 text-tinta-2">Procurando...</li>}
          {data?.length === 0 && <li className="py-3 text-tinta-2">Ninguém com esse nome.</li>}
          {data?.map((p) => (
            <li key={p.id}>
              <Link to="/politico/$id" params={{ id: String(p.id) }} className="group flex items-center gap-4 rounded-lg p-2 hover:bg-papel">
                <Retrato foto={p.foto} nome={p.nome} tamanho={56} />
                <span className="min-w-0">
                  <span className="block font-semibold text-acao group-hover:underline">{nomeProprio(p.nome)}</span>
                  <span className="block text-[0.9rem] text-tinta-2">
                    {p.ufs.join(', ')} · {p.primeiro_ano}
                    {p.ultimo_ano !== p.primeiro_ano && ` a ${p.ultimo_ano}`}
                  </span>
                  <span className="block text-[0.9rem] text-tinta-2">
                    {plural(p.candidaturas, 'candidatura', 'candidaturas')}, {plural(p.vitorias, 'vitória', 'vitórias')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
