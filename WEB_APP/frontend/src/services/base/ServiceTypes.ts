/**
 * 服務層統一類型定義
 * 為整個服務層提供基礎類型和介面
 */

import type { AxiosInstance, AxiosResponse } from 'axios';
import type { QueryClient } from '@tanstack/react-query';

/**
 * 服務層回應基礎介面
 */
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
  code?: string;
}

/**
 * 服務層請求配置介面
 */
export interface ServiceRequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

/**
 * 服務層錯誤上下文
 */
export interface ServiceErrorContext {
  operation: string;
  service: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * 服務層錯誤級別
 */
export enum ServiceErrorLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 服務層錯誤類別
 */
export enum ServiceErrorCategory {
  NETWORK = 'network',
  API = 'api',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * 基礎服務依賴介面
 */
export interface ServiceDependencies {
  apiClient: AxiosInstance;
  queryClient: QueryClient;
}

/**
 * 資料轉換器介面
 */
export interface DataTransformer<TInput, TOutput> {
  transform(input: TInput): TOutput;
  transformList(input: TInput[]): TOutput[];
  reverse?(output: TOutput): TInput;
}

/**
 * 服務層快取選項
 */
export interface ServiceCacheOptions {
  enabled: boolean;
  staleTime?: number;
  gcTime?: number;
  key: string[];
}

/**
 * API 回應轉換器類型
 */
export type ApiResponseTransformer<T> = (response: AxiosResponse) => T;