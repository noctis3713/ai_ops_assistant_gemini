/**
 * 前端日誌管理系統
 * 提供統一、可配置、環境感知的日誌管理功能
 * 支援開發環境的控制台輸出和生產環境的後端日誌整合
 */

// 日誌級別枚舉
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 日誌級別標識映射
const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '🔍 DEBUG',
  [LogLevel.INFO]: '🚀 INFO',
  [LogLevel.WARN]: '⚠️ WARN',
  [LogLevel.ERROR]: '❌ ERROR',
};

// 日誌級別顏色映射（用於控制台樣式）
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'color: #6c757d;',
  [LogLevel.INFO]: 'color: #0066cc;',
  [LogLevel.WARN]: 'color: #ffc107;',
  [LogLevel.ERROR]: 'color: #dc3545;',
};

// 日誌項目介面
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category?: string;
  message: string;
  data?: any;
  component?: string;
  userId?: string;
}

// 日誌配置介面
export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  enableLocalStorage: boolean;
  maxLocalStorageEntries: number;
  remoteEndpoint?: string;
  categories?: string[];
}

/**
 * 前端日誌服務類別
 * 提供統一的日誌管理功能，支援多種輸出目標
 */
export class LoggerService {
  private static instance: LoggerService;
  private config: LoggerConfig;
  private localStorageKey = 'app-frontend-logs';

  private constructor(config: Partial<LoggerConfig> = {}) {
    // 預設配置
    const defaultConfig: LoggerConfig = {
      minLevel: this.isDevelopment() ? LogLevel.DEBUG : LogLevel.WARN,
      enableConsole: this.isDevelopment(),
      enableRemote: !this.isDevelopment(),
      enableLocalStorage: true,
      maxLocalStorageEntries: 100,
      remoteEndpoint: '/api/frontend-logs',
      categories: [],
    };

    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 取得 LoggerService 單例實例
   */
  public static getInstance(config?: Partial<LoggerConfig>): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService(config);
    }
    return LoggerService.instance;
  }

  /**
   * 判斷是否為開發環境
   */
  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * 檢查日誌級別是否應該被記錄
   */
  private shouldLog(level: LogLevel, category?: string): boolean {
    if (level < this.config.minLevel) {
      return false;
    }

    if (this.config.categories && this.config.categories.length > 0) {
      return category ? this.config.categories.includes(category) : false;
    }

    return true;
  }

  /**
   * 格式化日誌訊息
   */
  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const category = entry.category ? `[${entry.category}]` : '';
    const component = entry.component ? `<${entry.component}>` : '';
    
    return `${timestamp} ${LOG_LEVEL_LABELS[entry.level]} ${category}${component} ${entry.message}`;
  }

  /**
   * 輸出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const formattedMessage = this.formatMessage(entry);
    const style = LOG_LEVEL_COLORS[entry.level];

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.log(`%c${formattedMessage}`, style, entry.data || '');
        break;
      case LogLevel.INFO:
        console.log(`%c${formattedMessage}`, style, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(`%c${formattedMessage}`, style, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(`%c${formattedMessage}`, style, entry.data || '');
        break;
    }
  }

  /**
   * 儲存到本地存儲
   */
  private saveToLocalStorage(entry: LogEntry): void {
    if (!this.config.enableLocalStorage) return;

    try {
      const existingLogs = this.getLocalStorageLogs();
      existingLogs.push(entry);

      // 限制儲存數量
      if (existingLogs.length > this.config.maxLocalStorageEntries) {
        existingLogs.splice(0, existingLogs.length - this.config.maxLocalStorageEntries);
      }

      localStorage.setItem(this.localStorageKey, JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('⚠️ 無法儲存日誌到 localStorage:', error);
    }
  }

  /**
   * 發送到遠端伺服器
   */
  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // 避免無限遞迴，直接使用 console 輸出
      console.warn('⚠️ 無法發送日誌到遠端伺服器:', error);
    }
  }

  /**
   * 記錄日誌的核心方法
   */
  private log(level: LogLevel, message: string, data?: any, category?: string, component?: string): void {
    if (!this.shouldLog(level, category)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      component,
      userId: this.getCurrentUserId(),
    };

    // 多重輸出
    this.outputToConsole(entry);
    this.saveToLocalStorage(entry);
    
    // 只有重要級別才發送到遠端
    if (level >= LogLevel.WARN) {
      this.sendToRemote(entry);
    }
  }

  /**
   * 取得當前使用者 ID（如果有的話）
   */
  private getCurrentUserId(): string | undefined {
    // 這裡可以整合認證系統
    return undefined;
  }

  /**
   * 取得本地儲存的日誌
   */
  public getLocalStorageLogs(): LogEntry[] {
    try {
      const logs = localStorage.getItem(this.localStorageKey);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.warn('⚠️ 無法讀取 localStorage 中的日誌:', error);
      return [];
    }
  }

  /**
   * 清除本地儲存的日誌
   */
  public clearLocalStorageLogs(): void {
    try {
      localStorage.removeItem(this.localStorageKey);
    } catch (error) {
      console.warn('⚠️ 無法清除 localStorage 中的日誌:', error);
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 取得當前配置
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // 公開的日誌方法
  public debug(message: string, data?: any, category?: string, component?: string): void {
    this.log(LogLevel.DEBUG, message, data, category, component);
  }

  public info(message: string, data?: any, category?: string, component?: string): void {
    this.log(LogLevel.INFO, message, data, category, component);
  }

  public warn(message: string, data?: any, category?: string, component?: string): void {
    this.log(LogLevel.WARN, message, data, category, component);
  }

  public error(message: string, data?: any, category?: string, component?: string): void {
    this.log(LogLevel.ERROR, message, data, category, component);
  }

  // 特殊的 API 日誌方法（保持現有的表情符號標識）
  public apiRequest(method: string, url: string): void {
    this.info(`API Request: ${method.toUpperCase()} ${url}`, undefined, 'api');
  }

  public apiResponse(status: number, url: string): void {
    this.info(`API Response: ${status} ${url}`, undefined, 'api');
  }

  public apiError(message: string, data?: any): void {
    this.error(`API Error: ${message}`, data, 'api');
  }

  public apiRetry(retryCount: number, maxRetries: number, delay: number): void {
    this.info(`Request failed, retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`, undefined, 'api');
  }
}

// 匯出預設實例
export const logger = LoggerService.getInstance();

// 匯出便利方法
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  api: {
    request: logger.apiRequest.bind(logger),
    response: logger.apiResponse.bind(logger),
    error: logger.apiError.bind(logger),
    retry: logger.apiRetry.bind(logger),
  },
};