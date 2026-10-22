// Foto de registro do candidato (TSE). Sem foto (antes de 2004, ou falha ao carregar),
// mostra as iniciais sobre a cor de tinta: nunca um avatar genérico.
import { useState } from 'react'

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

export function Retrato({ foto, nome, tamanho = 56, className = '' }: { foto?: string | null; nome: string; tamanho?: number; className?: string }) {
  const [falhou, setFalhou] = useState(false)
  const estilo = { width: tamanho, height: tamanho * 1.25 }
  if (!foto || falhou) {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-[10px] bg-papel-2 font-bold text-tinta-2 ${className}`}
        style={{ ...estilo, fontSize: tamanho * 0.34, fontStretch: '90%' }}
        aria-hidden
      >
        {iniciais(nome)}
      </span>
    )
  }
  return (
    <img
      src={foto}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFalhou(true)}
      className={`shrink-0 rounded-[10px] bg-papel-2 object-cover object-top ${className}`}
      style={estilo}
    />
  )
}
