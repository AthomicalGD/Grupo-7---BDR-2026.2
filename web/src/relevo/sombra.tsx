// Sombras que congelam quando a cena assenta (o BakeShadows do drei, mas que volta a calcular quando os
// dados mudam): enquanto as colunas crescem, o mapa de sombras é refeito a cada quadro; ao assentar,
// é calculado uma última vez e para. Girar a câmera não muda a sombra, então girar fica barato.
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'

/** Verdadeiro `ms` depois da última mudança de `chave` (o tempo de as colunas crescerem). */
export function useAssentado(chave: unknown, ms = 2500) {
  const [assentado, setAssentado] = useState(false)
  useEffect(() => {
    setAssentado(false)
    const t = setTimeout(() => setAssentado(true), ms)
    return () => clearTimeout(t)
  }, [chave, ms])
  return assentado
}

export function SombraAssentada({ chave, ms }: { chave: unknown; ms?: number }) {
  const gl = useThree((s) => s.gl)
  const invalidar = useThree((s) => s.invalidate)
  const assentado = useAssentado(chave, ms)
  useEffect(() => {
    gl.shadowMap.autoUpdate = !assentado
    if (assentado) gl.shadowMap.needsUpdate = true // a última, já com as colunas no lugar
    invalidar()
  }, [assentado, gl, invalidar])
  return null
}
