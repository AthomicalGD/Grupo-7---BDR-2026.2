import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API_ALVO permite apontar para outra instância da API (ex.: uma segunda, em outra porta)
const api = { '/api': process.env.API_ALVO ?? 'http://127.0.0.1:8000' }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // o 3D (three, drei) só é baixado nas telas que o usam; o aviso de 500 kB não vale para esse pedaço sob demanda
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: Number(process.env.PORTA ?? 5173),
    proxy: api,
  },
  preview: {
    port: 4173,
    proxy: api,
  },
})
