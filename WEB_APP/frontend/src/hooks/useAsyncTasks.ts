/**
 * 非同步任務管理 Hook
 * 提供任務建立、輪詢、取消等完整的非同步任務管理功能
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  batchExecuteAsync, 
  getTaskStatus, 
  cancelTask,
  executeAsyncBatchAndWait 
} from '@/api';
import { useAppStore } from '@/store';
import { 
  type BatchExecuteRequest, 
  type TaskResponse, 
  type BatchExecutionResponse 
} from '@/types';

export interface UseAsyncTasksOptions {
  /**
   * 輪詢間隔（毫秒），預設 2000ms
   */
  pollInterval?: number;
  
  /**
   * 最大輪詢間隔（毫秒），預設 10000ms
   */
  maxPollInterval?: number;
  
  /**
   * 總超時時間（毫秒），預設 30 分鐘
   */
  timeout?: number;
  
  /**
   * 是否自動開始輪詢，預設 true
   */
  autoStartPolling?: boolean;
}

export interface UseAsyncTasksReturn {
  /**
   * 建立並執行非同步批次任務
   */
  executeAsync: (request: BatchExecuteRequest) => Promise<string>;
  
  /**
   * 建立非同步任務並等待完成
   */
  executeAsyncAndWait: (request: BatchExecuteRequest) => Promise<BatchExecutionResponse>;
  
  /**
   * 開始輪詢指定任務
   */
  startPolling: (taskId: string) => void;
  
  /**
   * 停止當前輪詢
   */
  stopPolling: () => void;
  
  /**
   * 取消當前任務
   */
  cancelCurrentTask: () => Promise<boolean>;
  
  /**
   * 手動查詢任務狀態
   */
  queryTaskStatus: (taskId: string) => Promise<TaskResponse>;
  
  /**
   * 當前執行狀態
   */
  isExecuting: boolean;
  
  /**
   * 當前輪詢狀態
   */
  isPolling: boolean;
  
  /**
   * 錯誤狀態
   */
  error: string | null;
}

