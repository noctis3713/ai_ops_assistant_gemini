// 統一執行 Hook - 處理所有設備操作場景
import { useMutation } from '@tanstack/react-query';
import { useRef, useCallback } from 'react';
import { batchExecuteCommand } from '@/api';
import { 
  type BatchExecuteRequest, 
  type BatchExecutionResponse,
  type APIError 
} from '@/types';
import { useAppStore } from '@/store';
import { 
  PROGRESS_STAGE, 
  PROGRESS_STAGE_TEXT, 
  createProgressCallback 
} from '@/constants';

export const useBatchExecution = () => {
  const { 
    setIsBatchExecution,
    setStatus, 
    clearStatus, 
    setBatchResults, 
    clearBatchResults,
    showBatchProgress,
    updateBatchProgress,
    hideBatchProgress,
    setBatchProgress,
    setExecutionStartTime,
    mode 
  } = useAppStore();
  
  // 使用 ref 來追蹤執行狀態，防止重複執行
  const isExecutingRef = useRef(false);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastExecutionTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 創建進度回調處理器
  const createProgressHandler = useCallback((totalDevices: number) => {
    return createProgressCallback((update) => {
      // 更新進度條狀態
      if (update.percentage !== undefined) {
        setBatchProgress({ 
          completedDevices: Math.round((update.percentage / 100) * totalDevices)
        });
      }
      
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

  // 清除狀態的統一函數 - 只清除狀態訊息和進度，保留批次結果
  const clearStateWithDelay = useCallback((delay = 5000) => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }
    
    clearTimeoutRef.current = setTimeout(() => {
      if (!isExecutingRef.current) {
        clearStatus();
        hideBatchProgress();
        // 注意：不清除 batchResults，讓用戶能持續查看結果
      }
      clearTimeoutRef.current = null;
    }, delay);
  }, [clearStatus, hideBatchProgress]);

  // 模擬批次進度更新 - 使用平滑遞增邏輯，增加狀態保護
  const simulateProgress = useCallback((deviceCount: number) => {
    let currentCompleted = 0;
    const maxProgress = Math.max(1, deviceCount - 1); // 保留最後一個設備給實際完成時更新
    const totalSteps = Math.max(8, Math.min(deviceCount * 2, 15)); // 動態步數，根據設備數量調整
    const incrementStep = maxProgress / totalSteps;
    const updateInterval = Math.max(400, Math.min(1000, 600 + deviceCount * 50)); // 動態間隔時間
    
    const progressInterval = setInterval(() => {
      // 強化狀態檢查：確保執行狀態有效且進度未達到最大值
      if (isExecutingRef.current && currentCompleted < maxProgress && progressIntervalRef.current) {
        // 平滑遞增，確保進度自然前進
        currentCompleted = Math.min(currentCompleted + incrementStep, maxProgress);
        updateBatchProgress(Math.floor(currentCompleted));
      } else {
        // 自動清理無效的間隔
        clearInterval(progressInterval);
        if (progressIntervalRef.current === progressInterval) {
          progressIntervalRef.current = null;
        }
      }
    }, updateInterval);
    
    // 存儲 interval ID 以便清理
    return progressInterval;
  }, [updateBatchProgress]);

  // 統一的批次執行 Mutation - 處理所有設備操作場景
  const batchMutation = useMutation<BatchExecutionResponse, APIError, BatchExecuteRequest>({
    mutationFn: batchExecuteCommand,
    onMutate: (variables) => {
      if (isExecutingRef.current) {
        throw new Error('執行正在進行中，請稍候...');
      }
      
      isExecutingRef.current = true;
      setIsBatchExecution(true);
      clearBatchResults();
      
      // 記錄執行開始時間
      setExecutionStartTime(Date.now());
      
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      
      // 顯示批次進度
      showBatchProgress(variables.devices.length);
      
      // 創建進度處理器
      const progress = createProgressHandler(variables.devices.length);
      
      // 第一階段：提交任務
      progress.updateStage(PROGRESS_STAGE.SUBMITTING);
      
      // 動態計算延遲時間，根據設備數量調整
      const deviceCount = variables.devices.length;
      const baseDelay = {
        submitted: 200,      // 快速確認提交
        connecting: 300,     // 適中的連接準備時間
        executing: 500 + Math.min(deviceCount * 100, 500)  // 根據設備數量動態調整，最多增加500ms
      };

      // 延遲顯示已提交狀態
      setTimeout(() => {
        if (isExecutingRef.current) {
          progress.updateStage(PROGRESS_STAGE.SUBMITTED);
          
          // 顯示連接狀態
          setTimeout(() => {
            if (isExecutingRef.current) {
              progress.updateStage(PROGRESS_STAGE.CONNECTING);
              
              // 開始執行階段並啟動進度模擬
              setTimeout(() => {
                if (isExecutingRef.current) {
                  const message = deviceCount === 1 
                    ? '執行中... (1 個設備)' 
                    : `執行中... (${deviceCount} 個設備)`;
                  
                  progress.updateStage(
                    mode === 'ai' ? PROGRESS_STAGE.AI_ANALYZING : PROGRESS_STAGE.EXECUTING,
                    message
                  );
                  
                  // 清除之前的進度 interval（如果存在）
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                  }
                  
                  // 啟動新的進度模擬
                  progressIntervalRef.current = simulateProgress(deviceCount);
                }
              }, baseDelay.executing);
            }
          }, baseDelay.connecting);
        }
      }, baseDelay.submitted);
    },
    onSuccess: (response) => {
      if (isExecutingRef.current) {
        // 立即清除進度模擬，防止與最終結果衝突
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        // 創建進度處理器
        const progress = createProgressHandler(response.summary.total);
        
        // 先設置批次結果，確保結果立即可用
        setBatchResults(response.results);
        
        // 顯示完成階段
        progress.updateStage(PROGRESS_STAGE.COMPLETED);
        
        const { successful, failed, total } = response.summary;
        const completionMessage = `執行完成：${successful} 成功，${failed} 失敗，共 ${total} 個設備`;
        
        // 更新狀態和最終進度（確保在清除模擬後設置）
        setStatus(completionMessage, failed > 0 ? 'error' : 'success');
        updateBatchProgress(response.summary.total);
        
        // 更新完成訊息
        progress.updateMessage(completionMessage);
        
        // 延長狀態顯示時間，確保用戶能看到結果
        clearStateWithDelay(8000);
      }
    },
    onError: (error) => {
      if (isExecutingRef.current) {
        // 立即清除進度模擬，防止錯誤狀態下仍在更新進度
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        // 創建進度處理器來顯示失敗狀態
        const progress = createProgressHandler(1); // 使用 1 作為默認值
        
        // 立即重置執行狀態，確保按鈕狀態恢復
        isExecutingRef.current = false;
        setIsBatchExecution(false);
        
        // 顯示失敗階段
        progress.updateStage(PROGRESS_STAGE.FAILED);
        
        // 提供用戶友善的錯誤訊息
        let errorMessage = error.message;
        if (errorMessage.includes('Google Gemini API 免費額度已用完')) {
          errorMessage = 'AI 服務配額已用完，請稍後再試或聯繫管理員';
        } else if (errorMessage.includes('API 認證失敗')) {
          errorMessage = 'AI 服務認證失敗，請聯繫管理員檢查設定';
        } else if (errorMessage.includes('網路連接問題')) {
          errorMessage = '網路連接異常，請檢查網路連接後重試';
        }
        
        const failureMessage = `執行失敗：${errorMessage}`;
        setStatus(failureMessage, 'error');
        
        // 更新失敗訊息
        progress.updateMessage(failureMessage);
        
        // 確保進度條顯示錯誤狀態一段時間後再清理
        setTimeout(() => {
          hideBatchProgress();
        }, 8000);
        
        // 延長錯誤顯示時間，讓用戶有足夠時間閱讀
        clearStateWithDelay(12000);
      }
    },
    onSettled: () => {
      // 確保執行狀態已重置
      if (isExecutingRef.current) {
        isExecutingRef.current = false;
        setIsBatchExecution(false);
      }
      
      // 清理所有相關的 interval 和 timeout
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    },
  });

  // 統一的執行函數 - 支援所有設備操作場景
  const executeBatch = useCallback((deviceIps: string[], command: string) => {
    const now = Date.now();
    const DEBOUNCE_DELAY = 1000; // 1秒防抖延遲

    // 防抖機制：防止用戶快速連續點擊
    if (now - lastExecutionTimeRef.current < DEBOUNCE_DELAY) {
      setStatus('請勿快速重複點擊，請稍候...', 'warning');
      
      // 清除現有的防抖計時器
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // 延遲執行
      debounceTimeoutRef.current = setTimeout(() => {
        lastExecutionTimeRef.current = Date.now();
        executeBatch(deviceIps, command);
      }, DEBOUNCE_DELAY - (now - lastExecutionTimeRef.current));
      
      return;
    }

    // 防止重複執行
    if (isExecutingRef.current || batchMutation.isPending) {
      setStatus('操作正在進行中，請稍候...', 'error');
      return;
    }

    // 更新上次執行時間
    lastExecutionTimeRef.current = now;

    // 輸入驗證
    if (deviceIps.length === 0) {
      setStatus('請選擇要執行的設備', 'error');
      clearStateWithDelay(3000);
      return;
    }

    if (!command.trim()) {
      setStatus(mode === 'ai' ? '請輸入問題' : '請輸入指令', 'error');
      clearStateWithDelay(3000);
      return;
    }

    // 清理之前的狀態和計時器
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    try {
      batchMutation.mutate({
        devices: deviceIps,
        command: command.trim(),
        mode: mode
      });
    } catch (error) {
      // 確保捕捉到的錯誤也會重置狀態和清理進度模擬
      isExecutingRef.current = false;
      setIsBatchExecution(false);
      hideBatchProgress();
      lastExecutionTimeRef.current = 0; // 重置執行時間，允許立即重試
      
      // 清理可能殘留的進度模擬
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (error instanceof Error) {
        setStatus(`執行失敗: ${error.message}`, 'error');
        clearStateWithDelay(8000);
      }
    }
  }, [batchMutation, mode, setStatus, clearStateWithDelay, setIsBatchExecution, hideBatchProgress]);

  // 清理函數 - 強化進度模擬清理，防止殘留更新
  const cleanup = useCallback(() => {
    // 清理狀態顯示計時器
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    
    // 強制清理進度模擬間隔，確保不會繼續更新進度
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    // 清理防抖計時器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // 重置執行狀態
    isExecutingRef.current = false;
    lastExecutionTimeRef.current = 0;
  }, []);

  return {
    executeBatch,  // 統一的執行函數，處理所有場景
    cleanup,
    isBatchExecuting: batchMutation.isPending || isExecutingRef.current,
    batchError: batchMutation.error,
  };
};