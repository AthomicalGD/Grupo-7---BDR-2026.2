// Faixa com as sete fitas da marca, sob o cabeçalho; a do cabeçalho ondula enquanto a API responde.
// O período da onda é 240 px; o desenho anda exatamente um período e recomeça sem emenda.
import { useIsFetching } from '@tanstack/react-query'

const FITAS = ['#5E881B', '#A2BD31', '#5D6B94', '#468BAF', '#76ACD0', '#F19929', '#FBC700']
const PERIODO = 240
const LARGURA = 2400 + PERIODO

function onda(i: number, altura: number) {
  const pontos: string[] = []
  for (let x = 0; x <= LARGURA; x += 8) {
    const y = ((i + 0.5) * altura) / 7 + Math.sin((x / PERIODO) * 2 * Math.PI + i * 0.55) * (altura / 9)
    pontos.push(`${x},${y.toFixed(2)}`)
  }
  return 'M' + pontos.join('L')
}

/** `viva`: a onda anda enquanto a API responde e para quando termina; parada não custa nada ao navegador. */
export function Fita({ altura = 9, viva = false }: { altura?: number; viva?: boolean }) {
  const carregando = useIsFetching() > 0
  return (
    <div className="relative w-full overflow-hidden" style={{ height: altura }} aria-hidden>
      <svg
        width={LARGURA}
        height={altura}
        className="absolute left-0 top-0"
        style={{ animation: 'onda 3.2s linear infinite', animationPlayState: viva && carregando ? 'running' : 'paused' }}
      >
        {FITAS.map((cor, i) => (
          <path key={cor} d={onda(i, altura)} stroke={cor} strokeWidth={altura / 7 + 0.6} fill="none" />
        ))}
      </svg>
    </div>
  )
}
