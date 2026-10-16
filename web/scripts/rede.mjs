// Abre o site para os celulares, para ler o QR code do boletim.
//
//   npm run rede            na mesma rede privada (casa): o celular fala direto com o notebook
//   npm run rede:publico    em qualquer Wi-Fi (o da universidade): um link https do túnel do Cloudflare
//
// Segurança do notebook (o que este script faz e o que ele NÃO faz):
// - Serve só a versão de produção (dist). O servidor de desenvolvimento do Vite nunca sai do notebook:
//   ele serve o código-fonte e já teve falhas de leitura de arquivos do disco.
// - Rede: escuta só no IP privado da rede local (192.168.x, 10.x, 172.16-31.x), nunca em 0.0.0.0;
//   adaptadores virtuais, VPNs e IPs públicos são recusados.
// - Público: escuta só em 127.0.0.1 (nem a rede local alcança) e o cloudflared leva o site até a
//   Cloudflare por uma conexão de SAÍDA. Nenhuma porta de entrada é aberta no Windows, o firewall não
//   muda e a rede pública da universidade continua sem enxergar o notebook.
// - Nos dois: a API (127.0.0.1:8000) e o banco (127.0.0.1:5432) continuam só no notebook (este
//   servidor repassa /api); chave aleatória nova a cada execução, que vai dentro do QR, e sem ela tudo
//   responde 403; só leitura (GET e HEAD); Host conferido (contra DNS rebinding); Referrer-Policy
//   no-referrer (a chave não vaza para os sites das fotos); desliga sozinho depois de REDE_MINUTOS
//   (padrão 60). Ctrl+C desliga na hora, túnel junto.
import { spawn } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

const PUBLICO = process.argv.includes('--publico')
const PORTA = Number(process.env.REDE_PORTA ?? 4173)
const MINUTOS = Number(process.env.REDE_MINUTOS ?? 60)
const COOKIE = 'va_chave'

const privado = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
// adaptadores virtuais e VPNs (WSL, Hyper-V, Docker, ZeroTier, Tailscale...) nunca: abririam o site para
// outras máquinas virtuais ou para todos os membros da VPN
const VIRTUAL = /vethernet|wsl|hyper-v|docker|virtualbox|vmware|zerotier|tailscale|hamachi|wireguard|vpn|loopback/i
const interfaces = Object.entries(networkInterfaces()).flatMap(([nome, l]) => (l ?? []).filter((i) => i.family === 'IPv4' && !i.internal).map((i) => ({ nome, ip: i.address })))
const recusa = (i) => (VIRTUAL.test(i.nome) ? 'virtual ou VPN' : !privado(i.ip) ? 'IP não é de rede privada' : null)

let escolhida = null
if (!PUBLICO) {
  const pedido = process.env.REDE_IP
  escolhida = pedido ? interfaces.find((i) => i.ip === pedido) : interfaces.find((i) => !recusa(i))
  if (!escolhida || recusa(escolhida)) {
    console.error(pedido ? `REDE_IP=${pedido} recusado: ${escolhida ? recusa(escolhida) : 'não é deste notebook'}.` : 'Nenhuma rede local privada encontrada.')
    for (const i of interfaces) console.error(`  ${i.nome}: ${i.ip}${recusa(i) ? ` (recusada: ${recusa(i)})` : ''}`)
    console.error('Em Wi-Fi público (universidade), use: npm run rede:publico')
    process.exit(1)
  }
}
const ip = PUBLICO ? '127.0.0.1' : escolhida.ip

// o cloudflared: o de CLOUDFLARED, o da pasta do projeto (web/.ferramentas, fora do git), o do
// instalador oficial (Arquivos de Programas) ou o do PATH
const CLOUDFLARED = process.env.CLOUDFLARED ?? (() => {
  const lugares = [
    fileURLToPath(new URL('../.ferramentas/cloudflared.exe', import.meta.url)),
    join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'cloudflared', 'cloudflared.exe'),
    join(process.env.ProgramFiles ?? 'C:/Program Files', 'cloudflared', 'cloudflared.exe'),
  ]
  return lugares.find((l) => existsSync(l)) ?? 'cloudflared'
})()

const chave = randomBytes(24).toString('base64url')
const igual = (a) => typeof a === 'string' && a.length === chave.length && timingSafeEqual(Buffer.from(a), Buffer.from(chave))
// no túnel, o cloudflared reescreve o Host para este mesmo valor (--http-host-header)
const hostCerto = `${ip}:${PORTA}`

