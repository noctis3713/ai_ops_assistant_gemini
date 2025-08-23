/**
 * 錯誤處理統一型別定義
 * 提供錯誤相關的型別接口和常數
 */

import type { ReactNode } from 'react';

// 錯誤類型分類
export const ErrorCategory = {
  NETWORK: 'network',
  API: 'api',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  PERMISSION: 'permission',
  TIMEOUT: 'timeout',
  REACT: 'react',
  UNKNOWN: 'unknown'
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

// 錯誤嚴重程度
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

// 日誌級別定義
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

// 日誌分類定義
export const LogCategory = {
  API: 'api',
  ERROR: 'error',
  USER: 'user',
  SYSTEM: 'system',
  PERFORMANCE: 'performance',
} as const;

export type LogCategory = typeof LogCategory[keyof typeof LogCategory];

// 日誌資料類型定義
export type LogData = 
  | Record<string, unknown>
  | string
  | number
  | boolean
  | null
  | undefined;

// 統一錯誤介面
export interface UnifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  originalError?: Error;
  context?: string;
  timestamp: string;
  retryable: boolean;
}

// 日誌條目介面
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: LogData;
  stack?: string;
  sessionId?: string;
}

// React 錯誤邊界相關型別
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

// 錯誤通知介面
export interface ErrorNotificationProps {
  error: UnifiedError;
  visible: boolean;
  onClose: () => void;
  autoCloseDelay?: number;
}

// 錯誤上下文介面
export interface ErrorContextValue {
  reportError: (error: unknown, context?: string) => Promise<UnifiedError>;
  clearErrors: () => void;
  errors: UnifiedError[];
}

// 錯誤處理 Hook 配置
export interface UseErrorHandlerConfig {
  showNotification?: boolean;
  logToConsole?: boolean;
  reportToServer?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
}