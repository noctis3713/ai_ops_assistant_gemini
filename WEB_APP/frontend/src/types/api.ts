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

// 注意：設備和群組清單直接使用 Device[] 和 DeviceGroup[] 類型
// 透過 BaseResponse<Device[]> 和 BaseResponse<DeviceGroup[]> 包裝

// 後端動態配置介面 ✨ v2.5.2 新增
// 對應後端 Pydantic 模型的 JSON 輸出格式
export interface BackendConfig {
  ai: {
    // 移除 enableDocumentSearch - 不再支援外部文檔搜尋
    parserVersion?: string;
    enableSummarization?: boolean;
    enableAiQuery?: boolean;  // AI 查詢功能開關
    summaryThreshold?: number;
    models?: {
      gemini?: string;
      claude?: string;
    };
    behavior?: {
      enableRetry?: boolean;
      maxRetryAttempts?: number;
      retryDelay?: number;
      timeoutWarningThreshold?: number;
    };
  };
  network?: {
    connection?: {
      maxConnections?: number;
      connectionTimeout?: number;
      commandTimeout?: number;
      healthCheckInterval?: number;
      keepAliveInterval?: number;
    };
    device?: {
      defaultType?: string;
      enableVerboseLogging?: boolean;
      retryConnection?: boolean;
      maxConnectionRetries?: number;
    };
    nornir?: {
      workers?: number;
      enableProgressBar?: boolean;
      raiseOnError?: boolean;
      numWorkers?: number;
    };
  };
  cache?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  async?: Record<string, unknown>;  // 注意：JSON 中使用 async 鍵名（Pydantic 別名處理）
  prompts?: Record<string, unknown>;
  security?: Record<string, unknown>;
  performance?: Record<string, unknown>;
}

// 統一的批次執行請求介面
// 支援單一設備、多設備、全設備操作
export interface BatchExecuteRequest {
  devices: string[];  // 設備IP陣列：1個=單設備，多個=多設備，全部=全設備
  command: string;
  mode: 'command' | 'ai';
  
  // 可選的任務管理功能（與後端 BatchExecuteRequest 保持一致）
  enable_tracking?: boolean;
  idempotency_key?: string;
  webhook_url?: string;
  webhook_headers?: Record<string, string>;
  task_metadata?: Record<string, unknown>;
}

// 執行結果介面
export interface BatchExecutionResult {
  deviceName: string;
  deviceIp: string;
  success: boolean;
  output?: string;  // 與後端保持一致，改為可選
  error?: string;
}

// 執行回應介面
export interface BatchExecutionResponse {
  results: BatchExecutionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
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
export interface BaseResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string;
  timestamp: string;
}

// API 回應統一使用 BaseResponse<T> 格式

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
 * 增強版本：更精確的類型推導和運行時驗證
 */
export function isSuccessResponse<T>(response: BaseResponse<T>): response is BaseResponse<T> & { success: true; data: T } {
  return (
    response !== null &&
    typeof response === 'object' &&
    response.success === true && 
    response.data !== undefined &&
    response.data !== null
  );
}

/**
 * 檢查回應是否為失敗的 BaseResponse
 * 增強版本：更嚴格的錯誤檢查
 */
export function isErrorResponse<T>(response: BaseResponse<T>): response is BaseResponse<T> & { success: false; message: string } {
  return (
    response !== null &&
    typeof response === 'object' &&
    response.success === false &&
    typeof response.message === 'string' &&
    response.message.length > 0
  );
}

/**
 * 檢查回應是否為有效的 BaseResponse 結構
 * 新增：基礎結構驗證
 */
export function isValidBaseResponse<T>(response: unknown): response is BaseResponse<T> {
  return (
    response !== null &&
    typeof response === 'object' &&
    typeof (response as BaseResponse<T>).success === 'boolean' &&
    typeof (response as BaseResponse<T>).timestamp === 'string'
  );
}

/**
 * 安全地從 BaseResponse 中提取資料
 * 新增：類型安全的資料提取器
 */
export function extractResponseData<T>(response: BaseResponse<T>): T | null {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  return null;
}

/**
 * 安全地從 BaseResponse 中提取錯誤訊息
 * 新增：類型安全的錯誤訊息提取器
 */
export function extractErrorMessage<T>(response: BaseResponse<T>): string | null {
  if (isErrorResponse(response)) {
    return response.message;
  }
  return null;
}

/**
 * 從 BaseResponse 中安全提取資料的工具型別
 */
export type ExtractData<T> = T extends BaseResponse<infer U> ? U : never;

/**
 * API 錯誤詳細資訊
 * 增強版本：更細緻的錯誤分類和上下文資訊
 */
export interface APIErrorDetail extends APIError {
  error_code?: string;
  timestamp?: string;
  details?: Record<string, unknown>;
  
  // 新增：錯誤分類和嚴重程度
  category?: 'network' | 'authentication' | 'authorization' | 'validation' | 'server' | 'timeout' | 'unknown';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  
  // 新增：重試相關資訊
  retryable?: boolean;
  retryAfter?: number; // 建議重試間隔（秒）
  maxRetries?: number; // 最大重試次數
  
  // 新增：用戶友善訊息
  userMessage?: string;
  technicalMessage?: string;
  
  // 新增：相關資源資訊
  resource?: string; // 相關的資源或操作
  operation?: string; // 執行的操作
}

/**
 * 錯誤處理回調型別
 * 增強版本：支援更豐富的錯誤上下文
 */
export type ErrorHandler = (error: APIErrorDetail, context?: ErrorContext) => void;

/**
 * 錯誤上下文資訊
 * 新增：提供更豐富的錯誤上下文
 */
