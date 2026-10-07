import { Shuffle, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { consultas, filtrando, politicoAleatorio, type FiltrosBusca, type PoliticoBusca } from '../api'
import { Retrato } from '../componentes/Retrato'
import { nomeProprio, plural } from '../lib/formato'
import { alternarSom, somLigado, tocarConfirma, tocarCorrige, tocarTecla } from './som'
import { Urna, type IdTecla } from './Urna'
import { FiltroCandidatura } from './FiltroCandidatura'
import { desenharVisor, filtroNoVisor, VISOR } from './visor'

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

  const filtros = useSearch({ from: '/urna' })
  const comFiltro = filtrando(filtros)
  const mudarFiltros = (f: FiltrosBusca) => {
    setSelecionado(0)
    void navegar({ to: '/urna', search: f, replace: true, resetScroll: false })
  }
  const q = useAtrasado(texto.trim())
  const busca = useQuery({ ...consultas.buscaPoliticos(q, filtros), placeholderData: (anterior) => anterior })
  const resultados: PoliticoBusca[] = q.length >= 3 || comFiltro ? (busca.data ?? []).slice(0, 6) : []
  const escolhido = resultados[Math.min(selecionado, resultados.length - 1)]

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
    desenharVisor(canvas, { texto, resultados, selecionado, buscando: busca.isFetching, fim, cursor, filtro: filtroNoVisor(filtros) }, foto)
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
        const n = Number(t) - 1
        if (n >= 0 && n < resultados.length) setSelecionado(n)
      }
      campo.current?.focus({ preventScroll: true })
    },
    [confirmar, fim, resultados.length],
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
    <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pt-8 md:px-[72px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
      <div className="lg:sticky lg:top-[112px]">
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
        {comFiltro && q.length < 3 && resultados.length > 0 && (
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
                pulsar(String(i + 1) as IdTecla)
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
          {[['Enter', 'CONFIRMA'], ['Esc', 'CORRIGE'], ['1 a 6', 'escolher na lista'], ['↑ ↓', 'mover na lista']].map(([k, d]) => (
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
