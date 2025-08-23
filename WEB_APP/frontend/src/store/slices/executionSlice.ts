/**
 * 執行狀態管理切片
 * 
 * 負責管理所有執行相關狀態，包括進度追蹤、任務管理、執行狀態等
 * 
 * @description 此切片專注於執行流程的狀態管理，提供複雜的進度追蹤和任務管理功能
 * @author AI Ops Assistant  
 * @version 1.0.0 - 初始切片版本
 */
import { type StateCreator } from 'zustand';
import { type AppStore, type ExecutionSlice } from '@/types/store';
import { storeDevtools } from '../storeMiddlewares';
import {
  createTaskCompletionHandler,
  createExecutionStartHandler,
  createExecutionErrorHandler,
  createAsyncTaskStartHandler,
} from '@/utils/storeHelpers';

// 執行切片初始狀態
export const initialExecutionState = {
  isExecuting: false,
  isBatchExecution: false,
  
  // 進度狀態
  progress: {
    isVisible: false,
    percentage: 0,
    currentStage: undefined,
    stageMessage: undefined,
  },
  batchProgress: {
    isVisible: false,
    totalDevices: 0,
    completedDevices: 0,
    currentStage: undefined,
    stageMessage: undefined,
  },
  
  // 執行時間戳
  executionStartTime: null,
  
  // 非同步任務狀態
  currentTask: null,
  isAsyncMode: false,
  taskPollingActive: false,
} as const;

export const createExecutionSlice: StateCreator<
  AppStore,
  [],
  [],
  ExecutionSlice
> = (set, get) => ({
  // 初始狀態
  ...initialExecutionState,

  // =============================================================================
  // 基礎執行狀態動作
  // =============================================================================

  setIsExecuting: (isExecuting) => {
    set({ isExecuting }, false, 'execution:setIsExecuting');
  },

  setIsBatchExecution: (isBatch) => {
    set({ isBatchExecution: isBatch }, false, 'execution:setIsBatchExecution');
  },

  // 優化的進度動作 - 防止相同值重複更新
  setProgress: (progressUpdate) => {
    storeDevtools.warnOnFrequentUpdates('execution:setProgress', 20);
    
    const currentState = get();
    // 只有在值實際改變時才更新
    const hasChanged = Object.keys(progressUpdate).some(
      key => currentState.progress[key as keyof typeof currentState.progress] !== progressUpdate[key as keyof typeof progressUpdate]
    );
    
    if (hasChanged) {
      set(
        (state) => ({
          progress: { ...state.progress, ...progressUpdate },
        }),
        false,
        'execution:setProgress'
      );
    }
  },

  // 統一的進度可見性控制
  setProgressVisibility: (type: 'normal' | 'batch', visible: boolean, initialData?: { percentage?: number; totalDevices?: number }) => {
    storeDevtools.measurePerformance('execution:setProgressVisibility', () => {
      if (type === 'normal') {
        set(
          {
            progress: {
              isVisible: visible,
              percentage: visible ? (initialData?.percentage || 0) : 0,
            },
          },
          false,
          'execution:setProgressVisibility-normal'
        );
      } else {
        set(
          {
            batchProgress: {
              isVisible: visible,
              totalDevices: visible ? (initialData?.totalDevices || 0) : 0,
              completedDevices: 0,
              currentStage: undefined,
              stageMessage: undefined,
            },
          },
          false,
          'execution:setProgressVisibility-batch'
        );
      }
    });
  },

  setBatchProgress: (progressUpdate) => {
    storeDevtools.warnOnFrequentUpdates('execution:setBatchProgress', 15);
    
    const currentState = get();
    // 處理 completedDevices 更新的特殊邏輯
    if ('completedDevices' in progressUpdate) {
      const completedDevices = progressUpdate.completedDevices!;
      // 只有在進度實際增加時才更新（防止重複或倒退）
      if (completedDevices <= currentState.batchProgress.completedDevices) {
        return;
      }
    }
    
    // 防止相同值的重複更新
    const hasChanged = Object.keys(progressUpdate).some(
      key => currentState.batchProgress[key as keyof typeof currentState.batchProgress] !== progressUpdate[key as keyof typeof progressUpdate]
    );
    
    if (hasChanged) {
      set(
        (state) => ({
          batchProgress: { ...state.batchProgress, ...progressUpdate },
        }),
        false,
        'execution:setBatchProgress'
      );
    }
  },

  // 執行時間戳動作
  setExecutionStartTime: (timestamp) => {
    set({ executionStartTime: timestamp }, false, 'execution:setExecutionStartTime');
  },

  // =============================================================================
  // 非同步任務管理動作
  // =============================================================================

  setCurrentTask: (task) => {
    set({ currentTask: task }, false, 'execution:setCurrentTask');
  },

  setIsAsyncMode: (isAsync) => {
    set({ isAsyncMode: isAsync }, false, 'execution:setIsAsyncMode');
  },

  setTaskPollingActive: (active) => {
    set({ taskPollingActive: active }, false, 'execution:setTaskPollingActive');
  },

  updateTaskProgress: (taskId, progress, stage) => {
    const currentState = get();
    // 只有當是當前任務且進度實際改變時才更新
    if (currentState.currentTask?.task_id === taskId) {
      const currentProgress = currentState.currentTask.progress?.percentage || 0;
      // 防止進度倒退或相同值重複更新
      if (progress > currentProgress || currentState.currentTask.progress?.current_stage !== stage) {
        set(
          (state) => ({
            currentTask: {
              ...state.currentTask!,
              progress: {
                ...state.currentTask!.progress,
                percentage: progress,
                current_stage: stage,
              },
            },
            progress: {
              isVisible: true,
              percentage: progress,
            },
          }),
          false,
          'execution:updateTaskProgress'
        );
      }
    }
  },

  // =============================================================================
  // 高階集中化 Actions - 使用 storeHelpers 模組化業務邏輯
  // =============================================================================

  // 處理任務完成
  handleTaskCompletion: (taskResult) => {
    const handler = createTaskCompletionHandler(get());
    handler(taskResult);
  },

  // 處理執行開始
  handleExecutionStart: (params) => {
    const handler = createExecutionStartHandler(get());
    handler(params);
  },

  // 處理執行錯誤
  handleExecutionError: (error, context) => {
    const handler = createExecutionErrorHandler(get());
    handler(error, context);
  },

  // 處理非同步任務開始
  handleAsyncTaskStart: (taskId, deviceCount) => {
    const handler = createAsyncTaskStartHandler(get());
    handler(taskId, deviceCount);
  },
});