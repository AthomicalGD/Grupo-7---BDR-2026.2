// Tela de LCD da urna desenhada num canvas (textura no 3D, ou o próprio canvas no modo 2D).
import type { PoliticoBusca } from '../api'
import { nomeProprio } from '../lib/formato'

export const VISOR = { largura: 1024, altura: 720 }

export interface EstadoVisor {
  texto: string
  resultados: PoliticoBusca[]
  selecionado: number
  buscando: boolean
  fim: boolean
  cursor: boolean
}

const LCD = '#e4ebe1', TINTA = '#16201a', APAGADO = '#5d6b60', LINHA = '#b9c4b6'
const MONO = '"Red Hat Mono Variable", "Red Hat Mono", ui-monospace, monospace'
const SANS = '"Archivo Variable", Archivo, system-ui, sans-serif'

function cortar(c: CanvasRenderingContext2D, texto: string, largura: number) {
  if (c.measureText(texto).width <= largura) return texto
  let t = texto
  while (t.length > 1 && c.measureText(t + '…').width > largura) t = t.slice(0, -1)
  return t + '…'
}

export function desenharVisor(canvas: HTMLCanvasElement, e: EstadoVisor, foto: HTMLImageElement | null) {
  const c = canvas.getContext('2d')!
  const { largura: W, altura: H } = VISOR
  c.fillStyle = LCD
  c.fillRect(0, 0, W, H)
  // leve vinheta do vidro
  const g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.75)
  g.addColorStop(0, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(0,0,0,0.07)')
  c.fillStyle = g
  c.fillRect(0, 0, W, H)
  c.textBaseline = 'alphabetic'

  if (e.fim) {
    c.fillStyle = TINTA
    c.font = `800 260px ${SANS}`
    c.textAlign = 'center'
    c.fillText('FIM', W / 2, H / 2 + 92)
    c.textAlign = 'left'
    return
  }

  c.fillStyle = APAGADO
  c.font = `600 26px ${MONO}`
  c.fillText('CONSULTA DE CARREIRA', 48, 66)
  c.textAlign = 'right'
  c.fillText('VOTO ABERTO', W - 48, 66)
  c.textAlign = 'left'

  c.font = `500 32px ${MONO}`
  c.fillText('Nome:', 48, 136)
  c.fillStyle = TINTA
  c.font = `600 46px ${MONO}`
  const nome = cortar(c, e.texto.toUpperCase(), W - 230)
  c.fillText(nome, 168, 138)
  if (e.cursor) c.fillRect(172 + c.measureText(nome).width, 100, 24, 46)
  c.fillStyle = LINHA
  c.fillRect(48, 168, W - 96, 3)

  const comFoto = e.resultados.length > 0
  const larguraLista = comFoto ? W - 96 - 260 : W - 96
  if (!e.texto.trim()) {
    c.fillStyle = TINTA
    c.font = `700 44px ${SANS}`
    c.fillText('Digite o nome de um político', 48, 280)
    c.fillStyle = APAGADO
    c.font = `500 30px ${SANS}`
    c.fillText('Use o teclado do computador. A busca ignora acentos.', 48, 334)
  } else if (e.texto.trim().length < 3) {
    c.fillStyle = APAGADO
    c.font = `500 32px ${SANS}`
    c.fillText('Continue digitando (mínimo de 3 letras)', 48, 260)
  } else if (!comFoto) {
    c.fillStyle = APAGADO
    c.font = `500 32px ${SANS}`
    c.fillText(e.buscando ? 'Procurando...' : 'Nenhum político encontrado', 48, 260)
  } else {
    e.resultados.slice(0, 6).forEach((r, i) => {
      const y = 196 + i * 68
      const ativo = i === e.selecionado
      if (ativo) {
        c.fillStyle = TINTA
        c.fillRect(40, y, larguraLista + 8, 62)
      }
      c.fillStyle = ativo ? LCD : TINTA
      c.font = `700 30px ${MONO}`
      c.fillText(String(i + 1), 58, y + 42)
      c.font = `600 30px ${MONO}`
      c.fillText(cortar(c, r.nome, larguraLista - 76), 100, y + 30)
      c.fillStyle = ativo ? '#c9d3c6' : APAGADO
      c.font = `500 22px ${MONO}`
      const ufs = r.ufs.join(' ') || 'BR'
      c.fillText(`${ufs} · ${r.primeiro_ano}-${r.ultimo_ano} · ${r.candidaturas} eleições · ${r.vitorias} vitórias`, 100, y + 56)
    })
    // foto do selecionado, como na urna
    const fx = W - 48 - 236, fy = 196, fw = 236, fh = 292
    c.fillStyle = '#d3dccf'
    c.fillRect(fx, fy, fw, fh)
    const sel = e.resultados[e.selecionado]
    if (foto && foto.complete && foto.naturalWidth) {
      const r = Math.max(fw / foto.naturalWidth, fh / foto.naturalHeight)
      const sw = fw / r, sh = fh / r
      c.drawImage(foto, (foto.naturalWidth - sw) / 2, 0, sw, sh, fx, fy, fw, fh)
    } else if (sel) {
      c.fillStyle = APAGADO
      c.font = `700 90px ${SANS}`
      c.textAlign = 'center'
      c.fillText(nomeProprio(sel.nome).split(' ').filter((p) => p.length > 2).slice(0, 2).map((p) => p[0]).join(''), fx + fw / 2, fy + fh / 2 + 32)
      c.textAlign = 'left'
    }
    c.strokeStyle = TINTA
    c.lineWidth = 3
    c.strokeRect(fx, fy, fw, fh)
  }

  // rodapé, como o "Aperte a tecla" da urna
  c.fillStyle = LINHA
  c.fillRect(48, H - 132, W - 96, 3)
  c.fillStyle = TINTA
  c.font = `600 24px ${MONO}`
  c.fillText('Aperte a tecla:', 48, H - 92)
  c.font = `500 23px ${MONO}`
  c.fillText('CONFIRMA para ABRIR a carreira    1 a 6 para ESCOLHER', 48, H - 58)
  c.fillText('CORRIGE  para APAGAR o nome        BRANCO para SORTEAR', 48, H - 28)
}
