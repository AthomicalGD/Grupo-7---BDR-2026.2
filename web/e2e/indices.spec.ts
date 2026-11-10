import { expect, registrar, test } from './base'

// P3 (/indices): veredito + termômetro + gráfico herói; sem o IFDM no banco, o estado vazio ensina o comando.
test('P3: o veredito, o termômetro e a dispersão respondem ao índice escolhido', async ({ page, erros }) => {
  test.setTimeout(120_000)
  await page.goto('/indices?indice=pib_pc')
  await expect(page.getByRole('heading', { level: 1, name: 'Os índices do município e o voto' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Índices', exact: true })).toHaveAttribute('aria-current', 'page')
  const s1 = page.locator('section[aria-labelledby="indice-vies"]')
  await expect(s1.getByRole('heading', { name: 'O lado do voto acompanha o índice?' })).toBeVisible({ timeout: 60_000 })
  // o veredito é uma palavra (a força da correlação) e o termômetro mostra o r
  await expect(s1.getByText(/^(Quase nenhuma|Fraca|Moderada|Forte)\.$/)).toBeVisible()
  await expect(s1.getByRole('img', { name: /^Correlação .* entre o viés político em 2024 e PIB per capita: r = / })).toBeVisible()
  await expect(s1.getByRole('img', { name: /^Dispersão de .* municípios/ })).toBeVisible()
  // a explicação longa fica sob demanda
  const como = s1.locator('details').first()
  await expect(como).not.toHaveAttribute('open', '')
  await como.locator('summary').click()
  await expect(como.getByText(/O r de Pearson vai de −1 a \+1/)).toBeVisible()
  // trocar a eleição muda a frase do veredito
  await page.getByRole('radio', { name: '2022', exact: true }).click()
  await expect(s1.getByText(/em 2022/).first()).toBeVisible({ timeout: 30_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await registrar(page, 'indices-azulejo')
  expect(erros).toEqual([])
})

test('P3: sem o IFDM no banco, a página abre no PIB e o estado vazio diz o que fazer', async ({ page }) => {
  test.setTimeout(120_000)
  // a API de verdade, mas como se o IFDM nunca tivesse sido carregado
  await page.route('**/api/indices?uf=*', async (rota) => {
    const resposta = await rota.fetch()
    const json = await resposta.json()
    json.ano_ifdm = {}
    json.ifdm_recente = null
    await rota.fulfill({ response: resposta, json })
  })
  await page.goto('/indices')
  await expect(page.getByRole('radio', { name: 'PIB per capita' })).toHaveAttribute('aria-checked', 'true', { timeout: 60_000 })
  await expect(page.getByRole('radio', { name: /^IFDM/ })).toContainText('sem dado')
  const s2 = page.locator('section[aria-labelledby="constancia"]')
  await s2.scrollIntoViewIfNeeded()
  await expect(s2.getByRole('status').getByText('O IFDM ainda não chegou ao banco')).toBeVisible()
  await expect(s2.getByText('python -m loader.ifdm')).toBeVisible()
  // escolher o IFDM mostra o mesmo aviso no lugar do gráfico da primeira pergunta
  await page.getByRole('radio', { name: /^IFDM/ }).click()
  const s1 = page.locator('section[aria-labelledby="indice-vies"]')
  await expect(s1.getByRole('status')).toBeVisible()
  // e há uma saída: voltar ao índice que tem dado
  await s1.getByRole('button', { name: /ver com PIB per capita/ }).click()
  await expect(page.getByRole('radio', { name: 'PIB per capita' })).toHaveAttribute('aria-checked', 'true')
})

test('P3: se a API falha, a tela mostra o erro com a saída de tentar de novo', async ({ page }) => {
  await page.route('**/api/indices?uf=*', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"erro de teste"}' }))
  await page.goto('/indices')
  await expect(page.getByRole('alert').getByText('Os dados não chegaram')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
})
