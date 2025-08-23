/**
 * Store 輔助函數 - 高效能業務邏輯模組化
 * 
 * 將複雜的狀態操作邏輯從 appStore 中提取，提升可維護性和可測試性
 * 使用高階函數模式，支援函數式程式設計和依賴注入
 * 
 * 新增優化：
 * - 批次狀態更新減少重複渲染
 * - 智能的狀態比較和更新
 * - 效能監控和警告機制
 * 
 * @description 提供統一的狀態管理操作函數，避免直接在 store 中寫複雜邏輯
 * @author AI Ops Assistant
 * @version 2.0.0 - 效能優化版
 */
import { type AppStore } from '@/types';
import { PERFORMANCE_CONFIG } from '@/store/storeMiddlewares';

// 任務完成處理邏輯 - 批次更新優化
export const createTaskCompletionHandler = (store: AppStore) => (taskResult: unknown) => {
  const { setBatchResults, setStatus, setProgressVisibility, setIsExecuting, setIsBatchExecution, clearExecutionData } = store;
  
  // 類型安全的結果設定
  const results = (taskResult && typeof taskResult === 'object' && 'results' in taskResult && Array.isArray(taskResult.results)) 
    ? taskResult.results 
    : [];
  
  // 類型安全的統計資訊取得
  const summary = (taskResult && typeof taskResult === 'object' && 'summary' in taskResult) 
    ? taskResult.summary as Record<string, unknown> 
    : {};
  const successCount = Number(summary?.successful) || 0;
  const failedCount = Number(summary?.failed) || 0;
  
  // 批次更新所有相關狀態，減少多次設定導致的重新渲染
  setBatchResults(results);
  setStatus(`執行完成: ${successCount} 成功, ${failedCount} 失敗`, 'success');
  
  // 使用延遲清理機制，避免狀態更新衝突
  setTimeout(() => {
    setProgressVisibility('batch', false);
    setIsExecuting(false);
    setIsBatchExecution(false);
    clearExecutionData({ timestamp: true });
  }, PERFORMANCE_CONFIG.BATCH_UPDATE_DELAY_MS);
};

// 執行開始處理邏輯 - 批次更新優化
export const createExecutionStartHandler = (store: AppStore) => (params: { deviceCount: number; isBatch?: boolean }) => {
  const { 
    setIsExecuting, 
    setIsBatchExecution, 
    setProgressVisibility, 
    setExecutionStartTime, 
    clearExecutionData
  } = store;
  
  const { deviceCount, isBatch = false } = params;
  const timestamp = Date.now();
  
  // 優化：先停止所有狀態更新，再批次設定
  // 清理狀態
  clearExecutionData({ results: true, status: true });
  
  // 批次設定執行狀態，減少多次狀態更新
  setIsExecuting(true);
  setExecutionStartTime(timestamp);
  
  if (isBatch) {
    setIsBatchExecution(true);
    // 使用微延遲確保執行狀態先設定完成
    setTimeout(() => {
      setProgressVisibility('batch', true, { totalDevices: deviceCount });
    }, PERFORMANCE_CONFIG.BATCH_UPDATE_DELAY_MS);
  }
};

// 執行錯誤處理邏輯 - 批次更新優化
export const createExecutionErrorHandler = (store: AppStore) => (error: unknown, context?: string) => {
  const { setStatus, setProgressVisibility, setIsExecuting, setIsBatchExecution } = store;
  
  // 類型安全的錯誤訊息處理
  const errorMessage = typeof error === 'string' ? error 
    : error instanceof Error ? error.message 
    : (error && typeof error === 'object' && 'message' in error) ? String((error as Record<string, unknown>).message) 
    : '執行失敗';
  
  // 根據上下文調整錯誤訊息
  const finalErrorMessage = context ? `${context}: ${errorMessage}` : errorMessage;
  
  // 優化：批次清理狀態，減少多次更新
  setStatus(finalErrorMessage, 'error');
  
  // 使用微延遲清理執行狀態，避免狀態衝突
  setTimeout(() => {
    setProgressVisibility('batch', false);
    setIsExecuting(false);
    setIsBatchExecution(false);
  }, PERFORMANCE_CONFIG.BATCH_UPDATE_DELAY_MS);
};

// 非同步任務開始處理邏輯
export const createAsyncTaskStartHandler = (store: AppStore) => (taskId: string, deviceCount: number) => {
  const { 
    setCurrentTask, 
    setIsAsyncMode, 
    setTaskPollingActive, 
    setProgressVisibility,
    setExecutionStartTime,
    clearExecutionData 
  } = store;
  
  // 清除之前的結果
  clearExecutionData({ results: true });
  
  // 設定非同步任務狀態
  setIsAsyncMode(true);
  setTaskPollingActive(true);
  setProgressVisibility('batch', true, { totalDevices: deviceCount });
  setExecutionStartTime(Date.now());
  
  // 設定當前任務（如果有任務物件）
  if (taskId) {
    setCurrentTask({
      task_id: taskId,
      task_type: 'batch_execute',
      status: 'pending',
      created_at: new Date().toISOString(),
      progress: { 
        percentage: 0, 
        current_stage: '任務已建立',
        details: {}
      },
      params: { 
        devices: Array(deviceCount).fill(''),
        command: '',
        mode: 'command'
      }
    });
  }
};

