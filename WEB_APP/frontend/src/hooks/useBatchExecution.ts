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
    setExecutionStartTime,
    mode 
  } = useAppStore();
  
  // 使用 ref 來追蹤執行狀態，防止重複執行
  const isExecutingRef = useRef(false);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // 模擬批次進度更新 - 使用遞增邏輯避免進度倒退
  const simulateProgress = useCallback((deviceCount: number) => {
    let currentCompleted = 0;
    const maxProgress = Math.max(1, deviceCount - 1); // 保留最後一個設備給實際完成時更新
    const incrementStep = Math.max(1, Math.ceil(maxProgress / 10)); // 每次增加的步長
    
    const progressInterval = setInterval(() => {
      if (isExecutingRef.current && currentCompleted < maxProgress) {
        // 漸進式增加完成數量，確保進度只會前進
        currentCompleted = Math.min(currentCompleted + incrementStep, maxProgress);
        updateBatchProgress(currentCompleted);
      } else {
        clearInterval(progressInterval);
      }
    }, 800); // 稍微加快更新頻率
    
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
      setStatus('準備執行...', 'loading');
      clearBatchResults();
      
      // 記錄執行開始時間
      setExecutionStartTime(Date.now());
      
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      
      // 顯示批次進度
      showBatchProgress(variables.devices.length);
      
      // 開始模擬進度
      setTimeout(() => {
        if (isExecutingRef.current) {
          const deviceCount = variables.devices.length;
          const statusText = deviceCount === 1 
            ? '執行中... (1 個設備)' 
            : `執行中... (${deviceCount} 個設備)`;
          setStatus(statusText, 'loading');
          
          // 清除之前的進度 interval（如果存在）
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          
          // 啟動新的進度模擬
          progressIntervalRef.current = simulateProgress(deviceCount);
        }
      }, 1000);
    },
    onSuccess: (response) => {
      if (isExecutingRef.current) {
        // 先設置批次結果，確保結果立即可用
        setBatchResults(response.results);
        
        const { successful, failed, total } = response.summary;
        setStatus(
          `執行完成：${successful} 成功，${failed} 失敗，共 ${total} 個設備`, 
          failed > 0 ? 'error' : 'success'
        );
        
        // 更新最終進度
        updateBatchProgress(response.summary.total);
        
        // 延長狀態顯示時間，確保用戶能看到結果
        clearStateWithDelay(8000);
      }
    },
    onError: (error) => {
      if (isExecutingRef.current) {
        // 立即重置執行狀態，確保按鈕狀態恢復
        isExecutingRef.current = false;
        setIsBatchExecution(false);
        
        // 清理進度追蹤
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        // 隱藏進度條並顯示錯誤訊息
        hideBatchProgress();
        
        // 提供用戶友善的錯誤訊息
        let errorMessage = error.message;
        if (errorMessage.includes('Google Gemini API 免費額度已用完')) {
          errorMessage = 'AI 服務配額已用完，請稍後再試或聯繫管理員';
        } else if (errorMessage.includes('API 認證失敗')) {
          errorMessage = 'AI 服務認證失敗，請聯繫管理員檢查設定';
        } else if (errorMessage.includes('網路連接問題')) {
          errorMessage = '網路連接異常，請檢查網路連接後重試';
        }
        
        setStatus(`執行失敗：${errorMessage}`, 'error');
        
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
    // 防止重複執行
    if (isExecutingRef.current || batchMutation.isPending) {
      setStatus('操作正在進行中，請稍候...', 'error');
      return;
    }

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

    try {
      batchMutation.mutate({
        devices: deviceIps,
        command: command.trim(),
        mode: mode
      });
    } catch (error) {
      // 確保捕捉到的錯誤也會重置狀態
      isExecutingRef.current = false;
      setIsBatchExecution(false);
      hideBatchProgress();
      
      if (error instanceof Error) {
        setStatus(`執行失敗: ${error.message}`, 'error');
        clearStateWithDelay(8000);
      }
    }
  }, [batchMutation, mode, setStatus, clearStateWithDelay, setIsBatchExecution, hideBatchProgress]);

  // 清理函數
  const cleanup = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    isExecutingRef.current = false;
  }, []);

  return {
    executeBatch,  // 統一的執行函數，處理所有場景
    cleanup,
    isBatchExecuting: batchMutation.isPending || isExecutingRef.current,
    batchError: batchMutation.error,
  };
};