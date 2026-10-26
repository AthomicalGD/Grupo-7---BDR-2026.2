// "Ouvir o gráfico": a série vira uma sequência de notas, da esquerda para a direita (o som também anda de um
// fone para o outro). Mais alto no gráfico, nota mais aguda; ponto sem dado vira um estalo grave. Ao mesmo
// tempo o valor de cada ponto é lido pelo leitor de tela. Para quem não vê o gráfico, e para quem quer ouvir a forma.
import { SpeakerHigh, Stop } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { audio } from '../lib/audio'

export interface PontoSom {
  rotulo: string
  valor: number | null
  /** o valor escrito, como no gráfico ("+12,4", "48%") */
  texto: string
}

const NOTA = 0.32 // segundos por ponto

export function Ouvir({ pontos, min, max, nome }: { pontos: PontoSom[]; min: number; max: number; nome: string }) {
  const [tocando, setTocando] = useState(-1)
  const parar = useRef<() => void>(() => {})
  useEffect(() => () => parar.current(), [])

  const tocar = () => {
    if (tocando >= 0) return parar.current()
    const c = audio()
    const t0 = c.currentTime + 0.05
    const fontes: AudioScheduledSourceNode[] = []
    pontos.forEach((p, i) => {
      const t = t0 + i * NOTA
      const ganho = c.createGain()
      const pan = c.createStereoPanner()
      pan.pan.value = pontos.length > 1 ? -0.8 + (1.6 * i) / (pontos.length - 1) : 0
      ganho.connect(pan).connect(c.destination)
      const osc = c.createOscillator()
      if (p.valor == null) {
        osc.type = 'square'
        osc.frequency.value = 110
        ganho.gain.setValueAtTime(0.0001, t)
        ganho.gain.exponentialRampToValueAtTime(0.05, t + 0.01)
        ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      } else {
        // duas oitavas, de 220 Hz (o mínimo) a 880 Hz (o máximo)
        const f = Math.max(0, Math.min(1, (p.valor - min) / (max - min || 1)))
        osc.type = 'triangle'
        osc.frequency.value = 220 * 2 ** (2 * f)
        ganho.gain.setValueAtTime(0.0001, t)
        ganho.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
        ganho.gain.exponentialRampToValueAtTime(0.0001, t + NOTA * 0.9)
      }
      osc.connect(ganho)
      osc.start(t)
      osc.stop(t + NOTA)
      fontes.push(osc)
    })
    const timers = pontos.map((_, i) => setTimeout(() => setTocando(i), 50 + i * NOTA * 1000))
    const fim = setTimeout(() => setTocando(-1), 80 + pontos.length * NOTA * 1000)
    parar.current = () => {
      fontes.forEach((f) => {
        try {
          f.stop()
        } catch {
          /* já parou */
        }
      })
      timers.forEach(clearTimeout)
      clearTimeout(fim)
      setTocando(-1)
      parar.current = () => {}
    }
    setTocando(0)
  }

  const atual = tocando >= 0 ? pontos[tocando] : null
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={tocar}
        aria-pressed={tocando >= 0}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-[0.82rem] font-semibold text-acao hover:bg-papel"
      >
        {tocando >= 0 ? <Stop size={15} weight="fill" aria-hidden /> : <SpeakerHigh size={15} aria-hidden />}
        {tocando >= 0 ? 'Parar' : 'Ouvir o gráfico'}
      </button>
      {atual && <span className="text-[0.82rem] text-tinta-2 tabular" aria-hidden>{atual.rotulo}: {atual.texto}</span>}
      <span className="sr-only" aria-live="polite">{atual ? `${atual.rotulo}: ${atual.texto}` : ''}</span>
      <span className="sr-only">{`Som de ${nome}: nota mais aguda é valor mais alto; estalo grave é ponto sem dado.`}</span>
    </span>
  )
}
