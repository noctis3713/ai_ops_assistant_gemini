// 組件相關類型定義
import { type Device, type DeviceGroup, type BatchExecutionResult, type TaskResponse } from './api';
import { type ProgressStage } from '../config/app';

// 執行模式
export type ExecutionMode = 'command' | 'ai';

// 狀態訊息類型
export type StatusType = 'loading' | 'success' | 'error' | 'warning' | '';

export interface StatusMessage {
  message: string;
  type: StatusType;
}

// 進度階段枚舉 - 已從 '../constants' 導入

// 進度回調函數接口
export interface ProgressCallback {
  (progress: {
    percentage?: number;
    stage?: ProgressStage;
    message?: string;
    details?: Record<string, unknown>;
  }): void;
}

// 簡化的進度狀態
export interface ProgressState {
  isVisible: boolean;
  percentage: number;
  currentStage?: ProgressStage;
  stageMessage?: string;
}

// 簡化的批次進度狀態
export interface BatchProgressState {
  isVisible: boolean;
  totalDevices: number;
  completedDevices: number;
  currentStage?: ProgressStage;
  stageMessage?: string;
}

// 組件 Props 類型

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
  currentTask?: TaskResponse | null;
  taskPollingActive?: boolean;
}

// 批次結果顯示
export interface BatchOutputDisplayProps {
  results: BatchExecutionResult[];
  onClear: () => void;
}

// 批次結果項目
export interface BatchResultItemProps {
  result: BatchExecutionResult;
  onExpand?: (deviceIp: string) => void;
  onCopy?: (content: string) => void;
}