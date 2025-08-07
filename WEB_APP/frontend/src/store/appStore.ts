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
        
        // 類型安全的結果設定
        if (taskResult && typeof taskResult === 'object' && 'results' in taskResult && Array.isArray(taskResult.results)) {
          setBatchResults(taskResult.results);
        }
        
        // 類型安全的統計資訊取得
        const summary = (taskResult && typeof taskResult === 'object' && 'summary' in taskResult) ? taskResult.summary as Record<string, unknown> : {};
        const successCount = Number(summary?.successful) || 0;
        const failedCount = Number(summary?.failed) || 0;
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
        
        // 類型安全的錯誤訊息處理
        const errorMessage = typeof error === 'string' ? error 
          : error instanceof Error ? error.message 
          : (error && typeof error === 'object' && 'message' in error) ? String((error as Record<string, unknown>).message) 
          : '執行失敗';
        
        // 根據上下文調整錯誤訊息
        const finalErrorMessage = context ? `${context}: ${errorMessage}` : errorMessage;
        
        setStatus(finalErrorMessage, 'error');
        
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

      /**
       * 批次更新設備選擇和輸入狀態
       * 減少多個狀態更新調用
       */
      updateSelectionAndInput: (devices: string[], input: string, mode?: 'command' | 'ai') => {
        const { setSelectedDevices, setInputValue, setMode } = get();
        
        // 批次更新多個相關狀態
        setSelectedDevices(devices);
        setInputValue(input);
        if (mode) {
          setMode(mode);
        }
      },

      /**
       * 智能狀態切換 - 根據當前狀態自動決定下一步操作
       * 提供常見操作場景的一鍵完成
       */
      smartToggle: (action: 'clear_all' | 'restart_execution' | 'switch_mode') => {
        const state = get();
        
        switch (action) {
          case 'clear_all':
            // 清空所有內容和結果
            state.setSelectedDevices([]);
            state.setInputValue('');
            state.clearBatchResults();
            state.clearStatus();
            state.hideBatchProgress();
            state.hideProgress();
            break;
            
          case 'restart_execution':
            // 保持選擇和輸入，只重置執行狀態
            state.clearBatchResults();
            state.clearStatus();
            state.hideBatchProgress();
            state.hideProgress();
            state.setIsExecuting(false);
            state.setIsBatchExecution(false);
            break;
            
          case 'switch_mode':
            // 智能切換執行模式（command ↔ ai）
            {
            const newMode = state.mode === 'command' ? 'ai' : 'command';
            state.setMode(newMode);
            // 切換模式時清空輸入，但保持設備選擇
            state.setInputValue('');
            break;
            }
        }
      },

      /**
       * 條件性狀態更新 - 只在滿足條件時才更新
       * 避免不必要的重渲染
       */
      conditionalUpdate: (updates: {
        status?: { message: string; type: 'loading' | 'success' | 'error' | 'warning' | '' };
        progress?: { percentage: number; visible?: boolean };
        batchProgress?: { completed: number; total: number; visible?: boolean };
      }) => {
        const state = get();
        
        // 只有在狀態實際改變時才更新
        if (updates.status && state.status.message !== updates.status.message) {
          state.setStatus(updates.status.message, updates.status.type);
        }
        
        if (updates.progress && state.progress.percentage !== updates.progress.percentage) {
          if (updates.progress.visible !== undefined) {
            if (updates.progress.visible) {
              state.showProgress(updates.progress.percentage);
            } else {
              state.hideProgress();
            }
          } else {
            state.setProgress({ percentage: updates.progress.percentage });
          }
        }
        
        if (updates.batchProgress && state.batchProgress.completedDevices !== updates.batchProgress.completed) {
          if (updates.batchProgress.visible !== undefined && updates.batchProgress.visible) {
            state.showBatchProgress(updates.batchProgress.total);
          }
          state.updateBatchProgress(updates.batchProgress.completed);
        }
      },
    }),
    {
      name: 'app-store', // 用於 Redux DevTools
    }
  )
);