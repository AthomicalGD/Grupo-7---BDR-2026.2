// O filtro de cargo do atlas (#10), dentro da cédula de anos: uma casa a mais, "Cargo: Todos", que abre uma
// cédula de cargos logo abaixo. Cada cargo é uma casa que se marca com X, como os anos; os cargos vêm em dois
// grupos (eleições gerais e municipais), com os anos em que foram disputados. Escolher um cargo recalcula o
// viés do mapa, do estado e do município só com os votos dele. Fecha com Esc, clique fora ou ao escolher.
import { CaretDown, X } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { CargoVies } from '../api'

/** A casa da cédula: quadrado com contorno em tinta que se marca com um X em dois traços. */
function Casa({ marcada }: { marcada: boolean }) {
  return (
    <span className="relative grid size-[20px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-tinta bg-folha" aria-hidden>
      <svg viewBox="0 0 22 22" className="absolute inset-0">
        {marcada && (
          <>
            <motion.path d="M5 5 L17 17" stroke="var(--color-tinta)" strokeWidth={2.6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.16, ease: 'easeOut' }} />
            <motion.path d="M17 5 L5 17" stroke="var(--color-tinta)" strokeWidth={2.6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.16, delay: 0.12, ease: 'easeOut' }} />
          </>
        )}
      </svg>
    </span>
  )
}

export function SeletorCargo({ cargos, cargo, aoMudar }: { cargos: CargoVies[]; cargo: number | undefined; aoMudar: (c: number | undefined) => void }) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const escolhido = cargos.find((c) => c.cod === cargo)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAberto(false)
      raiz.current?.querySelector<HTMLButtonElement>('[data-gatilho]')?.focus()
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    // o foco vai para a opção marcada, para o teclado seguir dali
    raiz.current?.querySelector<HTMLButtonElement>('[role=radio][aria-checked=true]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const escolher = (c: number | undefined) => {
    aoMudar(c)
    setAberto(false)
    raiz.current?.querySelector<HTMLButtonElement>('[data-gatilho]')?.focus()
  }
  // setas percorrem as opções na ordem da cédula
  const teclado = (e: KeyboardEvent) => {
    const passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!passo) return
    e.preventDefault()
    const opcoes = Array.from(raiz.current?.querySelectorAll<HTMLButtonElement>('[role=radio]') ?? [])
    const i = opcoes.indexOf(document.activeElement as HTMLButtonElement)
    opcoes[(i + passo + opcoes.length) % opcoes.length]?.focus()
  }
  const grupos = [
    { titulo: 'Eleições gerais', anos: '2018 e 2022', lista: cargos.filter((c) => !c.municipal) },
    { titulo: 'Municipais', anos: '2020 e 2024', lista: cargos.filter((c) => c.municipal) },
  ]
  const opcao = (cod: number | undefined, nome: string, sub?: string) => {
    const marcada = cod === cargo
    return (
      <button
        key={cod ?? 'todos'}
        type="button"
        role="radio"
        aria-checked={marcada}
        tabIndex={marcada ? 0 : -1}
        onClick={() => escolher(cod)}
        className={`opcao-cargo flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${marcada ? 'bg-selecao-claro' : 'hover:bg-papel'}`}
      >
        <Casa marcada={marcada} />
        <span className="min-w-0 leading-tight">
          <span className={`block text-[0.92rem] ${marcada ? 'font-bold text-selecao-tinta' : 'font-semibold text-tinta'}`}>{nome}</span>
          {sub && <span className="block text-[0.74rem] text-tinta-3">{sub}</span>}
        </span>
      </button>
    )
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        data-gatilho
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Cargo: ${escolhido?.nome ?? 'todos os cargos'}. Trocar`}
        onClick={() => setAberto((a) => !a)}
        className={`gatilho-cargo flex h-full min-h-[46px] items-center gap-2.5 rounded-xl px-3 py-1.5 text-left transition-colors ${
          escolhido ? 'selecionado-fita' : 'hover:bg-papel'
        }`}
      >
        <span className="leading-tight">
          <span className={`block text-[0.74rem] ${escolhido ? 'text-white' : 'text-tinta-3'}`}>Cargo</span>
          <span className={`block whitespace-nowrap text-[1rem] ${escolhido ? 'font-bold' : 'font-semibold text-tinta-2'}`}>{escolhido?.nome ?? 'Todos'}</span>
        </span>
        <CaretDown size={15} weight="bold" aria-hidden className={`transition-transform duration-200 ${aberto ? 'rotate-180' : ''} ${escolhido ? 'text-white' : 'text-tinta-3'}`} />
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher o cargo"
          onKeyDown={teclado}
          className="cedula-cargos absolute right-0 top-full z-30 mt-2 w-[min(88vw,430px)] rounded-[20px] border border-linha bg-folha p-3 shadow-[var(--shadow-papel)]"
        >
          <p className="px-2.5 pb-2 pt-1 text-[0.8rem] text-tinta-3">Mostrar o viés só do voto para</p>
          <div role="radiogroup" aria-label="Cargo">
            {opcao(undefined, 'Todos os cargos', 'média dos cargos, com o mesmo peso')}
            <div className="mt-2 grid gap-x-2 gap-y-3 border-t border-dashed border-linha-2 pt-3 sm:grid-cols-2">
              {grupos.map((g) => (
                <div key={g.titulo}>
                  <p className="px-2.5 pb-1 text-[0.78rem] font-semibold leading-tight text-tinta-2">
                    {g.titulo}<span className="block font-normal text-tinta-3">{g.anos}</span>
                  </p>
                  {g.lista.map((c) => opcao(c.cod, c.nome))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** A pílula sobre o mapa quando há um cargo escolhido: diz o recorte e tira o filtro com um toque. */
export function PilulaCargo({ nome, aoTirar }: { nome: string; aoTirar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTirar}
      aria-label={`Mostrando só o voto para ${nome}. Voltar a todos os cargos`}
      className="pilula-cargo inline-flex h-9 items-center gap-2 rounded-full border border-selecao/40 bg-selecao-claro pl-3.5 pr-2 text-[0.84rem] font-semibold text-selecao-tinta shadow-[var(--shadow-cartao)] hover:border-selecao"
    >
      Só o voto para {nome.toLowerCase()}
      <span className="grid size-6 place-items-center rounded-full bg-selecao text-white"><X size={12} weight="bold" aria-hidden /></span>
    </button>
  )
}
