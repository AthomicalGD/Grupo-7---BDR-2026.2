// Gera os arquivos da marca: npm run marca
// Saída: src/assets/marca/ (usada pelo site), design/marca/ (para o grupo) e public/favicon.svg.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarLetreiro } from './letreiro.mjs'
import { ESTRELAS, GEO, iconeSVG, simboloSVG, svg } from './marca.mjs'

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arquivos = {
  'simbolo.svg': svg(304, 248, simboloSVG('cor'), 'Voto Aberto'),
  'simbolo-negativo.svg': svg(304, 248, simboloSVG('negativo'), 'Voto Aberto'),
  'simbolo-mono.svg': svg(304, 248, simboloSVG('mono'), 'Voto Aberto'),
  'icone.svg': iconeSVG('escuro'),
  'icone-claro.svg': iconeSVG('claro'),
  ...(await gerarLetreiro()),
}
for (const pasta of [path.join(WEB, 'src', 'assets', 'marca'), path.resolve(WEB, '..', 'design', 'marca')]) {
  fs.mkdirSync(pasta, { recursive: true })
  for (const [nome, conteudo] of Object.entries(arquivos)) fs.writeFileSync(path.join(pasta, nome), conteudo)
}
fs.writeFileSync(path.join(WEB, 'public', 'favicon.svg'), arquivos['icone.svg'])
// geometria do símbolo para o loading animado (quadro 304 x 248)
fs.writeFileSync(
  path.join(WEB, 'src', 'componentes', 'simbolo.ts'),
  `// Gerado por scripts/gerar-marca.mjs (npm run marca). Não editar à mão.
export const GEO_SIMBOLO = ${JSON.stringify({ ...GEO, estrelas: ESTRELAS }, null, 2)}
`,
)
console.log('marca gerada:', Object.keys(arquivos).join(', '))
