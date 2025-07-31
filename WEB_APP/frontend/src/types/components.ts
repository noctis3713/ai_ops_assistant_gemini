// 組件相關類型定義
import { type Device, type DeviceGroup, type BatchExecutionResult } from './api';

// 執行模式
export type ExecutionMode = 'command' | 'ai';

// 設備選擇模式
export type DeviceSelectionMode = 'multiple';

// 狀態訊息類型
export type StatusType = 'loading' | 'success' | 'error' | 'warning' | '';

export interface StatusMessage {
  message: string;
  type: StatusType;
}

// 簡化的進度狀態
export interface ProgressState {
  isVisible: boolean;
  percentage: number;
}

// 簡化的批次進度狀態
export interface BatchProgressState {
  isVisible: boolean;
  totalDevices: number;
  completedDevices: number;
}

// 組件 Props 類型

// 設備選擇模式切換器
export interface DeviceSelectionModeSwitchProps {
  mode: DeviceSelectionMode;
  onModeChange: (mode: DeviceSelectionMode) => void;
}

// 單一設備選擇器（保持向後相容）
export interface DeviceSelectorProps {
  devices: Device[];
  selectedDevice: string;
  onDeviceChange: (deviceIp: string) => void;
  isLoading?: boolean;
}

// 設備選擇器
export interface MultiDeviceSelectorProps {
  devices: Device[];
  selectedDevices: string[];
  onDevicesChange: (deviceIps: string[]) => void;
  isLoading?: boolean;
}

// 群組選擇器
export interface GroupSelectorProps {
  groups: DeviceGroup[];
  selectedGroup: string;
  onGroupChange: (groupName: string) => void;
  isLoading?: boolean;
}

// 設備選擇容器
export interface DeviceSelectionContainerProps {
  devices: Device[];
  selectedDevices: string[];
  onDevicesChange: (deviceIps: string[]) => void;
  executionMode: ExecutionMode;
  onExecutionModeChange: (mode: ExecutionMode) => void;
  isLoading?: boolean;
}

export interface ModeSelectorProps {
  mode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
}

export interface CommandInputProps {
  value: string;
  onChange: (value: string) => void;
  mode: ExecutionMode;
  onExecute: () => void;
  isExecuting: boolean;
  placeholder?: string;
  progress?: BatchProgressState;
  status?: StatusMessage;
}

export interface ProgressIndicatorProps {
  progress: ProgressState;
}

// 批次進度指示器
export interface BatchProgressIndicatorProps {
  progress: BatchProgressState;
}

export interface StatusDisplayProps {
  status: StatusMessage;
}

// 單一設備輸出顯示（保持向後相容）
export interface OutputDisplayProps {
  output: string;
  isError: boolean;
  onClear: () => void;
}

// 批次結果顯示
export interface BatchOutputDisplayProps {
  results: BatchExecutionResult[];
  onClear: () => void;
  statusText?: string;
  statusClassName?: string;
}

// 批次結果項目
export interface BatchResultItemProps {
  result: BatchExecutionResult;
  onExpand?: (deviceIp: string) => void;
  onCopy?: (content: string) => void;
}