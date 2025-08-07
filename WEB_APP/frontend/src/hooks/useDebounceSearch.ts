/**
 * 防抖搜尋自定義 Hook
 * 提供搜尋關鍵字的防抖處理功能，避免頻繁觸發搜尋請求
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimer } from './useTimer';
import { TIMER_DELAYS } from '@/constants';

interface UseDebounceSearchOptions {
  /** 防抖延遲時間（毫秒） */
  delay?: number;
  /** 自動展開回調（當有搜尋內容時觸發） */
  onAutoExpand?: () => void;
  /** 防抖搜尋變更回調 */
  onDebouncedChange?: (debouncedValue: string) => void;
}

interface UseDebounceSearchReturn {
  /** 當前搜尋關鍵字 */
  searchTerm: string;
  /** 防抖後的搜尋關鍵字 */
  debouncedSearchTerm: string;
  /** 更新搜尋關鍵字 */
  setSearchTerm: (value: string) => void;
  /** 清除搜尋 */
  clearSearch: () => void;
  /** 處理搜尋輸入變更 */
  handleSearchChange: (value: string) => void;
}

/**
 * 防抖搜尋自定義 Hook
 * 
 * @param options 配置選項
 * @returns 搜尋相關的狀態和處理函數
 * 
 * @example
 * ```tsx
 * const {
 *   searchTerm,
 *   debouncedSearchTerm,
 *   handleSearchChange,
 *   clearSearch
 * } = useDebounceSearch({
 *   delay: 500,
 *   onAutoExpand: () => setExpanded(true),
 *   onDebouncedChange: (value) => performSearch(value)
 * });
 * ```
 */
export const useDebounceSearch = (options: UseDebounceSearchOptions = {}): UseDebounceSearchReturn => {
  const {
    delay = TIMER_DELAYS.DEBOUNCE_DEFAULT,
    onAutoExpand,
    onDebouncedChange
  } = options;

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  
  // Timer 工具用於防抖
  const { setTimeout: setTimeoutSafe, clearTimer } = useTimer();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖搜索邏輯 - 只有當用戶停止輸入後才執行實際搜索
  useEffect(() => {
    // 清除之前的定時器
    if (searchTimeoutRef.current) {
      clearTimer(searchTimeoutRef.current);
    }
    
    // 設置新的防抖定時器
    searchTimeoutRef.current = setTimeoutSafe(() => {
      setDebouncedSearchTerm(searchTerm);
      if (onDebouncedChange) {
        onDebouncedChange(searchTerm);
      }
    }, delay);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimer(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, delay, setTimeoutSafe, clearTimer, onDebouncedChange]);

  // 處理搜尋輸入變更
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    // 當輸入搜尋關鍵字時觸發自動展開
    if (value.trim() && onAutoExpand) {
      onAutoExpand();
    }
  }, [onAutoExpand]);

  // 清除搜尋
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    // 清除防抖計時器
    if (searchTimeoutRef.current) {
      clearTimer(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, [clearTimer]);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
    clearSearch,
    handleSearchChange,
  };
};