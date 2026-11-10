import { expect, moduloAtual, registrar, test } from './base'

test('P6: o mapa sépia, as passagens de mandato, a galeria, a pirâmide e os halteres respondem "jovem vota no jovem?"', async ({ page }) => {
  test.setTimeout(120_000) // a primeira visita monta a base da P6 na API (~18 s), se não estiver em cache
  await page.goto('/idade')
  await expect(page.getByRole('heading', { level: 1, name: 'Jovem vota no jovem?' })).toBeVisible({ timeout: 60_000 })
  await moduloAtual(page, 'Idade')
  // a resposta do topo compara zonas de mesma escolaridade, com os mesmos candidatos a deputado
  await expect(page.getByText(/zonas onde quem votou é 5 anos mais velho dão votos a deputados/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('img', { name: /idade média de quem votou em 2024/ })).toBeVisible()
  await registrar(page, 'idade')

  // 2. as passagens por terço, com a fusão nas duas leituras, e a galeria de Teresina
  const ato2 = page.locator('section[aria-labelledby="ato-2"]')
  await ato2.scrollIntoViewIfNeeded()
  await expect(ato2.getByRole('heading', { name: 'Lugar mais velho troca mais de prefeito?' })).toBeVisible()
  await expect(ato2.getByRole('img', { name: /^Terço mais jovem: de .* passagens/ })).toBeVisible({ timeout: 30_000 })
  await ato2.getByRole('radio', { name: 'continuidade' }).click()
  await expect(ato2.getByRole('radio', { name: 'continuidade' })).toHaveAttribute('aria-checked', 'true')
  const galeria = ato2.getByRole('list', { name: /^Prefeitos eleitos em Teresina, de 1996 a 2024/ })
  await galeria.scrollIntoViewIfNeeded()
  // Firmino (1997 a 2004), Silvio Mendes (2005 a 2012) e Firmino Filho (2013 a 2020) foram reeleitos: 5 molduras
  await expect(galeria.getByRole('link')).toHaveCount(5)
  await expect(galeria.getByRole('link', { name: /Silvio Mendes, PSDB, mandato de 2005 a 2012 \(reeleito\)/ })).toBeVisible()
  await expect(ato2.getByText(/2 trocas de partido em 7 passagens, 3 reeleições/)).toBeVisible()
  await registrar(page, 'idade-galeria')

  // 3. a pirâmide de quem votou e dos eleitos
  const ato3 = page.locator('section[aria-labelledby="ato-3"]')
  await ato3.scrollIntoViewIfNeeded()
  await expect(ato3.getByRole('list', { name: /Pirâmide etária: quem votou e vereadores eleitos em 2024/ })).toBeVisible({ timeout: 30_000 })
  await ato3.getByRole('radio', { name: 'Prefeito' }).click()
  await expect(ato3.getByRole('list', { name: /Pirâmide etária: quem votou e prefeitos eleitos em 2024/ })).toBeVisible()

  // 4. os halteres por terço de zonas: deputado (zonas da UF) e vereador (zonas do mesmo município)
  const ato4 = page.locator('section[aria-labelledby="ato-4"]')
  await ato4.scrollIntoViewIfNeeded()
  await expect(ato4.getByText(/Para deputado federal em 2022, entre zonas da UF/)).toBeVisible({ timeout: 30_000 })
  await expect(ato4.getByRole('img', { name: /^Zonas mais jovens: quem votou/ })).toBeVisible()
  await ato4.getByRole('radio', { name: 'Vereador' }).click()
  await expect(ato4.getByText(/Para vereador em 2024, entre zonas do mesmo município/)).toBeVisible({ timeout: 30_000 })
  await ato4.getByRole('radio', { name: 'Como votaram' }).click()
  await expect(ato4.getByRole('radio', { name: 'Como votaram' })).toHaveAttribute('aria-checked', 'true')
  await registrar(page, 'idade-voto')
})

test('P6 no boletim: a galeria compacta dos prefeitos e a idade de quem votou levam à página', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/uf/PI/2211001')
  const boletim = page.getByRole('article', { name: 'Teresina' })
  await expect(boletim.getByRole('list', { name: /^Prefeitos eleitos em Teresina, de 1996 a 2024/ })).toBeVisible({ timeout: 60_000 })
  await expect(boletim.getByText('IDADE', { exact: true })).toBeVisible()
  await boletim.getByRole('link', { name: /Jovem vota no jovem\? Ver a P6/ }).click()
  await expect(page).toHaveURL(/\/idade\?.*ibge=2211001/)
  await expect(page.getByRole('heading', { level: 1, name: 'Jovem vota no jovem?' })).toBeVisible({ timeout: 60_000 })
})
