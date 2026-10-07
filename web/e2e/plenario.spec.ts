// Geometria do plenário da P1 (sem navegador): número exato de lugares e nenhuma cadeira encostando
// em outra, de uma cadeira (governador) até todos os prefeitos dos estados carregados.
import { expect, test } from '@playwright/test'
import { hemiciclo } from '../src/cadeira/geometria'

test('hemiciclo tem os n lugares, sem sobreposição', () => {
  for (const n of [1, 2, 6, 12, 13, 29, 43, 129, 261, 417, 1487]) {
    const { lugares, diametro } = hemiciclo(n)
    expect(lugares).toHaveLength(n)
    expect(lugares.every((l) => l.y >= -1e-9)).toBe(true)
    let menor = Infinity
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) menor = Math.min(menor, Math.hypot(lugares[i].x - lugares[j].x, lugares[i].y - lugares[j].y))
    expect(menor).toBeGreaterThanOrEqual(diametro)
    // numerados da esquerda para a direita
    expect(lugares[0].ang).toBeGreaterThanOrEqual(lugares[n - 1].ang)
  }
})
