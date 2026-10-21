// Um contexto de áudio para o site inteiro (a urna, o cofrinho, o bafo). Abrir o primeiro da sessão custa ~100-230 ms
// (o dispositivo de som do sistema), e cada página abria o seu no primeiro clique: a primeira tecla da urna, a
// primeira martelada e o primeiro bafo travavam justo a animação que começavam. Agora ele é aberto uma vez, num momento
// parado (lib/parado.ts), e fica suspenso até o primeiro som. Se a pessoa ainda não tocou na página, o navegador o
// cria suspenso (e avisa no console que ele só toca depois de um gesto): é o que se quer, ele é retomado no clique.
import { quandoParado } from './parado'

let contexto: AudioContext | null = null
const cria = () => {
  contexto ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  return contexto
}

/** O contexto pronto para tocar (chamado num gesto: clique, tecla). */
export function audio() {
  const c = cria()
  if (c.state === 'suspended') void c.resume()
  return c
}

let agendado = false
const depois: ((c: AudioContext) => void)[] = []
/** Abre o contexto de antemão, suspenso; `f` roda com ele aberto (ex.: decodificar os arquivos de som). */
export function preparaAudio(f?: (c: AudioContext) => void) {
  if (contexto) return void f?.(contexto)
  if (f) depois.push(f)
  if (agendado) return
  agendado = true
  quandoParado(() => {
    try {
      const c = cria()
      if (c.state === 'running') void c.suspend()
      depois.splice(0).forEach((g) => g(c))
    } catch { /* sem áudio */ }
  })
}
