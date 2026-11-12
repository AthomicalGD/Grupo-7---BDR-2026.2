// Escolha de estados, um ou vários: um clique escolhe só aquele estado; Ctrl (ou Cmd, ou Shift) + clique junta mais
// um; clicar de novo no único escolhido volta a "todos". No celular e no teclado, o botão "Juntar estados" faz o
// mesmo papel do Ctrl. Cada estado é um quadrado de azulejo: o escolhido fica azul.
import { Plus } from '@phosphor-icons/react'
import { useState, type MouseEvent } from 'react'

export function SeletorEstados({ ufs, nomes, valor, aoMudar, rotulo = 'Estados' }: {
  /** os estados que existem aqui (com dados) */
  ufs: readonly string[]
  /** sigla para nome inteiro */
  nomes: ReadonlyMap<string, string>
  /** os escolhidos; vazio = todos */
  valor: readonly string[]
  aoMudar: (siglas: string[]) => void
  rotulo?: string
}) {
  const [juntando, setJuntando] = useState(false)
  const todos = valor.length === 0

  const clicar = (sigla: string, e: MouseEvent) => {
    const junta = e.ctrlKey || e.metaKey || e.shiftKey || juntando
    if (junta) {
      aoMudar(valor.includes(sigla) ? valor.filter((x) => x !== sigla) : [...valor, sigla])
    } else {
      aoMudar(valor.length === 1 && valor[0] === sigla ? [] : [sigla])
    }
  }

  const resumo = todos ? 'Todos os estados com dados' : valor.map((s) => nomes.get(s) ?? s).join(' + ')

  return (
    <fieldset className="min-w-0">
      <legend className="t-rotulo mb-2 text-tinta-2">{rotulo}</legend>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={rotulo}>
        <button
          type="button"
          aria-pressed={todos}
          onClick={() => aoMudar([])}
          className={`h-9 rounded-[var(--canto)] border-[2.5px] border-tinta px-3 text-[0.8rem] font-bold transition-[background-color,color,transform] active:scale-95 ${
            todos ? 'bg-[var(--azul)] text-white' : 'bg-folha text-tinta hover:bg-papel-2'
          }`}
        >
          Todos
        </button>
        {ufs.map((sigla) => {
          const marcado = valor.includes(sigla)
          return (
            <button
              key={sigla}
              type="button"
              aria-pressed={marcado}
              aria-label={nomes.get(sigla) ?? sigla}
              title={`${nomes.get(sigla) ?? sigla}. Ctrl + clique junta mais estados.`}
              onClick={(e) => clicar(sigla, e)}
              className={`grid h-9 min-w-9 place-items-center rounded-[var(--canto)] border-[2.5px] border-tinta px-1.5 text-[0.78rem] font-bold tabular transition-[background-color,color,transform] active:scale-95 ${
                marcado ? 'bg-[var(--azul)] text-white' : 'bg-folha text-tinta hover:bg-papel-2'
              }`}
            >
              {sigla}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={juntando}
          onClick={() => setJuntando((v) => !v)}
          title="Com este botão ligado, cada clique junta mais um estado (no celular não há Ctrl)."
          className={`ml-1 inline-flex h-9 items-center gap-1 rounded-full border-[2.5px] border-tinta px-3 text-[0.78rem] font-bold transition-[background-color,color] ${
            juntando ? 'bg-[var(--amarelo)] text-tinta' : 'bg-folha text-tinta-2 hover:bg-papel-2'
          }`}
        >
          <Plus size={13} weight="bold" aria-hidden /> Juntar estados
        </button>
      </div>
      <p className="mt-2 text-[0.8rem] text-tinta-2" aria-live="polite">
        {resumo}
        <span className="ml-2 text-tinta-3 max-sm:hidden">Ctrl + clique para juntar</span>
      </p>
    </fieldset>
  )
}
