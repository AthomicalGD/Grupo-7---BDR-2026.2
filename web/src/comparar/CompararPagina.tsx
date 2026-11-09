// Político contra político, no mundo dos azulejos: duas fichas frente a frente (cobalto contra vermelho) com o
// "VS" num azulejo partido, os números como cabo de guerra (a barra parte do meio e corre para o lado de quem
// tem mais) e as duas carreiras num painel de azulejos, uma peça por eleição: cheia quando venceu, vazada quando
// perdeu. Os dois ficam no endereço (?a=&b=), então o link compartilhado abre o mesmo duelo.
import { ArrowsLeftRight, MagnifyingGlass, MusicNotes, TShirt, X } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { consultas, salvarVisual, type Candidatura, type Politico, type VisualSalvo } from '../api'
import { ErroCarga } from '../componentes/ErroCarga'
import { Retrato } from '../componentes/Retrato'
import { Bonequinho, tracos } from './Bonequinho'
import { Armario } from './Armario'
import { Dinheiro, Disputas, Patrimonio, Redutos } from './RaioX'
import { VISUAL_INICIAL, type Visual } from './pecas'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, nomeProprio, reaisCurto } from '../lib/formato'

const Bonequinho3D = lazy(() => import('./Bonequinho3D'))

const ULTIMO = 2026
// os dois lados nas cores do azulejo, azul e amarelo: nunca vermelho contra azul, que se lê como esquerda contra
// direita. COR pinta (barras, peças, roupa); TEXTO é a mesma cor escura o bastante para letra sobre branco; SOBRE
// é a letra em cima de COR.
const COR = { a: '#1d4fa0', b: '#f5b800' } as const
// CLARO e TEXTO mudam com o tema (index.css): no escuro, o fundo claro escurece e a letra clareia
const CLARO = { a: 'var(--lado-a-claro)', b: 'var(--lado-b-claro)' } as const
const TEXTO = { a: 'var(--lado-a-texto)', b: 'var(--lado-b-texto)' } as const
const SOBRE = { a: '#ffffff', b: '#121417' } as const

interface Medida {
  rotulo: string
  valor: (p: Politico) => number | null
  fmt: (n: number) => string
}

const soma = (cs: Candidatura[], f: (c: Candidatura) => number | null) => {
  const vs = cs.map(f).filter((v): v is number => v != null)
  return vs.length ? vs.reduce((a, b) => a + b, 0) : null
}

const MEDIDAS: Medida[] = [
  { rotulo: 'Eleições disputadas', valor: (p) => p.resumo.candidaturas, fmt: inteiro },
  { rotulo: 'Vitórias', valor: (p) => p.resumo.vitorias, fmt: inteiro },
  { rotulo: 'Derrotas', valor: (p) => p.resumo.derrotas, fmt: inteiro },
  { rotulo: 'Reeleições', valor: (p) => p.resumo.reeleicoes, fmt: inteiro },
  { rotulo: 'Anos de carreira', valor: (p) => (p.resumo.primeiro_ano && p.resumo.ultimo_ano ? p.resumo.ultimo_ano - p.resumo.primeiro_ano : null), fmt: inteiro },
  { rotulo: 'Gasto declarado (desde 2018)', valor: (p) => soma(p.candidaturas, (c) => c.gasto), fmt: (n) => reaisCurto(n) },
  { rotulo: 'Votos somados', valor: (p) => soma(p.candidaturas, (c) => c.votos), fmt: inteiro },
]

const primeiroNome = (p: Politico) => nomeProprio(p.nome).split(' ')[0]

