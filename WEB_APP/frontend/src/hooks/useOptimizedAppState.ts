/**
 * 優化的應用程式狀態 Hook
 * 示範如何使用細粒度選擇器減少重渲染
 */
import { useAppMultiSelector, useComputedSelector } from './useAppSelector';
import {
  selectExecutionStats,
  selectIsReadyToExecute
} from '@/store/selectors';

/**
 * 設備選擇相關狀態 Hook
 * 只訂閱設備選擇相關的狀態
 */
export const useDeviceSelectionState = () => {
  return useAppMultiSelector({
    selectedDevices: (state) => state.selectedDevices,
    mode: (state) => state.mode,
  });
};

/**
 * 指令輸入相關狀態 Hook
 * 集中管理指令輸入組件需要的所有狀態
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
 * 批次輸出相關狀態 Hook  
 * 包含結果數據和統計信息
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
 * 執行控制相關狀態 Hook
 * 提供執行狀態和控制函數
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
 * 進度顯示相關狀態 Hook
 * 智能選擇當前活動的進度類型
 */
export const useProgressState = () => {
  return useAppMultiSelector({
    progress: (state) => state.progress,
    batchProgress: (state) => state.batchProgress,
    status: (state) => state.status,
  });
};

/**
 * 綜合狀態 Hook - 為主應用組件提供所有必要狀態
 * 使用選擇器優化，只在相關狀態改變時重渲染
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