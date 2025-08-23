import { useRef, useMemo } from 'react';

/**
 * useMemoizedFn - 持久化函數引用的 Hook
 * 參考 ahooks 實作，解決依賴地獄和重複渲染問題
 */
export function useMemoizedFn<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const fnRef = useRef<T>(fn);
  
  // 始終更新最新的函數引用
  fnRef.current = useMemo(() => fn, [fn]);
  
  // 創建穩定的函數引用
  const memoizedFn = useRef<T>();
  
  if (!memoizedFn.current) {
    memoizedFn.current = ((...args: Parameters<T>) => {
      return fnRef.current(...args);
    }) as T;
  }
  
  return memoizedFn.current;
}