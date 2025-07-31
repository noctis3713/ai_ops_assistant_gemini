// 狀態管理相關類型定義
import { 
  type ExecutionMode, 
  type DeviceSelectionMode,
  type StatusMessage, 
  type ProgressState,
  type BatchProgressState
} from './components';
import { 
  type BatchExecutionResult,
  type TaskResponse
} from './api';

// 應用程式狀態
export interface AppState {
  // UI 狀態
  mode: ExecutionMode;
  deviceSelectionMode: DeviceSelectionMode;
  selectedDevice: string;
  selectedDevices: string[];
  selectedGroup: string;
  inputValue: string;
  
  // 執行狀態
  isExecuting: boolean;
  isBatchExecution: boolean;
  
  // 進度狀態
  progress: ProgressState;
  batchProgress: BatchProgressState;
  
  // 狀態訊息
  status: StatusMessage;
  
  // 輸出狀態
  output: string;
  isOutputError: boolean;
  
  // 批次結果
  batchResults: BatchExecutionResult[];
  
  // 執行時間戳
  executionStartTime: number | null;
  
  // 非同步任務狀態
  currentTask: TaskResponse | null;
  isAsyncMode: boolean;
  taskPollingActive: boolean;
}

// 狀態動作
export interface AppActions {
  // UI 動作
  setMode: (mode: ExecutionMode) => void;
  setDeviceSelectionMode: (mode: DeviceSelectionMode) => void;
  setSelectedDevice: (deviceIp: string) => void;
  setSelectedDevices: (deviceIps: string[]) => void;
  setSelectedGroup: (groupName: string) => void;
  setInputValue: (value: string) => void;
  
  // 執行狀態動作
  setIsExecuting: (isExecuting: boolean) => void;
  setIsBatchExecution: (isBatch: boolean) => void;
  
  // 簡化的進度動作
  setProgress: (progress: Partial<ProgressState>) => void;
  showProgress: (percentage?: number) => void;
  hideProgress: () => void;
  setBatchProgress: (progress: Partial<BatchProgressState>) => void;
  showBatchProgress: (totalDevices: number) => void;
  updateBatchProgress: (completedDevices: number) => void;
  hideBatchProgress: () => void;
  
  // 狀態訊息動作
  setStatus: (message: string, type: StatusMessage['type']) => void;
  clearStatus: () => void;
  
  // 輸出動作
  setOutput: (output: string, isError?: boolean) => void;
  clearOutput: () => void;
  setBatchResults: (results: BatchExecutionResult[]) => void;
  clearBatchResults: () => void;
  
  // 執行時間戳動作
  setExecutionStartTime: (timestamp: number) => void;
  clearExecutionStartTime: () => void;
  
  // 重置動作
  reset: () => void;
  
  // 非同步任務動作
  setCurrentTask: (task: TaskResponse | null) => void;
  setIsAsyncMode: (isAsync: boolean) => void;
  setTaskPollingActive: (active: boolean) => void;
  updateTaskProgress: (taskId: string, progress: number, stage: string) => void;
}

// 完整的 Store 類型
export type AppStore = AppState & AppActions;

// 初始狀態
export const initialAppState: AppState = {
  mode: 'command',
  deviceSelectionMode: 'multiple',
  selectedDevice: '',
  selectedDevices: [],
  selectedGroup: '',
  inputValue: '',
  isExecuting: false,
  isBatchExecution: false,
  progress: {
    isVisible: false,
    percentage: 0,
  },
  batchProgress: {
    isVisible: false,
    totalDevices: 0,
    completedDevices: 0,
  },
  status: {
    message: '',
    type: '',
  },
  output: '等待指令執行...',
  isOutputError: false,
  batchResults: [],
  executionStartTime: null,
  currentTask: null,
  isAsyncMode: false,
  taskPollingActive: false,
};