// Sons da urna sintetizados (WebAudio, nada gravado): clique de tecla e o bipe de confirmação.
// Só tocam depois de um gesto do usuário (política de autoplay) e respeitam o botão de som.
let contexto: AudioContext | null = null
let ligado = (() => {
  try {
    return localStorage.getItem('va-som') !== 'desligado'
  } catch {
    return true
  }
})()

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

function bipe(c: AudioContext, inicio: number, duracao: number, freq: number, volume: number) {
  const osc = c.createOscillator(), ganho = c.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  ganho.gain.setValueAtTime(0, inicio)
  ganho.gain.linearRampToValueAtTime(volume, inicio + 0.006)
  ganho.gain.setValueAtTime(volume, inicio + duracao - 0.012)
  ganho.gain.linearRampToValueAtTime(0, inicio + duracao)
  osc.connect(ganho).connect(c.destination)
  osc.start(inicio)
  osc.stop(inicio + duracao + 0.02)
}

export function tocarTecla() {
  if (!ligado) return
  const c = ctx()
  bipe(c, c.currentTime, 0.035, 880, 0.035)
}

/** Sequência curta e um bipe longo: o "confirmado" da urna. */
export function tocarConfirma() {
  if (!ligado) return
  const c = ctx()
  let t = c.currentTime + 0.02
  for (let i = 0; i < 5; i++) {
    bipe(c, t, 0.075, 1240, 0.05)
    t += 0.115
  }
  bipe(c, t + 0.02, 0.62, 1240, 0.05)
}
