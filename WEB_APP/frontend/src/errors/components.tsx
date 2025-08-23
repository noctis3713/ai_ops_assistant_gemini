/**
 * 錯誤處理組件模組
 * 獨立的組件檔案，避免 react-refresh 警告
 */

// 重新匯出組件，避免混合匯出警告
export { ErrorBoundary } from './ErrorBoundaryProvider';
export { ErrorNotification, ErrorNotificationContainer } from './ErrorNotification';