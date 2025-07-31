// 工具函數
import { type ClassValue, clsx } from 'clsx';

// 類名合併工具函數
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// 重新匯出日誌功能
export { logger, log, LoggerService, LogLevel } from './logger';
export type { LogEntry, LoggerConfig } from './logger';