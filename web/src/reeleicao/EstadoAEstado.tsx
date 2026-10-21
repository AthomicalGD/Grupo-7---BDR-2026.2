// Estado a estado (P10a): um mapa do Brasil com câmera, como o mapa do sistema. Em "Todos", o país inteiro:
// os estados carregados pintados pela taxa de reeleição (todos os cargos somados), com a sigla e a taxa, e a
// ficha geral ao lado. Escolher um estado (na fileira ou no mapa) move a câmera até ele, que fica centrado e
// grande, enquanto os outros esmaecem; trocar de estado viaja de um para o outro. A câmera é uma única
// transformação no grupo do SVG (1s, ease in-out), e a ficha fica montada: os pontos das réguas deslizam
// para os valores novos, só o título troca com um fade curto.
import { ArrowRight } from '@phosphor-icons/react'
import { useQueries } from '@tanstack/react-query'
import { geoArea, geoPath, type GeoProjection } from 'd3-geo'
import { motion, MotionConfig } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { consultas, type Malha, type Reeleicao } from '../api'
import { formas, LADO, projecaoBrasil, silhueta } from '../atlas/geo'
import { Atrasado, EsqueletoBloco } from '../componentes/Esqueleto'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargoPlural, inteiro, noEstado } from '../lib/formato'
import { COR, corDaTaxa, POUCOS, TODOS } from './conta'

type UFCarregada = { sigla: string; nome: string; cd_ibge: number }
const MOLA = { type: 'spring', stiffness: 170, damping: 26 } as const
// a cor de identidade de cada estado (não é dado): as fitas da marca, sem o lima, que aqui é "voltaram"
const IDENTIDADE = ['#5e881b', '#5d6b94', '#f19929', '#468baf', '#fbc700', '#76acd0']
const pct = (n: number | null | undefined) => (n == null ? '-' : `${inteiro(Math.round(n))}%`)

/** A caixa da maior parte do estado (sem ilhas como Fernando de Noronha), para a câmera enquadrar o estado. */
function caixaPrincipal(malha: Malha, codigo: number, projecao: GeoProjection): [[number, number], [number, number]] | null {
  const f = malha.features.find((x) => x.properties.codarea === codigo)
  if (!f) return null
  const g = f.geometry
  const maior = g.type === 'MultiPolygon'
    ? { type: 'Polygon' as const, coordinates: g.coordinates.toSorted((a, b) => geoArea({ type: 'Polygon', coordinates: b }) - geoArea({ type: 'Polygon', coordinates: a }))[0] }
    : g
  return geoPath(projecao).bounds(maior) as [[number, number], [number, number]]
}

/** Dos que tentaram, quantos voltaram, somando todos os cargos. */
function geral(d: Reeleicao) {
  const tentaram = d.cargos.reduce((s, c) => s + c.total.tentaram, 0)
  const reeleitos = d.cargos.reduce((s, c) => s + c.total.reeleitos, 0)
  return { tentaram, reeleitos, taxa: tentaram ? (100 * reeleitos) / tentaram : null }
}

/** Um cargo numa régua de 0 a 100%: o ponto é o recorte; o traço em tinta, a média dos estados; os
 * pontinhos vazados, cada estado (na visão de todos). */
