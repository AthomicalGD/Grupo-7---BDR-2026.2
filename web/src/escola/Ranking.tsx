// O ranking dos municípios, impresso como as linhas do boletim: as câmaras (2024) ou os votos para
// deputado (2022) com mais e com menos diploma, e onde é maior a distância entre quem votou e quem foi
// eleito. Só municípios com ao menos 5 eleitos entram (uma câmara de 1 eleito não é 100%). Cada linha
// abre o boletim do município.
import type { MunicipioEscola } from '../api'
import { useMemo } from 'react'

const TOPO = 5

function Lista({ titulo, nota, linhas, valor, aoEscolher, selecionado }: {
  titulo: string
  /** quando o extremo empata em mais municípios do que a lista mostra */
  nota?: string
  linhas: MunicipioEscola[]
  valor: (m: MunicipioEscola) => string
  aoEscolher: (ibge: number) => void
  selecionado: number
}) {
  return (
    <section className="min-w-0">
      <h4 className="t-mono border-b-[1.5px] border-dashed border-linha-2 pb-2 text-[0.7rem] uppercase tracking-[0.12em] text-tinta-2">{titulo}</h4>
      {nota && <p className="t-mono mt-2 text-[0.7rem] uppercase tracking-[0.04em] text-tinta">{nota}</p>}
      <ol className="mt-1">
        {linhas.map((m, i) => (
          <li key={m.ibge}>
            <button
              type="button"
              onClick={() => aoEscolher(m.ibge)}
              aria-label={`${m.nome} (${m.uf}): ${valor(m)}. Abrir o boletim`}
              className={`grid w-full grid-cols-[1.2rem_minmax(0,1fr)_auto] items-baseline gap-2 rounded px-1 py-1.5 text-left hover:bg-folha focus-visible:outline-2 focus-visible:outline-acao ${m.ibge === selecionado ? 'bg-folha font-bold' : ''}`}
            >
              <span className="t-mono tabular text-[0.72rem] text-tinta-3">{i + 1}</span>
              <span className="flex min-w-0 items-baseline gap-1.5 text-[0.86rem] text-tinta">
                <span className="truncate">{m.nome}</span>
                <span className="t-mono shrink-0 text-[0.7rem] text-tinta-3">{m.uf}</span>
                <span className="mx-1 hidden min-w-4 flex-1 border-b border-dotted border-linha-2 sm:block" aria-hidden />
              </span>
              <span className="t-mono tabular text-[0.82rem] text-tinta">{valor(m)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function Ranking({ municipios, medida, aoEscolher, selecionado }: {
  municipios: MunicipioEscola[]
  medida: 'eleitos' | 'votados'
  aoEscolher: (ibge: number) => void
  selecionado: number
}) {
  const validos = useMemo(
    () => municipios.filter((m) => m[medida] != null && (medida === 'votados' || (m.eleitos_n ?? 0) >= 5)),
    [municipios, medida],
  )
  const por = (f: (m: MunicipioEscola) => number) => [...validos].sort((a, b) => f(b) - f(a) || b.comparecimento - a.comparecimento)
  const mais = por((m) => m[medida]!).slice(0, TOPO)
  const menos = por((m) => -m[medida]!).slice(0, TOPO)
  const distancia = por((m) => m[medida]! - m.votantes).slice(0, TOPO)
  const sem = validos.filter((m) => m[medida] === 0).length
  const empateMenos = menos.length ? validos.filter((m) => m[medida] === menos[0][medida]).length : 0
  const todos = validos.filter((m) => m[medida] === 100).length
  const alvo = medida === 'eleitos' ? 'na câmara' : 'no voto para deputado'
  const fmt = (v: number) => `${Math.round(v)}%`

  return (
    <div>
      <p className="max-w-[70ch] text-[1rem] leading-relaxed text-tinta-2">
        {medida === 'eleitos' ? (
          <>
            Em <b className="tabular text-tinta">{sem}</b> municípios a câmara eleita não tem ninguém com superior completo;{' '}
            {todos ? <>em <b className="tabular text-tinta">{todos}</b>, todos os eleitos têm.</> : 'em nenhum todos os eleitos têm.'}
          </>
        ) : (
          <>Os extremos do voto para deputado, município a município.</>
        )}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-3">
        <Lista titulo={`Mais diploma ${alvo}`} linhas={mais} valor={(m) => fmt(m[medida]!)} aoEscolher={aoEscolher} selecionado={selecionado} />
        <Lista
          titulo={`Menos diploma ${alvo}`}
          nota={empateMenos > TOPO ? `${empateMenos} empatam em ${Math.round(menos[0][medida]!)}%; os maiores:` : undefined}
          linhas={menos}
          valor={(m) => fmt(m[medida]!)} aoEscolher={aoEscolher} selecionado={selecionado} />
        <Lista
          titulo="Maior distância do eleitor"
          linhas={distancia}
          valor={(m) => `+${Math.round(m[medida]! - m.votantes)} PONTOS`}
          aoEscolher={aoEscolher}
          selecionado={selecionado}
        />
      </div>
    </div>
  )
}
