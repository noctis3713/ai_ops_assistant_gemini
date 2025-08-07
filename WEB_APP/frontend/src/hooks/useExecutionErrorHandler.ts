/**
 * 執行錯誤處理 Hook
 * 統一錯誤分類和用戶友善提示機制
 */
import { useCallback } from 'react';
import { type APIError } from '@/types';
import { logError } from '@/utils/SimpleLogger';

interface ErrorContext {
  operation: string;
  deviceCount?: number;
  mode?: 'command' | 'ai';
}

export const useExecutionErrorHandler = () => {
  
  // 提供用戶友善的錯誤訊息
  const getFriendlyErrorMessage = useCallback((error: APIError | Error): string => {
    const errorMessage = error.message;
    
    if (errorMessage.includes('Google Gemini API 免費額度已用完')) {
      return 'AI 服務配額已用完，請稍後再試或聯繫管理員';
    } 
    
    if (errorMessage.includes('API 認證失敗')) {
      return 'AI 服務認證失敗，請聯繫管理員檢查設定';
    }
    
    if (errorMessage.includes('網路連接問題')) {
      return '網路連接異常，請檢查網路連接後重試';
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('超時')) {
      return '請求超時，請稍後重試或檢查網路連接';
    }
    
    if (errorMessage.includes('設備連接失敗')) {
      return '無法連接到設備，請檢查設備狀態和網路連接';
    }
    
    if (errorMessage.includes('權限不足')) {
      return '權限不足，請聯繫系統管理員';
    }
    
    if (errorMessage.includes('指令格式錯誤')) {
      return '指令格式錯誤，請檢查指令語法';
    }
    
    // 其他未分類的錯誤，返回原始訊息
    return errorMessage;
  }, []);

  // 錯誤分類器
  const categorizeError = useCallback((error: APIError | Error) => {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('api') && errorMessage.includes('quota')) {
      return 'quota_exceeded';
    }
    
    if (errorMessage.includes('auth') || errorMessage.includes('認證')) {
      return 'authentication_failed';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('網路')) {
      return 'network_error';
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('超時')) {
      return 'timeout_error';
    }
    
    if (errorMessage.includes('device') || errorMessage.includes('設備')) {
      return 'device_error';
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('權限')) {
      return 'permission_error';
    }
    
    if (errorMessage.includes('command') || errorMessage.includes('指令')) {
      return 'command_error';
    }
    
    return 'unknown_error';
  }, []);

  // 記錄錯誤到日誌
  const logErrorWithContext = useCallback((error: APIError | Error, context: ErrorContext) => {
    const errorCategory = categorizeError(error);
    const friendlyMessage = getFriendlyErrorMessage(error);
    
    logError(`執行${context.operation}發生錯誤`, {
      error: error instanceof Error ? error.message : String(error),
      category: errorCategory,
      friendlyMessage,
      context: {
        operation: context.operation,
        deviceCount: context.deviceCount,
        mode: context.mode
      }
    });
    
    return {
      category: errorCategory,
      friendlyMessage,
      originalError: error
    };
  }, [categorizeError, getFriendlyErrorMessage]);

  // 獲取重試建議
  const getRetryAdvice = useCallback((errorCategory: string): string => {
    switch (errorCategory) {
      case 'quota_exceeded':
        return '請稍後再試，或聯繫管理員升級服務配額';
      case 'authentication_failed':
        return '請聯繫系統管理員檢查 API 金鑰設定';
      case 'network_error':
        return '請檢查網路連接，確保後端服務正常運行';
      case 'timeout_error':
        return '請減少同時操作的設備數量，或稍後重試';
      case 'device_error':
        return '請檢查設備狀態，確保設備可正常連接';
      case 'permission_error':
        return '請聯繫系統管理員檢查操作權限';
      case 'command_error':
        return '請檢查指令語法，確保指令格式正確';
      default:
        return '請稍後重試，如問題持續請聯繫技術支援';
    }
  }, []);

  // 處理執行錯誤的統一函數
  const handleExecutionError = useCallback((error: APIError | Error, context: ErrorContext) => {
    const errorInfo = logErrorWithContext(error, context);
    const retryAdvice = getRetryAdvice(errorInfo.category);
    
    return {
      ...errorInfo,
      retryAdvice,
      displayMessage: `${errorInfo.friendlyMessage}\n\n建議：${retryAdvice}`
    };
  }, [logErrorWithContext, getRetryAdvice]);

  // 處理批次執行錯誤
  const handleBatchExecutionError = useCallback((error: APIError | Error, deviceCount: number, mode: 'command' | 'ai') => {
    return handleExecutionError(error, {
      operation: '批次執行',
      deviceCount,
      mode
    });
  }, [handleExecutionError]);

  // 處理單一設備執行錯誤
  const handleSingleDeviceError = useCallback((error: APIError | Error, deviceIp: string, mode: 'command' | 'ai') => {
    return handleExecutionError(error, {
      operation: `單一設備執行 (${deviceIp})`,
      mode
    });
  }, [handleExecutionError]);

  // 處理 AI 查詢錯誤
  const handleAIQueryError = useCallback((error: APIError | Error) => {
    return handleExecutionError(error, {
      operation: 'AI 查詢',
      mode: 'ai'
    });
  }, [handleExecutionError]);

  // 檢查錯誤是否可重試
  const isRetryableError = useCallback((errorCategory: string): boolean => {
    const retryableErrors = ['network_error', 'timeout_error', 'unknown_error'];
    return retryableErrors.includes(errorCategory);
  }, []);

  // 獲取錯誤的嚴重程度
  const getErrorSeverity = useCallback((errorCategory: string): 'low' | 'medium' | 'high' | 'critical' => {
    switch (errorCategory) {
      case 'network_error':
      case 'timeout_error':
        return 'medium';
      case 'authentication_failed':
      case 'permission_error':
        return 'high';
      case 'quota_exceeded':
        return 'critical';
      case 'device_error':
      case 'command_error':
        return 'low';
      default:
        return 'medium';
    }
  }, []);

  return {
    // 核心錯誤處理方法
    handleExecutionError,
    handleBatchExecutionError,
    handleSingleDeviceError,
    handleAIQueryError,
    
    // 錯誤分析方法
    getFriendlyErrorMessage,
    categorizeError,
    getRetryAdvice,
    isRetryableError,
    getErrorSeverity,
    
    // 日誌記錄
    logErrorWithContext
  };
};