/**
 * useTimeout - 簡化版 setTimeout Hook
 * 參考 ahooks 最佳實踐實現
 * 自動處理清理邏輯，防止記憶體洩漏
 * 
 * @param fn - 要延遲執行的函數
 * @param delay - 延遲時間（毫秒），設為 undefined 時會取消計時器
 * @returns 清除計時器的函數
 * 
 * @example
 * ```tsx
 * import { useTimeout } from '@/hooks/utils';
 * 
 * const DelayedMessage = () => {
 *   const [message, setMessage] = useState('');
 *   
 *   // 3秒後顯示訊息
 *   const clearTimer = useTimeout(() => {
 *     setMessage('Hello after 3 seconds!');
 *   }, 3000);
 *   
 *   return (
 *     <div>
 *       <div>{message}</div>
 *       <button onClick={clearTimer}>取消計時器</button>
 *     </div>
 *   );
 * };
 * ```
 * 
 * @example
 * // 條件性計時器
 * ```tsx
 * const ConditionalTimer = () => {
 *   const [enabled, setEnabled] = useState(true);
 *   
 *   useTimeout(() => {
 *     console.log('Timer executed!');
 *   }, enabled ? 1000 : undefined);
 *   
 *   return (
 *     <button onClick={() => setEnabled(!enabled)}>
 *       {enabled ? '停用' : '啟用'} 計時器
 *     </button>
 *   );
 * };
 * ```
 */
import { useEffect, useRef } from 'react';
import { useMemoizedFn, useLatest } from '@/hooks';

export function useTimeout(
  fn: () => void,
  delay?: number | undefined
): () => void {
  const fnRef = useLatest(fn);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useMemoizedFn(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  useEffect(() => {
    // 如果 delay 為 undefined，清除計時器
    if (delay === undefined) {
      clearTimer();
      return;
    }

    // 設定新的計時器
    timerRef.current = setTimeout(() => {
      fnRef.current();
      timerRef.current = null;
    }, delay);

    // 清理函數
    return clearTimer;
  }, [delay, fnRef, clearTimer]);

  // 組件卸載時自動清理
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return clearTimer;
}