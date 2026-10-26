// A bandeira de um estado (miniaturas do Wikimedia Commons, domínio público, servidas pelo próprio site em
// /bandeiras/<UF>.png). As 27 são pequenas: carregam todas de uma vez, e passar o mouse não espera rede.
import { useEffect } from 'react'

export function Bandeira({ sigla, nome, largura = 96, className = '' }: { sigla: string; nome?: string; largura?: number; className?: string }) {
  return (
    <img
      src={`/bandeiras/${sigla}.png`}
      alt={nome ? `Bandeira ${nome.startsWith('Distrito') ? 'do' : 'de'} ${nome}` : `Bandeira de ${sigla}`}
      width={largura}
      height={Math.round(largura * 0.7)}
      className={`block rounded-[6px] border-2 border-tinta bg-papel-2 object-cover ${className}`}
      style={{ width: largura, height: Math.round(largura * 0.7) }}
    />
  )
}

/** Baixa as 27 bandeiras uma vez, quando o seletor aparece: o primeiro passar de mouse já as acha prontas. */
export function useBandeiras(siglas: string[]) {
  useEffect(() => {
    siglas.forEach((s) => (new Image().src = `/bandeiras/${s}.png`))
  }, [siglas])
}
