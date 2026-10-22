// A subtela "Quem são": ao escolher um cargo, os eleitos de uma eleição em três colunas, pelo que fizeram
// na seguinte (voltaram, tentaram e perderam, não tentaram). Seis por coluna e "Mostrar mais"; cada nome
// leva à carreira. Os mais votados vêm primeiro (há votos de 2018 em diante). O campo de busca filtra as três
// colunas pelo nome civil ou de urna, sem acento.
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { consultas, type GrupoReeleicao, type Reeleicao } from '../api'
import { Escolha } from '../componentes/Escolha'
import { Retrato } from '../componentes/Retrato'
import { cargoPlural, inteiro, nomeProprio } from '../lib/formato'
import { corVies } from '../lib/vies'
import { COR, TODOS } from './conta'

type Cargo = Reeleicao['cargos'][number]
const POR_VEZ = 6

const GRUPOS: { chave: GrupoReeleicao; rotulo: string; fundo: string; borda: string }[] = [
  { chave: 'voltaram', rotulo: 'Voltaram', fundo: COR.voltou, borda: COR.voltou },
  { chave: 'perderam', rotulo: 'Tentaram e perderam', fundo: COR.perdeu, borda: '#a39a8a' },
  { chave: 'nao', rotulo: 'Não tentaram', fundo: COR.nao, borda: '#aeb6bf' },
]

function Coluna({ uf, cargo, eleitosEm, grupo, marcada, busca }: { uf: string; cargo: Cargo; eleitosEm: number; grupo: (typeof GRUPOS)[number]; marcada: boolean; busca: string }) {
  const [limite, setLimite] = useState(POR_VEZ)
  const q = useQuery({ ...consultas.pessoasReeleicao(uf, cargo.cod, eleitosEm, grupo.chave, limite, busca), placeholderData: keepPreviousData })
  const d = q.data
  return (
    <section aria-label={grupo.rotulo} className={`min-w-0 rounded-2xl transition-[background-color,box-shadow] duration-300 ${marcada ? 'bg-papel/70 shadow-[0_0_0_8px_rgb(242_244_245/.7)]' : ''}`}>
      <h4 className="flex items-center gap-2 border-b border-linha pb-2">
        <span aria-hidden className="h-[18px] w-[14px] shrink-0 rounded-[2px] border" style={{ background: grupo.fundo, borderColor: grupo.borda }} />
        <span className="t-rotulo text-tinta">{grupo.rotulo}</span>
        <span className="ml-auto t-numero text-[1.35rem] tabular text-tinta">{d ? inteiro(d.contagem[grupo.chave]) : ''}</span>
      </h4>
      {q.isPending ? (
        <ul aria-busy className="mt-2 space-y-2">
          {Array.from({ length: 3 }, (_, i) => <li key={i} className="h-[58px] rounded-xl bg-papel-2/70" />)}
        </ul>
      ) : q.error ? (
        <p className="mt-3 text-[0.85rem] text-tinta-2">Não foi possível listar ({q.error.message}).</p>
      ) : !d?.total ? (
        <p className="mt-3 text-[0.85rem] text-tinta-3">{busca ? `Ninguém com “${busca}” aqui.` : 'Ninguém nesta eleição.'}</p>
      ) : (
        <>
          <ul className={`mt-1 transition-opacity ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
            {d.pessoas.map((p) => (
              <li key={p.id}>
                <Link
                  to="/politico/$id"
                  params={{ id: String(p.id) }}
                  className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-papel focus-visible:outline-[3px] focus-visible:outline-acao"
                >
                  <Retrato foto={p.foto} nome={p.nome} tamanho={38} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-tinta group-hover:underline">{nomeProprio(p.nome_urna ?? p.nome)}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[0.78rem] text-tinta-3">
                      {p.partido && (
                        <>
                          <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: corVies(p.vies) }} />
                          <span className="shrink-0 font-semibold text-tinta-2">{p.partido}</span>
                        </>
                      )}
                      <span className="truncate">
                        {[p.municipio && nomeProprio(p.municipio), uf === TODOS && p.uf, p.votos != null && `${inteiro(p.votos)} votos`].filter(Boolean).join(', ')}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {d.total > d.pessoas.length && (
            <button
              type="button"
              onClick={() => setLimite((l) => Math.min(l + POR_VEZ, 60))}
              disabled={limite >= 60}
              className="botao-contorno mt-2 h-9 px-4 text-[0.82rem] disabled:opacity-40"
            >
              {limite >= 60 ? `Mostrando 60 de ${inteiro(d.total)}` : `Mostrar mais (${inteiro(d.total - d.pessoas.length)} restantes)`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export function QuemSao({ uf, ufNome, cargo, eleitosEm, destaque, aoEscolherCiclo, aberta, aoFechar }: {
  uf: string
  ufNome: string
  cargo: Cargo
  /** a eleição de origem; sem ela (ou fora do cargo), a mais recente */
  eleitosEm: number | null
  /** a coluna que a pessoa tocou no caminho */
  destaque: GrupoReeleicao | null
  aoEscolherCiclo: (eleitosEm: number) => void
  aberta: boolean
  aoFechar: () => void
}) {
  // as colunas só consultam a API depois da primeira abertura, e ficam montadas para a subtela fechar inteira
  const [jaAbriu, setJaAbriu] = useState(aberta)
  if (aberta && !jaAbriu) setJaAbriu(true)
  const ciclo = cargo.ciclos.find((c) => c.eleitos_em === eleitosEm) ?? cargo.ciclos.at(-1)!
  // a busca espera a pessoa parar de digitar (250ms) antes de consultar a API
  const [texto, setTexto] = useState('')
  const [busca, setBusca] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim().length >= 2 ? texto.trim() : ''), 250)
    return () => clearTimeout(t)
  }, [texto])
  return (
    <div id="quem-sao" className="subtela scroll-mt-24" data-aberta={aberta} inert={!aberta}>
      <div>
        <div className="mt-6 rounded-[20px] border border-linha bg-folha p-4 shadow-[var(--shadow-cartao)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="t-h2">Quem são os {cargoPlural(cargo.nome)} {ufNome}</h3>
              <p className="mt-1 text-[0.9rem] text-tinta-2">
                Eleitos em {ciclo.eleitos_em}, e o que fizeram na eleição de {ciclo.disputa}.
              </p>
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar a lista"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-linha bg-folha text-tinta-2 transition hover:border-tinta hover:text-tinta active:translate-y-px"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <label className="relative block w-full max-w-[22rem]">
              <span className="sr-only">Procurar pelo nome</span>
              <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-3" aria-hidden />
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Procurar pelo nome"
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-full border-[1.5px] border-linha-2 bg-folha pl-11 pr-4 text-[0.95rem] outline-none transition-colors hover:border-tinta-3 focus:border-acao focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-acao"
              />
            </label>
            <div role="radiogroup" aria-label="Eleitos em" className="flex flex-wrap gap-2">
              {cargo.ciclos.map((c) => (
                <Escolha key={c.eleitos_em} ativo={c.eleitos_em === ciclo.eleitos_em} aoClicar={() => aoEscolherCiclo(c.eleitos_em)} rotulo={`Eleitos em ${c.eleitos_em}`}>
                  {c.eleitos_em}
                </Escolha>
              ))}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
            {jaAbriu && GRUPOS.map((g) => (
              <Coluna key={`${uf}-${cargo.cod}-${ciclo.eleitos_em}-${g.chave}-${busca}`} uf={uf} cargo={cargo} eleitosEm={ciclo.eleitos_em} grupo={g} marcada={g.chave === destaque} busca={busca} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
