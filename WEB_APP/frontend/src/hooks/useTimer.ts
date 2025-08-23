/**
 * Timer 管理工具函數
 * 統一管理所有 timeout 和 interval，自動處理清理邏輯
 * 防止記憶體洩漏，支援組件卸載時自動清理
 */
import { useRef, useCallback, useEffect } from 'react';
import { logError } from '@/errors';

// Timer 類型定義
type TimerId = NodeJS.Timeout;
type TimerCallback = () => void;

// Timer 配置選項
interface TimerOptions {
  // 是否立即執行（僅對 interval 有效）
  immediate?: boolean;
  // 自定義清理回調
  onCleanup?: () => void;
}

/**
 * 統一的 Timer 管理 Hook
 * 
 * @returns Timer 管理工具集
 * 
 * @example
 * ```typescript
 * const { setTimeout, setInterval, clearAllTimers } = useTimer();
 * 
 * // 設定延遲執行
 * setTimeout(() => handleDelayedAction(), 1000);
 * 
 * // 設定重複執行
 * const intervalId = setInterval(() => handlePeriodicTask(), 1000);
 * 
 * // 清除所有計時器
 * clearAllTimers();
 * ```
 */
export const useTimer = () => {
  // 使用 Set 來追蹤所有活動的 timer
  const timersRef = useRef<Set<TimerId>>(new Set());

  /**
   * 安全的 setTimeout 實現
   * 自動追蹤和清理，防止記憶體洩漏
   */
  const setTimeoutSafe = useCallback((callback: TimerCallback, delay: number, options?: TimerOptions): TimerId => {
    const timerId = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        logError('Timer callback 執行錯誤', { error });
      } finally {
        // 執行完成後自動清理
        timersRef.current.delete(timerId);
        if (options?.onCleanup) {
          options.onCleanup();
        }
      }
    }, delay);

    // 追蹤這個 timer
    timersRef.current.add(timerId);
    
    return timerId;
  }, []);

  /**
   * 安全的 setInterval 實現
   * 自動追蹤和清理，防止記憶體洩漏
   */
  const setIntervalSafe = useCallback((callback: TimerCallback, delay: number, options?: TimerOptions): TimerId => {
    // 如果設定立即執行，先執行一次
    if (options?.immediate) {
      try {
        callback();
      } catch (error) {
        logError('Timer 立即執行 callback 錯誤', { error });
      }
    }

    const timerId = setInterval(() => {
      try {
        callback();
      } catch (error) {
        logError('Timer interval callback 執行錯誤', { error });
      }
    }, delay);

    // 追蹤這個 timer
    timersRef.current.add(timerId);
    
    return timerId;
  }, []);

  /**
   * 清除特定的 timer
   */
  const clearTimerSafe = useCallback((timerId: TimerId | null | undefined) => {
    if (!timerId) return;

    // 清除 timeout 或 interval
    clearTimeout(timerId);
    clearInterval(timerId);
    
    // 從追蹤集合中移除
    timersRef.current.delete(timerId);
  }, []);

  /**
   * 清除所有 timer
   * 在組件卸載或重置時使用
   */
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    timersRef.current.clear();
  }, []);

  /**
   * 延遲執行工具函數
   * 返回 Promise，支援 async/await 語法
   */
  const delay = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => {
      setTimeoutSafe(resolve, ms);
    });
  }, [setTimeoutSafe]);

  // 注意：防抖和節流功能已移至通用工具
  // 請使用 useDebounce, useThrottle, useDebounceFn, useThrottleFn
  // import { useDebounce, useThrottle } from '@/hooks';

  /**
   * 獲取當前活動 timer 數量
   * 用於調試和監控
   */
  const getActiveTimerCount = useCallback(() => {
    return timersRef.current.size;
  }, []);

  // 組件卸載時自動清理所有 timer
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // 返回 timer 管理工具集
  return {
    // 基本 timer 方法
    setTimeout: setTimeoutSafe,
    setInterval: setIntervalSafe,
    clearTimer: clearTimerSafe,
    clearAllTimers,
    
    // 工具方法
    delay,
    
    // 監控方法
    getActiveTimerCount,
  };
};

/**
 * 預定義的延遲時間常數
 * 統一管理常用的延遲時間
 */
export const TIMER_DELAYS = {
  // 快速響應
  IMMEDIATE: 0,
  FAST: 100,
  QUICK: 300,
  
  // 一般延遲
  SHORT: 500,
  MEDIUM: 1000,
  LONG: 2000,
  
  // 長延遲
  VERY_LONG: 5000,
  ERROR_DISPLAY: 8000,
  WARNING_DISPLAY: 12000,
  
  // 特定用途
  DEBOUNCE_DEFAULT: 300,
  THROTTLE_DEFAULT: 1000,
  PROGRESS_UPDATE: 500,
  STATUS_CLEAR: 3000,
} as const;

/**
 * 簡化的 timer hook，適用於簡單場景
 * 只需要基本的 setTimeout 和 clearTimeout 功能
 */
export const useSimpleTimer = () => {
  const timerRef = useRef<TimerId | null>(null);

  const setTimer = useCallback((callback: TimerCallback, delay: number) => {
    // 清除之前的 timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // 設定新的 timer
    timerRef.current = setTimeout(() => {
      callback();
      timerRef.current = null;
    }, delay);
    
    return timerRef.current;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 組件卸載時自動清理
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return { setTimer, clearTimer };
};