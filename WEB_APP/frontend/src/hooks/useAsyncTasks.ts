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
import { useLogger } from './useLogger';

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

  // 日誌記錄
  const logger = useLogger({ 
    componentName: 'useAsyncTasks',
    enablePerformanceTracking: true,
  });

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
    setExecutionStartTime,
    showBatchProgress,
    updateBatchProgress,
    hideBatchProgress,
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
    
    // 使用日誌系統記錄錯誤
    logger.error(
      `${context} failed`,
      {
        errorMessage,
        context,
        isPolling: isPolling,
        currentTaskId: currentTask?.task_id,
      },
      error instanceof Error ? error : undefined
    );
  }, [setStatus, logger, isPolling, currentTask?.task_id]);

  /**
   * 輪詢任務狀態
   */
  const pollTask = useCallback(async (taskId: string) => {
    if (!taskId) return;

    logger.info('Starting task polling', { taskId, options });
    
    setIsPolling(true);
    setTaskPollingActive(true);
    
    let currentInterval = pollInterval;
    let pollCount = 0;
    const startTime = Date.now();

    const poll = async () => {
      try {
        pollCount++;
        
        // 檢查超時
        if (Date.now() - startTime > timeout) {
          logger.warn('Task polling timeout', {
            taskId,
            pollDuration: Date.now() - startTime,
            pollCount,
          });
          throw new Error(`任務輪詢超時: ${taskId}`);
        }

        // 查詢任務狀態
        const task = await getTaskStatus(taskId);
        setCurrentTask(task);

        logger.debug('Task status polled', {
          taskId,
          status: task.status,
          progress: task.progress.percentage,
          stage: task.progress.current_stage,
          pollCount,
        });

        // 更新進度
        updateTaskProgress(taskId, task.progress.percentage, task.progress.current_stage);
        
        // 更新批次進度（從任務參數中獲取設備數量）
        if (task.params?.devices?.length) {
          const deviceCount = task.params.devices.length;
          const completed = Math.round((task.progress.percentage / 100) * deviceCount);
          updateBatchProgress(completed);
        }

        // 檢查任務是否完成
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          const totalDuration = Date.now() - startTime;
          
          logger.info('Task polling finished', {
            taskId,
            status: task.status,
            totalDuration,
            pollCount,
            avgPollInterval: totalDuration / pollCount,
          });
          
          cleanup();
          
          if (task.status === 'completed' && task.result) {
            // 處理成功結果
            const results = task.result.results || [];
            setBatchResults(results);
            
            // 更新最終進度
            updateBatchProgress(results.length);
            
            // 計算統計資訊以匹配同步執行格式
            const successful = results.filter(r => r.success).length;
            const failed = results.length - successful;
            const total = results.length;
            
            setStatus(
              `執行完成：${successful} 成功，${failed} 失敗，共 ${total} 個設備`,
              failed > 0 ? 'error' : 'success'
            );
            
            logger.info('Task completed successfully', {
              taskId,
              resultCount: task.result.results?.length || 0,
              totalDuration,
            });
          } else if (task.status === 'failed') {
            // 處理失敗結果
            setStatus(task.error || '任務執行失敗', 'error');
            
            logger.error('Task failed', {
              taskId,
              error: task.error,
              totalDuration,
            });
          } else if (task.status === 'cancelled') {
            // 處理取消結果
            setStatus('任務已被取消', 'warning');
            
            logger.warn('Task cancelled', {
              taskId,
              totalDuration,
            });
          }
          
          return;
        }

        // 設定下次輪詢
        const previousInterval = currentInterval;
        currentInterval = Math.min(currentInterval * 1.2, maxPollInterval);
        
        logger.debug('Scheduling next poll', {
          taskId,
          nextInterval: currentInterval,
          previousInterval,
          pollCount,
        });
        
        pollingRef.current = setTimeout(poll, currentInterval);

      } catch (error) {
        logger.error('Task polling error', {
          taskId,
          pollCount,
          pollDuration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        }, error instanceof Error ? error : undefined);
        
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
    updateBatchProgress,
    setBatchResults,
    setStatus,
    handleError,
    cleanup,
  ]);

  /**
   * 建立並執行非同步批次任務
   */
  const executeAsync = useCallback(async (request: BatchExecuteRequest): Promise<string> => {
    logger.info('Executing async task', {
      deviceCount: request.devices.length,
      mode: request.mode,
      autoStartPolling,
    });

    setError(null);
    setIsExecuting(true);
    setStoreExecuting(true);
    setIsAsyncMode(true);
    
    // 記錄執行開始時間
    setExecutionStartTime(Date.now());
    
    // 初始化批次進度
    showBatchProgress(request.devices.length);

    const startTime = performance.now();

    try {
      // 建立非同步任務
      const response = await batchExecuteAsync(request);
      
      logger.info('Async task created', {
        taskId: response.task_id,
        devices: request.devices,
        mode: request.mode,
      });
      
      // 如果啟用自動輪詢，開始輪詢
      if (autoStartPolling) {
        logger.debug('Starting auto polling', { taskId: response.task_id });
        await pollTask(response.task_id);
      }

      const duration = performance.now() - startTime;
      logger.logPerformance('executeAsync', duration, {
        taskId: response.task_id,
        deviceCount: request.devices.length,
      });

      return response.task_id;

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Failed to execute async task', {
        duration,
        deviceCount: request.devices.length,
        mode: request.mode,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : undefined);

      handleError(error, '建立非同步任務失敗');
      setIsExecuting(false);
      setStoreExecuting(false);
      setIsAsyncMode(false);
      hideBatchProgress();
      throw error;
    } finally {
      if (!autoStartPolling) {
        setIsExecuting(false);
        setStoreExecuting(false);
        hideBatchProgress();
      }
    }
  }, [
    setStoreExecuting,
    setIsAsyncMode,
    setExecutionStartTime,
    showBatchProgress,
    hideBatchProgress,
    autoStartPolling,
    pollTask,
    handleError,
  ]);

  /**
   * 建立非同步任務並等待完成
   */
  const executeAsyncAndWait = useCallback(async (request: BatchExecuteRequest): Promise<BatchExecutionResponse> => {
    logger.info('Executing async task and waiting', {
      deviceCount: request.devices.length,
      mode: request.mode,
      timeout,
    });

    setError(null);
    setIsExecuting(true);
    setStoreExecuting(true);
    setIsAsyncMode(true);
    
    // 記錄執行開始時間
    setExecutionStartTime(Date.now());
    
    // 初始化批次進度
    showBatchProgress(request.devices.length);

    const startTime = performance.now();

    try {
      const result = await executeAsyncBatchAndWait(request, {
        onProgress: (task) => {
          logger.debug('Task progress update', {
            taskId: task.task_id,
            progress: task.progress.percentage,
            stage: task.progress.current_stage,
          });
          
          setCurrentTask(task);
          updateTaskProgress(task.task_id, task.progress.percentage, task.progress.current_stage);
          
          // 更新批次進度
          const completed = Math.round((task.progress.percentage / 100) * request.devices.length);
          updateBatchProgress(completed);
        },
        pollInterval,
        maxPollInterval,
        timeout,
      });

      const duration = performance.now() - startTime;

      setBatchResults(result.results);
      
      // 更新最終進度
      updateBatchProgress(result.results.length);
      
      // 計算統計資訊以匹配同步執行格式
      const successful = result.results.filter(r => r.success).length;
      const failed = result.results.length - successful;
      const total = result.results.length;
      
      setStatus(
        `執行完成：${successful} 成功，${failed} 失敗，共 ${total} 個設備`,
        failed > 0 ? 'error' : 'success'
      );
      
      logger.info('Async task completed successfully', {
        deviceCount: request.devices.length,
        resultCount: result.results.length,
        duration,
        avgTimePerDevice: duration / request.devices.length,
      });

      logger.logPerformance('executeAsyncAndWait', duration, {
        deviceCount: request.devices.length,
        resultCount: result.results.length,
      });
      
      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      
      logger.error('Failed to execute async task and wait', {
        duration,
        deviceCount: request.devices.length,
        mode: request.mode,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : undefined);

      handleError(error, '執行非同步任務失敗');
      throw error;
    } finally {
      setIsExecuting(false);
      setStoreExecuting(false);
      setIsAsyncMode(false);
      hideBatchProgress();
    }
  }, [
    setStoreExecuting,
    setIsAsyncMode,
    setExecutionStartTime,
    showBatchProgress,
    updateBatchProgress,
    hideBatchProgress,
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
    logger.info('Manually starting polling', { taskId });
    cleanup(); // 先清理現有輪詢
    pollTask(taskId);
  }, [cleanup, pollTask, logger]);

  /**
   * 停止當前輪詢
   */
  const stopPolling = useCallback(() => {
    logger.info('Manually stopping polling', { 
      wasPolling: isPolling,
      currentTaskId: currentTask?.task_id 
    });
    cleanup();
  }, [cleanup, logger, isPolling, currentTask?.task_id]);

  /**
   * 取消當前任務
   */
  const cancelCurrentTask = useCallback(async (): Promise<boolean> => {
    if (!currentTask) {
      logger.warn('Attempted to cancel task but no current task found');
      return false;
    }

    logger.info('Cancelling current task', {
      taskId: currentTask.task_id,
      status: currentTask.status,
    });

    try {
      await cancelTask(currentTask.task_id);
      setStatus('任務已取消', 'warning');
      cleanup();
      
      logger.info('Task cancelled successfully', {
        taskId: currentTask.task_id,
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to cancel task', {
        taskId: currentTask.task_id,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : undefined);
      
      handleError(error, '取消任務失敗');
      return false;
    }
  }, [currentTask, setStatus, handleError, cleanup, logger]);

  /**
   * 手動查詢任務狀態
   */
  const queryTaskStatus = useCallback(async (taskId: string): Promise<TaskResponse> => {
    logger.debug('Querying task status', { taskId });

    try {
      const task = await getTaskStatus(taskId);
      setCurrentTask(task);
      
      logger.debug('Task status retrieved', {
        taskId,
        status: task.status,
        progress: task.progress.percentage,
      });
      
      return task;
    } catch (error) {
      logger.error('Failed to query task status', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : undefined);
      
      handleError(error, '查詢任務狀態失敗');
      throw error;
    }
  }, [setCurrentTask, handleError, logger]);

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