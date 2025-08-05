/**
 * 簡化日誌服務
 * 只保留遠端日誌發送功能，總是發送到後端
 * 移除本地存儲、控制台輸出和環境變數控制
 */

import { sendFrontendLogs, type RemoteLogRequest } from '@/api/services';

// 日誌級別定義 - 使用 const assertion 避免 TypeScript 編譯問題
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

// 日誌分類定義 - 使用 const assertion 避免 TypeScript 編譯問題
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
  | Record<string, unknown>  // 物件類型資料
  | string                   // 字串類型資料
  | number                   // 數字類型資料
  | boolean                  // 布林類型資料
  | null                     // 空值
  | undefined;               // 未定義

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

/**
 * 簡化日誌服務類別
 * 單例模式，全域唯一實例，只負責發送日誌到後端
 */
class SimpleLoggerService {
  private logBuffer: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private static instance: SimpleLoggerService;

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
   * 獲取日誌服務單例實例
   */
  public static getInstance(): SimpleLoggerService {
    if (!SimpleLoggerService.instance) {
      SimpleLoggerService.instance = new SimpleLoggerService();
    }
    return SimpleLoggerService.instance;
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
   * 發送日誌到後端
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    const request: RemoteLogRequest = {
      logs: logsToSend,
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
      },
    };

    try {
      await sendFrontendLogs(request);
    } catch (error) {
      // 發送失敗時靜默處理，不影響主要功能
      // 只在開發環境顯示警告
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to send logs to backend:', error);
      }
    }
  }

  /**
   * 記錄錯誤日誌
   */
  public logError(message: string, data?: LogData, error?: Error): void {
    this.log(LogLevel.ERROR, LogCategory.ERROR, message, data, error);
  }

  /**
   * 記錄 API 相關日誌
   */
  public logApi(message: string, data?: LogData): void {
    this.log(LogLevel.INFO, LogCategory.API, message, data);
  }

  /**
   * 記錄使用者操作日誌
   */
  public logUser(message: string, data?: LogData): void {
    this.log(LogLevel.INFO, LogCategory.USER, message, data);
  }

  /**
   * 記錄系統事件日誌
   */
  public logSystem(message: string, data?: LogData): void {
    this.log(LogLevel.INFO, LogCategory.SYSTEM, message, data);
  }

  /**
   * 記錄效能相關日誌
   */
  public logPerformance(message: string, data?: LogData): void {
    this.log(LogLevel.INFO, LogCategory.PERFORMANCE, message, data);
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
}

// 匯出單例實例
export const simpleLogger = SimpleLoggerService.getInstance();

// 匯出便利函數
export const logError = (message: string, data?: LogData, error?: Error): void => {
  simpleLogger.logError(message, data, error);
};

export const logApi = (message: string, data?: LogData): void => {
  simpleLogger.logApi(message, data);
};

export const logUser = (message: string, data?: LogData): void => {
  simpleLogger.logUser(message, data);
};

export const logSystem = (message: string, data?: LogData): void => {
  simpleLogger.logSystem(message, data);
};

export const logPerformance = (message: string, data?: LogData): void => {
  simpleLogger.logPerformance(message, data);
};

// 匯出為預設
export default simpleLogger;