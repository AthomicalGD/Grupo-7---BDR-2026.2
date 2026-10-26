import { expect, registrar, test } from './base'

test('P12: a trança, as fichas e a disputa aberta do 2º turno', async ({ page }) => {
  // a primeira conta junta os dois turnos de todas as disputas (alguns segundos na API)
  test.setTimeout(150_000)
  const api = await (await page.request.get('/api/segundo-turno', { timeout: 120_000 })).json()
  const total = api.disputas.length
  const viradas = api.disputas.filter((d: { virada: boolean }) => d.virada).length

  // a abertura diz quantas disputas e quantas viradas, e a trança tem uma linha por disputa
  await page.goto('/segundo-turno')
  await expect(page.getByRole('heading', { name: 'O que muda no 2º turno?' })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(`${total} segundos turnos`)).toBeVisible()
  await expect(page.getByRole('img', { name: new RegExp(`${viradas} das ${total} linhas`) })).toBeVisible()
  // sem disputa no endereço, abre a maior virada
  await expect(page.locator('#disputa-titulo')).toBeVisible()
  await registrar(page, 'segundo-turno')

  // os filtros vão para o endereço e contam as fichas
  await page.getByRole('radio', { name: 'Governador' }).click()
  await page.getByRole('button', { name: 'Só as viradas' }).click()
  await expect(page).toHaveURL(/cargo=3/)
  await expect(page).toHaveURL(/viradas=true/)
  const govViradas = api.disputas.filter((d: { cod_cargo: number; virada: boolean }) => d.cod_cargo === 3 && d.virada).length
  await expect(page.getByRole('heading', { name: `${govViradas} de ${total} disputas` })).toBeVisible()

  // abrir uma ficha leva a disputa para o endereço e mostra o mapa de onde o líder mudou
  const ficha = page.locator('section[aria-labelledby="todas"] .grid button[aria-pressed]').first()
  await ficha.click()
  await expect(page).toHaveURL(/d=\d+/)
  await expect(page.locator('#disputa-titulo')).toHaveText(/^Governo /)
  await expect(page.getByRole('img', { name: /^Mapa: o líder mudou em \d+ de \d+ municípios/ })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('radio', { name: '1º turno' }).click()
  await expect(page.getByRole('radio', { name: '1º turno' })).toBeChecked()
  await registrar(page, 'segundo-turno-disputa')

  // uma busca sem resultado avisa e deixa limpar os filtros
  await page.getByPlaceholder('Cidade, estado, candidato ou partido').fill('zzzz')
  await expect(page.getByText('Nenhuma disputa com esses filtros.')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar os filtros' }).click()
  await expect(page.getByRole('heading', { name: `As ${total} disputas` })).toBeVisible()
})
