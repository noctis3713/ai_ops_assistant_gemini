// TanStack Query 客戶端配置
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10分鐘內認為資料是新鮮的，減少自動 refetch
      gcTime: 15 * 60 * 1000, // 15分鐘後清除快取
      refetchOnWindowFocus: false, // 禁用視窗焦點時自動重新獲取
      refetchOnMount: true, // 組件掛載時重新獲取（保持必要的更新）
      refetchOnReconnect: false, // 禁用網路重連時自動重新獲取
      retry: (failureCount, error: unknown) => {
        // 對於 4xx 錯誤不重試，對於 5xx 錯誤重試最多 3 次
        const errorWithStatus = error as { status?: number };
        if (errorWithStatus?.status && errorWithStatus.status >= 400 && errorWithStatus.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false, // Mutations 一般不重試
      // 防止 mutation 完成後觸發相關查詢的自動更新
      onSuccess: () => {
        // 不自動失效任何查詢，讓使用者明確控制資料更新
      },
    },
  },
});