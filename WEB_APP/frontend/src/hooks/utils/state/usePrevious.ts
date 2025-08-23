/**
 * usePrevious - 獲取上一次的值
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 用於比較當前值與上一次的值
 * 
 * @param state - 需要追蹤的狀態值
 * @param shouldUpdate - 可選的更新判斷函數
 * @returns 上一次的狀態值
 * 
 * @example
 * ```tsx
 * import { usePrevious } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const [count, setCount] = useState(0);
 *   const prevCount = usePrevious(count);
 *   
 *   return (
 *     <div>
 *       <div>Current: {count}</div>
 *       <div>Previous: {prevCount}</div>
 *       <button onClick={() => setCount(c => c + 1)}>+</button>
 *     </div>
 *   );
 * };
 * ```
 * 
 * @example
 * // 使用自定義更新條件
 * ```tsx
 * const Demo = () => {
 *   const [user, setUser] = useState({ name: 'Alice', age: 20 });
 *   const prevUser = usePrevious(
 *     user,
 *     (prev, next) => prev?.name !== next.name // 只有名字改變時才更新
 *   );
 *   
 *   return <div>Previous user: {prevUser?.name}</div>;
 * };
 * ```
 */
import { useRef } from 'react';

export function usePrevious<T>(
  state: T,
  shouldUpdate?: (prev: T | undefined, next: T) => boolean
): T | undefined {
  const prevRef = useRef<T>();
  const curRef = useRef<T>();

  const needUpdate = typeof shouldUpdate === 'function' 
    ? shouldUpdate(curRef.current, state)
    : !Object.is(curRef.current, state);

  if (needUpdate) {
    prevRef.current = curRef.current;
    curRef.current = state;
  }

  return prevRef.current;
}