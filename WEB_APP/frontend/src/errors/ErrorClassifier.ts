/**
 * 錯誤分類器
 * 智能分析和分類各種錯誤類型，提供統一的錯誤處理邏輯
 */

import { 
  ErrorCategory, 
  ErrorSeverity, 
  type UnifiedError 
} from './types';

/**
 * 錯誤分類器類別
 * 負責將各種錯誤分類並轉換為統一格式
 */
export class ErrorClassifier {
  /**
   * 分類錯誤並轉換為統一格式
   */
  static classify(error: unknown, context?: string): UnifiedError {
    const timestamp = new Date().toISOString();

    // 處理 Error 物件
    if (error instanceof Error) {
      return this.classifyError(error, context, timestamp);
    }

    // 處理 HTTP 響應錯誤
    if (this.isHttpError(error)) {
      return this.classifyHttpError(error, context, timestamp);
    }

    // 處理字串錯誤
    if (typeof error === 'string') {
      return this.classifyStringError(error, context, timestamp);
    }

    // 處理未知錯誤
    return this.classifyUnknownError(error, context, timestamp);
  }

  /**
   * 分類 Error 物件
   */
  private static classifyError(error: Error, context?: string, timestamp: string): UnifiedError {
    const message = error.message || '未知錯誤';

    // 網路相關錯誤
    if (this.isNetworkError(error)) {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage: '網路連線發生問題，請檢查網路狀態後重試',
        originalError: error,
        context,
        timestamp,
        retryable: true,
      };
    }

    // 認證錯誤
    if (this.isAuthenticationError(error)) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage: '認證失敗，請重新登入',
        originalError: error,
        context,
        timestamp,
        retryable: false,
      };
    }

    // 超時錯誤
    if (this.isTimeoutError(error)) {
      return {
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message,
        userMessage: '請求超時，請重試',
        originalError: error,
        context,
        timestamp,
        retryable: true,
      };
    }

    // 驗證錯誤
    if (this.isValidationError(error)) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        message,
        userMessage: '輸入資料有誤，請檢查後重試',
        originalError: error,
        context,
        timestamp,
        retryable: false,
      };
    }

    // React 錯誤
    if (context?.includes('React') || context?.includes('Component')) {
      return {
        category: ErrorCategory.REACT,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage: '頁面組件發生錯誤，請重新整理頁面',
        originalError: error,
        context,
        timestamp,
        retryable: true,
      };
    }

    // 一般錯誤
    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message,
      userMessage: '系統發生錯誤，請稍後重試',
      originalError: error,
      context,
      timestamp,
      retryable: false,
    };
  }

  /**
   * 分類 HTTP 錯誤
   */
  private static classifyHttpError(error: any, context?: string, timestamp: string): UnifiedError {
    const status = error.status || error.response?.status || 0;
    const message = error.message || error.response?.data?.message || `HTTP ${status} 錯誤`;

    // 401 認證錯誤
    if (status === 401) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage: '認證已過期，請重新登入',
        originalError: error,
        context,
        timestamp,
        retryable: false,
      };
    }

    // 403 權限錯誤
    if (status === 403) {
      return {
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage: '沒有權限執行此操作',
        originalError: error,
        context,
        timestamp,
        retryable: false,
      };
    }

    // 400 系列客戶端錯誤
    if (status >= 400 && status < 500) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        message,
        userMessage: '請求格式有誤，請檢查後重試',
        originalError: error,
        context,
        timestamp,
        retryable: false,
      };
    }

    // 500 系列伺服器錯誤
    if (status >= 500) {
      return {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        message,
        userMessage: '伺服器發生錯誤，請稍後重試',
        originalError: error,
        context,
        timestamp,
        retryable: true,
      };
    }

    // 其他 HTTP 錯誤
    return {
      category: ErrorCategory.API,
      severity: ErrorSeverity.MEDIUM,
      message,
      userMessage: '網路請求發生錯誤，請重試',
      originalError: error,
      context,
      timestamp,
      retryable: true,
    };
  }

  /**
   * 分類字串錯誤
   */
  private static classifyStringError(error: string, context?: string, timestamp: string): UnifiedError {
    const message = error || '未知錯誤';

    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.LOW,
      message,
      userMessage: message,
      context,
      timestamp,
      retryable: false,
    };
  }

  /**
   * 分類未知錯誤
   */
  private static classifyUnknownError(error: unknown, context?: string, timestamp: string): UnifiedError {
    const message = `未知錯誤類型: ${typeof error}`;

    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message,
      userMessage: '系統發生未知錯誤，請聯繫技術支援',
      context,
      timestamp,
      retryable: false,
    };
  }

  /**
   * 檢查是否為網路錯誤
   */
  private static isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      name.includes('networkerror') ||
      message.includes('failed to fetch')
    );
  }

  /**
   * 檢查是否為認證錯誤
   */
  private static isAuthenticationError(error: Error): boolean {
    const message = error.message.toLowerCase();

    return (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('login') ||
      message.includes('token')
    );
  }

  /**
   * 檢查是否為超時錯誤
   */
  private static isTimeoutError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    return (
      message.includes('timeout') ||
      name.includes('timeouterror') ||
      message.includes('timed out')
    );
  }

  /**
   * 檢查是否為驗證錯誤
   */
  private static isValidationError(error: Error): boolean {
    const message = error.message.toLowerCase();

    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format')
    );
  }

  /**
   * 檢查是否為 HTTP 錯誤
   */
  private static isHttpError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      ('status' in error || ('response' in error && typeof (error as any).response === 'object'))
    );
  }
}

export default ErrorClassifier;