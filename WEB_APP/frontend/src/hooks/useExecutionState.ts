/**
 * 執行狀態管理 Hook
 * 統一管理執行狀態、防重複邏輯和狀態重置
 */
import { useRef, useCallback } from 'react';
import { useAppStore } from '@/store';

interface ExecutionValidation {
  deviceIps: string[];
  command: string;
  mode: 'command' | 'ai';
}

export const useExecutionState = () => {
  const {
    setIsBatchExecution,
    setStatus,
    clearStatus,
    clearBatchResults,
    setExecutionStartTime
  } = useAppStore();
  
  // 執行狀態引用
  const isExecutingRef = useRef(false);
  const lastExecutionTimeRef = useRef<number>(0);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 防抖延遲常數
  const DEBOUNCE_DELAY = 1000; // 1秒防抖延遲

  // 檢查是否正在執行
  const isExecuting = useCallback(() => {
    return isExecutingRef.current;
  }, []);

  // 設置執行狀態
  const setExecuting = useCallback((executing: boolean) => {
    isExecutingRef.current = executing;
    setIsBatchExecution(executing);
  }, [setIsBatchExecution]);

  // 輸入驗證
  const validateExecution = useCallback((validation: ExecutionValidation): string | null => {
    if (validation.deviceIps.length === 0) {
      return '請選擇要執行的設備';
    }

    if (!validation.command.trim()) {
      return validation.mode === 'ai' ? '請輸入問題' : '請輸入指令';
    }

    return null; // 驗證通過
  }, []);

  // 防抖檢查
  const checkDebounce = useCallback((): string | null => {
    const now = Date.now();
    
    if (now - lastExecutionTimeRef.current < DEBOUNCE_DELAY) {
      return '請勿快速重複點擊，請稍候...';
    }
    
    // 更新上次執行時間
    lastExecutionTimeRef.current = now;
    return null;
  }, []);

  // 開始執行前的準備工作
  const prepareExecution = useCallback(() => {
    // 設置執行狀態
    setExecuting(true);
    clearBatchResults();
    
    // 記錄執行開始時間
    setExecutionStartTime(Date.now());
    
    // 清除之前的計時器
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, [setExecuting, clearBatchResults, setExecutionStartTime]);

  // 完成執行後的清理工作
  const completeExecution = useCallback(() => {
    setExecuting(false);
  }, [setExecuting]);

  // 執行失敗後的處理
  const failExecution = useCallback((errorMessage?: string) => {
    setExecuting(false);
    
    // 重置執行時間，允許立即重試
    lastExecutionTimeRef.current = 0;
    
    if (errorMessage) {
      setStatus(`執行失敗: ${errorMessage}`, 'error');
    }
  }, [setExecuting, setStatus]);

  // 清除狀態的統一函數
  const clearStateWithDelay = useCallback((delay = 5000) => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }
    
    clearTimeoutRef.current = setTimeout(() => {
      if (!isExecutingRef.current) {
        clearStatus();
        // 注意：不清除 batchResults，讓用戶能持續查看結果
      }
      clearTimeoutRef.current = null;
    }, delay);
  }, [clearStatus]);

  // 立即清除狀態
  const clearStateImmediate = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    clearStatus();
  }, [clearStatus]);

  // 檢查執行前置條件
  const canExecute = useCallback((validation: ExecutionValidation, isPending: boolean): { 
    canExecute: boolean; 
    errorMessage?: string 
  } => {
    // 防抖檢查
    const debounceError = checkDebounce();
    if (debounceError) {
      return { canExecute: false, errorMessage: debounceError };
    }

    // 防止重複執行
    if (isExecutingRef.current || isPending) {
      return { canExecute: false, errorMessage: '操作正在進行中，請稍候...' };
    }

    // 輸入驗證
    const validationError = validateExecution(validation);
    if (validationError) {
      return { canExecute: false, errorMessage: validationError };
    }

    return { canExecute: true };
  }, [checkDebounce, validateExecution]);

  // 重置所有執行相關狀態
  const resetExecutionState = useCallback(() => {
    isExecutingRef.current = false;
    lastExecutionTimeRef.current = 0;
    
    // 清理所有計時器
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // 重置狀態
    setIsBatchExecution(false);
  }, [setIsBatchExecution]);

  // 清理函數 - 用於組件卸載
  const cleanup = useCallback(() => {
    resetExecutionState();
    clearStateImmediate();
  }, [resetExecutionState, clearStateImmediate]);

  return {
    // 狀態檢查
    isExecuting,
    canExecute,
    
    // 執行流程管理
    prepareExecution,
    completeExecution,
    failExecution,
    
    // 狀態管理
    setExecuting,
    resetExecutionState,
    
    // 清理函數
    clearStateWithDelay,
    clearStateImmediate,
    cleanup,
    
    // 驗證函數
    validateExecution,
    checkDebounce
  };
};