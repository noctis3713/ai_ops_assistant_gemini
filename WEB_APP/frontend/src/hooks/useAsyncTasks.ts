/**
 * 非同步任務管理 Hook - 簡化版本
 * 使用 TanStack Query 管理狀態，移除重複的手動狀態管理
 * 提供任務建立、輪詢、取消等完整的非同步任務管理功能
 */
import { useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  type BatchExecutionResponse,
  type APIError
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
   * 清理函數
   */
  cleanup: () => void;
  
  /**
   * 當前執行狀態（從 TanStack Query 衍生）
   */
  isExecuting: boolean;
  
  /**
   * 當前輪詢狀態（從 TanStack Query 衍生）
   */
  isPolling: boolean;
  
  /**
   * 錯誤狀態（從 TanStack Query 衍生）
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

  // 使用 useRef 儲存非渲染數據
  const currentTaskIdRef = useRef<string | null>(null);
  const pollingStartTimeRef = useRef<number>(0);

  // Store 狀態
  const {
    setCurrentTask,
    setIsAsyncMode,
    updateTaskProgress,
    setBatchResults,
    setStatus,
    setIsExecuting: setStoreExecuting,
  } = useAppStore();

  // 計算動態輪詢間隔（指數退避策略）
  const calculatePollInterval = useCallback((data: TaskResponse | undefined) => {
    if (!data || !currentTaskIdRef.current) return false;
    
    // 任務完成時停止輪詢
    if (['completed', 'failed', 'cancelled'].includes(data.status)) {
      return false;
    }
    
    // 根據執行時間動態調整間隔
    const elapsedTime = Date.now() - pollingStartTimeRef.current;
    const baseInterval = pollInterval;
    const multiplier = Math.min(Math.floor(elapsedTime / 10000) + 1, 5); // 每10秒增加一個倍數，最多5倍
    
    return Math.min(baseInterval * multiplier, maxPollInterval);
  }, [pollInterval, maxPollInterval]);

  // 任務建立 Mutation
  const batchMutation = useMutation<TaskResponse, APIError, BatchExecuteRequest>({
    mutationFn: async (request) => {
      const response = await batchExecuteAsync(request);
      return {
        task_id: response.task_id,
        status: 'pending' as const,
        task_type: 'batch_execute' as const,
        created_at: new Date().toISOString(),
        progress: { percentage: 0, current_stage: '初始化任務...', completed_devices: 0, total_devices: request.devices.length },
        result: null,
        error: null
      };
    },
    onMutate: () => {
      setIsAsyncMode(true);
      setStoreExecuting(true);
      setStatus('建立非同步任務...', 'loading');
    },
    onSuccess: (taskData) => {
      currentTaskIdRef.current = taskData.task_id;
      pollingStartTimeRef.current = Date.now();
      setCurrentTask(taskData);
      setStatus('任務已建立，開始執行...', 'loading');
    },
    onError: (error) => {
      setStoreExecuting(false);
      setIsAsyncMode(false);
      const errorMessage = error.message || '建立任務失敗';
      setStatus(`建立任務失敗: ${errorMessage}`, 'error');
    },
  });

  // 任務狀態輪詢 Query
  const taskQuery = useQuery<TaskResponse, APIError>({
    queryKey: ['taskStatus', currentTaskIdRef.current],
    queryFn: () => getTaskStatus(currentTaskIdRef.current!),
    enabled: !!currentTaskIdRef.current,
    refetchInterval: (data) => calculatePollInterval(data),
    refetchIntervalInBackground: true,
    staleTime: 0, // 總是認為數據過時，確保及時更新
    onSuccess: (taskData) => {
      setCurrentTask(taskData);
      updateTaskProgress(taskData.task_id, taskData.progress.percentage, taskData.progress.current_stage);
      
      // 檢查任務是否完成
      if (taskData.status === 'completed') {
        setStoreExecuting(false);
        if (taskData.result) {
          setBatchResults(taskData.result.results || []);
          setStatus('任務執行完成', 'success');
        }
        currentTaskIdRef.current = null;
      } else if (taskData.status === 'failed') {
        setStoreExecuting(false);
        setStatus(taskData.error || '任務執行失敗', 'error');
        currentTaskIdRef.current = null;
      } else if (taskData.status === 'cancelled') {
        setStoreExecuting(false);
        setStatus('任務已被取消', 'warning');
        currentTaskIdRef.current = null;
      }
    },
    onError: (error) => {
      setStoreExecuting(false);
      const errorMessage = error.message || '查詢任務狀態失敗';
      setStatus(`輪詢失敗: ${errorMessage}`, 'error');
      currentTaskIdRef.current = null;
    },
  });

  // 衍生狀態計算（從 TanStack Query 狀態推導）
  const isSubmitting = batchMutation.isPending;
  const isPolling = taskQuery.isFetching && !!currentTaskIdRef.current;
  const isExecuting = isSubmitting || isPolling;
  const error = batchMutation.error?.message || taskQuery.error?.message || null;

  // 清理函數
  const cleanup = useCallback(() => {
    currentTaskIdRef.current = null;
    pollingStartTimeRef.current = 0;
    setStoreExecuting(false);
  }, [setStoreExecuting]);

  /**
   * 建立並執行非同步批次任務
   */
  const executeAsync = useCallback(async (request: BatchExecuteRequest): Promise<string> => {
    const result = await batchMutation.mutateAsync(request);
    return result.task_id;
  }, [batchMutation]);

  /**
   * 建立非同步任務並等待完成
   */
  const executeAsyncAndWait = useCallback(async (request: BatchExecuteRequest): Promise<BatchExecutionResponse> => {
    setIsAsyncMode(true);
    setStoreExecuting(true);

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
      const errorMessage = error instanceof Error ? error.message : '執行非同步任務失敗';
      setStatus(`執行失敗: ${errorMessage}`, 'error');
      throw error;
    } finally {
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
  ]);

  /**
   * 開始輪詢指定任務
   */
  const startPolling = useCallback((taskId: string) => {
    cleanup(); // 先清理現有狀態
    currentTaskIdRef.current = taskId;
    pollingStartTimeRef.current = Date.now();
    // useQuery 會自動開始輪詢
  }, [cleanup]);

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
    if (!currentTaskIdRef.current) {
      return false;
    }

    try {
      await cancelTask(currentTaskIdRef.current);
      setStatus('任務已取消', 'warning');
      cleanup();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '取消任務失敗';
      setStatus(`取消任務失敗: ${errorMessage}`, 'error');
      return false;
    }
  }, [setStatus, cleanup]);

  /**
   * 手動查詢任務狀態
   */
  const queryTaskStatus = useCallback(async (taskId: string): Promise<TaskResponse> => {
    try {
      const task = await getTaskStatus(taskId);
      setCurrentTask(task);
      return task;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '查詢任務狀態失敗';
      setStatus(`查詢失敗: ${errorMessage}`, 'error');
      throw error;
    }
  }, [setCurrentTask, setStatus]);

  return {
    executeAsync,
    executeAsyncAndWait,
    startPolling,
    stopPolling,
    cancelCurrentTask,
    queryTaskStatus,
    isExecuting, // 衍生自 TanStack Query 狀態
    isPolling,   // 衍生自 TanStack Query 狀態
    error,       // 衍生自 TanStack Query 狀態
    cleanup,
  };
};