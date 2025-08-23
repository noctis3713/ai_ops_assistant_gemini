import { useRef } from 'react';
import { useAppStore } from '@/store';
import { 
  PROGRESS_STAGE, 
  PROGRESS_STAGE_TEXT, 
  createProgressCallback 
} from '@/config';
import { useMemoizedFn } from '@/hooks';
import { useThrottleFn } from '@/hooks';

interface ProgressManagerOptions {
  throttleMs?: number;
  aiModeMaxProgress?: number;
  commandModeMaxProgress?: number;
  aiModeInterval?: number;
  commandModeInterval?: number;
}

export const useProgressManager = (options: ProgressManagerOptions = {}) => {
  const {
    throttleMs = 200,
    aiModeMaxProgress = 0.75,
    commandModeMaxProgress = 0.85,
    aiModeInterval = 400,
    commandModeInterval = 300,
  } = options;
  
  const { 
    setProgressVisibility, 
    setBatchProgress, 
    setStatus 
  } = useAppStore();
  
  // 進度模擬相關
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressValueRef = useRef<number>(-1);
  
  // 使用統一的節流函數優化進度更新
  const { run: throttledUpdateProgress } = useThrottleFn(
    (progress: number) => setBatchProgress({ completedDevices: progress }),
    { 
      wait: throttleMs,
      leading: false,
      trailing: true 
    }
  );
  
  // 創建進度回調處理器
  const createProgressHandler = useMemoizedFn(() => {
    return createProgressCallback((update) => {
      const { setBatchProgress, setStatus } = useAppStore.getState();
      
      // 更新階段和訊息
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
  });
  
  // 開始進度模擬
  const startSimulation = useMemoizedFn((deviceCount: number, executionMode: 'ai' | 'command') => {
    // 清除之前的模擬
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    let currentProgress = 0;
    lastProgressValueRef.current = -1;
    
    // 根據模式設定參數
    const maxProgressRatio = executionMode === 'ai' ? aiModeMaxProgress : commandModeMaxProgress;
    const interval = executionMode === 'ai' ? aiModeInterval : commandModeInterval;
    
    // 計算目標進度和增量
    const maxProgress = Math.floor(deviceCount * maxProgressRatio);
    const increment = Math.max(1, Math.floor(maxProgress / 10));
    
    const progressInterval = setInterval(() => {
      if (currentProgress < maxProgress) {
        currentProgress = Math.min(currentProgress + increment, maxProgress);
        
        // 避免重複更新相同值
        if (currentProgress !== lastProgressValueRef.current) {
          lastProgressValueRef.current = currentProgress;
          throttledUpdateProgress(currentProgress);
        }
      } else {
        clearInterval(progressInterval);
        if (progressIntervalRef.current === progressInterval) {
          progressIntervalRef.current = null;
        }
      }
    }, interval);
    
    progressIntervalRef.current = progressInterval;
  });
  
  // 停止進度模擬
  const stopSimulation = useMemoizedFn(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  });
  
  // 顯示批次進度
  const showProgress = useMemoizedFn((totalDevices: number) => {
    setProgressVisibility('batch', true, { totalDevices });
  });
  
  // 隱藏批次進度
  const hideProgress = useMemoizedFn(() => {
    setProgressVisibility('batch', false);
  });
  
  // 更新進度值
  const updateProgress = useMemoizedFn((completedDevices: number) => {
    setBatchProgress({ completedDevices });
  });
  
  // 更新進度階段
  const updateStage = useMemoizedFn((stage: string, message?: string) => {
    setBatchProgress({ 
      currentStage: stage, 
      stageMessage: message || PROGRESS_STAGE_TEXT[stage]
    });
    
    if (message) {
      setStatus(message, 'loading');
    }
  });
  
  // 設置完成狀態
  const setCompletionStatus = useMemoizedFn((
    successful: number, 
    failed: number, 
    total: number
  ) => {
    const completionMessage = `執行完成：${successful} 成功，${failed} 失敗，共 ${total} 個設備`;
    setStatus(completionMessage, failed > 0 ? 'error' : 'success');
    
    // 更新最終進度
    updateProgress(total);
    updateStage(PROGRESS_STAGE.COMPLETED, completionMessage);
  });
  
  // 設置錯誤狀態
  const setErrorStatus = useMemoizedFn((errorMessage: string) => {
    const failureMessage = `執行失敗：${errorMessage}`;
    setStatus(failureMessage, 'error');
    updateStage(PROGRESS_STAGE.FAILED, failureMessage);
  });
  
  // 清理函數
  const cleanup = useMemoizedFn(() => {
    stopSimulation();
    lastProgressValueRef.current = -1;
  });
  
  return {
    // 進度處理器
    createProgressHandler,
    
    // 進度模擬
    startSimulation,
    stopSimulation,
    
    // 顯示控制
    showProgress,
    hideProgress,
    
    // 進度更新
    updateProgress,
    updateStage,
    
    // 狀態設置
    setCompletionStatus,
    setErrorStatus,
    
    // 清理
    cleanup,
    
    // 狀態查詢
    isSimulating: progressIntervalRef.current !== null,
  };
};