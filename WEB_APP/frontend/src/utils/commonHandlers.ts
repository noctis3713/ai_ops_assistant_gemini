/**
 * 共用業務邏輯處理函數
 * 抽取組件間重複的處理邏輯，提升代碼復用性
 */

import { logSystemError } from '@/errors';

/**
 * 頁面重載處理器
 * 統一的頁面重載邏輯，可以在未來添加更多功能（如確認對話框等）
 */
export const handlePageReload = () => {
  window.location.reload();
};

/**
 * 錯誤重試處理器
 * 通用的錯誤重試邏輯，可以擴展為包含重試次數限制等
 */
export const handleRetry = (retryFn?: () => void) => {
  if (retryFn) {
    retryFn();
  } else {
    handlePageReload();
  }
};

/**
 * 複製到剪貼板處理器
 * 統一的複製邏輯，包含錯誤處理
 */
export const handleCopyToClipboard = async (content: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    logSystemError('複製失敗', { error: error instanceof Error ? error.message : String(error) });
    // 降級方案：使用傳統方法
    try {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      logSystemError('降級複製也失敗', { error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
      return false;
    }
  }
};

/**
 * 切換展開/收起狀態處理器
 * 通用的切換邏輯，適用於各種展開狀態管理
 */
export const createToggleHandler = <T>(
  currentSet: Set<T>,
  updateFn: (newSet: Set<T>) => void
) => {
  return (item: T) => {
    const newSet = new Set(currentSet);
    if (newSet.has(item)) {
      newSet.delete(item);
    } else {
      newSet.add(item);
    }
    updateFn(newSet);
  };
};

/**
 * 批次操作處理器工廠
 * 創建批次操作的處理函數（全選、全不選、反選等）
 */
export const createBatchHandler = <T>(
  allItems: T[],
  currentSelected: T[],
  updateFn: (selected: T[]) => void,
  keyExtractor?: (item: T) => string | number
) => {
  const getKey = keyExtractor || ((item: T) => item as unknown as string);
  const selectedKeys = new Set(currentSelected.map(getKey));
  const allKeys = new Set(allItems.map(getKey));
  
  return {
    selectAll: () => updateFn(allItems),
    selectNone: () => updateFn([]),
    invertSelection: () => {
      const inverted = allItems.filter(item => !selectedKeys.has(getKey(item)));
      updateFn(inverted);
    },
    isAllSelected: () => allKeys.size > 0 && [...allKeys].every(key => selectedKeys.has(key)),
    isNoneSelected: () => selectedKeys.size === 0,
    selectedCount: selectedKeys.size,
    totalCount: allKeys.size,
  };
};

/**
 * 搜尋結果處理器
 * 統一的搜尋結果處理邏輯
 */
export const createSearchResultHandler = <T>(
  allItems: T[],
  searchTerm: string,
  searchFields: (keyof T)[]
) => {
  const filteredItems = searchTerm
    ? allItems.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        })
      )
    : allItems;

  return {
    results: filteredItems,
    stats: {
      hasFilter: Boolean(searchTerm),
      filteredCount: filteredItems.length,
      totalCount: allItems.length,
      isFiltered: filteredItems.length !== allItems.length,
    },
  };
};

/**
 * 載入狀態處理器
 * 統一的載入狀態管理
 */
export const createLoadingHandler = () => {
  let timeoutId: NodeJS.Timeout;
  
  return {
    showLoading: (delay: number = 0) => {
      if (delay > 0) {
        timeoutId = setTimeout(() => {
          // 可以在這裡觸發載入狀態更新
        }, delay);
      }
    },
    hideLoading: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
  };
};