function Regua({ nome, taxa, media, reeleitos, tentaram, outros }: {
  nome: string
  taxa: number | null
  media: number | null
  reeleitos: number
  tentaram: number
  outros?: { sigla: string; taxa: number; cor: string }[]
}) {
  const poucos = tentaram < POUCOS
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3.5rem]">
      <span className="min-w-0">
        <span className={`block truncate font-semibold ${poucos ? 'text-tinta-2' : 'text-tinta'}`}>{nome}</span>
        <span className="block text-[0.74rem] tabular text-tinta-3">
          {inteiro(reeleitos)} de {inteiro(tentaram)}{poucos ? ', poucos casos' : ''}
        </span>
      </span>
      <span aria-hidden className="relative order-last col-span-2 h-6 sm:order-none sm:col-span-1">
        <span className="absolute inset-x-0 top-1/2 border-t border-linha-2" />
        {[25, 50, 75].map((v) => (
          <span key={v} className="absolute top-1/2 h-1.5 -translate-y-1/2 border-l border-linha-2" style={{ left: `${v}%` }} />
        ))}
        {outros?.map((o) => (
          <span
            key={o.sigla}
            title={`${o.sigla}: ${pct(o.taxa)}`}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-folha shadow-[0_0_0_1px_rgb(24_32_43/0.25)]"
            style={{ left: `${o.taxa}%`, background: o.cor }}
          />
        ))}
        {media != null && <motion.span className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-tinta" initial={false} animate={{ left: `${media}%` }} />}
        {taxa != null && (
          <motion.span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-folha shadow-[0_1px_3px_rgb(42_53_80/0.35)]"
            style={{ background: poucos ? '#aeb6bf' : COR.texto }}
            initial={false}
            animate={{ left: `${taxa}%` }}
          />
        )}
      </span>
      <span className={`t-numero text-right text-[1.35rem] tabular ${poucos ? 'text-tinta-2' : 'text-tinta'}`}>{pct(taxa)}</span>
    </li>
  )
}

