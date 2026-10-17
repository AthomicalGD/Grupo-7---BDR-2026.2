// P2: quem declara mais bens se elege mais? Três atos: o cofrinho (todos os candidatos de um cargo dentro de
// um porquinho que se quebra para separá-los em sacolas por faixa de patrimônio e empilhar as moedas dos
// eleitos), "Vale para todos os cargos?" (uma escadinha por cargo e ano) e o que a conta não diz.
// Conta de scripts/02_patrimonio.py, servida por /api/patrimonio e /api/patrimonio/panorama.
import { ArrowRight, ArrowSquareOut, Coins } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CARGOS_P2, consultas, type Ano, type PanoramaPatrimonio, type Patrimonio } from '../api'
import { CedulaAnos } from '../atlas/CedulaAnos'
import { silhueta } from '../atlas/geo'
import { Ciranda, CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { Escolha } from '../componentes/Escolha'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { cargoPlural, inteiro, noEstado, pct, reais } from '../lib/formato'
import type { BuscaPatrimonio } from '../router'
import { BotaoSom, Cofrinho, Passos, type Fase } from './Cofrinho'
import { COR, nomeFaixa, POUCOS, quartis, reaisFaixa, taxaCurta, tetoDe } from './conta'
import { Degraus, Escadas } from './Escadas'

const ANOS_GERAIS: Ano[] = [2018, 2022]
const ANOS_MUNICIPAIS: Ano[] = [2020, 2024]
const TSE_BENS = 'https://divulgacandcontas.tse.jus.br/'
const suave = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')
const b = (t: string) => <b className="tabular font-bold text-tinta">{t}</b>
const vezes = (a: number, z: number) => (a / z).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** A resposta geral, ao lado da abertura: quantas disputas sobem e o exemplo mais forte. */
function Lede({ panorama, noLugar }: { panorama: PanoramaPatrimonio; noLugar: string }) {
  const comparaveis = panorama.recortes.filter((r) => r.sintese.quartis === 4 && r.candidatos >= 200)
  const forte = comparaveis.toSorted((x, y) => (y.sintese.diferenca_pp ?? 0) - (x.sintese.diferenca_pp ?? 0))[0]
  const qs = forte ? quartis(forte.grupos) : []
  const quase = panorama.maior_supera >= panorama.com_quartis - 1
  return (
    <p className="max-w-[54ch] text-[clamp(1.1rem,0.95rem+0.55vw,1.35rem)] font-medium leading-[1.42] text-tinta-2" style={{ fontStretch: '96%' }}>
      <b className="font-bold text-tinta">{quase ? 'Sim, em quase todas as disputas.' : 'Em parte.'}</b>{' '}
      Em {b(inteiro(panorama.maior_supera))} de {b(inteiro(panorama.com_quartis))} disputas (cargo e ano), os 25% que declararam mais bens se
      elegeram mais que os 25% que declararam menos.
      {forte && qs.length === 4 && (
        <>
          {' '}A maior distância é a de {cargoPlural(forte.cargo.nome)} em {forte.ano}{forte.nacional ? '' : ` ${noLugar}`}: {b(taxaCurta(qs[0].taxa))} contra {b(taxaCurta(qs[3].taxa))}.
        </>
      )}
    </p>
  )
}

/** As fichas de cargo: escolher uma troca o cofrinho. A escadinha mostra a mesma conta em miniatura. */
function FichasCargo({ panorama, ano, ativo, aoEscolher }: { panorama: PanoramaPatrimonio | undefined; ano: Ano; ativo: number; aoEscolher: (cod: number) => void }) {
  const teto = panorama ? tetoDe(panorama.recortes) : 50
  // no celular as fichas rolam de lado: a escolhida entra na tela (só a fileira rola, a página não)
  const fileira = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = fileira.current
    const marcada = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!el || !marcada || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft = marcada.offsetLeft - el.offsetLeft - 16
  }, [ativo])
  const grupos = [
    { titulo: 'Eleições gerais', cargos: CARGOS_P2.filter((c) => !c.municipal) },
    { titulo: 'Municipais', cargos: CARGOS_P2.filter((c) => c.municipal) },
  ]
  return (
    <div ref={fileira} role="radiogroup" aria-label="Cargo" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-0">
      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="flex gap-2 lg:flex-col lg:gap-1.5">
          <p className="t-rotulo hidden text-tinta-3 lg:block">{grupo.titulo}</p>
          {grupo.cargos.map((c) => {
            const marcada = c.cod === ativo
            // o ano desta ficha: o escolhido, se for do mesmo tipo de eleição; senão o mais recente dela
            const anos = c.municipal ? ANOS_MUNICIPAIS : ANOS_GERAIS
            const a = anos.includes(ano) ? ano : anos[1]
            const r = panorama?.recortes.find((x) => x.ano === a && x.cargo.cod === c.cod)
            const qs = r ? quartis(r.grupos) : []
            return (
              <button
                key={c.cod}
                type="button"
                role="radio"
                aria-checked={marcada}
                aria-label={r && qs.length ? `${c.nome}, ${a}: de ${taxaCurta(qs[0].taxa)} na faixa de menos bens a ${taxaCurta(qs.at(-1)!.taxa)} na de mais bens` : c.nome}
                onClick={() => aoEscolher(c.cod)}
                className={`flex w-[11.5rem] shrink-0 snap-start items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-[background-color,border-color,transform] active:scale-[0.985] lg:w-full ${
                  marcada ? 'selecionado-fita' : 'border-linha bg-folha text-tinta hover:border-linha-2'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold leading-tight">{c.nome}</span>
                  <span className={`tabular block text-[0.75rem] ${marcada ? 'text-white/85' : 'text-tinta-3'}`}>
                    {r && qs.length ? `${taxaCurta(qs[0].taxa)} → ${taxaCurta(qs.at(-1)!.taxa)} · ${a}` : a}
                  </span>
                </span>
                {r && <Degraus r={r} teto={teto} altura={26} largura={6} claro={marcada} />}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** O que a cena acabou de mostrar, em frase, com o próximo passo. */
function Legenda({ dados, fase, aoMudarFase, rotulo }: { dados: Patrimonio; fase: Fase; aoMudarFase: (f: Fase) => void; rotulo: string }) {
  const qs = quartis(dados.grupos)
  const sem = dados.grupos.find((g) => g.tipo === 'sem_bens')
  const media = dados.resumo.candidatos ? (100 * dados.resumo.eleitos) / dados.resumo.candidatos : 0
  if (fase === 0)
    return (
      <p className="max-w-[64ch] text-[0.92rem] text-tinta-2">
        Cada cofrinho guarda os {rotulo}. São três passos: quebrar, separar pelos bens declarados e ver quem se elegeu.
      </p>
    )
  if (fase === 1) {
    const iguais = qs.length === 4
    const medio = qs.length ? Math.round(qs.reduce((s, g) => s + g.candidatos, 0) / qs.length) : 0
    return (
      <div className="revela flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <p className="max-w-[62ch] text-[1rem] leading-relaxed text-tinta-2">
          {iguais ? (
            <>
              <b className="font-bold text-tinta">Quatro sacolas com o mesmo número de candidatos</b> (cerca de {inteiro(medio)} cada), em fila do que
              declarou menos ao que declarou mais. O candidato do meio de cada sacola declarou{' '}
              {qs.map((g, i) => <span key={g.id}>{b(reaisFaixa(g.mediana))}{i < qs.length - 2 ? ', ' : i === qs.length - 2 ? ' e ' : ''}</span>)}.
            </>
          ) : (
            <>
              <b className="font-bold text-tinta">{qs.length} sacolas</b>: com tantos valores repetidos, não deu para cortar em quatro partes iguais.
            </>
          )}
          {sem && <> A sacola vazia é de quem não registrou nenhum bem: {b(inteiro(sem.candidatos))} candidatos ({pct(100 - dados.resumo.cobertura_pct, 0)}).</>}
        </p>
        <button type="button" onClick={() => aoMudarFase(2)} className="botao-vivo h-12 shrink-0 px-6 text-[1rem]">
          <Coins size={20} weight="fill" aria-hidden /> Ver quem se elegeu
        </button>
      </div>
    )
  }
  const [q1, q4] = [qs[0], qs.at(-1)]
  return (
    <div className="revela flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-[64ch]">
        {q1 && q4 && (
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="t-numero tabular text-[clamp(2.4rem,1.8rem+1.6vw,3.4rem)]" style={{ color: COR.texto }}>{taxaCurta(q4.taxa)}</span>
            <span className="max-w-[48ch] text-[1rem] leading-relaxed text-tinta-2">
              dos {nomeFaixa(q4, qs.length - 1, qs.length).nome.toLowerCase().replace(/^os /, '')} se {q4.eleitos === 1 ? 'elegeu' : 'elegeram'} ({inteiro(q4.eleitos)} de {inteiro(q4.candidatos)}),{' '}
              {q4.taxa > q1.taxa && q1.taxa > 0 ? (
                <>contra {b(taxaCurta(q1.taxa))} dos que declararam menos: {b(`${vezes(q4.taxa, q1.taxa)} vezes`)} a chance.</>
              ) : q4.taxa > q1.taxa ? (
                <>e nenhum dos que declararam menos.</>
              ) : (
                <>e {b(taxaCurta(q1.taxa))} dos que declararam menos: aqui a regra não vale.</>
              )}
            </span>
          </p>
        )}
        {qs.some((g) => g.candidatos < POUCOS) && (
          <p className="mt-3 rounded-xl border border-escolha/50 bg-escolha-claro px-3.5 py-2 text-[0.88rem] text-tinta">
            <b>Poucos candidatos:</b> {qs.length === 4 ? 'cada sacola tem' : 'as sacolas têm'} de {inteiro(Math.min(...qs.map((g) => g.candidatos)))} a{' '}
            {inteiro(Math.max(...qs.map((g) => g.candidatos)))}. Um eleito a mais ou a menos muda muito a porcentagem; olhe também as outras disputas abaixo.
          </p>
        )}
        <p className="mt-2 text-[0.88rem] text-tinta-3">
          Cada moeda é 1 eleito em cada 100 candidatos da sacola; o tracejado é a média de todos ({taxaCurta(media)}).
          {sem && <> Quem não registrou bens: {taxaCurta(sem.taxa)}.</>}
        </p>
      </div>
      <button type="button" onClick={() => aoMudarFase(0)} className="botao-contorno h-11 shrink-0 px-5 text-[0.92rem]">
        Montar o cofrinho de novo
      </button>
    </div>
  )
}

function tabela(dados: Patrimonio) {
  const qs = quartis(dados.grupos)
  return dados.grupos.map((g) => {
    const i = qs.indexOf(g)
    return [
      nomeFaixa(g, Math.max(0, i), qs.length).nome,
      g.de == null ? 'sem valor' : `${reais(g.de)} a ${reais(g.ate)}`,
      g.mediana == null ? '-' : reais(g.mediana),
      inteiro(g.candidatos),
      inteiro(g.eleitos),
      pct(g.taxa),
    ]
  })
}

export function PatrimonioPagina() {
  const busca = useSearch({ from: '/patrimonio' })
  const navegar = useNavigate({ from: '/patrimonio' })
  const mudar = (s: Partial<BuscaPatrimonio>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false })
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), [ufs])
  const silhuetas = useMemo(() => new Map(malha ? carregadas.map((u) => [u.sigla, silhueta(malha, u.cd_ibge, 22)]) : []), [malha, carregadas])
  const [fase, setFase] = useState<Fase>(0)

  const cargo = CARGOS_P2.find((c) => c.cod === busca.cargo) ?? CARGOS_P2[CARGOS_P2.length - 1]
  const anos = cargo.municipal ? ANOS_MUNICIPAIS : ANOS_GERAIS
  const ano = busca.ano && anos.includes(busca.ano) ? busca.ano : anos[anos.length - 1]
  const ufEscolhida = carregadas.find((u) => u.sigla === busca.uf)
  const uf = ufEscolhida?.sigla ?? ''
  const noLugar = ufEscolhida ? noEstado(ufEscolhida.sigla, ufEscolhida.nome) : `nos ${carregadas.length} estados carregados`
  const q = useQuery({ ...consultas.patrimonio(ano, cargo.cod, cargo.nacional ? '' : uf), enabled: !!ufs, placeholderData: keepPreviousData })
  const qp = useQuery({ ...consultas.patrimonioPanorama(uf), enabled: !!ufs, placeholderData: keepPreviousData })
  const dados = q.data
  const rotulo = `candidatos a ${cargo.nome.toLowerCase()} em ${ano} ${cargo.nacional ? 'no Brasil' : noLugar}`

  useEffect(() => {
    document.title = 'Quem declara mais bens se elege mais? · Voto Aberto'
  }, [])

  const abrir = (a: number, c: number) => {
    mudar({ ano: a as Ano, cargo: c })
    document.getElementById('cofrinho')?.scrollIntoView({ behavior: suave(), block: 'start' })
  }

  if (!ufs) return <CirandaTela rotulo="Abrindo a página..." />

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-12 pt-6 md:px-[var(--casca-margem)] md:pt-7">
      <header>
        <h1 className="t-display">Quem declara mais bens se elege mais?</h1>
      </header>
      <div className="mt-4 grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="max-w-[60ch] text-[1.06rem] text-tinta-2">
            Todo candidato entrega ao TSE a lista do que tem: casa, carro, terreno, dinheiro guardado. Aqui os candidatos de cada disputa são
            postos em fila pelo valor total dessa lista e cortados em quatro grupos do mesmo tamanho. Depois, conta-se quantos de cada grupo se elegeram.
          </p>
          <fieldset className="mt-5 min-w-0">
            <legend className="t-rotulo mb-2 text-tinta-2">Estado</legend>
            <div role="radiogroup" aria-label="Estado" className="flex flex-wrap gap-2">
              <Escolha rotulo="Todos os estados carregados" ativo={!uf} aoClicar={() => mudar({ uf: undefined })}>
                Todos
              </Escolha>
              {carregadas.map((u) => (
                <Escolha key={u.sigla} rotulo={u.nome} ativo={u.sigla === uf} aoClicar={() => mudar({ uf: u.sigla })}>
                  <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden className="shrink-0">
                    <path d={silhuetas.get(u.sigla)} fill="currentColor" opacity={0.85} />
                  </svg>
                  {u.sigla}
                </Escolha>
              ))}
            </div>
            {cargo.nacional && uf && (
              <p className="mt-2 text-[0.82rem] text-tinta-3">Presidente é uma disputa nacional: o cofrinho mostra o Brasil inteiro.</p>
            )}
          </fieldset>
        </div>
        {qp.data ? <Lede panorama={qp.data} noLugar={noLugar} /> : <span />}
      </div>

      <div>
        <section id="cofrinho" aria-labelledby="cofrinho-titulo" className="mt-12 max-w-[var(--miolo-max)] scroll-mt-24">
          <h2 id="cofrinho-titulo" className="t-h2">O cofrinho dos candidatos</h2>
          <p className="mt-1 max-w-[88ch] text-[0.95rem] text-tinta-2">
            Escolha um cargo e quebre o cofrinho. As moedas vão para quatro sacolas, da faixa que declarou menos bens à que declarou mais, e
            depois as moedas de quem se elegeu se empilham.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
            <FichasCargo panorama={qp.data} ano={ano} ativo={cargo.cod} aoEscolher={(c) => mudar({ cargo: c, ano: undefined })} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <Passos fase={fase} aoMudar={setFase} />
                <div className="flex items-center gap-3">
                  <fieldset>
                    <legend className="sr-only">Eleição</legend>
                    <CedulaAnos ano={ano} anos={anos} linhaDoTempo={false} aoMudar={(a) => mudar({ ano: a })} />
                  </fieldset>
                  <BotaoSom />
                </div>
              </div>
              {q.error && dados && (
                <p role="alert" className="mt-4 rounded-xl border border-corrige/40 bg-folha px-4 py-3 text-[0.9rem]">
                  Não foi possível abrir este recorte ({q.error.message}). Abaixo, o anterior.
                </p>
              )}
              <div aria-busy={q.isPlaceholderData} className={`relative mt-4 transition-opacity duration-300 ${q.isPlaceholderData ? 'opacity-55' : ''}`}>
                {q.isPlaceholderData && <div className="absolute right-12 top-0 z-10"><Ciranda rotulo="Somando os bens..." tamanho={56} /></div>}
                {dados ? (
                  <>
                    <Cofrinho dados={dados} rotulo={rotulo} fase={fase} aoMudarFase={setFase} />
                    <p className="sr-only" aria-live="polite">
                      {fase === 2 ? quartis(dados.grupos).map((g, i, t) => `${nomeFaixa(g, i, t.length).nome}: ${pct(g.taxa)} se elegeram.`).join(' ') : ''}
                    </p>
                  </>
                ) : q.error ? (
                  <ErroCarga erro={q.error} compacto />
                ) : (
                  <div className="grid min-h-[420px] place-items-center"><Ciranda rotulo="Somando os bens..." /></div>
                )}
              </div>
              {dados && (
                <div className="mt-6 border-t border-linha pt-5">
                  <Legenda dados={dados} fase={fase} aoMudarFase={setFase} rotulo={rotulo} />
                  <TabelaAlternavel
                    titulo={`Patrimônio declarado e eleição: ${cargo.nome.toLowerCase()}, ${ano}`}
                    colunas={['Faixa', 'Valores declarados', 'Candidato do meio', 'Candidatos', 'Eleitos', 'Se elegeram']}
                    linhas={() => tabela(dados)}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="todos" className="adiar mt-16 max-w-[var(--miolo-max)]">
          <h2 id="todos" className="t-h2">Vale para todos os cargos?</h2>
          <p className="mb-6 mt-1 max-w-[64ch] text-[0.95rem] text-tinta-2">
            Cada escadinha é uma disputa {uf ? noLugar : `nos ${carregadas.length} estados`} (Presidente, no Brasil inteiro). Quando os degraus
            sobem, quem declarou mais bens se elegeu mais. Toque numa escadinha para abri-la no cofrinho.
          </p>
          {qp.data ? (
            <Escadas panorama={qp.data} ativo={{ ano, cargo: cargo.cod }} aoAbrir={abrir} />
          ) : qp.error ? (
            <ErroCarga erro={qp.error} compacto />
          ) : (
            <div className="grid min-h-[240px] place-items-center"><Ciranda rotulo="Juntando as disputas..." tamanho={72} /></div>
          )}
        </section>

        <section aria-labelledby="nao-diz" className="adiar mt-16 max-w-[var(--miolo-max)]">
          <h2 id="nao-diz" className="t-h2">O que a conta não diz</h2>
          <div className="mt-5 grid gap-x-12 gap-y-6 text-[0.95rem] leading-relaxed text-tinta-2 md:grid-cols-3">
            <div>
              <h3 className="t-h3 text-tinta">Não é a riqueza de verdade</h3>
              <p className="mt-2">
                É o que o próprio candidato declarou, sem conferência. Imóvel costuma entrar pelo valor de compra, não pelo de mercado, e há
                declarações com erros de digitação (milhões onde seriam milhares). Por isso a página fala do candidato do meio de cada
                sacola, que não muda com esses extremos.
              </p>
            </div>
            <div>
              <h3 className="t-h3 text-tinta">Sacola vazia não é pobreza</h3>
              <p className="mt-2">
                {dados ? <>{b(pct(100 - dados.resumo.cobertura_pct, 0))} dos {rotulo} </> : 'Muitos candidatos '}
                não registraram nenhum bem. Pode ser quem não tem nada, quem esqueceu ou quem não quis declarar: por isso essa sacola fica
                separada e nunca vira R$ 0. Quem declarou exatamente R$ 0 também fica de fora das quatro sacolas (está na tabela).
              </p>
            </div>
            <div>
              <h3 className="t-h3 text-tinta">Andar junto não é causar</h3>
              <p className="mt-2">
                Quem tem mais bens costuma também ter mais tempo de política, mandato, partido forte e campanha cara. A escadinha mostra que
                as duas coisas andam juntas, não que o dinheiro elege sozinho.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-linha pt-4 text-[0.88rem]">
            <Link to="/metodologia" hash="m-patrimonio" className="inline-flex items-center gap-1.5 font-semibold text-acao hover:underline">
              Como a conta é feita <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
            <a href={TSE_BENS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-acao hover:underline">
              Ver a lista de bens de um candidato no portal do TSE <ArrowSquareOut size={14} weight="bold" aria-hidden />
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
