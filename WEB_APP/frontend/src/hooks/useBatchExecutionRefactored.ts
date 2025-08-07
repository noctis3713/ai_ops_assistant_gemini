/**
 * 重構後的批次執行 Hook
 * 使用專門的子 Hook 來實現關注點分離和模組化
 */
import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { batchExecuteCommand } from '@/api';
import { 
  type BatchExecuteRequest, 
  type BatchExecutionResponse,
  type APIError 
} from '@/types';
import { useAppStore } from '@/store';
import { logError, logSystem } from '@/utils/SimpleLogger';
import { useProgressManager } from './useProgressManager';
import { useExecutionState } from './useExecutionState';
import { useExecutionErrorHandler } from './useExecutionErrorHandler';

export const useBatchExecutionRefactored = () => {
  const { mode, setBatchResults } = useAppStore();
  
  // 使用專業化的子 Hook
  const progressManager = useProgressManager();
  const executionState = useExecutionState();
  const errorHandler = useExecutionErrorHandler();

  // 批次執行 Mutation
  const batchMutation = useMutation<BatchExecutionResponse, APIError, BatchExecuteRequest>({
    mutationFn: batchExecuteCommand,
    
    onMutate: (variables) => {
      // 檢查執行前置條件
      const validation = {
        deviceIps: variables.devices,
        command: variables.command,
        mode: variables.mode
      };
      
      const canExecuteResult = executionState.canExecute(validation, false);
      if (!canExecuteResult.canExecute) {
        // 使用 executionState 處理失敗，而不是直接拋出錯誤
        executionState.failExecution(canExecuteResult.errorMessage);
        executionState.clearStateWithDelay(3000);
        return Promise.reject(new Error(canExecuteResult.errorMessage));
      }
      
      // 準備執行
      executionState.prepareExecution();
      
      // 初始化進度顯示
      const progress = progressManager.initializeProgress(variables.devices.length);
      
      // 顯示階段進度
      progressManager.showStageProgress(progress, {
        deviceCount: variables.devices.length,
        executionMode: variables.mode
      });
    },
    
    onSuccess: (response) => {
      try {
        // 驗證回應資料格式
        if (!response) {
          logError('批次執行成功但回應為空', { response });
          executionState.clearStateWithDelay(3000);
          return;
        }
        
        // 確保 results 陣列存在且有效
        const results = Array.isArray(response.results) ? response.results : [];
        if (results.length === 0) {
          logError('批次執行成功但結果陣列為空', { response });
        }
        
        // 驗證 summary 物件存在
        const summary = response.summary || { 
          total: results.length, 
          successful: 0, 
          failed: results.length,
          totalTime: 0
        };
        
        // 設置批次結果
        setBatchResults(results);
        
        // 完成進度顯示
        progressManager.completeProgress(summary);
        
        // 記錄成功資訊
        logSystem('批次執行成功完成', {
          total: summary.total,
          successful: summary.successful,
          failed: summary.failed,
          resultsLength: results.length
        });
        
        // 延長狀態顯示時間，確保用戶能看到結果
        executionState.clearStateWithDelay(8000);
        
      } catch (error) {
        const errorInfo = errorHandler.handleExecutionError(
          error instanceof Error ? error : new Error(String(error)),
          { operation: '處理批次執行成功回應' }
        );
        
        executionState.failExecution(errorInfo.friendlyMessage);
        executionState.clearStateWithDelay(8000);
      }
    },
    
    onError: (error) => {
      // 使用錯誤處理器處理錯誤
      const errorInfo = errorHandler.handleBatchExecutionError(
        error,
        batchMutation.variables?.devices.length || 0,
        batchMutation.variables?.mode || mode
      );
      
      // 處理進度和狀態
      progressManager.failProgress(errorInfo.friendlyMessage);
      executionState.failExecution(errorInfo.friendlyMessage);
      
      // 延長錯誤顯示時間，讓用戶有足夠時間閱讀
      executionState.clearStateWithDelay(12000);
    },
    
    onSettled: () => {
      // 完成執行
      executionState.completeExecution();
      
      // 清理進度管理器
      progressManager.cleanup();
    },
  });

  // 統一的執行函數
  const executeBatch = useCallback((deviceIps: string[], command: string) => {
    try {
      batchMutation.mutate({
        devices: deviceIps,
        command: command.trim(),
        mode: mode
      });
    } catch (error) {
      // 捕捉到的錯誤也會重置狀態和清理進度
      const errorInfo = errorHandler.handleExecutionError(
        error instanceof Error ? error : new Error(String(error)),
        { operation: '批次執行啟動', deviceCount: deviceIps.length, mode }
      );
      
      executionState.failExecution(errorInfo.friendlyMessage);
      progressManager.cleanup();
      executionState.clearStateWithDelay(8000);
    }
  }, [batchMutation, mode, errorHandler, executionState, progressManager]);

  // 清理函數
  const cleanup = useCallback(() => {
    executionState.cleanup();
    progressManager.cleanup();
  }, [executionState, progressManager]);

  return {
    executeBatch,
    cleanup,
    isBatchExecuting: batchMutation.isPending || executionState.isExecuting(),
    batchError: batchMutation.error,
    
    // 提供子 Hook 的直接訪問（用於特殊情況）
    progressManager,
    executionState,
    errorHandler
  };
};