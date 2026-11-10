import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { consultas } from '../api'

/** O logo ao lado da sigla, num fundo branco (vários são escuros ou transparentes, e sumiriam no tema escuro).
 *  Sem logo, só o espaço vazio, para as siglas continuarem alinhadas. */
export function LogoPartido({ sigla }: { sigla: string }) {
  const { data } = useQuery(consultas.logosPartidos())
  const [falhou, setFalhou] = useState(false)
  const logo = data?.[sigla]
  return (
    <span className="grid h-7 w-11 shrink-0 place-items-center" aria-hidden>
      {logo && !falhou && (
        <span className="size-full overflow-hidden rounded-md bg-white p-0.5 ring-1 ring-linha">
          <img src={logo.url} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)}
            title={`Logo: ${logo.fonte === 'camara' ? 'Câmara dos Deputados' : `Wikimedia Commons${logo.licenca ? ` (${logo.licenca})` : ''}`}`}
            className="block size-full object-contain" />
        </span>
      )}
    </span>
  )
}
