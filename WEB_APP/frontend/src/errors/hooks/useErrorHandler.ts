/**
 * 錯誤處理 Hook
 * 提供統一的錯誤處理邏輯和便利方法
 */

import { useCallback, useRef, useMemo } from 'react';
import { useErrorContext } from '../hooks';
import { errorLogger } from '../ErrorLogger';
import { ErrorClassifier } from '../ErrorClassifier';
import type { UseErrorHandlerConfig, UnifiedError } from '../types';

/**
 * 預設配置
 */
const defaultConfig: UseErrorHandlerConfig = {
  showNotification: true,
  logToConsole: false,
  reportToServer: true,
  autoRetry: false,
  maxRetries: 3,
};

/**
 * 重試函數 - 帶指數退避的重試機制
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  context?: string
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // 如果是最後一次嘗試，直接拋出錯誤
      if (attempt === maxRetries) {
        break;
      }

      // 檢查是否為可重試的錯誤
      const unifiedError = ErrorClassifier.classify(error, context);
      if (!unifiedError.retryable) {
        throw error;
      }

      // 指數退避延遲
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`重試操作失敗 (第 ${attempt + 1}/${maxRetries + 1} 次)，${delay}ms 後重試`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * 錯誤處理 Hook
 */
export const useErrorHandler = (config: UseErrorHandlerConfig = {}) => {
  const finalConfig = useMemo(() => ({ ...defaultConfig, ...config }), [config]);
  const { reportError } = useErrorContext();
  const retryCount = useRef<Map<string, number>>(new Map());

  /**
   * 處理錯誤的主要方法
   */
  const handleError = useCallback(async (
    error: unknown,
    context?: string,
    options?: Partial<UseErrorHandlerConfig>
  ): Promise<UnifiedError> => {
    const effectiveConfig = { ...finalConfig, ...options };
    
    let unifiedError: UnifiedError;

    if (effectiveConfig.showNotification) {
      // 使用上下文報告錯誤（會顯示通知）
      unifiedError = await reportError(error, context);
    } else {
      // 直接分類錯誤但不顯示通知
      unifiedError = ErrorClassifier.classify(error, context);
      
      if (effectiveConfig.reportToServer) {
        errorLogger.logUnifiedError(unifiedError);
      }
    }

    // 控制台日誌（開發環境或明確啟用）
    if (effectiveConfig.logToConsole || process.env.NODE_ENV === 'development') {
      console.group(`🚨 錯誤處理: ${unifiedError.category}`);
      console.error('用戶訊息:', unifiedError.userMessage);
      console.error('原始訊息:', unifiedError.message);
      console.error('上下文:', unifiedError.context);
      console.error('可重試:', unifiedError.retryable);
      if (unifiedError.originalError) {
        console.error('原始錯誤:', unifiedError.originalError);
      }
      console.groupEnd();
    }

    return unifiedError;
  }, [finalConfig, reportError]);

  /**
   * API 錯誤處理便利方法
   */
  const handleApiError = useCallback(async (
    error: unknown,
    apiContext: string
  ): Promise<UnifiedError> => {
    return handleError(error, `API: ${apiContext}`, {
      showNotification: true,
      reportToServer: true,
    });
  }, [handleError]);

  /**
   * 表單驗證錯誤處理便利方法
   */
  const handleValidationError = useCallback(async (
    error: unknown,
    fieldName: string
  ): Promise<UnifiedError> => {
    return handleError(error, `表單驗證: ${fieldName}`, {
      showNotification: true,
      reportToServer: false, // 驗證錯誤通常不需要報告到伺服器
    });
  }, [handleError]);

  /**
   * 靜默錯誤處理（只記錄，不顯示通知）
   */
  const handleSilentError = useCallback(async (
    error: unknown,
    context?: string
  ): Promise<UnifiedError> => {
    return handleError(error, context, {
      showNotification: false,
      reportToServer: true,
    });
  }, [handleError]);

  /**
   * 帶重試的錯誤處理
   */
  const handleErrorWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string,
    maxRetries: number = finalConfig.maxRetries || 3
  ): Promise<T> => {
    const retryKey = context || 'anonymous';
    const currentRetries = retryCount.current.get(retryKey) || 0;

    try {
      const result = await withRetry(operation, maxRetries, 1000, context);
      // 成功後重置重試計數
      retryCount.current.delete(retryKey);
      return result;
    } catch (error) {
      // 記錄重試次數
      retryCount.current.set(retryKey, currentRetries + 1);
      
      // 處理最終錯誤
      await handleError(error, `${context} (重試失敗，已嘗試 ${maxRetries} 次)`);
      throw error;
    }
  }, [finalConfig.maxRetries, handleError]);

  /**
   * 異步操作包裝器
   */
  const wrapAsync = useCallback(<T extends (...args: unknown[]) => Promise<unknown>>(
    asyncFunction: T,
    context?: string
  ): T => {
    return ((...args: Parameters<T>) => {
      return asyncFunction(...args).catch(async (error) => {
        await handleError(error, context);
        throw error;
      });
    }) as T;
  }, [handleError]);

  /**
   * 批次錯誤處理
   */
  const handleBatchErrors = useCallback(async (
    errors: Array<{ error: unknown; context?: string }>,
    options?: Partial<UseErrorHandlerConfig>
  ): Promise<UnifiedError[]> => {
    const results = await Promise.all(
      errors.map(({ error, context }) => 
        handleError(error, context, options)
      )
    );
    return results;
  }, [handleError]);

  /**
   * 清除重試計數
   */
  const clearRetryCount = useCallback((context?: string) => {
    if (context) {
      retryCount.current.delete(context);
    } else {
      retryCount.current.clear();
    }
  }, []);

  /**
   * 獲取當前重試狀態
   */
  const getRetryStatus = useCallback((context: string) => {
    return {
      attempts: retryCount.current.get(context) || 0,
      maxRetries: finalConfig.maxRetries || 3,
      canRetry: (retryCount.current.get(context) || 0) < (finalConfig.maxRetries || 3),
    };
  }, [finalConfig.maxRetries]);

  return {
    // 主要錯誤處理方法
    handleError,
    handleApiError,
    handleValidationError,
    handleSilentError,
    handleErrorWithRetry,
    
    // 工具方法
    wrapAsync,
    handleBatchErrors,
    
    // 重試管理
    clearRetryCount,
    getRetryStatus,
    
    // 配置
    config: finalConfig,
  };
};

/**
 * 輕量級錯誤處理 Hook（只包含基本功能）
 */
export const useLightErrorHandler = () => {
  const { reportError } = useErrorContext();

  const handleError = useCallback(async (error: unknown, context?: string) => {
    return reportError(error, context);
  }, [reportError]);

  const handleSilentError = useCallback(async (error: unknown, context?: string) => {
    const unifiedError = ErrorClassifier.classify(error, context);
    errorLogger.logUnifiedError(unifiedError);
    return unifiedError;
  }, []);

  return {
    handleError,
    handleSilentError,
  };
};

export default useErrorHandler;