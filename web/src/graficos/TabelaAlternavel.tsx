// Todo gráfico tem a tabela equivalente a um clique (o valor nunca depende só da cor ou do hover).
import { Table } from '@phosphor-icons/react'
import { useId, useState } from 'react'

export function TabelaAlternavel({ titulo, colunas, linhas }: { titulo: string; colunas: string[]; linhas: string[][] }) {
  const [aberta, setAberta] = useState(false)
  const id = useId()
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls={id}
        onClick={() => setAberta((a) => !a)}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.78rem] font-semibold text-acao hover:bg-papel"
      >
        <Table size={14} aria-hidden />
        {aberta ? 'Esconder tabela' : 'Ver tabela'}
      </button>
      {aberta && (
        <div id={id} className="mt-1 overflow-x-auto">
          <table className="w-full text-[0.82rem] tabular">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="text-left text-tinta-3">
                {colunas.map((c) => (
                  <th key={c} scope="col" className="py-1.5 pr-4 font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-t border-linha">
                  {l.map((c, j) => (j === 0 ? <th key={j} scope="row" className="py-1.5 pr-4 text-left font-semibold">{c}</th> : <td key={j} className="py-1.5 pr-4">{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
