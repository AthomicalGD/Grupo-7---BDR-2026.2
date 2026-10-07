// Tela da urna desenhada num canvas (textura no 3D, ou o próprio canvas no modo 2D).
// Segue a tela de votação do modelo UE2020: TFT larga e branca, texto preto em sans, foto do
// candidato à direita e o rodapé "Aperte a tecla:" separado por uma linha.
import type { PoliticoBusca } from '../api'
import { nomeProprio, plural } from '../lib/formato'

export const VISOR = { largura: 1280, altura: 604 } // proporção da tela do UE2020 (~2,1:1)

export interface EstadoVisor {
  texto: string
  resultados: PoliticoBusca[]
  selecionado: number
  buscando: boolean
  fim: boolean
  cursor: boolean
}

const FUNDO = '#fbfbfa', TINTA = '#141414', APAGADO = '#646a70', LINHA = '#c9cdd1'
const SANS = '"Archivo Variable", Archivo, Arial, system-ui, sans-serif'
const M = 40 // margem

function cortar(c: CanvasRenderingContext2D, texto: string, largura: number) {
  if (c.measureText(texto).width <= largura) return texto
  let t = texto
  while (t.length > 1 && c.measureText(t + '…').width > largura) t = t.slice(0, -1)
  return t + '…'
}

export function desenharVisor(canvas: HTMLCanvasElement, e: EstadoVisor, foto: HTMLImageElement | null) {
  const c = canvas.getContext('2d')!
  const { largura: W, altura: H } = VISOR
  c.fillStyle = FUNDO
  c.fillRect(0, 0, W, H)
  c.textBaseline = 'alphabetic'
  c.textAlign = 'left'

  if (e.fim) {
    c.fillStyle = TINTA
    c.font = `800 230px ${SANS}`
    c.textAlign = 'center'
    c.fillText('FIM', W / 2, H / 2 + 80)
    c.textAlign = 'left'
    return
  }

  c.fillStyle = TINTA
  c.font = `600 24px ${SANS}`
  c.fillText('CONSULTA DE CARREIRA', M, 48)
  c.fillStyle = APAGADO
  c.textAlign = 'right'
  c.fillText('VOTO ABERTO', W - M, 48)
  c.textAlign = 'left'

  c.fillStyle = TINTA
  c.font = `500 30px ${SANS}`
  c.fillText('Nome:', M, 112)
  c.font = `700 42px ${SANS}`
  const nome = cortar(c, e.texto.toUpperCase(), W - 2 * M - 140)
  c.fillText(nome, M + 104, 113)
  if (e.cursor) c.fillRect(M + 110 + c.measureText(nome).width, 80, 20, 40)
  c.fillStyle = LINHA
  c.fillRect(M, 138, W - 2 * M, 2)

  const comResultados = e.resultados.length > 0
  const fw = 196, fh = 246, fx = W - M - fw, fy = 160
  const larguraLista = comResultados ? fx - M - 28 : W - 2 * M
  if (!e.texto.trim()) {
    c.fillStyle = TINTA
    c.font = `700 40px ${SANS}`
    c.fillText('Digite o nome de um político', M, 232)
    c.fillStyle = APAGADO
    c.font = `500 28px ${SANS}`
    c.fillText('Use o teclado do computador. A busca ignora acentos.', M, 280)
  } else if (e.texto.trim().length < 3) {
    c.fillStyle = APAGADO
    c.font = `500 30px ${SANS}`
    c.fillText('Continue digitando (mínimo de 3 letras)', M, 220)
  } else if (!comResultados) {
    c.fillStyle = APAGADO
    c.font = `500 30px ${SANS}`
    c.fillText(e.buscando ? 'Procurando...' : 'Nenhum político encontrado', M, 220)
  } else {
    e.resultados.slice(0, 6).forEach((r, i) => {
      const y = 154 + i * 58
      const ativo = i === e.selecionado
      if (ativo) {
        c.fillStyle = TINTA
        c.fillRect(M - 10, y, larguraLista + 20, 54)
      }
      c.fillStyle = ativo ? '#ffffff' : TINTA
      c.font = `800 28px ${SANS}`
      c.fillText(String(i + 1), M + 4, y + 37)
      c.font = `700 26px ${SANS}`
      c.fillText(cortar(c, r.nome, larguraLista - 60), M + 44, y + 26)
      c.fillStyle = ativo ? '#c9cdd1' : APAGADO
      c.font = `500 20px ${SANS}`
      const ufs = r.ufs.join(' ') || 'BR'
      c.fillText(`${ufs} · ${r.primeiro_ano}-${r.ultimo_ano} · ${plural(r.candidaturas, 'eleição', 'eleições')} · ${plural(r.vitorias, 'vitória', 'vitórias')}`, M + 44, y + 48)
    })
    // foto do selecionado, como a urna mostra a do candidato
    c.fillStyle = '#e4e7ea'
    c.fillRect(fx, fy, fw, fh)
    const sel = e.resultados[e.selecionado]
    if (foto && foto.complete && foto.naturalWidth) {
      const k = Math.max(fw / foto.naturalWidth, fh / foto.naturalHeight)
      const sw = fw / k, sh = fh / k
      c.drawImage(foto, (foto.naturalWidth - sw) / 2, 0, sw, sh, fx, fy, fw, fh)
    } else if (sel) {
      c.fillStyle = APAGADO
      c.font = `700 80px ${SANS}`
      c.textAlign = 'center'
      c.fillText(nomeProprio(sel.nome).split(' ').filter((p) => p.length > 2).slice(0, 2).map((p) => p[0]).join(''), fx + fw / 2, fy + fh / 2 + 28)
      c.textAlign = 'left'
    }
    c.strokeStyle = LINHA
    c.lineWidth = 2
    c.strokeRect(fx, fy, fw, fh)
  }

  // rodapé, como o "Aperte a tecla" da tela de votação
  c.fillStyle = LINHA
  c.fillRect(M, H - 84, W - 2 * M, 2)
  c.fillStyle = TINTA
  c.font = `700 22px ${SANS}`
  c.fillText('Aperte a tecla:', M, H - 50)
  c.font = `500 22px ${SANS}`
  c.fillText('CONFIRMA para ABRIR a carreira       CORRIGE para APAGAR o nome', M + 180, H - 50)
  c.fillText('1 a 6 para ESCOLHER na lista              BRANCO para SORTEAR um político', M + 180, H - 20)
}
