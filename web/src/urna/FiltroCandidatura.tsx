// Filtros da busca de políticos, discretos: uma linha de fichas (cargo, eleição, estado, partido,
// resultado); cada uma abre um menu pequeno só quando é clicada. A ficha escolhida mostra o valor e
// tem um x para tirar. O estado leva a silhueta (como na P1) e o partido a cor do seu viés (P7).
// A pessoa entra no resultado se tiver uma candidatura que bata com todos os filtros ao mesmo tempo.
import { CaretDown, Check, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ANOS_ELEICAO, CARGOS_BUSCA, consultas, filtrando, type FiltrosBusca } from '../api'
import { silhueta } from '../atlas/geo'
import { corVies } from '../lib/vies'

type Chave = keyof FiltrosBusca
const GERAIS = ANOS_ELEICAO.filter((a) => a % 4 === 2).reverse()
const MUNICIPAIS = ANOS_ELEICAO.filter((a) => a % 4 === 0).reverse()
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Opcao({ marcada, aoEscolher, children }: { marcada: boolean; aoEscolher: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={marcada}
      onClick={aoEscolher}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.86rem] hover:bg-papel focus-visible:bg-papel focus-visible:outline-none ${marcada ? 'font-bold text-tinta' : 'text-tinta-2'}`}
    >
      <span className="grid w-4 shrink-0 place-items-center">{marcada && <Check size={13} weight="bold" aria-hidden />}</span>
      {children}
    </button>
  )
}

/** Uma ficha: mostra o nome do filtro ou o valor escolhido; o menu abre embaixo dela. */
function Ficha({ rotulo, valor, aberto, aoAbrir, aoFechar, aoLimpar, largura = 'w-56', children }: {
  rotulo: string
  valor?: string
  aberto: boolean
  aoAbrir: () => void
  aoFechar: () => void
  aoLimpar: () => void
  largura?: string
  children: ReactNode
}) {
  const caixa = useRef<HTMLDivElement>(null)
  // perto da borda direita, o menu abre para a esquerda (não sai da tela no celular)
  const [aDireita, setADireita] = useState(false)
  const abrir = () => {
    const r = caixa.current?.getBoundingClientRect()
    setADireita(!!r && r.left > window.innerWidth / 2)
    aoAbrir()
  }
  // fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !caixa.current?.contains(e.target as Node) && aoFechar()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto, aoFechar])
  return (
    <div ref={caixa} className="relative">
      <div className={`inline-flex h-8 items-center rounded-full border text-[0.82rem] font-semibold transition-colors ${valor ? 'border-tinta bg-tinta text-white' : 'border-linha-2 bg-folha text-tinta-2 hover:border-tinta-3 hover:text-tinta'}`}>
        <button type="button" aria-haspopup="menu" aria-expanded={aberto} onClick={aberto ? aoFechar : abrir} className="inline-flex h-full items-center gap-1 rounded-full pl-3 pr-2.5">
          {valor ?? rotulo}
          {!valor && <CaretDown size={11} weight="bold" aria-hidden className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />}
        </button>
        {valor && (
          <button type="button" onClick={aoLimpar} aria-label={`Tirar o filtro ${rotulo.toLowerCase()}: ${valor}`} className="mr-1 grid size-6 place-items-center rounded-full hover:bg-white/15">
            <X size={11} weight="bold" aria-hidden />
          </button>
        )}
      </div>
      {aberto && (
        <div role="menu" aria-label={rotulo} className={`absolute top-10 z-30 max-h-[320px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-linha bg-folha p-1.5 shadow-[var(--shadow-papel)] ${aDireita ? 'right-0' : 'left-0'} ${largura}`}>
          {children}
        </div>
      )}
    </div>
  )
}

export function FiltroCandidatura({ filtros, aoMudar }: { filtros: FiltrosBusca; aoMudar: (f: FiltrosBusca) => void }) {
  const { data: ufs = [] } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const { data: partidos = [] } = useQuery(consultas.partidos())
  const [aberto, setAberto] = useState<Chave | null>(null)
  const carregadas = useMemo(() => ufs.filter((u) => u.carregada), [ufs])
  const silhuetas = useMemo(() => new Map(malha ? carregadas.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 18)]) : []), [malha, carregadas])
  // da esquerda para a direita, como no espectro do voto
  const porVies = useMemo(() => [...partidos].sort((a, b) => a.vies - b.vies || a.sigla.localeCompare(b.sigla)), [partidos])

  const escolher = <K extends Chave>(k: K, v: FiltrosBusca[K]) => {
    aoMudar({ ...filtros, [k]: filtros[k] === v ? undefined : v })
    setAberto(null)
  }
  const ficha = (k: Chave) => ({
    aberto: aberto === k,
    aoAbrir: () => setAberto(k),
    aoFechar: () => setAberto((a) => (a === k ? null : a)),
    aoLimpar: () => aoMudar({ ...filtros, [k]: undefined }),
  })
  const cargo = CARGOS_BUSCA.find((c) => c.cod === filtros.cargo)
  const uf = carregadas.find((u) => u.sigla === filtros.uf)

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros da busca">
      <span className="mr-0.5 text-[0.82rem] text-tinta-3">Filtrar</span>

      <Ficha rotulo="Cargo" valor={cargo && maiuscula(cargo.nome)} {...ficha('cargo')}>
        {CARGOS_BUSCA.map((c) => (
          <Opcao key={c.cod} marcada={filtros.cargo === c.cod} aoEscolher={() => escolher('cargo', c.cod)}>{maiuscula(c.nome)}</Opcao>
        ))}
      </Ficha>

      <Ficha rotulo="Eleição" valor={filtros.eleicao ? String(filtros.eleicao) : undefined} largura="w-64" {...ficha('eleicao')}>
        <div className="grid grid-cols-2 gap-x-1">
          {([['Gerais', GERAIS], ['Municipais', MUNICIPAIS]] as const).map(([tipo, anos]) => (
            <div key={tipo}>
              <p className="px-2 pb-0.5 pt-1 text-[0.72rem] font-semibold text-tinta-3">{tipo}</p>
              {anos.map((a) => (
                <Opcao key={a} marcada={filtros.eleicao === a} aoEscolher={() => escolher('eleicao', a)}><span className="tabular">{a}</span></Opcao>
              ))}
            </div>
          ))}
        </div>
      </Ficha>

      <Ficha rotulo="Estado" valor={uf?.sigla} {...ficha('uf')}>
        {carregadas.map((u) => (
          <Opcao key={u.sigla} marcada={filtros.uf === u.sigla} aoEscolher={() => escolher('uf', u.sigla)}>
            <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden className="shrink-0 text-tinta-3">
              <path d={silhuetas.get(u.sigla)} fill="currentColor" />
            </svg>
            {u.nome}
          </Opcao>
        ))}
      </Ficha>

      <Ficha rotulo="Partido" valor={filtros.partido} {...ficha('partido')}>
        <p className="px-2 pb-1 pt-0.5 text-[0.72rem] text-tinta-3">Da esquerda para a direita</p>
        {porVies.map((p) => (
          <Opcao key={p.sigla} marcada={filtros.partido === p.sigla} aoEscolher={() => escolher('partido', p.sigla)}>
            <span className="size-3 shrink-0 rounded-[3px] border border-tinta/20" style={{ background: corVies(p.vies) }} aria-hidden />
            {p.sigla}
          </Opcao>
        ))}
      </Ficha>

      <Ficha
        rotulo="Resultado"
        valor={filtros.resultado === 'eleito' ? 'Se elegeu' : filtros.resultado === 'nao_eleito' ? 'Não se elegeu' : undefined}
        {...ficha('resultado')}
      >
        <Opcao marcada={filtros.resultado === 'eleito'} aoEscolher={() => escolher('resultado', 'eleito')}>Se elegeu</Opcao>
        <Opcao marcada={filtros.resultado === 'nao_eleito'} aoEscolher={() => escolher('resultado', 'nao_eleito')}>Não se elegeu</Opcao>
      </Ficha>

      {filtrando(filtros) && (
        <button type="button" onClick={() => aoMudar({})} className="rounded-md px-1.5 py-1 text-[0.82rem] font-semibold text-acao hover:bg-folha">
          Limpar
        </button>
      )}
    </div>
  )
}
