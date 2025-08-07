import { PROGRESS_STAGE, type ProgressStage } from '@/constants';
import type { 
  TaskResponse, 
  BatchExecuteRequest, 
  BatchExecutionResponse,
  TaskCreationResponse
} from '@/types/api';

/**
 * 輪詢元數據接口
 */
export interface PollMeta {
  pollCount: number;
  duration: number;
  currentInterval: number;
  startTime: number;
}

/**
 * 增強版輪詢回調接口
 */
export interface EnhancedPollCallbacks {
  /**
   * 進度更新回調
   */
  onProgress?: (task: TaskResponse, meta: PollMeta) => void;
  
  /**
   * 階段變化回調
   */
  onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
  
  /**
   * 錯誤處理回調
   */
  onError?: (error: Error, context: string) => void;
  
  /**
   * 任務完成回調（成功、失敗、取消都會觸發）
   */
  onComplete?: (task: TaskResponse, meta: PollMeta) => void;
  
  /**
   * 任務開始回調
   */
  onStart?: (taskId: string) => void;
}

/**
 * TaskPoller 依賴注入介面
 */
export interface TaskPollerDependencies {
  getTaskStatus: (taskId: string) => Promise<TaskResponse>;
  batchExecuteAsync: (request: BatchExecuteRequest) => Promise<TaskCreationResponse>;
}

/**
 * 高級任務輪詢器類別
 * 提供完整的任務輪詢和管理功能
 */
export class TaskPoller {
  private abortController: AbortController;
  private callbacks: Partial<EnhancedPollCallbacks>;
  private isActive: boolean = false;
  private dependencies: TaskPollerDependencies;
  
  constructor(
    dependencies: TaskPollerDependencies,
    callbacks: Partial<EnhancedPollCallbacks> = {}
  ) {
    this.dependencies = dependencies;
    this.callbacks = callbacks;
    this.abortController = new AbortController();
  }
  
  /**
   * 輪詢單個任務
   */
  public async pollTask(
    taskId: string,
    options: {
      onProgress?: (task: TaskResponse, meta: PollMeta) => void;
      onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
      onError?: (error: Error, context: string) => void;
      onComplete?: (task: TaskResponse, meta: PollMeta) => void;
      onStart?: (taskId: string) => void;
      pollInterval?: number;
      maxPollInterval?: number;
      timeout?: number;
    } = {}
  ): Promise<TaskResponse> {
    // 參數驗證 - 防止無效的任務 ID
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      const error = new Error(`TaskPoller: 無效的任務 ID '${taskId}'`);
      if (options.onError) {
        options.onError(error, '任務 ID 驗證失敗');
      }
      throw error;
    }
    
    // 防止 'undefined' 字串
    if (taskId === 'undefined' || taskId === 'null') {
      const error = new Error(`TaskPoller: 不可接受的任務 ID 值 '${taskId}'`);
      if (options.onError) {
        options.onError(error, '任務 ID 值無效');
      }
      throw error;
    }
    
    // 合併預設回調和選項回調
    const mergedOptions = {
      ...options,
      onProgress: options.onProgress || this.callbacks.onProgress,
      onStageChange: options.onStageChange || this.callbacks.onStageChange,
      onError: options.onError || this.callbacks.onError,
      onComplete: options.onComplete || this.callbacks.onComplete,
      onStart: options.onStart || this.callbacks.onStart,
      abortSignal: this.abortController.signal,
    };
    
    this.isActive = true;
    
