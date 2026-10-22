import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { consultas, type MunicipioBusca } from '../api'

function useAtrasado<T>(valor: T, ms = 160) {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const id = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(id)
  }, [valor, ms])
  return v
}

interface Props {
  uf?: string
  aoEscolher: (m: MunicipioBusca) => void
  rotulo?: string
}

export function BuscaMunicipio({ uf = '', aoEscolher, rotulo = 'Digite um município' }: Props) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [aberta, setAberta] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const q = useAtrasado(texto.trim())
  const { data = [], isFetching } = useQuery({ ...consultas.buscaMunicipios(q, uf), placeholderData: (anterior) => anterior })
  const lista = q.length >= 2 ? data : []
  const mostra = aberta && texto.trim().length >= 2

  const escolher = (m: MunicipioBusca) => {
    setTexto('')
    setAberta(false)
    aoEscolher(m)
  }
  const teclado = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberta(true)
      setAtivo((i) => Math.min(lista.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && lista[ativo]) {
      e.preventDefault()
      escolher(lista[ativo])
    } else if (e.key === 'Escape') {
      setAberta(false)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-campo`} className="sr-only">
        {rotulo}
      </label>
      <div className="flex h-[52px] items-center gap-3 rounded-full border-[1.5px] border-linha-2 bg-folha px-5 transition-colors focus-within:border-tinta">
        <MagnifyingGlass size={20} className="shrink-0 text-tinta-2" aria-hidden />
        <input
          id={`${id}-campo`}
          role="combobox"
          aria-expanded={mostra}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={mostra && lista[ativo] ? `${id}-${lista[ativo].ibge}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={rotulo}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setAtivo(0)
            setAberta(true)
          }}
          onFocus={() => setAberta(true)}
          onBlur={() => setTimeout(() => setAberta(false), 120)}
          onKeyDown={teclado}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-tinta outline-none placeholder:text-tinta-3"
        />
        {texto && (
          <button type="button" onClick={() => setTexto('')} className="rounded-full p-1 text-tinta-3 hover:text-tinta" aria-label="Limpar a busca">
            <X size={16} weight="bold" />
          </button>
        )}
      </div>
      {mostra && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          aria-label="Municípios encontrados"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[320px] overflow-auto rounded-2xl border border-linha bg-folha p-1.5 shadow-[var(--shadow-papel)]"
        >
          {lista.length === 0 ? (
            <li className="px-3 py-3 text-[0.9rem] text-tinta-2">
              {isFetching ? 'Procurando...' : `Nenhum município encontrado para "${texto.trim()}".`}
            </li>
          ) : (
            lista.map((m, i) => (
              <li
                key={m.ibge}
                id={`${id}-${m.ibge}`}
                role="option"
                aria-selected={i === ativo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(m)}
                onMouseEnter={() => setAtivo(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${i === ativo ? 'bg-papel' : ''}`}
              >
                <span className="font-semibold">{m.nome}</span>
                <span className="flex items-center gap-2 text-[0.78rem]">
                  {!m.carregada && <span className="rounded-full bg-papel-2 px-2 py-0.5 text-tinta-3">sem dados</span>}
                  <span className="t-mono text-tinta-3">{m.uf}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
