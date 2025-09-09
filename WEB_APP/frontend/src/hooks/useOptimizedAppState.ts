/**
 * 優化應用狀態 Hook
 * 
 * 提供細粒度狀態選擇器，減少重渲染
 */
import { useAppMultiSelector, useComputedSelector } from './useAppSelector';
import {
  selectExecutionStats,
  selectIsReadyToExecute
} from '@/store/selectors';

/**
 * 設備選擇狀態 Hook
 * 
 * 管理設備選擇與模式切換
 */
export const useDeviceSelectionState = () => {
  return useAppMultiSelector({
    selectedDevices: (state) => state.selectedDevices,
    mode: (state) => state.mode,
  });
};

/**
 * 指令輸入狀態 Hook
 * 
 * 管理指令輸入與執行狀態
 */
export const useCommandInputState = () => {
  const inputState = useAppMultiSelector({
    inputValue: (state) => state.inputValue,
    mode: (state) => state.mode,
    isExecuting: (state) => state.isExecuting,
    isBatchExecution: (state) => state.isBatchExecution,
    isAsyncMode: (state) => state.isAsyncMode,
    batchProgress: (state) => state.batchProgress,
    status: (state) => state.status,
  });

  const taskState = useAppMultiSelector({
    currentTask: (state) => state.currentTask,
    taskPollingActive: (state) => state.taskPollingActive,
  });

  return { ...inputState, ...taskState };
};

/**
 * 批次輸出狀態 Hook
 * 
 * 管理執行結果與統計資料
 */
export const useBatchOutputState = () => {
  const outputState = useAppMultiSelector({
    batchResults: (state) => state.batchResults,
    executionStartTime: (state) => state.executionStartTime,
  });

  // 使用計算型選擇器獲取統計信息
  const stats = useComputedSelector(
    selectExecutionStats,
    (stats) => stats,
    []
  );

  return { ...outputState, stats };
};

/**
 * 執行控制狀態 Hook
 * 
 * 提供執行控制與狀態管理
 */
export const useExecutionControl = () => {
  const executionState = useAppMultiSelector({
    selectedDevices: (state) => state.selectedDevices,
    inputValue: (state) => state.inputValue,
    isExecuting: (state) => state.isExecuting,
    isBatchExecution: (state) => state.isBatchExecution,
    isAsyncMode: (state) => state.isAsyncMode,
  });

  // 計算是否可以執行
  const isReadyToExecute = useComputedSelector(
    selectIsReadyToExecute,
    (ready) => ready,
    []
  );

  // 獲取控制函數
  const actions = useAppMultiSelector({
    setInputValue: (state) => state.setInputValue,
    setMode: (state) => state.setMode,
    setIsAsyncMode: (state) => state.setIsAsyncMode,
    smartToggle: (state) => state.smartToggle,
    resetExecutionState: (state) => state.resetExecutionState,
  });

  return {
    ...executionState,
    isReadyToExecute,
    actions,
  };
};

/**
 * 進度顯示狀態 Hook
 * 
 * 管理進度顯示與狀態更新
 */
export const useProgressState = () => {
  return useAppMultiSelector({
    progress: (state) => state.progress,
    batchProgress: (state) => state.batchProgress,
    status: (state) => state.status,
  });
};

/**
 * 主應用狀態 Hook
 * 
 * 整合所有應用狀態，提供統一管理介面
 */
export const useAppMainState = () => {
  // 分別訂閱不同類型的狀態，減少重渲染
  const deviceState = useDeviceSelectionState();
  const inputState = useCommandInputState();
  const outputState = useBatchOutputState();
  const controlState = useExecutionControl();

  // 組合高階 Actions
  const highLevelActions = useAppMultiSelector({
    updateSelectionAndInput: (state) => state.updateSelectionAndInput,
    handleExecutionStart: (state) => state.handleExecutionStart,
    handleTaskCompletion: (state) => state.handleTaskCompletion,
    handleExecutionError: (state) => state.handleExecutionError,
    conditionalUpdate: (state) => state.conditionalUpdate,
  });

  return {
    deviceState,
    inputState,
    outputState,
    controlState,
    actions: highLevelActions,
  };
};