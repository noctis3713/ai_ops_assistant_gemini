/**
 * 前端統一日誌管理服務
 * 支援多輸出模式、日誌分級、分類過濾和環境差異化配置
 */

// 日誌級別定義
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 日誌分類定義
export enum LogCategory {
  API = 'api',
  AUTH = 'auth',
  ERROR = 'error',
  USER = 'user',
  PERFORMANCE = 'performance',
  DEBUG = 'debug',
  COMPONENT = 'component',
  STORAGE = 'storage',
  NETWORK = 'network',
}

// 日誌條目介面
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  stack?: string;
  userId?: string;
  sessionId?: string;
}

// 日誌配置介面
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  enableLocalStorage: boolean;
  maxLocalStorageEntries: number;
  remoteEndpoint: string;
  categories: LogCategory[];
  showStackTrace: boolean;
  performanceThreshold: number;
  batchSize: number;
  batchInterval: number;
}

// 預設配置
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableRemote: false,
  enableLocalStorage: true,
  maxLocalStorageEntries: 100,
  remoteEndpoint: '/api/frontend-logs',
  categories: Object.values(LogCategory),
  showStackTrace: false,
  performanceThreshold: 100,
  batchSize: 10,
  batchInterval: 30000, // 30秒
};

/**
 * 統一日誌管理服務類別
 * 單例模式，全域唯一實例
 */
class LoggerService {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private static instance: LoggerService;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.config = this.loadConfig();
    this.initBatchTimer();
    
