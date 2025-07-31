/**
 * API 相關類型定義
 */

// 設備資訊介面
export interface Device {
  ip: string;
  name: string;
  model: string;
  description: string;
}

// 設備群組介面
export interface DeviceGroup {
  name: string;
  description: string;
  device_count: number;
  platform: string;
}

// 設備列表回應介面
export interface DevicesResponse {
  devices: Device[];
}

// 設備群組列表回應介面
export interface DeviceGroupsResponse {
  groups: DeviceGroup[];
}

// 單一設備指令執行請求介面（保持向後相容）
export interface ExecuteRequest {
  device_ip: string;
  command: string;
}

// 單一設備 AI 查詢請求介面（保持向後相容）
export interface AIQueryRequest {
  device_ip: string;
  query: string;
}

// 統一的批次執行請求介面
// 支援單一設備、多設備、全設備操作
export interface BatchExecuteRequest {
  devices: string[];  // 設備IP陣列：1個=單設備，多個=多設備，全部=全設備
  command: string;
  mode: 'command' | 'ai';
}

// 執行結果介面
export interface BatchExecutionResult {
  deviceName: string;
  deviceIp: string;
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

// 執行回應介面
export interface BatchExecutionResponse {
  results: BatchExecutionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalTime: number;
  };
}

// API 錯誤介面
export interface APIError {
  status: number;
  statusText: string;
  message: string;
}

// API 回應基礎類型
export type APIResponse<T = string> = T;

// =============================================================================
// 非同步任務相關類型定義
// =============================================================================

// 任務狀態枚舉
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任務類型枚舉
export type TaskType = 'batch_execute' | 'ai_query' | 'health_check';

// 任務進度資訊
export interface TaskProgress {
  percentage: number;       // 進度百分比 (0-100)
  current_stage: string;    // 當前階段描述
  details: Record<string, any>;  // 其他進度細節
}

// 任務建立回應
export interface TaskCreationResponse {
  task_id: string;
  message: string;
}

// 任務狀態回應
export interface TaskResponse {
  task_id: string;
  task_type: TaskType;
  status: TaskStatus;
  params: Record<string, any>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: TaskProgress;
  result?: any;
  error?: string;
  execution_time?: number;
}

// 任務列表回應
export interface TaskListResponse {
  tasks: TaskResponse[];
  total_count: number;
  filters_applied: {
    status?: string;
    task_type?: string;
    limit?: number;
  };
}

// 任務取消回應
export interface TaskCancelResponse {
  message: string;
  task_id: string;
}

// 任務管理器統計回應
export interface TaskManagerStatsResponse {
  task_manager_stats: {
    total_created: number;
    total_completed: number;
    total_failed: number;
    total_cancelled: number;
    current_tasks: number;
    active_tasks: number;
    finished_tasks: number;
    cleanup_runs: number;
    tasks_cleaned: number;
    cleanup_interval: number;
    task_ttl_hours: number;
    uptime_seconds: number;
  };
  system_info: {
    python_version: [number, number, number];
    platform: string;
  };
}