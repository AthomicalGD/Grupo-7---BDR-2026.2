// O tour da primeira visita: um holofote passa por cada módulo do menu e diz, numa frase, que pergunta ele
// responde. Abre sozinho uma vez (guardado neste navegador) e volta pelo botão "Tour" da barra de cima.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

const PASSOS: { alvo: string; titulo: string; texto: string }[] = [
  { alvo: 'nav a[href="/"]', titulo: 'Mapa', texto: 'Para onde o voto pendeu em cada estado e município, de 2018 a 2026. Toque num estado para descer aos municípios.' },
  { alvo: 'nav a[href="/urna"]', titulo: 'Urna', texto: 'Digite o nome de qualquer político, como na urna, e veja a carreira inteira em santinhos.' },
  { alvo: 'nav a[href="/cadeira"]', titulo: 'Cadeira', texto: 'Quanto custa, em média, a campanha de quem se elege, e quem gastou e não levou.' },
  { alvo: 'nav a[href="/escola"]', titulo: 'Escola', texto: 'O diploma ajuda a se eleger? E onde se estudou menos, se elege menos diploma?' },
  { alvo: 'nav a[href="/patrimonio"]', titulo: 'Patrimônio', texto: 'Quem declara mais bens se elege mais? Quebre o cofrinho, ou pule direto para a resposta.' },
  { alvo: 'nav a[href="/reeleicao"]', titulo: 'Reeleição', texto: 'Dos eleitos que tentaram de novo, quantos voltaram.' },
  { alvo: '[data-tour="leitura"]', titulo: 'Do seu jeito', texto: 'Alto contraste, letra maior, margens e o modo sala de aula, para projetar numa aula.' },
]
const CHAVE = 'va-tour'

export function useTour() {
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    let visto = '1'
    try {
      visto = localStorage.getItem(CHAVE) ?? ''
    } catch {
      /* sem armazenamento: não abre sozinho */
    }
    // sem atrapalhar quem chegou por um link de dentro (com âncora) ou num teste automatizado
    if (visto || location.hash || navigator.webdriver) return
    const t = setTimeout(() => setAberto(true), 1400)
    return () => clearTimeout(t)
  }, [])
  const fechar = useCallback(() => {
    setAberto(false)
    try {
      localStorage.setItem(CHAVE, '1')
    } catch {
      /* vale só nesta visita */
    }
  }, [])
  return { aberto, abrir: () => setAberto(true), fechar }
}

export function Tour({ aoFechar }: { aoFechar: () => void }) {
  const [i, setI] = useState(0)
  const [caixa, setCaixa] = useState<DOMRect | null>(null)
  const cartao = useRef<HTMLDivElement>(null)
  const id = useId()
  const passo = PASSOS[i]

  useLayoutEffect(() => {
    const medir = () => setCaixa(document.querySelector(passo.alvo)?.getBoundingClientRect() ?? null)
    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, { passive: true })
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir)
    }
  }, [passo.alvo])
  useEffect(() => cartao.current?.focus(), [i])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
      if (e.key === 'ArrowRight') setI((n) => Math.min(PASSOS.length - 1, n + 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  const ultimo = i === PASSOS.length - 1
  const larg = 320
  const left = caixa ? Math.max(12, Math.min(window.innerWidth - larg - 12, caixa.left + caixa.width / 2 - larg / 2)) : 12
  const top = caixa ? caixa.bottom + 14 : 80
  return (
    <div className="fixed inset-0 z-[60]" onClick={aoFechar}>
      {/* o holofote: um furo no véu escuro em volta do item */}
      {caixa && (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-full transition-all duration-300 ease-[var(--ease-saida)] motion-reduce:transition-none"
          style={{ left: caixa.left - 6, top: caixa.top - 4, width: caixa.width + 12, height: caixa.height + 8, boxShadow: '0 0 0 9999px rgb(24 32 43 / 0.5)', outline: '3px solid var(--color-marcador)' }}
        />
      )}
      <div
        ref={cartao}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="fixed rounded-2xl border border-linha bg-folha p-5 shadow-[var(--shadow-papel)] outline-none transition-[left,top] duration-300 ease-[var(--ease-saida)] motion-reduce:transition-none"
        style={{ left, top, width: larg }}
      >
        <p className="text-[0.8rem] font-semibold text-tinta-3 tabular">{i + 1} de {PASSOS.length}</p>
        <h2 id={`${id}-t`} className="t-h3 mt-1">{passo.titulo}</h2>
        <p id={`${id}-d`} className="mt-1.5 text-[0.95rem] leading-snug text-tinta-2">{passo.texto}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={aoFechar} className="text-[0.88rem] font-semibold text-tinta-3 hover:text-tinta">
            {ultimo ? 'Fechar' : 'Pular o tour'}
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="rounded-full border border-linha px-4 py-2 text-[0.88rem] font-semibold hover:border-tinta">
                Voltar
              </button>
            )}
            <button type="button" onClick={() => (ultimo ? aoFechar() : setI(i + 1))} className="botao-vivo px-4 py-2 text-[0.88rem]">
              {ultimo ? 'Começar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
