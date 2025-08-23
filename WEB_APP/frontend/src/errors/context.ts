/**
 * 錯誤處理上下文
 * 獨立的上下文檔案，避免 react-refresh 警告
 */

import { createContext } from 'react';
import type { ErrorContextValue } from './types';

/**
 * 錯誤上下文
 */
export const ErrorContext = createContext<ErrorContextValue | null>(null);