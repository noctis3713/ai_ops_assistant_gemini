/**
 * useSearchDebounce - 搜尋防抖 Hook
 * 專為搜尋功能優化，結合快取機制和防抖處理
 * 參考 ahooks 最佳實踐實現
 * 
 * @param searchCallback - 搜尋回調函數
 * @param options - 配置選項
 * @returns 搜尋控制對象
 * 
 * @example
 * ```tsx
 * import { useSearchDebounce } from '@/hooks';
 * 
 * const SearchComponent = () => {
 *   const [results, setResults] = useState([]);
 *   
 *   const { run: handleSearch, cancel, clearCache } = useSearchDebounce(
 *     async (query: string) => {
 *       const searchResults = await searchAPI(query);
 *       setResults(searchResults);
 *     },
 *     { 
 *       wait: 500,
 *       minLength: 2,
 *       enableCache: true 
 *     }
 *   );
 *   
 *   return (
 *     <div>
 *       <input 
 *         onChange={(e) => handleSearch(e.target.value)} 
 *         placeholder="搜尋..."
 *       />
 *       <button onClick={cancel}>取消搜尋</button>
 *       <button onClick={clearCache}>清除快取</button>
 *     </div>
 *   );
 * };
 * ```
 */
import { useRef, useCallback } from 'react';
import { useDebounceFn } from '@/hooks';

interface SearchDebounceOptions {
  /** 等待時間，單位毫秒 */
  wait?: number;
  /** 最小搜尋長度 */
  minLength?: number;
  /** 是否啟用快取機制 */
  enableCache?: boolean;
}

export function useSearchDebounce(
  searchCallback: (query: string) => void | Promise<void>,
  options: SearchDebounceOptions = {}
): {
  run: (query: string) => void;
  cancel: () => void;
  flush: () => void;
  clearCache: () => void;
} {
  const {
    wait = 300,
    minLength = 2,
    enableCache = true
  } = options;

  const cacheRef = useRef<Set<string>>(new Set());
  
  const { run: debouncedSearch, cancel, flush } = useDebounceFn(
    async (query: string) => {
      // 檢查快取，避免重複搜尋
      if (enableCache && cacheRef.current.has(query)) {
        return;
      }
      
      // 執行搜尋並加入快取
      if (enableCache) {
        cacheRef.current.add(query);
      }
      
      await searchCallback(query);
    },
    { 
      wait,
      leading: false,
      trailing: true 
    }
  );

  const run = useCallback((query: string) => {
    // 長度檢查
    if (query.length < minLength) {
      cancel();
      return;
    }
    
    debouncedSearch(query);
  }, [debouncedSearch, cancel, minLength]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    run,
    cancel,
    flush,
    clearCache,
  };
}