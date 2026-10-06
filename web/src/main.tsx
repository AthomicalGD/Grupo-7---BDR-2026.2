import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/red-hat-mono'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { router } from './router'

const cliente = new QueryClient({
  defaultOptions: { queries: { retry: (falhas, erro) => falhas < 2 && (erro as { status?: number }).status !== 404 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
