import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// API_ALVO permite apontar para outra instância da API (ex.: uma segunda, em outra porta)
const api = { '/api': process.env.API_ALVO ?? 'http://127.0.0.1:8000' }

// Qual interface o site serve, decidido só ao subir: VITE_INTERFACE=completa|simples
// (ou `--mode simples`, que lê .env.simples). Cada uma vira um pacote que não contém a outra.
const INTERFACES = {
  completa: { arquivo: './src/AppCompleta.tsx', porta: 5173, previa: 4173 },
  simples: { arquivo: './src/simples/App.tsx', porta: 5174, previa: 4174 },
} as const

export default defineConfig(({ mode }) => {
  const pedida = process.env.VITE_INTERFACE ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_INTERFACE ?? 'completa'
  if (!(pedida in INTERFACES)) {
    throw new Error(`VITE_INTERFACE="${pedida}" não existe. Use "completa" ou "simples".`)
  }
  const nome = pedida as keyof typeof INTERFACES
  const escolhida = INTERFACES[nome]

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'interface-escolhida',
        configResolved: (c) => c.logger.info(`\n  Interface: ${nome}\n`),
      },
    ],
    resolve: { alias: { '@interface': fileURLToPath(new URL(escolhida.arquivo, import.meta.url)) } },
    // o 3D (three, drei) só é baixado nas telas que o usam; o aviso de 500 kB não vale para esse pedaço sob demanda
    build: { chunkSizeWarningLimit: 1000, outDir: nome === 'simples' ? 'dist-simples' : 'dist' },
    server: {
      port: Number(process.env.PORTA ?? escolhida.porta),
      strictPort: true,
      proxy: api,
    },
    preview: {
      port: escolhida.previa,
      strictPort: true,
      proxy: api,
    },
  }
})
