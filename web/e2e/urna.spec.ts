import { expect, registrar, test } from './base'

test('urna: digitar o nome e CONFIRMA abrem a carreira (P10)', async ({ page }) => {
  await page.goto('/urna')
  await expect(page.getByRole('heading', { name: 'Consulte a carreira de um político' })).toBeVisible()
  const nome = page.getByRole('combobox', { name: 'Nome do político' })
  await nome.fill('wellington barroso')
  const primeiro = page.getByRole('listbox', { name: 'Políticos encontrados' }).getByRole('option').first()
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
  await expect(page.getByRole('listbox', { name: 'Políticos encontrados' }).getByRole('option').first()).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'CORRIGE' }).first().click()
  await expect(nome).toHaveValue('')
})

test.describe('com movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' })
  test('a urna aparece com o mesmo teclado', async ({ page }) => {
    await page.goto('/urna')
    await expect(page.getByRole('button', { name: 'Tecla 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'CONFIRMA' }).first()).toBeVisible()
    await registrar(page, 'urna-2d')
  })
})

test('filtros: a cédula de consulta acha os políticos sem digitar nome', async ({ page }) => {
  await page.goto('/urna')
  const cedula = page.getByRole('region', { name: 'Cédula de consulta' })
  const abrir = cedula.getByRole('button', { name: 'Abrir' })
  if (await abrir.isVisible()) await abrir.click() // no celular ela começa recolhida
  await cedula.getByRole('button', { name: 'Senador', exact: true }).click()
  await cedula.getByRole('button', { name: '2022', exact: true }).click()
  await cedula.getByRole('button', { name: 'Piauí' }).click()
  await cedula.getByRole('button', { name: 'Se elegeu', exact: true }).click()
  await expect(page).toHaveURL(/cargo=5&eleicao=2022&uf=PI&resultado=eleito/)
  const lista = page.getByRole('listbox', { name: 'Políticos encontrados' }).getByRole('option')
  await expect(lista).toHaveCount(1, { timeout: 20_000 })
  await expect(lista.first()).toContainText('Jose Wellington Barroso de Araujo Dias')
  await registrar(page, 'urna-filtros')
  // marcar de novo desmarca; Limpar tira tudo
  await cedula.getByRole('button', { name: 'Senador', exact: true }).click()
  await expect(page).not.toHaveURL(/cargo=/)
  await cedula.getByRole('button', { name: 'Limpar' }).click()
  await expect(page).toHaveURL(/\/urna$/)
})
