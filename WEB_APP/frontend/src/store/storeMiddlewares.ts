/**
 * Store 中間件配置集中管理
 * 
 * 提供統一的 Zustand 中間件配置，優化效能和開發體驗
 * 
 * @author AI Ops Assistant
 * @version 2.0.0
 */
import { devtools } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StateCreator } from 'zustand';

// 環境變數檢測
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * DevTools 中間件配置 - 專為切片模式優化
 * 在生產環境自動禁用以提升效能
 */
export const createDevtoolsMiddleware = <T>(name: string) => {
  return devtools<T, [], [], T>(
    // 傳入的 state creator 將在 appStore 中提供
    (stateCreator: StateCreator<T, [], [], T>) => stateCreator,
    {
      name: `ai-ops-${name}`,
      enabled: isDevelopment, // 自動根據環境啟用/禁用
      serialize: {
        // 序列化配置 - 避免循環引用和大物件
        options: {
          function: false, // 不序列化函數
          map: true,
          set: true,
          undefined: true
        }
      },
      anonymousActionType: 'unknown:action', // 未命名動作的類型
      // 在開發環境提供更多調試資訊
      trace: isDevelopment,
      traceLimit: 25,
      // 針對切片模式的優化配置
      actionCreators: {
        // 支援切片動作的分組顯示
        device: {
          setSelectedDevices: 'device:setSelectedDevices',
          setBatchResults: 'device:setBatchResults'
        },
        ui: {
          setMode: 'ui:setMode',
          setInputValue: 'ui:setInputValue',
          setStatus: 'ui:setStatus'
        },
        execution: {
          setIsExecuting: 'execution:setIsExecuting',
          setProgress: 'execution:setProgress',
          setBatchProgress: 'execution:setBatchProgress'
        },
        config: {
          smartToggle: 'config:smartToggle',
          clearExecutionData: 'config:clearExecutionData'
        }
      }
    }
  );
};

/**
 * SubscribeWithSelector 中間件配置
 * 允許更細粒度的狀態訂閱，優化效能
 */
export const createSubscribeWithSelectorMiddleware = <T>() => {
  return subscribeWithSelector<T>;
};

/**
 * 組合中間件的高階函數
 * 按正確順序應用所有中間件
 */
export const createOptimizedStore = <T>(
  stateCreator: StateCreator<T, [], [], T>,
  storeName: string = 'app-store'
) => {
  // 中間件應用順序很重要：subscribeWithSelector -> devtools
  return createDevtoolsMiddleware<T>(storeName)(
    createSubscribeWithSelectorMiddleware<T>()(stateCreator)
  );
};

/**
 * 效能優化相關常數
 */
export const PERFORMANCE_CONFIG = {
  // 進度更新節流時間（毫秒）
  PROGRESS_THROTTLE_MS: 100,
  // 狀態更新批次延遲時間（毫秒）
  BATCH_UPDATE_DELAY_MS: 16, // ~60fps
  // DevTools 追蹤限制
  DEVTOOLS_TRACE_LIMIT: 25,
  // 自動清理延遲時間（毫秒）
  AUTO_CLEANUP_DELAY_MS: 5000
} as const;

/**
 * 開發工具輔助函數
 */
export const storeDevtools = {
  /**
   * 記錄狀態變更（僅在開發環境）
   */
  logStateChange: (action: string, prevState: unknown, nextState: unknown) => {
    if (isDevelopment) {
      console.group(`🏪 Store Action: ${action}`);
      console.log('Previous State:', prevState);
      console.log('Next State:', nextState);
      console.groupEnd();
    }
  },

  /**
   * 效能監控（僅在開發環境）
   */
  measurePerformance: (label: string, fn: () => void) => {
    if (isDevelopment && window.performance) {
      const start = performance.now();
      fn();
      const end = performance.now();
      console.log(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
    } else {
      fn();
    }
  },

  /**
   * 警告檢查 - 檢測可能的效能問題
   */
  warnOnFrequentUpdates: (() => {
    const updateCounts = new Map<string, number>();
    const resetInterval = 1000; // 1秒重置計數

    setInterval(() => {
      updateCounts.clear();
    }, resetInterval);

    return (actionName: string, threshold = 10) => {
      if (!isDevelopment) return;

      const count = (updateCounts.get(actionName) || 0) + 1;
      updateCounts.set(actionName, count);

      if (count > threshold) {
        console.warn(
          `⚠️ 效能警告: "${actionName}" 在 ${resetInterval}ms 內被調用 ${count} 次，可能需要節流或優化`
        );
      }
    };
  })(),

  /**
   * 統一的切片動作包裝器 - 提供一致的效能監控和命名
   */
  wrapSliceAction: <T extends unknown[], R>(
    sliceName: string,
    actionName: string,
    action: (...args: T) => R,
    options: {
      enablePerformanceMonitoring?: boolean;
      enableFrequencyWarning?: boolean;
      warningThreshold?: number;
    } = {}
  ) => {
    const {
      enablePerformanceMonitoring = false,
      enableFrequencyWarning = false,
      warningThreshold = 10
    } = options;

    const fullActionName = `${sliceName}:${actionName}`;

    return (...args: T): R => {
      // 頻率警告檢查
      if (enableFrequencyWarning) {
        storeDevtools.warnOnFrequentUpdates(fullActionName, warningThreshold);
      }

      // 效能監控
      if (enablePerformanceMonitoring) {
        let result: R;
        storeDevtools.measurePerformance(fullActionName, () => {
          result = action(...args);
        });
        return result!;
      } else {
        return action(...args);
      }
    };
  }
};

/**
 * 類型輔助 - 確保中間件類型安全
 */
export type WithDevtools<T> = T & {
  // DevTools 擴展的方法
  setState: (state: Partial<T> | ((state: T) => Partial<T>), replace?: boolean, action?: string) => void;
};

export type WithSubscribeWithSelector<T> = T & {
  // SubscribeWithSelector 擴展的方法  
  subscribe: {
    <U>(
      selector: (state: T) => U,
      listener: (selectedState: U, previousSelectedState: U) => void,
      options?: {
        equalityFn?: (a: U, b: U) => boolean;
        fireImmediately?: boolean;
      }
    ): () => void;
    (listener: (state: T, previousState: T) => void): () => void;
  };
};

// 導出類型
export type OptimizedStore<T> = WithDevtools<WithSubscribeWithSelector<T>>;