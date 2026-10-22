import { defineConfig, devices } from '@playwright/test'

// Testes ponta a ponta contra os dados reais: precisam do banco (docker compose up -d)
// e da API (python -m uvicorn api.app:app --port 8000). O Vite sobe sozinho, um por interface:
// a completa em 5173 (npm run dev) e a simples em 5174 (npm run dev:simples).
const COMPLETA = process.env.SITE ?? 'http://localhost:5173'
const SIMPLES = process.env.SITE_SIMPLES ?? 'http://localhost:5174'

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
const celular = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // a urna e o relevo 3D rodam em WebGL por software no Chromium de teste: poucos workers evitam disputa de CPU
  workers: 2,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', testIgnore: /simples\.spec/, use: { ...desktop, baseURL: COMPLETA } },
    { name: 'celular', testIgnore: /simples\.spec/, use: { ...celular, baseURL: COMPLETA } },
    { name: 'simples-desktop', testMatch: /simples\.spec/, use: { ...desktop, baseURL: SIMPLES } },
    { name: 'simples-celular', testMatch: /simples\.spec/, use: { ...celular, baseURL: SIMPLES } },
  ],
  webServer: [
    { command: 'npm run dev', url: COMPLETA, reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run dev:simples', url: SIMPLES, reuseExistingServer: true, timeout: 60_000 },
  ],
})
