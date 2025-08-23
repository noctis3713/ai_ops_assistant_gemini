import { useTransition, useEffect } from 'react';
import { useAppStore } from '@/store';
import { PROGRESS_STAGE } from '@/config';
import { useMemoizedFn, useCreation } from '@/hooks';
import { useExecutionCore } from './useExecutionCore';
import { useProgressManager } from './useProgressManager';
import { useBatchMutation } from './useBatchMutation';

export const useBatchExecution = () => {
  const { 
    mode,
    setIsBatchExecution,
    clearExecutionData,
  } = useAppStore();
  
  // React 19: 使用 useTransition 管理非緊急狀態更新
  const [isPendingTransition, startTransition] = useTransition();
  
  // 使用 3 個核心 Hook
  const execution = useExecutionCore({ 
    debounceDelay: 1000, 
    keepResults: true 
  });
  
  const progress = useProgressManager({
    throttleMs: 200,
    aiModeMaxProgress: 0.75,
    commandModeMaxProgress: 0.85,
    aiModeInterval: 400,
    commandModeInterval: 300,
  });
  
  // 進度階段流程處理
  const handleProgressFlow = useMemoizedFn((deviceCount: number, executionMode: string) => {
    const progressHandler = progress.createProgressHandler();
    
    // 第一階段：提交任務
    progressHandler.updateStage(PROGRESS_STAGE.SUBMITTING);
    
    // 動態計算延遲時間
    const baseDelay = {
      submitted: 200,
      connecting: 300,
      executing: 500 + Math.min(deviceCount * 100, 500)
    };
    
    // 延遲顯示已提交狀態
    setTimeout(() => {
      if (execution.isExecuting) {
        progressHandler.updateStage(PROGRESS_STAGE.SUBMITTED);
        
        // 顯示連接狀態
        setTimeout(() => {
          if (execution.isExecuting) {
            progressHandler.updateStage(PROGRESS_STAGE.CONNECTING);
            
            // 開始執行階段並啟動進度模擬
            setTimeout(() => {
              if (execution.isExecuting) {
                const message = deviceCount === 1 
                  ? '執行中... (1 個設備)' 
                  : `執行中... (${deviceCount} 個設備)`;
                
                progressHandler.updateStage(
                  executionMode === 'ai' ? PROGRESS_STAGE.AI_ANALYZING : PROGRESS_STAGE.EXECUTING,
                  message
                );
                
                // 啟動進度模擬
                progress.startSimulation(deviceCount, executionMode as 'ai' | 'command');
              }
            }, baseDelay.executing);
          }
        }, baseDelay.connecting);
      }
    }, baseDelay.submitted);
  });
  
  // 建立穩定的 mutation 回調
  const mutationCallbacks = useCreation(() => ({
    onStart: (variables: BatchExecuteRequest) => {
      execution.startExecution();
      setIsBatchExecution(true);
      clearExecutionData({ results: true });
      
      // 顯示批次進度
      progress.showProgress(variables.devices.length);
      
      // 開始進度階段流程
      handleProgressFlow(variables.devices.length, variables.mode);
    },
    
    onSuccess: (response: BatchExecutionResponse) => {
      // 立即清除進度模擬
      progress.stopSimulation();
      
      // 確保 results 陣列存在且有效
      const results = Array.isArray(response.results) ? response.results : [];
      const summary = response.summary || { 
        total: results.length, 
        successful: 0, 
        failed: results.length 
      };
      
      // 設置完成狀態
      progress.setCompletionStatus(
        summary.successful || 0,
        summary.failed || 0,
        summary.total || results.length
      );
      
      // 延長狀態顯示時間
      execution.scheduleCleanup(8000);
    },
    
    onError: (error: APIError) => {
      // 立即清除進度模擬
      progress.stopSimulation();
      
      // 立即重置執行狀態
      execution.finishExecution();
      setIsBatchExecution(false);
      
      // 提供用戶友善的錯誤訊息
      let errorMessage = error.message;
      if (errorMessage.includes('Google Gemini API 免費額度已用完')) {
        errorMessage = 'AI 服務配額已用完，請稍後再試或聯繫管理員';
      } else if (errorMessage.includes('API 認證失敗')) {
        errorMessage = 'AI 服務認證失敗，請聯繫管理員檢查設定';
      } else if (errorMessage.includes('網路連接問題')) {
        errorMessage = '網路連接異常，請檢查網路連接後重試';
      }
      
      // 設置錯誤狀態
      progress.setErrorStatus(errorMessage);
      
      // 延長錯誤顯示時間
      setTimeout(() => {
        progress.hideProgress();
      }, 8000);
      
      execution.scheduleCleanup(12000);
    },
    
    onSettled: () => {
      // 確保執行狀態已重置
      execution.finishExecution();
      setIsBatchExecution(false);
      
      // 清理進度模擬
      progress.cleanup();
    },
  }), [execution, progress, setIsBatchExecution, clearExecutionData, handleProgressFlow]);
  
  const batchMutation = useBatchMutation(mutationCallbacks);
  
  // 統一的執行函數 - 使用 useMemoizedFn 確保穩定引用
  const executeBatch = useMemoizedFn((deviceIps: string[], command: string) => {
    const { setStatus } = useAppStore.getState();
    
    // 檢查是否可以執行
    if (!execution.canExecute()) {
      setStatus(
        execution.isExecuting 
          ? '操作正在進行中，請稍候...' 
          : '請勿快速重複點擊，請稍候...', 
        'warning'
      );
      return;
    }
    
    // React 19: useTransition 優化
    if (isPendingTransition) {
      setStatus('操作正在進行中，請稍候...', 'error');
      return;
    }
    
    // 輸入驗證
    if (deviceIps.length === 0) {
      setStatus('請選擇要執行的設備', 'error');
      execution.scheduleCleanup(3000);
      return;
    }
    
    if (!command.trim()) {
      setStatus(mode === 'ai' ? '請輸入問題' : '請輸入指令', 'error');
      execution.scheduleCleanup(3000);
      return;
    }
    
    // 清理之前的狀態
    execution.clearAllTimeouts();
    progress.cleanup();
    
    try {
      // React 19: 使用 startTransition 標記批次執行為非緊急更新
      startTransition(() => {
        batchMutation.mutate({
          devices: deviceIps,
          command: command.trim(),
          mode
        });
      });
    } catch (error) {
      // 錯誤處理
      execution.finishExecution();
      setIsBatchExecution(false);
      progress.hideProgress();
      execution.resetExecutionTime();
      
      // 清理殘留的進度模擬
      progress.cleanup();
      
      if (error instanceof Error) {
        setStatus(`執行失敗: ${error.message}`, 'error');
        execution.scheduleCleanup(8000);
      }
    }
  });
  
  // 組件卸載時清理
  useEffect(() => {
    return () => {
      execution.clearAllTimeouts();
      progress.cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // execution 和 progress 通過 useMemoizedFn 穩定化，不需要依賴
  
  return {
    // 主要功能
    executeBatch,
    cleanup: execution.clearAllTimeouts,
    
    // 狀態
    isBatchExecuting: batchMutation.isPending || execution.isExecuting || isPendingTransition,
    batchError: batchMutation.error,
    
    // React 19: 新增 Transition 狀態暴露
    isPendingTransition,
  };
};