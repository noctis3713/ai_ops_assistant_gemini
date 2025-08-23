/**
 * 統一錯誤通知組件
 * 提供一致的錯誤顯示 UI，支援不同嚴重等級和自動關閉
 */

import { useEffect, useState, useCallback } from 'react';
// import { ERROR_STYLES } from '@/config'; // 暫未使用
import type { ErrorNotificationProps, UnifiedError, ErrorSeverity } from './types';

/**
 * 錯誤嚴重等級樣式映射
 */
const getSeverityStyles = (severity: ErrorSeverity) => {
  const baseClasses = "p-4 rounded-lg border-l-4 shadow-md transition-all duration-300";
  
  switch (severity) {
    case 'low':
      return `${baseClasses} bg-blue-50 border-blue-400 text-blue-700`;
    case 'medium':
      return `${baseClasses} bg-yellow-50 border-yellow-400 text-yellow-700`;
    case 'high':
      return `${baseClasses} bg-orange-50 border-orange-400 text-orange-700`;
    case 'critical':
      return `${baseClasses} bg-red-50 border-red-400 text-red-700`;
    default:
      return `${baseClasses} bg-gray-50 border-gray-400 text-gray-700`;
  }
};

/**
 * 錯誤圖示組件
 */
const ErrorIcon = ({ severity }: { severity: ErrorSeverity }) => {
  const getIconColor = () => {
    switch (severity) {
      case 'low': return 'text-blue-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="flex-shrink-0">
      <svg
        className={`w-5 h-5 ${getIconColor()}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {severity === 'critical' ? (
          // 嚴重錯誤使用 X 圖示
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        ) : severity === 'high' ? (
          // 高等級錯誤使用警告圖示
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        ) : (
          // 其他等級使用資訊圖示
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        )}
      </svg>
    </div>
  );
};

/**
 * 錯誤通知組件
 */
export const ErrorNotification = ({ 
  error, 
  visible, 
  onClose, 
  autoCloseDelay = 5000 
}: ErrorNotificationProps) => {
  const [isVisible, setIsVisible] = useState(visible);
  const [isAnimating, setIsAnimating] = useState(false);

  // 自動關閉計時器
  useEffect(() => {
    if (visible && autoCloseDelay > 0 && error.severity !== 'critical') {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [visible, autoCloseDelay, error.severity, handleClose]);

  // 處理顯示狀態變化
  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      // 延遲觸發動畫，確保元素已渲染
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      // 等待動畫完成後隱藏元素
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  }, [onClose]);

  // 重試功能（如果錯誤支援重試）
  const handleRetry = useCallback(() => {
    // 這裡可以觸發重試邏輯，暫時只關閉通知
    handleClose();
  }, [handleClose]);

  if (!isVisible) return null;

  const containerClasses = `
    fixed top-4 right-4 z-50 max-w-md w-full transform transition-all duration-300 ease-in-out
    ${isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
  `;

  return (
    <div className={containerClasses}>
      <div className={getSeverityStyles(error.severity)}>
        {/* 錯誤標題區域 */}
        <div className="flex items-start space-x-3">
          <ErrorIcon severity={error.severity} />
          
          <div className="flex-1 min-w-0">
            {/* 錯誤標題 */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium truncate">
                {error.category.toUpperCase()} 錯誤
              </h4>
              <button
                onClick={handleClose}
                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="關閉通知"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 錯誤訊息 */}
            <p className="text-sm mt-1 break-words">
              {error.userMessage}
            </p>

            {/* 上下文資訊 */}
            {error.context && (
              <p className="text-xs mt-1 opacity-75">
                上下文: {error.context}
              </p>
            )}

            {/* 操作按鈕 */}
            <div className="flex items-center space-x-2 mt-3">
              {error.retryable && (
                <button
                  onClick={handleRetry}
                  className="text-xs px-2 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
                >
                  重試
                </button>
              )}
              
              {process.env.NODE_ENV === 'development' && error.originalError && (
                <details className="text-xs">
                  <summary className="cursor-pointer hover:underline">
                    開發者資訊
                  </summary>
                  <div className="mt-1 p-2 bg-black bg-opacity-10 rounded text-xs font-mono">
                    <div className="mb-1">
                      <strong>原始錯誤:</strong> {error.originalError.message}
                    </div>
                    {error.originalError.stack && (
                      <div>
                        <strong>堆疊追蹤:</strong>
                        <pre className="whitespace-pre-wrap text-xs mt-1 max-h-20 overflow-y-auto">
                          {error.originalError.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 錯誤通知容器組件
 * 管理多個錯誤通知的顯示
 */
export const ErrorNotificationContainer = ({ 
  errors, 
  onRemoveError 
}: { 
  errors: UnifiedError[]; 
  onRemoveError: (index: number) => void;
}) => {
  return (
    <>
      {errors.map((error, index) => (
        <ErrorNotification
          key={`${error.timestamp}-${index}`}
          error={error}
          visible={true}
          onClose={() => onRemoveError(index)}
          autoCloseDelay={error.severity === 'critical' ? 0 : 5000}
        />
      ))}
    </>
  );
};

export default ErrorNotification;