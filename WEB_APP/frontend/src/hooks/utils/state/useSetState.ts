/**
 * useSetState - 類似 class component 的 setState
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 支援物件狀態的部分更新
 * 
 * @param initialState - 初始狀態物件
 * @returns [state, setState] 陣列
 * 
 * @example
 * ```tsx
 * import { useSetState } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const [state, setState] = useSetState({
 *     name: 'Alice',
 *     age: 25,
 *     email: 'alice@example.com'
 *   });
 *   
 *   return (
 *     <div>
 *       <div>Name: {state.name}</div>
 *       <div>Age: {state.age}</div>
 *       <div>Email: {state.email}</div>
 *       
 *       <button onClick={() => setState({ age: state.age + 1 })}>
 *         Increase Age
 *       </button>
 *       
 *       <button onClick={() => setState(prev => ({ 
 *         email: `${prev.name.toLowerCase()}@company.com` 
 *       }))}>
 *         Update Email
 *       </button>
 *     </div>
 *   );
 * };
 * ```
 */
import { useState, useCallback } from 'react';

type SetState<S extends Record<string, unknown>> = <K extends keyof S>(
  state: Pick<S, K> | null | ((prevState: S) => Pick<S, K> | S | null)
) => void;

export function useSetState<S extends Record<string, unknown>>(
  initialState: S | (() => S)
): [S, SetState<S>] {
  const [state, setState] = useState<S>(initialState);

  const setMergedState = useCallback<SetState<S>>((patch) => {
    setState((prevState) => {
      const newState = typeof patch === 'function' ? patch(prevState) : patch;
      
      return newState ? Object.assign({}, prevState, newState) : prevState;
    });
  }, []);

  return [state, setMergedState];
}