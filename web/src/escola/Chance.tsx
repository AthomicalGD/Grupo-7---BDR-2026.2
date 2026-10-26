// Quantos % dos candidatos se elegem: uma barra por grau de escolaridade, do superior completo
// (em cima, com o capelo do menu no nome) ao analfabeto, no verde de quem venceu. O tracejado é a média do
// cargo: o que passa dele tem mais chance que o candidato comum. Graus com menos de 30 candidatos
// viram nota (1 em 2 não é 50%).
import { GraduationCap } from '@phosphor-icons/react'
import { useInView } from 'motion/react'
import { useRef } from 'react'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, pct, plural } from '../lib/formato'
import { SUPERIOR } from './escolaridade'

const MINIMO = 30

export function Chance({ candidatos, eleitos, rotulos, destaque, aoDestacar }: {
  candidatos: number[]
  eleitos: number[]
  rotulos: string[]
  destaque: number
  aoDestacar: (nivel: number) => void
}) {
  const ref = useRef<HTMLOListElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.3 })
  const graus = [8, 7, 6, 5, 4, 3, 2, 1].filter((n) => candidatos[n - 1] >= MINIMO)
  const poucos = [8, 7, 6, 5, 4, 3, 2, 1].filter((n) => candidatos[n - 1] > 0 && candidatos[n - 1] < MINIMO)
  const total = candidatos.reduce((s, c) => s + c, 0)
  const media = total ? (100 * eleitos.reduce((s, e) => s + e, 0)) / total : 0
  const taxa = (n: number) => (100 * eleitos[n - 1]) / candidatos[n - 1]
  // a escala vai até um pouco acima da maior barra, para as diferenças aparecerem
  const teto = Math.max(10, Math.ceil((Math.max(media, ...graus.map(taxa)) * 1.12) / 5) * 5)
  const x = (v: number) => `${(100 * v) / teto}%`

  return (
    <div>
      <ol ref={ref} className="grid gap-y-1">
        {graus.map((n, i) => {
          const k = Math.round(taxa(n))
          const ativo = n === destaque
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => aoDestacar(n)}
                aria-label={`${rotulos[n - 1]}: ${k}% dos candidatos se elegeram (${inteiro(eleitos[n - 1])} de ${inteiro(candidatos[n - 1])})`}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-papel-2/60 focus-visible:outline-2 focus-visible:outline-acao sm:grid-cols-[12rem_minmax(0,1fr)_6.5rem] ${ativo ? 'bg-papel-2/70' : ''}`}
              >
                <span className="min-w-0 max-sm:col-span-2">
                  <span className={`flex items-center gap-1.5 text-[0.92rem] leading-tight ${ativo ? 'font-bold text-tinta' : 'text-tinta-2'}`}>
                    {rotulos[n - 1]}
                    {n === SUPERIOR && <GraduationCap size={15} weight="fill" className="shrink-0 text-tinta" aria-hidden />}
                  </span>
                  <span className="tabular block text-[0.78rem] text-tinta-3">{plural(candidatos[n - 1], 'candidato', 'candidatos')}</span>
                </span>
                <span className="relative block h-7 max-sm:mt-1">
                  <span className="absolute inset-0 rounded-md bg-papel-2" />
                  <span
                    className={`absolute inset-y-0 left-0 rounded-md bg-eleito transition-[width] duration-500 ${visto ? 'cresce-x' : 'scale-x-0'}`}
                    style={{ width: x(taxa(n)), animationDelay: `${i * 90}ms`, transformOrigin: 'left center' }}
                  />
                  {/* a média do cargo atravessa todas as linhas */}
                  <span className="absolute -inset-y-1.5 w-0 border-l-[1.5px] border-dashed border-tinta" style={{ left: x(media) }} />
                </span>
                <span className="flex items-baseline gap-1 justify-self-end">
                  <span className={`t-numero tabular text-[1.6rem] ${ativo ? 'text-tinta' : 'text-tinta-2'}`}>{k}%</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-linha pt-3 text-[0.82rem] text-tinta-3">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-[3px] bg-eleito" aria-hidden />
          % dos candidatos do grau que se elegeram
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={10} height={14} aria-hidden><line x1={5} x2={5} y1={0} y2={14} stroke="var(--color-tinta)" strokeWidth={1.5} strokeDasharray="4 3" /></svg>
          média do cargo, {Math.round(media)}%
        </span>
      </p>
      {poucos.length > 0 && (
        <p className="mt-1.5 text-[0.82rem] text-tinta-3">
          Com menos de {MINIMO} candidatos, fora da conta:{' '}
          {poucos.map((n) => `${rotulos[n - 1].toLowerCase()} (${plural(candidatos[n - 1], 'candidato', 'candidatos')}, ${eleitos[n - 1] ? plural(eleitos[n - 1], 'eleito', 'eleitos') : 'nenhum eleito'})`).join('; ')}.
        </p>
      )}
      <TabelaAlternavel sql="p4Chance"
        titulo="Candidatos e eleitos por grau de escolaridade"
        colunas={['Escolaridade', 'Candidatos', 'Eleitos', 'Se elegeram']}
        linhas={() =>
          [8, 7, 6, 5, 4, 3, 2, 1]
            .filter((n) => candidatos[n - 1] > 0)
            .map((n) => [rotulos[n - 1], inteiro(candidatos[n - 1]), inteiro(eleitos[n - 1]), pct((100 * eleitos[n - 1]) / candidatos[n - 1])])
        }
      />
    </div>
  )
}