    // 監聽頁面卸載，發送剩餘日誌
    window.addEventListener('beforeunload', () => {
      this.flushLogs();
    });
  }

  /**
   * 獲取日誌服務單例實例
   */
  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * 從環境變數載入配置
   */
  private loadConfig(): LoggerConfig {
    const env = import.meta.env;
    
    // 解析日誌級別
    const levelMap: Record<string, LogLevel> = {
      'DEBUG': LogLevel.DEBUG,
      'INFO': LogLevel.INFO,
      'WARN': LogLevel.WARN,
      'ERROR': LogLevel.ERROR,
    };
    
    // 解析啟用的分類
    const categoriesStr = env.VITE_LOG_CATEGORIES || '';
    const enabledCategories = categoriesStr
      ? categoriesStr.split(',').map(c => c.trim() as LogCategory)
      : Object.values(LogCategory);

    return {
      level: levelMap[env.VITE_LOG_LEVEL] ?? DEFAULT_CONFIG.level,
      enableConsole: env.VITE_ENABLE_CONSOLE_LOG === 'true',
      enableRemote: env.VITE_ENABLE_REMOTE_LOG === 'true',
      enableLocalStorage: env.VITE_ENABLE_LOCAL_STORAGE_LOG === 'true',
      maxLocalStorageEntries: parseInt(env.VITE_MAX_LOCAL_STORAGE_ENTRIES) || DEFAULT_CONFIG.maxLocalStorageEntries,
      remoteEndpoint: env.VITE_REMOTE_LOG_ENDPOINT || DEFAULT_CONFIG.remoteEndpoint,
      categories: enabledCategories,
      showStackTrace: env.VITE_LOG_SHOW_STACK_TRACE === 'true',
      performanceThreshold: parseInt(env.VITE_LOG_PERFORMANCE_THRESHOLD) || DEFAULT_CONFIG.performanceThreshold,
      batchSize: parseInt(env.VITE_LOG_BATCH_SIZE) || DEFAULT_CONFIG.batchSize,
      batchInterval: parseInt(env.VITE_LOG_BATCH_INTERVAL) || DEFAULT_CONFIG.batchInterval,
    };
  }

  /**
   * 生成會話 ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 初始化批次發送定時器
   */
  private initBatchTimer(): void {
    if (this.config.enableRemote && this.config.batchInterval > 0) {
      this.batchTimer = setInterval(() => {
        this.flushLogs();
      }, this.config.batchInterval);
    }
  }

  /**
   * 檢查日誌是否應該被記錄
   */
  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    // 檢查日誌級別
    if (level < this.config.level) {
      return false;
    }
    
    // 檢查日誌分類
    if (!this.config.categories.includes(category)) {
      return false;
    }
    
    return true;
  }

  /**
   * 建立日誌條目
   */
  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      sessionId: this.sessionId,
    };

    // 添加資料
    if (data !== undefined) {
      entry.data = this.sanitizeData(data);
    }

    // 添加錯誤堆疊
    if (error && this.config.showStackTrace) {
      entry.stack = error.stack;
    } else if (error) {
      entry.message = `${message}: ${error.message}`;
    }

    return entry;
  }

  /**
   * 敏感資訊過濾
   */
  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'credential'];
    const sanitized = { ...data };

    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 輸出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const levelMethods: Record<LogLevel, keyof Console> = {
      [LogLevel.DEBUG]: 'debug',
      [LogLevel.INFO]: 'info',
      [LogLevel.WARN]: 'warn',
      [LogLevel.ERROR]: 'error',
    };

    const method = levelMethods[entry.level];
    const prefix = `[${entry.timestamp}] [${LogLevel[entry.level]}] [${entry.category}]`;
    
    if (entry.data) {
      console[method](prefix, entry.message, entry.data);
    } else {
      console[method](prefix, entry.message);
    }

    if (entry.stack) {
      console[method](entry.stack);
    }
  }

  /**
   * 儲存到本地存儲
   */
  private saveToLocalStorage(entry: LogEntry): void {
    if (!this.config.enableLocalStorage) return;

    try {
      const key = 'frontend_logs';
      const existingLogs = JSON.parse(localStorage.getItem(key) || '[]') as LogEntry[];
      
      // 添加新日誌
      existingLogs.push(entry);
      
      // LRU 清理：保持數量限制
      if (existingLogs.length > this.config.maxLocalStorageEntries) {
        existingLogs.splice(0, existingLogs.length - this.config.maxLocalStorageEntries);
      }
      
      localStorage.setItem(key, JSON.stringify(existingLogs));
    } catch (error) {
      // 本地存儲失敗不應該影響主要功能
      console.warn('Failed to save log to localStorage:', error);
    }
  }

  /**
   * 添加到遠端日誌緩衝區
   */
  private addToBuffer(entry: LogEntry): void {
    if (!this.config.enableRemote) return;

    this.logBuffer.push(entry);

    // 如果緩衝區達到批次大小，立即發送
    if (this.logBuffer.length >= this.config.batchSize) {
      this.flushLogs();
    }
  }

  /**
   * 發送緩衝區中的日誌到遠端
   */
  private async flushLogs(): Promise<void> {
    if (!this.config.enableRemote || this.logBuffer.length === 0) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // 動態導入 API 服務，避免循環依賴
      const { sendFrontendLogs } = await import('@/api/services');
      
      const response = await sendFrontendLogs({
        logs: logsToSend,
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId,
        },
      });

      if (!response.success) {
        throw new Error(response.message);
      }
    } catch (error) {
      // 發送失敗時，將日誌重新加入緩衝區（避免無限重試）
      console.warn('Failed to send logs to remote endpoint:', error);
      
      // 只重試一次，避免無限循環
      if (logsToSend.length < this.config.batchSize * 2) {
        this.logBuffer.unshift(...logsToSend);
      }
    }
  }

  /**
   * 記錄 DEBUG 級別日誌
   */
  public debug(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * 記錄 INFO 級別日誌
   */
  public info(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * 記錄 WARN 級別日誌
   */
  public warn(category: LogCategory, message: string, data?: any, error?: Error): void {
    this.log(LogLevel.WARN, category, message, data, error);
  }

  /**
   * 記錄 ERROR 級別日誌
   */
  public error(category: LogCategory, message: string, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, category, message, data, error);
  }

  /**
   * 記錄效能指標
   */
  public performance(operation: string, duration: number, data?: any): void {
    if (duration >= this.config.performanceThreshold) {
      this.warn(
        LogCategory.PERFORMANCE,
        `${operation} took ${duration}ms (threshold: ${this.config.performanceThreshold}ms)`,
        { operation, duration, ...data }
      );
    } else {
      this.debug(
        LogCategory.PERFORMANCE,
        `${operation} completed in ${duration}ms`,
        { operation, duration, ...data }
      );
    }
  }

  /**
   * 核心日誌記錄方法
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    error?: Error
  ): void {
    // 檢查是否應該記錄
    if (!this.shouldLog(level, category)) {
      return;
    }

    // 建立日誌條目
    const entry = this.createLogEntry(level, category, message, data, error);

    // 輸出到各個目標
    this.outputToConsole(entry);
    this.saveToLocalStorage(entry);
    this.addToBuffer(entry);
  }

  /**
   * 獲取本地存儲的日誌
   */
  public getLocalLogs(): LogEntry[] {
    try {
      const logs = localStorage.getItem('frontend_logs');
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.warn('Failed to retrieve logs from localStorage:', error);
      return [];
    }
  }

  /**
   * 清除本地存儲的日誌
   */
  public clearLocalLogs(): void {
    try {
      localStorage.removeItem('frontend_logs');
    } catch (error) {
      console.warn('Failed to clear logs from localStorage:', error);
    }
  }

  /**
   * 獲取日誌統計資訊
   */
  public getLogStats(): {
    localCount: number;
    bufferCount: number;
    sessionId: string;
    config: LoggerConfig;
  } {
    return {
      localCount: this.getLocalLogs().length,
      bufferCount: this.logBuffer.length,
      sessionId: this.sessionId,
      config: { ...this.config },
    };
  }

  /**
   * 手動刷新遠端日誌
   */
  public async flush(): Promise<void> {
    await this.flushLogs();
  }

  /**
   * 銷毀日誌服務（清理定時器）
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushLogs(); // 發送剩餘日誌
  }
}

// 導出單例實例
export const logger = LoggerService.getInstance();

// 導出便利函數
export const logDebug = (category: LogCategory, message: string, data?: any) => 
  logger.debug(category, message, data);

export const logInfo = (category: LogCategory, message: string, data?: any) => 
  logger.info(category, message, data);

export const logWarn = (category: LogCategory, message: string, data?: any, error?: Error) => 
  logger.warn(category, message, data, error);

export const logError = (category: LogCategory, message: string, data?: any, error?: Error) => 
  logger.error(category, message, data, error);

export const logPerformance = (operation: string, duration: number, data?: any) => 
  logger.performance(operation, duration, data);