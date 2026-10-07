// Cédula de consulta: os filtros da busca de políticos como uma cédula de papel. Tudo se marca com
// um X na casa, como na cédula de anos do mapa; o estado leva a silhueta (como na P1) e a casa do
// partido tem a cor do seu viés (escala da P7), com os partidos da esquerda para a direita.
// Uma marca por linha; nada marcado vale tudo. A pessoa entra no resultado se tiver uma candidatura
// que bata com todas as marcas ao mesmo tempo.
import { ArrowCounterClockwise, CaretDown, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ANOS_ELEICAO, CARGOS_BUSCA, consultas, filtrando, type FiltrosBusca } from '../api'
import { silhueta } from '../atlas/geo'
import { corVies, gradienteVies, tintaSobre } from '../lib/vies'

const FITAS = ['#5E881B', '#A2BD31', '#5D6B94', '#468BAF', '#76ACD0', '#F19929', '#FBC700']
const PARTIDOS_NA_CEDULA = 18 // os mais frequentes; o resto fica em "outros"
const GERAIS = ANOS_ELEICAO.filter((a) => a % 4 === 2).reverse()
const MUNICIPAIS = ANOS_ELEICAO.filter((a) => a % 4 === 0).reverse()

/** A casa da cédula: quadrado que recebe um X ao ser marcado. `cor` pinta a casa (partido). */
function Casa({ marcada, entrada, aoClicar, cor, xCor = 'var(--color-tinta)', rotulo, children }: {
  marcada: boolean
  entrada: boolean // recebe o Tab do grupo (a marcada, ou a primeira)
  aoClicar: () => void
  cor?: string
  xCor?: string
  rotulo?: string
  children: ReactNode
}) {
  const reduz = useReducedMotion()
  const traco = { stroke: xCor, strokeWidth: 2.4, strokeLinecap: 'round' as const }
  return (
    <button
      type="button"
      data-casa
      aria-pressed={marcada}
      aria-label={rotulo}
      tabIndex={entrada ? 0 : -1}
      onClick={aoClicar}
      className="group inline-flex min-h-9 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[0.88rem] leading-tight transition-colors hover:bg-papel focus-visible:outline-[2.5px] focus-visible:outline-offset-1 focus-visible:outline-acao"
    >
      <span
        className="relative size-[19px] shrink-0 rounded-[4px] border-[1.5px] border-tinta transition-transform group-active:scale-90"
        style={{ background: cor ?? 'var(--color-folha)' }}
      >
        {marcada && (
          <svg viewBox="0 0 19 19" className="absolute -inset-[1.5px]" aria-hidden>
            <motion.path d="M5 5 L14 14" {...traco} initial={reduz ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.14, ease: 'easeOut' }} />
            <motion.path d="M14 5 L5 14" {...traco} initial={reduz ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.14, delay: 0.1, ease: 'easeOut' }} />
          </svg>
        )}
      </span>
      <span className={`inline-flex items-center gap-1.5 ${marcada ? 'font-bold text-tinta' : 'font-semibold text-tinta-2 group-hover:text-tinta'}`}>{children}</span>
    </button>
  )
}

/** Uma linha da cédula: rótulo à esquerda, casas à direita. Tab entra no grupo; as setas andam. */
function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const id = useId()
  const andar = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!passo) return
    const casas = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-casa]')]
    const i = casas.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    casas[(i + passo + casas.length) % casas.length].focus()
  }
  return (
    <div className="grid gap-x-4 gap-y-1.5 border-t border-dashed border-linha-2 px-4 py-3 sm:grid-cols-[6.2rem_minmax(0,1fr)] sm:px-5">
      <p id={id} className="t-rotulo pt-2 text-tinta-2">{rotulo}</p>
      <div role="group" aria-labelledby={id} onKeyDown={andar} className="min-w-0">
        {children}
      </div>
    </div>
  )
}