export interface ErrorContext {
  operation?: string;
  resource?: string;
  userId?: string;
  deviceId?: string;
  requestId?: string;
  timestamp?: string;
  additionalInfo?: Record<string, unknown>;
}

/**
 * API 載入狀態型別
 * 增強版本：更細緻的狀態追蹤
 */
export interface APILoadingState {
  isLoading: boolean;
  error: APIErrorDetail | null;
  lastUpdated?: string;
  
  // 新增：載入狀態細分
  loadingStage?: 'idle' | 'fetching' | 'processing' | 'completed' | 'failed';
  progress?: number; // 進度百分比 (0-100)
  
  // 新增：重試狀態
  retryCount?: number;
  isRetrying?: boolean;
  canRetry?: boolean;
}

/**
 * API 回應狀態枚舉
 * 新增：標準化的回應狀態
 */
export const APIResponseStatus = {
  SUCCESS: 'success',
  ERROR: 'error',
  LOADING: 'loading',
  IDLE: 'idle'
} as const;

export type APIResponseStatusType = typeof APIResponseStatus[keyof typeof APIResponseStatus];

/**
 * 標準化的 API 操作結果
 * 新增：統一的操作結果結構
 */
export interface APIOperationResult<T = unknown> {
  status: APIResponseStatusType;
  data?: T;
  error?: APIErrorDetail;
  loading?: boolean;
  timestamp: string;
}

/**
 * API 錯誤工廠函數類型
 * 新增：用於創建標準化錯誤對象
 */
export type APIErrorFactory = (
  message: string,
  options?: {
    status?: number;
    statusText?: string;
    category?: APIErrorDetail['category'];
    severity?: APIErrorDetail['severity'];
    retryable?: boolean;
    context?: ErrorContext;
  }
) => APIErrorDetail;

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
// 高階泛型約束和工具類型
// =============================================================================

/**
 * 可序列化的資料類型約束
 * 確保資料可以安全地在 API 中傳輸
 */
export type SerializableValue = string | number | boolean | null | undefined;
export type SerializableObject = { [key: string]: SerializableValue | SerializableObject | SerializableArray };
export type SerializableArray = (SerializableValue | SerializableObject)[];
export type Serializable = SerializableValue | SerializableObject | SerializableArray;

/**
 * API 資料約束 - 確保所有 API 資料都是可序列化的
 */
export type APIData<T = unknown> = T extends Serializable ? T : never;

/**
 * 強型別的 BaseResponse - 只接受可序列化的資料
 */
export interface StrictBaseResponse<T extends Serializable = Serializable> extends BaseResponse<T> {
  data?: APIData<T>;
}

/**
 * 條件類型：檢查類型是否為 BaseResponse
 */
export type IsBaseResponse<T> = T extends BaseResponse<unknown> ? true : false;

/**
 * 條件類型：從聯合類型中提取 BaseResponse 的資料類型
 */
export type ExtractBaseResponseData<T> = T extends BaseResponse<infer U> ? U : never;

/**
 * 工具類型：使 BaseResponse 的特定欄位為必需
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * 成功回應類型 - data 欄位為必需
 */
export type SuccessResponse<T extends Serializable> = RequiredFields<BaseResponse<T>, 'data'> & {
  success: true;
};

/**
 * 錯誤回應類型 - message 欄位為必需
 */
export type ErrorResponse = RequiredFields<BaseResponse<never>, 'message'> & {
  success: false;
  data?: never;
};

/**
 * 所有可能的 API 回應類型聯合
 */
export type APIResponse<T extends Serializable = Serializable> = SuccessResponse<T> | ErrorResponse;

/**
 * API 端點回應映射類型
 * 用於定義每個端點的回應類型
 */
export interface APIEndpointMap {
  '/api/devices': Device[];
  '/api/device-groups': DeviceGroup[];
  '/api/batch-execute': BatchExecutionResponse;
  '/api/tasks': TaskListResponse;
  '/api/ai-status': BackendConfig;
  // 可以繼續添加更多端點
}

/**
 * 從端點路徑推導回應類型的工具類型
 */
export type EndpointResponse<K extends keyof APIEndpointMap> = APIEndpointMap[K];

/**
 * API Hook 回應類型工廠
 * 用於創建一致的 Hook 回應結構
 */
export type APIHookResponse<T extends Serializable> = {
  data: T | null;
  loading: boolean;
  error: APIErrorDetail | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
};

/**
 * 條件類型：檢查是否為有效的 API 資料
 */
export type ValidateAPIData<T> = T extends Serializable 
  ? T 
  : {
      error: 'Invalid API data type. Must be serializable.';
      received: T;
    };

/**
 * 類型安全的 API 回應創建器類型
 */
export type APIResponseBuilder = {
  success<T extends Serializable>(data: ValidateAPIData<T>, message?: string): SuccessResponse<T>;
  error(message: string, error_code?: string): ErrorResponse;
};

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
  details: Record<string, unknown>;  // 其他進度細節
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
// Token 成本資訊介面
export interface TokenCost {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  provider: string;
  model: string;
  is_estimated: boolean;
}

export interface TaskResponse {
  task_id: string;
  task_type: TaskType;
  status: TaskStatus;
  params: TaskParams;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: TaskProgress;
  result?: TaskResult;  // 舊格式：結果在 result 欄位
  results?: TaskResult; // 新格式：結果在 results 欄位（與後端一致）
  error?: string;
  token_cost?: TokenCost; // 新增：Token 使用量和成本資訊（僅 AI 查詢任務有此欄位）
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
  completed?: boolean; // 任務已完成（快速完成的任務）
  cancelled?: boolean; // 任務已取消（正常取消的任務）
  success?: boolean;   // 操作成功標誌
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