    try {
      const result = await this.pollTaskUntilComplete(taskId, mergedOptions);
      return result;
    } finally {
      this.isActive = false;
    }
  }
  
  /**
   * 執行並等待任務完成
   */
  public async executeAndWait(
    request: BatchExecuteRequest,
    options: {
      onProgress?: (task: TaskResponse, meta: PollMeta) => void;
      onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
      onError?: (error: Error, context: string) => void;
      onComplete?: (task: TaskResponse, meta: PollMeta) => void;
      onStart?: (taskId: string) => void;
      pollInterval?: number;
      maxPollInterval?: number;
      timeout?: number;
    } = {}
  ): Promise<BatchExecutionResponse> {
    // 建立非同步任務
    const taskCreation = await this.dependencies.batchExecuteAsync(request);
    
    // 輪詢直到完成
    const completedTask = await this.pollTask(taskCreation.task_id, options);
    
    // 檢查任務結果
    if (completedTask.status === 'failed') {
      throw new Error(completedTask.error || '任務執行失敗');
    }
    
    if (completedTask.status === 'cancelled') {
      throw new Error('任務已被取消');
    }
    
    // 返回執行結果
    return completedTask.result as BatchExecutionResponse;
  }
  
  /**
   * 取消當前輪詢
   */
  public cancel(): void {
    this.abortController.abort();
    this.isActive = false;
  }
  
  /**
   * 檢查是否正在輪詢
   */
  public isPolling(): boolean {
    return this.isActive;
  }
  
  /**
   * 重置輪詢器（創建新的 AbortController）
   */
  public reset(): void {
    this.cancel();
    this.abortController = new AbortController();
  }
  
  /**
   * 內部輪詢實現（從 pollTaskUntilComplete 遷移過來）
   */
  private async pollTaskUntilComplete(
    taskId: string,
    options: {
      onProgress?: (task: TaskResponse, meta: PollMeta) => void;
      onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
      onError?: (error: Error, context: string) => void;
      onComplete?: (task: TaskResponse, meta: PollMeta) => void;
      onStart?: (taskId: string) => void;
      pollInterval?: number;
      maxPollInterval?: number;
      timeout?: number;
      abortSignal?: AbortSignal;
    } = {}
  ): Promise<TaskResponse> {
    const {
      onProgress,
      onStageChange,
      onError,
      onComplete,
      onStart,
      pollInterval = 2000,
      maxPollInterval = 10000,
      timeout = 30 * 60 * 1000, // 30 分鐘
      abortSignal
    } = options;
    
    // 觸發開始回調
    if (onStart) {
      onStart(taskId);
    }
    
    const startTime = Date.now();
    let currentInterval = pollInterval;
    let pollCount = 0;
    let lastStage: string | undefined;
    
    while (true) {
      // 檢查是否被取消
      if (abortSignal?.aborted) {
        throw new Error('輪詢已被用戶取消');
      }
      
      // 檢查超時
      const currentTime = Date.now();
      const duration = currentTime - startTime;
      if (duration > timeout) {
        const error = new Error(`任務輪詢超時: ${taskId}`);
        if (onError) {
          onError(error, '輪詢超時');
        }
        throw error;
      }
      
      try {
        pollCount++;
        const task = await this.dependencies.getTaskStatus(taskId);
        
        // 驗證任務資料有效性
        if (!task || !task.task_id) {
          throw new Error(`無效的任務資料: taskId=${taskId}`);
        }
        
        const meta: PollMeta = { 
          pollCount, 
          duration: currentTime - startTime, 
          currentInterval, 
          startTime 
        };
        
        // 調用進度回調
        if (onProgress) {
          onProgress(task, meta);
        }
        
        // 檢查階段變化
        if (onStageChange && task.progress.current_stage !== lastStage) {
          const stage = this.mapTaskProgressToStage(task);
          const message = this.generateStageMessage(task, stage);
          onStageChange(stage, message, task);
          lastStage = task.progress.current_stage;
        }
        
        // 檢查任務是否完成
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          // 觸發完成回調
          if (onComplete) {
            onComplete(task, meta);
          }
          return task;
        }
        
        // 等待下次輪詢
        await new Promise(resolve => setTimeout(resolve, currentInterval));
        
        // 使用指數退避策略增加輪詢間隔
        currentInterval = Math.min(currentInterval * 1.2, maxPollInterval);
        
      } catch (error) {
        // 如果是 404 錯誤，任務可能已被清理
        if (error instanceof Error && error.message.includes('404')) {
          const notFoundError = new Error(`任務不存在或已被清理: ${taskId}`);
          if (onError) {
            onError(notFoundError, '任務不存在');
          }
          throw notFoundError;
        }
        
        // 觸發錯誤回調
        if (onError && error instanceof Error) {
          onError(error, '查詢任務狀態失敗');
        }
        
        // 其他錯誤重新拋出
        throw error;
      }
    }
  }
  
  /**
   * 將任務進度映射到前端階段
   */
  private mapTaskProgressToStage(task: TaskResponse): ProgressStage {
    const requestMode = task.params?.mode;
    
    switch (task.status) {
      case 'completed':
        return PROGRESS_STAGE.COMPLETED;
      case 'failed':
        return PROGRESS_STAGE.FAILED;
      case 'cancelled':
        return PROGRESS_STAGE.CANCELLED;
      case 'running':
        if (task.progress.percentage < 20) {
          return PROGRESS_STAGE.CONNECTING;
        } else {
          return requestMode === 'ai' ? PROGRESS_STAGE.AI_ANALYZING : PROGRESS_STAGE.EXECUTING;
        }
      default:
        return PROGRESS_STAGE.SUBMITTED;
    }
  }
  
  /**
   * 生成階段對應的訊息
   */
  private generateStageMessage(task: TaskResponse, stage: ProgressStage): string {
    const deviceCount = task.params?.devices?.length || 1;
    
    switch (stage) {
      case PROGRESS_STAGE.CONNECTING:
        return '連接到設備中...';
      case PROGRESS_STAGE.EXECUTING:
        return deviceCount === 1 ? '執行中... (1 個設備)' : `執行中... (${deviceCount} 個設備)`;
      case PROGRESS_STAGE.AI_ANALYZING:
        return 'AI 分析中...';
      case PROGRESS_STAGE.COMPLETED:
        return '執行完成';
      case PROGRESS_STAGE.FAILED:
        return '執行失敗';
      case PROGRESS_STAGE.CANCELLED:
        return '任務已取消';
      default:
        return task.progress.current_stage || '處理中...';
    }
  }
}

