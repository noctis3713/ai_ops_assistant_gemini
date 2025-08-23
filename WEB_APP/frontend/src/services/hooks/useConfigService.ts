/**
 * 配置服務相關 Hooks
 * 整合 TanStack Query 與配置服務
 */

/* eslint-disable @tanstack/query/exhaustive-deps */

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult
} from '@tanstack/react-query';
import { ConfigService } from '../config/ConfigService';
import { apiClient } from '@/api/client';
import type { QueryClient } from '@tanstack/react-query';
import type { BackendConfig } from '@/types';
import type { 
  ConfigServiceOptions,
  ConfigHealthResult
} from '../config/ConfigTypes';

/**
 * 建立配置服務實例
 */
function createConfigServiceInstance(queryClient: QueryClient): ConfigService {
  return new ConfigService({ apiClient, queryClient });
}

/**
 * 配置相關 Query Keys（用於快取失效）
 */
export const configQueryKeys = {
  all: ['config'] as const,
  backend: () => [...configQueryKeys.all, 'backend'] as const,
  health: () => [...configQueryKeys.all, 'health'] as const,
  aiEnabled: () => [...configQueryKeys.all, 'ai-enabled'] as const
};

/**
 * 使用後端配置
 */
export function useBackendConfig(options: ConfigServiceOptions = {}): UseQueryResult<BackendConfig, Error> {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: configQueryKeys.backend(),
    queryFn: async () => {
      const service = createConfigServiceInstance(queryClient);
      return service.getBackendConfig(options);
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘內認為資料新鮮
    gcTime: 10 * 60 * 1000, // 10 分鐘垃圾回收
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
}

/**
 * 使用 AI 查詢功能開關狀態
 */
export function useAiQueryEnabled(options: ConfigServiceOptions = {}): UseQueryResult<boolean, Error> {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: configQueryKeys.aiEnabled(),
    queryFn: async () => {
      const service = createConfigServiceInstance(queryClient);
      return service.isAiQueryEnabled(options);
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘內認為資料新鮮
    gcTime: 10 * 60 * 1000, // 10 分鐘垃圾回收
    retry: 2, // 增加重試次數
    retryDelay: 1000, // 減少重試延遲
    initialData: true, // 設定初始值為 true，確保 AI 功能預設啟用
    refetchOnWindowFocus: false, // 避免視窗焦點切換時重複請求
  });
}

/**
 * 使用配置健康檢查
 */
export function useConfigHealth(): UseQueryResult<ConfigHealthResult, Error> {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: configQueryKeys.health(),
    queryFn: async () => {
      const service = createConfigServiceInstance(queryClient);
      return service.getConfigHealth();
    },
    staleTime: 30 * 1000, // 30 秒內認為資料新鮮
    gcTime: 2 * 60 * 1000, // 2 分鐘垃圾回收
    retry: 1
  });
}

/**
 * 使用重新載入配置
 */
export function useReloadConfig(): UseMutationResult<
  BackendConfig,
  Error,
  void
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const service = createConfigServiceInstance(queryClient);
      return service.reloadConfig();
    },
    onSuccess: (data) => {
      // 重新載入成功後更新所有相關快取
      queryClient.setQueryData(configQueryKeys.backend(), data);
      queryClient.setQueryData(configQueryKeys.aiEnabled(), data.ai?.enableAiQuery ?? true);
      
      // 使其他快取失效
      queryClient.invalidateQueries({
        queryKey: configQueryKeys.all
      });
    },
    onError: (error) => {
      console.error('Config reload failed:', error.message);
    }
  });
}

/**
 * 使用清除配置快取
 */
export function useClearConfigCache(): UseMutationResult<
  void,
  Error,
  void
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const service = createConfigServiceInstance(queryClient);
      service.clearCache();
    },
    onSuccess: () => {
      // 清除 TanStack Query 快取
      queryClient.removeQueries({
        queryKey: configQueryKeys.all
      });
    }
  });
}

/**
 * 複合 Hook：配置管理
 * 提供完整的配置管理功能
 */
export function useConfigManagement() {
  const backendConfig = useBackendConfig();
  const aiEnabled = useAiQueryEnabled();
  const configHealth = useConfigHealth();
  const reloadConfig = useReloadConfig();
  const clearCache = useClearConfigCache();

  return {
    // 資料
    config: backendConfig.data,
    isAiEnabled: aiEnabled.data ?? false,
    health: configHealth.data,
    
    // 狀態
    isLoading: backendConfig.isLoading || aiEnabled.isLoading,
    isError: backendConfig.isError || aiEnabled.isError,
    error: backendConfig.error || aiEnabled.error,
    
    // 操作
    reload: reloadConfig.mutate,
    clearCache: clearCache.mutate,
    
    // 操作狀態
    isReloading: reloadConfig.isPending,
    isClearing: clearCache.isPending
  };
}

/**
 * 獲取配置服務實例（用於直接訪問服務方法）
 */
export function useConfigService(): ConfigService {
  const queryClient = useQueryClient();
  return createConfigServiceInstance(queryClient);
}