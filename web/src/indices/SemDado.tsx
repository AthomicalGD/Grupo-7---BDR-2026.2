// O estado "sem dado" da P3: o IFDM ainda não foi carregado no banco. Em vez de uma caixa vazia, uma peça que diz o
// que falta e o comando que resolve, com a saída de ver o resto da página (outro índice) enquanto isso.
import { Database } from '@phosphor-icons/react'

export function SemDado({ titulo = 'O IFDM ainda não chegou ao banco', outro }: { titulo?: string; outro?: { rotulo: string; aoEscolher: () => void } }) {
  return (
    <div role="status" className="peca mt-4 grid gap-x-5 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-5">
      <span className="peca peca-amarela grid size-14 place-items-center sm:size-16" aria-hidden><Database size={32} weight="bold" /></span>
      <div className="min-w-0">
        <h3 className="font-[family-name:var(--font-display)] text-[1.3rem] font-extrabold leading-tight text-tinta">{titulo}</h3>
        <p className="apoio mt-1 text-[0.95rem] text-tinta-2">Este gráfico usa a série histórica de desenvolvimento municipal da Firjan. Para trazê-la:</p>
        <ol className="mt-3 grid max-w-[64ch] gap-2 text-[0.92rem] leading-snug text-tinta-2">
          <li className="flex gap-2.5"><b className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-tinta text-[0.8rem] text-papel" aria-hidden>1</b>
            <span>Baixe a planilha &ldquo;Série Histórica IFDM 2013 a 2023&rdquo; em firjan.com.br/ifdm/downloads e salve em <code className="t-mono text-tinta">dados/firjan/</code>.</span></li>
          <li className="flex gap-2.5"><b className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-tinta text-[0.8rem] text-papel" aria-hidden>2</b>
            <span>No terminal, rode <code className="t-mono rounded bg-papel-2 px-1.5 py-0.5 text-tinta">python -m loader.ifdm</code> e reinicie a API.</span></li>
        </ol>
        {outro && (
          <button type="button" onClick={outro.aoEscolher} className="peca peca-link alvo-44 mt-4 px-4 text-[0.92rem] font-bold text-tinta">
            Enquanto isso, ver com {outro.rotulo}
          </button>
        )}
      </div>
    </div>
  )
}