export function EstadoAEstado({ ufs, malha, aoAbrir }: { ufs: UFCarregada[]; malha: Malha | undefined; aoAbrir: (sigla: string) => void }) {
  // só consulta quando a seção chega perto da tela: são contas pesadas na API na primeira vez
  const caixa = useRef<HTMLDivElement>(null)
  const [perto, setPerto] = useState(false)
  useEffect(() => {
    const el = caixa.current
    if (!el || perto) return
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setPerto(true), { rootMargin: '600px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [perto])
  const colunas = [TODOS, ...ufs.map((u) => u.sigla)]
  const qs = useQueries({ queries: colunas.map((s) => ({ ...consultas.reeleicao(s), enabled: perto })) })
  const dados = new Map(colunas.map((s, i) => [s, qs[i].data]))
  const prontos = colunas.every((s) => dados.get(s))

  // o Brasil inteiro no mesmo espaço do mapa do sistema; as silhuetas pequenas da fileira de escolha
  const projecao = useMemo(() => (malha ? projecaoBrasil(malha) : null), [malha])
  const mapa = useMemo(() => (malha && projecao ? formas(malha, projecao, 1) : []), [malha, projecao])
  const miniaturas = useMemo(() => new Map(malha ? ufs.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 22)]) : []), [malha, ufs])
  const porCodigo = new Map(ufs.map((u) => [u.cd_ibge, u]))
  const corDe = new Map(ufs.map((u, i) => [u.sigla, IDENTIDADE[i % IDENTIDADE.length]]))

  const [escolhido, setEscolhido] = useState<string>(TODOS)
  const uf = ufs.find((u) => u.sigla === escolhido)
  const caixaUF = uf && malha && projecao ? caixaPrincipal(malha, uf.cd_ibge, projecao) : null
  // a câmera: identidade em "Todos"; num estado, a caixa dele ocupa ~76% do quadro, centrada
  const camera = (() => {
    if (!caixaUF) return { k: 1, x: 0, y: 0 }
    const [[x0, y0], [x1, y1]] = caixaUF
    const k = Math.min(9, (LADO * 0.76) / Math.max(x1 - x0, y1 - y0))
    return { k, x: LADO / 2 - k * ((x0 + x1) / 2), y: LADO / 2 - k * ((y0 + y1) / 2) }
  })()

  const todos = dados.get(TODOS)
  const d = (uf && dados.get(uf.sigla)) || todos
  const taxaUF = (s: string) => geral(dados.get(s)!).taxa
  const ranking = prontos ? ufs.map((u) => ({ u, taxa: taxaUF(u.sigla) ?? 0 })).toSorted((a, b) => b.taxa - a.taxa) : []
  const mediaDe = (cod: number) => todos?.cargos.find((c) => c.cod === cod)?.total.taxa ?? null

  return (
    <div ref={caixa}>
      {!prontos || !d ? (
        <div className="h-40">{perto && <Atrasado><EsqueletoBloco altura={160} linhas={0} rotulo="Contando os estados..." /></Atrasado>}</div>
      ) : (
        <MotionConfig transition={MOLA} reducedMotion="user">
          <div role="radiogroup" aria-label="Estado" className="flex flex-wrap gap-2">
            <Escolha rotulo="Todos os estados carregados" ativo={escolhido === TODOS} aoClicar={() => setEscolhido(TODOS)}>
              Todos
            </Escolha>
            {ufs.map((u) => (
              <Escolha key={u.sigla} rotulo={u.nome} ativo={u.sigla === escolhido} aoClicar={() => setEscolhido(u.sigla)}>
                <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden className="shrink-0">
                  <path d={miniaturas.get(u.sigla)} fill="currentColor" opacity={0.85} />
                </svg>
                {u.sigla}
              </Escolha>
            ))}
          </div>

          <div className="mt-5 grid items-start gap-x-10 gap-y-6 rounded-[20px] border border-linha bg-folha p-4 shadow-[var(--shadow-cartao)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* o mapa com câmera: não passa da altura da janela, para caber ao lado da ficha */}
            <div className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-220px))] overflow-hidden rounded-2xl bg-papel">
              <svg viewBox={`0 0 ${LADO} ${LADO}`} className="block h-full w-full" role="img" aria-label={uf ? `Mapa aproximado em ${uf.nome}` : 'Mapa do Brasil com os estados carregados pintados pela taxa de reeleição'}>
                <g className="camera-estados" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})` }}>
                  {mapa.map((f) => {
                    const carregado = porCodigo.get(f.codigo)
                    const marcado = !!uf && carregado?.sigla === uf.sigla
                    return (
                      <path
                        key={f.codigo}
                        d={f.d}
                        fill={carregado ? corDaTaxa(taxaUF(carregado.sigla) ?? 0) : '#e3e7ea'}
                        stroke={marcado ? '#18202b' : '#fcfdfd'}
                        strokeWidth={marcado ? 2 : 1.2}
                        vectorEffect="non-scaling-stroke"
                        className={`estado-forma ${carregado ? 'cursor-pointer' : ''}`}
                        style={{ opacity: !uf || marcado ? 1 : 0.22 }}
                        onClick={carregado ? () => setEscolhido(carregado.sigla === escolhido ? TODOS : carregado.sigla) : undefined}
                      />
                    )
                  })}
                  {/* sigla e taxa em cada estado carregado, só na visão de todos */}
                  {mapa.map((f) => {
                    const carregado = porCodigo.get(f.codigo)
                    if (!carregado) return null
                    return (
                      <g key={`r-${f.codigo}`} className="estado-rotulo pointer-events-none" style={{ opacity: uf ? 0 : 1 }} transform={`translate(${f.centro[0]} ${f.centro[1]})`}>
                        <rect x={-17} y={-34} width={34} height={6} rx={3} fill={corDe.get(carregado.sigla)} stroke="#fcfdfd" strokeWidth={1.5} />
                        <text textAnchor="middle" y={-4} fill="#18202b" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 26, paintOrder: 'stroke', stroke: '#fcfdfd', strokeWidth: 5 }}>{carregado.sigla}</text>
                        <text textAnchor="middle" y={24} fill="#18202b" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 21, paintOrder: 'stroke', stroke: '#fcfdfd', strokeWidth: 5 }}>{pct(taxaUF(carregado.sigla))}</text>
                      </g>
                    )
                  })}
                </g>
              </svg>
              <p className="pointer-events-none absolute bottom-2 left-3 text-[0.72rem] text-tinta-3">
                {uf ? 'Toque em Todos para voltar ao Brasil' : 'Toque num estado colorido para aproximar'}
              </p>
            </div>

            <div className="min-w-0">
              <h3 key={escolhido} className="revela t-h1">{uf ? uf.nome : `Os ${ufs.length} estados carregados`}</h3>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                <span className="t-numero text-[clamp(3.2rem,2.4rem+2.6vw,4.6rem)] leading-none tabular" style={{ color: COR.texto }}>{pct(geral(d).taxa)}</span>
                <p className="max-w-[34ch] pb-1.5 text-[1.02rem] leading-snug text-tinta-2">
                  dos que tentaram se reeleger {uf ? noEstado(uf.sigla, uf.nome) : 'nesses estados'} voltaram: {inteiro(geral(d).reeleitos)} de {inteiro(geral(d).tentaram)}, somando os {d.cargos.length} cargos.
                </p>
              </div>
              <p className="mt-3 max-w-[60ch] text-[0.95rem] text-tinta-2">
                {uf ? (
                  (() => {
                    const comparaveis = d.cargos.filter((c) => c.total.tentaram >= POUCOS && c.total.taxa != null && mediaDe(c.cod) != null)
                    const acima = comparaveis.filter((c) => c.total.taxa! > mediaDe(c.cod)!).length
                    const melhor = comparaveis.toSorted((a, b) => b.total.taxa! - a.total.taxa!)[0]
                    return (
                      <>
                        Acima da média dos estados em <b className="text-tinta">{acima} de {comparaveis.length}</b> cargos
                        {melhor ? <>; onde mais se volta é para <b className="text-tinta">{cargoPlural(melhor.nome)}</b> ({pct(melhor.total.taxa)}).</> : '.'}
                      </>
                    )
                  })()
                ) : (
                  <>
                    Onde mais se volta: <b className="text-tinta">{ranking[0].u.nome}</b> ({pct(ranking[0].taxa)}); onde menos:{' '}
                    <b className="text-tinta">{ranking.at(-1)!.u.nome}</b> ({pct(ranking.at(-1)!.taxa)}).
                  </>
                )}
              </p>
              <ul className="mt-4 divide-y divide-linha border-y border-linha">
                {d.cargos.map((c) => (
                  <Regua
                    key={c.cod}
                    nome={c.nome}
                    taxa={c.total.taxa}
                    media={uf ? mediaDe(c.cod) : null}
                    reeleitos={c.total.reeleitos}
                    tentaram={c.total.tentaram}
                    outros={uf ? undefined : ufs.flatMap((u) => {
                      const t = dados.get(u.sigla)?.cargos.find((x) => x.cod === c.cod)?.total.taxa
                      return t == null ? [] : [{ sigla: u.sigla, taxa: t, cor: corDe.get(u.sigla)! }]
                    })}
                  />
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.78rem] text-tinta-3">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COR.texto }} aria-hidden /> {uf ? uf.sigla : 'todos somados'}</span>
                {uf ? (
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[2px] rounded-full bg-tinta" aria-hidden /> média dos estados</span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                    {ufs.map((u) => (
                      <span key={u.sigla} className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: corDe.get(u.sigla) }} aria-hidden /> {u.sigla}</span>
                    ))}
                  </span>
                )}
                <span>de 0 a 100% dos que tentaram</span>
              </p>
              {uf && (
                <button type="button" onClick={() => aoAbrir(uf.sigla)} className="botao-vivo mt-5 h-11 px-5 text-[0.92rem]">
                  Ver a página toda {noEstado(uf.sigla, uf.nome)} <ArrowRight size={16} weight="bold" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </MotionConfig>
      )}
      {prontos && todos && (
        <TabelaAlternavel
          titulo="Taxa de reeleição por cargo e estado, somando todas as eleições"
          colunas={['Cargo', 'Todos', ...ufs.map((u) => u.sigla)]}
          linhas={() =>
            todos.cargos.map((c) => [
              c.nome,
              ...colunas.map((s) => {
                const t = dados.get(s)?.cargos.find((x) => x.cod === c.cod)?.total
                return t && t.taxa != null ? `${pct(t.taxa)} (${inteiro(t.reeleitos)}/${inteiro(t.tentaram)})` : '-'
              }),
            ])
          }
        />
      )}
    </div>
  )
}
