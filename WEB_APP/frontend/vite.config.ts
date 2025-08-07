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
        manualChunks: {
          // 將大型第三方庫分離到單獨的 chunk
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          state: ['zustand', '@tanstack/react-query'],
          http: ['axios']
        }
      }
    },
    // 啟用 sourcemap 以便於除錯
    sourcemap: process.env.NODE_ENV === 'development',
    // 設定 chunk 大小警告限制
    chunkSizeWarningLimit: 1000
  }
})
