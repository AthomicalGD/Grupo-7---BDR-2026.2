import { expect, registrar, test } from './base'

test('P2: quebrar o cofrinho, separar pelos bens e ver quem se elegeu', async ({ page }) => {
  test.setTimeout(90_000)
  const vereador = await (await page.request.get('/api/patrimonio?ano=2024&cargo=13')).json()
  const q4 = vereador.grupos.find((g: { id: string }) => g.id === 'q4')
  const mil = (n: number) => n.toLocaleString('pt-BR')

  // sem nada no endereço: vereador em 2024, todos os estados carregados
  await page.goto('/patrimonio')
  await expect(page.getByRole('radio', { name: /^Vereador, 2024: / })).toBeChecked({ timeout: 30_000 })
  await expect(page.getByText(/^Sim, em quase todas as disputas\./)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(mil(vereador.resumo.candidatos), { exact: true })).toBeVisible()
  await registrar(page, 'patrimonio')

  // o porquinho é um botão: quebrar mostra as sacolas; o passo seguinte empilha as moedas dos eleitos
  await page.getByRole('button', { name: /^Quebrar o cofrinho e separar/ }).click()
  await expect(page.getByText('Quatro sacolas com o mesmo número de candidatos')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Separar pelos bens' })).toHaveAttribute('aria-current', 'step')
  await registrar(page, 'patrimonio-sacolas')
  await page.getByRole('button', { name: 'Ver quem se elegeu' }).last().click()
  await expect(page.getByText(`(${mil(q4.eleitos)} de ${mil(q4.candidatos)})`, { exact: false })).toBeVisible()
  await registrar(page, 'patrimonio-eleitos')

  // outro cargo mantém o passo; montar de novo volta ao cofrinho inteiro
  await page.getByRole('radio', { name: /^Prefeito, 2024: / }).click()
  await expect(page).toHaveURL(/cargo=11/)
  await page.getByRole('button', { name: 'Montar o cofrinho de novo' }).click()
  await expect(page.getByRole('button', { name: /^Quebrar o cofrinho e separar/ })).toBeVisible()

  // cada escadinha abre a sua disputa no cofrinho; Presidente 2018 avisa que são poucos candidatos
  const todos = page.getByRole('region', { name: 'Vale para todos os cargos?' })
  await todos.scrollIntoViewIfNeeded()
  await todos.getByRole('button', { name: /^Presidente, 2018: / }).click()
  await expect(page).toHaveURL(/ano=2018/)
  await expect(page.getByRole('radio', { name: /^Presidente, 2018: / })).toBeChecked()
  await page.getByRole('button', { name: /^Quebrar o cofrinho e separar/ }).click()
  await page.getByRole('button', { name: 'Ver quem se elegeu' }).last().click()
  await expect(page.getByText('Poucos candidatos:')).toBeVisible()
  await registrar(page, 'patrimonio-presidente')
})
