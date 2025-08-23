/**
 * useLatest - 獲取最新值的 ref
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 用於在異步操作中獲取最新的狀態值，避免閉包問題
 * 
 * @param value - 需要保持最新引用的值
 * @returns ref 對象，current 屬性總是包含最新值
 * 
 * @example
 * ```tsx
 * import { useLatest } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const [count, setCount] = useState(0);
 *   const latestCount = useLatest(count);
 *   
 *   const handleAsyncOperation = () => {
 *     setTimeout(() => {
 *       // 總是能獲取到最新的 count 值
 *       console.log('Latest count:', latestCount.current);
 *     }, 1000);
 *   };
 *   
 *   return (
 *     <div>
 *       <div>Count: {count}</div>
 *       <button onClick={() => setCount(c => c + 1)}>+</button>
 *       <button onClick={handleAsyncOperation}>Async Log</button>
 *     </div>
 *   );
 * };
 * ```
 */
import { useRef, type MutableRefObject } from 'react';

export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  
  return ref;
}