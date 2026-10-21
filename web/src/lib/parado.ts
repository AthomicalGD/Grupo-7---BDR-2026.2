// Trabalho que trava a página ~100 ms de uma vez e não dá para dividir (abrir o dispositivo de som do sistema, o
// primeiro desenho das mãos do bafo) roda só num momento parado de verdade: ninguém mexendo no mouse, na rolagem ou
// no teclado há 1,5 s, a aba à vista e o navegador ocioso. Antes, esse custo caía no clique que precisava dele, bem
// na animação que o clique começava.
const PARADO_MS = 1500
let mexeuEm = 0
const fila: { f: () => void; ocupado: () => boolean }[] = []
let espera = 0

if (typeof window !== 'undefined') {
  const mexeu = () => { mexeuEm = performance.now() }
  for (const t of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart']) window.addEventListener(t, mexeu, { capture: true, passive: true })
}

const ocioso = (f: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 300))

/** Roda `f` uma vez, no próximo momento parado em que `ocupado()` for falso (a cena que pediu não está animando). */
export function quandoParado(f: () => void, ocupado: () => boolean = () => false) {
  if (!fila.some((x) => x.f === f)) fila.push({ f, ocupado })
  agenda(PARADO_MS)
}

/** Tira um pedido da fila (quem pediu saiu da tela). */
export function desisteDe(f: () => void) {
  const i = fila.findIndex((x) => x.f === f)
  if (i >= 0) fila.splice(i, 1)
}

function agenda(atraso: number) {
  if (espera || !fila.length) return
  espera = window.setTimeout(() => {
    espera = 0
    const parado = performance.now() - mexeuEm
    if (document.hidden || parado < PARADO_MS || fila.every((x) => x.ocupado())) return agenda(Math.max(300, PARADO_MS - parado))
    ocioso(() => {
      const i = fila.findIndex((x) => !x.ocupado())
      // uma tarefa por vez, cada uma no seu momento ocioso
      if (i >= 0 && performance.now() - mexeuEm >= PARADO_MS) fila.splice(i, 1)[0].f()
      agenda(300)
    })
  }, atraso)
}
