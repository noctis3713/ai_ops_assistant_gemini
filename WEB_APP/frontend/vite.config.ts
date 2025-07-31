import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: './config', // 指定環境變數檔案目錄
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
