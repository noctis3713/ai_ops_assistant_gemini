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
  server: {
    host: '0.0.0.0', // 允許外部訪問
    port: 5173,
    strictPort: true,
    // 允許特定主機名訪問（用於 Docker 容器間通信）
    allowedHosts: ['localhost', 'frontend', '172.20.0.4', '.local'],
    proxy: {
      // 代理所有 /api 請求到後端容器
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        ws: true, // 支援 WebSocket
      },
      // 代理健康檢查
      '/health': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 優化建構設定
    rollupOptions: {
      output: {
        // 優化 chunk 檔名格式，包含 hash 以提升快取效率
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop().replace(/\.[^/.]+$/, '') : 'index';
          return `js/[name]-${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').pop();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'images/[name]-[hash].[ext]';
          }
          if (/woff2?|eot|ttf|otf/i.test(extType)) {
            return 'fonts/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
        manualChunks: (id) => {
          // React 核心庫 - 單獨分離，最高優先級
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          
          // UI 組件庫 - 進一步細分避免單個 chunk 過大
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          if (id.includes('class-variance-authority') || id.includes('clsx') || 
              id.includes('tailwind-merge') || id.includes('tailwindcss-animate')) {
            return 'ui-utils';
          }
          
          // 狀態管理庫分離
          if (id.includes('zustand')) {
            return 'zustand';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'react-query';
          }
          
          // HTTP 客戶端
          if (id.includes('axios')) {
            return 'http-client';
          }
          
          // 開發工具（僅在開發模式下分離）
          if (process.env.NODE_ENV === 'development' && id.includes('@tanstack/react-query-devtools')) {
            return 'dev-tools';
          }
          
          // 應用程式常數和配置 - 細分化
          if (id.includes('/src/constants/')) {
            return 'app-constants';
          }
          if (id.includes('/src/config/') || id.includes('/src/lib/')) {
            return 'app-config';
          }
          
          // 工具函式 - 細分化
          if (id.includes('/src/utils/')) {
            if (id.includes('LRUCache') || id.includes('RequestDeduplicator')) {
              return 'cache-utils'; // 新增快取工具 chunk
            }
            if (id.includes('storeHelpers')) {
              return 'store-helpers'; // 新增 store 輔助函數 chunk
            }
            if (id.includes('SimpleLogger')) {
              return 'logger-utils'; // 日誌工具單獨分離
            }
            return 'utils';
          }
          
          // 自訂 Hooks - 按功能分離
          if (id.includes('/src/hooks/')) {
            if (id.includes('useDevice') || id.includes('useApp')) {
              return 'core-hooks';
            }
            return 'feature-hooks';
          }
          
          // 型別定義
          if (id.includes('/src/types/')) {
            return 'app-types';
          }
          
          // API 相關
          if (id.includes('/src/api/')) {
            return 'api-client';
          }
          
          // Zustand Store
          if (id.includes('/src/store/')) {
            return 'app-store';
          }
          
          // 組件分離 - 按功能模組分離，進一步優化大型組件
          if (id.includes('/src/components/common/')) {
            // 載入骨架屏組件分離到獨立 chunk
            if (id.includes('LoadingSkeletons')) {
              return 'loading-skeletons';
            }
            return 'common-components';
          }
          if (id.includes('/src/components/features/')) {
            // 大型組件獨立分離
            if (id.includes('BatchOutputDisplay')) {
              return 'batch-output-component';
            }
            if (id.includes('VirtualizedResultList')) {
              return 'virtualized-component';
            }
            if (id.includes('MultiDeviceSelector')) {
              return 'multi-device-selector-component';
            }
            if (id.includes('DeviceGroupSelector')) {
              return 'device-group-selector-component';
            }
            // 按組件功能進一步分離
            if (id.includes('Device') || id.includes('Group')) {
              return 'device-components';
            }
            if (id.includes('Command') || id.includes('Execution')) {
              return 'execution-components';
            }
            return 'feature-components';
          }
          if (id.includes('/src/components/layout/')) {
            return 'layout-components';
          }
          if (id.includes('/src/components/ui/')) {
            return 'ui-components';
          }
          
          // 其他 node_modules 依賴
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        }
      }
    },
    // 啟用 sourcemap 以便於除錯
    sourcemap: process.env.NODE_ENV === 'development',
    // 調整 chunk 大小警告限制，更合理的分割
    chunkSizeWarningLimit: 500,
    // 優化壓縮和 Tree Shaking
    minify: 'esbuild',
    target: 'es2020',
    // 提升建置效能
    cssCodeSplit: true,
    // 預載入關鍵模組
    modulePreload: {
      polyfill: true,
      resolveDependencies: (filename, deps) => {
        // 智能預載入策略 - 根據頁面重要性分層載入
        const criticalChunks = deps.filter(dep => 
          dep.includes('react-vendor') || 
          dep.includes('app-store') || 
          dep.includes('common-components') ||
          dep.includes('api-client') ||
          dep.includes('cache-utils') || // 快取工具預載入
          dep.includes('loading-skeletons') // 載入骨架屏優先載入
        );

        // 延遲預載入次要組件
        const secondaryChunks = deps.filter(dep =>
          dep.includes('device-components') ||
          dep.includes('execution-components')
        );

        // 首屏只載入關鍵 chunks，次要 chunks 延遲載入
        return [...criticalChunks, ...secondaryChunks.slice(0, 2)];
      }
    }
  }
})
