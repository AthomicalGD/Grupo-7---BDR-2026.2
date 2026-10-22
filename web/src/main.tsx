import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/red-hat-mono'
import './index.css'
import './lib/rede' // guarda a chave da rede local antes do roteador limpar o endereço
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// @interface aponta para a interface escolhida ao subir (vite.config.ts): a outra nem entra no pacote
import { App } from '@interface'
import { ehFalhaDeModulo, recarregaUmaVez } from './lib/recarrega'

// um pedaço sob demanda que não baixou (servidor reiniciado, versão nova): recarrega uma vez
window.addEventListener('vite:preloadError', (e) => { if (recarregaUmaVez()) e.preventDefault() })
window.addEventListener('unhandledrejection', (e) => { if (ehFalhaDeModulo(e.reason)) recarregaUmaVez() })

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
