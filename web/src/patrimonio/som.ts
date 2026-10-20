// Sons do cofrinho: gravações reais em domínio público (CC0; origem em public/sons/CREDITOS.txt). Os arquivos
// (~40 KB no total) são baixados quando a página abre e decodificados no primeiro toque, porque o navegador só
// libera o áudio depois de um gesto. Cada toque varia um pouco a velocidade (±6%) para nenhuma martelada soar
// igual à outra. Se um arquivo não carregar, entra o som sintetizado de antes. Respeita o botão de som da urna.
import { somLigado } from '../urna/som'

const ARQUIVOS = ['golpe1', 'golpe2', 'golpe3', 'chacoalho1', 'chacoalho2', 'quebra', 'moedas', 'tesoura', 'carimbo', 'tic'] as const
type Som = (typeof ARQUIVOS)[number]

let contexto: AudioContext | null = null
const brutos = new Map<Som, Promise<ArrayBuffer | null>>()
const prontos = new Map<Som, AudioBuffer>()

function ctx() {
  contexto ??= new AudioContext()
  if (contexto.state === 'suspended') void contexto.resume()
  return contexto
}

/** Baixa os arquivos (sem tocar nada): chamado quando a página do cofrinho abre. */
export function baixarSons() {
  for (const nome of ARQUIVOS) {
    if (!brutos.has(nome)) brutos.set(nome, fetch(`/sons/${nome}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null))
  }
}

/** Decodifica tudo no primeiro gesto; os toques seguintes já acham o áudio pronto. */
async function decodificar() {
  baixarSons()
  const c = ctx()
  await Promise.all(ARQUIVOS.map(async (nome) => {
    if (prontos.has(nome)) return
    const bruto = await brutos.get(nome)
    if (!bruto) return
    try {
      prontos.set(nome, await c.decodeAudioData(bruto.slice(0)))
    } catch {
      /* fica com o sintetizado */
    }
  }))
}

/** Toca um arquivo; devolve false se ele ainda não está pronto (para cair no sintetizado). */
function tocar(nome: Som, { atraso = 0, volume = 1, velocidade = 1 } = {}) {
  const buf = prontos.get(nome)
  if (!buf) return false
  const c = ctx()
  const fonte = c.createBufferSource()
  const ganho = c.createGain()
  fonte.buffer = buf
  fonte.playbackRate.value = velocidade * (0.94 + Math.random() * 0.12)
  ganho.gain.value = volume
  fonte.connect(ganho).connect(c.destination)
  fonte.start(c.currentTime + atraso)
  return true
}

// ── reserva sintetizada (quando o arquivo não veio) ──
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
  ganho.gain.value = volume
  fonte.connect(filtro).connect(ganho).connect(c.destination)
  fonte.start(t)
}

function plim(c: AudioContext, t: number, freq: number, volume: number) {
  const osc = c.createOscillator()
  const ganho = c.createGain()
  osc.frequency.value = freq
  ganho.gain.setValueAtTime(0, t)
  ganho.gain.linearRampToValueAtTime(volume, t + 0.003)
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
  osc.connect(ganho).connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.3)
}

/** Cada martelada: a louça batida (mais forte a cada vez) e as moedas chacoalhando dentro do cofrinho. */
export function tocarGolpe(vez: number) {
  if (!somLigado()) return
  void decodificar().then(() => {
    const nome = (['golpe1', 'golpe2', 'golpe3'] as const)[Math.min(2, Math.max(0, vez - 1))]
    if (!tocar(nome, { volume: 0.7 + vez * 0.1 })) estalo(ctx(), ctx().currentTime, 0.2 + vez * 0.1)
    tocar(vez % 2 ? 'chacoalho1' : 'chacoalho2', { atraso: 0.03, volume: 0.55 + vez * 0.08 })
  })
}

/** O cofrinho estilhaça com as moedas caindo (montagem de cerâmica e moedas) e, depois, as moedas pousam na fila. */
export function tocarQuebra() {
  if (!somLigado()) return
  void decodificar().then(() => {
    const quebrou = tocar('quebra', { atraso: 0.3, volume: 1 })
    const moedas = tocar('moedas', { atraso: 1.2, volume: 0.35 })
    if (!quebrou) estalo(ctx(), ctx().currentTime + 0.3, 0.5)
    if (!moedas) for (let i = 0; i < 6; i++) plim(ctx(), ctx().currentTime + 0.5 + i * 0.07, 2800 + Math.random() * 1200, 0.04)
  })
}

/** A tesoura fecha num corte. */
export function tocarCorte() {
  if (!somLigado()) return
  void decodificar().then(() => {
    if (!tocar('tesoura', { volume: 0.8 })) estalo(ctx(), ctx().currentTime, 0.12)
  })
}

/** O carimbo bate no papel. */
export function tocarCarimbo() {
  if (!somLigado()) return
  void decodificar().then(() => {
    if (!tocar('carimbo', { volume: 1 })) estalo(ctx(), ctx().currentTime, 0.18)
  })
}

/** Os eleitos acendem: um "tic" por grupo, cada um um pouco mais agudo. */
export function tocarPilhas(grupos: number) {
  if (!somLigado()) return
  void decodificar().then(() => {
    for (let i = 0; i < grupos; i++) {
      if (!tocar('tic', { atraso: 0.35 + i * 0.14, volume: 0.6, velocidade: 1 + i * 0.08 })) plim(ctx(), ctx().currentTime + 0.35 + i * 0.14, 3200 + i * 180, 0.04)
    }
  })
}
