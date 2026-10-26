// O cartão para compartilhar: uma imagem 1200×630 (o tamanho das prévias de link) com a pergunta, o número
// principal da tela e a fonte, desenhada no navegador. No celular abre o "Compartilhar" do sistema com a imagem;
// no computador, baixa o PNG. O endereço da tela vai junto: quem recebe abre o mesmo recorte.
import { ShareNetwork } from '@phosphor-icons/react'
import { useState } from 'react'

const FITAS = ['#5e881b', '#a2bd31', '#5d6b94', '#468baf', '#76acd0', '#f19929', '#fbc700']
const W = 1200, H = 630

export interface Cartao {
  /** a pergunta da página ("Quanto custa uma cadeira?") */
  pergunta: string
  /** o número grande ("R$ 2,0 mi") */
  numero: string
  /** o que o número é, numa frase curta */
  legenda: string
  /** o recorte: cargo, ano, lugar */
  recorte?: string
}

/** Quebra o texto em linhas que cabem na largura. */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const out: string[] = []
  let atual = ''
  for (const p of texto.split(' ')) {
    const teste = atual ? `${atual} ${p}` : p
    if (ctx.measureText(teste).width > largura && atual) {
      out.push(atual)
      atual = p
    } else atual = teste
  }
  if (atual) out.push(atual)
  return out
}

export async function desenhaCartao(c: Cartao): Promise<Blob> {
  await document.fonts.ready
  const tela = document.createElement('canvas')
  tela.width = W
  tela.height = H
  const ctx = tela.getContext('2d')!
  const fonte = getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'Archivo, sans-serif'
  ctx.fillStyle = '#f2f4f5'
  ctx.fillRect(0, 0, W, H)
  // a folha
  ctx.fillStyle = '#fcfdfd'
  ctx.beginPath()
  ctx.roundRect(48, 48, W - 96, H - 96, 28)
  ctx.fill()
  // as sete fitas da marca, em diagonal no canto
  FITAS.forEach((cor, i) => {
    ctx.strokeStyle = cor
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.moveTo(W - 330 + i * 16, H)
    ctx.lineTo(W, H - 330 + i * 16)
    ctx.stroke()
  })
  ctx.fillStyle = '#18202b'
  ctx.font = `800 30px ${fonte}`
  ctx.fillText('VOTO ABERTO', 96, 118)
  ctx.fillStyle = '#4b5566'
  ctx.font = `600 36px ${fonte}`
  let y = 196
  for (const l of linhas(ctx, c.pergunta, W - 260).slice(0, 2)) {
    ctx.fillText(l, 96, y)
    y += 46
  }
  ctx.fillStyle = '#18202b'
  let tamanho = 150
  ctx.font = `800 ${tamanho}px ${fonte}`
  while (ctx.measureText(c.numero).width > W - 260 && tamanho > 60) ctx.font = `800 ${(tamanho -= 6)}px ${fonte}`
  y += tamanho * 0.86
  ctx.fillText(c.numero, 92, y)
  ctx.fillStyle = '#4b5566'
  ctx.font = `500 32px ${fonte}`
  y += 56
  for (const l of linhas(ctx, c.legenda, W - 420).slice(0, 2)) {
    ctx.fillText(l, 96, y)
    y += 42
  }
  ctx.fillStyle = '#5f6878'
  ctx.font = `500 24px ${fonte}`
  ctx.fillText([c.recorte, 'Dados do TSE e do IBGE'].filter(Boolean).join(' · '), 96, H - 84)
  return new Promise((ok, erro) => tela.toBlob((b) => (b ? ok(b) : erro(new Error('Sem imagem'))), 'image/png'))
}

export function Compartilhar({ cartao, className = '' }: { cartao: Cartao; className?: string }) {
  const [estado, setEstado] = useState<'' | 'fazendo' | 'baixado'>('')
  const fazer = async () => {
    setEstado('fazendo')
    try {
      const blob = await desenhaCartao(cartao)
      const nome = `voto-aberto-${cartao.pergunta.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}.png`
      const arquivo = new File([blob], nome, { type: 'image/png' })
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: cartao.pergunta, text: `${cartao.numero}: ${cartao.legenda}`, url: location.href }).catch(() => {})
        setEstado('')
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nome
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setEstado('baixado')
      setTimeout(() => setEstado(''), 2200)
    } catch {
      setEstado('')
    }
  }
  return (
    <button
      type="button"
      onClick={fazer}
      disabled={estado === 'fazendo'}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border border-linha bg-folha px-4 text-[0.88rem] font-semibold text-tinta hover:border-tinta disabled:opacity-60 ${className}`}
    >
      <ShareNetwork size={16} weight="bold" aria-hidden />
      {estado === 'fazendo' ? 'Montando a imagem...' : estado === 'baixado' ? 'Imagem baixada' : 'Compartilhar imagem'}
      <span className="sr-only" aria-live="polite">{estado === 'baixado' ? 'A imagem foi baixada.' : ''}</span>
    </button>
  )
}
