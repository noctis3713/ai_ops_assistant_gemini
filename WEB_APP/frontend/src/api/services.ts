/**
 * API 服務函數 - 重構版本
 * 提供所有後端 API 的調用接口，使用統一的 BaseResponse 處理邏輯
 */
import { apiClient, createRetryableRequest } from './client';
import { API_CONFIG, API_ENDPOINTS } from '@/config/api';
import { 
  type Device, 
  type DeviceGroup,
  type BatchExecuteRequest,
  type BatchExecutionResponse,
  type BackendConfig,  // ✨ v2.5.2 新增後端配置類型
  // 非同步任務相關類型
  type TaskCreationResponse,
  type TaskResponse,
  type TaskListResponse,
  type TaskCancelResponse,
  type TaskManagerStatsResponse,
  type TaskStatus,
  type TaskType
} from '@/types';


// 導入新的回應處理工具
import { 
  handleBaseResponse, 
  handleFlexibleResponse, 
  simpleApiCall,
  type BaseResponse 
} from '@/utils/responseHandler';

/**
 * 獲取設備列表 - 重構版本
 * 支援自動重試機制，使用統一的 BaseResponse 處理
 */
export const getDevices = async (): Promise<Device[]> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<BaseResponse<Device[]>>(API_ENDPOINTS.DEVICES);
    const devices = simpleApiCall(response, '獲取設備列表', []);
    
    // 簡化的日誌記錄
    // 記錄設備數量信息
    console.debug('getDevices API 回應', { deviceCount: devices.length });
    
    return devices;
  });
};

/**
 * 執行網路設備指令 - 簡化版本（使用非同步任務）
 * 使用新的簡化任務 API
 */
export const executeCommand = async (request: {device_ip: string, command: string}): Promise<string> => {
  // 建立設備指令任務
  const taskId = await createDeviceCommandTask([request.device_ip], request.command);
  
  // 輪詢任務狀態直到完成
  const result = await pollTaskUntilComplete(taskId);
  
  // 提取結果
  if (result.results && result.results.results && result.results.results.length > 0) {
    const deviceResult = result.results.results[0];
    if (!deviceResult.success && deviceResult.error) {
      throw new Error(deviceResult.error);
    }
    return deviceResult.output || '';
  }
  
  return '';
};

/**
 * 執行 AI 查詢 - 簡化版本（使用非同步任務）
 * 使用新的簡化任務 API
 */
export const queryAI = async (request: {device_ip: string, query: string}): Promise<string> => {
  // 建立 AI 查詢任務
  const taskId = await createAIQueryTask([request.device_ip], request.query);
  
  // 輪詢任務狀態直到完成
  const result = await pollTaskUntilComplete(taskId);
  
  // 提取 AI 回應結果
  if (result.results && result.results.results && result.results.results.length > 0) {
    const deviceResult = result.results.results[0];
    if (!deviceResult.success && deviceResult.error) {
      throw new Error(deviceResult.error);
    }
    return deviceResult.output || '';
  }
  
  return '';
};

/**
 * 健康檢查 - 重構版本
 * 使用靈活的回應格式處理，支援 BaseResponse 和直接格式
 */
export const healthCheck = async (): Promise<{ 
  status: string; 
  message: string 
}> => {
  const response = await apiClient.get<BaseResponse<{ status: string; message: string }> | { status: string; message: string }>(
    API_ENDPOINTS.HEALTH
  );
  
  return handleFlexibleResponse(
    response, 
    '健康檢查失敗', 
    { status: 'unknown', message: '健康檢查無資料' },
    ['status', 'message']
  );
};

/**
 * 獲取設備群組列表 - 重構版本
 * 支援自動重試機制，使用統一的 BaseResponse 處理
 */
export const getDeviceGroups = async (): Promise<DeviceGroup[]> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<BaseResponse<DeviceGroup[]>>(API_ENDPOINTS.DEVICE_GROUPS);
    return simpleApiCall(response, '獲取設備群組', []);
  });
};

/**
 * 建立設備指令任務
 */
export const createDeviceCommandTask = async (devices: string[], command: string, webhook_url?: string): Promise<string> => {
  const response = await apiClient.post<BaseResponse<{task_id: string}>>(
    API_ENDPOINTS.TASKS,
    {
      operation_type: 'device_command',
      devices,
      command,
      webhook_url
    },
    { timeout: API_CONFIG.TIMEOUT.BATCH_COMMAND }
  );
  
  const result = handleBaseResponse(response, '建立設備指令任務失敗');
  return result.task_id;
};

