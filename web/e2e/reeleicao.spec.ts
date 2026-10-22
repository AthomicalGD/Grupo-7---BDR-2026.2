import { expect, registrar, test } from './base'

test('P10a: a urna, todos os estados e quem são', async ({ page }) => {
  // a primeira conta de cada estado leva alguns segundos na API
  test.setTimeout(150_000)
  const pi = await (await page.request.get('/api/reeleicao?uf=PI', { timeout: 120_000 })).json()
  const vereador = pi.cargos.find((c: { cod: number }) => c.cod === 13).total
  const mil = (n: number) => n.toLocaleString('pt-BR')

  // sem estado no endereço, a página soma todos os carregados
  await page.goto('/reeleicao')
  await expect(page.getByRole('button', { name: /^Estado: todos os \d+ estados/ })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/^Nos \d+ estados carregados, dos /)).toBeVisible({ timeout: 90_000 })

  // o seletor de estado abre o minimapa; escolher um estado fecha a gaveta e vai para o endereço
  await page.getByRole('button', { name: /^Estado: / }).click()
  await page.getByRole('dialog', { name: 'Escolher o estado' }).getByRole('radio', { name: 'Piauí' }).click()
  await expect(page).toHaveURL(/uf=PI/)
  await expect(page.getByRole('button', { name: /^Estado: Piauí/ })).toBeVisible()

  await page.goto('/reeleicao?uf=PI&cargo=13')
  await expect(page.getByRole('radio', { name: /^Vereador: / })).toBeChecked({ timeout: 30_000 })
  await registrar(page, 'reeleicao')

  // colocar na urna leva as cédulas de quem tentou; apurar mostra a taxa
  await page.getByRole('button', { name: 'Colocar na urna' }).click()
  await expect(page.getByRole('img', { name: /tentaram a reeleição e entraram na urna/ })).toBeVisible()
  await page.getByRole('button', { name: 'Apurar' }).click()
  await expect(page.getByText(`a reeleição no Piauí voltaram (${mil(vereador.reeleitos)} de ${mil(vereador.tentaram)},`, { exact: false })).toBeVisible()
  await registrar(page, 'reeleicao-apurada')

  // tocar em quem voltou abre a subtela; "Mostrar mais" traz mais seis
  await page.getByRole('button', { name: /^\d+% dos eleitos voltaram/ }).click()
  const voltaram = page.locator('#quem-sao').getByRole('region', { name: 'Voltaram' })
  await expect(voltaram.getByRole('link')).toHaveCount(6, { timeout: 30_000 })
  await voltaram.getByRole('button', { name: /^Mostrar mais/ }).click()
  await expect(voltaram.getByRole('link')).toHaveCount(12)
  await registrar(page, 'reeleicao-quem-sao')

  // escolher outro cargo troca a urna; cada urna da fila é uma eleição e troca a da subtela
  await page.getByRole('radio', { name: /^Prefeito: / }).click()
  await expect(page).toHaveURL(/cargo=11/)
  const ciclos = page.getByRole('region', { name: 'Eleição a eleição' })
  await ciclos.getByRole('button', { name: /^Disputa de 2000, eleitos em 1996: .* média dos municípios/ }).click()
  await expect(page.locator('#quem-sao').getByText('Eleitos em 1996, e o que fizeram na eleição de 2000.')).toBeVisible()

  // estado a estado: tocar na silhueta abre a ficha do estado; o botão da ficha troca a página inteira
  const estados = page.getByRole('region', { name: 'Estado a estado' })
  await estados.scrollIntoViewIfNeeded()
  await estados.getByRole('radio', { name: 'Bahia', exact: true }).click({ timeout: 90_000 })
  await expect(estados.getByRole('heading', { name: 'Bahia' })).toBeVisible()
  await expect(estados.getByText(/dos que tentaram se reeleger na Bahia voltaram/)).toBeVisible()
  await registrar(page, 'reeleicao-estado')
  await estados.getByRole('button', { name: 'Ver a página toda na Bahia' }).click()
  await expect(page).toHaveURL(/uf=BA/)
  await expect(page.getByText(/^Na Bahia, dos /)).toBeVisible({ timeout: 60_000 })
})

test('P10a: a carreira do político leva à taxa do cargo dele', async ({ page }) => {
  test.setTimeout(90_000)
  // o id muda a cada carga do banco: procura pelo nome (senador no PI, última candidatura em 2022)
  const [wd] = await (await page.request.get('/api/politicos?q=wellington%20barroso%20de%20araujo&limite=1')).json()
  await page.goto(`/politico/${wd.id}`)
  await page.getByRole('link', { name: 'Reeleição por cargo e estado' }).click()
  await expect(page).toHaveURL(/\/reeleicao\?.*uf=PI.*cargo=5|\/reeleicao\?.*cargo=5.*uf=PI/)
  await expect(page.getByRole('radio', { name: /^Senador: / })).toBeChecked({ timeout: 30_000 })
})
