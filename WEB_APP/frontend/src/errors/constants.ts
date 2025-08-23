/**
 * 錯誤處理常數定義
 * 將共享常數分離到單獨檔案，避免 react-refresh 警告
 */

// 匯出模組，避免 react-refresh 警告
export const ERROR_HANDLER_CONSTANTS = {
  DEFAULT_AUTO_CLOSE_DELAY: 5000,
  MAX_RETRY_ATTEMPTS: 3,
  BATCH_LOG_SIZE: 10,
  LOG_FLUSH_INTERVAL: 30000,
} as const;