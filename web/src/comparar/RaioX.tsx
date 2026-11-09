// O raio-x dos dois (político contra político): o patrimônio declarado em cada eleição, de onde veio o dinheiro
// da campanha, a posição em cada disputa e os municípios que mais votaram em cada um (/api/politicos/{id}/raio-x).
import { motion } from 'motion/react'
import type { Candidatura, Politico, RaioX } from '../api'
import { inteiro, nomeProprio, pct, reaisCurto } from '../lib/formato'

type Lado = 'a' | 'b'
export interface Cores { cor: Record<Lado, string>; texto: Record<Lado, string>; claro: Record<Lado, string> }

const primeiroNome = (p: Politico) => nomeProprio(p.nome).split(' ')[0]
const surge = (i = 0) => ({
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const },
})
const cartao = 'mt-6 rounded-[14px] border-[3px] border-tinta bg-white p-5'
const principais = (p: Politico) => p.candidaturas.filter((c) => !c.suplementar).sort((x, y) => x.ano - y.ano)

/* ---------- o patrimônio declarado, eleição a eleição ---------- */
export function Patrimonio({ a, b, ra, rb, cores }: { a: Politico; b: Politico; ra: RaioX; rb: RaioX; cores: Cores }) {
  const serie = (p: Politico, r: RaioX) =>
    principais(p).map((c) => ({ ano: c.ano, v: r.candidaturas[c.id_candidatura]?.patrimonio ?? null })).filter((x): x is { ano: number; v: number } => x.v != null)
  const sa = serie(a, ra), sb = serie(b, rb)
  if (!sa.length && !sb.length) return <p className={`${cartao} text-tinta-3`}>Nenhum dos dois declarou bens nas eleições carregadas.</p>
  const anos = [...sa, ...sb].map((x) => x.ano)
  const x0 = Math.min(...anos), x1 = Math.max(...anos, x0 + 4)
  const max = Math.max(...[...sa, ...sb].map((x) => x.v), 1)
  const W = 960, H = 280, E = 86, D = 178, T = 26, B = 34
  const x = (ano: number) => E + ((ano - x0) / (x1 - x0)) * (W - E - D)
  const y = (v: number) => H - B - (v / max) * (H - T - B)
  const linha = (s: { ano: number; v: number }[]) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.ano)},${y(p.v)}`).join('')
  const marcas = [0, 0.5, 1].map((f) => f * max)
  const anosEixo = Array.from({ length: Math.floor((x1 - x0) / 4) + 1 }, (_, i) => x0 + i * 4)
  const fim = (s: { ano: number; v: number }[], l: Lado, p: Politico) => {
    const u = s.at(-1)
    if (!u) return null
    return <text x={x(u.ano) + 12} y={y(u.v) + 5} className="text-[15px] font-bold" fill={cores.texto[l]}>{primeiroNome(p)} {reaisCurto(u.v)}</text>
  }
  const variacao = (s: { v: number }[]) => (s.length > 1 && s[0].v > 0 ? s.at(-1)!.v / s[0].v : null)
  return (
    <motion.div {...surge()} className={cartao}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[560px]" role="img" aria-label={`Patrimônio declarado de ${primeiroNome(a)} e ${primeiroNome(b)} em cada eleição`}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={E} x2={W - D} y1={y(m)} y2={y(m)} stroke="var(--color-linha)" strokeDasharray={m ? '4 5' : undefined} />
              <text x={E - 10} y={y(m) + 4} textAnchor="end" className="tabular text-[13px]" fill="var(--color-tinta-3)">{reaisCurto(m)}</text>
            </g>
          ))}
          {anosEixo.map((ano) => <text key={ano} x={x(ano)} y={H - 10} textAnchor="middle" className="tabular text-[13px]" fill="var(--color-tinta-3)">{ano}</text>)}
          {([['a', sa, a], ['b', sb, b]] as const).map(([l, s, p]) => (
            <g key={l}>
              <motion.path d={linha(s)} fill="none" stroke={cores.cor[l]} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round"
                initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }} />
              {s.map((pt) => (
                <circle key={pt.ano} cx={x(pt.ano)} cy={y(pt.v)} r={6.5} fill={cores.cor[l]} stroke="var(--color-folha)" strokeWidth={2.5}>
                  <title>{`${primeiroNome(p)}, ${pt.ano}: ${reaisCurto(pt.v)}`}</title>
                </circle>
              ))}
              {fim(s, l, p)}
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-3 text-[0.9rem] text-tinta-2">
        {([['a', sa, a], ['b', sb, b]] as const).map(([l, s, p], i) => {
          const v = variacao(s)
          return (
            <span key={l}>
              {i ? ' ' : ''}<b style={{ color: cores.texto[l] }}>{primeiroNome(p)}</b>:{' '}
              {!s.length ? 'sem bens declarados.' : v == null ? `${reaisCurto(s[0].v)} em ${s[0].ano}.` : `de ${reaisCurto(s[0].v)} em ${s[0].ano} para ${reaisCurto(s.at(-1)!.v)} em ${s.at(-1)!.ano} (${v >= 1 ? `${v.toFixed(1).replace('.', ',')}×` : `${Math.round((1 - v) * 100)}% a menos`}).`}
            </span>
          )
        })}{' '}
        Valores declarados ao TSE na candidatura, em reais da época.
      </p>
    </motion.div>
  )
}

/* ---------- de onde veio o dinheiro ---------- */
const FONTES = [
  { k: 'fundo_eleitoral', nome: 'Fundo eleitoral', cor: '#1d4fa0', publico: true },
  { k: 'fundo_partidario', nome: 'Fundo partidário', cor: '#86a6dc', publico: true },
  { k: 'pessoas_fisicas', nome: 'Pessoas físicas', cor: '#f5b800', publico: false },
  { k: 'proprios', nome: 'Do próprio bolso', cor: '#d6382a', publico: false },
  { k: 'outros', nome: 'Outros (partido, outros candidatos)', cor: '#8d95a1', publico: false },
] as const

export function Dinheiro({ a, b, ra, rb, cores }: { a: Politico; b: Politico; ra: RaioX; rb: RaioX; cores: Cores }) {
  // a campanha mais recente com receita declarada de cada um
  const campanha = (p: Politico, r: RaioX) => {
    for (const c of principais(p).reverse()) {
      const x = r.candidaturas[c.id_candidatura]
      const total = x ? FONTES.reduce((s, f) => s + (x[f.k] ?? 0), 0) : 0
      if (total > 0) return { c, x: x!, total }
    }
    return null
  }
  const lados = [['a', a, campanha(a, ra)], ['b', b, campanha(b, rb)]] as const
  if (!lados.some(([, , k]) => k)) return <p className={`${cartao} text-tinta-3`}>Sem receitas declaradas nas eleições carregadas (a prestação de contas existe a partir de 2018).</p>
  return (
    <motion.div {...surge()} className={cartao}>
      <div className="space-y-6">
        {lados.map(([l, p, k], i) => (
          <div key={l}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-[var(--font-display)] text-[1.1rem] font-extrabold" style={{ color: cores.texto[l] }}>
                {primeiroNome(p)}{k && <span className="ml-2 text-[0.85rem] font-semibold text-tinta-3">{k.c.ano} · {k.c.cargo.toLowerCase()}</span>}
              </p>
              {k && (
                <p className="text-[0.9rem] text-tinta-2">
                  <b className="tabular text-tinta">{reaisCurto(k.total)}</b> arrecadados ·{' '}
                  <b className="tabular text-tinta">{pct((100 * FONTES.filter((f) => f.publico).reduce((s, f) => s + (k.x[f.k] ?? 0), 0)) / k.total, 0)}</b> de dinheiro público
                </p>
              )}
            </div>
            {k ? (
              <div className="mt-2 flex h-9 overflow-hidden rounded-full border-[3px] border-tinta bg-papel-2" role="img"
                aria-label={`${primeiroNome(p)}: ${FONTES.map((f) => `${f.nome} ${pct((100 * (k.x[f.k] ?? 0)) / k.total, 0)}`).join(', ')}`}>
                {FONTES.map((f, j) => {
                  const w = (100 * (k.x[f.k] ?? 0)) / k.total
                  return w > 0 ? (
                    <motion.div key={f.k} title={`${f.nome}: ${reaisCurto(k.x[f.k])} (${pct(w, 0)})`} className="h-full"
                      style={{ background: f.cor }} initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.15 + j * 0.08, ease: [0.16, 1, 0.3, 1] }} />
                  ) : null
                })}
              </div>
            ) : <p className="mt-2 text-[0.9rem] text-tinta-3">Sem receita declarada nas eleições carregadas.</p>}
          </div>
        ))}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.82rem] text-tinta-2">
        {FONTES.map((f) => <li key={f.k} className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: f.cor }} aria-hidden />{f.nome}</li>)}
      </ul>
    </motion.div>
  )
}

/* ---------- a posição em cada disputa ---------- */
const MEDALHA = ['#f5b800', '#c9ced6', '#d99a5b']

export function Disputas({ a, b, ra, rb, cores }: { a: Politico; b: Politico; ra: RaioX; rb: RaioX; cores: Cores }) {
  const linhas = (p: Politico, r: RaioX) =>
    principais(p).map((c) => ({ c, x: r.candidaturas[c.id_candidatura] })).filter((d) => d.x?.posicao != null)
  const coluna = (l: Lado, p: Politico, r: RaioX) => {
    const ds = linhas(p, r)
    const primeiros = ds.filter((d) => d.x!.posicao === 1).length
    return (
      <div className="min-w-0">
        <p className="font-[var(--font-display)] text-[1.1rem] font-extrabold" style={{ color: cores.texto[l] }}>{primeiroNome(p)}</p>
        <p className="text-[0.85rem] text-tinta-3">{ds.length ? `${primeiros} de ${ds.length} disputas em 1º lugar no 1º turno` : 'sem votos nas eleições carregadas'}</p>
        <ol className="mt-3 space-y-2.5">
          {ds.map(({ c, x }, i) => <LinhaDisputa key={c.id_candidatura} c={c} posicao={x!.posicao!} concorrentes={x!.concorrentes!} fatia={x!.pct ?? 0} cor={cores.cor[l]} claro={cores.claro[l]} i={i} />)}
        </ol>
      </div>
    )
  }
  return (
    <motion.div {...surge()} className={`${cartao} grid gap-8 md:grid-cols-2`}>
      {coluna('a', a, ra)}
      {coluna('b', b, rb)}
    </motion.div>
  )
}

function LinhaDisputa({ c, posicao, concorrentes, fatia, cor, claro, i }: { c: Candidatura; posicao: number; concorrentes: number; fatia: number; cor: string; claro: string; i: number }) {
  return (
    <motion.li {...surge(i)} className="grid grid-cols-[46px_minmax(0,1fr)] items-center gap-3">
      <span className="grid size-[46px] place-items-center rounded-full border-[3px] border-tinta text-[0.95rem] font-extrabold tabular"
        style={{ background: MEDALHA[posicao - 1] ?? 'var(--color-folha)', color: '#121417' }} title={`${posicao}º de ${concorrentes}`}>
        {posicao}º
      </span>
      <div className="min-w-0">
        <p className="truncate text-[0.88rem]"><b>{c.ano}</b> · {c.cargo.toLowerCase()} · {c.local}<span className="text-tinta-3"> · de {inteiro(concorrentes)}</span></p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: claro }}>
            <motion.div className="h-full rounded-full" style={{ background: cor }} initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, fatia)}%` }}
              viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <span className="w-14 text-right text-[0.82rem] font-semibold tabular">{pct(fatia)}</span>
        </div>
      </div>
    </motion.li>
  )
}

