/**
 * useUnmount - 組件卸載時執行函數
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 使用 useRef 避免閉包問題，確保執行最新的函數
 * 
 * @param fn - 要在組件卸載時執行的函數
 * 
 * @example
 * ```tsx
 * import { useUnmount } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   useUnmount(() => {
 *     console.log('Component unmounted');
 *     // 清理邏輯，如取消訂閱、清除計時器等
 *   });
 *   
 *   return <div>Hello World</div>;
 * };
 * ```
 */
import { useEffect, useRef } from 'react';

export function useUnmount(fn: () => void): void {
  const fnRef = useRef(fn);
  
  // 總是更新到最新的函數引用
  fnRef.current = fn;

  useEffect(() => {
    return () => {
      fnRef.current?.();
    };
  }, []);
}