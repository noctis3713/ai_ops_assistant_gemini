/**
 * 應用狀態選擇器 Hook
 * 
 * 提供類型安全的狀態選擇與優化
 */
import { useMemo } from 'react';
import { useAppStore } from '@/store';
import { type AppStore } from '@/types';

/**
 * 通用狀態選擇器
 */
export function useAppSelector<T>(
  selector: (state: AppStore) => T
): T {
  return useAppStore(selector);
}

/**
 * 多重狀態選擇器
 */
export function useAppMultiSelector<T extends Record<string, unknown>>(
  selectors: {
    [K in keyof T]: (state: AppStore) => T[K];
  }
): T {
  return useAppStore((state) => {
    const result = {} as T;
    for (const [key, selector] of Object.entries(selectors) as [keyof T, (state: AppStore) => T[keyof T]][]) {
      result[key] = selector(state);
    }
    return result;
  });
}

/**
 * 計算型選擇器
 */
export function useComputedSelector<T, R>(
  selector: (state: AppStore) => T,
  computeFn: (data: T) => R
): R {
  const data = useAppStore(selector);
  
  return useMemo(() => computeFn(data), [data, computeFn]);
}

/**
 * 條件選擇器
 */
export function useConditionalSelector<T>(
  condition: boolean,
  selector: (state: AppStore) => T,
  defaultValue: T
): T {
  const selectedValue = useAppStore(
    condition ? selector : () => defaultValue
  );
  
  return condition ? selectedValue : defaultValue;
}

/**
 * 節流選擇器
 */
export function useThrottledSelector<T>(
  selector: (state: AppStore) => T,
  delay: number = 100
): T {
  const value = useAppStore(selector);
  
  return useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    let lastValue = value;
    
    const throttledValue = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastValue = value;
      }, delay);
      return lastValue;
    };
    
    return throttledValue();
  }, [value, delay]);
}

// 專用選擇器
export const useSelectedDevices = () => useAppStore(state => state.selectedDevices);
export const useInputValue = () => useAppStore(state => state.inputValue);
export const useBatchResults = () => useAppStore(state => state.batchResults);
export const useAppExecutionState = () => useAppStore(state => ({
  isExecuting: state.isExecuting,
  isBatchExecution: state.isBatchExecution,
  isAsyncMode: state.isAsyncMode,
}));

export const useAppProgressState = () => useAppStore(state => ({
  progress: state.progress,
  batchProgress: state.batchProgress,
  status: state.status,
}));