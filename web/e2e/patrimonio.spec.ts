import { expect, registrar, test } from './base'

test('P2: martelar o cofrinho, cortar a fila, dar o palpite e ver quem se elegeu', async ({ page }) => {
  test.setTimeout(90_000)
  const vereador = await (await page.request.get('/api/patrimonio?ano=2024&cargo=13')).json()
  const q4 = vereador.grupos.find((g: { id: string }) => g.id === 'q4')
  const mil = (n: number) => n.toLocaleString('pt-BR')
  expect(vereador.fila).toHaveLength(100)

  // sem nada no endereço: vereador em 2024, todos os estados carregados
  await page.goto('/patrimonio')
  await expect(page.getByRole('button', { name: 'Cargo: Vereador. Trocar' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('disputas em que quem declarou mais bens se elegeu mais')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(mil(vereador.resumo.candidatos), { exact: true })).toBeVisible()
  await registrar(page, 'patrimonio')

  // três marteladas no porquinho: as duas primeiras racham, a terceira quebra e a fila aparece
  const porquinho = page.getByRole('button', { name: /^Martelar o cofrinho/ })
  await porquinho.click()
  await expect(page.getByText('1 de 3 marteladas')).toBeVisible()
  await porquinho.click()
  await porquinho.click()
  await expect(page.getByRole('button', { name: 'A fila', exact: true })).toHaveAttribute('aria-current', 'step')
  await expect(page.getByText(/A fila dos candidatos a vereador/)).toBeVisible()
  await registrar(page, 'patrimonio-fila')

  // a tesoura corta em quatro grupos; o palpite é tocar num deles
  await page.getByRole('button', { name: 'Cortar a fila' }).click()
  await expect(page.getByText('4 grupos com o mesmo número de pessoas.')).toBeVisible()
  await page.getByRole('button', { name: /^Palpite: Os 25% com mais bens/ }).click()
  await expect(page.getByText('Você acertou o palpite!')).toBeVisible()
  await expect(page.getByText(`(${mil(q4.eleitos)} de ${mil(q4.candidatos)})`, { exact: false })).toBeVisible()
  await registrar(page, 'patrimonio-eleitos')

  // "E você?": um exemplo mostra o grupo e a chance dele
  await page.getByRole('button', { name: /^Fazenda/ }).click()
  await expect(page.getByText(/você estaria entre os 25% com mais bens/)).toBeVisible()

  // a frase do recorte: o minimapa escolhe o estado; tocar de novo volta a todos
  await page.getByRole('button', { name: /^Estado: / }).click()
  await page.getByRole('radio', { name: 'Bahia', exact: true }).click()
  await expect(page).toHaveURL(/uf=BA/)
  await page.getByRole('button', { name: /^Estado: / }).click()
  await page.getByRole('radio', { name: 'Bahia', exact: true }).click()
  await expect(page).not.toHaveURL(/uf=BA/)

  // outro cargo apaga o palpite; montar de novo volta ao cofrinho inteiro
  await page.getByRole('button', { name: /^Cargo: / }).click()
  await page.getByRole('radio', { name: /^Prefeito/ }).click()
  await expect(page).toHaveURL(/cargo=11/)
  await expect(page.getByText('Você acertou o palpite!')).toHaveCount(0)
  await page.getByRole('button', { name: 'Montar o cofrinho de novo' }).click()
  await expect(porquinho).toBeVisible()

  // cada escadinha abre a sua disputa; com poucos candidatos, a cena mostra as pessoas de verdade
  const todos = page.getByRole('region', { name: 'Vale para todos os cargos?' })
  await todos.scrollIntoViewIfNeeded()
  await todos.getByRole('button', { name: /^Presidente, 2018: / }).click()
  await expect(page).toHaveURL(/ano=2018/)
  await page.getByRole('button', { name: 'Quebrar o cofrinho', exact: true }).click()
  await page.getByRole('button', { name: 'Cortar a fila' }).click()
  await page.getByRole('button', { name: 'Pular o palpite' }).click()
  await expect(page.getByText('Poucos candidatos:')).toBeVisible()
  await registrar(page, 'patrimonio-presidente')
})
