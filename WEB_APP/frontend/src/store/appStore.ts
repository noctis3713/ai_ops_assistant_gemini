// Zustand 應用程式狀態管理
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type AppStore, initialAppState } from '@/types';

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // 初始狀態
      ...initialAppState,

      // UI 動作
      setMode: (mode) => {
        set({ mode }, false, 'setMode');
        // 切換模式時清空輸入值
        get().setInputValue('');
      },

      setSelectedDevice: (deviceIp) => {
        set({ selectedDevice: deviceIp }, false, 'setSelectedDevice');
      },

      setDeviceSelectionMode: (mode) => {
        set({ deviceSelectionMode: mode }, false, 'setDeviceSelectionMode');
        // 目前只支援 multiple 模式，暫時保留空的處理邏輯
      },

      setSelectedDevices: (deviceIps) => {
        set({ selectedDevices: deviceIps }, false, 'setSelectedDevices');
      },

      setSelectedGroup: (groupName) => {
        set({ selectedGroup: groupName }, false, 'setSelectedGroup');
      },

      setInputValue: (value) => {
        set({ inputValue: value }, false, 'setInputValue');
      },

      // 執行狀態動作
      setIsExecuting: (isExecuting) => {
        set({ isExecuting }, false, 'setIsExecuting');
      },

      setIsBatchExecution: (isBatch) => {
        set({ isBatchExecution: isBatch }, false, 'setIsBatchExecution');
      },

      // 簡化的進度動作
      setProgress: (progressUpdate) => {
        set(
          (state) => ({
            progress: { ...state.progress, ...progressUpdate },
          }),
          false,
          'setProgress'
        );
      },

      showProgress: (percentage = 0) => {
        set(
          {
            progress: {
              isVisible: true,
              percentage,
            },
          },
          false,
          'showProgress'
        );
      },

      hideProgress: () => {
        set(
          {
            progress: {
              isVisible: false,
              percentage: 0,
            },
          },
          false,
          'hideProgress'
        );
      },

      setBatchProgress: (progressUpdate) => {
        set(
          (state) => ({
            batchProgress: { ...state.batchProgress, ...progressUpdate },
          }),
          false,
          'setBatchProgress'
        );
      },

      showBatchProgress: (totalDevices) => {
        set(
          {
            batchProgress: {
              isVisible: true,
              totalDevices,
              completedDevices: 0,
            },
          },
          false,
          'showBatchProgress'
        );
      },

      updateBatchProgress: (completedDevices) => {
        set(
          (state) => ({
            batchProgress: {
              ...state.batchProgress,
              completedDevices,
            },
          }),
          false,
          'updateBatchProgress'
        );
      },

      hideBatchProgress: () => {
        set(
          {
            batchProgress: {
              isVisible: false,
              totalDevices: 0,
              completedDevices: 0,
            },
          },
          false,
          'hideBatchProgress'
        );
      },

      // 狀態訊息動作
      setStatus: (message, type) => {
        set(
          { status: { message, type } },
          false,
          'setStatus'
        );
      },

      clearStatus: () => {
        set(
          { status: { message: '', type: '' } },
          false,
          'clearStatus'
        );
      },

      // 輸出動作
      setOutput: (output, isError = false) => {
        set(
          { output, isOutputError: isError },
          false,
          'setOutput'
        );
      },

      clearOutput: () => {
        set(
          { output: '等待指令執行...', isOutputError: false },
          false,
          'clearOutput'
        );
      },

      setBatchResults: (results) => {
        set({ batchResults: results }, false, 'setBatchResults');
      },

      clearBatchResults: () => {
        set({ batchResults: [] }, false, 'clearBatchResults');
      },

      // 執行時間戳動作
      setExecutionStartTime: (timestamp) => {
        set({ executionStartTime: timestamp }, false, 'setExecutionStartTime');
      },

      clearExecutionStartTime: () => {
        set({ executionStartTime: null }, false, 'clearExecutionStartTime');
      },

      // 重置動作
      reset: () => {
        set(
          initialAppState,
          false,
          'reset'
        );
      },

      // =============================================================================
      // 非同步任務管理動作
      // =============================================================================

      setCurrentTask: (task) => {
        set({ currentTask: task }, false, 'setCurrentTask');
      },

      setIsAsyncMode: (isAsync) => {
        set({ isAsyncMode: isAsync }, false, 'setIsAsyncMode');
      },


      updateTaskProgress: (taskId, progress, stage) => {
        set(
          (state) => {
            // 確保是當前任務才更新進度
            if (state.currentTask?.task_id === taskId) {
              return {
                currentTask: {
                  ...state.currentTask,
                  progress: {
                    ...state.currentTask.progress,
                    percentage: progress,
                    current_stage: stage,
                  },
                },
                progress: {
                  isVisible: true,
                  percentage: progress,
                },
              };
            }
            return state;
          },
          false,
          'updateTaskProgress'
        );
      },
    }),
    {
      name: 'app-store', // 用於 Redux DevTools
    }
  )
);