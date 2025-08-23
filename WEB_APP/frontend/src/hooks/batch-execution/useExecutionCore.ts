import { useRef } from 'react';
import { useAppStore } from '@/store';
import { useMemoizedFn } from '@/hooks';

interface ExecutionCoreOptions {
  debounceDelay?: number;
  keepResults?: boolean;
}

export const useExecutionCore = (options: ExecutionCoreOptions = {}) => {
  const { 
    debounceDelay = 1000, 
    keepResults = true 
  } = options;
  
  // 執行狀態追蹤
  const isExecutingRef = useRef(false);
  const lastExecutionTimeRef = useRef<number>(0);
  
  // 清理相關
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 檢查是否可以執行（防抖和重複執行檢查）
  const canExecute = useMemoizedFn((): boolean => {
    const now = Date.now();
    
    // 防抖檢查
    if (now - lastExecutionTimeRef.current < debounceDelay) {
      return false;
    }
    
    // 防重複執行檢查
    if (isExecutingRef.current) {
      return false;
    }
    
    return true;
  });
  
  // 開始執行
  const startExecution = useMemoizedFn(() => {
    isExecutingRef.current = true;
    lastExecutionTimeRef.current = Date.now();
  });
  
  // 結束執行
  const finishExecution = useMemoizedFn(() => {
    isExecutingRef.current = false;
  });
  
  // 重置執行時間（用於錯誤後立即重試）
  const resetExecutionTime = useMemoizedFn(() => {
    lastExecutionTimeRef.current = 0;
  });
  
  // 延遲清除狀態
  const scheduleCleanup = useMemoizedFn((delay: number = 5000) => {
    // 先清除之前的清理計時器
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }
    
    clearTimeoutRef.current = setTimeout(() => {
      const { clearExecutionData, setProgressVisibility } = useAppStore.getState();
      
      // 清除執行數據（根據選項決定是否保留結果）
      clearExecutionData({ 
        status: true, 
        results: !keepResults 
      });
      
      // 隱藏進度條
      setProgressVisibility('batch', false);
      
      clearTimeoutRef.current = null;
    }, delay);
  });
  
  // 立即清除狀態
  const cleanupNow = useMemoizedFn(() => {
    clearAllTimeouts();
    
    const { clearExecutionData, setProgressVisibility } = useAppStore.getState();
    clearExecutionData({ status: true, results: !keepResults });
    setProgressVisibility('batch', false);
  });
  
  // 清除所有 timeout
  const clearAllTimeouts = useMemoizedFn(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
  });
  
  return {
    // 狀態
    isExecuting: isExecutingRef.current,
    
    // 檢查函數
    canExecute,
    
    // 控制函數
    startExecution,
    finishExecution,
    resetExecutionTime,
    
    // 清理函數
    scheduleCleanup,
    cleanupNow,
    clearAllTimeouts,
    
    // 狀態查詢
    hasScheduledCleanup: clearTimeoutRef.current !== null,
  };
};