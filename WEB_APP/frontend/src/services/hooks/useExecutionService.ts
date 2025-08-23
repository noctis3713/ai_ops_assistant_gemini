/**
 * 執行服務相關 Hooks
 * 整合 TanStack Query 與執行服務
 */

import { 
  useMutation, 
  useQueryClient,
  type UseMutationResult
} from '@tanstack/react-query';
import { ExecutionService } from '../execution/ExecutionService';
import { apiClient } from '@/api/client';
import type { QueryClient } from '@tanstack/react-query';
import type { BatchExecuteRequest, BatchExecutionResponse } from '@/types';
import type { 
  SingleExecutionResponse,
  ExecutionOptions,
  AIQueryOptions
} from '../execution/ExecutionTypes';

/**
 * 建立執行服務實例
 */
function createExecutionServiceInstance(queryClient: QueryClient): ExecutionService {
  return new ExecutionService({ apiClient, queryClient });
}

/**
 * 執行相關 Query Keys（用於快取失效）
 */
export const executionQueryKeys = {
  all: ['executions'] as const,
  history: () => [...executionQueryKeys.all, 'history'] as const,
  stats: () => [...executionQueryKeys.all, 'stats'] as const
};

/**
 * 使用單一設備指令執行
 */
export function useExecuteCommand(): UseMutationResult<
  SingleExecutionResponse,
  Error,
  { deviceIp: string; command: string; options?: ExecutionOptions }
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ deviceIp, command, options = {} }) => {
      const service = createExecutionServiceInstance(queryClient);
      return service.executeCommand(deviceIp, command, options);
    },
    onSuccess: () => {
      // 執行成功後可以觸發相關快取更新
      queryClient.invalidateQueries({
        queryKey: executionQueryKeys.history()
      });
    },
    onError: (error, variables) => {
      // 錯誤處理，可以記錄到執行歷史
      console.error('Command execution failed:', {
        error: error.message,
        deviceIp: variables.deviceIp,
        command: variables.command
      });
    }
  });
}

/**
 * 使用 AI 查詢執行
 */
export function useQueryAI(): UseMutationResult<
  SingleExecutionResponse,
  Error,
  { deviceIp: string; query: string; options?: AIQueryOptions }
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ deviceIp, query, options = {} }) => {
      const service = createExecutionServiceInstance(queryClient);
      return service.queryAI(deviceIp, query, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: executionQueryKeys.history()
      });
    },
    onError: (error, variables) => {
      console.error('AI query failed:', {
        error: error.message,
        deviceIp: variables.deviceIp,
        query: variables.query
      });
    }
  });
}

/**
 * 使用批次執行
 */
export function useExecuteBatch(): UseMutationResult<
  BatchExecutionResponse,
  Error,
  BatchExecuteRequest
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: BatchExecuteRequest) => {
      const service = createExecutionServiceInstance(queryClient);
      return service.executeBatch(request);
    },
    onSuccess: () => {
      // 批次執行成功後更新相關快取
      queryClient.invalidateQueries({
        queryKey: executionQueryKeys.all
      });

      // 可能需要更新設備狀態快取
      queryClient.invalidateQueries({
        queryKey: ['devices']
      });
    },
    onError: (error, variables) => {
      console.error('Batch execution failed:', {
        error: error.message,
        deviceCount: variables.devices.length,
        mode: variables.mode
      });
    }
  });
}

/**
 * 使用批次執行（異步）
 */
export function useExecuteBatchAsync(): UseMutationResult<
  string, // 返回任務 ID
  Error,
  BatchExecuteRequest
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: BatchExecuteRequest) => {
      const service = createExecutionServiceInstance(queryClient);
      return service.executeBatchAsync(request);
    },
    onSuccess: (taskId, variables) => {
      console.log('Async batch execution started:', {
        taskId,
        deviceCount: variables.devices.length,
        mode: variables.mode
      });
    },
    onError: (error, variables) => {
      console.error('Async batch execution failed to start:', {
        error: error.message,
        deviceCount: variables.devices.length,
        mode: variables.mode
      });
    }
  });
}

/**
 * 使用執行歷史清理
 */
export function useClearExecutionHistory(): UseMutationResult<
  void,
  Error,
  { olderThan?: Date }
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ olderThan }) => {
      const service = createExecutionServiceInstance(queryClient);
      service.clearExecutionHistory(olderThan);
    },
    onSuccess: () => {
      // 清理後更新歷史快取
      queryClient.invalidateQueries({
        queryKey: executionQueryKeys.history()
      });
      queryClient.invalidateQueries({
        queryKey: executionQueryKeys.stats()
      });
    }
  });
}

/**
 * 使用執行服務健康檢查
 */
export function useExecutionHealthCheck(): UseMutationResult<
  boolean,
  Error,
  void
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const service = createExecutionServiceInstance(queryClient);
      return service.healthCheck();
    }
  });
}

/**
 * 複合 Hook：執行指令並處理常見場景
 */
export function useCommandExecution() {
  const executeCommand = useExecuteCommand();
  const queryAI = useQueryAI();
  const executeBatch = useExecuteBatch();

  const executeWithMode = async (
    devices: string | string[],
    command: string,
    mode: 'command' | 'ai',
    options: ExecutionOptions = {}
  ) => {
    const deviceList = Array.isArray(devices) ? devices : [devices];

    if (deviceList.length === 1) {
      // 單一設備執行
      const deviceIp = deviceList[0];
      
      if (mode === 'ai') {
        return queryAI.mutateAsync({
          deviceIp,
          query: command,
          options: options as AIQueryOptions
        });
      } else {
        return executeCommand.mutateAsync({
          deviceIp,
          command,
          options
        });
      }
    } else {
      // 批次執行
      const batchRequest: BatchExecuteRequest = {
        devices: deviceList,
        command,
        mode,
        ...options
      };
      
      return executeBatch.mutateAsync(batchRequest);
    }
  };

  return {
    executeWithMode,
    executeCommand: executeCommand.mutate,
    queryAI: queryAI.mutate,
    executeBatch: executeBatch.mutate,
    isLoading: executeCommand.isPending || queryAI.isPending || executeBatch.isPending,
    error: executeCommand.error || queryAI.error || executeBatch.error
  };
}

/**
 * 獲取執行服務實例（用於直接訪問服務方法）
 */
export function useExecutionService(): ExecutionService {
  const queryClient = useQueryClient();
  return createExecutionServiceInstance(queryClient);
}