/**
 * 設備搜尋框組件
 * 提供防抖搜尋功能，支援清除搜尋內容
 * 使用 useDebounceSearch 自定義 Hook 處理防抖邏輯
 */
import React, { useEffect } from 'react';
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
  // 使用自定義 Hook 處理防抖搜尋邏輯
  const {
    searchTerm: internalSearchTerm,
    handleSearchChange: internalHandleSearchChange,
    clearSearch: internalClearSearch
  } = useDebounceSearch({
    onAutoExpand,
    onDebouncedChange: onDebouncedSearchChange
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
        className={className}
      />
      {internalSearchTerm && (
        <button
          onClick={handleClearSearch}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-terminal-text-muted hover:text-terminal-text-secondary"
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