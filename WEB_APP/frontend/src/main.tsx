import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/utils/queryClient'
import { logError, logSystemInfo } from '@/errors'
import DevToolsLazy from '@/components/DevToolsLazy'
import '@/styles/index.css'
import App from './App.tsx'

// 全域錯誤捕獲 - 自動發送未處理錯誤到後端
window.addEventListener('error', (event) => {
  logError('JavaScript Error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    url: window.location.href,
  });
});

// 捕獲 Promise 未處理的拒絕
window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled Promise Rejection', {
    reason: event.reason,
    url: window.location.href,
  });
});

// 記錄應用啟動
logSystemInfo('Application started', {
  userAgent: navigator.userAgent,
  url: window.location.href,
  timestamp: new Date().toISOString(),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <DevToolsLazy />
    </QueryClientProvider>
  </StrictMode>,
)
