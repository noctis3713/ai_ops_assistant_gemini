/**
 * useLogger React Hook
 * 提供 React 組件友善的日誌記錄介面
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger, LogCategory, logDebug, logInfo, logWarn, logError, logPerformance } from '@/utils/LoggerService';

// Hook 選項介面
export interface UseLoggerOptions {
  componentName?: string;           // 組件名稱，用於自動分類
  enableComponentLogs?: boolean;    // 是否啟用組件生命週期日誌
  enablePerformanceTracking?: boolean; // 是否啟用效能追蹤
  autoLogProps?: boolean;          // 是否自動記錄 Props 變化
}

// Hook 回傳介面
export interface UseLoggerReturn {
  // 基本日誌記錄方法
  debug: (message: string, data?: any, category?: LogCategory) => void;
  info: (message: string, data?: any, category?: LogCategory) => void;
  warn: (message: string, data?: any, error?: Error, category?: LogCategory) => void;
  error: (message: string, data?: any, error?: Error, category?: LogCategory) => void;
  
  // 特殊日誌記錄方法
  logUserAction: (action: string, data?: any) => void;
  logApiCall: (endpoint: string, method: string, data?: any) => void;
  logApiResponse: (endpoint: string, status: number, duration: number, data?: any) => void;
  logApiError: (endpoint: string, error: Error, data?: any) => void;
  logPerformance: (operation: string, duration: number, data?: any) => void;
  logComponentEvent: (event: string, data?: any) => void;
  
  // 效能測量工具
  startPerformanceMeasure: (operation: string) => () => void;
  measureAsyncOperation: <T>(operation: string, asyncFn: () => Promise<T>) => Promise<T>;
  
  // 日誌管理
  getLogStats: () => ReturnType<typeof logger.getLogStats>;
  clearLogs: () => void;
  flushLogs: () => Promise<void>;
}

/**
 * useLogger Hook
 * 提供統一的日誌記錄功能，整合 React 組件生命週期
 */
export const useLogger = (options: UseLoggerOptions = {}): UseLoggerReturn => {
  const {
    componentName = 'Unknown',
    enableComponentLogs = false,
    enablePerformanceTracking = false,
    autoLogProps = false,
  } = options;

  const mountTimeRef = useRef<number>(Date.now());
  const propsRef = useRef<any>(null);

  // 組件掛載日誌
  useEffect(() => {
    if (enableComponentLogs) {
      logDebug(
        LogCategory.COMPONENT,
        `Component ${componentName} mounted`,
        { componentName, mountTime: mountTimeRef.current }
      );
    }

    // 組件卸載日誌
    return () => {
      if (enableComponentLogs) {
        const unmountTime = Date.now();
        const lifeTime = unmountTime - mountTimeRef.current;
        
        logDebug(
          LogCategory.COMPONENT,
          `Component ${componentName} unmounted`,
          { componentName, lifeTime, unmountTime }
        );

        if (enablePerformanceTracking && lifeTime > 10000) { // 10秒以上
          logWarn(
            LogCategory.PERFORMANCE,
            `Component ${componentName} had long lifetime: ${lifeTime}ms`,
            { componentName, lifeTime }
          );
        }
      }
    };
  }, [componentName, enableComponentLogs, enablePerformanceTracking]);

  // Props 變化追蹤（開發環境）
  useEffect(() => {
    if (autoLogProps && import.meta.env.DEV) {
      if (propsRef.current !== null) {
        logDebug(
          LogCategory.COMPONENT,
          `Component ${componentName} props changed`,
          { componentName, previousProps: propsRef.current }
        );
      }
    }
  });

  // 基本日誌記錄方法
  const debug = useCallback((message: string, data?: any, category: LogCategory = LogCategory.DEBUG) => {
    logDebug(category, `[${componentName}] ${message}`, data);
  }, [componentName]);

  const info = useCallback((message: string, data?: any, category: LogCategory = LogCategory.COMPONENT) => {
    logInfo(category, `[${componentName}] ${message}`, data);
  }, [componentName]);

  const warn = useCallback((message: string, data?: any, error?: Error, category: LogCategory = LogCategory.COMPONENT) => {
    logWarn(category, `[${componentName}] ${message}`, data, error);
  }, [componentName]);

  const error = useCallback((message: string, data?: any, error?: Error, category: LogCategory = LogCategory.ERROR) => {
    logError(category, `[${componentName}] ${message}`, data, error);
  }, [componentName]);

  // 特殊日誌記錄方法
  const logUserAction = useCallback((action: string, data?: any) => {
    logInfo(LogCategory.USER, `User action: ${action}`, {
      component: componentName,
      action,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }, [componentName]);

  const logApiCall = useCallback((endpoint: string, method: string, data?: any) => {
    logInfo(LogCategory.API, `API call: ${method} ${endpoint}`, {
      component: componentName,
      endpoint,
      method,
      requestData: data,
    });
  }, [componentName]);

  const logApiResponse = useCallback((endpoint: string, status: number, duration: number, data?: any) => {
    const level = status >= 400 ? 'warn' : 'info';
    const method = level === 'warn' ? logWarn : logInfo;
    
    method(LogCategory.API, `API response: ${status} ${endpoint} (${duration}ms)`, {
      component: componentName,
      endpoint,
      status,
      duration,
      responseData: data,
    });

    // 同時記錄效能
    if (enablePerformanceTracking) {
      logPerformance(`API ${endpoint}`, duration, { status, component: componentName });
    }
  }, [componentName, enablePerformanceTracking]);

  const logApiError = useCallback((endpoint: string, error: Error, data?: any) => {
    logError(LogCategory.API, `API error: ${endpoint}`, {
      component: componentName,
      endpoint,
      errorMessage: error.message,
      ...data,
    }, error);
  }, [componentName]);

  const logPerformanceWrapper = useCallback((operation: string, duration: number, data?: any) => {
    logPerformance(operation, duration, {
      component: componentName,
      ...data,
    });
  }, [componentName]);

  const logComponentEvent = useCallback((event: string, data?: any) => {
    logDebug(LogCategory.COMPONENT, `Component event: ${event}`, {
      component: componentName,
      event,
      ...data,
    });
  }, [componentName]);

  // 效能測量工具
  const startPerformanceMeasure = useCallback((operation: string) => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      logPerformanceWrapper(operation, duration);
      return duration;
    };
  }, [logPerformanceWrapper]);

  const measureAsyncOperation = useCallback(async <T>(
    operation: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      logDebug(LogCategory.PERFORMANCE, `Starting async operation: ${operation}`, {
        component: componentName,
        operation,
      });

      const result = await asyncFn();
      const duration = performance.now() - startTime;

      logPerformanceWrapper(operation, duration, { success: true });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      logError(LogCategory.PERFORMANCE, `Async operation failed: ${operation}`, {
        component: componentName,
        operation,
        duration,
      }, error as Error);

      throw error;
    }
  }, [componentName, logPerformanceWrapper]);

  // 日誌管理方法
  const getLogStats = useCallback(() => {
    return logger.getLogStats();
  }, []);

  const clearLogs = useCallback(() => {
    logger.clearLocalLogs();
    logInfo(LogCategory.DEBUG, 'Local logs cleared', { component: componentName });
  }, [componentName]);

  const flushLogs = useCallback(async () => {
    await logger.flush();
    logDebug(LogCategory.DEBUG, 'Logs flushed to remote', { component: componentName });
  }, [componentName]);

  return {
    debug,
    info,
    warn,
    error,
    logUserAction,
    logApiCall,
    logApiResponse,
    logApiError,
    logPerformance: logPerformanceWrapper,
    logComponentEvent,
    startPerformanceMeasure,
    measureAsyncOperation,
    getLogStats,
    clearLogs,
    flushLogs,
  };
};

