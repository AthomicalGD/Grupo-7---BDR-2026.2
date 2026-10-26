// P9, a chuva de santinhos de uma campanha: o palco 3D (7/12, fixo) e o painel de leitura (5/12), como a
// nuvem de palavras do Voto Aberto. Cada tipo de gasto declarado ao TSE vira um santinho, do tamanho do
// valor. Conta de scripts/09_nuvem_despesas.py, servida por /api/gastos. Carregado sob demanda (three.js).
import { Broom, Megaphone, Receipt, SpeakerHigh, SpeakerSlash, Storefront, Tag } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { animate } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { consultas, type Candidatura, type Gastos } from '../api'
import { ErroCarga } from '../componentes/ErroCarga'
import { Fita } from '../componentes/Fita'
import { cargo as fmtCargo, inteiro, pct } from '../lib/formato'
import { BANDEIRA, criaNuvem, dimensiona, reaisCurto, reaisExato, type EstadoNuvem, type ItemNuvem, type Nuvem } from './nuvem'
import './gastos.css'

const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const ehPropaganda = (s: { propaganda: boolean }) => s.propaganda

function itensDe(d: Gastos): ItemNuvem[] {
  return d.tipos.map((t) => ({ palavra: t.rotulo, n: t.valor, propaganda: t.propaganda, quantidade: t.quantidade, fornecedores: t.fornecedores }))
}

/** O número grande que conta ao aparecer: a parte do gasto que foi para propaganda. */
function NumeroContado({ valor }: { valor: number }) {
  const el = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const n = el.current
    if (!n) return
    const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })
    if (reduzido()) { n.textContent = fmt(valor); return }
    const ctrl = animate(Number(n.dataset.v ?? 0), valor, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { n.textContent = fmt(v) } })
    n.dataset.v = String(valor)
    return () => ctrl.stop()
  }, [valor])
  return <span ref={el}>0</span>
}

/** A legenda de tamanhos: três santinhos de referência (o maior, um do meio e o menor). */
function Legenda({ itens }: { itens: ItemNuvem[] }) {
  const { lista } = useMemo(() => dimensiona(itens), [itens])
  if (!lista.length) return null
  const max = lista[0], min = lista[lista.length - 1]
  const alvo = Math.sqrt(max.n * min.n)
  const meio = lista.reduce((b, w) => (Math.abs(w.n - alvo) < Math.abs(b.n - alvo) ? w : b), lista[0])
  const ref = [max, meio, min].filter((w, i, a) => a.findIndex((x) => x.n === w.n) === i)
  const k = 84 / max.L, H = max.A * k + 24
  let x = 1
  const partes = ref.map((w) => {
    const L = w.L * k, A = w.A * k, x0 = x
    x += Math.max(L, 64) + 18
    return (
      <g key={w.palavra}>
        <rect x={x0} y={H - 22 - A} width={L} height={A} rx={4} fill={w.cor} stroke={w.tom <= 2 ? 'rgb(24 32 43 / .25)' : undefined} />
        <text x={x0 + L / 2} y={H - 4} textAnchor="middle">{reaisCurto(w.n)}</text>
      </g>
    )
  })
  return (
    <svg className="gastos-legenda block h-auto max-w-full" width={Math.ceil(x)} height={Math.ceil(H)} viewBox={`0 0 ${Math.ceil(x)} ${Math.ceil(H)}`} role="img" aria-label="Santinhos de referência: o maior gasto, um intermediário e o menor">
      {partes}
    </svg>
  )
}

