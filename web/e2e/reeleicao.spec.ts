import { expect, registrar, test } from './base'

test('P10a: a taxa por cargo e eleição bate com a resposta', async ({ page }) => {
  // a primeira conta de cada estado leva alguns segundos na API
  test.setTimeout(90_000)
  await page.goto('/reeleicao?uf=PI')
  await expect(page.getByRole('heading', { name: 'Quem tenta a reeleição, volta?' })).toBeVisible()
  // PI, respostas/10a_taxa_reeleicao.txt: deputado estadual 126 de 164 (76,8%), vereador 7.070 de 10.934
  const porCargo = page.getByRole('region', { name: 'De cada 100 eleitos, na eleição seguinte' })
  await expect(porCargo.getByRole('button', { name: /^Deputado estadual: .* 164 tentaram .* 126 voltaram \(77%\)/ })).toBeVisible({ timeout: 30_000 })
  await expect(porCargo.getByText('7.070 de 10.934 que tentaram')).toBeVisible()
  await registrar(page, 'reeleicao')

  // escolher um cargo abre as eleições dele; prefeito tem a média dos municípios
  await porCargo.getByRole('button', { name: /^Prefeito:/ }).click()
  await expect(page).toHaveURL(/cargo=11/)
  const ciclos = page.getByRole('region', { name: 'Eleição a eleição' })
  await expect(ciclos.getByRole('listitem', { name: /^Disputa de 2000, eleitos em 1996: 113 de 158 .* média dos municípios 71,5%/ })).toBeVisible()
  // o ano em destaque é o da disputa: não há coluna de 1996 (o banco não tem os eleitos de 1992)
  await expect(ciclos.getByRole('listitem', { name: /^Disputa de 1996/ })).toHaveCount(0)
  await ciclos.getByRole('button', { name: 'Ver tabela' }).click()
  await expect(ciclos.getByRole('row', { name: /^2000 1996 221 158 / })).toBeVisible()
  await expect(ciclos.getByRole('row', { name: /^Total 1\.558 825 .* 562 68,1% 71,8%$/ })).toBeVisible()
  await registrar(page, 'reeleicao-ciclos')

  // estado a estado: escolher outro estado na tabela troca a página inteira
  const estados = page.getByRole('region', { name: 'Estado a estado' })
  await estados.scrollIntoViewIfNeeded()
  await expect(estados.getByRole('row', { name: /^Vereador/ })).toBeVisible({ timeout: 60_000 })
  await estados.getByRole('button', { name: 'BA', exact: true }).click()
  await expect(page).toHaveURL(/uf=BA/)
  await expect(page.getByText(/^Na Bahia, dos /)).toBeVisible({ timeout: 30_000 })
})

test('P10a: a carreira do político leva à taxa do cargo dele', async ({ page }) => {
  test.setTimeout(90_000)
  // o id muda a cada carga do banco: procura pelo nome (senador no PI, última candidatura em 2022)
  const [wd] = await (await page.request.get('/api/politicos?q=wellington%20barroso%20de%20araujo&limite=1')).json()
  await page.goto(`/politico/${wd.id}`)
  await page.getByRole('link', { name: 'Reeleição por cargo e estado' }).click()
  await expect(page).toHaveURL(/\/reeleicao\?.*uf=PI.*cargo=5|\/reeleicao\?.*cargo=5.*uf=PI/)
  await expect(page.getByRole('radio', { name: 'Senador', checked: true })).toBeVisible({ timeout: 30_000 })
})