export function FiltroCandidatura({ filtros, aoMudar }: { filtros: FiltrosBusca; aoMudar: (f: FiltrosBusca) => void }) {
  const { data: ufs = [] } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const { data: partidos = [] } = useQuery(consultas.partidos())
  const ativo = filtrando(filtros)
  const [aberta, setAberta] = useState(() => ativo || window.matchMedia('(min-width: 1024px)').matches)
  const corpo = useId()

  const carregadas = useMemo(() => ufs.filter((u) => u.carregada), [ufs])
  const silhuetas = useMemo(() => new Map(malha ? carregadas.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 20)]) : []), [malha, carregadas])
  // na cédula, os partidos mais frequentes, da esquerda para a direita; os demais num seletor
  const naCedula = useMemo(() => {
    const top = [...partidos].sort((a, b) => b.candidaturas - a.candidaturas).slice(0, PARTIDOS_NA_CEDULA)
    if (filtros.partido && !top.some((p) => p.sigla === filtros.partido)) {
      const escolhido = partidos.find((p) => p.sigla === filtros.partido)
      if (escolhido) top.push(escolhido)
    }
    return top.sort((a, b) => a.vies - b.vies || a.sigla.localeCompare(b.sigla))
  }, [partidos, filtros.partido])
  const outros = partidos.filter((p) => !naCedula.some((n) => n.sigla === p.sigla))

  // marcar de novo a mesma casa desmarca (volta a valer tudo)
  const marcar = <K extends keyof FiltrosBusca>(k: K, v: FiltrosBusca[K]) => aoMudar({ ...filtros, [k]: filtros[k] === v ? undefined : v })

  const marcas = [
    filtros.cargo ? { chave: 'cargo' as const, texto: CARGOS_BUSCA.find((c) => c.cod === filtros.cargo)?.nome ?? '' } : null,
    filtros.eleicao ? { chave: 'eleicao' as const, texto: String(filtros.eleicao) } : null,
    filtros.uf ? { chave: 'uf' as const, texto: filtros.uf } : null,
    filtros.partido ? { chave: 'partido' as const, texto: filtros.partido } : null,
    filtros.resultado ? { chave: 'resultado' as const, texto: filtros.resultado === 'eleito' ? 'se elegeu' : 'não se elegeu' } : null,
  ].filter((m) => m !== null)

  return (
    <section aria-label="Cédula de consulta" className="overflow-hidden rounded-2xl bg-folha shadow-[var(--shadow-cartao)]">
      <div className="flex h-1.5" aria-hidden>
        {FITAS.map((f) => <span key={f} className="flex-1" style={{ background: f }} />)}
      </div>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[1.05rem] font-bold leading-tight">Cédula de consulta</h2>
          {aberta || !ativo ? (
            <p className="mt-0.5 text-[0.84rem] text-tinta-3">Marque com X o que a candidatura teve. Linha sem marca vale tudo.</p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Filtros marcados">
              {marcas.map((m) => (
                <li key={m.chave}>
                  <button
                    type="button"
                    onClick={() => aoMudar({ ...filtros, [m.chave]: undefined })}
                    className="inline-flex items-center gap-1 rounded-full bg-papel px-2.5 py-1 text-[0.8rem] font-semibold text-tinta hover:bg-papel-2"
                    aria-label={`Tirar a marca ${m.texto}`}
                  >
                    {m.texto} <X size={11} weight="bold" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {ativo && (
            <button type="button" onClick={() => aoMudar({})} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.82rem] font-semibold text-acao hover:bg-papel">
              <ArrowCounterClockwise size={14} weight="bold" aria-hidden /> Limpar
            </button>
          )}
          <button
            type="button"
            aria-expanded={aberta}
            aria-controls={corpo}
            onClick={() => setAberta((a) => !a)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.82rem] font-semibold text-tinta-2 hover:bg-papel hover:text-tinta"
          >
            {aberta ? 'Recolher' : 'Abrir'}
            <CaretDown size={13} weight="bold" aria-hidden className={`transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {aberta && (
        <div id={corpo}>
          <Linha rotulo="Cargo">
            <div className="flex flex-wrap gap-x-1">
              {CARGOS_BUSCA.map((c, i) => (
                <Casa key={c.cod} marcada={filtros.cargo === c.cod} entrada={filtros.cargo ? filtros.cargo === c.cod : i === 0} aoClicar={() => marcar('cargo', c.cod)}>
                  {c.nome.charAt(0).toUpperCase() + c.nome.slice(1)}
                </Casa>
              ))}
            </div>
          </Linha>

          <Linha rotulo="Eleição">
            {/* duas colunas da cédula: eleições gerais e municipais, cada uma em ordem cronológica */}
            <div className="grid max-w-[310px] grid-cols-2 gap-x-5">
              {([['Gerais', GERAIS], ['Municipais', MUNICIPAIS]] as const).map(([tipo, anos], k) => (
                <div key={tipo}>
                  <p className="px-1.5 pb-0.5 pt-2 text-[0.76rem] font-semibold text-tinta-3">{tipo}</p>
                  <div className="grid grid-cols-2">
                    {anos.map((a, i) => (
                      <Casa key={a} marcada={filtros.eleicao === a} entrada={filtros.eleicao ? filtros.eleicao === a : k === 0 && i === 0} aoClicar={() => marcar('eleicao', a)}>
                        <span className="tabular">{a}</span>
                      </Casa>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Linha>

          <Linha rotulo="Estado">
            <div className="flex flex-wrap gap-x-1">
              {carregadas.map((u, i) => (
                <Casa key={u.sigla} rotulo={u.nome} marcada={filtros.uf === u.sigla} entrada={filtros.uf ? filtros.uf === u.sigla : i === 0} aoClicar={() => marcar('uf', u.sigla)}>
                  <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden className="shrink-0">
                    <path d={silhuetas.get(u.sigla)} fill="currentColor" opacity={0.7} />
                  </svg>
                  {u.sigla}
                </Casa>
              ))}
            </div>
          </Linha>

          <Linha rotulo="Partido">
            <div className="flex flex-wrap gap-x-1">
              {naCedula.map((p, i) => (
                <Casa
                  key={p.sigla}
                  marcada={filtros.partido === p.sigla}
                  entrada={filtros.partido ? filtros.partido === p.sigla : i === 0}
                  aoClicar={() => marcar('partido', p.sigla)}
                  cor={corVies(p.vies)}
                  xCor={tintaSobre(p.vies)}
                >
                  {p.sigla}
                </Casa>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-1.5">
              <span className="inline-flex items-center gap-2 text-[0.74rem] text-tinta-3">
                esquerda
                <span aria-hidden className="h-1.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${gradienteVies().join(', ')})` }} />
                direita
              </span>
              {outros.length > 0 && (
                <label className="inline-flex items-center gap-2 text-[0.8rem] text-tinta-2">
                  Outros partidos
                  <select
                    value={outros.some((p) => p.sigla === filtros.partido) ? filtros.partido : ''}
                    onChange={(e) => aoMudar({ ...filtros, partido: e.target.value || undefined })}
                    className="h-8 rounded-md border border-linha-2 bg-folha px-2 text-[0.8rem] font-semibold text-tinta focus-visible:outline-[2.5px] focus-visible:outline-acao"
                  >
                    <option value="">escolher</option>
                    {outros.map((p) => <option key={p.sigla} value={p.sigla}>{p.sigla}</option>)}
                  </select>
                </label>
              )}
            </div>
          </Linha>

          <Linha rotulo="Resultado">
            <div className="flex flex-wrap gap-x-1">
              <Casa marcada={filtros.resultado === 'eleito'} entrada={filtros.resultado !== 'nao_eleito'} aoClicar={() => marcar('resultado', 'eleito')}>
                Se elegeu
              </Casa>
              <Casa marcada={filtros.resultado === 'nao_eleito'} entrada={filtros.resultado === 'nao_eleito'} aoClicar={() => marcar('resultado', 'nao_eleito')}>
                Não se elegeu
              </Casa>
            </div>
          </Linha>
        </div>
      )}
    </section>
  )
}
