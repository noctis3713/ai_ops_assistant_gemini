/**
 * 任務輪詢器
 * 基於原有 TaskPoller 重構為服務層元件
 */

import { ServiceError } from '../base/ServiceError';
import { ServiceErrorCategory, ServiceErrorLevel } from '../base/ServiceTypes';
// import { PROGRESS_STAGE, type ProgressStage } from '@/config';
import type { 
  TaskResponse, 
  TaskCreationResponse,
  BatchExecuteRequest,
  BatchExecutionResponse 
} from '@/types';
import type { 
  TaskPollingOptions,
  TaskPollingState,
  TaskLifecycleEvents 
} from './TaskTypes';

/**
 * 輪詢元數據
 */
export interface PollMeta {
  pollCount: number;
  duration: number;
  currentInterval: number;
  startTime: number;
}

/**
 * 任務輪詢器依賴注入介面
 */
export interface TaskPollerDependencies {
  getTaskStatus: (taskId: string) => Promise<TaskResponse>;
  createTask: (request: unknown) => Promise<TaskCreationResponse>;
}

/**
 * 任務輪詢器類別
 */
export class TaskPoller {
  private dependencies: TaskPollerDependencies;
  private abortController: AbortController;
  private pollingStates: Map<string, TaskPollingState> = new Map();
  private lifecycleEvents: TaskLifecycleEvents;

  constructor(
    dependencies: TaskPollerDependencies,
    events: TaskLifecycleEvents = {}
  ) {
    this.dependencies = dependencies;
    this.lifecycleEvents = events;
    this.abortController = new AbortController();
  }

  /**
   * 建立任務並開始輪詢
   */
  async createAndPoll(
    request: BatchExecuteRequest,
    options: TaskPollingOptions = {}
  ): Promise<BatchExecutionResponse> {
    try {
      // 建立任務
      const taskCreationResponse = await this.dependencies.createTask(request);
      const taskId = taskCreationResponse.task_id;

      // 觸發建立事件
      this.lifecycleEvents.onCreated?.(taskCreationResponse);

      // 開始輪詢
      return await this.pollTask(taskId, options);
    } catch (error) {
      throw this.createServiceError(
        error,
        'createAndPoll',
        { request, options }
      );
    }
  }

  /**
   * 輪詢現有任務
   */
  async pollTask(
    taskId: string,
    options: TaskPollingOptions = {}
  ): Promise<BatchExecutionResponse> {
    // 驗證任務 ID
    this.validateTaskId(taskId);

    const {
      pollInterval = 2000,
      maxPollInterval = 10000,
      timeout = 30 * 60 * 1000, // 30分鐘
      onProgress,
      onComplete,
      onError
    } = options;

    const startTime = Date.now();
    let currentInterval = pollInterval;
    let pollCount = 0;

    // 建立輪詢狀態
    const pollingState: TaskPollingState = {
      isPolling: true,
      taskId,
      startTime,
      pollCount: 0,
      currentInterval
    };
    this.pollingStates.set(taskId, pollingState);

    try {
      while (pollingState.isPolling) {
        // 檢查是否被取消
        if (this.abortController.signal.aborted) {
          throw new Error('任務輪詢已被取消');
        }

        // 檢查超時
        if (Date.now() - startTime > timeout) {
          throw new Error(`任務輪詢超時 (${timeout}ms)`);
        }

        try {
          // 獲取任務狀態
          const task = await this.dependencies.getTaskStatus(taskId);
          pollingState.lastResponse = task;
          pollingState.pollCount = ++pollCount;

          // 建立輪詢元數據（預留供將來使用）
          // const meta: PollMeta = {
          //   pollCount,
          //   duration: Date.now() - startTime,
          //   currentInterval,
          //   startTime
          // };

          // 觸發進度事件
          onProgress?.(task);
          this.lifecycleEvents.onProgress?.(task);

          // 檢查任務狀態
          if (this.isTaskCompleted(task)) {
            pollingState.isPolling = false;

            // 觸發完成事件
            onComplete?.(task);
            this.triggerLifecycleEvent(task);

            // 解析任務結果
            return this.parseTaskResult(task);
          }

          // 觸發開始事件（首次輪詢且任務執行中）
          if (pollCount === 1 && this.isTaskRunning(task)) {
            this.lifecycleEvents.onStarted?.(task);
          }

          // 計算下次輪詢間隔（指數退避）
          currentInterval = Math.min(
            currentInterval * 1.2,
            maxPollInterval
          );

          // 等待下次輪詢
          await this.delay(currentInterval);

        } catch (pollError) {
          // 輪詢錯誤，但繼續嘗試
          const error = this.createServiceError(
            pollError,
            'pollTask.iteration',
            { taskId, pollCount }
          );

          onError?.(error);
          this.lifecycleEvents.onFailed?.({} as TaskResponse); // 簡化錯誤處理

          // 短暫等待後重試
          await this.delay(1000);
        }
      }

      throw new Error('任務輪詢意外結束');

    } catch (error) {
      pollingState.isPolling = false;
      throw this.createServiceError(
        error,
        'pollTask',
        { taskId, pollCount, duration: Date.now() - startTime }
      );
    } finally {
      // 清理輪詢狀態
      this.pollingStates.delete(taskId);
    }
  }

