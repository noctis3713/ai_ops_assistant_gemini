/**
 * 非同步任務管理 Hook
 * 提供任務建立、輪詢、取消等完整的非同步任務管理功能
 * 重構版本：拆分複雜函數，提升可維護性
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  batchExecuteAsync, 
  getTaskStatus, 
  cancelTask,
  TaskPoller
} from '@/api';
import { useAppStore } from '@/store';
import { 
  type BatchExecuteRequest, 
  type TaskResponse, 
  type BatchExecutionResponse 
} from '@/types';
import { logError, logSystemError, logSystemInfo, logUserError } from '@/errors';
import { 
  PROGRESS_STAGE, 
  PROGRESS_STAGE_TEXT, 
  createProgressCallback,
  type ProgressStage 
} from '@/config/app';

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

  // 日誌記錄 - 已簡化，移除 useLogger

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
    setProgressVisibility,
    setBatchProgress,
  } = useAppStore();

  // 輪詢控制
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const taskPollerRef = useRef<TaskPoller | null>(null);
  const lastExecutionTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 創建進度回調處理器
  const createProgressHandler = useCallback((totalDevices: number) => {
    return createProgressCallback((update) => {
      // 更新進度條狀態
      if (update.percentage !== undefined) {
        setBatchProgress({ 
          completedDevices: Math.round((update.percentage / 100) * totalDevices)
        });
      }
      
      // 更新階段訊息
      if (update.stage) {
        setBatchProgress({ 
          currentStage: update.stage, 
          stageMessage: update.message || PROGRESS_STAGE_TEXT[update.stage]
        });
      } else if (update.message) {
        setBatchProgress({ stageMessage: update.message });
      }
      
      // 更新狀態訊息
      if (update.message) {
        setStatus(update.message, 'loading');
      }
    });
  }, [setBatchProgress, setStatus]);

  /**
   * 清理函數
   */
  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (taskPollerRef.current) {
      taskPollerRef.current.cancel();
      taskPollerRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    setIsPolling(false);
    setTaskPollingActive(false);
    lastExecutionTimeRef.current = 0;
  }, [setTaskPollingActive]);


  /**
   * 處理任務最終結果（成功、失敗、取消）
   */
  const handleFinalTaskResult = useCallback((task: TaskResponse) => {
    const deviceCount = task.params?.devices?.length || 1;
    const progress = createProgressHandler(deviceCount);

    if (task.status === 'completed' && (task.result || task.results)) {
      // 處理成功結果 - 支援新舊兩種資料格式
      // 新格式: task.results.results
      // 舊格式: task.result.results
      let results = [];
      
      if (task.results && typeof task.results === 'object' && 'results' in task.results) {
        // 新格式
        results = task.results.results || [];
      } else if (task.result && typeof task.result === 'object' && 'results' in task.result) {
        // 舊格式
        results = task.result.results || [];
      }
      
      setBatchResults(results);
      
      // 顯示完成階段
      progress.updateStage(PROGRESS_STAGE.COMPLETED);
      
      // 更新最終進度
      setBatchProgress({ completedDevices: results.length });
      
      // 計算統計資訊以匹配同步執行格式
      const successful = results.filter((r: { success: boolean }) => r.success).length;
      const failed = results.length - successful;
      const total = results.length;
      
      const completionMessage = `執行完成：${successful} 成功，${failed} 失敗，共 ${total} 個設備`;
      setStatus(completionMessage, failed > 0 ? 'error' : 'success');
      
      // 更新完成訊息
      progress.updateMessage(completionMessage);
      
      logSystemInfo('Task completed successfully', {
        taskId: task.task_id,
        resultCount: results.length,
        successful,
        failed,
      });
    } else if (task.status === 'failed') {
      // 處理失敗結果
      progress.updateStage(PROGRESS_STAGE.FAILED);
      
      const failureMessage = task.error || '任務執行失敗';
      setStatus(failureMessage, 'error');
      progress.updateMessage(failureMessage);
      
      logError('Task failed', {
        taskId: task.task_id,
        error: task.error,
      });
    } else if (task.status === 'cancelled') {
      // 處理取消結果
      progress.updateStage(PROGRESS_STAGE.CANCELLED);
      
      const cancelMessage = '任務已被取消';
      setStatus(cancelMessage, 'warning');
      progress.updateMessage(cancelMessage);
    }
  }, [
    createProgressHandler,
    setBatchResults,
    setBatchProgress,
    setStatus,
  ]);

  /**
   * 組件卸載時清理資源
   */
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /**
   * 錯誤訊息轉換器 - 提取為獨立函數以便測試
   */
  const transformErrorMessage = useCallback((errorMessage: string): string => {
    if (errorMessage.includes('無效的任務 ID') || errorMessage.includes('undefined')) {
      return '任務初始化失敗，請稍後再試';
    }
    if (errorMessage.includes('網路') || errorMessage.includes('Network')) {
      return '網路連線異常，請檢查網路狀態';
    }
    if (errorMessage.includes('超時') || errorMessage.includes('timeout')) {
      return '操作超時，請稍後再試';
    }
    if (errorMessage.includes('404') || errorMessage.includes('不存在')) {
      return '任務已結束或不存在';
    }
    return errorMessage;
  }, []);

  /**
   * 錯誤處理 - 拆分為更小的函數
   */
  const handleError = useCallback((error: unknown, context: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const userFriendlyMessage = transformErrorMessage(errorMessage);
    
    setError(`${context}: ${userFriendlyMessage}`);
    setStatus(userFriendlyMessage, 'error');
    
    // 記錄詳細錯誤
    logError(`${context} failed`, {
      originalError: errorMessage,
      userFriendlyMessage,
      context,
      isPolling: isPolling,
      currentTaskId: currentTask?.task_id,
      timestamp: new Date().toISOString(),
    });
  }, [transformErrorMessage, setStatus, isPolling, currentTask?.task_id]);

  /**
   * 任務 ID 驗證 - 提取為獨立函數
   */
  const validateTaskId = useCallback((taskId: string, context: string): boolean => {
    if (!taskId || taskId === 'undefined' || taskId.trim() === '') {
      const errorMsg = `無效的任務 ID: '${taskId}'，${context}`;
      logError('Invalid task ID provided', { 
        taskId, 
        type: typeof taskId,
        isEmpty: !taskId,
        isUndefinedString: taskId === 'undefined',
        context
      });
      handleError(new Error(errorMsg), '任務 ID 驗證失敗');
      return false;
    }
    return true;
  }, [handleError]);

  /**
   * 輪詢任務狀態（重構版，使用服務層輪詢函數）
   */
  const pollTask = useCallback(async (taskId: string) => {
    if (!validateTaskId(taskId, '跳過輪詢')) {
      return;
    }

    
    setIsPolling(true);
    setTaskPollingActive(true);
    
    try {
      // 創建 TaskPoller 實例
      const taskPoller = new TaskPoller();
      taskPollerRef.current = taskPoller;
      
      // 使用增強版輪詢函數
      await taskPoller.pollTask(taskId, {
        // 進度更新回調
        onProgress: (task: TaskResponse) => {
          setCurrentTask(task);
          updateTaskProgress(taskId, task.progress.percentage, task.progress.current_stage);
          
          // 更新批次進度
          if (task.params?.devices?.length) {
            const deviceCount = task.params.devices.length;
            const completed = Math.round((task.progress.percentage / 100) * deviceCount);
            setBatchProgress({ completedDevices: completed });
          }
        },
        
        // 階段變化回調
        onStageChange: (stage: ProgressStage, _message: string, task: TaskResponse) => {
          const deviceCount = task.params?.devices?.length || 1;
          const progressHandler = createProgressHandler(deviceCount);
          
          // 直接使用服務層階段（現在類型統一）
          progressHandler.updateStage(stage);
        },
        
        // 錯誤處理回調 - 增強版本，智能處理 404 錯誤
        onError: (error: Error, context: string) => {
          // 如果是 404 錯誤且正在輪詢，可能是任務已快速完成並被清理
          if (error.message.includes('404') && context.includes('polling')) {
            console.error('Task may have completed quickly during polling, stopping polling', { 
              taskId,
              context,
              error: error.message 
            });
            
            // 設置任務已完成狀態並清理
            setStatus('任務已完成', 'success');
            cleanup();
            return;
          }
          
          logError('Task polling error', {
            taskId,
            context,
            error: error.message,
          });
          
          handleError(error, `輪詢失敗: ${context}`);
        },
        
        // 任務完成回調
        onComplete: (task: TaskResponse) => {
          
          // 處理最終結果
          handleFinalTaskResult(task);
          
          // 清理輪詢狀態
          cleanup();
        },
        
        // 輪詢配置
        pollInterval,
        maxPollInterval,
        timeout,
      });
      
    } catch (error) {
      logError('Task polling failed', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      handleError(error, '輪詢任務狀態失敗');
      cleanup();
    }
  }, [
    validateTaskId,
    setCurrentTask,
    setTaskPollingActive,
    updateTaskProgress,
    setBatchProgress,
    handleError,
    cleanup,
    createProgressHandler,
    handleFinalTaskResult,
    pollInterval,
    maxPollInterval,
    timeout,
    setStatus,
  ]);

  /**
   * 建立並執行非同步批次任務
   */
  const executeAsync = useCallback(async (request: BatchExecuteRequest): Promise<string> => {

    setError(null);
    setIsExecuting(true);
    setStoreExecuting(true);
    setIsAsyncMode(true);
    
    // 記錄執行開始時間
    setExecutionStartTime(Date.now());
    
    // 初始化批次進度
    setProgressVisibility('batch', true, { totalDevices: request.devices.length });
    
    // 創建進度處理器
    const progress = createProgressHandler(request.devices.length);

    const startTime = performance.now();

    try {
      // 第一階段：提交任務
      progress.updateStage(PROGRESS_STAGE.SUBMITTING);
      setStatus('正在建立任務...', 'loading');

      // 建立非同步任務 - 強化錯誤處理和驗證
      const response = await batchExecuteAsync(request);
      
      // 強化 response 驗證，適配 BaseResponse 格式變化
      if (!response) {
        logError('batchExecuteAsync 回傳 null 或 undefined', { response });
        throw new Error('後端回應為空，任務建立失敗');
      }
      
      // 檢查 task_id 有效性
      if (!response.task_id) {
        logError('任務建立回應缺少 task_id', { response });
        throw new Error('後端未返回任務 ID，任務建立失敗');
      }
      
      if (typeof response.task_id !== 'string') {
        logError('任務 ID 格式錯誤', { 
          taskId: response.task_id, 
          type: typeof response.task_id 
        });
        throw new Error('後端返回的任務 ID 格式錯誤');
      }
      
      if (response.task_id === 'undefined' || response.task_id === 'null' || response.task_id.trim() === '') {
        logError('任務 ID 包含無效值', { taskId: response.task_id });
        throw new Error('後端返回無效的任務 ID，任務建立失敗');
      }
      
      logSystemInfo('非同步任務建立成功', {
        taskId: response.task_id,
        deviceCount: request.devices.length,
        mode: request.mode
      });
      
      // 第二階段：任務已提交
      progress.updateStage(PROGRESS_STAGE.SUBMITTED);
      setStatus(`任務已建立: ${response.task_id.substring(0, 20)}...`, 'success');
      
      logSystemInfo('Async task created', {
        taskId: response.task_id,
        devices: request.devices,
        mode: request.mode,
      });
      
      // 立即更新當前任務狀態（防止競態條件）
      setCurrentTask({
        task_id: response.task_id,
        task_type: 'batch_execute',
        status: 'pending',
        params: {
          devices: request.devices,
          command: request.command,
          mode: request.mode,
        },
        created_at: new Date().toISOString(),
        progress: {
          percentage: 0,
          current_stage: '任務已提交',
          details: {},
        },
        result: null,
        error: undefined,
      });
      
      // 如果啟用自動輪詢，開始輪詢
      if (autoStartPolling) {
        // 快速任務檢測 - 在開始正式輪詢前先快速檢查一次
        setTimeout(async () => {
          try {
            const quickCheck = await getTaskStatus(response.task_id);
            if (quickCheck.status === 'completed' || quickCheck.status === 'failed') {
              // 任務已快速完成，處理結果並停止
              console.error('Quick task completion detected in executeAsync', {
                taskId: response.task_id,
                status: quickCheck.status,
              });
              
              handleFinalTaskResult(quickCheck);
              cleanup();
              return;
            }
          } catch (error) {
            // 增強錯誤處理：如果是 404 錯誤，說明任務可能已經快速完成
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            if (errorMessage.includes('404')) {
              console.error('Task completed too quickly in executeAsync, assuming completion', { 
                taskId: response.task_id,
                error: errorMessage
              });
              
              // 設置為已完成狀態並清理
              setStatus('任務已完成', 'success');
              cleanup();
              return;
            } else {
              // 其他錯誤，繼續正常流程
              console.error('Quick check failed in executeAsync, continuing normally', {
                taskId: response.task_id,
                error: errorMessage
              });
            }
          }
          
          // 如果任務還在運行，顯示連接階段並開始正式輪詢
          if (isExecuting) {
            progress.updateStage(PROGRESS_STAGE.CONNECTING);
            await pollTask(response.task_id);
          }
        }, 50); // 50ms 後快速檢查，更快響應
      }

      return response.task_id;

    } catch (error) {
      const duration = performance.now() - startTime;
      logError('Failed to execute async task', {
        duration,
        deviceCount: request.devices.length,
        mode: request.mode,
        error: error instanceof Error ? error.message : String(error),
      });

      // 顯示失敗階段
      progress.updateStage(PROGRESS_STAGE.FAILED);

      handleError(error, '建立非同步任務失敗');
      setIsExecuting(false);
      setStoreExecuting(false);
      setIsAsyncMode(false);
      setProgressVisibility('batch', false);
      throw error;
    } finally {
      if (!autoStartPolling) {
        setIsExecuting(false);
        setStoreExecuting(false);
        setProgressVisibility('batch', false);
      }
    }
  }, [
    setCurrentTask,
    setStatus,
    setStoreExecuting,
    setIsAsyncMode,
    setExecutionStartTime,
    setProgressVisibility,
    createProgressHandler,
    autoStartPolling,
    pollTask,
    handleError,
    isExecuting,
    cleanup,
    handleFinalTaskResult,
  ]);

  /**
   * 建立非同步任務並等待完成
   */
  const executeAsyncAndWait = useCallback(async (request: BatchExecuteRequest): Promise<BatchExecutionResponse> => {

    setError(null);
    setIsExecuting(true);
    setStoreExecuting(true);
    setIsAsyncMode(true);
    
    // 記錄執行開始時間
    setExecutionStartTime(Date.now());
    
    // 初始化批次進度
    setProgressVisibility('batch', true, { totalDevices: request.devices.length });

    const startTime = performance.now();

    try {
      // 創建 TaskPoller 實例並執行任務
      const taskPoller = new TaskPoller();
      taskPollerRef.current = taskPoller;
      
      // 先建立任務 - 強化錯誤處理
      const taskCreation = await batchExecuteAsync(request);
      
      // 強化任務建立回應驗證，適配 BaseResponse 格式
      if (!taskCreation) {
        logError('executeAsyncAndWait: batchExecuteAsync 回傳空值', { taskCreation });
        throw new Error('後端回應為空，任務建立失敗');
      }
      
      if (!taskCreation.task_id) {
        logError('executeAsyncAndWait: 任務建立回應缺少 task_id', { taskCreation });
        throw new Error('後端未返回任務 ID，任務建立失敗');
      }
      
      if (typeof taskCreation.task_id !== 'string' || taskCreation.task_id.trim() === '') {
        logError('executeAsyncAndWait: 任務 ID 格式錯誤', { 
          taskId: taskCreation.task_id, 
          type: typeof taskCreation.task_id 
        });
        throw new Error('後端返回的任務 ID 格式錯誤');
      }
      
      if (taskCreation.task_id === 'undefined' || taskCreation.task_id === 'null') {
        logError('executeAsyncAndWait: 任務 ID 包含無效值', { taskId: taskCreation.task_id });
        throw new Error('後端返回無效的任務 ID，任務建立失敗');
      }
      
      logSystemInfo('executeAsyncAndWait: 任務建立成功', {
        taskId: taskCreation.task_id,
        deviceCount: request.devices.length,
        mode: request.mode
      });
      
      // 立即更新當前任務狀態（防止競態條件）
      const initialTask: TaskResponse = {
        task_id: taskCreation.task_id,
        task_type: 'batch_execute',
        status: 'pending',
        params: {
          devices: request.devices,
          command: request.command,
          mode: request.mode,
        },
        created_at: new Date().toISOString(),
        progress: {
          percentage: 0,
          current_stage: '任務已提交',
          details: {},
        },
        result: null,
        error: undefined,
      };
      setCurrentTask(initialTask);
      
      // 快速任務檢測 - 立即檢查一次狀態（避免快速完成的任務被遺漏）
      setTimeout(async () => {
        try {
          const quickCheck = await getTaskStatus(taskCreation.task_id);
          if (quickCheck.status === 'completed' || quickCheck.status === 'failed') {
            // 任務已快速完成，處理結果並停止後續輪詢
            console.error('Quick task completion detected', {
              taskId: taskCreation.task_id,
              status: quickCheck.status
            });
            
            handleFinalTaskResult(quickCheck);
            cleanup();
            
            // 取得執行結果
            let result: BatchExecutionResponse;
            if (quickCheck.results && typeof quickCheck.results === 'object') {
              result = quickCheck.results as BatchExecutionResponse;
            } else if (quickCheck.result && typeof quickCheck.result === 'object') {
              result = quickCheck.result as BatchExecutionResponse;
            } else {
              throw new Error('任務結果格式錯誤');
            }
            
            return result;
          }
        } catch (error) {
          // 增強錯誤處理：如果是 404 錯誤，說明任務可能已經快速完成並被清理
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('404')) {
            console.error('Task completed too quickly to track, assuming completion', { 
              taskId: taskCreation.task_id,
              error: errorMessage
            });
            
            // 設置為已完成狀態並清理
            setStatus('任務已完成', 'success');
            cleanup();
            
            // 返回空結果，但不拋出錯誤
            return { results: [] } as BatchExecutionResponse;
          } else {
            // 其他錯誤，繼續正常輪詢
            console.error('Quick check failed, continuing with normal polling', {
              taskId: taskCreation.task_id,
              error: errorMessage
            });
          }
        }
      }, 50); // 50ms 後快速檢查，更快響應
      
      // 使用增強版輪詢器等待完成
      const completedTask = await taskPoller.pollTask(taskCreation.task_id, {
        // 進度更新回調
        onProgress: (task: TaskResponse) => {
          
          setCurrentTask(task);
          updateTaskProgress(task.task_id, task.progress.percentage, task.progress.current_stage);
          
          // 更新批次進度
          const completed = Math.round((task.progress.percentage / 100) * request.devices.length);
          setBatchProgress({ completedDevices: completed });
        },
        
        // 錯誤處理回調
        onError: (error: Error, context: string) => {
          logError('Task polling error in executeAndWait', {
            taskId: taskCreation.task_id,
            context,
            error: error.message,
          });
        },
        
        pollInterval,
        maxPollInterval,
        timeout,
      });
      
      // 檢查任務結果
      if (completedTask.status === 'failed') {
        throw new Error(completedTask.error || '任務執行失敗');
      }
      
      if (completedTask.status === 'cancelled') {
        throw new Error('任務已被取消');
      }
      
      // 取得執行結果 - 支援新舊兩種資料格式
      let result: BatchExecutionResponse;
      
      if (completedTask.results && typeof completedTask.results === 'object') {
        // 新格式: 資料直接在 results 欄位
        result = completedTask.results as BatchExecutionResponse;
      } else if (completedTask.result && typeof completedTask.result === 'object') {
        // 舊格式: 資料在 result 欄位
        result = completedTask.result as BatchExecutionResponse;
      } else {
        throw new Error('任務結果格式錯誤');
      }
      
      const duration = performance.now() - startTime;

      setBatchResults(result.results);
      
      // 更新最終進度
      setBatchProgress({ completedDevices: result.results.length });
      
      // 計算統計資訊以匹配同步執行格式
      const successful = result.results.filter(r => r.success).length;
      const failed = result.results.length - successful;
      const total = result.results.length;
      
      setStatus(
        `執行完成：${successful} 成功，${failed} 失敗，共 ${total} 個設備`,
        failed > 0 ? 'error' : 'success'
      );
      
      logSystemInfo('Async task completed successfully', {
        deviceCount: request.devices.length,
        resultCount: result.results.length,
        duration,
        avgTimePerDevice: duration / request.devices.length,
      });

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      
      logError('Failed to execute async task and wait', {
        duration,
        deviceCount: request.devices.length,
        mode: request.mode,
        error: error instanceof Error ? error.message : String(error),
      });

      handleError(error, '執行非同步任務失敗');
      throw error;
    } finally {
      setIsExecuting(false);
      setStoreExecuting(false);
      setIsAsyncMode(false);
      setProgressVisibility('batch', false);
    }
  }, [
    setStoreExecuting,
    setIsAsyncMode,
    setExecutionStartTime,
    setProgressVisibility,
    setCurrentTask,
    updateTaskProgress,
    setBatchResults,
    setBatchProgress,
    setStatus,
    pollInterval,
    maxPollInterval,
    timeout,
    handleError,
    cleanup,
    handleFinalTaskResult,
  ]);

  /**
   * 開始輪詢指定任務
   */
  const startPolling = useCallback((taskId: string) => {
    // 強化任務 ID 驗證
    if (!taskId || taskId === 'undefined' || taskId.trim() === '') {
      logError('Invalid task ID provided to startPolling', { 
        taskId, 
        type: typeof taskId 
      });
      handleError(new Error(`無效的任務 ID: '${taskId}'`), '開始輪詢失敗');
      return;
    }
    
    cleanup(); // 先清理現有輪詢
    pollTask(taskId);
  }, [cleanup, pollTask, handleError]);

  /**
   * 停止當前輪詢
   */
  const stopPolling = useCallback(() => {
    cleanup();
  }, [cleanup]);

  /**
   * 取消當前任務 - 增強版本，智能處理快速完成的任務
   */
  const cancelCurrentTask = useCallback(async (): Promise<boolean> => {
    if (!currentTask) {
      logError('Attempted to cancel task but no current task found');
      setStatus('沒有進行中的任務可以取消', 'warning');
      return false;
    }

    // 檢查任務是否可以取消
    if (currentTask.status === 'completed' || currentTask.status === 'failed' || currentTask.status === 'cancelled') {
      setStatus('任務已結束，無法取消', 'warning');
      return false;
    }

    logUser('Cancelling current task', {
      taskId: currentTask.task_id,
      status: currentTask.status,
    });

    try {
      setStatus('正在取消任務...', 'loading');
      const result = await cancelTask(currentTask.task_id);
      
      // 清理所有錯誤狀態
      setError(null);
      
      // 根據回應決定顯示訊息
      if (result?.completed) {
        setStatus('任務已完成', 'success');
        console.error('Task was already completed when cancel was attempted', {
          taskId: currentTask.task_id,
        });
      } else if (result?.cancelled) {
        setStatus('任務已成功取消', 'warning');
        console.error('Task cancelled successfully', {
          taskId: currentTask.task_id,
        });
      } else {
        // 後備處理 - 基於 message 內容判斷
        if (result?.message?.includes('已完成')) {
          setStatus('任務已完成', 'success');
        } else if (result?.message?.includes('已取消')) {
          setStatus('任務已成功取消', 'warning');
        } else {
          setStatus('任務已處理完成', 'success');
        }
        
        console.error('Task processed successfully', {
          taskId: currentTask.task_id,
          message: result?.message,
        });
      }
      
      cleanup();
      return true;
      
    } catch (error) {
      // 智能錯誤處理 - 關鍵改進
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 檢查是否是 404 錯誤（任務已完成並被清理）
      if (errorMessage.includes('404') || errorMessage.includes('任務不存在') || errorMessage.includes('任務已完成並被自動清理')) {
        // 404 錯誤表示任務已完成並被清理，這實際上是成功的
        setStatus('任務已完成', 'success');
        cleanup();
        
        console.error('Task was already completed and cleaned up', {
          taskId: currentTask.task_id,
          error: errorMessage,
        });
        
        return true; // 返回 true 表示"取消"成功（實際是任務已完成）
      }
      
      // 其他錯誤才是真正的取消失敗
      logError('Failed to cancel task', {
        taskId: currentTask.task_id,
        error: errorMessage,
      });
      
      handleError(error, '取消任務失敗');
      return false;
    }
  }, [currentTask, setStatus, setError, handleError, cleanup]);

  /**
   * 手動查詢任務狀態
   */
  const queryTaskStatus = useCallback(async (taskId: string): Promise<TaskResponse> => {
    // 強化任務 ID 驗證
    if (!taskId || taskId === 'undefined' || taskId.trim() === '') {
      const errorMsg = `無效的任務 ID: '${taskId}'，無法查詢狀態`;
      logError('Invalid task ID provided to queryTaskStatus', { 
        taskId, 
        type: typeof taskId 
      });
      const error = new Error(errorMsg);
      handleError(error, '任務 ID 驗證失敗');
      throw error;
    }

    try {
      const task = await getTaskStatus(taskId);
      setCurrentTask(task);
      
      return task;
    } catch (error) {
      logError('Failed to query task status', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      
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