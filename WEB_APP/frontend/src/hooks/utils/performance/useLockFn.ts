/**
 * useLockFn - 鎖定異步函數避免重複執行
 * 參考 ahooks 最佳實踐實現
 * 防止在異步函數執行過程中被重複調用
 * 
 * @param fn - 需要鎖定的異步函數
 * @returns 鎖定後的函數
 * 
 * @example
 * ```tsx
 * import { useLockFn } from '@/hooks/utils';
 * 
 * const SubmitForm = () => {
 *   const [loading, setLoading] = useState(false);
 *   
 *   const submitForm = useLockFn(async (data) => {
 *     setLoading(true);
 *     try {
 *       await api.submitForm(data);
 *       message.success('提交成功');
 *     } catch (error) {
 *       message.error('提交失敗');
 *     } finally {
 *       setLoading(false);
 *     }
 *   });
 *   
 *   return (
 *     <button 
 *       onClick={() => submitForm(formData)}
 *       disabled={loading}
 *     >
 *       {loading ? '提交中...' : '提交'}
 *     </button>
 *   );
 * };
 * ```
 */
import { useRef, useCallback } from 'react';

export function useLockFn<P extends unknown[] = unknown[], V = unknown>(
  fn: (...args: P) => Promise<V>
): (...args: P) => Promise<V | undefined> {
  const lockRef = useRef(false);

  return useCallback(
    async (...args: P) => {
      if (lockRef.current) return;
      
      lockRef.current = true;
      
      try {
        const ret = await fn(...args);
        return ret;
      } finally {
        lockRef.current = false;
      }
    },
    [fn]
  );
}