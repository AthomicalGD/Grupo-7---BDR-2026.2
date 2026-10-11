import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/red-hat-mono'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// @interface aponta para a interface escolhida ao subir (vite.config.ts): a outra nem entra no pacote
import { App } from '@interface'

const cliente = new QueryClient({
  defaultOptions: { queries: { retry: (falhas, erro) => falhas < 2 && (erro as { status?: number }).status !== 404 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
