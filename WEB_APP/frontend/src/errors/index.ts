/**
 * 錯誤處理統一入口點
 * 匯出所有錯誤處理相關的組件、Hook 和工具
 */

// 型別定義
export * from './types';

// 錯誤分類器
export { 
  ErrorClassifier,
  default as ErrorClassifierDefault
} from './ErrorClassifier';

// 錯誤日誌記錄
export { 
  default as errorLogger,
  logError,
  logApiInfo,
  logApiError,
  logSystemInfo,
  logSystemError,
  logUserError,
  logPerformanceError
} from './ErrorLogger';

// 錯誤通知組件
export { 
  ErrorNotification,
  ErrorNotificationContainer,
  default as ErrorNotificationDefault
} from './ErrorNotification';

// 錯誤邊界提供者
export { 
  ErrorBoundaryProvider,
  ErrorBoundary,
  ErrorContextProvider,
  useErrorContext,
  default as ErrorBoundaryProviderDefault
} from './ErrorBoundaryProvider';

// 錯誤處理 Hook
export { 
  useErrorHandler,
  useLightErrorHandler,
  default as useErrorHandlerDefault
} from './hooks/useErrorHandler';

// 重新匯出 errorHandler 工具（保持相容性）
// 錯誤處理功能已移到本模組內

// 常用組合導出
export { errorLogger as logger };
export { ErrorBoundaryProvider as Provider };
export { useErrorHandler as useErrors };

/**
 * 錯誤處理系統初始化函數
 * 可選的系統初始化配置
 */
export const initializeErrorSystem = (config?: {
  enableGlobalErrorHandler?: boolean;
  enableUnhandledRejectionHandler?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}) => {
  const defaultConfig = {
    enableGlobalErrorHandler: true,
    enableUnhandledRejectionHandler: true,
    logLevel: 'error' as const,
  };

  const finalConfig = { ...defaultConfig, ...config };

  // 全域錯誤處理器
  if (finalConfig.enableGlobalErrorHandler && typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      errorLogger.logError('全域錯誤', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      }, event.error);
    });
  }

  // 未處理的 Promise 拒絕
  if (finalConfig.enableUnhandledRejectionHandler && typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      errorLogger.logError('未處理的 Promise 拒絕', {
        reason: event.reason,
        promise: event.promise.toString(),
      }, event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
    });
  }

  console.log(`🛡️ 錯誤處理系統已初始化 (${finalConfig.logLevel})`);
};

/**
 * 便利的錯誤處理組合函數
 */
export const createErrorHandler = (context: string) => {
  return {
    log: (message: string, data?: unknown, error?: Error) => 
      errorLogger.logError(`[${context}] ${message}`, data, error),
    
    handle: async (error: unknown) => {
      // ErrorClassifier 功能已移到本模組內
      const unifiedError = { error, context, timestamp: Date.now() };
      errorLogger.logError(`[${context}] 錯誤處理`, unifiedError, error instanceof Error ? error : new Error(String(error)));
      return unifiedError;
    },
    
    wrap: <T extends (...args: unknown[]) => Promise<unknown>>(fn: T) => {
      return ((...args: Parameters<T>) => {
        return fn(...args).catch(async (error) => {
          await errorLogger.logError(`[${context}] 異步操作失敗`, { args }, error);
          throw error;
        });
      }) as T;
    },
  };
};