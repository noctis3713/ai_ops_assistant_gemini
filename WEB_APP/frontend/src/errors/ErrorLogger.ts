/**
 * 統一錯誤日誌記錄器
 * 整合 SimpleLogger 的錯誤記錄功能，提供統一的錯誤日誌服務
 */

import type { LogLevel, LogCategory, LogData, LogEntry, UnifiedError } from './types';

/**
 * 統一錯誤日誌服務
 * 繼承並擴展原有 SimpleLogger 功能，專注於錯誤處理
 */
class ErrorLoggerService {
  private logBuffer: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private static instance: ErrorLoggerService;

  // 固定配置，無環境變數控制
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_INTERVAL = 30000; // 30秒

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initBatchTimer();
    
    // 監聽頁面卸載，發送剩餘日誌
    window.addEventListener('beforeunload', () => {
      this.flushLogs();
    });
  }

  /**
   * 獲取錯誤日誌服務單例實例
   */
  public static getInstance(): ErrorLoggerService {
    if (!ErrorLoggerService.instance) {
      ErrorLoggerService.instance = new ErrorLoggerService();
    }
    return ErrorLoggerService.instance;
  }

  /**
   * 生成會話 ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 初始化批次定時器
   */
  private initBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flushLogs();
      }
    }, this.BATCH_INTERVAL);
  }

  /**
   * 記錄日誌（私有方法）
   */
  private log(level: LogLevel, category: LogCategory, message: string, data?: LogData, error?: Error): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      sessionId: this.sessionId,
    };

    // 如果有錯誤物件，添加堆疊追蹤
    if (error && error.stack) {
      logEntry.stack = error.stack;
    }

    // 添加到緩衝區
    this.logBuffer.push(logEntry);

    // 如果緩衝區達到批次大小，立即發送
    if (this.logBuffer.length >= this.BATCH_SIZE) {
      this.flushLogs();
    }
  }

  /**
   * 發送日誌到後端（已禁用）
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    // 清空緩衝區但不發送到後端
    this.logBuffer = [];
    
    // 已禁用遠端日誌發送功能
    // 日誌僅保留在前端本地，不再發送到後端
  }

  /**
   * 記錄統一錯誤物件
   */
  public logUnifiedError(unifiedError: UnifiedError, additionalData?: LogData): void {
    const errorData = {
      category: unifiedError.category,
      severity: unifiedError.severity,
      userMessage: unifiedError.userMessage,
      retryable: unifiedError.retryable,
      context: unifiedError.context,
      timestamp: unifiedError.timestamp,
      ...additionalData,
    };

    this.log(
      3, // LogLevel.ERROR 的數值
      'error' as LogCategory, 
      unifiedError.message, 
      errorData, 
      unifiedError.originalError
    );
  }

  /**
   * 記錄 React 錯誤邊界錯誤
   */
  public logReactError(error: Error, errorInfo: React.ErrorInfo, additionalData?: LogData): void {
    const errorData = {
      componentStack: errorInfo.componentStack,
      isDevelopment: process.env.NODE_ENV === 'development',
      ...additionalData,
    };

    this.log(
      3, // LogLevel.ERROR
      'error' as LogCategory,
      `React Error Boundary: ${error.message}`,
      errorData,
      error
    );
  }

  /**
   * 記錄錯誤日誌（保持向後相容）
   */
  public logError(message: string, data?: LogData, error?: Error): void {
    this.log(3, 'error' as LogCategory, message, data, error);
  }

  /**
   * 記錄 API 相關資訊（正常呼叫）
   */
  public logApiInfo(message: string, data?: LogData): void {
    this.log(1, 'api' as LogCategory, message, data);
  }

  /**
   * 記錄 API 相關錯誤
   */
  public logApiError(message: string, data?: LogData, error?: Error): void {
    this.log(3, 'api' as LogCategory, message, data, error);
  }

  /**
   * 記錄使用者操作錯誤
   */
  public logUserError(message: string, data?: LogData, error?: Error): void {
    this.log(3, 'user' as LogCategory, message, data, error);
  }

  /**
   * 記錄系統資訊（正常事件）
   */
  public logSystemInfo(message: string, data?: LogData): void {
    this.log(1, 'system' as LogCategory, message, data);
  }

  /**
   * 記錄系統錯誤
   */
  public logSystemError(message: string, data?: LogData, error?: Error): void {
    this.log(3, 'system' as LogCategory, message, data, error);
  }

  /**
   * 記錄效能相關錯誤
   */
  public logPerformanceError(message: string, data?: LogData, error?: Error): void {
    this.log(3, 'performance' as LogCategory, message, data, error);
  }

  /**
   * 手動刷新日誌（公共方法）
   */
  public async flush(): Promise<void> {
    await this.flushLogs();
  }

  /**
   * 清理資源
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushLogs();
  }

  /**
   * 獲取會話 ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 獲取當前緩衝區狀態
   */
  public getBufferStatus(): { count: number; maxSize: number } {
    return {
      count: this.logBuffer.length,
      maxSize: this.BATCH_SIZE,
    };
  }
}

// 匯出單例實例
export const errorLogger = ErrorLoggerService.getInstance();

// 匯出便利函數（保持向後相容）
export const logError = (message: string, data?: LogData, error?: Error): void => {
  errorLogger.logError(message, data, error);
};

export const logApiInfo = (message: string, data?: LogData): void => {
  errorLogger.logApiInfo(message, data);
};

export const logApiError = (message: string, data?: LogData, error?: Error): void => {
  errorLogger.logApiError(message, data, error);
};

export const logSystemInfo = (message: string, data?: LogData): void => {
  errorLogger.logSystemInfo(message, data);
};

export const logUserError = (message: string, data?: LogData, error?: Error): void => {
  errorLogger.logUserError(message, data, error);
};

export const logSystemError = (message: string, data?: LogData, error?: Error): void => {
  errorLogger.logSystemError(message, data, error);
};

export const logPerformanceError = (message: string, data?: LogData, error?: Error): void => {
  errorLogger.logPerformanceError(message, data, error);
};

// 匯出為預設
export default errorLogger;