/**
 * UI 樣式常數定義
 * 統一管理所有重複使用的樣式組合，提升一致性和維護性
 */

// 錯誤狀態樣式組合
export const ERROR_STYLES = {
  // 錯誤容器樣式 (淺紅背景 + 紅邊框)
  CONTAINER: 'bg-red-50 border border-red-200',
  // 錯誤容器樣式 + 圓角
  CONTAINER_ROUNDED: 'bg-red-50 border border-red-200 rounded',
  // 錯誤容器樣式 + 圓角 + 內距
  CONTAINER_ROUNDED_PADDED: 'bg-red-50 border border-red-200 rounded-lg p-4',
  // 錯誤按鈕樣式 (紅文字 + 淺紅背景)
  BUTTON: 'px-3 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded hover:bg-red-200 transition-colors',
  // 錯誤文字樣式
  TEXT: 'text-red-700',
  TEXT_DARKER: 'text-red-800',
  // 錯誤程式碼區塊樣式
  CODE_BLOCK: 'bg-red-50 border border-red-200 rounded p-3 text-sm font-mono text-red-800 whitespace-pre-wrap break-all max-w-none overflow-hidden',
} as const;

// 警告狀態樣式組合  
export const WARNING_STYLES = {
  // 警告容器樣式 (淺黃背景 + 黃邊框)
  CONTAINER: 'bg-amber-50 border border-amber-200',
  // 警告容器樣式 + 圓角
  CONTAINER_ROUNDED: 'bg-amber-50 border border-amber-200 rounded',
  // 警告容器樣式 + 圓角 + 內距
  CONTAINER_ROUNDED_PADDED: 'bg-amber-50 border border-amber-200 rounded-lg p-4',
  // 警告按鈕樣式 (黃文字 + 淺黃背景)
  BUTTON: 'px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded hover:bg-amber-200 transition-colors',
  // 警告文字樣式
  TEXT: 'text-amber-700',
  TEXT_DARKER: 'text-amber-800',
  // 警告程式碼區塊樣式
  CODE_BLOCK: 'bg-amber-50 border border-amber-200 rounded p-3 text-sm font-mono text-amber-800 whitespace-pre-wrap break-all max-w-none overflow-hidden',
  // 警告小標籤樣式
  BADGE: 'text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200',
} as const;

// 資訊狀態樣式組合
export const INFO_STYLES = {
  // 資訊容器樣式 (淺藍背景 + 藍邊框)
  CONTAINER: 'bg-blue-50 border border-blue-200',
  // 資訊容器樣式 + 圓角
  CONTAINER_ROUNDED: 'bg-blue-50 border border-blue-200 rounded',
  // 資訊容器樣式 + 圓角 + 內距
  CONTAINER_ROUNDED_PADDED: 'bg-blue-50 border border-blue-200 rounded-lg p-4',
  // 資訊按鈕樣式 (藍文字 + 淺藍背景)
  BUTTON: 'px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded hover:bg-blue-200 transition-colors',
  // 資訊文字樣式
  TEXT: 'text-blue-700',
  TEXT_DARKER: 'text-blue-800',
  // 資訊程式碼區塊樣式
  CODE_BLOCK: 'bg-blue-50 border border-blue-200 rounded p-3 text-sm font-mono text-blue-800 whitespace-pre-wrap break-all max-w-none overflow-hidden',
  // 選中狀態樣式 (用於選中的項目)
  SELECTED: 'bg-blue-50 border-l-4 border-l-blue-500',
} as const;

// 成功狀態樣式組合
export const SUCCESS_STYLES = {
  // 成功容器樣式 (淺綠背景 + 綠邊框)
  CONTAINER: 'bg-green-50 border border-green-200',
  // 成功容器樣式 + 圓角
  CONTAINER_ROUNDED: 'bg-green-50 border border-green-200 rounded',
  // 成功容器樣式 + 圓角 + 內距
  CONTAINER_ROUNDED_PADDED: 'bg-green-50 border border-green-200 rounded-lg p-4',
  // 成功按鈕樣式
  BUTTON: 'px-3 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded hover:bg-green-200 transition-colors',
  // 成功文字樣式
  TEXT: 'text-green-700',
  TEXT_DARKER: 'text-green-800',
} as const;

// 中性狀態樣式組合
export const NEUTRAL_STYLES = {
  // 一般容器樣式 (淺灰背景)
  CONTAINER: 'bg-gray-50',
  // 懸停樣式
  HOVER: 'hover:bg-gray-50',
  // 邊框樣式
  BORDER: 'border border-gray-200',
  // 文字樣式
  TEXT: 'text-gray-700',
  TEXT_MUTED: 'text-gray-500',
  // 程式碼區塊樣式 (中性灰色)
  CODE_BLOCK: 'bg-gray-50 border border-gray-200 rounded p-3 text-sm font-mono text-terminal-text-primary whitespace-pre-wrap break-all max-w-none overflow-hidden',
} as const;

// 組合樣式工具函數
export const combineStyles = (...styles: string[]): string => {
  return styles.filter(Boolean).join(' ');
};

// 狀態類型定義
export type AlertType = 'error' | 'warning' | 'info' | 'success';

// 根據狀態類型獲取對應樣式的工具函數
export const getAlertStyles = (type: AlertType) => {
  switch (type) {
    case 'error':
      return ERROR_STYLES;
    case 'warning':
      return WARNING_STYLES;
    case 'info':
      return INFO_STYLES;
    case 'success':
      return SUCCESS_STYLES;
    default:
      return INFO_STYLES;
  }
};