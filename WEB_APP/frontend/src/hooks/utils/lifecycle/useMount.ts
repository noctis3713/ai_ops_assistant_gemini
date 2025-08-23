/**
 * useMount - 組件掛載時執行函數
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 
 * @param fn - 要在組件掛載時執行的函數
 * 
 * @example
 * ```tsx
 * import { useMount } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   useMount(() => {
 *     console.log('Component mounted');
 *   });
 *   
 *   return <div>Hello World</div>;
 * };
 * ```
 */
import { useEffect } from 'react';

export function useMount(fn: () => void): void {
  useEffect(() => {
    fn?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}