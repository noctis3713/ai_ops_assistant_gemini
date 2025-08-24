// 狀態管理相關類型定義
import { 
  type ExecutionMode, 
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
  selectedDevices: string[];
  inputValue: string;
  
  // 執行狀態
  isExecuting: boolean;
  
  // 進度狀態
  progress: ProgressState;
  batchProgress: BatchProgressState;
  
  // 狀態訊息
  status: StatusMessage;
  
  
  // 批次結果
  batchResults: BatchExecutionResult[];
  
  // 執行時間戳
  executionStartTime: number | null;
  
  // 非同步任務狀態
  currentTask: TaskResponse | null;
  taskPollingActive: boolean;
}

// 狀態動作
export interface AppActions {
  // UI 動作
  setMode: (mode: ExecutionMode) => void;
  setSelectedDevices: (deviceIps: string[]) => void;
  setInputValue: (value: string) => void;
  
  // 執行狀態動作
  setIsExecuting: (isExecuting: boolean) => void;
  
  // 簡化的進度動作
  setProgress: (progress: Partial<ProgressState>) => void;
  setBatchProgress: (progress: Partial<BatchProgressState>) => void;
  // 統一的進度可見性控制
  setProgressVisibility: (type: 'normal' | 'batch', visible: boolean, initialData?: { percentage?: number; totalDevices?: number }) => void;
  
  // 狀態訊息動作
  setStatus: (message: string, type: StatusMessage['type']) => void;
  
  // 批次結果動作
  setBatchResults: (results: BatchExecutionResult[]) => void;
  
  // 執行時間戳動作
  setExecutionStartTime: (timestamp: number) => void;
  
  // 統一的清理執行資料
  clearExecutionData: (options?: { status?: boolean; results?: boolean; timestamp?: boolean }) => void;
  
  // 非同步任務動作
  setCurrentTask: (task: TaskResponse | null) => void;
    setTaskPollingActive: (active: boolean) => void;
  updateTaskProgress: (taskId: string, progress: number, stage: string) => void;
  
  // =============================================================================
  // 高階集中化 Actions - 減少 Hook 中的零散調用
  // =============================================================================
  
  /**
   * 處理任務完成的統一函數
   * 集中處理所有任務完成後需要的狀態更新
   */
  handleTaskCompletion: (taskResult: unknown) => void;
  
  /**
   * 處理執行開始的統一函數
   * 集中處理所有執行開始時需要的狀態更新
   */
  handleExecutionStart: (params: { deviceCount: number; isBatch?: boolean }) => void;
  
  /**
   * 處理執行錯誤的統一函數
   * 集中處理所有執行錯誤時需要的狀態更新
   */
  handleExecutionError: (error: unknown, context?: string) => void;
  
  /**
   * 處理非同步任務開始的統一函數
   * 集中處理非同步任務相關的狀態更新
   */
  handleAsyncTaskStart: (taskId: string, deviceCount: number) => void;
  
  /**
   * 重置所有執行相關狀態的統一函數
   * 用於組件卸載或重置時使用
   */
  resetExecutionState: () => void;
  
  /**
   * 批次更新設備選擇和輸入狀態
   * 減少多個狀態更新調用
   */
  updateSelectionAndInput: (devices: string[], input: string, mode?: ExecutionMode) => void;
  
  /**
   * 智能狀態切換 - 根據當前狀態自動決定下一步操作
   * 提供常見操作場景的一鍵完成
   */
  smartToggle: (action: 'clear_all' | 'restart_execution' | 'switch_mode') => void;
  
  /**
   * 條件性狀態更新 - 只在滿足條件時才更新
   * 避免不必要的重渲染
   */
  conditionalUpdate: (updates: {
    status?: { message: string; type: StatusMessage['type'] };
    progress?: { percentage: number; visible?: boolean };
    batchProgress?: { completed: number; total: number; visible?: boolean };
  }) => void;
}

// =============================================================================
// 切片介面定義 - Slices Pattern 支援
// =============================================================================

// 設備相關切片
export interface DeviceSlice {
  // 狀態
  selectedDevices: string[];
  batchResults: BatchExecutionResult[];
  
  // 動作
  setSelectedDevices: (deviceIps: string[]) => void;
  setBatchResults: (results: BatchExecutionResult[]) => void;
}

// UI 相關切片
export interface UiSlice {
  // 狀態
  mode: ExecutionMode;
  inputValue: string;
  status: StatusMessage;
  
  // 動作
  setMode: (mode: ExecutionMode) => void;
  setInputValue: (value: string) => void;
  setStatus: (message: string, type: StatusMessage['type']) => void;
}

// 執行相關切片
export interface ExecutionSlice {
  // 狀態
  isExecuting: boolean;
  progress: ProgressState;
  batchProgress: BatchProgressState;
  executionStartTime: number | null;
  
  // 非同步任務狀態
  currentTask: TaskResponse | null;
  taskPollingActive: boolean;
  
  // 基礎動作
  setIsExecuting: (isExecuting: boolean) => void;
    setProgress: (progress: Partial<ProgressState>) => void;
  setBatchProgress: (progress: Partial<BatchProgressState>) => void;
  setProgressVisibility: (type: 'normal' | 'batch', visible: boolean, initialData?: { percentage?: number; totalDevices?: number }) => void;
  setExecutionStartTime: (timestamp: number) => void;
  
  // 非同步任務動作
  setCurrentTask: (task: TaskResponse | null) => void;
    setTaskPollingActive: (active: boolean) => void;
  updateTaskProgress: (taskId: string, progress: number, stage: string) => void;
  
  // 高階動作
  handleTaskCompletion: (taskResult: unknown) => void;
  handleExecutionStart: (params: { deviceCount: number; isBatch?: boolean }) => void;
  handleExecutionError: (error: unknown, context?: string) => void;
  handleAsyncTaskStart: (taskId: string, deviceCount: number) => void;
}

// 配置和共享工具切片
export interface ConfigSlice {
  // 統一清理和重置動作
  clearExecutionData: (options?: { status?: boolean; results?: boolean; timestamp?: boolean }) => void;
  resetExecutionState: () => void;
  
  // 批次更新動作
  updateSelectionAndInput: (devices: string[], input: string, mode?: ExecutionMode) => void;
  
  // 跨切片協調動作
  smartToggle: (action: 'clear_all' | 'restart_execution' | 'switch_mode') => void;
  
  // 條件性更新動作
  conditionalUpdate: (updates: {
    status?: { message: string; type: StatusMessage['type'] };
    progress?: { percentage: number; visible?: boolean };
    batchProgress?: { completed: number; total: number; visible?: boolean };
  }) => void;
}

// 完整的 Store 類型 - 組合所有切片
export type AppStore = DeviceSlice & UiSlice & ExecutionSlice & ConfigSlice;

// 為了向下相容，保留原有的狀態和動作類型
export type LegacyAppState = AppState;
export type LegacyAppActions = AppActions;

// 初始狀態
export const initialAppState: AppState = {
  mode: 'command',
  selectedDevices: [],
  inputValue: '',
  isExecuting: false,
  progress: {
    isVisible: false,
    percentage: 0,
    currentStage: undefined,
    stageMessage: undefined,
  },
  batchProgress: {
    isVisible: false,
    totalDevices: 0,
    completedDevices: 0,
    currentStage: undefined,
    stageMessage: undefined,
  },
  status: {
    message: '',
    type: '',
  },
  batchResults: [],
  executionStartTime: null,
  currentTask: null,
  taskPollingActive: false,
};