/**
 * 建立 AI 查詢任務
 */
export const createAIQueryTask = async (devices: string[], query: string, webhook_url?: string): Promise<string> => {
  const response = await apiClient.post<BaseResponse<{task_id: string}>>(
    API_ENDPOINTS.TASKS,
    {
      operation_type: 'ai_query',
      devices,
      query,
      webhook_url
    },
    { timeout: API_CONFIG.TIMEOUT.BATCH_COMMAND }
  );
  
  const result = handleBaseResponse(response, '建立 AI 查詢任務失敗');
  return result.task_id;
};

/**
 * 查詢任務狀態
 */
export const getTaskStatus = async (taskId: string): Promise<TaskResponse> => {
  const response = await apiClient.get<BaseResponse<TaskResponse>>(`${API_ENDPOINTS.TASKS}/${taskId}`);
  return handleBaseResponse(response, '查詢任務狀態失敗');
};

/**
 * 輪詢任務直到完成
 */
export const pollTaskUntilComplete = async (taskId: string, maxAttempts: number = 60): Promise<TaskResponse> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getTaskStatus(taskId);
    
    if (status.status === 'completed') {
      return status;
    } else if (status.status === 'failed') {
      throw new Error(status.error || '任務執行失敗');
    }
    
    // 等待 2 秒後重試
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('任務執行超時');
};

// 型別定義
interface APIInfo {
  message: string;
  version: string;
  endpoints: Record<string, string>;
  ai_available: boolean;
}

/**
 * 獲取 API 根資訊 - 重構版本
 * 使用靈活的回應格式處理，支援 BaseResponse 和直接格式
 */
export const getAPIInfo = async (): Promise<APIInfo> => {
  const response = await apiClient.get<BaseResponse<APIInfo> | APIInfo>(API_ENDPOINTS.ROOT);
  
  return handleFlexibleResponse(
    response, 
    '獲取 API 資訊失敗',
    {
      message: '無法獲取 API 資訊',
      version: 'unknown',
      endpoints: {},
      ai_available: false
    },
    ['message', 'version', 'ai_available']
  );
};

// AI 狀態介面定義
interface AIStatus {
  ai_available: boolean;
  ai_initialized: boolean;
  ai_provider: string;
  parser_version: string;
  api_keys: {
    gemini_configured: boolean;
    claude_configured: boolean;
    current_provider: string;
  };
  recommendations: string[];
}

/**
 * 獲取 AI 服務狀態 - 重構版本
 * 使用靈活的回應格式處理，支援 BaseResponse 和直接格式
 */
export const getAIStatus = async (): Promise<AIStatus> => {
  const response = await apiClient.get<BaseResponse<AIStatus> | AIStatus>('/ai-status');
  
  return handleFlexibleResponse(
    response, 
    '獲取 AI 狀態失敗',
    {
      ai_available: false,
      ai_initialized: false,
      ai_provider: 'unknown',
      parser_version: 'unknown',
      api_keys: {
        gemini_configured: false,
        claude_configured: false,
        current_provider: 'unknown'
      },
      recommendations: []
    },
    ['ai_available', 'ai_initialized', 'ai_provider']
  );
};

// =============================================================================
// 非同步任務相關 API 函數
// =============================================================================

/**
 * 非同步批次執行指令 - 簡化版本
 * 使用簡化的 tasks API 格式，根據 mode 選擇正確的操作類型
 */
export const batchExecuteAsync = async (request: BatchExecuteRequest): Promise<TaskCreationResponse> => {
  // 根據 mode 決定操作類型和參數
  let taskRequest: {
    operation_type: string;
    devices: string[];
    command?: string;
    query?: string;
    webhook_url?: string;
  };
  
  if (request.mode === 'ai') {
    // AI 查詢任務
    taskRequest = {
      operation_type: 'ai_query',
      devices: request.devices,
      query: request.command, // 對於 AI 查詢，command 就是查詢內容
      webhook_url: request.webhook_url
    };
  } else {
    // 設備指令任務
    taskRequest = {
      operation_type: 'device_command',
      devices: request.devices,
      command: request.command,
      webhook_url: request.webhook_url
    };
  }
  
  const response = await apiClient.post<BaseResponse<{task_id: string; status: string; created_at: string; polling_url: string}>>(
    API_ENDPOINTS.TASKS,
    taskRequest,
    { 
      timeout: API_CONFIG.TIMEOUT.DEFAULT
    }
  );
  
  const result = handleBaseResponse(response, '建立非同步任務失敗');
  
  if (!result) {
    throw new Error('任務建立回應資料格式錯誤');
  }
  
  // 轉換為符合 TaskCreationResponse 格式的回應
  return {
    task_id: result.task_id,
    status: result.status,
    created_at: result.created_at,
    polling_url: result.polling_url
  };
};

