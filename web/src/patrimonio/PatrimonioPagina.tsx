// P2: quem declara mais bens se elege mais? A página é uma sequência de atos, cada um com uma função:
// (1) a pergunta e o recorte numa frase ("Candidatos a vereador em 2024, nos 6 estados"), cujas palavras abrem
// as opções; (2) o cofrinho, o protagonista, com uma ação por passo; (3) "E você?", a régua para a pessoa se
// achar na fila; (4) "Vale para todos os cargos?", a resposta geral em número grande e as escadinhas; (5) o que
// a conta não diz. Conta de scripts/02_patrimonio.py, servida por /api/patrimonio e /api/patrimonio/panorama.
import { ArrowRight, ArrowSquareOut, ArrowsLeftRight, Receipt, Scissors, ShoppingBagOpen } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { animate } from 'motion/react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CARGOS_P2, consultas, type Ano, type PanoramaPatrimonio, type Patrimonio } from '../api'
import { Ciranda, CirandaTela } from '../componentes/Ciranda'
import { ErroCarga } from '../componentes/ErroCarga'
import { TabelaAlternavel } from '../graficos/TabelaAlternavel'
import { inteiro, noEstado, pct, reais } from '../lib/formato'
import type { BuscaPatrimonio } from '../router'
import { BotaoSom, Cofrinho, Passos, type Fase } from './Cofrinho'
import { COR, grupoDoValor, nomeFaixa, POUCOS, quartis, taxaCurta } from './conta'
import { Escadas } from './Escadas'
import { Recorte } from './Recorte'
import { Voce } from './Voce'

const ANOS_GERAIS: Ano[] = [2018, 2022]
const ANOS_MUNICIPAIS: Ano[] = [2020, 2024]
const TSE_BENS = 'https://divulgacandcontas.tse.jus.br/'
const suave = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')
const b = (t: string) => <b className="tabular font-bold text-tinta">{t}</b>
const vezes = (a: number, z: number) => (a / z).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** A resposta geral em número grande: em quantas disputas a faixa de mais bens se elegeu mais (conta ao aparecer). */
function Resposta({ panorama }: { panorama: PanoramaPatrimonio }) {
  const numero = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = numero.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctrl = animate(0, panorama.maior_supera, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = String(Math.round(v)) } })
    return () => ctrl.stop()
  }, [panorama.maior_supera])
  return (
    <p className="flex items-end gap-3">
      <span className="t-numero tabular text-[clamp(3.6rem,2.6rem+3vw,5.4rem)] leading-[.85]" style={{ color: COR.texto }}>
        <span ref={numero}>{inteiro(panorama.maior_supera)}</span><span className="text-[0.45em] text-tinta-3"> de {inteiro(panorama.com_quartis)}</span>
      </span>
      <span className="max-w-[18ch] pb-1 text-[0.95rem] font-semibold leading-snug text-tinta-2">disputas em que quem declarou mais bens se elegeu mais</span>
    </p>
  )
}

