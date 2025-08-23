/**
 * useDebounceFn - 防抖函數 Hook
 * 參考 ahooks 最佳實踐實現
 * 用於防抖函數執行，而非防抖值更新
 * 
 * @param fn - 需要防抖的函數
 * @param options - 防抖配置選項
 * @returns 防抖控制對象
 * 
 * @example
 * ```tsx
 * import { useDebounceFn } from '@/hooks/utils';
 * 
 * const SearchComponent = () => {
 *   const { run: debouncedSearch, cancel, flush } = useDebounceFn(
 *     async (query: string) => {
 *       const results = await searchAPI(query);
 *       setResults(results);
 *     },
 *     { wait: 500, leading: false, trailing: true }
 *   );
 *   
 *   return (
 *     <div>
 *       <input onChange={(e) => debouncedSearch(e.target.value)} />
 *       <button onClick={cancel}>取消</button>
 *       <button onClick={flush}>立即執行</button>
 *     </div>
 *   );
 * };
 * ```
 */
import { useRef, useCallback } from 'react';
import { useMemoizedFn, useLatest } from '@/hooks';

interface DebounceFnOptions {
  /** 等待時間，單位毫秒 */
  wait?: number;
  /** 是否在延遲開始前調用函數 */
  leading?: boolean;
  /** 是否在延遲結束後調用函數 */
  trailing?: boolean;
  /** 最大等待時間，單位毫秒 */
  maxWait?: number;
}

export function useDebounceFn<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: DebounceFnOptions = {}
): {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
} {
  const {
    wait = 1000,
    leading = false,
    trailing = true,
    maxWait
  } = options;

  const fnRef = useLatest(fn);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const argsRef = useRef<Parameters<T>>();
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const invokedRef = useRef(false);
  const leadingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const invoke = useCallback(() => {
    const args = argsRef.current;
    if (args) {
      fnRef.current(...args);
    }
    invokedRef.current = true;
    clearTimers();
  }, [fnRef, clearTimers]);

  const run = useMemoizedFn((...args: Parameters<T>) => {
    argsRef.current = args;
    
    // Leading edge
    if (leading && !leadingRef.current) {
      leadingRef.current = true;
      invoke();
      return;
    }

    clearTimers();

    // 設置主要的防抖計時器
    if (trailing) {
      timerRef.current = setTimeout(() => {
        if (!invokedRef.current) {
          invoke();
        }
        leadingRef.current = false;
        invokedRef.current = false;
      }, wait);
    }

    // 設置最大等待計時器
    if (maxWait && !maxTimerRef.current) {
      maxTimerRef.current = setTimeout(() => {
        invoke();
        leadingRef.current = false;
        invokedRef.current = false;
      }, maxWait);
    }
  });

  const cancel = useMemoizedFn(() => {
    clearTimers();
    leadingRef.current = false;
    invokedRef.current = false;
  });

  const flush = useMemoizedFn(() => {
    if (timerRef.current || maxTimerRef.current) {
      invoke();
      leadingRef.current = false;
      invokedRef.current = false;
    }
  });

  return {
    run,
    cancel,
    flush,
  };
}