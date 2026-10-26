// Todo gráfico tem a tabela equivalente a um clique (o valor nunca depende só da cor ou do hover), o CSV para
// baixar e conferir numa planilha e, quando há, a consulta SQL que dá origem aos números.
import { Check, Copy, Database, DownloadSimple, Table } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { SQL, type ConsultaSql } from '../lib/sql'

/** CSV para o Excel em português: ponto e vírgula, aspas onde precisa e o BOM para os acentos. */
function baixarCsv(titulo: string, colunas: string[], linhas: string[][]) {
  const celula = (c: string) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
  const texto = [colunas, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${titulo.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Aba = 'tabela' | 'sql' | null

/** `linhas` pode ser uma função: só é chamada quando a tabela abre ou o CSV sai (o plenário tem até 1.500 eleitos). */
export function TabelaAlternavel({ titulo, colunas, linhas, sql }: {
  titulo: string
  colunas: string[]
  linhas: string[][] | (() => string[][])
  /** a consulta (de lib/sql) por trás do gráfico */
  sql?: ConsultaSql
}) {
  const [aba, setAba] = useState<Aba>(null)
  const [copiado, setCopiado] = useState(false)
  const id = useId()
  const pegar = () => (typeof linhas === 'function' ? linhas() : linhas)
  const botao = 'inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-[0.82rem] font-semibold text-acao hover:bg-papel aria-expanded:bg-acao-claro'
  const alternar = (a: Exclude<Aba, null>) => setAba((atual) => (atual === a ? null : a))
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1" role="group" aria-label={`Dados de: ${titulo}`}>
        <button type="button" aria-expanded={aba === 'tabela'} aria-controls={id} onClick={() => alternar('tabela')} className={botao}>
          <Table size={15} aria-hidden />
          {aba === 'tabela' ? 'Esconder tabela' : 'Ver tabela'}
        </button>
        <button type="button" onClick={() => baixarCsv(titulo, colunas, pegar())} className={botao}>
          <DownloadSimple size={15} aria-hidden />
          Baixar CSV
        </button>
        {sql && (
          <button type="button" aria-expanded={aba === 'sql'} aria-controls={id} onClick={() => alternar('sql')} className={botao}>
            <Database size={15} aria-hidden />
            {aba === 'sql' ? 'Esconder SQL' : 'Ver SQL'}
          </button>
        )}
      </div>
      {aba === 'tabela' && (
        <div id={id} className="mt-1 overflow-x-auto">
          <table className="w-full text-[0.84rem] tabular">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="text-left text-tinta-3">
                {colunas.map((c) => (
                  <th key={c} scope="col" className="py-1.5 pr-4 font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pegar().map((l, i) => (
                <tr key={i} className="border-t border-linha">
                  {l.map((c, j) => (j === 0 ? <th key={j} scope="row" className="py-1.5 pr-4 text-left font-semibold">{c}</th> : <td key={j} className="py-1.5 pr-4">{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aba === 'sql' && sql && (
        <div id={id} className="relative mt-2 overflow-hidden rounded-xl border border-linha bg-folha">
          <div className="flex items-center justify-between gap-3 border-b border-linha px-3.5 py-2 text-[0.8rem] text-tinta-2">
            <span>PostgreSQL · exemplo com um recorte fixo; a API troca cargo, ano e estado</span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(SQL[sql]).then(() => {
                setCopiado(true)
                setTimeout(() => setCopiado(false), 1600)
              })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-acao hover:bg-papel"
            >
              {copiado ? <Check size={14} weight="bold" aria-hidden /> : <Copy size={14} aria-hidden />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="max-h-[360px] overflow-auto px-3.5 py-3 text-[0.8rem] leading-relaxed"><code className="t-mono">{SQL[sql]}</code></pre>
        </div>
      )}
    </div>
  )
}
