/**
 * 全域錯誤邊界提供者
 * 整合現有 ErrorBoundary 功能，提供 Context API 和 React 19 新特性支援
 */

import React, { Component, useState, useCallback, useContext, type ReactNode } from 'react';
import { errorLogger } from './ErrorLogger';
import { ErrorClassifier } from './ErrorClassifier';
import { ErrorNotificationContainer } from './ErrorNotification';
import { ERROR_STYLES } from '@/config';
import { ErrorContext } from './context';
import type { 
  ErrorBoundaryState, 
  ErrorBoundaryProps, 
  ErrorContextValue, 
  UnifiedError 
} from './types';

/**
 * 錯誤上下文提供者組件
 */
export const ErrorContextProvider = ({ children }: { children: ReactNode }) => {
  const [errors, setErrors] = useState<UnifiedError[]>([]);

  const reportError = useCallback(async (error: unknown, context?: string): Promise<UnifiedError> => {
    const unifiedError = ErrorClassifier.classify(error, context);
    
    // 記錄到日誌系統
    errorLogger.logUnifiedError(unifiedError);
    
    // 添加到錯誤列表（用於顯示通知）
    setErrors(prev => [...prev, unifiedError]);
    
    return unifiedError;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const removeError = useCallback((index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const contextValue: ErrorContextValue = {
    reportError,
    clearErrors,
    errors,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      <ErrorNotificationContainer 
        errors={errors} 
        onRemoveError={removeError} 
      />
    </ErrorContext.Provider>
  );
};

// 移動到單獨的檔案以避免 react-refresh 警告

/**
 * 增強的錯誤邊界組件
 * 整合原有 ErrorBoundary 功能並加入 Context 支援
 */
class EnhancedErrorBoundary extends Component<
  ErrorBoundaryProps & { onUnifiedError?: (error: UnifiedError) => void },
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps & { onUnifiedError?: (error: UnifiedError) => void }) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // 使用統一錯誤處理
    const unifiedError = ErrorClassifier.classify(error, 'React Error Boundary');
    
    // 記錄到錯誤日誌系統
    errorLogger.logReactError(error, errorInfo, {
      category: unifiedError.category,
      severity: unifiedError.severity,
      userMessage: unifiedError.userMessage,
    });

    // 調用自定義錯誤處理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 調用統一錯誤處理器
    if (this.props.onUnifiedError) {
      this.props.onUnifiedError(unifiedError);
    }

    // 開發環境詳細日誌
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 React Error Boundary - 錯誤詳情');
      console.error('錯誤訊息:', error.message);
      console.error('錯誤堆疊:', error.stack);
      console.error('組件堆疊:', errorInfo.componentStack);
      console.error('統一錯誤物件:', unifiedError);
      console.groupEnd();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && resetOnPropsChange) {
      if (resetKeys) {
        const hasResetKeyChanged = resetKeys.some(
          (resetKey, idx) => prevProps.resetKeys?.[idx] !== resetKey
        );
        if (hasResetKeyChanged) {
          this.resetErrorBoundary();
        }
      }
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleRetry = () => {
    this.resetErrorBoundary();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="min-h-screen bg-terminal-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200">
            <div className="p-6">
              {/* 錯誤圖示和標題 */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">應用程式發生錯誤</h3>
                  <p className="text-sm text-gray-500">頁面遇到了意外錯誤</p>
                </div>
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className={`mb-4 p-3 ${ERROR_STYLES.CONTAINER_ROUNDED}`}>
                  <p className="text-sm text-red-700 font-medium mb-1">錯誤詳情:</p>
                  <p className="text-xs text-red-600 font-mono break-all">
                    {error.message}
                  </p>
                </div>
              )}

              {/* 操作按鈕 */}
              <div className="flex space-x-3">
                <button
                  onClick={this.handleRetry}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  重試
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  重新載入
                </button>
              </div>

              {/* 開發環境詳細資訊 */}
              {process.env.NODE_ENV === 'development' && errorInfo && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    開發者資訊 (點擊展開)
                  </summary>
                  <div className="mt-2 p-2 bg-gray-100 border rounded text-xs font-mono text-gray-700 max-h-32 overflow-y-auto">
                    <div className="mb-2">
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                    </div>
                    {error?.stack && (
                      <div>
                        <strong>Error Stack:</strong>
                        <pre className="whitespace-pre-wrap">{error.stack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * 全域錯誤邊界提供者
 * 結合錯誤邊界和錯誤上下文功能
 */
export const ErrorBoundaryProvider = ({ 
  children, 
  ...errorBoundaryProps 
}: ErrorBoundaryProps) => {
  return (
    <ErrorContextProvider>
      <ErrorBoundaryProviderInner {...errorBoundaryProps}>
        {children}
      </ErrorBoundaryProviderInner>
    </ErrorContextProvider>
  );
};

/**
 * 內部錯誤邊界提供者（需要在 ErrorContextProvider 內部）
 */
const ErrorBoundaryProviderInner = ({ 
  children, 
  ...errorBoundaryProps 
}: ErrorBoundaryProps) => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('ErrorBoundaryProviderInner must be used within an ErrorContextProvider');
  }
  const { reportError } = context;

  const handleUnifiedError = useCallback((error: UnifiedError) => {
    // 錯誤已經通過 reportError 處理，這裡可以添加額外邏輯
    console.warn('ErrorBoundary 捕獲到統一錯誤:', error);
    // 可以在這裡觸發額外的錯誤處理邏輯
    reportError(error.originalError || new Error(error.message), error.context);
  }, [reportError]);

  return (
    <EnhancedErrorBoundary 
      {...errorBoundaryProps} 
      onUnifiedError={handleUnifiedError}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};

// 為了向後相容，也匯出原有的 ErrorBoundary
export const ErrorBoundary = EnhancedErrorBoundary;

// export default ErrorBoundaryProvider;