// 已移除重複的 getTaskStatus 函數定義

// 任務查詢參數介面
interface TaskQueryParams {
  status?: TaskStatus;
  task_type?: TaskType;
  limit?: number;
}

/**
 * 列出任務，支援篩選和分頁 - 重構版本
 * 使用統一的查詢參數處理和 BaseResponse 處理
 */
export const getTasks = async (params?: TaskQueryParams): Promise<TaskListResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params?.status) {
    queryParams.append('status', params.status);
  }
  if (params?.task_type) {
    queryParams.append('task_type', params.task_type);
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  
  const url = queryParams.toString() 
    ? `${API_ENDPOINTS.TASKS}?${queryParams.toString()}`
    : API_ENDPOINTS.TASKS;
  
  const response = await apiClient.get<BaseResponse<TaskListResponse>>(url);
  
  return simpleApiCall(
    response, 
    '獲取任務列表', 
    { tasks: [], total_count: 0, filters_applied: {} }
  );
};

/**
 * 取消指定任務 - 增強版本
 * 智能處理快速完成的任務，使用統一的任務 ID 驗證和 BaseResponse 處理
 */
export const cancelTask = async (taskId: string): Promise<TaskCancelResponse> => {
  // 統一的任務 ID 驗證邏輯
  if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
    throw new Error(`無效的任務 ID: '${taskId}'`);
  }
  
  if (taskId === 'undefined' || taskId === 'null') {
    throw new Error(`不可接受的任務 ID 值: '${taskId}'`);
  }
  
  const response = await apiClient.delete<BaseResponse<TaskCancelResponse>>(
    `${API_ENDPOINTS.CANCEL_TASK}/${encodeURIComponent(taskId)}`
  );
  
  return simpleApiCall(
    response, 
    '取消任務', 
    { message: '任務已處理', task_id: taskId }
  );
};

/**
 * 獲取任務管理器統計資訊 - 重構版本
 * 使用統一的 BaseResponse 處理和預設值定義
 */
export const getTaskManagerStats = async (): Promise<TaskManagerStatsResponse> => {
  const response = await apiClient.get<BaseResponse<TaskManagerStatsResponse>>(
    API_ENDPOINTS.TASK_MANAGER_STATS
  );
  
  const defaultStats: TaskManagerStatsResponse = { 
    task_manager_stats: {
      total_created: 0,
      total_completed: 0,
      total_failed: 0,
      total_cancelled: 0,
      current_tasks: 0,
      active_tasks: 0,
      finished_tasks: 0,
      cleanup_runs: 0,
      tasks_cleaned: 0,
      cleanup_interval: 0,
      task_ttl_hours: 0,
      uptime_seconds: 0,
    },
    system_info: {
      python_version: [0, 0, 0],
      platform: 'unknown'
    }
  };
  
  return simpleApiCall(response, '獲取任務統計', defaultStats);
};

// =============================================================================
// 任務輪詢相關輔助函數
// =============================================================================

// ============================================================================
// TaskPoller 相關功能已移動到專用模組 ./TaskPoller.ts
// 這裡提供重新導出以保持向後相容性
// ============================================================================

import { 
  TaskPoller as TaskPollerClass,
  createAdvancedTaskPoller as createAdvancedTaskPollerFunction,
  type PollMeta as PollMetaType,
  type EnhancedPollCallbacks as EnhancedPollCallbacksType,
  type TaskPollerDependencies
} from './TaskPoller';

// 重新導出類型和介面
export type PollMeta = PollMetaType;
export type EnhancedPollCallbacks = EnhancedPollCallbacksType;