  /**
   * 停止特定任務的輪詢
   */
  stopPolling(taskId: string): void {
    const pollingState = this.pollingStates.get(taskId);
    if (pollingState) {
      pollingState.isPolling = false;
      this.pollingStates.delete(taskId);
    }
  }

  /**
   * 停止所有輪詢
   */
  stopAllPolling(): void {
    this.abortController.abort();
    this.pollingStates.clear();
  }

  /**
   * 獲取輪詢狀態
   */
  getPollingState(taskId: string): TaskPollingState | undefined {
    return this.pollingStates.get(taskId);
  }

  /**
   * 獲取所有活躍的輪詢
   */
  getActivePollings(): TaskPollingState[] {
    return Array.from(this.pollingStates.values()).filter(
      state => state.isPolling
    );
  }

  /**
   * 驗證任務 ID
   */
  private validateTaskId(taskId: string): void {
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      throw new ServiceError(
        `無效的任務 ID: '${taskId}'`,
        ServiceErrorCategory.VALIDATION,
        ServiceErrorLevel.MEDIUM,
        {
          operation: 'validateTaskId',
          service: 'TaskPoller',
          input: { taskId }
        }
      );
    }

    if (taskId === 'undefined' || taskId === 'null') {
      throw new ServiceError(
        `不可接受的任務 ID 值: '${taskId}'`,
        ServiceErrorCategory.VALIDATION,
        ServiceErrorLevel.MEDIUM,
        {
          operation: 'validateTaskId',
          service: 'TaskPoller',
          input: { taskId }
        }
      );
    }
  }

  /**
   * 檢查任務是否已完成
   */
  private isTaskCompleted(task: TaskResponse): boolean {
    return ['completed', 'failed', 'cancelled'].includes(task.status);
  }

  /**
   * 檢查任務是否正在執行
   */
  private isTaskRunning(task: TaskResponse): boolean {
    return task.status === 'running';
  }

  /**
   * 觸發生命週期事件
   */
  private triggerLifecycleEvent(task: TaskResponse): void {
    switch (task.status) {
      case 'completed':
        this.lifecycleEvents.onCompleted?.(task);
        break;
      case 'failed':
        this.lifecycleEvents.onFailed?.(task);
        break;
      case 'cancelled':
        this.lifecycleEvents.onCancelled?.(task);
        break;
    }
  }

  /**
   * 解析任務結果
   */
  private parseTaskResult(task: TaskResponse): BatchExecutionResponse {
    if (!task.result) {
      throw new ServiceError(
        '任務完成但無結果資料',
        ServiceErrorCategory.API,
        ServiceErrorLevel.MEDIUM,
        {
          operation: 'parseTaskResult',
          service: 'TaskPoller',
          input: { taskId: task.task_id, status: task.status }
        }
      );
    }

    try {
      // 如果結果已經是物件，直接返回
      if (typeof task.result === 'object') {
        return task.result as BatchExecutionResponse;
      }

      // 嘗試解析 JSON 字串
      if (typeof task.result === 'string') {
        return JSON.parse(task.result) as BatchExecutionResponse;
      }

      throw new Error('無法解析任務結果格式');
    } catch (error) {
      throw this.createServiceError(
        error,
        'parseTaskResult',
        { taskId: task.task_id, result: task.result }
      );
    }
  }

  /**
   * 延遲工具方法
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * 建立服務錯誤
   */
  private createServiceError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): ServiceError {
    return ServiceError.from(error, {
      operation,
      service: 'TaskPoller',
      input: context
    });
  }

  /**
   * 銷毀輪詢器
   */
  dispose(): void {
    this.stopAllPolling();
    this.pollingStates.clear();
  }
}

/**
 * 建立任務輪詢器的工廠函數
 */
export function createTaskPoller(
  dependencies: TaskPollerDependencies,
  events?: TaskLifecycleEvents
): TaskPoller {
  return new TaskPoller(dependencies, events);
}