/**
 * 日誌系統配置管理
 * 提供環境感知的日誌配置和預設設定
 */

import { LogLevel, type LoggerConfig } from '@/utils/logger';

/**
 * 環境變數配置介面
 */
interface LoggerEnvConfig {
  LOG_LEVEL?: string;
  ENABLE_CONSOLE_LOG?: string;
  ENABLE_REMOTE_LOG?: string;
  ENABLE_LOCAL_STORAGE_LOG?: string;
  MAX_LOCAL_STORAGE_ENTRIES?: string;
  REMOTE_LOG_ENDPOINT?: string;
  LOG_CATEGORIES?: string;
}

/**
 * 取得環境變數配置
 */
function getEnvConfig(): LoggerEnvConfig {
  return {
    LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
    ENABLE_CONSOLE_LOG: import.meta.env.VITE_ENABLE_CONSOLE_LOG,
    ENABLE_REMOTE_LOG: import.meta.env.VITE_ENABLE_REMOTE_LOG,
    ENABLE_LOCAL_STORAGE_LOG: import.meta.env.VITE_ENABLE_LOCAL_STORAGE_LOG,
    MAX_LOCAL_STORAGE_ENTRIES: import.meta.env.VITE_MAX_LOCAL_STORAGE_ENTRIES,
    REMOTE_LOG_ENDPOINT: import.meta.env.VITE_REMOTE_LOG_ENDPOINT,
    LOG_CATEGORIES: import.meta.env.VITE_LOG_CATEGORIES,
  };
}

/**
 * 解析日誌級別字串
 */
function parseLogLevel(level?: string): LogLevel {
  switch (level?.toUpperCase()) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN;
  }
}

/**
 * 解析布林值環境變數
 */
function parseBoolean(value?: string, defaultValue: boolean = false): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * 解析數字環境變數
 */
function parseNumber(value?: string, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 解析字串陣列環境變數
 */
function parseStringArray(value?: string): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 開發環境日誌配置
 */
export const developmentLoggerConfig: LoggerConfig = {
  minLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableRemote: false,
  enableLocalStorage: true,
  maxLocalStorageEntries: 200,
  remoteEndpoint: '/api/frontend-logs',
  categories: [], // 空陣列表示記錄所有類別
};

/**
 * 生產環境日誌配置
 */
export const productionLoggerConfig: LoggerConfig = {
  minLevel: LogLevel.WARN,
  enableConsole: false,
  enableRemote: true,
  enableLocalStorage: true,
  maxLocalStorageEntries: 50,
  remoteEndpoint: '/api/frontend-logs',
  categories: ['api', 'error', 'auth'], // 只記錄關鍵類別
};

/**
 * 測試環境日誌配置
 */
export const testLoggerConfig: LoggerConfig = {
  minLevel: LogLevel.INFO,
  enableConsole: true,
  enableRemote: false,
  enableLocalStorage: false,
  maxLocalStorageEntries: 100,
  remoteEndpoint: '/api/frontend-logs',
  categories: [],
};

/**
 * 根據環境取得預設配置
 */
function getDefaultConfigByEnvironment(): LoggerConfig {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'development':
      return developmentLoggerConfig;
    case 'production':
      return productionLoggerConfig;
    case 'test':
      return testLoggerConfig;
    default:
      return developmentLoggerConfig;
  }
}

/**
 * 建立最終的日誌配置
 * 優先級：環境變數 > 環境預設配置 > 系統預設配置
 */
export function createLoggerConfig(overrides: Partial<LoggerConfig> = {}): LoggerConfig {
  const envConfig = getEnvConfig();
  const defaultConfig = getDefaultConfigByEnvironment();
  
  // 從環境變數建立配置
  const envLoggerConfig: Partial<LoggerConfig> = {
    minLevel: parseLogLevel(envConfig.LOG_LEVEL),
    enableConsole: envConfig.ENABLE_CONSOLE_LOG !== undefined 
      ? parseBoolean(envConfig.ENABLE_CONSOLE_LOG, defaultConfig.enableConsole)
      : defaultConfig.enableConsole,
    enableRemote: envConfig.ENABLE_REMOTE_LOG !== undefined
      ? parseBoolean(envConfig.ENABLE_REMOTE_LOG, defaultConfig.enableRemote)
      : defaultConfig.enableRemote,
    enableLocalStorage: envConfig.ENABLE_LOCAL_STORAGE_LOG !== undefined
      ? parseBoolean(envConfig.ENABLE_LOCAL_STORAGE_LOG, defaultConfig.enableLocalStorage)
      : defaultConfig.enableLocalStorage,
    maxLocalStorageEntries: parseNumber(envConfig.MAX_LOCAL_STORAGE_ENTRIES, defaultConfig.maxLocalStorageEntries),
    remoteEndpoint: envConfig.REMOTE_LOG_ENDPOINT || defaultConfig.remoteEndpoint,
    categories: envConfig.LOG_CATEGORIES 
      ? parseStringArray(envConfig.LOG_CATEGORIES)
      : defaultConfig.categories,
  };

  // 合併所有配置，優先級：overrides > 環境變數 > 預設配置
  return {
    ...defaultConfig,
    ...envLoggerConfig,
    ...overrides,
  };
}

/**
 * 預設的日誌配置
 */
export const defaultLoggerConfig = createLoggerConfig();

/**
 * 日誌類別常數
 */
export const LOG_CATEGORIES = {
  API: 'api',
  AUTH: 'auth',
  ERROR: 'error',
  USER: 'user',
  PERFORMANCE: 'performance',
  DEBUG: 'debug',
  COMPONENT: 'component',
  STORAGE: 'storage',
  NETWORK: 'network',
} as const;

/**
 * 預設的日誌類別陣列
 */
export const DEFAULT_LOG_CATEGORIES = Object.values(LOG_CATEGORIES);

/**
 * 檢查是否為開發環境
 */
export const isDevelopment = (): boolean => process.env.NODE_ENV === 'development';

/**
 * 檢查是否為生產環境
 */
export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/**
 * 檢查是否為測試環境
 */
export const isTest = (): boolean => process.env.NODE_ENV === 'test';