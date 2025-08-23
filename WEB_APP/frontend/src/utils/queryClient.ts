// TanStack Query 客戶端配置
import { QueryClient } from '@tanstack/react-query';
import { CACHE_STRATEGIES, INVALIDATION_RULES } from './cacheStrategies';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 使用半靜態資料策略作為預設值
      ...CACHE_STRATEGIES.SEMI_STATIC_DATA,
      refetchOnReconnect: true, // 網路重連時重新獲取（改進連線恢復體驗）
      
      // 智能重試策略
      retry: (failureCount, error: unknown) => {
        const errorWithStatus = error as { status?: number };
        
        // 對於用戶端錯誤（4xx），不重試
        if (errorWithStatus?.status && errorWithStatus.status >= 400 && errorWithStatus.status < 500) {
          return false;
        }
        
        // 對於網路錯誤和伺服器錯誤，重試最多 3 次
        return failureCount < 3;
      },
      
      // 指數退避重試延遲，最大不超過 30 秒
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // 網路錯誤時的重試條件
      retryOnMount: true,
    },
    
    mutations: {
      retry: (failureCount, error: unknown) => {
        const errorWithStatus = error as { status?: number };
        
        // 對於網路連線問題，允許 mutation 重試一次
        if (failureCount < 1 && !errorWithStatus?.status) {
          return true;
        }
        
        return false;
      },
      
      // Mutation 成功後的智能快取失效
      onSuccess: (_data, _variables, context) => {
        // 根據 mutation 類型智能失效相關快取
        const mutationType = (context as Record<string, unknown>)?.mutationType;
        
        if (mutationType && INVALIDATION_RULES[mutationType as keyof typeof INVALIDATION_RULES]) {
          const keysToInvalidate = INVALIDATION_RULES[mutationType as keyof typeof INVALIDATION_RULES];
          keysToInvalidate.forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      },
      
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  }
});