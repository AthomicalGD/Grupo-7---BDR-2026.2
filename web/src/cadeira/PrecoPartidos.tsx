// Preço por partido: gasto de todos os candidatos do partido ÷ cadeiras que ele conquistou.
// A cor é a posição do partido na escala de viés da P7; quem gastou sem eleger fica numa lista à parte.
import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'
import type { Cadeira } from '../api'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, plural, reaisCurto } from '../lib/formato'
import { corVies, tintaSobre } from '../lib/vies'

export const PrecoPartidos = memo(function PrecoPartidos({ partidos, fator }: { partidos: Cadeira['partidos']; fator: number }) {
  const reduz = useReducedMotion()
  const com = partidos.filter((p) => p.cadeiras > 0).map((p) => ({ ...p, preco: (p.gasto * fator) / p.cadeiras })).sort((a, b) => b.preco - a.preco)
  const sem = partidos.filter((p) => p.cadeiras === 0 && p.gasto > 0).sort((a, b) => b.gasto - a.gasto)
  const max = Math.max(...com.map((p) => p.preco), 1)

  return (
    <div>
      <ol className="grid gap-1.5">
        {com.map((p, i) => (
          <li key={p.sigla} className="grid grid-cols-[6.4rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[8.2rem_minmax(0,1fr)_9.5rem]">
            <span className="truncate text-[0.88rem] font-bold" title={p.sigla}>{p.sigla}</span>
            <div className="relative h-7">
              {/* a barra cresce em scaleX; o valor fica fora dela para não ser esticado junto */}
              <motion.div
                className="absolute inset-y-0 left-0 origin-left rounded-[6px]"
                style={{ width: `${Math.max(1.5, (100 * p.preco) / max)}%`, background: corVies(p.vies ?? 0) }}
                // transform em texto (não scaleX): o Motion anima pela GPU (WAAPI) em vez de a cada quadro em JS
                initial={reduz ? false : { transform: 'scaleX(0)' }}
                whileInView={{ transform: 'scaleX(1)' }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.6, delay: Math.min(i, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
              />
              <span
                className="tabular absolute top-1/2 -translate-y-1/2 text-[0.8rem] font-bold whitespace-nowrap"
                style={p.preco / max > 0.3
                  ? { left: 8, color: tintaSobre(p.vies ?? 0) }
                  : { left: `calc(${Math.max(1.5, (100 * p.preco) / max)}% + 6px)` }}
              >
                {reaisCurto(p.preco)}
              </span>
            </div>
            <span className="hidden text-[0.78rem] text-tinta-3 sm:block">
              {plural(p.cadeiras, 'cadeira', 'cadeiras')} · {reaisCurto(p.gasto * fator)}
            </span>
          </li>
        ))}
      </ol>
      {sem.length > 0 && (
        <p className="mt-6 max-w-[80ch] text-[0.88rem] leading-relaxed text-tinta-2">
          <b className="text-tinta">Gastaram e não elegeram ninguém:</b>{' '}
          {sem.slice(0, 12).map((p, i) => (
            <span key={p.sigla}>
              <span className="whitespace-nowrap">{p.sigla} <span className="tabular">{reaisCurto(p.gasto * fator)}</span></span>
              {i < Math.min(12, sem.length) - 1 ? ', ' : ''}
            </span>
          ))}
          {sem.length > 12 && ` e mais ${sem.length - 12}`}.
        </p>
      )}
      <TabelaAlternavel
        titulo="Gasto, cadeiras e preço por cadeira de cada partido"
        colunas={['Partido', 'Candidatos', 'Cadeiras', 'Gasto total', 'Preço por cadeira']}
        linhas={() => partidos.map((p) => [p.sigla, inteiro(p.candidatos), inteiro(p.cadeiras), reaisCurto(p.gasto * fator), p.cadeiras ? reaisCurto((p.gasto * fator) / p.cadeiras) : 'sem cadeira'])}
      />
    </div>
  )
})
