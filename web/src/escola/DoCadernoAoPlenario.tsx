// Do caderno ao plenário: a mesma eleição contada pelos seus objetos, cada um com 100 unidades na cor
// do grau de escolaridade (a escala da bandeira). Quem votou assina o caderno de votação, quem se
// candidatou imprime o santinho e quem se elegeu senta no plenário.
// Escolher um grau acende as suas unidades nos três objetos e diz os três números.
import type { ReactNode } from 'react'
import { pct } from '../lib/formato'
import { alfa, cem, cor, porCento, unidades, useLargura } from './escolaridade'
import { Caderno, Plenario, Santinhos } from './objetos'

export interface Grupo {
  titulo: string
  /** total do grupo, já escrito ("34,7 mi de pessoas") */
  total: string
  /** contagem por grau, 8 posições */
  valores: number[]
}

const GRAUS = [8, 7, 6, 5, 4, 3, 2, 1]

function Objeto({ grupo, destaque, rotulo, children }: {
  grupo: Grupo
  destaque: number
  rotulo: string
  children: (largura: number) => ReactNode
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const n = cem(grupo.valores)[destaque - 1]
  return (
    <figure className="flex h-full min-w-0 flex-col">
      <figcaption>
        <span className="t-h3 block">{grupo.titulo}</span>
        <span className="tabular block text-[0.82rem] text-tinta-3">{grupo.total}</span>
      </figcaption>
      <div ref={ref} className="mt-3 flex flex-1 items-end" role="img" aria-label={`${grupo.titulo}: de cada 100, ${n} com ${rotulo.toLowerCase()}`}>
        {largura > 0 && children(largura)}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="t-numero tabular text-[2.4rem]">{n}</span>
        <span className="text-[0.86rem] text-tinta-2">de 100 com {rotulo.toLowerCase()}</span>
      </p>
    </figure>
  )
}

export function DoCadernoAoPlenario({ grupos, rotulos, chance, destaque, aoDestacar, chave }: {
  grupos: [Grupo, Grupo, Grupo]
  rotulos: string[]
  /** eleitos ÷ candidatos de cada grau, em % */
  chance: (number | null)[]
  destaque: number
  aoDestacar: (nivel: number) => void
  /** muda quando o recorte muda: as cadeiras se sentam de novo */
  chave: string
}) {
  const [votou, candidatos, eleitos] = grupos
  const u = grupos.map((g) => unidades(cem(g.valores)))
  const partes = grupos.map((g) => porCento(g.valores))
  const r = rotulos[destaque - 1]
  return (
    <div>
      <div role="radiogroup" aria-label="Grau de escolaridade em destaque" className="-mx-4 mb-5 flex snap-x gap-x-1 gap-y-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {GRAUS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === destaque}
            onClick={() => aoDestacar(n)}
            className={`inline-flex h-8 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[0.8rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao ${n === destaque ? 'border-tinta bg-folha font-bold text-tinta' : 'border-transparent text-tinta-2 hover:text-tinta'}`}
          >
            <span className="size-3 shrink-0 rounded-[3px] border border-tinta/20" style={{ background: cor(n) }} aria-hidden />
            {rotulos[n - 1]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.45fr)] lg:gap-x-12">
        <Objeto grupo={votou} destaque={destaque} rotulo={r}>
          {(l) => <Caderno graus={u[0]} destaque={destaque} largura={Math.min(l, 290)} aoDestacar={aoDestacar} />}
        </Objeto>
        <Objeto grupo={candidatos} destaque={destaque} rotulo={r}>
          {(l) => <Santinhos graus={u[1]} destaque={destaque} largura={Math.min(l, 176)} aoDestacar={aoDestacar} />}
        </Objeto>
        <Objeto grupo={eleitos} destaque={destaque} rotulo={r}>
          {(l) => (
            <Plenario
              key={chave}
              sentar
              largura={Math.min(l, 420)}
              cores={u[2].map(cor)}
              opacidades={u[2].map((g) => alfa(g, destaque))}
              ativas={u[2].map((g) => g === destaque)}
              aoPassar={(i) => aoDestacar(u[2][i])}
            />
          )}
        </Objeto>
      </div>

      <p aria-live="polite" className="mt-6 max-w-[78ch] text-[0.98rem] leading-relaxed text-tinta-2">
        <b className="text-tinta">{r}:</b> {pct(partes[0][destaque - 1])} de quem votou, {pct(partes[1][destaque - 1])} dos candidatos e{' '}
        {pct(partes[2][destaque - 1])} dos eleitos.
        {chance[destaque - 1] != null && (
          <> De cada 100 candidatos com esse grau, <b className="tabular text-tinta">{Math.round(chance[destaque - 1]!)}</b> se elegeram.</>
        )}
      </p>
    </div>
  )
}
