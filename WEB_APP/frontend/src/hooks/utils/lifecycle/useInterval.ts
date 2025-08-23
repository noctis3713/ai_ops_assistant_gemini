/**
 * useInterval - 簡化版 setInterval Hook
 * 參考 ahooks 最佳實踐實現
 * 自動處理清理邏輯，防止記憶體洩漏
 * 
 * @param fn - 要定時執行的函數
 * @param delay - 間隔時間（毫秒），設為 undefined 時會停止計時器
 * @param options - 配置選項
 * @returns 清除計時器的函數
 * 
 * @example
 * ```tsx
 * import { useInterval } from '@/hooks/utils';
 * 
 * const CounterComponent = () => {
 *   const [count, setCount] = useState(0);
 *   const [running, setRunning] = useState(true);
 *   
 *   const clearInterval = useInterval(() => {
 *     setCount(c => c + 1);
 *   }, running ? 1000 : undefined);
 *   
 *   return (
 *     <div>
 *       <div>Count: {count}</div>
 *       <button onClick={() => setRunning(!running)}>
 *         {running ? '暫停' : '開始'}
 *       </button>
 *       <button onClick={clearInterval}>重置計時器</button>
 *     </div>
 *   );
 * };
 * ```
 * 
 * @example
 * // 立即執行
 * ```tsx
 * const ImmediateTimer = () => {
 *   const [data, setData] = useState('');
 *   
 *   useInterval(async () => {
 *     const result = await fetchData();
 *     setData(result);
 *   }, 5000, { immediate: true });
 *   
 *   return <div>Data: {data}</div>;
 * };
 * ```
 */
import { useEffect, useRef } from 'react';
import { useMemoizedFn, useLatest } from '@/hooks';

interface IntervalOptions {
  /** 是否在首次渲染時立即執行 */
  immediate?: boolean;
}

export function useInterval(
  fn: () => void,
  delay?: number | undefined,
  options: IntervalOptions = {}
): () => void {
  const { immediate = false } = options;
  
  const fnRef = useLatest(fn);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const immediateExecutedRef = useRef(false);

  const clearInterval = useMemoizedFn(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  useEffect(() => {
    // 如果 delay 為 undefined，清除計時器
    if (delay === undefined) {
      clearInterval();
      immediateExecutedRef.current = false;
      return;
    }

    // 立即執行（僅執行一次）
    if (immediate && !immediateExecutedRef.current) {
      fnRef.current();
      immediateExecutedRef.current = true;
    }

    // 設定新的間隔計時器
    timerRef.current = setInterval(() => {
      fnRef.current();
    }, delay);

    // 清理函數
    return clearInterval;
  }, [delay, immediate, fnRef, clearInterval]);

  // 當 delay 從 undefined 變為有效值時，重置立即執行標記
  useEffect(() => {
    if (delay === undefined) {
      immediateExecutedRef.current = false;
    }
  }, [delay]);

  // 組件卸載時自動清理
  useEffect(() => {
    return clearInterval;
  }, [clearInterval]);

  return clearInterval;
}