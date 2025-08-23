/**
 * useUpdate - 強制組件重新渲染
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 返回一個函數，調用後會強制組件重新渲染
 * 
 * @returns 觸發重新渲染的函數
 * 
 * @example
 * ```tsx
 * import { useUpdate } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const update = useUpdate();
 *   
 *   return (
 *     <div>
 *       <div>Current time: {Date.now()}</div>
 *       <button onClick={update}>Force Update</button>
 *     </div>
 *   );
 * };
 * ```
 * 
 * @example
 * // 在某些複雜場景下手動觸發更新
 * ```tsx
 * const ComplexComponent = () => {
 *   const update = useUpdate();
 *   const dataRef = useRef(complexData);
 *   
 *   const handleComplexUpdate = () => {
 *     // 直接修改 ref 數據
 *     dataRef.current.someProperty = newValue;
 *     
 *     // 手動觸發重新渲染
 *     update();
 *   };
 *   
 *   return <div>{dataRef.current.someProperty}</div>;
 * };
 * ```
 */
import { useCallback, useState } from 'react';

export function useUpdate(): () => void {
  const [, setState] = useState({});

  return useCallback(() => setState({}), []);
}