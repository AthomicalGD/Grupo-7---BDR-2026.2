import { expect, test } from './base'

test('P5: a conta das cadeiras, a fileira de cada partido e os votos de cada eleito', async ({ page, erros }) => {
  await page.goto('/cadeira/legenda?ano_p5=2022&cargo=6&uf=PI')

  await expect(page.getByRole('heading', { name: 'Como os partidos preencheram as cadeiras?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cadeira', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText(/Em 2022, Piauí, foram eleitos 10 deputados federais/)).toBeVisible()

  // a conta, com os números do Piauí em 2022: 1.959.964 votos válidos ÷ 10 cadeiras = 195.996 votos por cadeira
  await expect(page.getByRole('heading', { name: 'A conta das cadeiras' })).toBeVisible()
  const passo1 = page.getByRole('heading', { name: 'Quanto vale uma cadeira?' }).locator('xpath=ancestor::li[1]')
  await expect(passo1.getByText('1.959.964')).toBeVisible()
  await expect(passo1.getByText('195.996')).toBeVisible()
  // o PT: 699.151 votos ÷ 195.996 = 3,57 cadeiras de votos, 3 inteiras
  const passo2 = page.getByRole('heading', { name: /Quantas cadeiras cabem/ }).locator('xpath=ancestor::li[1]')
  await expect(passo2.getByText('699.151')).toBeVisible()
  await expect(passo2.getByText('3,57')).toBeVisible()
  await expect(passo2.getByText('3 inteiras')).toBeVisible()
  // as sobras: 3 cadeiras, a primeira do PT com 699.151 ÷ 4 = 174.788
  await expect(page.getByRole('heading', { name: /Quem leva as 3 que sobraram/ })).toBeVisible()
  await expect(page.getByText('174.788').first()).toBeVisible()

  // a fileira do PT: 3 pelo quociente e 1 pela sobra, com os votos dele
  await expect(page.getByText('3,57 cadeiras de votos').first()).toBeVisible()
  await page.getByRole('button', { name: /^PT: .* eleitos pelo quociente/ }).click()
  const rejane = page.getByRole('link', { name: /Rejane Dias, PT, .* votos, ELEITO POR QP/ })
  await expect(rejane).toBeVisible()
  await expect(rejane.getByText('125.774')).toBeVisible()
  await expect(rejane.getByText('ELEITO PELO')).toBeVisible()
  await expect(page.getByText('mais votado').first()).toBeVisible()

  await page.getByRole('radio', { name: 'Deputado estadual' }).click()
  await expect(page).toHaveURL(/cargo=7/)
  await expect(page.getByText(/foram eleitos 30 deputados estaduais/)).toBeVisible()
  expect(erros).toEqual([])
})

test('P5: o partido que só tem cadeira por estar numa federação vem marcado', async ({ page }) => {
  await page.goto('/cadeira/legenda?ano_p5=2022&cargo=6&uf=PI')
  await expect(page.getByText('federação', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/partidos em federação somam votos/)).toBeVisible()
})

test('P5: Ctrl + clique junta estados e o botão Juntar estados faz o mesmo sem o Ctrl', async ({ page }) => {
  await page.goto('/cadeira/legenda?ano_p5=2022&cargo=6')
  const estados = page.getByRole('group', { name: 'Estados' })
  await estados.getByRole('button', { name: 'Piauí', exact: true }).click()
  await expect(page.getByText(/Em 2022, Piauí, foram eleitos 10 deputados federais/)).toBeVisible()

  await estados.getByRole('button', { name: 'Bahia', exact: true }).click({ modifiers: ['Control'] })
  await expect(page).toHaveURL(/uf=PI(%2C|,)BA/)
  await expect(estados.getByRole('button', { name: 'Piauí', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(estados.getByRole('button', { name: 'Bahia', exact: true })).toHaveAttribute('aria-pressed', 'true')
  // 10 do Piauí + 39 da Bahia, e a conta mostra um estado de cada vez
  await expect(page.getByText(/Em 2022, Piauí \+ Bahia, foram eleitos 49 deputados federais/)).toBeVisible()
  await page.getByRole('radio', { name: 'Bahia' }).click()
  await expect(page.getByText(/Bahia · 2022 · deputado federal/)).toBeVisible()

  // sem o Ctrl, o botão "Juntar estados" acrescenta mais um
  await page.getByRole('button', { name: /Juntar estados/ }).click()
  await estados.getByRole('button', { name: 'Ceará', exact: true }).click()
  await expect(estados.getByRole('button', { name: 'Ceará', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(estados.getByRole('button', { name: 'Bahia', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // um clique comum volta a um estado só
  await page.getByRole('button', { name: /Juntar estados/ }).click()
  await estados.getByRole('button', { name: 'Ceará', exact: true }).click()
  await expect(page).toHaveURL(/uf=CE(&|$)/)
})

test('P3: os Índices aceitam vários estados e somam os municípios', async ({ page }) => {
  await page.goto('/indices?uf=PI')
  const dispersao = page.getByRole('img', { name: /^Dispersão de .* municípios/ }).first()
  await expect(dispersao).toHaveAttribute('aria-label', /Dispersão de 223 municípios no Piauí/, { timeout: 60_000 })
  await page.getByRole('group', { name: 'Estados' }).getByRole('button', { name: 'Bahia', exact: true }).click({ modifiers: ['Control'] })
  await expect(page).toHaveURL(/uf=PI(%2C|,)BA/)
  await expect(dispersao).toHaveAttribute('aria-label', /Dispersão de 640 municípios nos 2 estados/, { timeout: 60_000 })
})
