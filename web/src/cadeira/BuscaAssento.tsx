// Procurar um eleito no plenário: digita o nome, Enter destaca a cadeira dele.
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import type { Assento } from '../api'
import { nomeProprio, semAcento } from '../lib/formato'

export function BuscaAssento({ cadeiras, achado, aoAchar }: { cadeiras: Assento[]; achado: number | null; aoAchar: (id: number | null) => void }) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [aberta, setAberta] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const indice = useMemo(() => cadeiras.map((a) => ({ a, chave: semAcento(a.nome) })), [cadeiras])
  const q = semAcento(texto.trim())
  const lista = q.length < 2 ? [] : indice
    .filter((x) => x.chave.includes(q))
    .sort((x, y) => Number(!x.chave.startsWith(q)) - Number(!y.chave.startsWith(q)) || x.chave.localeCompare(y.chave))
    .slice(0, 6)
    .map((x) => x.a)
  const mostra = aberta && q.length >= 2

  const escolher = (a: Assento) => {
    setTexto(nomeProprio(a.nome))
    setAberta(false)
    aoAchar(a.id)
  }
  const limpar = () => {
    setTexto('')
    setAberta(false)
    aoAchar(null)
  }
  const teclado = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAberta(true)
      setAtivo((i) => Math.max(0, Math.min(lista.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const a = lista[ativo] ?? lista[0]
      if (a) escolher(a)
    } else if (e.key === 'Escape') {
      limpar()
    }
  }

  return (
    <div className="relative w-full max-w-[380px]">
      <label htmlFor={id} className="sr-only">Procurar eleito neste plenário</label>
      <MagnifyingGlass size={17} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3" />
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={mostra}
        aria-controls={`${id}-lista`}
        aria-activedescendant={mostra && lista[ativo] ? `${id}-${lista[ativo].id}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={texto}
        placeholder="Procurar eleito e apertar Enter"
        onChange={(e) => {
          setTexto(e.target.value)
          setAberta(true)
          setAtivo(0)
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => setTimeout(() => setAberta(false), 120)}
        onKeyDown={teclado}
        className="h-10 w-full rounded-full border border-linha-2 bg-folha pl-10 pr-9 text-[0.9rem] outline-none placeholder:text-tinta-3 focus-visible:border-tinta focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-acao [&::-webkit-search-cancel-button]:hidden"
      />
      {(texto || achado != null) && (
        <button type="button" onClick={limpar} aria-label="Limpar a busca e o destaque" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-tinta-3 hover:bg-papel hover:text-tinta">
          <X size={13} weight="bold" aria-hidden />
        </button>
      )}
      {mostra && (
        <ul id={`${id}-lista`} role="listbox" aria-label="Eleitos encontrados" className="absolute left-0 right-0 top-12 z-30 rounded-xl border border-linha bg-folha p-1.5 shadow-[var(--shadow-papel)]">
          {lista.length === 0 ? (
            <li className="px-2 py-1.5 text-[0.85rem] text-tinta-2">Nenhum eleito com esse nome neste plenário.</li>
          ) : (
            lista.map((a, i) => (
              <li
                key={a.id}
                id={`${id}-${a.id}`}
                role="option"
                aria-selected={i === ativo}
                onPointerDown={(e) => {
                  e.preventDefault() // não tira o foco do campo antes de escolher
                  escolher(a)
                }}
                className={`cursor-pointer rounded-lg px-2 py-1.5 text-[0.86rem] ${i === ativo ? 'bg-papel' : ''}`}
              >
                <span className="font-semibold">{nomeProprio(a.nome)}</span>
                <span className="text-tinta-3"> · {[a.partido, a.local ?? a.uf].filter(Boolean).join(' · ')}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