/** O que a cena acabou de mostrar, em frase, com o próximo passo. */
function Legenda({ dados, fase, aoMudarFase, rotulo, palpite }: { dados: Patrimonio; fase: Fase; aoMudarFase: (f: Fase) => void; rotulo: string; palpite: string | null }) {
  const qs = quartis(dados.grupos)
  const sem = dados.grupos.find((g) => g.tipo === 'sem_bens')
  const media = dados.resumo.candidatos ? (100 * dados.resumo.eleitos) / dados.resumo.candidatos : 0
  const iguais = qs.length === 4
  if (fase === 0) return null
  if (fase === 1)
    return (
      <div className="revela flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <p className="max-w-[56ch] text-[1.05rem] leading-relaxed text-tinta-2">
          <b className="font-bold text-tinta">A fila dos {rotulo}</b>, do menor patrimônio ao maior.
        </p>
        <button type="button" onClick={() => aoMudarFase(2)} className="botao-vivo h-12 shrink-0 px-6 text-[1rem]">
          <Scissors size={20} weight="fill" aria-hidden /> Cortar a fila
        </button>
      </div>
    )
  if (fase === 2)
    return (
      <div className="revela flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <p className="max-w-[56ch] text-[1.05rem] leading-relaxed text-tinta-2">
          <b className="font-bold text-tinta">{iguais ? '4 grupos com o mesmo número de pessoas.' : `${qs.length} grupos.`}</b> Qual elegeu mais? Toque nele.
        </p>
        <button type="button" onClick={() => aoMudarFase(3)} className="botao-contorno h-11 shrink-0 px-5 text-[0.92rem]">
          Pular o palpite
        </button>
      </div>
    )
  const [q1, q4] = [qs[0], qs.at(-1)]
  const maior = qs.toSorted((x, y) => y.taxa - x.taxa)[0]
  const chutado = qs.find((g) => g.id === palpite)
  return (
    <div className="revela flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-[64ch]">
        {chutado && maior && (
          <p className={`mb-3 inline-flex rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold ${chutado.id === maior.id ? 'bg-selecao text-white' : 'bg-papel-2 text-tinta'}`}>
            {chutado.id === maior.id
              ? 'Você acertou o palpite!'
              : `Seu palpite foi ${nomeFaixa(chutado, qs.indexOf(chutado), qs.length).nome.toLowerCase()}; quem mais elegeu foi ${nomeFaixa(maior, qs.indexOf(maior), qs.length).nome.toLowerCase()}.`}
          </p>
        )}
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
            <b>Poucos candidatos:</b> um eleito a mais muda muito a porcentagem.
          </p>
        )}
        <p className="mt-2 text-[0.88rem] text-tinta-3">
          Média de todos: {taxaCurta(media)}.{sem && <> Sem bens declarados: {taxaCurta(sem.taxa)}.</>}
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
  // funções estáveis: as fichas, as escadinhas e o "E você?" são memo e não se redesenham a cada passo do cofrinho
  const mudar = useCallback((s: Partial<BuscaPatrimonio>) => navegar({ search: (a) => ({ ...a, ...s }), replace: true, resetScroll: false }), [navegar])
  const escolherUf = useCallback((sigla: string | undefined) => mudar({ uf: sigla }), [mudar])
  const escolherCargo = useCallback((c: number) => mudar({ cargo: c, ano: undefined }), [mudar])
  const escolherAno = useCallback((a: Ano) => mudar({ ano: a }), [mudar])
  const { data: ufs } = useQuery(consultas.ufs())
  const { data: malha } = useQuery(consultas.malhaBrasil())
  const carregadas = useMemo(() => (ufs ?? []).filter((u) => u.carregada && u.sigla !== 'BR'), [ufs])
  const [fase, setFase] = useState<Fase>(0)
  const [palpite, setPalpite] = useState<string | null>(null)
  const [valor, setValor] = useState<number | null>(null)
  const palpitar = useCallback((id: string) => {
    setPalpite(id)
    setFase(3)
  }, [])

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

  // o palpite vale para um recorte: trocar cargo, ano ou estado o apaga
  const recorte = `${ano}-${cargo.cod}-${uf}`
  const [recorteVisto, setRecorteVisto] = useState(recorte)
  if (recorteVisto !== recorte) {
    setRecorteVisto(recorte)
    setPalpite(null)
  }

  useEffect(() => {
    document.title = 'Quem declara mais bens se elege mais? · Voto Aberto'
  }, [])

  const abrir = useCallback((a: number, c: number) => {
    mudar({ ano: a as Ano, cargo: c })
    document.getElementById('cofrinho')?.scrollIntoView({ behavior: suave(), block: 'start' })
  }, [mudar])
  const ativo = useMemo(() => ({ ano, cargo: cargo.cod }), [ano, cargo.cod])

  if (!ufs) return <CirandaTela rotulo="Abrindo a página..." />

  return (
    <div className="mx-auto max-w-[var(--casca-max)] px-4 pb-20 pt-8 md:px-[var(--casca-margem)] md:pt-12">
      <div className="mx-auto max-w-[var(--miolo-max)]">
        {/* 1. a pergunta e o recorte */}
        <header>
          <h1 className="t-display titulo-p2">Quem declara mais bens se elege mais?</h1>
          <div className="mt-5">
            <Recorte cargo={cargo} ano={ano} anos={anos} uf={uf} ufs={carregadas} malha={malha} panorama={qp.data} aoCargo={escolherCargo} aoAno={escolherAno} aoUf={escolherUf} />
          </div>
        </header>

        {/* 2. o cofrinho */}
        <section id="cofrinho" aria-label="O cofrinho" className="mt-8 scroll-mt-24">
          <div className="flex items-center justify-between gap-4">
            <Passos fase={fase} aoMudar={setFase} />
            <BotaoSom />
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
                <Cofrinho dados={dados} rotulo={rotulo} fase={fase} aoMudarFase={setFase} palpite={palpite} aoPalpitar={palpitar} voce={grupoDoValor(dados, valor)?.id ?? null} />
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
          {dados && fase > 0 && (
            <div className="mt-6 border-t border-linha pt-6">
              <Legenda dados={dados} fase={fase} aoMudarFase={setFase} rotulo={rotulo} palpite={palpite} />
              <TabelaAlternavel
                titulo={`Patrimônio declarado e eleição: ${cargo.nome.toLowerCase()}, ${ano}`}
                colunas={['Faixa', 'Valores declarados', 'Candidato do meio', 'Candidatos', 'Eleitos', 'Se elegeram']}
                linhas={() => tabela(dados)}
              />
            </div>
          )}
        </section>

        {/* 3. e você? */}
        {dados && <Voce dados={dados} rotulo={rotulo} valor={valor} aoMudar={setValor} />}

        {/* 4. vale para todos os cargos? */}
        <section aria-labelledby="todos" className="adiar mt-28 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div>
              <h2 id="todos" className="t-h1">Vale para todos os cargos?</h2>
              <p className="mt-3 max-w-[46ch] text-[1rem] text-tinta-2">Cada escadinha é uma disputa. Degraus subindo: quem declarou mais bens se elegeu mais. Toque para abrir no cofrinho.</p>
            </div>
            {qp.data && <Resposta panorama={qp.data} />}
          </div>
          <div className="mt-10">
            {qp.data ? (
              <Escadas panorama={qp.data} ativo={ativo} aoAbrir={abrir} />
            ) : qp.error ? (
              <ErroCarga erro={qp.error} compacto />
            ) : (
              <div className="grid min-h-[240px] place-items-center"><Ciranda rotulo="Juntando as disputas..." tamanho={72} /></div>
            )}
          </div>
        </section>

        {/* 5. o que a conta não diz */}
        <section aria-labelledby="nao-diz" className="adiar mt-28">
          <h2 id="nao-diz" className="t-h1">O que a conta não diz</h2>
          <ul className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-3">
            {[
              { Icone: Receipt, titulo: 'É o que foi declarado', texto: 'Ninguém confere, e há erros de digitação.' },
              { Icone: ShoppingBagOpen, titulo: 'Sem bens não é pobreza', texto: dados ? `${pct(100 - dados.resumo.cobertura_pct, 0)} não declararam nada e ficam fora da fila.` : 'Quem não declarou nada fica fora da fila.' },
              { Icone: ArrowsLeftRight, titulo: 'Andar junto não é causar', texto: 'Mais bens costuma vir com mais carreira e campanha.' },
            ].map(({ Icone, titulo, texto }) => (
              <li key={titulo} className="lembrete flex items-start gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-selecao-claro text-selecao-tinta"><Icone size={26} weight="fill" aria-hidden /></span>
                <span>
                  <span className="block font-bold text-tinta">{titulo}</span>
                  <span className="mt-0.5 block text-[0.92rem] leading-snug text-tinta-2">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-linha pt-4 text-[0.88rem]">
            <Link to="/metodologia" hash="m-patrimonio" className="inline-flex items-center gap-1.5 font-semibold text-acao hover:underline">
              Como a conta é feita <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
            <a href={TSE_BENS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-acao hover:underline">
              Bens de cada candidato no TSE <ArrowSquareOut size={14} weight="bold" aria-hidden />
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