/** Porteiro: roda antes de servir qualquer arquivo ou repassar qualquer pedido para a API. */
function porteiro(req, res, seguir) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Cache-Control', 'no-store')
  const negar = (codigo, texto) => {
    res.statusCode = codigo
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(texto)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return negar(405, 'Só leitura.')
  if (req.headers.host !== hostCerto) return negar(403, 'Endereço não reconhecido.')
  const naUrl = new URL(req.url ?? '/', `http://${hostCerto}`).searchParams.get('chave')
  const noCookie = /(?:^|;\s*)va_chave=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]
  if (igual(naUrl)) {
    res.setHeader('Set-Cookie', `${COOKIE}=${chave}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MINUTOS * 60}${PUBLICO ? '; Secure' : ''}`)
    return seguir()
  }
  if (igual(noCookie)) return seguir()
  return negar(403, 'Acesso negado. Escaneie o QR code na tela do notebook.')
}

/** Sobe o túnel rápido do Cloudflare (sem conta) e devolve o endereço https que ele sorteou. */
function abrirTunel() {
  return new Promise((resolve, reject) => {
    const t = spawn(CLOUDFLARED, ['tunnel', '--no-autoupdate', '--url', `http://${hostCerto}`, '--http-host-header', hostCerto], { stdio: ['ignore', 'pipe', 'pipe'] })
    const prazo = setTimeout(() => reject(new Error('o túnel não respondeu em 60 s')), 60_000)
    const ler = (pedaco) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(pedaco))
      if (m) {
        clearTimeout(prazo)
        resolve({ processo: t, endereco: m[0] })
      }
    }
    t.stdout.on('data', ler)
    t.stderr.on('data', ler)
    t.on('error', (e) => reject(e.code === 'ENOENT' ? new Error(`cloudflared não encontrado (${CLOUDFLARED}); veja o README, "Apresentar em qualquer Wi-Fi"`) : e))
    t.on('exit', (c) => reject(new Error(`o cloudflared saiu (código ${c})`)))
  })
}

console.log('Gerando a versão de produção...')
await build({ logLevel: 'warn' })
const servidor = await preview({
  preview: { host: ip, port: PORTA, strictPort: true, open: false, allowedHosts: [ip] },
  plugins: [{ name: 'porteiro-da-rede', configurePreviewServer: (s) => void s.middlewares.use(porteiro) }],
  logLevel: 'warn',
})

let tunel = null
const desligar = (codigo = 0) => {
  console.log('\nServidor desligado.')
  tunel?.processo.kill()
  servidor.httpServer.close()
  process.exit(codigo)
}
setTimeout(desligar, MINUTOS * 60_000).unref()
process.on('SIGINT', () => desligar())
process.on('SIGHUP', () => desligar()) // fechar a janela do terminal também desliga, túnel junto
process.on('exit', () => tunel?.processo.kill())

if (PUBLICO) {
  console.log('Abrindo o túnel do Cloudflare...')
  try {
    tunel = await abrirTunel()
  } catch (e) {
    console.error(`Não deu para abrir o túnel: ${e.message}`)
    desligar(1)
  }
  tunel.processo.on('exit', () => {
    console.error('O túnel caiu.')
    desligar(1)
  })
  console.log(`
  Voto Aberto pelo túnel do Cloudflare (só leitura, com chave)

  Abra este endereço no notebook; os QR codes dos boletins já levam o endereço e a chave:
  ${tunel.endereco}/?chave=${chave}

  - O notebook só serve em 127.0.0.1: nenhuma porta de entrada aberta, o firewall não muda.
  - Quem não escanear o QR (sem a chave) recebe 403. A API e o banco continuam só no notebook.
  - Desliga sozinho em ${MINUTOS} minutos. Ctrl+C desliga agora, e o link deixa de existir.
`)
} else {
  const fora = interfaces.filter((i) => i !== escolhida)
  console.log(`
  Voto Aberto na rede local (só leitura, com chave), pela interface ${escolhida.nome}

  Abra este endereço no notebook; os QR codes dos boletins já levam a chave:
  http://${hostCerto}/?chave=${chave}

  - Só aparelhos na mesma rede alcançam ${ip}, e só com a chave.
  - Se o Windows perguntar sobre o firewall, permita só em "Redes privadas", nunca em "Redes públicas".
  - Em Wi-Fi público (universidade), use npm run rede:publico.
  - Desliga sozinho em ${MINUTOS} minutos. Ctrl+C desliga agora.
${fora.length ? `
  Não expostas: ${fora.map((i) => `${i.nome} (${i.ip}${recusa(i) ? ', ' + recusa(i) : ''})`).join('; ')}
  Para outra rede privada: REDE_IP=<ip> npm run rede
` : ''}`)
}
