/**
 * useRafThrottle - RAF 節流 Hook
 * 參考 ahooks 最佳實踐實現
 * 使用 requestAnimationFrame 進行節流，適合動畫和滾動事件
 * 
 * @param fn - 需要節流的函數
 * @param deps - 依賴列表
 * @returns 節流控制對象
 * 
 * @example
 * ```tsx
 * import { useRafThrottle } from '@/hooks';
 * 
 * const ScrollHandler = () => {
 *   const { run: handleScroll, cancel } = useRafThrottle(
 *     (event: Event) => {
 *       console.log('Scroll event:', (event.target as Element).scrollTop);
 *       updateScrollIndicator((event.target as Element).scrollTop);
 *     }
 *   );
 *   
 *   useEffect(() => {
 *     window.addEventListener('scroll', handleScroll);
 *     return () => {
 *       window.removeEventListener('scroll', handleScroll);
 *       cancel();
 *     };
 *   }, [handleScroll, cancel]);
 *   
 *   return <div>Scroll content...</div>;
 * };
 * ```
 */
import { useRef, useCallback, useEffect } from 'react';
import { useMemoizedFn } from '@/hooks';

export function useRafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T
): {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
} {
  const rafIdRef = useRef<number | null>(null);
  const argsRef = useRef<Parameters<T>>();
  const fnRef = useRef(fn);

  // 始終保持最新的函數引用
  useEffect(() => {
    fnRef.current = fn;
  });

  const cancel = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    argsRef.current = undefined;
  }, []);

  const run = useMemoizedFn((...args: Parameters<T>) => {
    argsRef.current = args;
    
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        const currentArgs = argsRef.current;
        if (currentArgs) {
          fnRef.current(...currentArgs);
        }
        rafIdRef.current = null;
        argsRef.current = undefined;
      });
    }
  });

  // 清理副作用
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    run,
    cancel,
  };
}