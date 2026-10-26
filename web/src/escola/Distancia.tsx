// A distância do eleitor ao eleito: os municípios em cinco grupos do mesmo tamanho pela % de quem votou
// com superior completo, e em cada grupo dois pontos na mesma régua de 0 a 100: quem votou (aro) e quem
// se elegeu (2024) ou em quem se votou para deputado (2022), cheio no azul do superior completo. A haste
// entre eles é a distância. Responde a (B) de relance: se os lugares elegessem gente parecida, os pontos
// se encostariam; quando aparecem, o ponto cheio sai do aro e corre até o seu lugar.
import { useInView } from 'motion/react'
import { useRef } from 'react'
import type { Escola } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { decimal, pct } from '../lib/formato'
import { cor, SUPERIOR } from './escolaridade'

const NOMES = ['Menos escolarizados', '2º quinto', '3º quinto', '4º quinto', 'Mais escolarizados']
const AZUL = cor(SUPERIOR)
const x = (v: number | null) => `${Math.max(0, Math.min(100, v ?? 0))}%`

export function Distancia({ dados, quintilDoLugar }: { dados: Escola; quintilDoLugar?: number | null }) {
  const ref = useRef<HTMLOListElement>(null)
  const visto = useInView(ref, { once: true, amount: 0.3 })
  const municipal = dados.medida === 'eleitos'
  const quem = municipal ? 'eleitos' : 'votos para deputado'
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.82rem] text-tinta-2">
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-full border-2 border-tinta-2 bg-folha" aria-hidden />
          quem votou
        </span>
        {municipal && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-tinta-3" aria-hidden />
            candidatos
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded-full border-2 border-folha shadow-[0_0_0_1px_rgb(24_32_43/.2)]" style={{ background: AZUL }} aria-hidden />
          {municipal ? 'eleitos' : 'votos para deputado'}
        </span>
        <span className="text-tinta-3">% com superior completo</span>
      </p>

      <ol ref={ref} className="mt-4 grid gap-y-1.5">
        {dados.quintis.map((q, i) => {
          const alvo = municipal ? q.eleitos : q.votados
          const marcado = quintilDoLugar === i + 1
          const [a, b] = [Math.min(q.votantes ?? 0, alvo ?? 0), Math.max(q.votantes ?? 0, alvo ?? 0)]
          return (
            <li
              key={i}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-lg px-2 py-2 sm:grid-cols-[12rem_minmax(0,1fr)_7.5rem] ${marcado ? 'bg-papel-2/70 outline-2 outline-marcador' : ''}`}
            >
              <p className="min-w-0 max-sm:col-span-2">
                <span className="block text-[0.92rem] font-semibold leading-tight text-tinta">{NOMES[i]}</span>
                <span className="tabular block text-[0.78rem] text-tinta-3">
                  {decimal(q.de)} a {decimal(q.ate)}% votou com superior{marcado ? ' · o grupo do boletim' : ''}
                </span>
              </p>
              <div
                role="img"
                aria-label={`${NOMES[i]}: ${Math.round(alvo ?? 0)}% dos ${quem} com superior completo; quem votou, ${Math.round(q.votantes ?? 0)}%`}
                className="relative h-8 max-sm:mt-1"
              >
                {/* a régua de 0 a 100, com as marcas de 25 em 25 */}
                <span className="absolute inset-x-0 top-1/2 h-px bg-linha-2" />
                {[0, 25, 50, 75, 100].map((t) => (
                  <span key={t} className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-linha-2" style={{ left: `${t}%` }} />
                ))}
                {/* a distância */}
                <span
                  className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${visto ? 'cresce-x' : 'scale-x-0'}`}
                  style={{ left: x(a), width: `calc(${x(b)} - ${x(a)})`, background: AZUL, opacity: 0.22, animationDelay: `${i * 120 + 150}ms`, animationDuration: '900ms' }}
                />
                {municipal && q.candidatos != null && (
                  <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tinta-3" style={{ left: x(q.candidatos) }} />
                )}
                <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tinta-2 bg-folha" style={{ left: x(q.votantes) }} />
                <span
                  className="absolute top-1/2 size-[1.15rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-folha shadow-[0_0_0_1px_rgb(24_32_43/.25)] transition-[left] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
                  style={{ left: visto ? x(alvo) : x(q.votantes), background: AZUL, transitionDelay: `${i * 120 + 150}ms` }}
                />
              </div>
              <p className="justify-self-end text-right leading-tight">
                <span className="flex items-baseline justify-end gap-1">
                  <span className="t-numero tabular text-[1.6rem]">{Math.round(alvo ?? 0)}%</span>
                </span>
                <span className="tabular block text-[0.78rem] text-tinta-3">quem votou: {Math.round(q.votantes ?? 0)}%</span>
              </p>
            </li>
          )
        })}
      </ol>
      <div className="tabular relative mt-1 hidden h-4 text-[0.78rem] text-tinta-3 sm:ml-[13.5rem] sm:mr-[9rem] sm:block">
        {[0, 25, 50, 75, 100].map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t}%` }}>{t}</span>
        ))}
      </div>

      <TabelaAlternavel sql="p4Lugar"
        titulo="% com superior completo, por quinto de municípios"
        colunas={municipal ? ['Grupo', 'Municípios', 'Quem votou', 'Candidatos', 'Eleitos'] : ['Grupo', 'Municípios', 'Quem votou', 'Votos para deputado']}
        linhas={() =>
          dados.quintis.map((q, i) => [
            `${NOMES[i]} (${decimal(q.de)} a ${decimal(q.ate)}%)`,
            String(q.municipios),
            pct(q.votantes),
            ...(municipal ? [pct(q.candidatos), pct(q.eleitos)] : [pct(q.votados)]),
          ])
        }
      />
    </div>
  )
}
