import { useMutation } from '@tanstack/react-query';
import { createDeviceCommandTask, createAIQueryTask, pollTaskUntilComplete } from '@/api';
import { 
  type BatchExecuteRequest, 
  type BatchExecutionResponse,
  type APIError 
} from '@/types';
import { useAppStore } from '@/store';
import { logError, logSystemInfo } from '@/errors';
import { useMemoizedFn, useCreation } from '@/hooks';

interface BatchMutationCallbacks {
  onStart?: (variables: BatchExecuteRequest) => void;
  onSuccess?: (response: BatchExecutionResponse) => void;
  onError?: (error: APIError) => void;
  onSettled?: () => void;
}

export const useBatchMutation = (callbacks: BatchMutationCallbacks = {}) => {
  const { 
    setExecutionStartTime,
    setBatchResults,
    setStatus 
  } = useAppStore();
  
  // 穩定回調函數 - 統一調用 hooks 避免條件調用
  const memoizedOnStart = useMemoizedFn(callbacks.onStart || (() => {}));
  const memoizedOnSuccess = useMemoizedFn(callbacks.onSuccess || (() => {}));
  const memoizedOnError = useMemoizedFn(callbacks.onError || (() => {}));
  const memoizedOnSettled = useMemoizedFn(callbacks.onSettled || (() => {}));
  
  // 使用 useCreation 穩定回調物件
  const stableCallbacks = useCreation(() => ({
    onStart: callbacks.onStart ? memoizedOnStart : undefined,
    onSuccess: callbacks.onSuccess ? memoizedOnSuccess : undefined,
    onError: callbacks.onError ? memoizedOnError : undefined,
    onSettled: callbacks.onSettled ? memoizedOnSettled : undefined,
  }), [callbacks.onStart, callbacks.onSuccess, callbacks.onError, callbacks.onSettled, memoizedOnStart, memoizedOnSuccess, memoizedOnError, memoizedOnSettled]);
  
  // 錯誤訊息映射函數
  const mapErrorMessage = useMemoizedFn((errorMessage: string): string => {
    if (errorMessage.includes('Google Gemini API 免費額度已用完')) {
      return 'AI 服務配額已用完，請稍後再試或聯繫管理員';
    } else if (errorMessage.includes('API 認證失敗')) {
      return 'AI 服務認證失敗，請聯繫管理員檢查設定';
    } else if (errorMessage.includes('網路連接問題')) {
      return '網路連接異常，請檢查網路連接後重試';
    }
    return errorMessage;
  });
  
  const mutation = useMutation<BatchExecutionResponse, APIError, BatchExecuteRequest>({
    mutationFn: async (request: BatchExecuteRequest) => {
      // 根據模式選擇對應的任務創建函數
      let taskId: string;
      if (request.mode === 'ai') {
        taskId = await createAIQueryTask(request.devices, request.command);
      } else {
        taskId = await createDeviceCommandTask(request.devices, request.command);
      }
      
      // 輪詢任務直到完成
      const result = await pollTaskUntilComplete(taskId);
      
      // 轉換為原有的 BatchExecutionResponse 格式
      return {
        results: result.results?.results || [],
        summary: result.results?.summary || { total: 0, successful: 0, failed: 0 }
      };
    },
    
    onMutate: (variables) => {
      // 記錄執行開始時間
      setExecutionStartTime(Date.now());
      
      // 呼叫外部回調
      stableCallbacks.onStart?.(variables);
    },
    
    onSuccess: (response) => {
      // 驗證回應資料格式
      if (!response) {
        logError('批次執行成功但回應為空', { response });
        setStatus('執行完成，但未收到結果資料', 'warning');
        return;
      }
      
      // 確保 results 陣列存在且有效
      const results = Array.isArray(response.results) ? response.results : [];
      if (results.length === 0) {
        logError('批次執行成功但結果陣列為空', { response });
      }
      
      // 驗證 summary 物件存在
      const summary = response.summary || { 
        total: results.length, 
        successful: 0, 
        failed: results.length 
      };
      
      try {
        // 設置批次結果
        setBatchResults(results);
        
        // 記錄成功資訊
        logSystemInfo('批次執行成功完成', {
          total: summary.total,
          successful: summary.successful,
          failed: summary.failed,
          resultsLength: results.length
        });
        
        // 呼叫外部回調
        stableCallbacks.onSuccess?.(response);
        
      } catch (error) {
        logError('處理批次執行成功回應時發生錯誤', {
          error: error instanceof Error ? error.message : String(error),
          response
        });
        setStatus('執行完成，但處理結果時發生問題', 'warning');
      }
    },
    
    onError: (error) => {
      // 提供用戶友善的錯誤訊息
      const friendlyMessage = mapErrorMessage(error.message);
      
      // 記錄錯誤
      logError('批次執行失敗', { 
        originalError: error.message,
        friendlyMessage 
      });
      
      // 呼叫外部回調
      stableCallbacks.onError?.(error);
    },
    
    onSettled: () => {
      // 呼叫外部回調
      stableCallbacks.onSettled?.();
    },
  });
  
  return {
    ...mutation,
    
    // 輔助方法
    executeRequest: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};