/**
 * 創建高級任務輪詢器工廠函數（向後兼容）
 * 提供配置化的輪詢器創建
 */
export const createAdvancedTaskPoller = (
  dependencies: TaskPollerDependencies,
  defaultCallbacks: Partial<EnhancedPollCallbacks> = {}
) => {
  const poller = new TaskPoller(dependencies, defaultCallbacks);
  
  return {
    /**
     * 輪詢單個任務
     */
    pollTask: async (
      taskId: string, 
      options: {
        onProgress?: (task: TaskResponse, meta: PollMeta) => void;
        onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
        onError?: (error: Error, context: string) => void;
        onComplete?: (task: TaskResponse, meta: PollMeta) => void;
        onStart?: (taskId: string) => void;
        pollInterval?: number;
        maxPollInterval?: number;
        timeout?: number;
        abortSignal?: AbortSignal;
      } = {}
    ): Promise<TaskResponse> => {
      return poller.pollTask(taskId, options);
    },
    
    /**
     * 執行並等待任務完成
     */
    executeAndWait: async (
      request: BatchExecuteRequest,
      options: {
        onProgress?: (task: TaskResponse, meta: PollMeta) => void;
        onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
        onError?: (error: Error, context: string) => void;
        onComplete?: (task: TaskResponse, meta: PollMeta) => void;
        onStart?: (taskId: string) => void;
        pollInterval?: number;
        maxPollInterval?: number;
        timeout?: number;
        abortSignal?: AbortSignal;
      } = {}
    ): Promise<BatchExecutionResponse> => {
      return poller.executeAndWait(request, options);
    }
  };
};