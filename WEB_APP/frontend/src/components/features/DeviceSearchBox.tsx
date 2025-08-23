/**
 * 設備搜尋框組件 (React 19 優化版)
 * 提供防抖搜尋功能，支援清除搜尋內容
 * 使用 useDeferredValue 和 useDebounceSearch 處理搜尋邏輯
 */
import React, { useEffect, useDeferredValue } from 'react';
import { useDebounceSearch } from '@/hooks';

interface DeviceSearchBoxProps {
  /** 搜尋關鍵字 */
  searchTerm: string;
  /** 搜尋變更回調 */
  onSearchChange: (value: string) => void;
  /** 防抖搜尋變更回調 */
  onDebouncedSearchChange: (value: string) => void;
  /** 清除搜尋回調 */
  onClearSearch: () => void;
  /** 是否自動展開列表（當有搜尋內容時） */
  onAutoExpand?: () => void;
  /** 輸入框佔位符 */
  placeholder?: string;
  /** 自定義樣式類別 */
  className?: string;
}

const DeviceSearchBox: React.FC<DeviceSearchBoxProps> = ({
  searchTerm: externalSearchTerm,
  onSearchChange: externalOnSearchChange,
  onDebouncedSearchChange,
  onClearSearch: externalOnClearSearch,
  onAutoExpand,
  placeholder = "搜尋設備名稱、IP、型號或描述...",
  className = "form-input pr-10"
}) => {
  // React 19: 使用 useDeferredValue 延遲搜尋結果更新
  const deferredSearchTerm = useDeferredValue(externalSearchTerm);
  // 檢查搜尋內容是否為過時狀態
  const isStale = externalSearchTerm !== deferredSearchTerm;
  // 使用自定義 Hook 處理防抖搜尋邏輯
  const {
    searchTerm: internalSearchTerm,
    handleSearchChange: internalHandleSearchChange,
    clearSearch: internalClearSearch
  } = useDebounceSearch({
    onAutoExpand,
    // React 19: 使用延遲的搜尋詞進行實際查詢
    onDebouncedChange: (term) => onDebouncedSearchChange(term)
  });

  // 同步外部和內部搜尋狀態
  useEffect(() => {
    if (externalSearchTerm !== internalSearchTerm) {
      internalHandleSearchChange(externalSearchTerm);
    }
  }, [externalSearchTerm, internalSearchTerm, internalHandleSearchChange]);

  // 處理輸入變更
  const handleInputChange = (value: string) => {
    internalHandleSearchChange(value);
    externalOnSearchChange(value);
  };

  // 處理清除搜尋
  const handleClearSearch = () => {
    internalClearSearch();
    externalOnClearSearch();
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={internalSearchTerm}
        onChange={(e) => handleInputChange(e.target.value)}
        className={`${className} ${isStale ? 'opacity-75 transition-opacity duration-200' : ''}`}
        style={{
          // React 19: 視覺指示過時狀態
          opacity: isStale ? 0.75 : 1,
          transition: 'opacity 0.2s ease-in-out'
        }}
      />
      {/* React 19: 新增搜尋狀態指示器 */}
      {isStale && (
        <div className="absolute right-8 top-1/2 transform -translate-y-1/2 text-terminal-text-muted">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
      {internalSearchTerm && (
        <button
          onClick={handleClearSearch}
          className={`absolute top-1/2 transform -translate-y-1/2 text-terminal-text-muted hover:text-terminal-text-secondary ${
            isStale ? 'right-12' : 'right-3'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default React.memo(DeviceSearchBox);