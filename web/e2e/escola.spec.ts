import { expect, registrar, test } from './base'

test('P4: o caderno, os santinhos, o plenário e o boletim respondem as perguntas A e B com os números da resposta', async ({ page }) => {
  test.setTimeout(90_000) // percorre a página toda: régua, chance, mapa por estado, boletim e ranking
  await page.goto('/escola')
  await expect(page.getByRole('heading', { name: 'Quanto estudou quem senta na cadeira?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Escola', exact: true })).toHaveAttribute('aria-current', 'page')
  // abre em 2022: superior completo é 9% de quem votou, 52% dos candidatos e 77% dos eleitos (AC, BA, GO, PA, PE, PI)
  await expect(page.getByText(/superior completo era 9% de quem votou, 52% de quem se candidatou e 77% de quem se elegeu/)).toBeVisible()
  await registrar(page, 'escola')

  // a régua diz o % com superior completo: 9, 52 e 77
  await expect(page.getByRole('img', { name: /Quem se elegeu: 77% com superior completo/ })).toBeVisible()
  // destacar outro grau muda os três números e a frase; a (A) responde com a chance de cada grau
  await page.getByRole('radio', { name: 'Médio completo', exact: true }).click()
  await expect(page.getByText(/Médio completo:.*de quem votou/)).toBeVisible()
  // 2022: deputado é eleito pelo estado, então o lugar mostra em quem o município votou
  await expect(page.getByRole('heading', { name: 'Onde se estudou menos, se elege menos diploma?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O diploma ajuda a se eleger?' })).toBeVisible()

  await page.getByRole('radio', { name: /2024/ }).click()
  await expect(page.getByText(/26% de quem se candidatou e 34% de quem se elegeu/)).toBeVisible({ timeout: 20_000 })

  // um só seletor de cargo para a régua e a chance: vereador, 19% dos candidatos com superior completo se elegeram; prefeito, 40%
  const santinhos = page.locator('section[aria-labelledby="santinhos-p4"]')
  const cargo = page.getByRole('radiogroup', { name: 'Cargo', exact: true })
  await cargo.getByRole('radio', { name: 'Vereador' }).click()
  await santinhos.scrollIntoViewIfNeeded()
  await expect(santinhos.getByRole('button', { name: /^Superior completo: 19% dos candidatos/ })).toBeVisible()
  await cargo.getByRole('radio', { name: 'Prefeito' }).click()
  await expect(santinhos.getByRole('button', { name: /^Superior completo: 40% dos candidatos/ })).toBeVisible()

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
  // o mapa abre nos estados; clicar num estado leva a câmera até ele e abre os municípios
  const mapa = lugar.locator('svg[aria-label^="Mapa:"]')
  await expect(mapa.locator('path[data-uf="22"]')).toBeVisible({ timeout: 30_000 })
  await mapa.locator('path[data-uf="22"]').click()
  await expect(lugar.getByRole('button', { name: 'Todos os estados' })).toBeVisible()
  await expect(mapa.locator('path[data-ibge]').first()).toBeVisible()
  await lugar.getByRole('radio', { name: 'Eleitores' }).click()
  await expect(lugar.getByText(/Piauí.*de quem votou com superior completo/)).toBeVisible()
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
  await page.getByRole('button', { name: /^Estado: / }).click({ timeout: 30_000 })
  await page.getByRole('dialog', { name: 'Escolher o estado' }).getByRole('radio', { name: 'Bahia' }).click()
  await expect(page.getByText(/Em 2022, na Bahia, quem se elegeu tinha/)).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/uf=BA/)
  const lugar = page.locator('section[aria-labelledby="lugar-p4"]')
  await lugar.scrollIntoViewIfNeeded()
  await expect(lugar.getByRole('article', { name: 'Boletim da escolaridade de Salvador' })).toBeVisible({ timeout: 20_000 })
  await expect(lugar.getByText(/417 municípios/).first()).toBeVisible()
})
