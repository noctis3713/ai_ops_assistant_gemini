/**
 * useLogger React Hook
 * 提供組件級別的日誌功能，整合組件生命週期和錯誤邊界
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger, LoggerService } from '@/utils/logger';
import { LOG_CATEGORIES } from '@/config/logger';
import type { 
  UseLoggerReturn, 
  UseLoggerOptions, 
  LogFilterOptions, 
  LogStats, 
  LogExportOptions,
  LogEntry
} from '@/types/logger';

/**
 * useLogger Hook
 * 為 React 組件提供統一的日誌功能
 */
export function useLogger(options: UseLoggerOptions = {}): UseLoggerReturn {
  const {
    component,
    category = LOG_CATEGORIES.COMPONENT,
    autoLogMount = false,
    autoLogUnmount = false,
    autoLogErrors = false,
  } = options;

  const componentRef = useRef<string>(component || 'UnknownComponent');
  const mountTimeRef = useRef<number>(Date.now());

  // 組件掛載時的日誌
  useEffect(() => {
    if (autoLogMount) {
      logger.info(
        `組件已掛載`,
        { mountTime: mountTimeRef.current },
        category,
        componentRef.current
      );
    }

    // 組件卸載時的日誌
    return () => {
      if (autoLogUnmount) {
        const unmountTime = Date.now();
        const lifetimeDuration = unmountTime - mountTimeRef.current;
        
        logger.info(
          `組件已卸載`,
          { 
            unmountTime,
            lifetimeDuration: `${lifetimeDuration}ms`
          },
          category,
          componentRef.current
        );
      }
    };
  }, [autoLogMount, autoLogUnmount, category]);

  // 基本日誌方法
  const debug = useCallback((message: string, data?: any, comp?: string) => {
    logger.debug(message, data, category, comp || componentRef.current);
  }, [category]);

  const info = useCallback((message: string, data?: any, comp?: string) => {
    logger.info(message, data, category, comp || componentRef.current);
  }, [category]);

  const warn = useCallback((message: string, data?: any, comp?: string) => {
    logger.warn(message, data, category, comp || componentRef.current);
  }, [category]);

  const error = useCallback((message: string, data?: any, comp?: string) => {
    logger.error(message, data, category, comp || componentRef.current);
  }, [category]);

  // 專用的組件生命週期日誌方法
  const logComponentMount = useCallback((componentName: string, props?: Record<string, any>) => {
    logger.info(
      `組件掛載: ${componentName}`,
      { props, mountTime: Date.now() },
      LOG_CATEGORIES.COMPONENT,
      componentName
    );
  }, []);

  const logComponentUnmount = useCallback((componentName: string) => {
    logger.info(
      `組件卸載: ${componentName}`,
      { unmountTime: Date.now() },
      LOG_CATEGORIES.COMPONENT,
      componentName
    );
  }, []);

  const logComponentError = useCallback((componentName: string, error: Error) => {
    logger.error(
      `組件錯誤: ${componentName}`,
      { 
        errorMessage: error.message,
        errorStack: error.stack,
        componentName,
        timestamp: Date.now()
      },
      LOG_CATEGORIES.ERROR,
      componentName
    );
  }, []);

  // 使用者操作日誌
  const logUserAction = useCallback((action: string, target?: string, data?: Record<string, any>) => {
    logger.info(
      `使用者操作: ${action}`,
      {
        action,
        target,
        data,
        timestamp: Date.now(),
        component: componentRef.current
      },
      LOG_CATEGORIES.USER,
      componentRef.current
    );
  }, []);

  // 效能日誌
  const logPerformance = useCallback((operation: string, duration: number, details?: Record<string, any>) => {
    const level = duration > 1000 ? 'warn' : 'info';
    const message = `效能監控: ${operation} 耗時 ${duration}ms`;
    
    const logData = {
      operation,
      duration,
      component: componentRef.current,
      ...details
    };

    if (level === 'warn') {
      logger.warn(message, logData, LOG_CATEGORIES.PERFORMANCE, componentRef.current);
    } else {
      logger.info(message, logData, LOG_CATEGORIES.PERFORMANCE, componentRef.current);
    }
  }, []);

  // 工具方法
  const getLogs = useCallback((filters?: LogFilterOptions): LogEntry[] => {
    const allLogs = logger.getLocalStorageLogs();
    
    if (!filters) return allLogs;

    return allLogs.filter(entry => {
      // 級別篩選
      if (filters.levels && !filters.levels.includes(entry.level)) {
        return false;
      }

      // 類別篩選
      if (filters.categories && entry.category && !filters.categories.includes(entry.category)) {
        return false;
      }

      // 組件篩選
      if (filters.components && entry.component && !filters.components.includes(entry.component)) {
        return false;
      }

      // 時間篩選
      if (filters.startTime && entry.timestamp < filters.startTime) {
        return false;
      }

      if (filters.endTime && entry.timestamp > filters.endTime) {
        return false;
      }

      // 文字搜尋
      if (filters.searchText) {
        const searchText = filters.searchText.toLowerCase();
        return entry.message.toLowerCase().includes(searchText);
      }

      return true;
    });
  }, []);

  const clearLogs = useCallback(() => {
    logger.clearLocalStorageLogs();
    logger.info('日誌已清空', undefined, LOG_CATEGORIES.DEBUG, componentRef.current);
  }, []);

  const getStats = useCallback((): LogStats => {
    const logs = logger.getLocalStorageLogs();
    
    const stats: LogStats = {
      total: logs.length,
      byLevel: { 0: 0, 1: 0, 2: 0, 3: 0 },
      byCategory: {},
      oldestEntry: undefined,
      newestEntry: undefined,
    };

    if (logs.length === 0) return stats;

    // 計算統計
    logs.forEach(entry => {
      stats.byLevel[entry.level]++;
      
      if (entry.category) {
        stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
      }
    });

    // 找出最舊和最新的條目
    const sortedLogs = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    stats.oldestEntry = sortedLogs[0]?.timestamp;
    stats.newestEntry = sortedLogs[sortedLogs.length - 1]?.timestamp;

    return stats;
  }, []);

  const exportLogs = useCallback((options: LogExportOptions): string | Blob => {
    const logs = getLogs(options.filters);
    
    switch (options.format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
        
      case 'csv': {
        const headers = ['時間戳', '級別', '類別', '組件', '訊息', '資料'];
        const csvContent = [
          headers.join(','),
          ...logs.map(entry => [
            entry.timestamp,
            entry.level,
            entry.category || '',
            entry.component || '',
            `"${entry.message.replace(/"/g, '""')}"`,
            entry.data ? `"${JSON.stringify(entry.data).replace(/"/g, '""')}"` : ''
          ].join(','))
        ].join('\n');
        
        return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      }
      
      case 'txt': {
        return logs.map(entry => {
          const timestamp = new Date(entry.timestamp).toLocaleString();
          const level = ['DEBUG', 'INFO', 'WARN', 'ERROR'][entry.level];
          const category = entry.category ? `[${entry.category}]` : '';
          const component = entry.component ? `<${entry.component}>` : '';
          const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
          
          return `${timestamp} ${level} ${category}${component} ${entry.message}${data}`;
        }).join('\n');
      }
      
      default:
        throw new Error(`不支援的匯出格式: ${options.format}`);
    }
  }, [getLogs]);

  return {
    debug,
    info,
    warn,
    error,
    logComponentMount,
    logComponentUnmount,
    logComponentError,
    logUserAction,
    logPerformance,
    getLogs,
    clearLogs,
    getStats,
    exportLogs,
  };
}

/**
 * 用於錯誤邊界的日誌 Hook
 */
export function useErrorLogger(componentName: string) {
  const { logComponentError } = useLogger({ 
    component: componentName,
    autoLogErrors: true 
  });

  return useCallback((error: Error, errorInfo?: { componentStack: string }) => {
    logComponentError(componentName, error);
    
    // 記錄額外的錯誤資訊
    if (errorInfo) {
      logger.error(
        `React 錯誤邊界捕獲錯誤`,
        {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          component: componentName
        },
        LOG_CATEGORIES.ERROR,
        componentName
      );
    }
  }, [logComponentError, componentName]);
}

/**
 * 用於效能監控的日誌 Hook
 */
export function usePerformanceLogger(componentName: string) {
  const { logPerformance } = useLogger({ component: componentName });

  const measurePerformance = useCallback(<T>(
    operation: string,
    fn: () => T | Promise<T>
  ): T | Promise<T> => {
    const startTime = performance.now();
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - startTime;
        logPerformance(operation, duration);
      });
    } else {
      const duration = performance.now() - startTime;
      logPerformance(operation, duration);
      return result;
    }
  }, [logPerformance]);

  return { measurePerformance, logPerformance };
}