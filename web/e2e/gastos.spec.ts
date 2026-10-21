import { expect, registrar, test } from './base'

// a cena expõe window.__nuvem (noChao, fase, devolve) para os testes
declare global {
  interface Window {
    __velocidade?: number
    __nuvem?: {
      noChao: number; fase: string; devolve(): void; vira(p: string): void; avanca(dt: number, n?: number): void
      maoDebug: { maos: number; minY: number; juntas: { k: string; y: number; x: number; dentro: boolean }[] }
    }
  }
}

test('P9: na ficha do político, a chuva de santinhos dos gastos, o bafo, a cola na mão e a volta ao chão', async ({ page }) => {
  test.setTimeout(120_000)
  const destaques = await (await page.request.get('/api/gastos/destaques')).json()
  const c = destaques[0]
  const gastos = await (await page.request.get(`/api/gastos?candidatura=${c.id}`)).json()
  const maior = gastos.tipos[0]
  expect(gastos.total).toBeCloseTo(gastos.tipos.reduce((a: number, t: { valor: number }) => a + t.valor, 0), 2)

  // pela Metodologia: o exemplo leva à ficha, já na campanha escolhida
  await page.goto('/metodologia')
  await page.locator(`a[href*="gasto=${c.id}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/politico/${c.id_politico}\\?gasto=${c.id}`))
  await expect(page.getByText('do gasto foi em propaganda e comunicação')).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction((n) => (window.__nuvem?.noChao ?? 0) >= n, Math.min(40, gastos.tipos.length), { timeout: 60_000 })
  await registrar(page, 'gastos')

  // a linha do maior gasto bate o bafo: o santinho vira, as mãos pegam e trazem a cola para perto
  await page.getByRole('button', { name: `${maior.rotulo}: R$` }).click()
  await page.waitForFunction(() => window.__nuvem?.fase === 'na-mao', null, { timeout: 30_000 })
  // e devolvem: o santinho deita de novo e vira de frente
  await page.evaluate(() => window.__nuvem?.devolve())
  await page.waitForFunction(() => window.__nuvem?.fase === 'livre', null, { timeout: 30_000 })

  // só propaganda: os outros tipos o vento leva
  if (gastos.tipos.some((t: { propaganda: boolean }) => t.propaganda)) {
    const so = page.getByRole('button', { name: 'Só propaganda' })
    await so.click()
    await expect(so).toHaveAttribute('aria-pressed', 'true')
  }
})

test('P9: as mãos, quadro a quadro, nunca atravessam a mesa nem a folha', async ({ page }) => {
  test.setTimeout(120_000)
  const destaques = await (await page.request.get('/api/gastos/destaques')).json()
  const gastos = await (await page.request.get(`/api/gastos?candidatura=${destaques[0].id}`)).json()
  await page.goto(`/politico/${destaques[0].id_politico}?gasto=${destaques[0].id}`)
  await page.waitForFunction((n) => (window.__nuvem?.noChao ?? 0) >= n, Math.min(40, gastos.tipos.length), { timeout: 60_000 })
  // o modelo das mãos (glTF) precisa ter chegado: sem ele não há junta para medir e o teste passaria vazio
  await page.waitForFunction(() => (window.__nuvem?.maoDebug.maos ?? 0) > 0, undefined, { timeout: 30_000 })
  const r = await page.evaluate((palavra) => {
    const n = window.__nuvem!
    window.__velocidade = 1e-6 // o relógio da página parado: só os passos daqui andam
    n.vira(palavra)
    const lado: Record<string, number> = {}
    const atravessa: string[] = []
    let minY = Infinity, juntas = 0, leitura = { dedos: -Infinity, polegar: Infinity }
    const olha = (q: number) => {
      const d = n.maoDebug
      minY = Math.min(minY, d.minY); juntas = Math.max(juntas, d.juntas.length)
      for (const j of d.juntas) {
        // trocar de lado da folha dentro do contorno é atravessar o papel; o polegar dobrando sobre a quina
        // (a uma espessura de polegar da borda lateral) não conta
        const s = Math.sign(j.y)
        const polegarNaBorda = j.k.includes('thumb') && Math.abs(j.x) > 0.88
        if (j.dentro && Math.abs(j.y) > 0.01) {
          if (lado[j.k] !== undefined && lado[j.k] !== s && !polegarNaBorda) atravessa.push(`${q} ${j.k}`)
          lado[j.k] = s
        } else if (!j.dentro) delete lado[j.k]
      }
    }
    for (let q = 0; q < 300; q++) { n.avanca(1 / 60); olha(q) }
    for (const j of n.maoDebug.juntas) if (j.dentro) {
      if (j.k.includes('thumb-tip')) leitura.polegar = Math.min(leitura.polegar, j.y)
      else if (!j.k.includes('thumb')) leitura.dedos = Math.max(leitura.dedos, j.y)
    }
    const fase = n.fase
    n.devolve()
    for (let q = 300; q < 440; q++) { n.avanca(1 / 60); olha(q) }
    return { minY, juntas, atravessa, leitura, fase }
  }, gastos.tipos[0].rotulo)
  expect(r.fase).toBe('na-mao')
  expect(r.juntas).toBeGreaterThan(0)            // as mãos foram medidas de fato
  expect(r.minY).toBeGreaterThan(0.1)            // nenhum osso abaixo do tampo
  expect(r.atravessa).toEqual([])                // nenhum dedo atravessa a folha
  expect(r.leitura.dedos).toBeLessThan(-0.3)     // na leitura, os dedos atrás da cola
  expect(r.leitura.polegar).toBeGreaterThan(0.05) // e o polegar na frente
})
