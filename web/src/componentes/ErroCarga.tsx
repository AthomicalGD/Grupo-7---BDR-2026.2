import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ErroApi } from '../api'

/**
 * Erro de carga dito para quem lê: o que houve, o que fazer e um "Tentar de novo" que refaz só a consulta (a
 * tela não reinicia). O comando para quem roda o projeto fica recolhido, junto com a mensagem técnica.
 */
export function ErroCarga({ erro, compacto = false, aoTentar }: { erro: unknown; compacto?: boolean; aoTentar?: () => unknown }) {
  const [tentando, setTentando] = useState(false)
  const status = erro instanceof ErroApi ? erro.status : 0
  const { titulo, texto } =
    status === 404
      ? { titulo: 'Não achamos isto', texto: 'O endereço pode estar errado, ou este recorte não tem eleição (o DF, por exemplo, não elege prefeito).' }
      : status === 503
        ? { titulo: 'O banco de dados está desligado', texto: 'Os números moram num banco que não está respondendo agora. Tente de novo em alguns segundos.' }
        : status === 0
          ? { titulo: 'O servidor não respondeu', texto: 'A página abriu, mas o servidor que entrega os dados não. Pode ser a conexão ou o servidor desligado.' }
          : { titulo: 'Os dados não chegaram', texto: 'Algo deu errado do nosso lado ao montar esta consulta. Tentar de novo costuma resolver.' }
  const dica = status === 503 ? 'docker compose up -d' : status === 0 ? 'python -m uvicorn api.app:app --port 8000' : null
  const tentar = async () => {
    if (!aoTentar) return location.reload()
    setTentando(true)
    try {
      await aoTentar()
    } finally {
      setTentando(false)
    }
  }
  return (
    <div role="alert" className={`mx-auto max-w-[620px] ${compacto ? 'py-10' : 'px-4 py-20'}`}>
      <WarningCircle size={32} className="text-corrige" aria-hidden />
      <h1 className={`${compacto ? 't-h3' : 't-h2'} mt-3`}>{titulo}</h1>
      <p className="mt-2 max-w-[56ch] text-tinta-2">{texto}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="button" onClick={tentar} disabled={tentando} className="botao-vivo inline-flex items-center gap-2 px-5 py-2.5 text-[0.92rem] disabled:opacity-60">
          <ArrowClockwise size={16} weight="bold" aria-hidden className={tentando ? 'animate-spin' : undefined} />
          {tentando ? 'Tentando...' : 'Tentar de novo'}
        </button>
        {!compacto && (
          <Link to="/" className="text-[0.92rem] font-semibold text-acao hover:underline">
            Voltar ao mapa
          </Link>
        )}
      </div>
      <details className="mt-6 text-[0.86rem] text-tinta-2">
        <summary className="cursor-pointer font-semibold text-tinta-2">Detalhes para quem roda o projeto</summary>
        <p className="mt-2">{erro instanceof Error ? erro.message : String(erro)}</p>
        {dica && (
          <p className="mt-2 rounded-xl border border-linha bg-folha px-4 py-3">
            Na pasta do projeto: <code className="t-mono">{dica}</code>
          </p>
        )}
      </details>
    </div>
  )
}
