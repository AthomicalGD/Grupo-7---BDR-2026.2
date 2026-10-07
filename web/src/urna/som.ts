// Sons da urna sintetizados (WebAudio, nada gravado), com os parâmetros medidos em gravações
// da urna real: tom senoidal puro (sem harmônicos), ~2.300 Hz nas teclas, e o "pi-li-li-li"
// do fim do voto como um trinado contínuo que alterna ~2.300 e ~2.200 Hz a cada ~100 ms.
// Só tocam depois de um gesto do usuário (política de autoplay) e respeitam o botão de som.
let contexto: AudioContext | null = null
let ligado = (() => {
  try {
    return localStorage.getItem('va-som') !== 'desligado'
  } catch {
    return true
  }
})()

const AGUDO = 2300 // Hz
const GRAVE = 2200 // Hz
const VOLUME = 0.11

export const somLigado = () => ligado
export function alternarSom() {
  ligado = !ligado
  try {
    localStorage.setItem('va-som', ligado ? 'ligado' : 'desligado')
  } catch {
    /* só nesta visita */
  }
  return ligado
}

function ctx() {
  contexto ??= new AudioContext()
  if (contexto.state === 'suspended') void contexto.resume()
  return contexto
}

/**
 * Toca uma sequência de trechos [frequência, duração em s] num único oscilador senoidal:
 * a troca de frequência é contínua em fase (sem estalo), como no trinado da urna.
 * Um trecho com frequência 0 é silêncio.
 */
function tocar(trechos: [number, number][], inicio = 0.01) {
  const c = ctx()
  const osc = c.createOscillator(), ganho = c.createGain()
  osc.type = 'sine'
  osc.connect(ganho).connect(c.destination)
  let t = c.currentTime + inicio
  ganho.gain.setValueAtTime(0, t)
  osc.frequency.setValueAtTime(trechos[0][0] || AGUDO, t)
  for (const [freq, dur] of trechos) {
    if (freq) {
      osc.frequency.setValueAtTime(freq, t)
      ganho.gain.setTargetAtTime(VOLUME, t, 0.0015) // ataque de ~4 ms
    } else {
      ganho.gain.setTargetAtTime(0, t, 0.002)
    }
    t += dur
  }
  ganho.gain.setTargetAtTime(0, t, 0.004) // soltura de ~12 ms
  osc.start(c.currentTime + inicio)
  osc.stop(t + 0.06)
}

/** Clique de tecla numérica: bipe curto de ~2.300 Hz. */
export function tocarTecla() {
  if (ligado) tocar([[AGUDO, 0.028]])
}

/** CORRIGE: dois bipes curtos. */
export function tocarCorrige() {
  if (ligado) tocar([[AGUDO, 0.026], [0, 0.18], [AGUDO, 0.022]])
}

/** CONFIRMA: o "pi-li" de abertura e o trinado do fim do voto (~1 s). */
export function tocarConfirma() {
  if (!ligado) return
  const trinado: [number, number][] = []
  for (let i = 0; i < 7; i++) trinado.push([i % 2 ? GRAVE : AGUDO, 0.1])
  tocar([[AGUDO, 0.09], [GRAVE, 0.11], [0, 0.025], ...trinado])
}
