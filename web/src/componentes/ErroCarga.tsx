import { WarningCircle } from '@phosphor-icons/react'
import { ErroApi } from '../api'

/** Erro de carga com o que fazer: subir o banco ou a API, ou corrigir o endereço. */
export function ErroCarga({ erro, compacto = false }: { erro: unknown; compacto?: boolean }) {
  const status = erro instanceof ErroApi ? erro.status : 0
  const titulo = status === 404 ? 'Não encontrado' : status === 503 ? 'O banco de dados está fora do ar' : 'Não foi possível carregar os dados'
  const dica =
    status === 503 ? 'docker compose up -d' : status === 0 ? 'python -m uvicorn api.app:app --port 8000' : null
  return (
    <div role="alert" className={`mx-auto max-w-[640px] ${compacto ? 'py-10' : 'px-4 py-24'}`}>
      <WarningCircle size={32} className="text-corrige" aria-hidden />
      <h1 className="t-h2 mt-3">{titulo}</h1>
      <p className="mt-2 text-tinta-2">{erro instanceof Error ? erro.message : String(erro)}</p>
      {dica && (
        <p className="mt-4 rounded-xl border border-linha bg-folha px-4 py-3 text-[0.9rem]">
          Na pasta do projeto: <code className="t-mono">{dica}</code>
        </p>
      )}
      <button type="button" onClick={() => location.reload()} className="mt-5 rounded-full bg-tinta px-5 py-2.5 text-[0.9rem] font-semibold text-white hover:bg-[#2a3442]">
        Tentar de novo
      </button>
    </div>
  )
}
