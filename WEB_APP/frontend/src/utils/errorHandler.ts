/**
 * 統一錯誤處理工具
 * 提供一致的錯誤處理和用戶友善的錯誤訊息
 */
import { logError } from './SimpleLogger';

// 錯誤類型分類
export const ErrorCategory = {
  NETWORK: 'network',
  API: 'api',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  PERMISSION: 'permission',
  TIMEOUT: 'timeout',
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

/**
 * 錯誤分類器 - 根據錯誤內容自動分類
 */
export class ErrorClassifier {
  /**
   * 分析錯誤並返回統一格式
   */
  static classify(error: unknown, context?: string): UnifiedError {
    const timestamp = new Date().toISOString();
    let originalError: Error | undefined;
    let message: string;

    // 處理不同類型的錯誤
    if (error instanceof Error) {
      originalError = error;
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = '未知錯誤';
    }

    // 根據錯誤訊息內容進行分類
    const category = this.categorizeError(message);
    const severity = this.determineSeverity(category, message);
    const userMessage = this.generateUserMessage(category, message);
    const retryable = this.isRetryable(category, message);

    return {
      category,
      severity,
      message,
      userMessage,
      originalError,
      context,
      timestamp,
      retryable
    };
  }

  /**
   * 錯誤分類邏輯
   */
  private static categorizeError(message: string): ErrorCategory {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('網路')) {
      return ErrorCategory.NETWORK;
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('超時')) {
      return ErrorCategory.TIMEOUT;
    }
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') || lowerMessage.includes('認證')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (lowerMessage.includes('403') || lowerMessage.includes('forbidden') || lowerMessage.includes('權限')) {
      return ErrorCategory.PERMISSION;
    }
    if (lowerMessage.includes('400') || lowerMessage.includes('validation') || lowerMessage.includes('驗證')) {
      return ErrorCategory.VALIDATION;
    }
    if (lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('504')) {
      return ErrorCategory.API;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * 決定錯誤嚴重程度
   */
  private static determineSeverity(category: ErrorCategory, message: string): ErrorSeverity {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.PERMISSION:
        return ErrorSeverity.HIGH;
      case ErrorCategory.API:
        return message.includes('500') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return ErrorSeverity.MEDIUM;
      case ErrorCategory.VALIDATION:
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * 生成用戶友善的錯誤訊息
   */
  private static generateUserMessage(category: ErrorCategory, originalMessage: string): string {
    switch (category) {
      case ErrorCategory.NETWORK:
        return '網路連線異常，請檢查網路狀態後再試';
      case ErrorCategory.TIMEOUT:
        return '操作超時，請稍後再試';
      case ErrorCategory.AUTHENTICATION:
        return '認證失敗，請檢查憑證設定';
      case ErrorCategory.PERMISSION:
        return '權限不足，無法執行此操作';
      case ErrorCategory.VALIDATION:
        return '輸入資料格式錯誤，請檢查並重新輸入';
      case ErrorCategory.API:
        if (originalMessage.includes('429')) {
          return 'API 呼叫頻率過高，請稍後再試';
        }
        if (originalMessage.includes('500')) {
          return '伺服器內部錯誤，請聯繫管理員';
        }
        return '服務暫時不可用，請稍後再試';
      default:
        return '發生未預期的錯誤，請稍後再試';
    }
  }

  /**
   * 判斷錯誤是否可重試
   */
  private static isRetryable(category: ErrorCategory, message: string): boolean {
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return true;
      case ErrorCategory.API:
        return !message.includes('400') && !message.includes('401') && !message.includes('403');
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.PERMISSION:
      case ErrorCategory.VALIDATION:
        return false;
      default:
        return false;
    }
  }
}

/**
 * 統一錯誤處理器
 */
export class ErrorHandler {
  /**
   * 處理錯誤並記錄日誌
   */
  static async handleError(
    error: unknown, 
    context?: string,
    _onRetry?: () => Promise<void> | void
  ): Promise<UnifiedError> {
    const unifiedError = ErrorClassifier.classify(error, context);

    // 記錄錯誤到日誌系統
    logError(`錯誤處理: ${context || '未知上下文'}`, {
      category: unifiedError.category,
      severity: unifiedError.severity,
      message: unifiedError.message,
      userMessage: unifiedError.userMessage,
      retryable: unifiedError.retryable,
      timestamp: unifiedError.timestamp,
      originalError: unifiedError.originalError?.stack,
    }, unifiedError.originalError);

    return unifiedError;
  }

  /**
   * 處理 API 錯誤的便利方法
   */
  static async handleApiError(
    error: unknown,
    apiContext: string,
    onRetry?: () => Promise<void>
  ): Promise<UnifiedError> {
    return this.handleError(error, `API: ${apiContext}`, onRetry);
  }

  /**
   * 處理表單驗證錯誤的便利方法
   */
  static async handleValidationError(
    error: unknown,
    fieldName: string
  ): Promise<UnifiedError> {
    return this.handleError(error, `表單驗證: ${fieldName}`);
  }
}

/**
 * 錯誤處理裝飾器工具
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const unifiedError = await ErrorHandler.handleError(error, context);
      throw unifiedError;
    }
  }) as T;
}

/**
 * 重試機制包裝器
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  context?: string
): Promise<T> {
  let lastError: UnifiedError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = await ErrorHandler.handleError(error, `${context} (嘗試 ${attempt}/${maxRetries})`);
      
      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError;
      }

      // 等待指定時間後重試
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError;
}