import { expect, registrar, test } from './base'

// A interface simples, aberta pela flag no endereço (), e a troca entre as duas.

test('início simples: estados em tabela, sem logo, sem rolagem lateral', async ({ page, erros: _ }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Para onde o voto pendeu' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Piauí/ })).toBeVisible()
  await expect(page.getByRole('img', { name: /Viés de Piauí/ })).toBeVisible() // o gráfico do estado
  await expect(page.getByText(/Sem dados carregados: .*SP/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Voto Aberto' })).toHaveCount(0)
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(largura).toBeLessThanOrEqual(0)
  await registrar(page, 'simples-inicio')
})

test('do estado ao município pelo filtro', async ({ page, erros: _ }) => {
  await page.goto('/uf/PI')
  await expect(page.getByRole('heading', { level: 1, name: 'Piauí' })).toBeVisible()
  await page.getByLabel('Filtrar pelo nome').fill('teresi')
  await expect(page.getByRole('img', { name: /Distribuição de 224 municípios/ })).toBeVisible()
  const tabelaMunicipios = page.getByRole('table')
  await expect(tabelaMunicipios.getByRole('row')).toHaveCount(2) // cabeçalho + Teresina
  await tabelaMunicipios.getByRole('link', { name: 'Teresina' }).click()
  await expect(page).toHaveURL(/\/uf\/PI\/2211001/)
  await expect(page.getByRole('heading', { level: 1, name: 'Teresina' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Partidos mais votados' })).toBeVisible()
  await page.getByRole('button', { name: '2018' }).click()
  await expect(page.getByRole('button', { name: '2018' })).toHaveAttribute('aria-pressed', 'true')
  await registrar(page, 'simples-municipio')
})

test('busca de município na página inicial', async ({ page, erros: _ }) => {
  await page.goto('/')
  await page.getByLabel('Buscar município').fill('parnaiba')
  await page.getByRole('link', { name: /Parnaíba/ }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Parnaíba' })).toBeVisible()
})

test('carreira de um político pela busca', async ({ page, erros: _ }) => {
  await page.goto('/urna')
  await page.getByLabel('Nome do político').fill('wellington barroso')
  await page.getByRole('link', { name: 'Jose Wellington Barroso de Araujo Dias' }).click()
  await expect(page).toHaveURL(/\/politico\/368990/)
  await expect(page.getByRole('heading', { level: 1, name: /Wellington/ })).toBeVisible()
  await expect(page.getByText('Candidaturas', { exact: true })).toBeVisible()
  await expect(page.locator('dd').first()).toHaveText('11')
  await expect(page.getByRole('cell', { name: 'Senador' }).first()).toBeVisible()
  await registrar(page, 'simples-politico')
})

test('cadeira: troca de cargo e estado pelo endereço', async ({ page, erros: _ }) => {
  await page.goto('/cadeira')
  await expect(page.getByText('Custo por cadeira', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Senador' }).click()
  await page.getByRole('button', { name: 'PI', exact: true }).click()
  await expect(page).toHaveURL(/cargo=5/)
  await expect(page).toHaveURL(/uf=PI/)
  await expect(page.getByRole('heading', { name: 'Quem se elegeu' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Wellington Barroso/ })).toBeVisible()
  await registrar(page, 'simples-cadeira')
})

test('escola: superior completo por grupo', async ({ page, erros: _ }) => {
  await page.goto('/escola')
  await expect(page.getByText('Quem votou', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '2024, municipal' }).click()
  await expect(page.getByText('Eleitos vereadores', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Diploma por partido' })).toBeVisible()
  await registrar(page, 'simples-escola')
})

test('reeleição: taxa por cargo e eleição a eleição', async ({ page, erros: _ }) => {
  test.setTimeout(90_000)
  await page.goto('/reeleicao?uf=PI')
  await expect(page.getByRole('heading', { level: 1, name: 'Quem tenta a reeleição, volta?' })).toBeVisible()
  // PI, respostas/10a_taxa_reeleicao.txt: deputado estadual 126 de 164
  await expect(page.getByText('126 de 164 que tentaram', { exact: false })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Prefeito', exact: true }).click()
  await expect(page.getByText('1996 → 2000')).toBeVisible()
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(largura).toBeLessThanOrEqual(0)
  await registrar(page, 'simples-reeleicao')
})

test('as interfaces não se comunicam: nenhuma leva à outra nem troca pelo endereço', async ({ page, erros: _ }) => {
  const completa = process.env.SITE ?? 'http://localhost:5173'

  // a simples ignora ?interface= e não tem botão nem link para a completa
  await page.goto('/escola?interface=completa')
  await expect(page.getByText('Quem votou', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'Voto Aberto' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /interface/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /interface/i })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('va-interface'))).toBeNull()

  // a completa ignora ?interface= e não tem botão para a simples
  await page.goto(`${completa}/escola?interface=simples`)
  await expect(page.getByRole('img', { name: 'Voto Aberto' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /interface/i })).toHaveCount(0)
})
