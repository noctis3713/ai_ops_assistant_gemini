/**
 * 任務服務相關類型定義
 */

import type { 
  TaskResponse, 
  TaskCreationResponse, 
  TaskStatus,
  TaskType
} from '@/types';

/**
 * 任務輪詢選項
 */
export interface TaskPollingOptions {
  pollInterval?: number;
  maxPollInterval?: number;
  timeout?: number;
  onProgress?: (task: TaskResponse) => void;
  onComplete?: (task: TaskResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * 任務建立選項
 */
export interface TaskCreationOptions {
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  description?: string;
}

/**
 * 任務查詢篩選器
 */
export interface TaskQueryFilters {
  status?: TaskStatus;
  taskType?: TaskType;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * 任務輪詢狀態
 */
export interface TaskPollingState {
  isPolling: boolean;
  taskId: string;
  startTime: number;
  pollCount: number;
  currentInterval: number;
  lastResponse?: TaskResponse;
}

/**
 * 任務統計資訊
 */
export interface TaskStatistics {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByType: Record<TaskType, number>;
  averageExecutionTime: number;
  successRate: number;
  currentActiveTasks: number;
}

/**
 * 任務生命週期事件
 */
export interface TaskLifecycleEvents {
  onCreated?: (task: TaskCreationResponse) => void;
  onStarted?: (task: TaskResponse) => void;
  onProgress?: (task: TaskResponse) => void;
  onCompleted?: (task: TaskResponse) => void;
  onFailed?: (task: TaskResponse) => void;
  onCancelled?: (task: TaskResponse) => void;
}

/**
 * 任務重試配置
 */
export interface TaskRetryConfig {
  enabled: boolean;
  maxAttempts: number;
  backoffMultiplier: number;
  baseDelay: number;
  maxDelay: number;
}