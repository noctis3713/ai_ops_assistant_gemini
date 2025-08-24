import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/utils/queryClient'
import DevToolsLazy from '@/components/DevToolsLazy'
import '@/styles/index.css'
import App from './App.tsx'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <DevToolsLazy />
    </QueryClientProvider>
  </StrictMode>,
)
