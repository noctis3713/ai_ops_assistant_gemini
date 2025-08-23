/**
 * 錯誤處理 Hooks 模組
 * 獨立的 hooks 檔案，避免 react-refresh 警告
 */

import { useContext } from 'react';
import { ErrorContext } from './context';
import type { ErrorContextValue } from './types';

/**
 * 使用錯誤上下文的 Hook
 */
export const useErrorContext = (): ErrorContextValue => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorContextProvider');
  }
  return context;
};

// 重新匯出其他 hooks
export { useErrorHandler, useLightErrorHandler } from './hooks/useErrorHandler';