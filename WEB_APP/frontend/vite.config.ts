import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle 分析工具（僅在 analyze 環境變數存在時啟用）
    ...(process.env.ANALYZE ? [visualizer({
      filename: 'dist/bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap' // 或 'sunburst', 'network'
    })] : [])
  ],
  envDir: './config', // 指定環境變數檔案目錄
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 優化建構設定
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 將大型第三方庫分離到單獨的 chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }
          if (id.includes('@radix-ui') || id.includes('class-variance-authority') || 
              id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'ui';
          }
          if (id.includes('zustand') || id.includes('@tanstack/react-query')) {
            return 'state';
          }
          if (id.includes('axios')) {
            return 'http';
          }
          
          // 將大型常數和工具文件分離
          if (id.includes('/constants/') || id.includes('/config/')) {
            return 'constants';
          }
          
          // 將 hooks 分離到單獨的 chunk
          if (id.includes('/hooks/') && !id.includes('BatchOutputDisplay')) {
            return 'hooks';
          }
          
          // 將大型組件分離（除了已經懶載入的 BatchOutputDisplay）
          if (id.includes('/components/features/') && !id.includes('BatchOutputDisplay')) {
            return 'components';
          }
        }
      }
    },
    // 啟用 sourcemap 以便於除錯
    sourcemap: process.env.NODE_ENV === 'development',
    // 設定 chunk 大小警告限制
    chunkSizeWarningLimit: 1000
  }
})
