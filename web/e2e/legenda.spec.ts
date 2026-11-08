import { expect, test } from './base'

test('P5: filtra partidos, abre os eleitos e usa o carimbo com a categoria oficial', async ({ page, erros }) => {
  await page.goto('/cadeira/legenda?ano_p5=2022&cargo=6&uf=PI')

  await expect(page.getByRole('heading', { name: 'Como os partidos preencheram as cadeiras?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cadeira', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText(/Em 2022, Piauí, foram eleitos 10 deputados federais/)).toBeVisible()

  const qp = page.getByRole('button', { name: /^PT: .* eleitos pelo quociente/ })
  await qp.click()
  await expect(page.getByText('REJANE DIAS', { exact: false }).first()).toBeVisible()
  const rejane = page.getByRole('link', { name: /Rejane Dias, PT, ELEITO POR QP/ })
  await expect(rejane.getByText('ELEITO PELO')).toBeVisible()
  await expect(page.getByText('Classificação TSE: ELEITO POR QP').first()).toBeVisible()

  await page.getByRole('radio', { name: 'Deputado estadual' }).click()
  await expect(page).toHaveURL(/cargo=7/)
  await expect(page.getByText(/foram eleitos 30 deputados estaduais/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(erros).toEqual([])
})

test('P5: a tela avisa quando partidos ou federações somaram votos', async ({ page }) => {
  await page.goto('/cadeira/legenda?ano_p5=2024&cargo=13&uf=PI')
  await page.getByText('O que significam quociente e médias?').click()
  await expect(page.getByText(/federações/)).toBeVisible()
  await expect(page.getByText(/não é atribuído individualmente a um candidato/)).toBeVisible()
})
