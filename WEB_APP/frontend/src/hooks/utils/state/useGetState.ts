/**
 * useGetState - 獲取最新 state 的 getter 函數
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 解決在異步操作中獲取最新狀態的問題
 * 
 * @param initialState - 初始狀態值或初始化函數
 * @returns [state, setState, getState] 陣列
 * 
 * @example
 * ```tsx
 * import { useGetState } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const [count, setCount, getCount] = useGetState(0);
 *   
 *   const handleAsyncIncrement = () => {
 *     setTimeout(() => {
 *       // 總是能獲取到最新的 count 值
 *       setCount(getCount() + 1);
 *     }, 1000);
 *   };
 *   
 *   return (
 *     <div>
 *       <div>Count: {count}</div>
 *       <button onClick={() => setCount(c => c + 1)}>Sync +</button>
 *       <button onClick={handleAsyncIncrement}>Async +</button>
 *     </div>
 *   );
 * };
 * ```
 */
import { useState, useCallback, useRef } from 'react';

export function useGetState<S>(
  initialState: S | (() => S)
): [S, React.Dispatch<React.SetStateAction<S>>, () => S] {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  
  // 更新 ref 中的值
  stateRef.current = state;
  
  const getState = useCallback(() => stateRef.current, []);
  
  return [state, setState, getState];
}