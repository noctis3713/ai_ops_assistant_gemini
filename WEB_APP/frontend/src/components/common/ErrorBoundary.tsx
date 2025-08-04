/**
 * React 錯誤邊界組件
 * 捕獲子組件中的 JavaScript 錯誤，防止整個應用程式崩潰
 */
import React, { Component, type ReactNode } from 'react';
import { logError } from '@/utils/SimpleLogger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 更新 state，下次渲染會顯示錯誤 UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 記錄錯誤詳情
    this.setState({
      error,
      errorInfo,
    });

    // 使用日誌系統記錄錯誤
    logError('React Error Boundary 捕獲錯誤', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // 調用自定義錯誤處理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 在開發環境中也記錄到控制台
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 React Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.groupEnd();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // 當 props 變化時重置錯誤狀態
    if (hasError && resetOnPropsChange) {
      if (resetKeys) {
        // 檢查指定的 key 是否有變化
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
    // 清除重置計時器
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
      // 如果提供了自定義 fallback，使用它
      if (fallback) {
        return fallback;
      }

      // 預設錯誤 UI
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
                  <h3 className="text-lg font-medium text-gray-900">頁面發生錯誤</h3>
                  <p className="text-sm text-gray-500">應用程式遇到了意外錯誤</p>
                </div>
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
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

export default ErrorBoundary;