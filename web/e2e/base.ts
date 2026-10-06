// Fixture comum: falha o teste se a página registrar erro no console, e guarda um screenshot
// de cada tela em e2e/__screenshots__/ para a conferência visual.
import { test as base, expect, type Page } from '@playwright/test'

export const test = base.extend<{ erros: string[] }>({
  erros: async ({ page }, usar) => {
    const erros: string[] = []
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
    page.on('pageerror', (e) => erros.push(e.message))
    await usar(erros)
    expect(erros, 'erros no console').toEqual([])
  },
})

export { expect }

export async function registrar(page: Page, nome: string) {
  await page.waitForTimeout(700) // deixa as entradas animadas assentarem
  await page.screenshot({ path: `e2e/__screenshots__/${test.info().project.name}-${nome}.png` })
}
