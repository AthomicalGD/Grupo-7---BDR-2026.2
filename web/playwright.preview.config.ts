import base from './playwright.config'

// Os mesmos testes contra o site de produção já no ar (vite preview), sem subir o servidor de desenvolvimento:
// SITE=http://localhost:4190 npx playwright test -c playwright.preview.config.ts --project=desktop --project=celular
export default { ...base, webServer: [], workers: 1 }
