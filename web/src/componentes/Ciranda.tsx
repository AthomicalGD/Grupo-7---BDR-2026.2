// Loading "Ciranda": as sete fitas da marca giram em volta do símbolo em velocidades
// diferentes, então se trançam e se separam. Com movimento reduzido, ficam paradas.
import simbolo from '../assets/marca/simbolo.svg'

const FITAS = ['#5E881B', '#A2BD31', '#5D6B94', '#468BAF', '#76ACD0', '#F19929', '#FBC700']
const DURACAO = [3.4, 2.7, 3.9, 3.1, 2.4, 3.6, 2.9] // segundos por volta

/** Fita ondulada ao longo de um arco, com as pontas afinando. */
function fita(raio: number, largura: number, amplitude: number, ondas: number, fase: number, inicio: number, arco: number) {
  const fora: string[] = [], dentro: string[] = []
  const n = 72
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const ang = ((inicio + arco * t) * Math.PI) / 180
    const afina = Math.sin(Math.PI * t) ** 0.6
    const onda = amplitude * Math.sin(ondas * ang + fase)
    const ro = raio + onda + (largura / 2) * afina, ri = raio + onda - (largura / 2) * afina
    fora.push(`${(80 + ro * Math.cos(ang)).toFixed(1)},${(80 + ro * Math.sin(ang)).toFixed(1)}`)
    dentro.push(`${(80 + ri * Math.cos(ang)).toFixed(1)},${(80 + ri * Math.sin(ang)).toFixed(1)}`)
  }
  return `M${fora.join('L')}L${dentro.reverse().join('L')}Z`
}

const CAMINHOS = FITAS.map((_, i) => fita(58 - (i % 3) * 3, 8, 4, 6, i * 0.9, i * (360 / 7) - 20, 112))

export function Ciranda({ rotulo = 'Carregando', tamanho = 128 }: { rotulo?: string; tamanho?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-tinta-2">
      <div className="relative" style={{ width: tamanho, height: tamanho }}>
        <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {CAMINHOS.map((d, i) => (
            <g
              key={i}
              style={{
                transformOrigin: '80px 80px',
                animation: `girar ${DURACAO[i]}s linear infinite`,
                animationDelay: `-${i * 0.37}s`,
              }}
            >
              <path d={d} fill={FITAS[i]} opacity={0.94} />
            </g>
          ))}
        </svg>
        <img
          src={simbolo}
          alt=""
          className="absolute"
          style={{ width: '38%', left: '31%', top: '33%', animation: 'respirar 2.4s ease-in-out infinite' }}
        />
      </div>
      <p className="t-rotulo tabular">{rotulo}</p>
    </div>
  )
}

/** Ciranda centralizada ocupando a área de uma tela ou painel. */
export function CirandaTela({ rotulo }: { rotulo?: string }) {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <Ciranda rotulo={rotulo} />
    </div>
  )
}