/* ---------- onde estão os votos ---------- */
export function Redutos({ a, b, ra, rb, cores }: { a: Politico; b: Politico; ra: RaioX; rb: RaioX; cores: Cores }) {
  const coluna = (l: Lado, p: Politico, r: RaioX) => {
    const d = r.redutos
    if (!d) return <div><p className="font-[var(--font-display)] text-[1.1rem] font-extrabold" style={{ color: cores.texto[l] }}>{primeiroNome(p)}</p><p className="mt-1 text-[0.9rem] text-tinta-3">Sem votos por município nas eleições carregadas.</p></div>
    const max = d.top[0]?.pct ?? 1
    const concentracao = d.metade / d.municipios
    return (
      <div className="min-w-0">
        <p className="font-[var(--font-display)] text-[1.1rem] font-extrabold" style={{ color: cores.texto[l] }}>
          {primeiroNome(p)} <span className="text-[0.85rem] font-semibold text-tinta-3">{d.ano} · {d.cargo.toLowerCase()}</span>
        </p>
        <p className="mt-1 text-[0.9rem] text-tinta-2">
          Metade dos {inteiro(d.total)} votos veio de <b className="text-tinta">{inteiro(d.metade)}</b> {d.metade === 1 ? 'município' : 'municípios'}, de {inteiro(d.municipios)} com voto
          ({pct(100 * concentracao)} deles).
        </p>
        {/* a régua da concentração: quanto da lista de municípios faz metade dos votos */}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-papel-2" aria-hidden>
          <motion.div className="h-full rounded-full" style={{ background: cores.cor[l] }} initial={{ width: 0 }}
            whileInView={{ width: `${Math.max(1.5, 100 * concentracao)}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
        </div>
        <ol className="mt-4 space-y-2">
          {d.top.map((m, i) => (
            <motion.li key={m.ibge} {...surge(i)} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.6rem] items-center gap-2 text-[0.86rem]">
              <span className="truncate font-semibold" title={`${m.nome} (${m.uf})`}>{nomeProprio(m.nome)} <span className="font-normal text-tinta-3">{m.uf}</span></span>
              <span className="h-3.5 overflow-hidden rounded-full" style={{ background: cores.claro[l] }}>
                <motion.span className="block h-full rounded-full" style={{ background: cores.cor[l] }} initial={{ width: 0 }}
                  whileInView={{ width: `${(100 * m.pct) / max}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
              </span>
              <span className="text-right tabular">{pct(m.pct)}</span>
            </motion.li>
          ))}
        </ol>
      </div>
    )
  }
  return (
    <motion.div {...surge()} className={`${cartao} grid gap-8 md:grid-cols-2`}>
      {coluna('a', a, ra)}
      {coluna('b', b, rb)}
    </motion.div>
  )
}
