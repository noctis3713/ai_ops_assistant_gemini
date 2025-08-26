/**
 * Zustand 狀態選擇器
 * 提供細粒度的狀態訂閱，減少不必要的重渲染
 * 
 * @optimization 使用指南：
 * - 單一原始值：直接使用，不需要 useShallow
 * - 陣列/物件：使用 useShallow 避免不必要的重渲染
 * - 計算值：使用 useMemo 配合選擇器
 */
import { type AppStore } from '@/types';

// 基礎狀態選擇器
export const selectMode = (state: AppStore) => state.mode;
export const selectSelectedDevices = (state: AppStore) => state.selectedDevices;
export const selectInputValue = (state: AppStore) => state.inputValue;
export const selectBatchResults = (state: AppStore) => state.batchResults;
export const selectStatus = (state: AppStore) => state.status;

// 執行狀態相關選擇器
export const selectExecutionState = (state: AppStore) => ({
  isExecuting: state.isExecuting,
  isBatchExecution: state.isBatchExecution,
  isAsyncMode: state.isAsyncMode,
  taskPollingActive: state.taskPollingActive,
});

export const selectCurrentTask = (state: AppStore) => state.currentTask;
export const selectIsAsyncMode = (state: AppStore) => state.isAsyncMode;

// 進度相關選擇器
export const selectProgress = (state: AppStore) => state.progress;
export const selectBatchProgress = (state: AppStore) => state.batchProgress;

export const selectProgressState = (state: AppStore) => ({
  progress: state.progress,
  batchProgress: state.batchProgress,
  status: state.status,
});

// 組合選擇器 - 用於特定組件的狀態組合
export const selectDeviceSelectionState = (state: AppStore) => ({
  selectedDevices: state.selectedDevices,
  mode: state.mode,
});

export const selectCommandInputState = (state: AppStore) => ({
  inputValue: state.inputValue,
  mode: state.mode,
  isExecuting: state.isExecuting,
  isBatchExecution: state.isBatchExecution,
  isAsyncMode: state.isAsyncMode,
  currentTask: state.currentTask,
  taskPollingActive: state.taskPollingActive,
  batchProgress: state.batchProgress,
  status: state.status,
});

export const selectBatchOutputState = (state: AppStore) => ({
  batchResults: state.batchResults,
  executionStartTime: state.executionStartTime,
});

// 計算型選擇器 - 提供派生狀態
export const selectExecutionStats = (state: AppStore) => {
  const results = state.batchResults;
  return {
    totalResults: results.length,
    successCount: results.filter(r => r.success).length,
    failedCount: results.filter(r => !r.success).length,
    hasResults: results.length > 0,
  };
};

export const selectIsReadyToExecute = (state: AppStore) => {
  return (
    state.selectedDevices.length > 0 && 
    state.inputValue.trim() !== '' && 
    !state.isExecuting &&
    !state.isBatchExecution
  );
};

// 高階選擇器工廠函數
export const createDeviceSelector = (deviceIp: string) => (state: AppStore) => {
  return state.batchResults.find(result => result.deviceIp === deviceIp);
};

export const createProgressSelector = (threshold: number) => (state: AppStore) => {
  const progress = state.batchProgress;
  return {
    ...progress,
    isNearComplete: progress.completedDevices / progress.totalDevices >= threshold,
  };
};

// 效能優化選擇器 - 使用淺比較優化
export const selectUIState = (state: AppStore) => ({
  // 只包含影響 UI 顯示的關鍵狀態
  mode: state.mode,
  hasSelectedDevices: state.selectedDevices.length > 0,
  hasInput: state.inputValue.trim() !== '',
  hasResults: state.batchResults.length > 0,
  isExecuting: state.isExecuting || state.isBatchExecution,
  showProgress: state.progress.isVisible || state.batchProgress.isVisible,
});

// 響應式選擇器 - 根據條件選擇不同的狀態
export const selectActiveProgress = (state: AppStore) => {
  if (state.batchProgress.isVisible) {
    return {
      type: 'batch' as const,
      data: state.batchProgress,
    };
  }
  if (state.progress.isVisible) {
    return {
      type: 'simple' as const,
      data: state.progress,
    };
  }
  return null;
};