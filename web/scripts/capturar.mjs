// Capturas das telas das questões novas (P6, P3, P5), de página inteira, em desktop e celular, claro e escuro.
// Uso: node scripts/capturar.mjs <antes|depois> [site=http://localhost:4190] [telas=idade,indices,legenda]
// Sai em ../docs/capturas-novas-questoes/<fase>-<tela>-<desktop|celular>-<claro|escuro>.jpg
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [fase = 'depois', site = 'http://localhost:4190', lista = 'idade,indices,legenda', so = ''] = process.argv.slice(2)
const TELAS = { idade: '/idade', indices: '/indices', legenda: '/cadeira/legenda' }
const TAMANHOS = { desktop: { width: 1440, height: 900 }, celular: { width: 390, height: 844 } }
const saida = new URL('../../docs/capturas-novas-questoes/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
mkdirSync(saida, { recursive: true })

const navegador = await chromium.launch()
for (const tela of lista.split(',')) {
  for (const [tam, viewport] of Object.entries(TAMANHOS)) {
    for (const tema of ['claro', 'escuro']) {
      if (so && so !== `${tam}-${tema}`) continue
      const ctx = await navegador.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: tam === 'celular' ? 2 : 1 })
      await ctx.addInitScript((t) => localStorage.setItem('va-tema', t), tema)
      const page = await ctx.newPage()
      await page.goto(site + TELAS[tela], { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {})
      await page.waitForSelector('h1', { timeout: 90_000 }).catch(() => {})
      await page.screenshot({ path: `${saida}${fase}-${tela}-${tam}-${tema}-dobra.jpg`, type: 'jpeg', quality: 70 })
      await page.addStyleTag({ content: '.adiar{content-visibility:visible!important;contain-intrinsic-size:none!important}' })
      await page.waitForTimeout(2500)
      // as seções "adiar" só desenham ao chegar perto: rola a página inteira antes da foto
      const alto = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 0; y < alto; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(250) }
      await page.waitForTimeout(2500)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(400)
      const arq = `${saida}${fase}-${tela}-${tam}-${tema}.jpg`
      await page.screenshot({ path: arq, fullPage: true, type: 'jpeg', quality: 62 })
      console.log(arq)
      await ctx.close()
    }
  }
}
await navegador.close()
