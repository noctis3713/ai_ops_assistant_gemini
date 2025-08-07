/**
 * 進度管理 Hook
 * 統一管理所有進度相關邏輯，從 useBatchExecution 中分離出來
 */
import { useRef, useCallback } from 'react';
import { useAppStore } from '@/store';
import { 
  PROGRESS_STAGE, 
  PROGRESS_STAGE_TEXT, 
  createProgressCallback 
} from '@/constants';

interface ProgressConfig {
  deviceCount: number;
  executionMode: 'command' | 'ai';
}

export const useProgressManager = () => {
  const {
    showBatchProgress,
    updateBatchProgress,
    hideBatchProgress,
    setBatchProgress,
    setStatus
  } = useAppStore();
  
  // 進度間隔的引用
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressValueRef = useRef<number>(-1);

  // 創建進度回調處理器
  const createProgressHandler = useCallback((): ReturnType<typeof createProgressCallback> => {
    return createProgressCallback((update) => {
      // 更新階段訊息
      if (update.stage) {
        setBatchProgress({ 
          currentStage: update.stage, 
          stageMessage: update.message || PROGRESS_STAGE_TEXT[update.stage]
        });
      } else if (update.message) {
        setBatchProgress({ stageMessage: update.message });
      }
      
      // 更新狀態訊息
      if (update.message) {
        setStatus(update.message, 'loading');
      }
    });
  }, [setBatchProgress, setStatus]);

  // 簡化的進度模擬
  const startProgressSimulation = useCallback((config: ProgressConfig) => {
    let currentProgress = 0;
    lastProgressValueRef.current = -1;
    
    // 根據模式設定目標進度和更新頻率
    const maxProgress = Math.floor(config.deviceCount * (config.executionMode === 'ai' ? 0.75 : 0.85));
    const increment = Math.max(1, Math.floor(maxProgress / 10));
    const interval = config.executionMode === 'ai' ? 800 : 600;
    
    const progressInterval = setInterval(() => {
      if (currentProgress < maxProgress) {
        currentProgress = Math.min(currentProgress + increment, maxProgress);
        
        if (currentProgress !== lastProgressValueRef.current) {
          lastProgressValueRef.current = currentProgress;
          updateBatchProgress(currentProgress);
        }
      } else {
        clearInterval(progressInterval);
        if (progressIntervalRef.current === progressInterval) {
          progressIntervalRef.current = null;
        }
      }
    }, interval);
    
    progressIntervalRef.current = progressInterval;
    return progressInterval;
  }, [updateBatchProgress]);

  // 停止進度模擬
  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // 初始化進度顯示
  const initializeProgress = useCallback((deviceCount: number) => {
    showBatchProgress(deviceCount);
    const progress = createProgressHandler();
    
    // 第一階段：提交任務
    progress.updateStage(PROGRESS_STAGE.SUBMITTING);
    
    return progress;
  }, [showBatchProgress, createProgressHandler]);

  // 顯示各階段進度
  const showStageProgress = useCallback((progress: ReturnType<typeof createProgressCallback>, config: ProgressConfig) => {
    const { deviceCount, executionMode } = config;
    
    // 動態計算延遲時間
    const baseDelay = {
      submitted: 200,
      connecting: 300,
      executing: 500 + Math.min(deviceCount * 100, 500)
    };

    // 顯示已提交狀態
    setTimeout(() => {
      progress.updateStage(PROGRESS_STAGE.SUBMITTED);
      
      // 顯示連接狀態
      setTimeout(() => {
        progress.updateStage(PROGRESS_STAGE.CONNECTING);
        
        // 開始執行階段
        setTimeout(() => {
          const message = deviceCount === 1 
            ? '執行中... (1 個設備)' 
            : `執行中... (${deviceCount} 個設備)`;
          
          progress.updateStage(
            executionMode === 'ai' ? PROGRESS_STAGE.AI_ANALYZING : PROGRESS_STAGE.EXECUTING,
            message
          );
          
          // 啟動進度模擬
          startProgressSimulation(config);
        }, baseDelay.executing);
      }, baseDelay.connecting);
    }, baseDelay.submitted);
  }, [startProgressSimulation]);

  // 完成進度顯示
  const completeProgress = useCallback((summary: { total: number; successful: number; failed: number }) => {
    // 立即清除進度模擬
    stopProgressSimulation();
    
    // 設置最終進度
    updateBatchProgress(summary.total);
    
    // 顯示完成階段
    const progress = createProgressHandler();
    progress.updateStage(PROGRESS_STAGE.COMPLETED);
    
    const completionMessage = `執行完成：${summary.successful} 成功，${summary.failed} 失敗，共 ${summary.total} 個設備`;
    
    // 更新狀態訊息
    setStatus(completionMessage, summary.failed > 0 ? 'error' : 'success');
    progress.updateMessage(completionMessage);
    
    return completionMessage;
  }, [stopProgressSimulation, updateBatchProgress, createProgressHandler, setStatus]);

  // 失敗進度顯示
  const failProgress = useCallback((errorMessage: string) => {
    // 立即清除進度模擬
    stopProgressSimulation();
    
    // 顯示失敗階段
    const progress = createProgressHandler();
    progress.updateStage(PROGRESS_STAGE.FAILED);
    
    const failureMessage = `執行失敗：${errorMessage}`;
    setStatus(failureMessage, 'error');
    progress.updateMessage(failureMessage);
    
    // 延遲隱藏進度條
    setTimeout(() => {
      hideBatchProgress();
    }, 8000);
    
    return failureMessage;
  }, [stopProgressSimulation, createProgressHandler, setStatus, hideBatchProgress]);

  // 清理所有進度相關資源
  const cleanup = useCallback(() => {
    stopProgressSimulation();
    lastProgressValueRef.current = -1;
  }, [stopProgressSimulation]);

  return {
    // 進度管理方法
    initializeProgress,
    showStageProgress,
    completeProgress,
    failProgress,
    cleanup,
    
    // 底層控制方法
    startProgressSimulation,
    stopProgressSimulation,
    createProgressHandler
  };
};