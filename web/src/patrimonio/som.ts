// Sons do cofrinho sintetizados (WebAudio, nada gravado): o estalo da cerâmica é um ruído curto
// filtrado, e as moedas são tons metálicos (duas senoides desafinadas, como o "plim" de uma moeda),
// que decaem rápido. Só tocam depois de um clique e respeitam o mesmo botão de som da urna.
import { somLigado } from '../urna/som'

let contexto: AudioContext | null = null
function ctx() {
  contexto ??= new AudioContext()
  if (contexto.state === 'suspended') void contexto.resume()
  return contexto
}

function estalo(c: AudioContext, t: number, volume: number) {
  const dur = 0.22
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < dados.length; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / dados.length) ** 3
  const fonte = c.createBufferSource()
  const filtro = c.createBiquadFilter()
  const ganho = c.createGain()
  fonte.buffer = buffer
  filtro.type = 'bandpass'
  filtro.frequency.value = 2400
  filtro.Q.value = 0.8
  ganho.gain.value = volume
  fonte.connect(filtro).connect(ganho).connect(c.destination)
  fonte.start(t)
}

function plim(c: AudioContext, t: number, freq: number, volume: number) {
  for (const [f, v] of [[freq, volume], [freq * 2.76, volume * 0.35]] as const) {
    const osc = c.createOscillator()
    const ganho = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = f
    ganho.gain.setValueAtTime(0, t)
    ganho.gain.linearRampToValueAtTime(v, t + 0.003)
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    osc.connect(ganho).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  }
}

/** A cerâmica quebra e as moedas se espalham. */
export function tocarQuebra() {
  if (!somLigado()) return
  const c = ctx()
  const t = c.currentTime + 0.32 // depois do chacoalhar
  estalo(c, t, 0.5)
  for (let i = 0; i < 9; i++) plim(c, t + 0.12 + i * 0.07 + Math.random() * 0.03, 2600 + Math.random() * 1500, 0.05)
}

/** As moedas dos eleitos se empilham: um "tic" por coluna. */
export function tocarPilhas(colunas: number) {
  if (!somLigado()) return
  const c = ctx()
  for (let i = 0; i < colunas; i++) plim(c, c.currentTime + 0.05 + i * 0.12, 3200 + i * 180, 0.045)
}
