import { expect, registrar, test } from './base'

// A cara nova da P6 (veredito, régua de idade, atalhos das perguntas, detalhes sob demanda) e o estado de erro.
test('P6: o veredito e a régua respondem na primeira dobra, e os atalhos levam a cada pergunta', async ({ page, erros }) => {
  test.setTimeout(120_000)
  await page.goto('/idade')
  const h1 = page.getByRole('heading', { level: 1, name: 'Jovem vota no jovem?' })
  await expect(h1).toBeVisible({ timeout: 60_000 })
  // a régua: a zona 5 anos mais velha contra a idade dos votados, na mesma escala
  const regua = page.getByRole('figure', { name: /^Régua de idade: Zona com eleitores mais velhos, \+5 anos/ })
  await expect(regua).toBeVisible({ timeout: 30_000 })
  // o veredito é uma palavra curta numa peça, ao lado da frase
  await expect(page.getByText(/^(Pouco|Não se vê|Ao contrário)\.$/).first()).toBeVisible()
  // tudo cabe na largura (nada de rolagem horizontal), inclusive no celular
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // os atalhos são âncoras: levam ao ato certo
  const atalhos = page.getByRole('navigation', { name: 'Ir para uma pergunta desta página' })
  await expect(atalhos.getByRole('link')).toHaveCount(4)
  await atalhos.getByRole('link', { name: /Eleitos e eleitores/ }).click()
  await expect(page).toHaveURL(/#ato-3$/)
  await expect(page.getByRole('heading', { name: 'Quem se elege é mais velho que quem vota?' })).toBeVisible()

  // o detalhe fica sob demanda: abre pela legenda, não ocupa a tela antes
  const ato2 = page.locator('section[aria-labelledby="ato-2"]')
  await ato2.scrollIntoViewIfNeeded()
  const detalhes = ato2.locator('details', { hasText: 'Por tamanho do município' })
  await expect(detalhes).not.toHaveAttribute('open', '')
  await detalhes.locator('summary').click()
  await expect(detalhes).toHaveAttribute('open', '')
  await registrar(page, 'idade-azulejo')
  expect(erros).toEqual([])
})

test('P6: se a carga da idade não rodou, a tela diz o comando que falta', async ({ page }) => {
  await page.route('**/api/idade/perfil**', (r) =>
    r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'perfil_etario está vazia: rode python -m loader.perfil_etario' }) }),
  )
  await page.goto('/idade')
  await expect(page.getByRole('alert').getByText('Estes dados ainda não foram carregados')).toBeVisible({ timeout: 30_000 })
  await page.getByText('Detalhes para quem roda o projeto').click()
  await expect(page.getByText('python -m loader.perfil_etario').first()).toBeVisible()
})