export const useAsyncTasks = (options: UseAsyncTasksOptions = {}): UseAsyncTasksReturn => {
  const {
    pollInterval = 2000,
    maxPollInterval = 10000,
    timeout = 30 * 60 * 1000, // 30 分鐘
    autoStartPolling = true,
  } = options;

  // 狀態管理
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store 狀態
  const {
    currentTask,
    setCurrentTask,
    setIsAsyncMode,
    setTaskPollingActive,
    updateTaskProgress,
    setBatchResults,
    setStatus,
    setIsExecuting: setStoreExecuting,
  } = useAppStore();

  // 輪詢控制
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 清理函數
   */
  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPolling(false);
    setTaskPollingActive(false);
  }, [setTaskPollingActive]);

  /**
   * 組件卸載時清理資源
   */
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /**
   * 錯誤處理
   */
  const handleError = useCallback((error: unknown, context: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setError(`${context}: ${errorMessage}`);
    setStatus(errorMessage, 'error');
    console.error(`${context}:`, error);
  }, [setStatus]);

  /**
   * 輪詢任務狀態
   */
  const pollTask = useCallback(async (taskId: string) => {
    if (!taskId) return;

    setIsPolling(true);
    setTaskPollingActive(true);
    
    let currentInterval = pollInterval;
    const startTime = Date.now();

    const poll = async () => {
      try {
        // 檢查超時
        if (Date.now() - startTime > timeout) {
          throw new Error(`任務輪詢超時: ${taskId}`);
        }

        // 查詢任務狀態
        const task = await getTaskStatus(taskId);
        setCurrentTask(task);

        // 更新進度
        updateTaskProgress(taskId, task.progress.percentage, task.progress.current_stage);

        // 檢查任務是否完成
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          cleanup();
          
          if (task.status === 'completed' && task.result) {
            // 處理成功結果
            setBatchResults(task.result.results || []);
            setStatus('任務執行完成', 'success');
          } else if (task.status === 'failed') {
            // 處理失敗結果
            setStatus(task.error || '任務執行失敗', 'error');
          } else if (task.status === 'cancelled') {
            // 處理取消結果
            setStatus('任務已被取消', 'warning');
          }
          
          return;
        }

        // 設定下次輪詢
        currentInterval = Math.min(currentInterval * 1.2, maxPollInterval);
        pollingRef.current = setTimeout(poll, currentInterval);

      } catch (error) {
        handleError(error, '輪詢任務狀態失敗');
        cleanup();
      }
    };

    // 開始首次輪詢
    await poll();
  }, [
    pollInterval,
    maxPollInterval,
    timeout,
    setCurrentTask,
    setTaskPollingActive,
    updateTaskProgress,
    setBatchResults,
    setStatus,
    handleError,
    cleanup,
  ]);

  /**
   * 建立並執行非同步批次任務
   */
  const executeAsync = useCallback(async (request: BatchExecuteRequest): Promise<string> => {
    setError(null);
    setIsExecuting(true);
    setStoreExecuting(true);
    setIsAsyncMode(true);

    try {
      // 建立非同步任務
      const response = await batchExecuteAsync(request);
      
      // 如果啟用自動輪詢，開始輪詢
      if (autoStartPolling) {
        await pollTask(response.task_id);
      }

      return response.task_id;

    } catch (error) {
      handleError(error, '建立非同步任務失敗');
      setIsExecuting(false);
      setStoreExecuting(false);
      setIsAsyncMode(false);
      throw error;
    } finally {
      if (!autoStartPolling) {
        setIsExecuting(false);
        setStoreExecuting(false);
      }
    }
  }, [
    setStoreExecuting,
    setIsAsyncMode,
    autoStartPolling,
    pollTask,
    handleError,
  ]);

  /**
   * 建立非同步任務並等待完成
   */
  const executeAsyncAndWait = useCallback(async (request: BatchExecuteRequest): Promise<BatchExecutionResponse> => {
    setError(null);
    setIsExecuting(true);
    setStoreExecuting(true);
    setIsAsyncMode(true);

    try {
      const result = await executeAsyncBatchAndWait(request, {
        onProgress: (task) => {
          setCurrentTask(task);
          updateTaskProgress(task.task_id, task.progress.percentage, task.progress.current_stage);
        },
        pollInterval,
        maxPollInterval,
        timeout,
      });

      setBatchResults(result.results);
      setStatus('任務執行完成', 'success');
      
      return result;

    } catch (error) {
      handleError(error, '執行非同步任務失敗');
      throw error;
    } finally {
      setIsExecuting(false);
      setStoreExecuting(false);
      setIsAsyncMode(false);
    }
  }, [
    setStoreExecuting,
    setIsAsyncMode,
    setCurrentTask,
    updateTaskProgress,
    setBatchResults,
    setStatus,
    pollInterval,
    maxPollInterval,
    timeout,
    handleError,
  ]);

  /**
   * 開始輪詢指定任務
   */
  const startPolling = useCallback((taskId: string) => {
    cleanup(); // 先清理現有輪詢
    pollTask(taskId);
  }, [cleanup, pollTask]);

  /**
   * 停止當前輪詢
   */
  const stopPolling = useCallback(() => {
    cleanup();
  }, [cleanup]);

  /**
   * 取消當前任務
   */
  const cancelCurrentTask = useCallback(async (): Promise<boolean> => {
    if (!currentTask) {
      return false;
    }

    try {
      await cancelTask(currentTask.task_id);
      setStatus('任務已取消', 'warning');
      cleanup();
      return true;
    } catch (error) {
      handleError(error, '取消任務失敗');
      return false;
    }
  }, [currentTask, setStatus, handleError, cleanup]);

  /**
   * 手動查詢任務狀態
   */
  const queryTaskStatus = useCallback(async (taskId: string): Promise<TaskResponse> => {
    try {
      const task = await getTaskStatus(taskId);
      setCurrentTask(task);
      return task;
    } catch (error) {
      handleError(error, '查詢任務狀態失敗');
      throw error;
    }
  }, [setCurrentTask, handleError]);

  return {
    executeAsync,
    executeAsyncAndWait,
    startPolling,
    stopPolling,
    cancelCurrentTask,
    queryTaskStatus,
    isExecuting,
    isPolling,
    error,
  };
};