/** A chuva de santinhos de uma campanha, com o painel de leitura ao lado. */
export default function Nuvem3D({ c }: { c: Candidatura }) {
  const q = useQuery({ ...consultas.gastos(c.id_candidatura), placeholderData: keepPreviousData })
  const dados = q.data
  const itens = useMemo(() => (dados ? itensDe(dados) : []), [dados])
  const palco = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dica = useRef<HTMLDivElement>(null)
  const nuvem = useRef<Nuvem | null>(null)
  const [estado, setEstado] = useState<EstadoNuvem>({ total: 0, noChao: false, sob: null, fase: 'livre', lida: null })
  const [soPropaganda, setSoPropaganda] = useState(false)
  const [som, setSom] = useState(true)
  const [listaAberta, setListaAberta] = useState(false)
  const [comPiso, setComPiso] = useState(false)

  // a cena nasce uma vez
  useEffect(() => {
    if (!palco.current || !canvas.current || !dica.current) return
    const n = criaNuvem({ palco: palco.current, canvas: canvas.current, dica: dica.current, aoMudar: setEstado })
    nuvem.current = n
    return () => { n.destroi(); nuvem.current = null }
  }, [])

  // cada campanha escolhida faz a chuva cair; o desenho dos santinhos espera as fontes
  useEffect(() => {
    const n = nuvem.current
    if (!n || !dados) return
    // campanha sem nenhum tipo (só doações ou valores zerados): o chão fica vazio, com o aviso no palco
    if (!itens.length) { n.filtra(null, false); n.mostra([], false); return }
    let vivo = true
    Promise.race([
      Promise.all([document.fonts.load('860 40px "Archivo Variable"'), document.fonts.load('600 14px "Red Hat Mono Variable"')]),
      new Promise((r) => setTimeout(r, 2000)),
    ]).then(() => {
      if (!vivo) return
      setSoPropaganda(false)
      n.filtra(null, false)
      setComPiso(n.mostra(itens).comPiso)
    })
    return () => { vivo = false }
  }, [itens, dados])

  // a linha da lista bate o bafo no palco; no celular a lista fica embaixo, então o palco vem para a vista antes
  // (fora da tela a cena não desenha, e o bafo começa quando ele aparece)
  const viraNoPalco = (rotulo: string) => {
    const el = palco.current
    const r = el?.getBoundingClientRect()
    if (el && r && (r.bottom < 120 || r.top > innerHeight - 120)) el.scrollIntoView({ behavior: reduzido() ? 'auto' : 'smooth', block: 'center' })
    nuvem.current?.vira(rotulo)
  }
  const alternaPropaganda = () => {
    const liga = !soPropaganda
    setSoPropaganda(liga)
    nuvem.current?.filtra(liga ? ehPropaganda : null)
  }

  const propaganda = dados?.propaganda
  const tipos = dados?.tipos ?? []
  const max = tipos[0]?.valor ?? 1
  const vistos = listaAberta ? tipos : tipos.slice(0, 8)
  const corDe = useMemo(() => new Map(dimensiona(itens).lista.map((w) => [w.palavra, w])), [itens])
  const nProp = tipos.filter((t) => t.propaganda).length
  const cobertura = dados?.cobertura ?? []
  const somaCob = cobertura.reduce((a, x) => a + x.valor, 0) || 1

  return (
    <>
      <div className="mt-8 grid items-start gap-x-12 gap-y-9 lg:grid-cols-12">
        {/* o palco */}
        <div className="gastos-coluna-palco grid min-w-0 gap-3 lg:col-span-7">
          <p className="t-h3">
            {fmtCargo(c.cargo)}, {c.ano} <span className="font-normal text-tinta-2">· {c.local === 'BRASIL' ? 'Brasil' : c.local}{c.partido ? ` · ${c.partido}` : ''}</span>
          </p>
          <div ref={palco} className="gastos-palco">
            <canvas
              ref={canvas}
              role="img"
              aria-label="Santinhos espalhados no chão, um por tipo de gasto; os de maior valor são os maiores. A lista ao lado tem os mesmos valores."
            />
            <div ref={dica} className="gastos-dica" hidden><b /><span /></div>
            {dados && !tipos.length && (
              <p className="gastos-vazio t-h3">Esta campanha não declarou despesas que entrem na nuvem.</p>
            )}
            {dados && !estado.noChao && estado.total > 0 && (
              <p className="gastos-vazio t-h3">Chão varrido. Toque em “Jogar os santinhos” para a chuva cair de novo.</p>
            )}
            {/* sem aviso por cima: o palco já está lá, e a chuva cai assim que as despesas chegam */}
            {(q.isFetching || !dados) && !q.error && <span className="sr-only" role="status">Somando as despesas...</span>}
            {q.error && !dados && <div className="carregando"><ErroCarga erro={q.error} compacto aoTentar={q.refetch} /></div>}
            <div className="fita-pe"><Fita altura={14} /></div>
          </div>
        </div>

        {/* o painel */}
        <div className="grid min-w-0 gap-9 lg:col-span-5 max-lg:sm:grid-cols-2 max-lg:sm:gap-x-10">
          <div className="grid gap-1.5 max-lg:sm:col-span-2">
            {dados && propaganda ? (
              <>
                <p className="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <span className="t-numero tabular text-[clamp(3.4rem,2.4rem+2.6vw,4.8rem)] leading-[.85] text-tinta">
                    <NumeroContado valor={propaganda.pct} /><span className="text-[0.55em]">%</span>
                  </span>
                  <span className="max-w-[17ch] pb-1 text-[1.05rem] font-semibold leading-snug text-tinta-2">do gasto foi em propaganda e comunicação</span>
                </p>
                <p className="mt-2 text-tinta-2">
                  <b className="font-bold text-tinta">{reaisCurto(propaganda.valor)}</b> de {reaisCurto(dados.total)} contratados, em {inteiro(dados.despesas)} despesas de {tipos.length} tipos.
                  {nProp > 0 && <> Os {nProp} de propaganda levam o carimbo.</>}
                </p>
              </>
            ) : (
              <div className="h-[7.5rem]" />
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button type="button" className="botao-vivo h-11 px-5" disabled={!dados} onClick={() => { setSoPropaganda(false); nuvem.current?.filtra(null, false); nuvem.current?.joga() }}>
                <Receipt size={18} weight="fill" aria-hidden /> {estado.noChao ? 'Jogar de novo' : 'Jogar os santinhos'}
              </button>
              <button type="button" className="botao-contorno gastos-alterna h-10 px-4" aria-pressed={soPropaganda} disabled={!dados || !nProp} onClick={alternaPropaganda}>
                <Megaphone size={18} weight={soPropaganda ? 'fill' : 'regular'} aria-hidden /> Só propaganda
              </button>
              <button type="button" className="botao-contorno h-10 px-4" disabled={!estado.noChao} onClick={() => nuvem.current?.varre()}>
                <Broom size={18} aria-hidden /> Varrer o chão
              </button>
              <button
                type="button" className="botao-contorno grid size-10 place-items-center p-0" aria-pressed={som}
                aria-label="Som do bafo"
                onClick={() => { const v = !som; setSom(v); nuvem.current?.som(v) }}
              >
                {som ? <SpeakerHigh size={18} aria-hidden /> : <SpeakerSlash size={18} aria-hidden />}
              </button>
            </div>
          </div>

          <div className="grid content-start gap-3.5">
            <h3 className="t-h3">Como ler</h3>
            <p className="max-w-[54ch] text-tinta-2">O tamanho do santinho segue o valor: um com o dobro da área custou o dobro. As casas mostram o valor arredondado; o exato está na cola.</p>
            {itens.length > 0 && <Legenda itens={itens} />}
            <p className="max-w-[54ch] text-tinta-2">A cor vai do amarelo (pouco dinheiro) ao azul fechado (muito), na escala da bandeira do sistema.</p>
            {tipos.length > 0 && (
              <div className="gastos-escala t-rotulo" aria-hidden>
                <span>{reaisCurto(tipos[tipos.length - 1].valor)}</span>
                <span className="faixas">{BANDEIRA.map((cor) => <i key={cor} style={{ background: cor }} />)}</span>
                <span>{reaisCurto(max)}</span>
              </div>
            )}
            {comPiso && <p className="text-[0.875rem] text-tinta-2">Os gastos muito pequenos ganham um tamanho mínimo, para o nome caber no santinho.</p>}
            <p className="text-[0.875rem] text-tinta-2">Passe o mouse para ver o valor. Clique num santinho, ou numa linha da lista, para bater o bafo: ele pula, vira e sobe para você ler a cola. Clique fora para ele voltar ao chão.</p>
          </div>

          <div className="grid content-start gap-3.5">
            <h3 className="t-h3">Os maiores gastos</h3>
            <div className="gastos-cabeca t-rotulo px-2" aria-hidden><span>Tipo</span><span /><span>Valor</span></div>
            <ol className="gastos-lista">
              {vistos.map((t, i) => {
                const w = corDe.get(t.rotulo)
                const aceso = estado.sob === t.rotulo || estado.lida === t.rotulo
                return (
                  <li key={t.rotulo}>
                    <button
                      type="button" className="gastos-linha" data-acesa={aceso}
                      aria-label={`${t.rotulo}: ${reaisExato(t.valor)}, ${pct((100 * t.valor) / (dados?.total || 1))} do gasto.${t.propaganda ? ' Propaganda.' : ''} Bater o bafo no santinho.`}
                      onClick={() => viraNoPalco(t.rotulo)}
                      onPointerEnter={() => nuvem.current?.destaca(t.rotulo)}
                      onPointerLeave={() => nuvem.current?.destaca(null)}
                    >
                      <span className="palavra">{t.rotulo}{t.propaganda && <span className="gastos-marca-p" aria-hidden>P</span>}</span>
                      <span className="trilho bg-papel-2"><i style={{ width: `${((100 * t.valor) / max).toFixed(1)}%`, background: w?.cor, boxShadow: w && w.tom <= 2 ? 'inset 0 0 0 1px rgb(24 32 43 / .2)' : undefined, ['--i' as string]: i }} /></span>
                      <span className="conta">{reaisCurto(t.valor)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            {tipos.length > 8 && (
              <div>
                <button type="button" className="font-semibold text-acao underline decoration-[1.5px] underline-offset-[.22em]" aria-expanded={listaAberta} onClick={() => setListaAberta((v) => !v)}>
                  {listaAberta ? 'Mostrar só os 8 maiores' : `Mostrar todos os ${tipos.length}`}
                </button>
              </div>
            )}
            {nProp > 0 && <p className="text-[0.82rem] text-tinta-3"><span className="gastos-marca-p ml-0 mr-1.5" aria-hidden>P</span>propaganda e comunicação da campanha</p>}
          </div>
        </div>
      </div>

      {/* como cada gasto ganhou um tipo, e o que a conta não diz */}
      {dados && (
        <div className="mt-14 grid gap-x-12 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h3 className="t-h3">Como cada gasto ganhou um tipo</h3>
            <p className="mt-2 max-w-[60ch] text-tinta-2">
              O tipo declarado ao TSE vem primeiro. Só quando ele é genérico, como “Serviços prestados por terceiros”, a descrição escrita pela campanha decide. O nome do fornecedor nunca decide.
            </p>
            <div className="mt-5 flex h-5 overflow-hidden rounded-full" role="img" aria-label={cobertura.map((x) => `${x.fonte}: ${pct((100 * x.valor) / somaCob)}`).join('; ')}>
              {cobertura.map((x, i) => (
                <span key={x.fonte} className={i === 2 ? 'gastos-hachura' : ''} style={{ width: `${(100 * x.valor) / somaCob}%`, background: i === 0 ? 'var(--color-selecao)' : i === 1 ? 'var(--color-fita-celeste)' : undefined }} />
              ))}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[0.92rem]">
              {cobertura.map((x, i) => (
                <li key={x.fonte} className="flex items-center gap-2">
                  <span className={`inline-block size-3 rounded-[3px] ${i === 2 ? 'gastos-hachura' : ''}`} style={{ background: i === 0 ? 'var(--color-selecao)' : i === 1 ? 'var(--color-fita-celeste)' : undefined }} aria-hidden />
                  <span><b className="tabular font-bold">{pct((100 * x.valor) / somaCob)}</b> {x.fonte === 'tipo TSE' ? 'pelo tipo do TSE' : x.fonte === 'descrição' ? 'pela descrição' : 'sem identificação'} <span className="text-tinta-3">({inteiro(x.quantidade)} {x.quantidade === 1 ? 'despesa' : 'despesas'})</span></span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid content-start gap-5 lg:col-span-5">
            {[
              { Icone: Receipt, titulo: 'É o contratado, não o pago', texto: 'Soma o que a campanha declarou ter contratado; não confere pagamento nem execução.' },
              { Icone: Tag, titulo: 'Um tipo por despesa', texto: 'Uma despesa que mistura vídeo e redes sociais entra num tipo só, para não contar o dinheiro duas vezes.' },
              { Icone: Storefront, titulo: 'Fornecedor não é serviço', texto: `Quem recebeu aparece na cola, mas não prova o que foi feito. ${inteiro(dados.sem_fornecedor)} ${dados.sem_fornecedor === 1 ? 'despesa não tem' : 'despesas não têm'} fornecedor no cadastro.` },
            ].map(({ Icone, titulo, texto }) => (
              <li key={titulo} className="lembrete flex items-start gap-3.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-selecao-claro text-selecao-tinta"><Icone size={24} weight="fill" aria-hidden /></span>
                <span>
                  <span className="block font-bold text-tinta">{titulo}</span>
                  <span className="mt-0.5 block text-[0.92rem] leading-snug text-tinta-2">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

