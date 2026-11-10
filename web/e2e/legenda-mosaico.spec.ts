import { cabeNaTela, expect, registrar, test } from './base'

// P5 (/cadeira/legenda): o veredito da concentração e o mosaico de cadeiras; estados vazio e de erro.
test('P5: o veredito conta quantos partidos juntam metade das cadeiras e o mosaico abre os eleitos', async ({ page, erros }) => {
  await page.goto('/cadeira/legenda?ano_p5=2022&cargo=6&uf=PI')
  await expect(page.getByRole('heading', { level: 1, name: 'Como os partidos preencheram as cadeiras?' })).toBeVisible()
  // o veredito: um número de partidos na peça amarela, e a frase com quem são
  await expect(page.getByText(/(ficaram|sozinho ficou) com metade das cadeiras/)).toBeVisible()
  await expect(page.getByRole('img', { name: /^Mosaico: / })).toBeVisible()
  // clicar numa peça do mosaico abre os eleitos do partido na lista de baixo
  await page.locator('[title^="PT:"]').first().click()
  await expect(page.getByRole('button', { name: /^PT: .* eleitos pelo quociente/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('REJANE DIAS', { exact: false }).first()).toBeVisible()
  await cabeNaTela(page)
  await registrar(page, 'legenda-mosaico')
  expect(erros).toEqual([])
})

test('P5: sem resultado proporcional no recorte, a tela diz isso em vez de ficar em branco', async ({ page }) => {
  await page.route('**/api/legenda**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ufs: [], recortes: [] }) }))
  await page.goto('/cadeira/legenda')
  await expect(page.getByText('Não há resultados proporcionais neste recorte.')).toBeVisible({ timeout: 30_000 })
})

test('P5: se a API falha, o erro aparece com o botão de tentar de novo', async ({ page }) => {
  await page.route('**/api/legenda**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"erro de teste"}' }))
  await page.goto('/cadeira/legenda')
  await expect(page.getByRole('alert').getByText('Os dados não chegaram')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
})
