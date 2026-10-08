import { expect, registrar, test } from './base'

test('P4: o caderno, os santinhos, o plenário e o boletim respondem com os números da resposta', async ({ page }) => {
  await page.goto('/escola')
  await expect(page.getByRole('heading', { name: 'Quanto estudou quem senta na cadeira?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Escola', exact: true })).toHaveAttribute('aria-current', 'page')
  // abre em 2022 (respostas/04_escolaridade.txt): superior completo é 11% de quem votou, 53% dos candidatos e 79% dos eleitos
  await expect(page.getByText(/superior completo era 11% de quem votou, 53% de quem se candidatou e 79% de quem se elegeu/)).toBeVisible()
  await registrar(page, 'escola')

  // os três objetos dizem de cada 100 com superior completo: 11, 53 e 79
  await expect(page.getByRole('img', { name: /Quem se elegeu: de cada 100, 79 com superior completo/ })).toBeVisible()
  // destacar outro grau muda os três números e a frase
  await page.getByRole('radio', { name: 'Médio completo', exact: true }).click()
  await expect(page.getByText(/Médio completo:.*de quem votou/)).toBeVisible()
  // 2022: deputado é eleito pelo estado, então o lugar mostra em quem o município votou
  await expect(page.getByRole('heading', { name: 'O lugar e em quem ele vota' })).toBeVisible()

  await page.getByRole('radio', { name: /2024/ }).click()
  await expect(page.getByText(/27% de quem se candidatou e 36% de quem se elegeu/)).toBeVisible({ timeout: 20_000 })

  // vereador: 20 de cada 100 com superior completo se elegeram; prefeito: 40
  const santinhos = page.locator('section[aria-labelledby="santinhos-p4"]')
  await santinhos.scrollIntoViewIfNeeded()
  await expect(santinhos.getByRole('button', { name: /^Superior completo: 20 de cada 100/ })).toBeVisible()
  await santinhos.getByRole('radio', { name: 'Prefeito' }).click()
  await expect(santinhos.getByRole('button', { name: /^Superior completo: 40 de cada 100/ })).toBeVisible()

  // o lugar: o boletim de Teresina, 29 vereadores e o prefeito, cada cadeira leva à carreira
  const lugar = page.locator('section[aria-labelledby="lugar-p4"]')
  await lugar.scrollIntoViewIfNeeded()
  await expect(lugar.getByRole('article', { name: 'Boletim da escolaridade de Teresina' })).toBeVisible({ timeout: 20_000 })
  await expect(lugar.getByRole('group', { name: 'Câmara eleita' }).getByRole('link')).toHaveCount(30)
  await expect(lugar.getByText(/18 de 29/).first()).toBeVisible()
  await registrar(page, 'escola-lugar')

  // as outras vistas: cargos e estados lado a lado, partidos, mapa, dispersão e ranking
  await expect(page.getByRole('heading', { name: 'Cada cadeira, cada estado' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Os partidos e o diploma' })).toBeVisible()
  await expect(lugar.locator('svg[aria-label^="Mapa:"] path[data-ibge]').first()).toBeVisible({ timeout: 30_000 })
  await lugar.getByRole('radio', { name: 'Dispersão' }).click()
  await expect(lugar.getByRole('img', { name: /^Dispersão dos/ })).toBeVisible()
  // o ranking abre o boletim do município escolhido
  const primeiro = lugar.getByRole('button', { name: /Abrir o boletim/ }).first()
  const nome = (await primeiro.getAttribute('aria-label'))!.split(' (')[0]
  await primeiro.click()
  await expect(lugar.getByRole('article', { name: `Boletim da escolaridade de ${nome}` })).toBeVisible({ timeout: 20_000 })
})

test('P4: o filtro por estado recorta a página e abre o boletim na capital', async ({ page }) => {
  await page.goto('/escola')
  await page.getByRole('radio', { name: 'Bahia' }).click()
  await expect(page.getByText(/Em 2022, na Bahia, quem se elegeu tinha/)).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/uf=BA/)
  const lugar = page.locator('section[aria-labelledby="lugar-p4"]')
  await lugar.scrollIntoViewIfNeeded()
  await expect(lugar.getByRole('article', { name: 'Boletim da escolaridade de Salvador' })).toBeVisible({ timeout: 20_000 })
  await expect(lugar.getByText(/417 municípios/).first()).toBeVisible()
})
