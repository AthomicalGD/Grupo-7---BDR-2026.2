// Uma disputa de 2º turno aberta: os dois finalistas nos dois turnos (votos e crescimento), de onde podem ter
// vindo os votos novos (só os totais: o TSE não diz quem votou em quem) e onde o líder mudou pelo território.
import { ArrowRight, Intersect } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { consultas, type Finalista, type LugarSegundoTurno, type SegundoTurno } from '../api'
import { projecaoBrasil, formas } from '../atlas/geo'
import { EsqueletoBloco } from '../componentes/Esqueleto'
import { ErroCarga } from '../componentes/ErroCarga'
import { Retrato } from '../componentes/Retrato'
import { decimal, inteiro, nomeProprio, pct, plural } from '../lib/formato'
import { COR, disputaNome, nomeUrna, sinal } from './comuns'

/* ---------- os dois finalistas, do 1º ao 2º turno, em votos ---------- */
function Inclinacao({ d }: { d: SegundoTurno }) {
  const W = 640, H = 300, X1 = 92, X2 = W - 92, Y0 = 34, Y1 = H - 40
  const max = Math.max(...d.finalistas.flatMap((f) => [f.votos_t1, f.votos_t2]))
  const y = (v: number) => Y1 - (v / max) * (Y1 - Y0)
  // os rótulos das pontas não se encostam: se ficarem perto, um sobe e o outro desce
  const afastar = (a: number, b: number) => (Math.abs(a - b) < 26 ? (a < b ? [a - 13 + (b - a) / 2, b + 13 - (b - a) / 2] : [a + 13 - (a - b) / 2, b - 13 + (a - b) / 2]) : [a, b])
  const [e0, e1] = afastar(y(d.finalistas[0].votos_t1), y(d.finalistas[1].votos_t1))
  const [d0, d1] = afastar(y(d.finalistas[0].votos_t2), y(d.finalistas[1].votos_t2))
  const rotulos = [[e0, d0], [e1, d1]]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
      aria-label={d.finalistas.map((f) => `${nomeUrna(f)}: ${inteiro(f.votos_t1)} votos no 1º turno, ${inteiro(f.votos_t2)} no 2º`).join('. ')}>
      {[X1, X2].map((x, i) => (
        <g key={x}>
          <line x1={x} x2={x} y1={Y0 - 14} y2={Y1} stroke="var(--color-linha)" strokeWidth={1.5} />
          <text x={x} y={Y1 + 26} textAnchor="middle" className="fill-tinta text-[14px] font-bold">{i ? '2º turno' : '1º turno'}</text>
        </g>
      ))}
      {d.finalistas.map((f, i) => {
        const cor = f.venceu ? COR.vence : COR.perde
        const [ya, yb] = [y(f.votos_t1), y(f.votos_t2)]
        return (
          <g key={f.id_candidatura}>
            <line x1={X1} y1={ya} x2={X2} y2={yb} stroke={cor} strokeWidth={f.venceu ? 5 : 4} strokeLinecap="round" />
            <circle cx={X1} cy={ya} r={7} fill={cor} stroke="var(--color-folha)" strokeWidth={2.5} />
            <circle cx={X2} cy={yb} r={7} fill={cor} stroke="var(--color-folha)" strokeWidth={2.5} />
            <text x={X1 - 14} y={rotulos[i][0] + 5} textAnchor="end" className="tabular fill-tinta text-[13px] font-bold">{inteiro(f.votos_t1)}</text>
            <text x={X2 + 14} y={rotulos[i][1] + 5} className="tabular fill-tinta text-[13px] font-bold">{inteiro(f.votos_t2)}</text>
            {f.crescimento != null && (
              <g transform={`translate(${(X1 + X2) / 2} ${(ya + yb) / 2 + (i ? 26 : -18)})`}>
                <rect x={-34} y={-13} width={68} height={22} rx={11} fill="var(--color-folha)" stroke={cor} strokeWidth={1.5} />
                <text textAnchor="middle" y={3} className="tabular text-[12.5px] font-bold" fill={f.venceu ? 'var(--color-selecao-tinta)' : 'var(--color-tinta-2)'}>
                  {sinal(f.crescimento)}{decimal(Math.abs(f.crescimento), 0)}%
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ---------- de onde vieram os votos novos: os totais de cada turno, na mesma régua (os aptos) ---------- */
function Votos({ d }: { d: SegundoTurno }) {
  const { t1, t2 } = d.turnos
  if (!t1 || !t2) return null
  const [a, b] = d.finalistas
  const linhas = [
    { turno: '1º turno', partes: [
      { r: nomeUrna(a), v: a.votos_t1, cor: COR.vence }, { r: nomeUrna(b), v: b.votos_t1, cor: COR.perde },
      { r: `Os outros ${d.eliminados.candidatos}`, v: d.eliminados.votos, cor: 'var(--color-acao-claro)' },
      { r: 'Brancos e nulos', v: t1.brancos + t1.nulos, cor: 'var(--color-papel-2)' }, { r: 'Não foram votar', v: t1.abstencoes, cor: 'hachura' },
    ] },
    { turno: '2º turno', partes: [
      { r: nomeUrna(a), v: a.votos_t2, cor: COR.vence }, { r: nomeUrna(b), v: b.votos_t2, cor: COR.perde },
      { r: 'Brancos e nulos', v: t2.brancos + t2.nulos, cor: 'var(--color-papel-2)' }, { r: 'Não foram votar', v: t2.abstencoes, cor: 'hachura' },
    ] },
  ]
  const total = Math.max(...linhas.map((l) => l.partes.reduce((s, p) => s + p.v, 0)))
  const ganhoA = a.votos_t2 - a.votos_t1, ganhoB = b.votos_t2 - b.votos_t1
  const dBN = t2.brancos + t2.nulos - (t1.brancos + t1.nulos), dAbs = t2.abstencoes - t1.abstencoes
  const muda = (n: number, coisa: string) => `${coisa} ${n > 0 ? 'subiram' : 'caíram'} ${inteiro(Math.abs(n))}`
  return (
    <div>
      <div className="space-y-3">
        {linhas.map((l) => (
          <div key={l.turno} className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3">
            <span className="text-[0.86rem] font-bold">{l.turno}</span>
            <div className="flex h-9 overflow-hidden rounded-[8px] border border-linha-2 bg-folha" role="img"
              aria-label={`${l.turno}: ${l.partes.map((p) => `${p.r} ${inteiro(p.v)}`).join(', ')}`}>
              {l.partes.map((p) => (
                <div key={p.r} title={`${p.r}: ${inteiro(p.v)}`} className={`h-full border-r border-folha last:border-r-0 ${p.cor === 'hachura' ? 'segundo-hachura' : ''}`}
                  style={{ width: `${(100 * p.v) / total}%`, background: p.cor === 'hachura' ? undefined : p.cor }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pl-[88px] text-[0.8rem] text-tinta-2 max-sm:pl-0">
        {linhas[0].partes.map((p) => (
          <li key={p.r} className="inline-flex items-center gap-1.5">
            <span className={`size-3 rounded-[3px] border border-linha-2 ${p.cor === 'hachura' ? 'segundo-hachura' : ''}`} style={{ background: p.cor === 'hachura' ? undefined : p.cor }} aria-hidden />{p.r}
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-[64ch] text-[0.95rem] leading-relaxed">
        No 1º turno, os outros {plural(d.eliminados.candidatos, 'candidato', 'candidatos')} somaram <b className="tabular">{inteiro(d.eliminados.votos)}</b> votos.
        No 2º, <b>{nomeUrna(a)}</b> {ganhoA >= 0 ? 'ganhou' : 'perdeu'} <b className="tabular">{inteiro(Math.abs(ganhoA))}</b> e <b>{nomeUrna(b)}</b> {ganhoB >= 0 ? 'ganhou' : 'perdeu'} <b className="tabular">{inteiro(Math.abs(ganhoB))}</b>;
        {' '}{muda(dBN, 'brancos e nulos')} e as faltas {dAbs > 0 ? 'subiram' : 'caíram'} {inteiro(Math.abs(dAbs))}.
      </p>
      <p className="mt-2 max-w-[64ch] text-[0.82rem] text-tinta-3">O voto é secreto: o TSE não diz quem votou em quem, então dá para comparar os totais, mas não seguir cada eleitor de um turno ao outro.</p>
    </div>
  )
}

/* ---------- onde o líder mudou: presidente por estado, governador por município, prefeito por zona ---------- */
type Vista = 't1' | 't2' | 'virou'
const corLugar = (l: LugarSegundoTurno, vista: Vista) => {
  if (vista === 'virou') return l.virou ? COR.vira : 'var(--color-papel-2)'
  const [a, b] = vista === 't1' ? [l.a1, l.b1] : [l.a2, l.b2]
  if (a + b === 0) return 'var(--color-papel-2)'
  const forte = Math.abs(a - b) / (a + b) > 0.2
  return a > b ? (forte ? COR.vence : COR.venceClaro) : (forte ? COR.perde : COR.perdeClaro)
}

function Territorio({ d, ufs }: { d: SegundoTurno; ufs: Map<string, string> }) {
  const q = useQuery(consultas.segundoTurnoLugares(d.id))
  const nivel = d.cod_cargo === 1 ? 'uf' : d.cod_cargo === 3 ? 'municipio' : 'zona'
  const malha = useQuery({ ...(nivel === 'uf' ? consultas.malhaBrasil() : consultas.malhaUF(d.uf ?? '')), enabled: nivel !== 'zona' })
  const [vista, setVista] = useState<Vista>('virou')
  const [foco, setFoco] = useState<LugarSegundoTurno | null>(null)
  const desenho = useMemo(() => (malha.data ? formas(malha.data, projecaoBrasil(malha.data), 1) : null), [malha.data])
  // a caixa do grosso do lugar: ilhas longe (Fernando de Noronha, em PE) esticariam o desenho e ficam de fora
  const caixa = useMemo(() => {
    if (!desenho?.length) return '0 0 1000 1000'
    const qx = desenho.map((f) => f.centro[0]).sort((p, q) => p - q), qy = desenho.map((f) => f.centro[1]).sort((p, q) => p - q)
    const corte = Math.floor(desenho.length * 0.01), dentro = (v: number, q: number[]) => v >= q[corte] && v <= q[q.length - 1 - corte]
    const grosso = desenho.filter((f) => dentro(f.centro[0], qx) && dentro(f.centro[1], qy))
    const x0 = Math.min(...grosso.map((f) => f.caixa[0][0])), y0 = Math.min(...grosso.map((f) => f.caixa[0][1]))
    const x1 = Math.max(...grosso.map((f) => f.caixa[1][0])), y1 = Math.max(...grosso.map((f) => f.caixa[1][1]))
    return `${x0 - 8} ${y0 - 8} ${x1 - x0 + 16} ${y1 - y0 + 16}`
  }, [desenho])
  const porCodigo = useMemo(() => new Map((q.data?.lugares ?? []).map((l) => [l.codigo, l])), [q.data])
  const [a, b] = d.finalistas
  if (q.error) return <ErroCarga erro={q.error} compacto aoTentar={q.refetch} />
  if (!q.data) return <EsqueletoBloco altura={320} linhas={0} rotulo="Juntando os votos de cada lugar..." />
  const lugares = q.data.lugares
  const viraram = lugares.filter((l) => l.virou).length
  const unidade = nivel === 'uf' ? ['estado', 'estados'] : nivel === 'municipio' ? ['município', 'municípios'] : ['zona eleitoral', 'zonas eleitorais']
  const nomeDe = (l: LugarSegundoTurno) => (nivel === 'uf' ? ufs.get(l.nome) ?? l.nome : nivel === 'municipio' ? nomeProprio(l.nome) : l.nome)

  return (
    <div>
      <p className="max-w-[64ch] text-[0.98rem]">
        O líder mudou de um turno para o outro em <b className="tabular">{inteiro(viraram)}</b> de {plural(lugares.length, unidade[0], unidade[1])}.
      </p>
      <div role="radiogroup" aria-label="O que o mapa mostra" className="mt-4 inline-flex rounded-full border border-linha bg-folha p-1">
        {([['virou', 'Onde virou'], ['t1', '1º turno'], ['t2', '2º turno']] as const).map(([k, r]) => (
          <button key={k} type="button" role="radio" aria-checked={vista === k} onClick={() => setVista(k)}
            className={`h-9 rounded-full px-4 text-[0.86rem] font-semibold transition-colors ${vista === k ? 'selecionado-fita' : 'text-tinta-2 hover:text-tinta'}`}>
            {r}
          </button>
        ))}
      </div>

      {nivel === 'zona' ? (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {lugares.map((l) => {
            const p1 = (100 * l.a1) / (l.a1 + l.b1 || 1), p2 = (100 * l.a2) / (l.a2 + l.b2 || 1)
            return (
              <li key={l.codigo} className={`rounded-[12px] border px-3 py-2.5 ${l.virou && vista === 'virou' ? 'border-escolha-2 bg-escolha-claro' : 'border-linha bg-folha'}`}>
                <div className="flex items-center justify-between gap-2 text-[0.86rem] font-bold">
                  {l.nome}
                  {l.virou && <span className="inline-flex items-center gap-1 rounded-full bg-escolha px-2 py-0.5 text-[0.7rem] font-bold text-tinta"><Intersect size={11} weight="bold" aria-hidden />virou</span>}
                </div>
                {[['1º', p1], ['2º', p2]].map(([t, p]) => (
                  <div key={t} className="mt-1.5 grid grid-cols-[22px_minmax(0,1fr)_38px] items-center gap-2 text-[0.75rem] text-tinta-2">
                    <span className="font-semibold">{t}</span>
                    <span className="flex h-2.5 overflow-hidden rounded-full bg-linha"><span style={{ width: `${p}%`, background: COR.vence }} /></span>
                    <span className="tabular text-right">{decimal(p as number, 0)}%</span>
                  </div>
                ))}
              </li>
            )
          })}
        </ul>
      ) : desenho ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <svg viewBox={caixa} className="block max-h-[min(560px,70dvh)] w-full" role="img" onPointerLeave={() => setFoco(null)}
            aria-label={`Mapa: o líder mudou em ${viraram} de ${lugares.length} ${unidade[1]}`}>
            {desenho.map((f) => {
              const l = porCodigo.get(String(f.codigo))
              return (
                <path key={f.codigo} d={f.d} fill={l ? corLugar(l, vista) : 'var(--color-papel-2)'} stroke="var(--color-folha)" strokeWidth={nivel === 'uf' ? 1.6 : 0.8}
                  vectorEffect="non-scaling-stroke" onPointerEnter={() => l && setFoco(l)} />
              )
            })}
          </svg>
          <aside className="self-start rounded-[16px] border border-linha bg-folha p-4 text-[0.86rem]" aria-live="polite">
            {foco ? (
              <>
                <p className="text-[1rem] font-bold">{nomeDe(foco)}</p>
                {[['1º turno', foco.a1, foco.b1], ['2º turno', foco.a2, foco.b2]].map(([t, x, z]) => (
                  <div key={t as string} className="mt-2.5">
                    <p className="t-rotulo text-tinta-3">{t}</p>
                    <p className="tabular"><span className="font-bold" style={{ color: 'var(--color-selecao-tinta)' }}>{nomeUrna(a)}</span> {inteiro(x as number)}</p>
                    <p className="tabular"><span className="font-bold text-tinta-2">{nomeUrna(b)}</span> {inteiro(z as number)}</p>
                  </div>
                ))}
                {foco.virou && <p className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-escolha px-2.5 py-0.5 text-[0.76rem] font-bold"><Intersect size={12} weight="bold" aria-hidden />O líder mudou aqui</p>}
              </>
            ) : (
              <p className="text-tinta-2">Passe o mouse num {unidade[0]} para ver os votos dos dois finalistas em cada turno.</p>
            )}
            <ul className="mt-4 space-y-1.5 border-t border-linha pt-3 text-[0.78rem] text-tinta-2">
              {vista === 'virou' ? (
                <>
                  <li className="flex items-center gap-2"><span className="size-3 rounded-[3px]" style={{ background: COR.vira }} />O líder mudou</li>
                  <li className="flex items-center gap-2"><span className="size-3 rounded-[3px] border border-linha-2 bg-papel-2" />O mesmo nos dois turnos</li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2"><span className="size-3 rounded-[3px]" style={{ background: COR.vence }} />{nomeUrna(a)} na frente</li>
                  <li className="flex items-center gap-2"><span className="size-3 rounded-[3px]" style={{ background: COR.perde }} />{nomeUrna(b)} na frente</li>
                  <li className="text-tinta-3">Tom claro: diferença de até 20 pontos</li>
                </>
              )}
            </ul>
          </aside>
        </div>
      ) : (
        <EsqueletoBloco altura={360} linhas={0} rotulo="Desenhando o mapa..." className="mt-4" />
      )}
    </div>
  )
}

function Ficha({ f }: { f: Finalista }) {
  return (
    <Link to="/politico/$id" params={{ id: String(f.id_politico) }} className="group flex min-w-0 items-center gap-3 rounded-[16px] border border-linha bg-folha p-3 transition-colors hover:border-linha-2">
      <span className="shrink-0 overflow-hidden rounded-full border-[3px]" style={{ borderColor: f.venceu ? COR.vence : COR.perdeClaro }}>
        <Retrato foto={f.foto} nome={f.nome} tamanho={56} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[1.05rem] font-bold group-hover:underline">{nomeUrna(f)}</span>
        <span className="block text-[0.84rem] text-tinta-2">{f.partido ?? 'sem partido'} · {pct(f.pct_t1)} no 1º turno</span>
        <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[0.74rem] font-bold" style={f.venceu ? { background: 'var(--color-selecao-claro)', color: 'var(--color-selecao-tinta)' } : { background: 'var(--color-papel-2)', color: 'var(--color-tinta-2)' }}>
          {f.venceu ? `Venceu com ${pct(f.pct_t2)}` : `Perdeu com ${pct(f.pct_t2)}`}
        </span>
      </span>
    </Link>
  )
}

export function Disputa({ d, ufs }: { d: SegundoTurno; ufs: Map<string, string> }) {
  const [a, b] = d.finalistas
  return (
    <article aria-labelledby="disputa-titulo" className="rounded-[20px] border border-linha bg-folha/60 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="disputa-titulo" className="t-h1">{disputaNome(d, ufs)}, {d.ano}</h2>
          <p className="mt-2 max-w-[60ch] text-[1rem] text-tinta-2">
            {d.virada
              ? <><b className="text-tinta">Virou.</b> {nomeUrna(b)} liderou o 1º turno, mas {nomeUrna(a)} venceu o 2º.</>
              : <>{nomeUrna(a)} liderou o 1º turno e confirmou no 2º.</>}
          </p>
        </div>
        {d.virada && <span className="inline-flex items-center gap-1.5 rounded-full bg-escolha px-3.5 py-1.5 text-[0.86rem] font-bold text-tinta"><Intersect size={16} weight="bold" aria-hidden />Virada</span>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Ficha f={a} />
        <Ficha f={b} />
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="disputa-votos">
          <h3 id="disputa-votos" className="t-h3">Os votos de cada um, de um turno ao outro</h3>
          <div className="mt-3"><Inclinacao d={d} /></div>
        </section>
        <section aria-labelledby="disputa-de-onde">
          <h3 id="disputa-de-onde" className="t-h3">De onde vieram os votos novos?</h3>
          <div className="mt-4"><Votos d={d} /></div>
        </section>
      </div>

      <section aria-labelledby="disputa-onde" className="mt-10">
        <h3 id="disputa-onde" className="t-h3">Onde o líder mudou</h3>
        <div className="mt-3"><Territorio d={d} ufs={ufs} /></div>
      </section>

      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.9rem] font-semibold">
        <Link to="/comparar" search={{ a: a.id_politico, b: b.id_politico }} className="inline-flex items-center gap-1.5 text-acao hover:underline">
          Comparar as carreiras dos dois <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </p>
    </article>
  )
}