/**
 * 特殊化的 Hook：用於 API 呼叫
 */
export const useApiLogger = (componentName: string) => {
  const logger = useLogger({ componentName });

  const logApiCall = useCallback(async <T>(
    endpoint: string,
    apiCall: () => Promise<T>,
    options: {
      method?: string;
      requestData?: any;
      logRequest?: boolean;
      logResponse?: boolean;
    } = {}
  ): Promise<T> => {
    const {
      method = 'unknown',
      requestData,
      logRequest = true,
      logResponse = true,
    } = options;

    const startTime = performance.now();

    if (logRequest) {
      logger.logApiCall(endpoint, method, requestData);
    }

    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;

      if (logResponse) {
        logger.logApiResponse(endpoint, 200, duration, result);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.logApiError(endpoint, error as Error, { duration, method, requestData });
      throw error;
    }
  }, [logger]);

  return {
    ...logger,
    logApiCall,
  };
};

/**
 * 特殊化的 Hook：用於使用者行為追蹤
 */
export const useUserActionLogger = (componentName: string) => {
  const logger = useLogger({ 
    componentName,
    enableComponentLogs: true,
  });

  const trackClick = useCallback((elementId: string, data?: any) => {
    logger.logUserAction('click', { elementId, ...data });
  }, [logger]);

  const trackFormSubmit = useCallback((formId: string, formData?: any) => {
    logger.logUserAction('form_submit', { formId, formData });
  }, [logger]);

  const trackNavigation = useCallback((from: string, to: string, data?: any) => {
    logger.logUserAction('navigation', { from, to, ...data });
  }, [logger]);

  const trackError = useCallback((errorType: string, error: Error, data?: any) => {
    logger.error(`User encountered error: ${errorType}`, data, error);
  }, [logger]);

  return {
    ...logger,
    trackClick,
    trackFormSubmit,
    trackNavigation,
    trackError,
  };
};

/**
 * 特殊化的 Hook：用於效能監控
 */
export const usePerformanceLogger = (componentName: string) => {
  const logger = useLogger({ 
    componentName,
    enablePerformanceTracking: true,
  });

  const measureRender = useCallback((renderName: string = 'render') => {
    const startTime = performance.now();
    
    // 在下一個微任務中測量，確保渲染完成
    return new Promise<number>((resolve) => {
      setTimeout(() => {
        const duration = performance.now() - startTime;
        logger.logPerformance(`${componentName}_${renderName}`, duration);
        resolve(duration);
      }, 0);
    });
  }, [logger, componentName]);

  const measureEffect = useCallback((effectName: string, effectFn: () => void) => {
    const stopMeasure = logger.startPerformanceMeasure(`${componentName}_effect_${effectName}`);
    
    try {
      effectFn();
    } finally {
      stopMeasure();
    }
  }, [logger, componentName]);

  return {
    ...logger,
    measureRender,
    measureEffect,
  };
};