/**
 * 搜尋結果提示組件
 * 顯示篩選後的設備數量統計
 */
import React from 'react';

interface SearchResultHintProps {
  /** 篩選統計資料 */
  filterStats: {
    hasFilter: boolean;
    filteredCount: number;
    totalCount: number;
  };
  /** 是否顯示（通常在列表展開時顯示） */
  isVisible: boolean;
  /** 自定義容器樣式 */
  className?: string;
}

const SearchResultHint: React.FC<SearchResultHintProps> = ({
  filterStats,
  isVisible,
  className = "text-xs text-terminal-text-secondary text-center"
}) => {
  // 如果不可見或沒有篩選條件，不顯示提示
  if (!isVisible || !filterStats.hasFilter) {
    return null;
  }

  return (
    <div className={className}>
      搜尋到 {filterStats.filteredCount} 個設備（共 {filterStats.totalCount} 個）
    </div>
  );
};

export default React.memo(SearchResultHint);