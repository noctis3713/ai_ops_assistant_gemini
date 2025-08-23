/**
 * useUnmountedRef - 獲取組件是否已卸載的 ref
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 用於避免在組件卸載後執行狀態更新
 * 
 * @returns ref 對象，current 屬性表示組件是否已卸載
 * 
 * @example
 * ```tsx
 * import { useUnmountedRef } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const unmountedRef = useUnmountedRef();
 *   
 *   const fetchData = async () => {
 *     const data = await api.getData();
 *     
 *     // 檢查組件是否仍然掛載
 *     if (!unmountedRef.current) {
 *       setData(data);
 *     }
 *   };
 *   
 *   return <div>Demo Component</div>;
 * };
 * ```
 */
import { useEffect, useRef } from 'react';

export function useUnmountedRef(): { readonly current: boolean } {
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  return unmountedRef;
}