function Escolher({ lado, aoEscolher }: { lado: 'a' | 'b'; aoEscolher: (id: number) => void }) {
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const id = useId()
  useEffect(() => {
    const t = setTimeout(() => setQ(texto), 250)
    return () => clearTimeout(t)
  }, [texto])
  const r = useQuery(consultas.buscaPoliticos(q, {}, 6))
  return (
    <div className="h-full rounded-[14px] border-[3px] border-dashed bg-white p-5" style={{ borderColor: COR[lado] }}>
      <label htmlFor={id} className="t-h3" style={{ color: TEXTO[lado] }}>{lado === 'a' ? 'Primeiro político' : 'Contra quem?'}</label>
      <div className="relative mt-3">
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3" aria-hidden />
        <input
          id={id}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite um nome (3 letras ou mais)"
          autoComplete="off"
          className="h-12 w-full border border-linha bg-white pl-9 pr-3 text-[0.95rem] outline-none focus:border-tinta"
        />
      </div>
      {q.trim().length >= 3 && (
        <ul className="mt-2 divide-y divide-linha" aria-live="polite">
          {r.isLoading && <li className="py-2 text-[0.88rem] text-tinta-3">Procurando...</li>}
          {r.data?.length === 0 && <li className="py-2 text-[0.88rem] text-tinta-3">Ninguém com esse nome.</li>}
          {r.data?.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => aoEscolher(p.id)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-papel-2">
                <Retrato foto={p.foto} nome={p.nome} tamanho={32} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{nomeProprio(p.nome)}</span>
                  <span className="block text-[0.8rem] text-tinta-3">
                    {p.ufs.join(', ') || 'Brasil'} · {p.primeiro_ano}–{p.ultimo_ano} · {inteiro(p.vitorias)} de {inteiro(p.candidaturas)} vitórias
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A ficha de um lado: o retrato numa peça da cor do lado, o nome grande e a contagem de vitórias. */
function Ficha({ p, lado, visual, aoTirar, aoVestir }: { p: Politico; lado: 'a' | 'b'; visual: Visual; aoTirar: () => void; aoVestir: () => void }) {
  const espelho = lado === 'b'
  return (
    <div className={`relative flex h-full items-stretch overflow-hidden border-[3px] border-tinta ${espelho ? 'flex-row-reverse text-right' : ''}`} style={{ background: CLARO[lado] }}>
      <button type="button" onClick={aoVestir} aria-label={`Abrir o armário de ${nomeProprio(p.nome)}`} title="Abrir o armário"
        className="group relative grid w-[172px] shrink-0 cursor-pointer place-items-end justify-center px-2 pt-3 max-sm:w-[108px]" style={{ background: CLARO[lado], borderInline: `3px solid ${COR[lado]}` }}>
        <Suspense fallback={<><span className="max-sm:hidden"><Bonequinho p={p} cor={COR[lado]} tamanho={118} /></span><span className="sm:hidden"><Bonequinho p={p} cor={COR[lado]} tamanho={84} /></span></>}>
          <Bonequinho3D p={p} cor={COR[lado]} lado={lado} visual={visual} className="aspect-[1/1.42] w-[156px] max-sm:w-[96px]" />
        </Suspense>
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border-2 border-tinta bg-white px-2 py-0.5 text-[0.7rem] font-bold opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Vestir</span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-5">
        <div>
          <Link to="/politico/$id" params={{ id: String(p.id) }} className="t-h1 block leading-[0.95] hover:underline" style={{ color: TEXTO[lado] }}>
            {nomeProprio(p.nome)}
          </Link>
          <p className="mt-2 text-[0.92rem] text-tinta-2">{p.nascimento_ano ? `Nasceu em ${p.nascimento_ano} · ` : ''}{p.ufs.join(', ') || 'Brasil'}</p>
        </div>
        <p className="t-numero text-[2.6rem] leading-none" style={{ color: TEXTO[lado] }}>
          {inteiro(p.resumo.vitorias)}<span className="text-[1.1rem] text-tinta-2"> de {inteiro(p.resumo.candidaturas)} vitórias</span>
        </p>
      </div>
      <button
        type="button"
        onClick={aoTirar}
        aria-label={`Trocar ${nomeProprio(p.nome)}`}
        className={`absolute top-2 grid size-9 place-items-center bg-white text-tinta-2 hover:text-tinta ${espelho ? 'left-2' : 'right-2'}`}
      >
        <X size={16} weight="bold" aria-hidden />
      </button>
    </div>
  )
}

/** O "VS": um azulejo partido na diagonal, metade de cada lado, com os quartos de círculo de Athos. */
function Versus({ aoTrocar, ativo }: { aoTrocar: () => void; ativo: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <svg viewBox="0 0 96 96" className="size-[96px] max-md:size-[72px]" aria-hidden>
        <clipPath id="vs-canto"><rect x="3" y="3" width="90" height="90" rx="20" /></clipPath>
        <g clipPath="url(#vs-canto)">
        <rect width="96" height="96" fill="#fff" />
        <path d="M3 3 L93 3 L3 93 Z" fill={COR.a} />
        <path d="M93 93 L93 3 L3 93 Z" fill={COR.b} />
        <circle cx="3" cy="3" r="26" fill="#fff" opacity=".9" />
        <circle cx="93" cy="93" r="26" fill="#fff" opacity=".9" />
        </g>
        <rect x="3" y="3" width="90" height="90" rx="20" fill="none" stroke="#121417" strokeWidth="6" />
        <text x="48" y="60" textAnchor="middle" fontFamily="League Spartan, sans-serif" fontWeight="900" fontSize="34" fill="#fff" stroke="#121417" strokeWidth="2" paintOrder="stroke">VS</text>
      </svg>
      <button
        type="button"
        onClick={aoTrocar}
        disabled={!ativo}
        aria-label="Trocar os dois de lado"
        className="grid size-10 place-items-center !rounded-full border-[3px] border-tinta bg-white text-tinta hover:bg-papel-2 disabled:opacity-40"
      >
        <ArrowsLeftRight size={18} weight="bold" aria-hidden />
      </button>
    </div>
  )
}

/** Cabo de guerra: a barra parte do meio e corre para o lado de quem tem mais, na proporção dos dois valores. */
function Cabo({ a, b, m, pronto }: { a: Politico; b: Politico; m: Medida; pronto: boolean }) {
  const va = m.valor(a) ?? 0, vb = m.valor(b) ?? 0
  const total = va + vb
  const parteA = total > 0 ? va / total : 0.5
  const venceu = va === vb ? null : va > vb ? 'a' : 'b'
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1fr)] items-center gap-4 border-b-[3px] border-tinta py-4 last:border-b-0 max-sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-sm:gap-y-2">
      <span className={`t-numero text-right text-[1.8rem] leading-none max-sm:order-2 max-sm:text-left ${venceu === 'a' ? '' : 'opacity-55'}`} style={{ color: TEXTO.a }}>
        {m.valor(a) == null ? '-' : m.fmt(va)}
      </span>
      <div className="max-sm:order-1 max-sm:col-span-2">
        <p className="mb-2 text-center text-[0.86rem] font-bold uppercase tracking-[0.06em] text-tinta-2">{m.rotulo}</p>
        <div className="relative h-7 overflow-hidden !rounded-full border-[3px] border-tinta bg-white" role="img" aria-label={`${m.rotulo}: ${primeiroNome(a)} ${m.valor(a) == null ? 'sem dado' : m.fmt(va)}, ${primeiroNome(b)} ${m.valor(b) == null ? 'sem dado' : m.fmt(vb)}`}>
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-[1100ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
            style={{ width: `${(pronto ? parteA : 0.5) * 100}%`, background: COR.a }}
          />
          <div
            className="absolute inset-y-0 right-0 transition-[width] duration-[1100ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
            style={{ width: `${(pronto ? 1 - parteA : 0.5) * 100}%`, background: COR.b }}
          />
          {/* a marca do meio: quem passou dela está ganhando */}
          <div className="absolute inset-y-[-8px] left-1/2 w-[3px] -translate-x-1/2 bg-tinta" />
        </div>
      </div>
      <span className={`t-numero text-[1.8rem] leading-none max-sm:order-3 max-sm:text-right ${venceu === 'b' ? '' : 'opacity-55'}`} style={{ color: TEXTO.b }}>
        {m.valor(b) == null ? '-' : m.fmt(vb)}
      </span>
    </li>
  )
}

/** Um azulejo por eleição: cheio na cor do lado quando venceu (com o quarto de círculo branco), vazado quando perdeu. */
function Peca({ c, lado, aoApontar }: { c: Candidatura | undefined; lado: 'a' | 'b'; aoApontar: (c: Candidatura | null) => void }) {
  if (!c) return <div className="aspect-square rounded-[10px] border border-linha bg-papel-2/50" aria-hidden />
  const rotulo = `${c.ano}: ${c.cargo}, ${c.partido ?? 'sem partido'}, ${c.eleito ? 'venceu' : 'perdeu'}`
  return (
    <button
      type="button"
      aria-label={rotulo}
      onPointerEnter={() => aoApontar(c)}
      onPointerLeave={() => aoApontar(null)}
      onFocus={() => aoApontar(c)}
      onBlur={() => aoApontar(null)}
      className="relative aspect-square overflow-hidden !rounded-[10px] border-[3px] border-tinta transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: c.eleito ? COR[lado] : '#fff' }}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full" aria-hidden>
        {c.eleito ? (
          <>
            <circle cx={lado === 'a' ? 0 : 40} cy="0" r="20" fill="#fff" opacity=".9" />
            {c.reeleito && <circle cx={lado === 'a' ? 40 : 0} cy="40" r="14" fill={lado === 'b' ? '#121417' : '#f5b800'} />}
          </>
        ) : (
          <path d="M0 40 L40 0" stroke={TEXTO[lado]} strokeWidth="5" />
        )}
      </svg>
    </button>
  )
}

function Painel({ a, b }: { a: Politico; b: Politico }) {
  const [foco, setFoco] = useState<{ c: Candidatura; lado: 'a' | 'b' } | null>(null)
  const anos = [a, b].flatMap((p) => p.candidaturas.map((c) => c.ano))
  const primeiro = Math.max(1994, Math.min(ULTIMO - 6, Math.min(...anos)))
  const colunas = Array.from({ length: Math.floor((ULTIMO - primeiro) / 2) + 1 }, (_, i) => primeiro + i * 2)
  // numa eleição com mais de uma candidatura (raro: suplementar), vale a principal
  const doAno = (p: Politico, ano: number) => p.candidaturas.filter((c) => c.ano === ano && !c.suplementar).sort((x, y) => Number(y.eleito) - Number(x.eleito))[0]
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[6px]" style={{ gridTemplateColumns: `112px repeat(${colunas.length}, minmax(0, 1fr))` }}>
          {(['a', 'b'] as const).map((lado) => {
            const p = lado === 'a' ? a : b
            return [
              <div key={`n-${lado}`} className="flex items-center font-[var(--font-display)] text-[1.05rem] font-extrabold" style={{ color: TEXTO[lado] }}>{primeiroNome(p)}</div>,
              ...colunas.map((ano) => <Peca key={`${lado}-${ano}`} c={doAno(p, ano)} lado={lado} aoApontar={(c) => setFoco(c ? { c, lado } : null)} />),
            ]
          })}
          <div />
          {colunas.map((ano) => (
            <div key={ano} className="text-center text-[0.78rem] font-semibold tabular text-tinta-3">{ano}</div>
          ))}
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] text-[0.95rem] text-tinta-2" aria-live="polite">
        {foco ? (
          <>
            <b style={{ color: TEXTO[foco.lado] }}>{foco.c.ano} · {foco.c.cargo}</b> · {[foco.c.partido, foco.c.local].filter(Boolean).join(' · ')} ·{' '}
            {foco.c.situacao}{foco.c.votos != null ? ` · ${inteiro(foco.c.votos)} votos` : ''}{foco.c.gasto != null ? ` · ${reaisCurto(foco.c.gasto)} de gasto` : ''}
          </>
        ) : (
          'Passe o mouse num azulejo para ver a eleição. Cheio: venceu. Riscado: perdeu. Amarelo no canto: reeleição.'
        )}
      </p>
    </div>
  )
}


/* ---------- a ficha técnica, os votos e o espectro ---------- */
const cargoBonito = (c: string) => c.charAt(0) + c.slice(1).toLowerCase()
const resultado = (c: Candidatura) => (c.reeleito ? 'reeleito' : c.eleito ? 'eleito' : 'não eleito')

/** Os fatos de cada um, frente a frente, linha a linha (texto, não barra: são coisas que não se somam). */
function fatos(p: Politico) {
  const cs = [...p.candidaturas].filter((c) => !c.suplementar).sort((x, y) => x.ano - y.ano)
  const primeira = cs[0], ultima = cs.at(-1)
  const comVoto = cs.filter((c) => c.votos != null)
  const maisVotada = comVoto.reduce<Candidatura | undefined>((m, c) => (!m || c.votos! > m.votos! ? c : m), undefined)
  const comGasto = cs.filter((c) => c.gasto != null)
  const maisCara = comGasto.reduce<Candidatura | undefined>((m, c) => (!m || c.gasto! > m.gasto! ? c : m), undefined)
  const ambos = cs.filter((c) => c.gasto != null && c.votos)
  const porVoto = ambos.length ? ambos.reduce((s, c) => s + c.gasto!, 0) / ambos.reduce((s, c) => s + c.votos!, 0) : null
  const partidos = [...new Set(cs.map((c) => c.partido).filter(Boolean))] as string[]
  const cargos = [...new Set(cs.map((c) => cargoBonito(c.cargo)))]
  return [
    { rotulo: 'Idade em 2026', valor: p.nascimento_ano ? `${2026 - p.nascimento_ano} anos` : '-' },
    { rotulo: 'Estreia', valor: primeira ? `${primeira.ano} · ${cargoBonito(primeira.cargo)}` : '-' },
    { rotulo: 'Última eleição', valor: ultima ? `${ultima.ano} · ${cargoBonito(ultima.cargo)} · ${resultado(ultima)}` : '-' },
    { rotulo: 'Maior votação', valor: maisVotada ? `${inteiro(maisVotada.votos)} votos em ${maisVotada.ano}` : 'sem dado de votos' },
    { rotulo: 'Campanha mais cara', valor: maisCara ? `${reaisCurto(maisCara.gasto!)} em ${maisCara.ano}` : 'sem dado de gasto' },
    { rotulo: 'Custo por voto', valor: porVoto != null ? reaisCurto(porVoto) : '-' },
    { rotulo: partidos.length === 1 ? 'Partido' : `Partidos (${partidos.length})`, valor: partidos.join(' → ') || '-' },
    { rotulo: cargos.length === 1 ? 'Cargo disputado' : `Cargos disputados (${cargos.length})`, valor: cargos.join(', ') },
  ]
}

function FichaTecnica({ a, b }: { a: Politico; b: Politico }) {
  const fa = fatos(a), fb = fatos(b)
  return (
    <dl className="mt-6 overflow-hidden rounded-[14px] border-[3px] border-tinta bg-white">
      {fa.map((f, i) => (
        <div key={f.rotulo} className={`grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-3 px-5 py-3 max-sm:grid-cols-2 ${i % 2 ? 'bg-papel-2/60' : ''}`}>
          <dd className="text-right font-semibold max-sm:order-2 max-sm:text-left" style={{ color: TEXTO.a }}>{f.valor}</dd>
          <dt className="text-center text-[0.8rem] font-bold uppercase tracking-[0.06em] text-tinta-3 max-sm:order-1 max-sm:col-span-2">{f.rotulo}</dt>
          <dd className="font-semibold max-sm:order-3 max-sm:text-right" style={{ color: TEXTO.b }}>{fb[i].valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Votos eleição a eleição em espelho: o primeiro para a esquerda, o segundo para a direita, na mesma escala. */
function VotosEspelho({ a, b }: { a: Politico; b: Politico }) {
  const anos = [...new Set([a, b].flatMap((p) => p.candidaturas.filter((c) => !c.suplementar).map((c) => c.ano)))].sort((x, y) => x - y)
  const doAno = (p: Politico, ano: number) => p.candidaturas.find((c) => c.ano === ano && !c.suplementar)
  const max = Math.max(1, ...[a, b].flatMap((p) => p.candidaturas.map((c) => c.votos ?? 0)))
  const barra = (c: Candidatura | undefined, lado: 'a' | 'b') => {
    if (!c) return null
    if (c.votos == null) return <span className="whitespace-nowrap text-[0.8rem] text-tinta-3">sem votos</span>
    const w = Math.max(2, (100 * c.votos) / max)
    return (
      <div className={`flex w-full flex-col gap-0.5 ${lado === 'a' ? 'items-end' : 'items-start'}`}>
        <div className={`flex h-5 w-full ${lado === 'a' ? 'justify-end' : ''}`}>
          <div className="h-full rounded-full" style={{ width: `${w}%`, minWidth: 8, background: c.eleito ? COR[lado] : CLARO[lado], border: `2px solid ${TEXTO[lado]}` }} />
        </div>
        <span className="text-[0.78rem] font-semibold tabular" style={{ color: TEXTO[lado] }}>{inteiro(c.votos)}</span>
      </div>
    )
  }
  return (
    <div className="mt-6 rounded-[14px] border-[3px] border-tinta bg-white p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
        {anos.map((ano) => [
          <div key={`a${ano}`} className="flex items-center justify-end text-right">{barra(doAno(a, ano), 'a')}</div>,
          <div key={`m${ano}`} className="text-center text-[1rem] font-extrabold tabular text-tinta" style={{ fontFamily: 'var(--font-display)' }}>{ano}</div>,
          <div key={`b${ano}`} className="flex items-center">{barra(doAno(b, ano), 'b')}</div>,
        ])}
      </div>
      <p className="mt-4 text-[0.84rem] text-tinta-3">Barra cheia: venceu. Vazada: perdeu. A mesma escala para os dois; há votos só nas eleições carregadas com votação.</p>
    </div>
  )
}

/** Onde cada um ficou no espectro: o partido de cada eleição na escala de viés (−100 esquerda, +100 direita). */
function Espectro({ a, b }: { a: Politico; b: Politico }) {
  const W = 960, E = 40, D = 40, LINHA = 17
  const x = (v: number) => E + ((v + 100) / 200) * (W - E - D)
  // um ponto por partido (com os anos dele), não por eleição: quem não troca de partido vira um ponto só.
  // Os rótulos vão para a primeira fileira livre (da linha para fora), sem encostar um no outro
  const rotulos = (p: Politico) => {
    const porPartido = new Map<string, { v: number; anos: number[] }>()
    for (const c of p.candidaturas) {
      if (c.vies == null || !c.partido) continue
      const it = porPartido.get(c.partido) ?? { v: c.vies, anos: [] }
      it.anos.push(c.ano)
      porPartido.set(c.partido, it)
    }
    const fim: number[] = []   // onde termina o último rótulo de cada fileira
    return [...porPartido.entries()].sort((m, n) => m[1].v - n[1].v).map(([sigla, { v, anos }]) => {
      const texto = `${sigla} · ${Math.min(...anos)}${anos.length > 1 ? `–${Math.max(...anos)}` : ''}`
      const largura = texto.length * 7.8
      const cx = Math.min(W - largura / 2, Math.max(largura / 2, x(v)))
      let fila = fim.findIndex((f) => f + 10 < cx - largura / 2)
      if (fila < 0) fila = fim.push(0) - 1
      fim[fila] = cx + largura / 2
      return { sigla, v, texto, cx, fila }
    })
  }
  const ra = rotulos(a), rb = rotulos(b)
  const filasA = Math.max(1, ...ra.map((r) => r.fila + 1)), filasB = Math.max(1, ...rb.map((r) => r.fila + 1))
  const meio = 34 + filasA * LINHA + 22
  const H = meio + 22 + filasB * LINHA + 34
  const faixa = (rs: ReturnType<typeof rotulos>, lado: 'a' | 'b') => {
    const yp = lado === 'a' ? meio - 18 : meio + 18
    return rs.map((r) => {
      const yt = lado === 'a' ? yp - 20 - r.fila * LINHA : yp + 30 + r.fila * LINHA
      return (
        <g key={r.sigla}>
          {(r.fila > 0 || Math.abs(r.cx - x(r.v)) > 2) && (
            <line x1={x(r.v)} y1={yp + (lado === 'a' ? -11 : 11)} x2={r.cx} y2={yt + (lado === 'a' ? 4 : -13)} stroke={TEXTO[lado]} strokeWidth={1.2} opacity={0.5} />
          )}
          <circle cx={x(r.v)} cy={yp} r={11} fill={COR[lado]} stroke="var(--color-folha)" strokeWidth={3}><title>{`${r.sigla}: viés ${r.v.toFixed(1)}`}</title></circle>
          <text x={r.cx} y={yt} textAnchor="middle" fontSize={13} fontWeight={800} fill={TEXTO[lado]}>{r.texto}</text>
        </g>
      )
    })
  }
  return (
    <div className="mt-6 overflow-x-auto rounded-[14px] border-[3px] border-tinta bg-white p-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[560px]" role="img" aria-label={`Partidos de ${primeiroNome(a)} e de ${primeiroNome(b)} na escala de viés`}>
        <defs>
          <linearGradient id="espectro-cor" x1="0" x2="1"><stop offset="0" stopColor="#d6382a" /><stop offset="0.5" stopColor="#eef1f5" /><stop offset="1" stopColor="#1d4fa0" /></linearGradient>
        </defs>
        <rect x={x(-100)} y={meio - 5} width={x(100) - x(-100)} height={10} rx={5} fill="url(#espectro-cor)" />
        {[-100, -50, 0, 50, 100].map((v) => (
          <text key={v} x={x(v)} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--color-tinta-3)">{v > 0 ? `+${v}` : v === 0 ? '0' : `−${-v}`}</text>
        ))}
        <text x={x(-100)} y={14} fontSize={12} fontWeight={700} fill="var(--color-tinta-3)">esquerda</text>
        <text x={x(100)} y={14} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--color-tinta-3)">direita</text>
        {faixa(ra, 'a')}
        {faixa(rb, 'b')}
      </svg>
    </div>
  )
}

export function CompararPagina() {
  const busca = useSearch({ from: '/comparar' })
  const navegar = useNavigate({ from: '/comparar' })
  const mudar = (s: { a?: number; b?: number }) => navegar({ search: (x) => ({ ...x, ...s }), replace: true, resetScroll: false })
  const qa = useQuery({ ...consultas.politico(busca.a ?? 0), enabled: !!busca.a })
  const qb = useQuery({ ...consultas.politico(busca.b ?? 0), enabled: !!busca.b })
  const a = qa.data, b = qb.data
  const xa = useQuery({ ...consultas.raioX(busca.a ?? 0), enabled: !!busca.a })
  const xb = useQuery({ ...consultas.raioX(busca.b ?? 0), enabled: !!busca.b })
  const raio = xa.data && xb.data ? { ra: xa.data, rb: xb.data, cores: { cor: COR, texto: TEXTO, claro: CLARO } } : null
  const [visuais, setVisuais] = useState<Record<'a' | 'b', Visual>>({ a: VISUAL_INICIAL, b: VISUAL_INICIAL })
  const [armario, setArmario] = useState<'a' | 'b' | null>(null)
  // a roupa fica salva no banco (migração 017): volta vestida, e a dança salva toca uma vez ao chegar
  const va = useQuery({ ...consultas.visual(busca.a ?? 0), enabled: !!busca.a })
  const vb = useQuery({ ...consultas.visual(busca.b ?? 0), enabled: !!busca.b })
  const vestirSalvo = (l: 'a' | 'b', salvo: VisualSalvo | null | undefined) =>
    setVisuais((x) => ({ ...x, [l]: { ...VISUAL_INICIAL, ...(salvo as Partial<Visual> | null), toca: x[l].toca + (salvo ? 1 : 0) } }))
  useEffect(() => vestirSalvo('a', va.data), [busca.a, va.data])
  useEffect(() => vestirSalvo('b', vb.data), [busca.b, vb.data])
  const guardar = useRef<Record<'a' | 'b', number>>({ a: 0, b: 0 })
  const cliente = useQueryClient()
  const vestir = (l: 'a' | 'b', v: Visual) => {
    setVisuais((x) => ({ ...x, [l]: v }))
    const id = l === 'a' ? busca.a : busca.b
    if (!id) return
    // espera a pessoa parar de trocar peças antes de gravar
    clearTimeout(guardar.current[l])
    guardar.current[l] = window.setTimeout(() => {
      const { toca: _, ...salvo } = v
      salvarVisual(id, salvo).then(() => cliente.setQueryData(consultas.visual(id).queryKey, salvo), () => {})
    }, 700)
  }
  // o cabo de guerra começa no meio e corre depois de desenhado (assim a corrida aparece)
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    if (!a || !b) return
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setPronto(true)))
    return () => {
      cancelAnimationFrame(t)
      setPronto(false)
    }
  }, [a, b])

  useEffect(() => {
    document.title = a && b ? `${nomeProprio(a.nome)} × ${nomeProprio(b.nome)} · Voto Aberto` : 'Político contra político · Voto Aberto'
  }, [a, b])

  const linhas = useMemo(
    () => () =>
      [a, b].flatMap((p) => (p ? p.candidaturas.map((c) => [nomeProprio(p.nome), String(c.ano), c.cargo, c.partido ?? '-', c.local, c.situacao, c.votos == null ? '-' : inteiro(c.votos), c.gasto == null ? '-' : reaisCurto(c.gasto)]) : [])),
    [a, b],
  )
  const placar = useMemo(() => {
    if (!a || !b) return null
    let pa = 0, pb = 0
    for (const m of MEDIDAS) {
      const va = m.valor(a), vb = m.valor(b)
      if (va == null || vb == null || va === vb) continue
      if (m.rotulo === 'Derrotas') (va < vb ? pa++ : pb++)
      else (va > vb ? pa++ : pb++)
    }
    return { pa, pb }
  }, [a, b])

  const lado = (q: typeof qa, p: Politico | undefined, l: 'a' | 'b') =>
    !busca[l] ? (
      <Escolher lado={l} aoEscolher={(id) => mudar({ [l]: id })} />
    ) : q.error ? (
      <ErroCarga erro={q.error} compacto aoTentar={q.refetch} />
    ) : p ? (
      <Ficha p={p} lado={l} visual={visuais[l]} aoTirar={() => mudar({ [l]: undefined })} aoVestir={() => setArmario(l)} />
    ) : (
      <div className="h-[176px] animate-pulse border-[3px] border-linha bg-papel-2" aria-label="Carregando" />
    )

  return (
    <div className="mx-auto max-w-[var(--miolo-max)] px-4 pb-20 pt-8 md:px-[var(--casca-margem)] md:pt-12">
      <h1 className="t-display">Político contra político</h1>
      <p className="mt-4 max-w-[56ch] text-[1.05rem] text-tinta-2">Duas carreiras frente a frente: os números num cabo de guerra e cada eleição como um azulejo.</p>

      <div className="mt-8 grid items-stretch gap-5 md:grid-cols-[1fr_auto_1fr]">
        {lado(qa, a, 'a')}
        <Versus ativo={!!(busca.a || busca.b)} aoTrocar={() => mudar({ a: busca.b, b: busca.a })} />
        {lado(qb, b, 'b')}
      </div>

      {a && b && placar && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setArmario('a')} className="inline-flex items-center gap-2 rounded-full border-[3px] border-tinta bg-white px-5 py-2.5 text-[0.95rem] font-bold hover:bg-papel-2">
              <TShirt size={18} weight="duotone" aria-hidden /> Abrir o armário
            </button>
            <button
              type="button"
              onClick={() => setVisuais((x) => ({ a: { ...x.a, animacao: 'danca', toca: x.a.toca + 1 }, b: { ...x.b, animacao: 'danca', toca: x.b.toca + 1 } }))}
              className="inline-flex items-center gap-2 rounded-full bg-tinta px-5 py-2.5 text-[0.95rem] font-bold text-white"
            >
              <MusicNotes size={18} weight="fill" aria-hidden /> Batalha de dança
            </button>
            <p className="text-[0.88rem] text-tinta-3">Clique num bonequinho para vestir: chapéus, óculos, roupas, o que levam na mão e dez danças.</p>
          </div>
          {armario && (
            <Armario
              inicial={armario}
              lados={{
                a: { p: a, cor: COR.a, tinta: SOBRE.a, visual: visuais.a, faixaPadrao: !!tracos(a, COR.a).faixa },
                b: { p: b, cor: COR.b, tinta: SOBRE.b, visual: visuais.b, faixaPadrao: !!tracos(b, COR.b).faixa },
              }}
              aoMudar={vestir}
              aoFechar={() => setArmario(null)}
            />
          )}

          <section aria-labelledby="placar" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="placar" className="t-h1">O cabo de guerra</h2>
              <p className="t-numero text-[2.4rem] leading-none" aria-label={`Placar: ${primeiroNome(a)} ${placar.pa}, ${primeiroNome(b)} ${placar.pb}`}>
                <span style={{ color: TEXTO.a }}>{placar.pa}</span>
                <span className="mx-2 text-tinta-3">×</span>
                <span style={{ color: TEXTO.b }}>{placar.pb}</span>
              </p>
            </div>
            <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">
              Cada barra parte do meio e corre para o lado de quem tem mais, na proporção dos dois. O placar conta quem leva cada linha (em derrotas, leva quem tem menos). Gasto só existe a partir de 2018.
            </p>
            <ul className="mt-6 border-[3px] border-tinta bg-white px-5">
              {MEDIDAS.map((m) => <Cabo key={m.rotulo} a={a} b={b} m={m} pronto={pronto} />)}
            </ul>
          </section>

          <section aria-labelledby="ficha" className="mt-14">
            <h2 id="ficha" className="t-h1">A ficha técnica</h2>
            <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">O que não cabe numa barra: a estreia, a última eleição, a maior votação, a campanha mais cara, os partidos e os cargos de cada um.</p>
            <FichaTecnica a={a} b={b} />
          </section>

          {raio && (
            <>
              <section aria-labelledby="disputas" className="mt-14">
                <h2 id="disputas" className="t-h1">Em que lugar chegaram</h2>
                <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">Cada disputa no 1º turno: a colocação entre todos os candidatos ao mesmo cargo, no mesmo lugar, e a fatia dos votos nominais.</p>
                <Disputas a={a} b={b} {...raio} />
              </section>

              <section aria-labelledby="redutos" className="mt-14">
                <h2 id="redutos" className="t-h1">Onde estão os votos</h2>
                <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">Os municípios que mais votaram em cada um na eleição mais recente, e quantos bastam para somar metade dos votos.</p>
                <Redutos a={a} b={b} {...raio} />
              </section>

              <section aria-labelledby="dinheiro" className="mt-14">
                <h2 id="dinheiro" className="t-h1">De onde veio o dinheiro</h2>
                <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">As receitas da campanha mais recente de cada um, pela origem declarada ao TSE: quanto é dinheiro público (os fundos) e quanto veio de doações ou do próprio bolso.</p>
                <Dinheiro a={a} b={b} {...raio} />
              </section>

              <section aria-labelledby="patrimonio" className="mt-14">
                <h2 id="patrimonio" className="t-h1">O patrimônio declarado</h2>
                <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">A soma dos bens que cada um declarou ao se candidatar, eleição a eleição, na mesma escala.</p>
                <Patrimonio a={a} b={b} {...raio} />
              </section>
            </>
          )}

          <section aria-labelledby="votos" className="mt-14">
            <h2 id="votos" className="t-h1">Votos, eleição a eleição</h2>
            <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">Em espelho: {primeiroNome(a)} para a esquerda, {primeiroNome(b)} para a direita, no mesmo ano.</p>
            <VotosEspelho a={a} b={b} />
          </section>

          <section aria-labelledby="espectro" className="mt-14">
            <h2 id="espectro" className="t-h1">No espectro</h2>
            <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">Cada ponto é um partido pelo qual concorreram, na escala de viés da P7, com os anos em que esteve nele.</p>
            <Espectro a={a} b={b} />
          </section>

          <section aria-labelledby="painel" className="mt-14">
            <h2 id="painel" className="t-h1">O painel das carreiras</h2>
            <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">Uma peça por eleição, de dois em dois anos, no mesmo eixo para os dois.</p>
            <div className="mt-6 border-[3px] border-tinta bg-white p-5">
              <Painel a={a} b={b} />
            </div>
            <TabelaAlternavel
              sql="p10Carreira"
              titulo={`Candidaturas de ${nomeProprio(a.nome)} e ${nomeProprio(b.nome)}`}
              colunas={['Político', 'Ano', 'Cargo', 'Partido', 'Onde', 'Resultado', 'Votos', 'Gasto']}
              linhas={linhas}
            />
          </section>
        </>
      )}
      {(!a || !b) && (
        <p className="mt-10 text-[0.92rem] text-tinta-3">
          Escolha os dois para ver o duelo. Também dá para começar da ficha de um político, em "Comparar com outro".{' '}
          <Link to="/urna" className="font-semibold text-acao hover:underline">Procurar na urna</Link>
        </p>
      )}
    </div>
  )
}
