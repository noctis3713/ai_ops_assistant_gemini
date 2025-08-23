/**
 * 防抖搜尋自定義 Hook
 * 提供搜尋關鍵字的防抖處理功能，避免頻繁觸發搜尋請求
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimer } from './useTimer';
import { useDebounceFn } from '@/hooks';
import { TIMER_DELAYS } from '@/config';
import { useMemoizedFn } from '@/hooks';

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
  const { clearTimer } = useTimer();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 使用統一的防抖函數處理搜索邏輯 - 自動清理記憶體
  const { run: debouncedSearch, cancel: cancelSearch } = useDebounceFn(
    (term: string) => {
      setDebouncedSearchTerm(term);
      if (onDebouncedChange) {
        onDebouncedChange(term);
      }
    },
    { 
      wait: delay,
      leading: false,
      trailing: true 
    }
  );

  // 當搜索詞變化時觸發防抖
  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  // 使用 ref 存儲回調，避免依賴變化 - 優化版本
  const onAutoExpandRef = useRef(onAutoExpand);
  const clearTimerRef = useRef(clearTimer);

  // 更新 ref 值
  useEffect(() => {
    onAutoExpandRef.current = onAutoExpand;
  }, [onAutoExpand]);

  useEffect(() => {
    clearTimerRef.current = clearTimer;
  }, [clearTimer]);

  // 處理搜尋輸入變更 - 無依賴版本
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    // 當輸入搜尋關鍵字時觸發自動展開
    if (value.trim() && onAutoExpandRef.current) {
      onAutoExpandRef.current();
    }
  }, []); // 無依賴！

  // 清除搜尋 - 使用 useMemoizedFn 確保函數引用穩定
  const clearSearch = useMemoizedFn(() => {
    setSearchTerm('');
    // 使用增強版防抖的取消功能
    cancelSearch();
    // 清除舊版計時器（向下相容）
    if (searchTimeoutRef.current && clearTimerRef.current) {
      clearTimerRef.current(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  });

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
    clearSearch,
    handleSearchChange,
  };
};