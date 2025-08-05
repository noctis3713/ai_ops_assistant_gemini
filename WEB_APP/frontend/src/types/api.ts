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

// 設備列表回應介面 - 純資料部分（會被 BaseResponse 包裝）  
// 注意：後端 BaseResponse.data 直接包含 Device[]，不需要額外的介面包裝
// 已棄用此介面，直接使用 Device[] 類型
export interface DevicesResponse {
  data: Device[];
}

// 設備群組列表回應介面
// 注意：後端 BaseResponse.data 直接包含 DeviceGroup[]，不需要 groups 包裝
// 此介面已過時，後端 BaseResponse.data 直接是 DeviceGroup[] 陣列
export interface DeviceGroupsResponse extends Array<DeviceGroup> {}

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

// =============================================================================
// BaseResponse 相關類型定義 - 與後端統一格式對齊
// =============================================================================

/**
 * 統一的 API 回應格式 - 與後端 BaseResponse 對齊
 * 所有 API 端點都使用此格式包裝回應資料
 */
export interface BaseResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string;
  timestamp: string;
}

/**
 * API 回應基礎類型 - 向後相容
 * @deprecated 建議使用 BaseResponse<T> 獲得更好的型別安全
 */
export type APIResponse<T = string> = T;

// 具體的 BaseResponse 型別別名，與後端格式完全對齊
export type DevicesApiResponse = BaseResponse<Device[]>;
export type DeviceGroupsApiResponse = BaseResponse<DeviceGroup[]>;
export type BatchExecutionApiResponse = BaseResponse<BatchExecutionResponse>;
export type TaskCreationApiResponse = BaseResponse<TaskCreationResponse>;
export type TaskStatusApiResponse = BaseResponse<TaskResponse>;
export type TaskListApiResponse = BaseResponse<TaskListResponse>;
export type TaskCancelApiResponse = BaseResponse<TaskCancelResponse>;
export type TaskManagerStatsApiResponse = BaseResponse<TaskManagerStatsResponse>;

// =============================================================================
// 型別守衛和工具函數型別
// =============================================================================

/**
 * 檢查回應是否為成功的 BaseResponse
 */
export function isSuccessResponse<T>(response: BaseResponse<T>): response is BaseResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * 檢查回應是否為失敗的 BaseResponse
 */
export function isErrorResponse<T>(response: BaseResponse<T>): response is BaseResponse<T> & { success: false; message: string } {
  return response.success === false;
}

/**
 * 從 BaseResponse 中安全提取資料的工具型別
 */
export type ExtractData<T> = T extends BaseResponse<infer U> ? U : never;

/**
 * API 錯誤詳細資訊
 */
export interface APIErrorDetail extends APIError {
  error_code?: string;
  timestamp?: string;
  details?: Record<string, any>;
}

/**
 * 增強的錯誤處理回調型別
 */
export type ErrorHandler = (error: APIErrorDetail, context?: string) => void;

/**
 * API 載入狀態型別
 */
export interface APILoadingState {
  isLoading: boolean;
  error: APIErrorDetail | null;
  lastUpdated?: string;
}

/**
 * 分頁相關型別
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

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

// 任務參數類型定義
export interface TaskParams {
  devices: string[];
  command: string;
  mode: 'command' | 'ai';
  [key: string]: unknown; // 允許其他額外參數
}

// 任務結果類型定義
export type TaskResult = 
  | BatchExecutionResponse  // 批次執行結果
  | string                  // AI 查詢結果
  | null;                   // 尚未完成

// 任務狀態回應
export interface TaskResponse {
  task_id: string;
  task_type: TaskType;
  status: TaskStatus;
  params: TaskParams;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: TaskProgress;
  result?: TaskResult;
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