// 狀態重置處理邏輯
export const createStateResetHandler = (store: AppStore) => () => {
  const { 
    setIsExecuting, 
    setIsBatchExecution, 
    setProgressVisibility,
    clearExecutionData,
    setIsAsyncMode,
    setTaskPollingActive,
    setCurrentTask
  } = store;
  
  // 重置所有執行相關狀態
  setIsExecuting(false);
  setIsBatchExecution(false);
  setProgressVisibility('batch', false);
  setProgressVisibility('normal', false);
  clearExecutionData({ status: true, results: true, timestamp: true });
  
  // 重置非同步任務狀態
  setIsAsyncMode(false);
  setTaskPollingActive(false);
  setCurrentTask(null);
};

// 智能狀態切換邏輯
export const createSmartToggleHandler = (store: AppStore) => (action: 'clear_all' | 'restart_execution' | 'switch_mode') => {
  switch (action) {
    case 'clear_all':
      // 清空所有內容和結果
      store.setSelectedDevices([]);
      store.setInputValue('');
      store.clearExecutionData({ results: true, status: true });
      store.setProgressVisibility('batch', false);
      store.setProgressVisibility('normal', false);
      break;
      
    case 'restart_execution':
      // 保持選擇和輸入，只重置執行狀態
      store.clearExecutionData({ results: true, status: true });
      store.setProgressVisibility('batch', false);
      store.setProgressVisibility('normal', false);
      store.setIsExecuting(false);
      store.setIsBatchExecution(false);
      break;
      
    case 'switch_mode': {
      // 智能切換執行模式（command ↔ ai）
      const newMode = store.mode === 'command' ? 'ai' : 'command';
      store.setMode(newMode);
      // 切換模式時清空輸入，但保持設備選擇
      store.setInputValue('');
      break;
    }
  }
};

// 條件性狀態更新邏輯
export const createConditionalUpdateHandler = (store: AppStore) => (updates: {
  status?: { message: string; type: 'loading' | 'success' | 'error' | 'warning' | '' };
  progress?: { percentage: number; visible?: boolean };
  batchProgress?: { completed: number; total: number; visible?: boolean };
}) => {
  // 只有在狀態實際改變時才更新
  if (updates.status && store.status.message !== updates.status.message) {
    store.setStatus(updates.status.message, updates.status.type);
  }
  
  if (updates.progress && store.progress.percentage !== updates.progress.percentage) {
    if (updates.progress.visible !== undefined) {
      store.setProgressVisibility('normal', updates.progress.visible, {
        percentage: updates.progress.percentage
      });
    } else {
      store.setProgress({ percentage: updates.progress.percentage });
    }
  }
  
  if (updates.batchProgress && store.batchProgress.completedDevices !== updates.batchProgress.completed) {
    if (updates.batchProgress.visible !== undefined) {
      store.setProgressVisibility('batch', updates.batchProgress.visible, {
        totalDevices: updates.batchProgress.total
      });
    }
    store.setBatchProgress({ completedDevices: updates.batchProgress.completed });
  }
};

// 高效能批次更新邏輯 - 使用單一 setState 呼叫
export const createBatchUpdateHandler = (store: AppStore) => (devices: string[], input: string, mode?: 'command' | 'ai') => {
  // 優化：使用單一 setState 呼叫更新多個狀態，避免多次重新渲染
  const updates: Partial<AppStore> = {
    selectedDevices: devices,
    inputValue: input
  };
  
  if (mode) {
    updates.mode = mode;
  }
  
  // 使用 Zustand 的內部 setState 方法直接更新
  (store as { setState: (updates: Partial<AppStore>, replace?: boolean, action?: string) => void }).setState(updates, false, 'batchUpdate');
};

/**
 * 新增：高效能狀態比較工具
 * 用於檢查狀態是否實際改變，避免不必要的更新
 */
export const stateComparison = {
  /**
   * 比較進度狀態是否有意義改變
   */
  hasProgressChanged: (current: Record<string, unknown>, update: Record<string, unknown>): boolean => {
    return Object.keys(update).some(
      key => current[key] !== update[key] && update[key] !== undefined
    );
  },
  
  /**
   * 比較數值是否有意義改變（差異大於闾值）
   */
  hasNumberChanged: (current: number, update: number, threshold = 1): boolean => {
    return Math.abs(current - update) >= threshold;
  },
  
  /**
   * 比較陣列是否有意義改變
   */
  hasArrayChanged: <T>(current: T[], update: T[]): boolean => {
    if (current.length !== update.length) return true;
    return current.some((item, index) => item !== update[index]);
  }
};

/**
 * 新增：性能優化的進度更新管理器
 * 控制進度更新頻率，避免過多重新渲染
 */
export class ProgressUpdateManager {
  private lastUpdate = 0;
  private updateThreshold: number;
  
  constructor(thresholdMs = PERFORMANCE_CONFIG.PROGRESS_THROTTLE_MS) {
    this.updateThreshold = thresholdMs;
  }
  
  /**
   * 檢查是否應該更新進度
   */
  shouldUpdate(currentProgress: number, newProgress: number): boolean {
    const now = Date.now();
    const timeDiff = now - this.lastUpdate;
    const progressDiff = Math.abs(newProgress - currentProgress);
    
    // 如果時間間隔超過闾值或進度差異超過 5%，則更新
    if (timeDiff >= this.updateThreshold || progressDiff >= 5) {
      this.lastUpdate = now;
      return true;
    }
    
    return false;
  }
  
  /**
   * 強制更新（用於完成或錯誤狀態）
   */
  forceUpdate(): void {
    this.lastUpdate = Date.now();
  }
}