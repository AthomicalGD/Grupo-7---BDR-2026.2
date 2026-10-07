import { expect, registrar, test } from './base'

const PI = 'path[data-tipo="uf"][data-codigo="22"]'

test('mapa do Brasil: estados coloridos, tooltip e troca de ano', async ({ page, erros }) => {
  await page.goto('/')
  await expect(page.locator('path[data-tipo="uf"]')).toHaveCount(27)
  await expect(page.getByRole('heading', { name: 'Para onde o voto pendeu' })).toBeVisible()

  await page.locator(PI).hover()
  const dica = page.getByRole('tooltip')
  await expect(dica).toContainText('Piauí')
  await expect(dica).toContainText('−41,9')
  await expect(dica).toContainText('pendeu à esquerda')

  await page.locator('path[data-tipo="uf"][data-codigo="35"]').hover() // SP não está carregado
  await expect(page.getByRole('tooltip')).toContainText('Sem dados carregados')
  await registrar(page, 'brasil')

  await page.getByRole('radio', { name: /2018/ }).click()
  await expect(page).toHaveURL(/ano=2018/)
  await expect(page.getByRole('button', { name: /Piauí/ })).toContainText('−33,0')
  expect(erros).toEqual([])
})

test('clique no estado aproxima e mostra os 224 municípios do Piauí', async ({ page }) => {
  await page.goto('/')
  await page.locator(PI).click()
  await expect(page).toHaveURL(/\/uf\/PI/)
  await expect(page.getByRole('heading', { level: 1, name: 'Piauí' })).toBeVisible()
  await expect(page.locator('path[data-tipo="municipio"]')).toHaveCount(224)
  await expect(page.getByRole('heading', { name: /Regiões intermediárias/ })).toBeVisible()
  await registrar(page, 'estado')

  await page.getByRole('radio', { name: 'Relativa ao estado' }).click()
  await expect(page).toHaveURL(/relativo=true/)
  await expect(page.getByText('mais à esquerda que o estado')).toBeVisible()
})

test('digitar o município leva ao boletim com as respostas da P7', async ({ page }) => {
  await page.goto('/')
  const busca = page.getByRole('combobox', { name: 'Digite um município' })
  await busca.fill('teresi')
  await expect(page.getByRole('option', { name: /Teresina/ }).first()).toBeVisible()
  await busca.press('Enter')

  await expect(page).toHaveURL(/\/uf\/PI\/2211001/)
  const boletim = page.getByRole('article', { name: 'Teresina' })
  await expect(boletim).toBeVisible()
  await expect(boletim.getByText('BOLETIM DO MUNICÍPIO')).toBeVisible()
  for (const ano of [2018, 2020, 2022, 2024]) await expect(boletim.getByRole('img', { name: new RegExp(`^${ano}: PT`) })).toBeVisible()
  await expect(boletim.getByRole('link', { name: /Mendes/ }).first()).toBeVisible() // prefeitos levam à carreira
  await expect(boletim.getByRole('img', { name: /QR code/ })).toBeVisible()
  await registrar(page, 'municipio')

  await boletim.getByRole('button', { name: 'Ver tabela' }).first().click()
  await expect(boletim.getByRole('table').first()).toContainText('−34,9')
})

test('metodologia e página inexistente', async ({ page }) => {
  await page.goto('/metodologia')
  await expect(page.getByRole('heading', { name: 'Como os números são feitos' })).toBeVisible()
  await registrar(page, 'metodologia')
  await page.goto('/nao-existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})

test('pular para o conteúdo e nenhuma tela com rolagem horizontal', async ({ page }) => {
  test.setTimeout(120_000) // visita seis telas; no Chromium de teste o mapa é desenhado pela CPU
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
  for (const rota of ['/', '/uf/PI', '/uf/PI/2211001', '/urna', '/politico/368990', '/metodologia']) {
    await page.goto(rota)
    await page.waitForLoadState('networkidle')
    const [rolagem, largura] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
    expect(rolagem, `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(largura)
  }
})

test('estado: de onde vem o viés, partido a partido, com os candidatos', async ({ page }) => {
  await page.goto('/uf/PI?ano=2022')
  await expect(page.getByRole('heading', { name: 'De onde vem o −41,9' })).toBeVisible({ timeout: 20_000 })
  const pt = page.getByRole('button', { name: /^PT:/ })
  await expect(pt).toBeVisible({ timeout: 20_000 })
  await pt.click()
  await expect(page.getByRole('link', { name: /Luiz Inácio Lula da Silva/ })).toBeVisible()
  await registrar(page, 'estado-conta')
})

test('metodologia: cada questão leva à tela da resposta', async ({ page }) => {
  await page.goto('/metodologia')
  await page.getByRole('link', { name: 'Ver a resposta na urna' }).click()
  await expect(page).toHaveURL(/\/urna/)
  await page.goto('/metodologia')
  await page.getByRole('link', { name: 'Ver a resposta no mapa' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page).toHaveURL(/localhost:\d+\/(\?|$)/)
})

