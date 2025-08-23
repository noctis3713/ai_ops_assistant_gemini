/**
 * 執行服務相關類型定義
 */

import type { BatchExecuteRequest, BatchExecutionResponse } from '@/types';

/**
 * 執行模式
 */
export type ExecutionMode = 'command' | 'ai';

/**
 * 執行結果狀態
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 單一執行請求
 */
export interface SingleExecutionRequest {
  deviceIp: string;
  command: string;
  mode: ExecutionMode;
  timeout?: number;
}

/**
 * 單一執行回應
 */
export interface SingleExecutionResponse {
  deviceIp: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  timestamp: string;
}

/**
 * 執行選項
 */
export interface ExecutionOptions {
  timeout?: number;
  retries?: number;
  continueOnError?: boolean;
  idempotencyKey?: string;
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * 批次執行進度資訊
 */
export interface ExecutionProgress {
  completed: number;
  total: number;
  percentage: number;
  currentDevice?: string;
  currentStage: string;
  startTime: string;
  estimatedTimeRemaining?: number;
}

/**
 * 執行歷史記錄
 */
export interface ExecutionHistory {
  id: string;
  request: BatchExecuteRequest;
  response?: BatchExecutionResponse;
  status: ExecutionStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  progress?: ExecutionProgress;
  error?: string;
}

/**
 * 執行統計資訊
 */
export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  executionsByMode: Record<ExecutionMode, number>;
  executionsByStatus: Record<ExecutionStatus, number>;
  deviceExecutionCount: Record<string, number>;
}

/**
 * 執行過濾器
 */
export interface ExecutionFilters {
  mode?: ExecutionMode;
  status?: ExecutionStatus;
  deviceIp?: string;
  startDate?: string;
  endDate?: string;
  command?: string;
}

/**
 * AI 查詢選項
 */
export interface AIQueryOptions extends ExecutionOptions {
  provider?: 'gemini' | 'claude';
  temperature?: number;
  maxTokens?: number;
}