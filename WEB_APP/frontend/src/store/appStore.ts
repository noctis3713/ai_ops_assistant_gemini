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


      setSelectedDevices: (deviceIps) => {
        set({ selectedDevices: deviceIps }, false, 'setSelectedDevices');
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
              currentStage: undefined,
              stageMessage: undefined,
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
              currentStage: undefined,
              stageMessage: undefined,
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

      // =============================================================================
      // 非同步任務管理動作
      // =============================================================================

      setCurrentTask: (task) => {
        set({ currentTask: task }, false, 'setCurrentTask');
      },

      setIsAsyncMode: (isAsync) => {
        set({ isAsyncMode: isAsync }, false, 'setIsAsyncMode');
      },

      setTaskPollingActive: (active) => {
        set({ taskPollingActive: active }, false, 'setTaskPollingActive');
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

      // =============================================================================
      // 高階集中化 Actions - 減少 Hook 中的零散調用
      // =============================================================================

      /**
       * 處理任務完成的統一函數
       * 集中處理所有任務完成後需要的狀態更新
       */
      handleTaskCompletion: (taskResult) => {
        const { setBatchResults, setStatus, hideBatchProgress, setIsExecuting, setIsBatchExecution, clearExecutionStartTime } = get();
        
        // 設定批次結果
        if (taskResult && taskResult.results) {
          setBatchResults(taskResult.results);
        }
        
        // 更新狀態訊息
        const successCount = taskResult?.summary?.successful || 0;
        const failedCount = taskResult?.summary?.failed || 0;
        setStatus(`執行完成: ${successCount} 成功, ${failedCount} 失敗`, 'success');
        
        // 隱藏進度並清除執行狀態
        hideBatchProgress();
        setIsExecuting(false);
        setIsBatchExecution(false);
        clearExecutionStartTime();
      },

      /**
       * 處理執行開始的統一函數
       * 集中處理所有執行開始時需要的狀態更新
       */
      handleExecutionStart: (params) => {
        const { 
          setIsExecuting, 
          setIsBatchExecution, 
          showBatchProgress, 
          setExecutionStartTime, 
          clearBatchResults,
          clearStatus 
        } = get();
        
        const { deviceCount, isBatch = false } = params;
        
        // 清除之前的結果和狀態
        clearBatchResults();
        clearStatus();
        
        // 設定執行狀態
        setIsExecuting(true);
        if (isBatch) {
          setIsBatchExecution(true);
          showBatchProgress(deviceCount);
        }
        
        // 記錄執行開始時間
        setExecutionStartTime(Date.now());
      },

      /**
       * 處理執行錯誤的統一函數
       * 集中處理所有執行錯誤時需要的狀態更新
       */
      handleExecutionError: (error, context) => {
        const { setStatus, hideBatchProgress, setIsExecuting, setIsBatchExecution } = get();
        
        // 設定錯誤狀態
        let errorMessage = '執行失敗';
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String((error as any).message);
        }
        
        // 根據上下文調整錯誤訊息
        if (context) {
          errorMessage = `${context}: ${errorMessage}`;
        }
        
        setStatus(errorMessage, 'error');
        
        // 清除執行狀態
        hideBatchProgress();
        setIsExecuting(false);
        setIsBatchExecution(false);
      },

      /**
       * 處理非同步任務開始的統一函數
       * 集中處理非同步任務相關的狀態更新
       */
      handleAsyncTaskStart: (taskId, deviceCount) => {
        const { 
          setCurrentTask, 
          setIsAsyncMode, 
          setTaskPollingActive, 
          showBatchProgress,
          setExecutionStartTime,
          clearBatchResults 
        } = get();
        
        // 清除之前的結果
        clearBatchResults();
        
        // 設定非同步任務狀態
        setIsAsyncMode(true);
        setTaskPollingActive(true);
        showBatchProgress(deviceCount);
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
      },

      /**
       * 重置所有執行相關狀態的統一函數
       * 用於組件卸載或重置時使用
       */
      resetExecutionState: () => {
        const { 
          setIsExecuting, 
          setIsBatchExecution, 
          hideBatchProgress, 
          hideProgress,
          clearStatus, 
          clearBatchResults,
          clearExecutionStartTime,
          setIsAsyncMode,
          setTaskPollingActive,
          setCurrentTask
        } = get();
        
        // 重置所有執行相關狀態
        setIsExecuting(false);
        setIsBatchExecution(false);
        hideBatchProgress();
        hideProgress();
        clearStatus();
        clearBatchResults();
        clearExecutionStartTime();
        
        // 重置非同步任務狀態
        setIsAsyncMode(false);
        setTaskPollingActive(false);
        setCurrentTask(null);
      },
    }),
    {
      name: 'app-store', // 用於 Redux DevTools
    }
  )
);