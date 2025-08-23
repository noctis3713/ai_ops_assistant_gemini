/**
 * useDebounce - 防抖值 hook
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 延遲更新值直到指定時間內沒有新的更改
 * 
 * @param value - 需要防抖的值
 * @param delay - 防抖延遲時間（毫秒）
 * @returns 防抖後的值
 * 
 * @example
 * ```tsx
 * import { useDebounce } from '@/hooks/utils';
 * 
 * const SearchInput = () => {
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 500);
 *   
 *   // 只有在用戶停止輸入 500ms 後才會觸發搜索
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       performSearch(debouncedQuery);
 *     }
 *   }, [debouncedQuery]);
 *   
 *   return (
 *     <input
 *       value={query}
 *       onChange={e => setQuery(e.target.value)}
 *       placeholder="搜索..."
 *     />
 *   );
 * };
 * ```
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}