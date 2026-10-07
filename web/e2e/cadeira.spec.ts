import { expect, registrar, test } from './base'

test('P1: o plenário tem uma cadeira por eleito e o custo bate com a resposta', async ({ page }) => {
  await page.goto('/cadeira?cargo=6&ano=2022&uf=PI&epoca=true')
  await expect(page.getByRole('heading', { name: 'Quanto custa uma cadeira?' })).toBeVisible()
  // PI, deputado federal, 2022: 10 cadeiras, R$ 6,21 mi por cadeira (respostas/01_custo_cadeira.txt)
  await expect(page.locator('svg [data-i]')).toHaveCount(10)
  const plenario = page.getByRole('region', { name: 'Plenário' })
  await expect(plenario.getByText('R$ 6,2 mi', { exact: true })).toBeVisible()
  await registrar(page, 'cadeira')

  // corrigido pela inflação, a mesma cadeira vale mais
  await page.getByRole('radio', { name: 'Em reais de 2024' }).click()
  await expect(plenario.getByText('R$ 6,8 mi', { exact: true })).toBeVisible()

  // o cartão de cada cadeira leva à carreira
  await page.locator('svg [data-i]').first().hover()
  await expect(page.getByRole('tooltip')).toContainText('por voto')
  await page.locator('svg [data-i]').first().click()
  await expect(page).toHaveURL(/\/politico\/\d+/)
})

test('P1: vereador abre a câmara da capital e o boletim leva até ela', async ({ page }) => {
  await page.goto('/cadeira?cargo=13&uf=PI')
  await expect(page.getByText('Mostrando Teresina')).toBeVisible()
  await expect(page.locator('svg [data-i]')).toHaveCount(29)
  await expect(page.getByRole('heading', { name: 'Para onde vai e de onde vem o dinheiro' })).toBeVisible()

  await page.goto('/uf/PI/2211001')
  await expect(page.getByRole('heading', { name: 'Quanto custou cada cadeira' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('link', { name: 'Ver a câmara no plenário' }).click()
  await expect(page).toHaveURL(/cargo=13/)
  await expect(page.locator('svg [data-i]')).toHaveCount(29)
})

test('P1: procurar um eleito e apertar Enter destaca a cadeira dele', async ({ page }) => {
  await page.goto('/cadeira?cargo=6&ano=2022&uf=PI')
  await expect(page.locator('svg [data-i]')).toHaveCount(10)
  const campo = page.getByRole('combobox', { name: 'Procurar eleito neste plenário' })
  await campo.fill('rejane')
  await expect(page.getByRole('option', { name: /Rejane Ribeiro Sousa Dias/ })).toBeVisible()
  await campo.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Rejane Ribeiro Sousa Dias' })).toBeVisible()
  await registrar(page, 'cadeira-busca')
  await page.getByRole('button', { name: 'Limpar a busca e o destaque' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Rejane Ribeiro Sousa Dias' })).toHaveCount(0)
})

