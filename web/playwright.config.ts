import { defineConfig, devices } from '@playwright/test'

// Testes ponta a ponta contra os dados reais: precisam do banco (docker compose up -d)
// e da API (python -m uvicorn api.app:app --port 8000). O Vite sobe sozinho.
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // a urna e o relevo 3D rodam em WebGL por software no Chromium de teste: poucos workers evitam disputa de CPU
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: (process.env.SITE ?? 'http://localhost:5173'),
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'celular', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: (process.env.SITE ?? 'http://localhost:5173'),
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
