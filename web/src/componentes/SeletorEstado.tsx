// O recorte por estado das páginas de pergunta (Cadeira, Escola, Reeleição), igual ao da P2: um campo só,
// "Todos os 27" com a silhueta do Brasil (o rótulo é a legenda do fieldset da página), que abre o minimapa do Brasil numa gaveta logo abaixo. Escolher um estado fecha a
// gaveta; Esc e clique fora também. No campo, a silhueta do estado escolhido (ou do Brasil) e o nome.
import { CaretDown } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Malha, UF } from '../api'
import { silhueta, silhuetaBrasil } from '../atlas/geo'
import { MapaEstados } from './MapaEstados'

export function SeletorEstado({ malha, ufs, escolhida, aoEscolher, obrigatorio = false, rotulo = 'Estado' }: {
  malha: Malha | undefined
  /** os estados carregados */
  ufs: UF[]
  escolhida: string
  aoEscolher: (sigla: string | undefined) => void
  /** sempre há um estado (sem "Todos"), como na câmara de vereadores */
  obrigatorio?: boolean
  rotulo?: string
}) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const uf = ufs.find((u) => u.sigla === escolhida)
  const desenho = useMemo(() => {
    if (!malha) return ''
    if (uf) return silhueta(malha, uf.cd_ibge, 26)
    return silhuetaBrasil(malha, 26) // sem estado escolhido, o Brasil inteiro
  }, [malha, uf])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAberto(false)
      raiz.current?.querySelector<HTMLButtonElement>('[data-gatilho]')?.focus()
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    // o foco vai para o estado marcado, para o teclado seguir dali; sem estado, para a gaveta (focar o
    // primeiro estado o mostraria como se estivesse escolhido)
    const marcado = raiz.current?.querySelector<SVGGElement>('[role=radio][aria-checked=true]')
    ;(marcado ?? raiz.current?.querySelector<HTMLDivElement>('[role=dialog]'))?.focus()
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        data-gatilho
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`${rotulo}: ${uf?.nome ?? `todos os ${ufs.length} estados`}. Trocar`}
        onClick={() => setAberto((a) => !a)}
        className={`campo-estado flex h-12 w-full max-w-[320px] items-center gap-3 rounded-xl border bg-folha pl-2.5 pr-3.5 text-left ${aberto ? 'border-tinta' : 'border-linha hover:border-linha-2'}`}
      >
        <svg viewBox="0 0 26 26" className="size-[26px] shrink-0 overflow-visible" aria-hidden>
          <path d={desenho} fill={uf ? 'var(--color-selecao)' : '#a9c26a'} />
        </svg>
        <span className="min-w-0 flex-1 truncate text-[0.98rem] font-semibold text-tinta">{uf?.nome ?? `Todos os ${ufs.length} estados`}</span>
        <CaretDown size={15} weight="bold" aria-hidden className={`shrink-0 text-tinta-3 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div
          role="dialog"
          tabIndex={-1}
          aria-label={`Escolher o ${rotulo.toLowerCase()}`}
          className="gaveta absolute left-0 top-full z-30 outline-none mt-2 w-[min(calc(100vw-2rem),400px)] rounded-[20px] border border-linha bg-folha p-5 shadow-[var(--shadow-papel)]"
        >
          <MapaEstados
            malha={malha}
            ufs={ufs}
            escolhida={escolhida}
            obrigatorio={obrigatorio}
            aoEscolher={(s) => {
              aoEscolher(s)
              setAberto(false)
              raiz.current?.querySelector<HTMLButtonElement>('[data-gatilho]')?.focus()
            }}
          />
        </div>
      )}
    </div>
  )
}
