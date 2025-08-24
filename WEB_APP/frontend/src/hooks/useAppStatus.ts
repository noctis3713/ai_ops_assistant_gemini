/**
 * 應用程式狀態管理 Hook
 * 集中處理應用程式的各種狀態計算和邏輯
 */
import { useMemo } from 'react';

// 應用程式狀態類型定義
type AppStatusType = 'has_results' | 'select_device' | 'input_command' | 'waiting_result';

interface UseAppStatusProps {
  /** 是否正在進行非同步執行 */
  isAsyncExecuting: boolean;
  /** 是否正在進行輪詢 */
  isPolling: boolean;
  /** 批次結果數量 */
  batchResultsLength: number;
  /** 已選擇的設備數量 */
  selectedDevicesLength: number;
  /** 輸入值 */
  inputValue: string;
}

interface UseAppStatusReturn {
  /** 當前是否正在執行 */
  currentlyExecuting: boolean;
  /** 當前狀態類型 */
  currentStatus: AppStatusType;
  /** 狀態提示文字 */
  statusText: string;
  /** 狀態CSS類別 */
  statusClassName: string;
}

/**
 * 判斷當前應用程式狀態的 Hook
 * 
 * @param props - 狀態判斷所需的參數
 * @returns 計算後的狀態資訊
 */
export const useAppStatus = ({
  isAsyncExecuting,
  isPolling,
  batchResultsLength,
  selectedDevicesLength,
  inputValue
}: UseAppStatusProps): UseAppStatusReturn => {
  // 檢查當前執行狀態 - 只使用非同步模式
  const currentlyExecuting = useMemo(() => {
    return isAsyncExecuting || isPolling;
  }, [isAsyncExecuting, isPolling]);

  // 判斷當前狀態
  const currentStatus = useMemo((): AppStatusType => {
    // 優先級：結果 > 設備選擇 > 指令輸入 > 等待結果
    if (batchResultsLength > 0) {
      return 'has_results';
    }
    if (selectedDevicesLength === 0) {
      return 'select_device';
    }
    if (inputValue.trim() === '') {
      return 'input_command';
    }
    return 'waiting_result';
  }, [batchResultsLength, selectedDevicesLength, inputValue]);

  // 獲取狀態提示文字 - 全部設為空字串以移除底部提示
  const statusText = useMemo(() => {
    return '';
  }, []);

  // 獲取狀態CSS類別
  const statusClassName = useMemo(() => {
    const needsFlashAnimation: AppStatusType[] = ['select_device', 'input_command', 'waiting_result'];
    
    return needsFlashAnimation.includes(currentStatus) 
      ? 'status-hint status-hint-flash' 
      : 'status-hint';
  }, [currentStatus]);

  return {
    currentlyExecuting,
    currentStatus,
    statusText,
    statusClassName
  };
};