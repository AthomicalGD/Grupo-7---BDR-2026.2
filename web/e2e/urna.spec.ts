import { expect, registrar, test } from './base'

test('urna: digitar o nome e CONFIRMA abrem a carreira (P10)', async ({ page }) => {
  await page.goto('/urna')
  await expect(page.getByRole('heading', { name: 'Consulte a carreira de um político' })).toBeVisible()
  const nome = page.getByRole('combobox', { name: 'Nome do político' })
  await nome.fill('wellington barroso')
  const primeiro = page.getByRole('option').first()
  // folga maior: no Chromium de teste a urna 3D é renderizada pela CPU (SwiftShader)
  await expect(primeiro).toContainText('Jose Wellington Barroso de Araujo Dias', { timeout: 20_000 })
  await expect(primeiro).toContainText('11 eleições')
  await registrar(page, 'urna')

  await nome.press('Enter')
  await expect(page).toHaveURL(/\/politico\/368990/, { timeout: 6_000 })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Wellington Barroso')
  await expect(page.getByRole('img', { name: /^Trajetória por cargo/ })).toBeVisible()
  await expect(page.locator('section[aria-labelledby="santinhos"] li')).toHaveCount(11)
  await expect(page.getByText('em mandato de senador até 2030')).toBeVisible()
  await registrar(page, 'carreira')
})

test('BRANCO sorteia um político e CORRIGE apaga', async ({ page }) => {
  await page.goto('/urna')
  const nome = page.getByRole('combobox', { name: 'Nome do político' })
  await page.getByRole('button', { name: /BRANCO sorteia/ }).click()
  await expect(nome).not.toHaveValue('')
  await expect(page.getByRole('option').first()).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'CORRIGE' }).click()
  await expect(nome).toHaveValue('')
})

test.describe('com movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' })
  test('a urna aparece em 2D, com o mesmo teclado', async ({ page }) => {
    await page.goto('/urna')
    await expect(page.getByRole('button', { name: 'Tecla 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'CONFIRMA' }).first()).toBeVisible()
    await registrar(page, 'urna-2d')
  })
})
