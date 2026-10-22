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
  await expect(page.getByText(/Em mandato · senador até 2030/)).toBeVisible()
  await registrar(page, 'carreira')

  // santinho de 2022: nome de urna e número do TSE; vira para a cola com o foco no verso
  const santinho = page.locator('section[aria-labelledby="santinhos"] li').first()
  await expect(santinho.getByText('WELLINGTON DIAS')).toBeVisible()
  await expect(santinho.getByLabel('número 131').first()).toBeVisible()
  await santinho.getByRole('button', { name: 'Virar o santinho de 2022 e ver a cola' }).click()
  await expect(santinho.getByRole('button', { name: 'Desvirar o santinho' })).toBeFocused()
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

test('filtros: as fichas acham os políticos sem digitar nome', async ({ page }) => {
  await page.goto('/urna')
  const filtros = page.getByRole('group', { name: 'Filtros da busca' })
  await filtros.getByRole('button', { name: 'Cargo' }).click()
  await page.getByRole('menuitemradio', { name: 'Senador' }).click()
  await filtros.getByRole('button', { name: 'Eleição' }).click()
  await page.getByRole('menuitemradio', { name: '2022' }).click()
  await filtros.getByRole('button', { name: 'Estado' }).click()
  await page.getByRole('dialog', { name: 'Estado' }).getByRole('radio', { name: 'Piauí' }).click()
  await filtros.getByRole('button', { name: 'Resultado' }).click()
  await page.getByRole('menuitemradio', { name: 'Se elegeu', exact: true }).click()
  await expect(page).toHaveURL(/cargo=5&eleicao=2022&uf=PI&resultado=eleito/)
  const lista = page.getByRole('listbox', { name: 'Políticos encontrados' }).getByRole('option')
  await expect(lista).toHaveCount(1, { timeout: 20_000 })
  await expect(lista.first()).toContainText('Jose Wellington Barroso de Araujo Dias')
  await registrar(page, 'urna-filtros')
  // o x da ficha tira o filtro; Limpar tira tudo
  await filtros.getByRole('button', { name: /Tirar o filtro cargo/ }).click()
  await expect(page).not.toHaveURL(/cargo=/)
  await filtros.getByRole('button', { name: 'Limpar' }).click()
  await expect(page).toHaveURL(/\/urna$/)
})

test('filtros: "mais" traz 6 de cada vez, sem mexer nos que já estavam, até o teto da API', async ({ page }) => {
  // deputado federal no PI em 1998: 63 candidaturas, mais que o teto de 50 da busca
  await page.goto('/urna?cargo=6&eleicao=1998&uf=PI')
  const lista = page.getByRole('listbox', { name: 'Políticos encontrados' }).getByRole('option')
  await expect(lista).toHaveCount(6, { timeout: 20_000 })
  const primeiros = await lista.allTextContents()
  const mais = page.getByRole('button', { name: 'Mais 6' })
  await mais.click()
  await expect(lista).toHaveCount(12)
  expect((await lista.allTextContents()).slice(0, 6)).toEqual(primeiros)
  // o visor foi para a página dos novos: a tecla 1 escolhe o 7º da lista
  await expect(lista.nth(6)).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('combobox', { name: 'Nome do político' }).press('2')
  await expect(lista.nth(7)).toHaveAttribute('aria-selected', 'true')
  await registrar(page, 'urna-mais')
  for (let n = 18; n <= 48; n += 6) {
    await mais.click()
    await expect(lista).toHaveCount(n)
  }
  await page.getByRole('button', { name: 'Mais 2' }).click()
  await expect(lista).toHaveCount(50)
  await expect(page.getByText(/Mostrando os 50 primeiros/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Mais/ })).toHaveCount(0)
})
