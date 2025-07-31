/**
 * 日誌系統相關類型定義
 */

// 重新匯出核心類型
export { 
  LogLevel, 
  type LogEntry, 
  type LoggerConfig 
} from '@/utils/logger';

/**
 * 日誌輸出目標類型
 */
export type LogOutput = 'console' | 'localStorage' | 'remote';

/**
 * 日誌格式化選項
 */
export interface LogFormatOptions {
  includeTimestamp?: boolean;
  includeLevel?: boolean;
  includeCategory?: boolean;
  includeComponent?: boolean;
  dateFormat?: 'iso' | 'local' | 'short';
  colorize?: boolean;
}

/**
 * 遠端日誌請求介面
 */
export interface RemoteLogRequest {
  entries: LogEntry[];
  metadata?: {
    userAgent?: string;
    url?: string;
    sessionId?: string;
    buildVersion?: string;
  };
}

/**
 * 遠端日誌回應介面
 */
export interface RemoteLogResponse {
  success: boolean;
  message?: string;
  processed?: number;
  errors?: string[];
}

/**
 * 日誌篩選選項
 */
export interface LogFilterOptions {
  levels?: LogLevel[];
  categories?: string[];
  components?: string[];
  startTime?: string;
  endTime?: string;
  searchText?: string;
}

/**
 * 日誌統計資訊
 */
export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<string, number>;
  oldestEntry?: string;
  newestEntry?: string;
}

/**
 * 日誌匯出選項
 */
export interface LogExportOptions {
  format: 'json' | 'csv' | 'txt';
  filters?: LogFilterOptions;
  includeMetadata?: boolean;
}

/**
 * 元件日誌上下文
 */
export interface ComponentLogContext {
  componentName: string;
  props?: Record<string, any>;
  state?: Record<string, any>;
  error?: Error;
}

/**
 * API 日誌上下文
 */
export interface ApiLogContext {
  method: string;
  url: string;
  status?: number;
  duration?: number;
  requestBody?: any;
  responseBody?: any;
  headers?: Record<string, string>;
}

/**
 * 效能日誌上下文
 */
export interface PerformanceLogContext {
  operation: string;
  duration: number;
  memory?: {
    used: number;
    total: number;
  };
  timing?: {
    start: number;
    end: number;
  };
}

/**
 * 使用者操作日誌上下文
 */
export interface UserActionLogContext {
  action: string;
  target?: string;
  data?: Record<string, any>;
  timestamp: string;
}

/**
 * 日誌上下文聯合類型
 */
export type LogContext = 
  | ComponentLogContext 
  | ApiLogContext 
  | PerformanceLogContext 
  | UserActionLogContext
  | Record<string, any>;

/**
 * 擴展的日誌項目介面
 */
export interface ExtendedLogEntry extends LogEntry {
  context?: LogContext;
  stack?: string;
  userAgent?: string;
  url?: string;
  sessionId?: string;
}

/**
 * 日誌中介軟體介面
 */
export interface LogMiddleware {
  name: string;
  process: (entry: LogEntry) => LogEntry | Promise<LogEntry>;
  shouldApply?: (entry: LogEntry) => boolean;
}

/**
 * 日誌事件類型
 */
export type LogEvent = 'log' | 'clear' | 'export' | 'config-change';

/**
 * 日誌事件監聽器類型
 */
export type LogEventListener<T = any> = (data: T) => void;

/**
 * 日誌事件資料介面
 */
export interface LogEventData {
  log: LogEntry;
  clear: { count: number };
  export: { format: string; count: number };
  'config-change': { config: LoggerConfig };
}

/**
 * Hook 回傳類型
 */
export interface UseLoggerReturn {
  debug: (message: string, data?: any, component?: string) => void;
  info: (message: string, data?: any, component?: string) => void;
  warn: (message: string, data?: any, component?: string) => void;
  error: (message: string, data?: any, component?: string) => void;
  
  // 特殊日誌方法
  logComponentMount: (componentName: string, props?: Record<string, any>) => void;
  logComponentUnmount: (componentName: string) => void;
  logComponentError: (componentName: string, error: Error) => void;
  logUserAction: (action: string, target?: string, data?: Record<string, any>) => void;
  logPerformance: (operation: string, duration: number, details?: Record<string, any>) => void;
  
  // 工具方法
  getLogs: (filters?: LogFilterOptions) => LogEntry[];
  clearLogs: () => void;
  getStats: () => LogStats;
  exportLogs: (options: LogExportOptions) => string | Blob;
}

/**
 * Hook 選項介面
 */
export interface UseLoggerOptions {
  component?: string;
  category?: string;
  autoLogMount?: boolean;
  autoLogUnmount?: boolean;
  autoLogErrors?: boolean;
}