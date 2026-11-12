// O logo do partido num fundo branco (vários são escuros ou transparentes e sumiriam no tema escuro). Vem de
// /api/partidos/logos (Câmara dos Deputados e, para os que ela não tem, Wikimedia Commons).
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { consultas } from '../api'

const TAMANHOS = { p: 'h-5 w-8', m: 'h-7 w-11' } as const

/** `reservar`: sem logo, deixa o espaço vazio (as siglas de uma lista continuam alinhadas); senão não ocupa lugar. */
export function LogoPartido({ sigla, tamanho = 'm', reservar = true }: { sigla: string; tamanho?: keyof typeof TAMANHOS; reservar?: boolean }) {
  const { data } = useQuery(consultas.logosPartidos())
  const [falhou, setFalhou] = useState(false)
  const logo = data?.[sigla.toUpperCase()]
  const tem = logo && !falhou
  if (!tem && !reservar) return null
  return (
    <span className={`inline-grid ${TAMANHOS[tamanho]} shrink-0 place-items-center align-middle`} aria-hidden>
      {tem && (
        <span className="size-full overflow-hidden rounded-md bg-white p-0.5 ring-1 ring-linha">
          <img src={logo.url} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)}
            title={`Logo: ${logo.fonte === 'camara' ? 'Câmara dos Deputados' : `Wikimedia Commons${logo.licenca ? ` (${logo.licenca})` : ''}`}`}
            className="block size-full object-contain" />
        </span>
      )}
    </span>
  )
}
