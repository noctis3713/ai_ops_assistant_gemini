/**
 * useBatchThrottle - 批量操作節流 Hook
 * 專為批量處理大量操作而設計，使用 RAF 優化效能
 * 參考 ahooks 最佳實踐實現
 * 
 * @param batchProcessor - 批量處理函數
 * @param options - 配置選項
 * @returns 批量處理控制對象
 * 
 * @example
 * ```tsx
 * import { useBatchThrottle } from '@/hooks';
 * 
 * const DataProcessor = () => {
 *   const { 
 *     addItem, 
 *     flush, 
 *     cancel, 
 *     getBatchSize,
 *     getBatchCount 
 *   } = useBatchThrottle(
 *     (items: LogEntry[]) => {
 *       console.log(`Processing ${items.length} log entries`);
 *       processLogs(items);
 *     },
 *     { maxBatchSize: 100, flushInterval: 1000 }
 *   );
 *   
 *   const handleLogEntry = (entry: LogEntry) => {
 *     addItem(entry);
 *   };
 *   
 *   return (
 *     <div>
 *       <div>待處理項目: {getBatchSize()}</div>
 *       <div>總批次數: {getBatchCount()}</div>
 *       <button onClick={flush}>立即處理</button>
 *       <button onClick={cancel}>取消處理</button>
 *     </div>
 *   );
 * };
 * ```
 */
import { useRef, useCallback, useEffect } from 'react';
import { useRafThrottle } from '@/hooks';

interface BatchThrottleOptions {
  /** 最大批次大小 */
  maxBatchSize?: number;
  /** 刷新間隔時間（毫秒），設置後會定期自動刷新 */
  flushInterval?: number;
}

export function useBatchThrottle<T>(
  batchProcessor: (items: T[]) => void | Promise<void>,
  options: BatchThrottleOptions = {}
): {
  addItem: (item: T) => void;
  flush: () => void;
  cancel: () => void;
  getBatchSize: () => number;
  getBatchCount: () => number;
} {
  const {
    maxBatchSize = 50,
    flushInterval
  } = options;

  const batchRef = useRef<T[]>([]);
  const batchCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { run: throttledProcess, cancel: cancelThrottle } = useRafThrottle(() => {
    if (batchRef.current.length > 0) {
      const batch = batchRef.current.splice(0, maxBatchSize);
      batchCountRef.current += 1;
      batchProcessor(batch);
    }
  });

  // 設置定期刷新
  useEffect(() => {
    if (flushInterval && flushInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (batchRef.current.length > 0) {
          throttledProcess();
        }
      }, flushInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [flushInterval, throttledProcess]);

  const addItem = useCallback((item: T) => {
    batchRef.current.push(item);
    
    // 達到最大批次大小時立即處理
    if (batchRef.current.length >= maxBatchSize) {
      throttledProcess();
    } else {
      // 否則使用節流處理
      throttledProcess();
    }
  }, [throttledProcess, maxBatchSize]);

  const flush = useCallback(() => {
    if (batchRef.current.length > 0) {
      const batch = batchRef.current.splice(0);
      batchCountRef.current += 1;
      batchProcessor(batch);
    }
    cancelThrottle();
  }, [batchProcessor, cancelThrottle]);

  const cancel = useCallback(() => {
    batchRef.current = [];
    cancelThrottle();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [cancelThrottle]);

  const getBatchSize = useCallback(() => batchRef.current.length, []);
  
  const getBatchCount = useCallback(() => batchCountRef.current, []);

  // 清理副作用
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    addItem,
    flush,
    cancel,
    getBatchSize,
    getBatchCount,
  };
}