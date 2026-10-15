import { Shuffle, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { consultas, filtrando, LIMITE_BUSCA, ORDENS_BUSCA, politicoAleatorio, type FiltrosBusca, type OrdemBusca, type PoliticoBusca } from '../api'
import { Escolha } from '../componentes/Escolha'
import { Retrato } from '../componentes/Retrato'
import { inteiro, nomeProprio, plural } from '../lib/formato'
import { alternarSom, somLigado, tocarConfirma, tocarCorrige, tocarTecla } from './som'
import { Urna, type IdTecla } from './Urna'
import { FiltroCandidatura } from './FiltroCandidatura'
import { desenharVisor, filtroNoVisor, VISOR } from './visor'

// o visor da urna tem 6 linhas; o "mais" traz 6 de cada vez
const POR_PAGINA = 6

function useAtrasado<T>(valor: T, ms = 220) {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const id = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(id)
  }, [valor, ms])
  return v
}

export function UrnaPagina() {
  const id = useId()
  const navegar = useNavigate()
  const campo = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [selecionado, setSelecionado] = useState(0)
  const [fim, setFim] = useState(false)
  const [cursor, setCursor] = useState(true)
  const [som, setSom] = useState(somLigado)
  const [pulsos, setPulsos] = useState<Partial<Record<IdTecla, number>>>({})
  const [versao, setVersao] = useState(0)
  const [foto, setFoto] = useState<HTMLImageElement | null>(null)
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: VISOR.largura, height: VISOR.altura }), [])

  // a ordem mora no endereço junto dos filtros, mas não é filtro (não dispara busca sem nome)
  const endereco = useSearch({ from: '/urna' })
  const ordem = endereco.ordem ?? 'relevancia'
  // objeto estável: os efeitos do visor dependem de `filtros`
  const filtros = useMemo(() => {
    const { ordem: _, ...f } = endereco
    return f
  }, [endereco])
  const comFiltro = filtrando(filtros)
  const navegarBusca = (f: FiltrosBusca, o: OrdemBusca) => {
    setSelecionado(0)
    void navegar({ to: '/urna', search: { ...f, ordem: o === 'relevancia' ? undefined : o }, replace: true, resetScroll: false })
  }
  const mudarFiltros = (f: FiltrosBusca) => navegarBusca(f, ordem)
  const q = useAtrasado(texto.trim())
  // "mais" pede a mesma busca com 6 a mais (a API não tem deslocamento, só limite); volta a 6 quando a busca muda
  const chave = `${q}|${JSON.stringify(filtros)}|${ordem}`
  const [pedido, setPedido] = useState({ chave, quantos: POR_PAGINA })
  const quantos = pedido.chave === chave ? pedido.quantos : POR_PAGINA
  const busca = useQuery({ ...consultas.buscaPoliticos(q, filtros, quantos, ordem), placeholderData: (anterior) => anterior })
  // a API não garante a ordem entre empates: quem já estava na lista fica onde estava e os novos entram no fim
  const fixos = useRef({ chave: '', pos: new Map<number, number>() })
  const lista = useMemo(() => {
    const dados = busca.data ?? []
    if (busca.isPlaceholderData) return dados
    if (fixos.current.chave !== chave) fixos.current = { chave, pos: new Map() }
    const pos = fixos.current.pos
    const vistos = dados.filter((r) => pos.has(r.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!)
    const fila = [...vistos, ...dados.filter((r) => !pos.has(r.id))]
    fila.forEach((r, i) => pos.has(r.id) || pos.set(r.id, i))
    return fila
  }, [busca.data, busca.isPlaceholderData, chave])
  const resultados: PoliticoBusca[] = q.length >= 3 || comFiltro ? lista : []
  const escolhido = resultados[Math.min(selecionado, resultados.length - 1)]
  // o visor mostra 6 por vez: a página em que está o selecionado
  const inicio = Math.floor(Math.max(0, Math.min(selecionado, resultados.length - 1)) / POR_PAGINA) * POR_PAGINA
  const pagina = resultados.slice(inicio, inicio + POR_PAGINA)
  const podeMais = !busca.isPlaceholderData && resultados.length === quantos && quantos < LIMITE_BUSCA
  const noTeto = !busca.isPlaceholderData && resultados.length >= LIMITE_BUSCA
  const maisSeis = () => {
    setPedido({ chave, quantos: Math.min(quantos + POR_PAGINA, LIMITE_BUSCA) })
    setSelecionado(resultados.length) // o visor vai para os novos assim que chegarem
  }

  useEffect(() => {
    document.title = 'Urna de consulta · Voto Aberto'
    campo.current?.focus({ preventScroll: true })
    const piscar = setInterval(() => setCursor((c) => !c), 530)
    return () => clearInterval(piscar)
  }, [])

  // foto do selecionado no visor, como na urna
  useEffect(() => {
    setFoto(null)
    if (!escolhido?.foto) return
    const img = new Image()
    img.onload = () => setFoto(img)
    img.src = escolhido.foto
  }, [escolhido?.foto])

  // redesenha o visor a cada mudança (e quando as fontes terminam de carregar)
  useEffect(() => {
    desenharVisor(canvas, { texto, resultados: pagina, selecionado: Math.max(0, Math.min(selecionado, resultados.length - 1)) - inicio, inicio, buscando: busca.isFetching, fim, cursor, filtro: filtroNoVisor(filtros) }, foto)
    setVersao((v) => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, texto, busca.data, busca.isFetching, selecionado, fim, cursor, foto, q, filtros])
  useEffect(() => {
    void document.fonts.ready.then(() => setCursor((c) => c))
  }, [])

  const pulsar = (t: IdTecla) => setPulsos((p) => ({ ...p, [t]: (p[t] ?? 0) + 1 }))

  const confirmar = useCallback(() => {
    if (!escolhido || fim) return
    tocarConfirma()
    setFim(true)
    const espera = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 1500
    setTimeout(() => navegar({ to: '/politico/$id', params: { id: String(escolhido.id) } }), espera)
  }, [escolhido, fim, navegar])

  const apertar = useCallback(
    async (t: IdTecla) => {
      if (fim) return
      pulsar(t)
      if (t === 'confirma') return confirmar()
      if (t === 'corrige') tocarCorrige()
      else tocarTecla()
      if (t === 'corrige') {
        setTexto('')
        setSelecionado(0)
      } else if (t === 'branco') {
        const p = await politicoAleatorio().catch(() => null)
        if (p) {
          setTexto(nomeProprio(p.nome))
          setSelecionado(0)
        }
      } else {
        // as teclas 1 a 6 escolhem entre os 6 que estão no visor
        const n = inicio + Number(t) - 1
        if (Number(t) >= 1 && n < resultados.length) setSelecionado(n)
      }
      campo.current?.focus({ preventScroll: true })
    },
    [confirmar, fim, inicio, resultados.length],
  )

  const aoApertar = useCallback((t: IdTecla) => void apertar(t), [apertar])

  const teclado = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void apertar('confirma')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      void apertar('corrige')
    } else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      void apertar(e.key as IdTecla)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setSelecionado((s) => Math.max(0, Math.min(resultados.length - 1, s + (e.key === 'ArrowDown' ? 1 : -1))))
    }
  }

  return (
    <div className="mx-auto grid max-w-[var(--casca-max)] gap-10 px-4 pt-6 md:px-[var(--casca-margem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
      <div className="mx-auto w-full lg:sticky lg:top-[84px] lg:max-w-[calc((100dvh-136px)*1.27)]">
        <Urna canvas={canvas} versao={versao} pulsos={pulsos} aoApertar={aoApertar} />
      </div>

      <div className="space-y-6 pb-10">
        <header className="space-y-4">
          <h1 className="t-display">Consulte a carreira de um político</h1>
          <p className="max-w-[48ch] text-[1.05rem] leading-relaxed text-tinta-2">
            Digite o nome no visor da urna. CONFIRMA abre todas as candidaturas e mandatos, de 1994 a 2024.
          </p>
        </header>

        <div>
          <label htmlFor={`${id}-nome`} className="t-rotulo mb-2 block">Nome do político</label>
          <input
            ref={campo}
            id={`${id}-nome`}
            role="combobox"
            aria-expanded={resultados.length > 0}
            aria-controls={`${id}-lista`}
            aria-activedescendant={escolhido ? `${id}-${escolhido.id}` : undefined}
            aria-describedby={`${id}-dica`}
            autoComplete="off"
            spellCheck={false}
            value={texto}
            disabled={fim}
            onChange={(e) => {
              setTexto(e.target.value.replace(/[0-9]/g, ''))
              setSelecionado(0)
            }}
            onKeyDown={teclado}
            placeholder="Ex.: Wellington Dias"
            className="h-[52px] w-full rounded-full border-[1.5px] border-tinta bg-folha px-5 text-base outline-none placeholder:text-tinta-3 focus-visible:outline-[3px] focus-visible:outline-acao"
          />
          <p id={`${id}-dica`} className="mt-2 text-[0.85rem] text-tinta-3">
            O campo e o visor são o mesmo. A busca ignora acentos e usa o nome civil registrado no TSE; com filtros, o nome é opcional.
          </p>
        </div>

        <FiltroCandidatura filtros={filtros} aoMudar={mudarFiltros} />
        <div className="flex flex-wrap items-center gap-2">
          <span id={`${id}-ordem`} className="t-rotulo mr-1 text-tinta-2">Ordenar por</span>
          <div role="radiogroup" aria-labelledby={`${id}-ordem`} className="flex flex-wrap gap-2">
            {ORDENS_BUSCA.map((o) => (
              <Escolha key={o.valor} ativo={o.valor === ordem} aoClicar={() => navegarBusca(filtros, o.valor)}>{o.rotulo}</Escolha>
            ))}
          </div>
        </div>
        {comFiltro && q.length < 3 && resultados.length > 0 && ordem === 'relevancia' && (
          <p className="text-[0.85rem] text-tinta-3">Sem nome digitado: primeiro quem mais se elegeu nessas candidaturas.</p>
        )}

        <ul id={`${id}-lista`} role="listbox" aria-label="Políticos encontrados" className="space-y-1.5">
          {resultados.map((r, i) => (
            <li
              key={r.id}
              id={`${id}-${r.id}`}
              role="option"
              aria-selected={i === selecionado}
              onClick={() => {
                setSelecionado(i)
                if (i >= inicio && i < inicio + POR_PAGINA) pulsar(String(i - inicio + 1) as IdTecla)
              }}
              onDoubleClick={confirmar}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 transition-colors ${i === selecionado ? 'border-tinta bg-folha' : 'border-transparent hover:bg-folha/70'}`}
            >
              <span className="w-4 text-center text-[0.85rem] font-bold tabular text-tinta-3">{i + 1}</span>
              <Retrato foto={r.foto} nome={r.nome} tamanho={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{nomeProprio(r.nome)}</span>
                <span className="block text-[0.78rem] text-tinta-3 tabular">
                  {r.ufs.join(' ') || 'BR'} · {r.primeiro_ano}-{r.ultimo_ano} · {plural(r.candidaturas, 'eleição', 'eleições')} · {plural(r.vitorias, 'vitória', 'vitórias')}
                </span>
              </span>
            </li>
          ))}
          {(q.length >= 3 || comFiltro) && !busca.isFetching && resultados.length === 0 && (
            <li className="px-3 text-tinta-2">
              {q.length < 3
                ? 'Nenhuma candidatura bate com esses filtros. Afrouxe uma lacuna ou limpe os filtros.'
                : `Nenhum político encontrado para “${q}”${comFiltro ? ' com esses filtros. Afrouxe uma lacuna ou limpe os filtros.' : '.'}`}
            </li>
          )}
        </ul>
        {resultados.length > 0 && (podeMais || noTeto || quantos > POR_PAGINA || busca.isPlaceholderData) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-3" aria-live="polite">
            <span className="text-[0.85rem] text-tinta-3 tabular">
              {busca.isPlaceholderData
                ? 'Procurando mais...'
                : noTeto
                  ? `Mostrando os ${inteiro(LIMITE_BUSCA)} primeiros. Para achar os outros, digite o nome ou use mais filtros.`
                  : podeMais
                    ? `Mostrando ${inteiro(resultados.length)}.`
                    : `Todos os ${inteiro(resultados.length)} encontrados.`}
            </span>
            {podeMais && (
              <button
                type="button"
                onClick={maisSeis}
                className="inline-flex h-9 items-center rounded-full border-[1.5px] border-linha-2 bg-folha px-4 text-[0.85rem] font-semibold text-tinta transition hover:border-tinta active:translate-y-px"
              >
                Mais {Math.min(POR_PAGINA, LIMITE_BUSCA - quantos)}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-linha pt-5">
          <button type="button" onClick={() => void apertar('confirma')} disabled={!escolhido || fim} className="h-11 rounded-full bg-confirma px-6 font-bold tracking-wide text-white shadow-[var(--shadow-cartao)] transition active:translate-y-[2px] disabled:opacity-40">
            CONFIRMA
          </button>
          <button type="button" onClick={() => void apertar('corrige')} className="h-11 rounded-full bg-corrige px-5 font-bold tracking-wide text-tinta shadow-[var(--shadow-cartao)] transition active:translate-y-[2px]">
            CORRIGE
          </button>
          <button type="button" onClick={() => void apertar('branco')} className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-linha-2 bg-branco-urna px-5 font-bold tracking-wide text-tinta transition hover:border-tinta active:translate-y-[2px]">
            <Shuffle size={16} weight="bold" aria-hidden /> BRANCO sorteia
          </button>
          <button type="button" onClick={() => setSom(alternarSom())} aria-pressed={som} className="ml-auto inline-flex h-11 items-center gap-2 rounded-full px-3 text-[0.85rem] font-semibold text-tinta-2 hover:bg-folha" aria-label={som ? 'Desligar o som da urna' : 'Ligar o som da urna'}>
            {som ? <SpeakerHigh size={18} aria-hidden /> : <SpeakerSlash size={18} aria-hidden />} Som
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.88rem] text-tinta-2">
          {[['Enter', 'CONFIRMA'], ['Esc', 'CORRIGE'], ['1 a 6', 'escolher entre os 6 do visor'], ['↑ ↓', 'mover na lista (o visor acompanha)']].map(([k, d]) => (
            <div key={k} className="contents">
              <dt><kbd className="t-mono inline-block min-w-[52px] rounded-md border border-linha-2 bg-folha px-2 py-0.5 text-center text-[0.8rem] text-tinta">{k}</kbd></dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
