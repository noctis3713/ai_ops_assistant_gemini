/**
 * useThrottleFn - 節流函數 Hook
 * 參考 ahooks 最佳實踐實現
 * 用於節流函數執行，在指定時間內最多執行一次
 * 
 * @param fn - 需要節流的函數
 * @param options - 節流配置選項
 * @returns 節流控制對象
 * 
 * @example
 * ```tsx
 * import { useThrottleFn } from '@/hooks/utils';
 * 
 * const ScrollComponent = () => {
 *   const { run: throttledScroll, cancel, flush } = useThrottleFn(
 *     (scrollTop: number) => {
 *       console.log('Scroll position:', scrollTop);
 *       updateScrollIndicator(scrollTop);
 *     },
 *     { wait: 100, leading: true, trailing: false }
 *   );
 *   
 *   useEffect(() => {
 *     const handleScroll = (e: Event) => {
 *       throttledScroll((e.target as Element).scrollTop);
 *     };
 *     
 *     window.addEventListener('scroll', handleScroll);
 *     return () => window.removeEventListener('scroll', handleScroll);
 *   }, [throttledScroll]);
 *   
 *   return <div>Scroll content...</div>;
 * };
 * ```
 */
import { useRef, useCallback } from 'react';
import { useMemoizedFn, useLatest } from '@/hooks';

interface ThrottleFnOptions {
  /** 等待時間，單位毫秒 */
  wait?: number;
  /** 是否在延遲開始前調用函數 */
  leading?: boolean;
  /** 是否在延遲結束後調用函數 */
  trailing?: boolean;
}

export function useThrottleFn<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: ThrottleFnOptions = {}
): {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
} {
  const {
    wait = 1000,
    leading = true,
    trailing = true
  } = options;

  const fnRef = useLatest(fn);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const argsRef = useRef<Parameters<T>>();
  const previousRef = useRef(0);
  const invokedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const invoke = useCallback(() => {
    const args = argsRef.current;
    if (args) {
      fnRef.current(...args);
    }
    invokedRef.current = true;
    previousRef.current = Date.now();
    clearTimer();
  }, [fnRef, clearTimer]);

  const run = useMemoizedFn((...args: Parameters<T>) => {
    argsRef.current = args;
    const now = Date.now();
    const remaining = wait - (now - previousRef.current);

    // 首次調用或間隔時間已足夠
    if (previousRef.current === 0 || remaining <= 0 || remaining > wait) {
      if (leading) {
        invoke();
        return;
      } else {
        previousRef.current = now;
      }
    }

    // 清除之前的計時器
    clearTimer();

    // 設置 trailing 計時器
    if (trailing && remaining > 0) {
      timerRef.current = setTimeout(() => {
        if (!invokedRef.current) {
          invoke();
        }
        invokedRef.current = false;
      }, remaining);
    }

    invokedRef.current = false;
  });

  const cancel = useMemoizedFn(() => {
    clearTimer();
    previousRef.current = 0;
    invokedRef.current = false;
  });

  const flush = useMemoizedFn(() => {
    if (timerRef.current) {
      invoke();
      invokedRef.current = false;
    }
  });

  return {
    run,
    cancel,
    flush,
  };
}