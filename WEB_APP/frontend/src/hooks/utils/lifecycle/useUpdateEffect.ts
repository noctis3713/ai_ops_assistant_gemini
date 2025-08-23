/**
 * useUpdateEffect - 跳過首次渲染的 useEffect
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 只在依賴更新時執行，忽略初次掛載
 * 
 * @param effect - effect 回調函數
 * @param deps - 依賴陣列
 * 
 * @example
 * ```tsx
 * import { useUpdateEffect } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const [count, setCount] = useState(0);
 *   
 *   useUpdateEffect(() => {
 *     console.log('count updated:', count); // 首次渲染不會執行
 *   }, [count]);
 *   
 *   return (
 *     <div>
 *       <div>Count: {count}</div>
 *       <button onClick={() => setCount(c => c + 1)}>+</button>
 *     </div>
 *   );
 * };
 * ```
 */
import { useEffect, useRef, type DependencyList } from 'react';

export function useUpdateEffect(
  effect: React.EffectCallback,
  deps?: DependencyList,
): void {
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
    } else {
      return effect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}