// 重新導出類別（需要注入依賴）
export class TaskPoller extends TaskPollerClass {
  constructor(callbacks: Partial<EnhancedPollCallbacks> = {}) {
    // 注入依賴
    const dependencies: TaskPollerDependencies = {
      getTaskStatus,
      batchExecuteAsync
    };
    super(dependencies, callbacks);
  }
}

// 重新導出工廠函數（需要注入依賴）
export const createAdvancedTaskPoller = (defaultCallbacks: Partial<EnhancedPollCallbacks> = {}) => {
  const dependencies: TaskPollerDependencies = {
    getTaskStatus,
    batchExecuteAsync
  };
  return createAdvancedTaskPollerFunction(dependencies, defaultCallbacks);
};

/**
 * 執行非同步批次任務並等待完成（向後兼容函數）
 * 結合任務建立和輪詢的便利函數
 */
export const executeAsyncBatchAndWait = async (
  request: BatchExecuteRequest,
  options: {
    onProgress?: (task: TaskResponse) => void;
    pollInterval?: number;
    maxPollInterval?: number;
    timeout?: number;
  } = {}
): Promise<BatchExecutionResponse> => {
  // 使用新的 TaskPoller 類別，但保持向後兼容的接口
  const enhancedOptions = {
    onProgress: options.onProgress ? (task: TaskResponse) => {
      options.onProgress!(task);
    } : undefined,
    pollInterval: options.pollInterval,
    maxPollInterval: options.maxPollInterval,
    timeout: options.timeout,
  };
  
  const poller = new TaskPoller();
  return poller.executeAndWait(request, enhancedOptions);
};

// ===================================================================
// 日誌系統 API 服務
// ===================================================================

/**
 * 遠端日誌發送請求介面
 */
export interface RemoteLogRequest {
  logs: LogEntry[];
  metadata: {
    userAgent: string;
    url: string;
    timestamp: string;
    sessionId?: string;
    userId?: string;
  };
}

/**
 * 遠端日誌發送回應介面
 */
export interface RemoteLogResponse {
  success: boolean;
  message: string;
  logCount: number;
  processedAt: string;
}

/**
 * 發送前端日誌到後端 (已禁用)
 * 不再發送日誌到後端，直接返回成功響應
 */
export const sendFrontendLogs = async (request: RemoteLogRequest): Promise<RemoteLogResponse> => {
  // 已禁用遠端日誌發送功能
  // 直接返回成功響應，不發送到後端
  return {
    success: true,
    message: 'Frontend log sending disabled',
    logCount: request.logs.length,
    processedAt: new Date().toISOString(),
  };
};

/**
 * 發送單個日誌條目（便利函數）
 */
export const sendSingleLogEntry = async (logEntry: LogEntry): Promise<RemoteLogResponse> => {
  return sendFrontendLogs({
    logs: [logEntry],
    metadata: {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * 獲取前端日誌配置
 * 用於動態調整日誌行為
 */
export interface FrontendLogConfig {
  enableRemoteLogging: boolean;
  logLevel: string;
  batchSize: number;
  batchInterval: number;
  maxLocalStorageEntries: number;
  enabledCategories: string[];
}

export const getFrontendLogConfig = async (): Promise<FrontendLogConfig> => {
  try {
    const response = await apiClient.get<FrontendLogConfig>('/frontend-log-config');
    return response.data;
  } catch {
    // 如果無法獲取配置，返回預設配置
    // 無法獲取日誌配置，使用預設配置
    
    return {
      enableRemoteLogging: false,
      logLevel: 'INFO',
      batchSize: 10,
      batchInterval: 30000,
      maxLocalStorageEntries: 100,
      enabledCategories: ['api', 'error', 'user'],
    };
  }
};


/**
 * 獲取後端動態配置 - 重構版本 ✨ v2.5.2
 * 使用統一的 BaseResponse 處理和重試機制
 */
export const getBackendConfig = async (): Promise<BackendConfig> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<BaseResponse<BackendConfig>>(API_ENDPOINTS.BACKEND_CONFIG);
    const config = simpleApiCall(response, '獲取後端配置');
    
    // 簡化的日誌記錄
    // 記錄後端配置信息
    console.debug('getBackendConfig API 回應', {
      enableAiQuery: config?.ai?.enableAiQuery
    });
    
    if (!config) {
      throw new Error('後端配置資料為空');
    }
    
    return config;
  });
};

