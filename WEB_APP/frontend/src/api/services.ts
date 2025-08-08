/**
 * API 服務函數
 * 提供所有後端 API 的調用接口
 */
import { apiClient, createRetryableRequest } from './client';
import { API_CONFIG, API_ENDPOINTS } from '@/config/api';
import { 
  type Device, 
  type DeviceGroup,
  type ExecuteRequest, 
  type AIQueryRequest,
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

// 匯入統一的日誌條目介面，取代原本的重複定義
import type { LogEntry } from '@/utils/SimpleLogger';
// 匯入日誌函數
import { logApi, logError } from '@/utils/SimpleLogger';

/**
 * 獲取設備列表
 * 支援自動重試機制，適配 BaseResponse 格式
 */
export const getDevices = async (): Promise<Device[]> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<{ success: boolean; data?: Device[]; message?: string }>(API_ENDPOINTS.DEVICES);
    
    // 處理 BaseResponse 格式
    if (!response.data.success) {
      throw new Error(response.data.message || '獲取設備列表失敗');
    }
    
    // 後端 BaseResponse.data 直接包含 Device[] 陣列
    const devices = response.data.data || [];
    
    // API 回應記錄到日誌系統
    logApi('getDevices API 回應', {
      success: response.data.success,
      deviceCount: devices.length
    });
    
    return devices;
  });
};

/**
 * 執行網路設備指令
 * 使用較長的超時時間以適應網路設備回應時間，統一使用 BaseResponse 格式
 */
export const executeCommand = async (request: ExecuteRequest): Promise<string> => {
  const response = await apiClient.post<{ success: boolean; data?: string; message?: string; error_code?: string }>(
    API_ENDPOINTS.EXECUTE, 
    request, 
    {
      timeout: API_CONFIG.TIMEOUT.COMMAND,
    }
  );
  
  // 統一處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || '執行指令失敗');
  }
  
  return response.data.data || '';
};

/**
 * 執行 AI 查詢
 * 使用最長的超時時間以適應 AI 模型處理時間，統一使用 BaseResponse 格式
 */
export const queryAI = async (request: AIQueryRequest): Promise<string> => {
  const response = await apiClient.post<{ success: boolean; data?: string; message?: string; error_code?: string }>(
    API_ENDPOINTS.AI_QUERY, 
    request, 
    {
      timeout: API_CONFIG.TIMEOUT.AI_QUERY,
    }
  );
  
  // 統一處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || 'AI 查詢失敗');
  }
  
  return response.data.data || '';
};

/**
 * 健康檢查
 * 檢查後端服務是否正常運行，適配 BaseResponse 格式
 */
export const healthCheck = async (): Promise<{ 
  status: string; 
  message: string 
}> => {
  const response = await apiClient.get<{ success?: boolean; data?: { status: string; message: string }; status?: string; message?: string }>(API_ENDPOINTS.HEALTH);
  
  // 健康檢查端點可能有特殊格式，嘗試多種解析方式
  if (response.data.success !== undefined) {
    // BaseResponse 格式
    if (!response.data.success) {
      throw new Error(response.data.message || '健康檢查失敗');
    }
    return response.data.data || { status: 'unknown', message: '健康檢查無資料' };
  } else if (response.data.status && response.data.message) {
    // 直接格式
    return {
      status: response.data.status,
      message: response.data.message
    };
  }
  
  return { status: 'unknown', message: '健康檢查回應格式無法識別' };
};

/**
 * 獲取設備群組列表
 * 支援自動重試機制，適配 BaseResponse 格式
 */
export const getDeviceGroups = async (): Promise<DeviceGroup[]> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<{ success: boolean; data?: DeviceGroup[]; message?: string }>(API_ENDPOINTS.DEVICE_GROUPS);
    
    // 處理 BaseResponse 格式
    if (!response.data.success) {
      throw new Error(response.data.message || '獲取設備群組失敗');
    }
    
    // 後端 BaseResponse.data 直接包含 DeviceGroup[] 陣列
    return response.data.data || [];
  });
};

/**
 * 統一的批次執行網路設備指令
 * 支援單一設備、多設備、以及所有設備操作，適配 BaseResponse 格式
 * 透過 devices 陣列的內容來決定操作範圍：
 * - devices: ["單一IP"] -> 單設備操作
 * - devices: ["IP1", "IP2", "IP3"] -> 多設備操作  
 * - devices: [所有設備IP] -> 全設備操作
 */
export const batchExecuteCommand = async (request: BatchExecuteRequest): Promise<BatchExecutionResponse> => {
  const response = await apiClient.post<{ success: boolean; data?: BatchExecutionResponse; message?: string; error_code?: string }>(
    API_ENDPOINTS.BATCH_EXECUTE,
    request,
    {
      timeout: API_CONFIG.TIMEOUT.BATCH_COMMAND,
    }
  );
  
  // 處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || '批次執行失敗');
  }
  
  if (!response.data.data) {
    throw new Error('批次執行回應資料格式錯誤');
  }
  
  // 後端 BaseResponse.data 直接包含 BatchExecutionResponse
  return response.data.data;
};

/**
 * 獲取 API 根資訊
 * 包含版本資訊和可用端點，適配 BaseResponse 格式
 */
export const getAPIInfo = async (): Promise<{
  message: string;
  version: string;
  endpoints: Record<string, string>;
  ai_available: boolean;
}> => {
  const response = await apiClient.get<{ 
    success?: boolean; 
    data?: {
      message: string;
      version: string;
      endpoints: Record<string, string>;
      ai_available: boolean;
    };
    message?: string;
    version?: string;
    endpoints?: Record<string, string>;
    ai_available?: boolean;
  }>(API_ENDPOINTS.ROOT);
  
  // 嘗試 BaseResponse 格式
  if (response.data.success !== undefined) {
    if (!response.data.success) {
      throw new Error(response.data.message || '獲取 API 資訊失敗');
    }
    return response.data.data || {
      message: '無法獲取 API 資訊',
      version: 'unknown',
      endpoints: {},
      ai_available: false
    };
  }
  
  // 直接格式（向後兼容）
  return {
    message: response.data.message || 'API 正常運行',
    version: response.data.version || 'unknown',
    endpoints: response.data.endpoints || {},
    ai_available: response.data.ai_available || false
  };
};

/**
 * 獲取 AI 服務狀態
 * 包含配額、初始化狀態和建議，適配 BaseResponse 格式
 */
export const getAIStatus = async (): Promise<{
  ai_available: boolean;
  ai_initialized: boolean;
  ai_provider: string;
  parser_version: string;
  // 移除 search_enabled - 不再支援搜尋功能
  api_keys: {
    gemini_configured: boolean;
    claude_configured: boolean;
    current_provider: string;
  };
  recommendations: string[];
}> => {
  const response = await apiClient.get<{
    success?: boolean;
    data?: {
      ai_available: boolean;
      ai_initialized: boolean;
      ai_provider: string;
      parser_version: string;
      // 移除 search_enabled - 不再支援搜尋功能
      api_keys: {
        gemini_configured: boolean;
        claude_configured: boolean;
        current_provider: string;
      };
      recommendations: string[];
    };
    message?: string;
    // 直接格式的欄位（向後兼容）
    ai_available?: boolean;
    ai_initialized?: boolean;
    ai_provider?: string;
  }>('/api/ai-status');
  
  // 嘗試 BaseResponse 格式
  if (response.data.success !== undefined) {
    if (!response.data.success) {
      throw new Error(response.data.message || '獲取 AI 狀態失敗');
    }
    return response.data.data || {
      ai_available: false,
      ai_initialized: false,
      ai_provider: 'unknown',
      parser_version: 'unknown',
      // 移除 search_enabled 預設值,
      api_keys: {
        gemini_configured: false,
        claude_configured: false,
        current_provider: 'unknown'
      },
      recommendations: []
    };
  }
  
  // 直接格式（向後兼容）
  const directData = response.data as Record<string, unknown>;
  return {
    ai_available: Boolean(directData.ai_available),
    ai_initialized: Boolean(directData.ai_initialized),
    ai_provider: String(directData.ai_provider || 'unknown'),
    parser_version: String(directData.parser_version || 'unknown'),
    // 移除 search_enabled 處理,
    api_keys: (directData.api_keys && typeof directData.api_keys === 'object') ? directData.api_keys as { gemini_configured: boolean; claude_configured: boolean; current_provider: string; } : {
      gemini_configured: false,
      claude_configured: false,
      current_provider: 'unknown'
    },
    recommendations: Array.isArray(directData.recommendations) ? directData.recommendations as string[] : []
  };
};

// =============================================================================
// 非同步任務相關 API 函數
// =============================================================================

/**
 * 非同步批次執行指令
 * 立即返回任務 ID，適用於長時間執行的操作，適配 BaseResponse 格式
 */
export const batchExecuteAsync = async (request: BatchExecuteRequest): Promise<TaskCreationResponse> => {
  const response = await apiClient.post<{ success: boolean; data?: TaskCreationResponse; message?: string; error_code?: string }>(
    API_ENDPOINTS.BATCH_EXECUTE_ASYNC,
    request,
    {
      timeout: API_CONFIG.TIMEOUT.DEFAULT, // 只需要短時間等待任務建立
    }
  );
  
  // 處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || '建立非同步任務失敗');
  }
  
  if (!response.data.data) {
    throw new Error('任務建立回應資料格式錯誤');
  }
  
  // 後端 BaseResponse.data 直接包含 TaskCreationResponse
  return response.data.data;
};

/**
 * 查詢特定任務的狀態和結果
 * 用於輪詢任務執行進度，適配 BaseResponse 格式
 */
export const getTaskStatus = async (taskId: string): Promise<TaskResponse> => {
  // 參數驗證 - 防止無效的任務 ID
  if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
    throw new Error(`無效的任務 ID: '${taskId}'`);
  }
  
  // 防止 'undefined' 字串被發送到後端
  if (taskId === 'undefined' || taskId === 'null') {
    throw new Error(`不可接受的任務 ID 值: '${taskId}'`);
  }
  
  // 基本格式驗證（可選，根據任務 ID 格式調整）
  const taskIdPattern = /^task_\d+_[a-zA-Z0-9]+$/;
  if (!taskIdPattern.test(taskId)) {
    logError('任務 ID 格式可能不正確', { taskId });
  }
  
  const response = await apiClient.get<{ success: boolean; data?: TaskResponse; message?: string; error_code?: string }>(
    `${API_ENDPOINTS.TASK_STATUS}/${encodeURIComponent(taskId)}`
  );
  
  // 處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || '查詢任務狀態失敗');
  }
  
  if (!response.data.data) {
    throw new Error('任務狀態回應資料格式錯誤');
  }
  
  // 後端 BaseResponse.data 直接包含 TaskResponse
  return response.data.data;
};

/**
 * 列出任務，支援篩選和分頁
 * 用於任務管理和歷史查詢，適配 BaseResponse 格式
 */
export const getTasks = async (params?: {
  status?: TaskStatus;
  task_type?: TaskType;
  limit?: number;
}): Promise<TaskListResponse> => {
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
  
  const response = await apiClient.get<{ success: boolean; data?: TaskListResponse; message?: string }>(url);
  
  // 處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || '獲取任務列表失敗');
  }
  
  // 後端 BaseResponse.data 直接包含 TaskListResponse
  return response.data.data || { tasks: [], total_count: 0, filters_applied: {} };
};

/**
 * 取消指定任務
 * 用於用戶主動取消長時間執行的任務，適配 BaseResponse 格式
 */
export const cancelTask = async (taskId: string): Promise<TaskCancelResponse> => {
  // 參數驗證 - 防止無效的任務 ID
  if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
    throw new Error(`無效的任務 ID: '${taskId}'`);
  }
  
  // 防止 'undefined' 字串被發送到後端
  if (taskId === 'undefined' || taskId === 'null') {
    throw new Error(`不可接受的任務 ID 值: '${taskId}'`);
  }
  
  const response = await apiClient.delete<{ success: boolean; data?: TaskCancelResponse; message?: string }>(
    `${API_ENDPOINTS.CANCEL_TASK}/${encodeURIComponent(taskId)}`
  );
  
  // 處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || '取消任務失敗');
  }
  
  // 後端 BaseResponse.data 直接包含 TaskCancelResponse
  return response.data.data || { message: '任務已取消', task_id: taskId };
};

/**
 * 獲取任務管理器統計資訊
 * 用於系統監控和診斷，適配 BaseResponse 格式
 */
export const getTaskManagerStats = async (): Promise<TaskManagerStatsResponse> => {
  const response = await apiClient.get<{ success: boolean; data?: TaskManagerStatsResponse; message?: string }>(
    API_ENDPOINTS.TASK_MANAGER_STATS
  );
  
  // 處理 BaseResponse 格式
  if (!response.data.success) {
    throw new Error(response.data.message || '獲取任務統計失敗');
  }
  
  // 後端 BaseResponse.data 直接包含 TaskManagerStatsResponse
  return response.data.data || { 
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
 * 發送前端日誌到後端
 * 支援批次發送和錯誤處理
 */
export const sendFrontendLogs = async (request: RemoteLogRequest): Promise<RemoteLogResponse> => {
  try {
    const response = await apiClient.post<RemoteLogResponse>(
      '/api/frontend-logs',
      request,
      {
        timeout: API_CONFIG.TIMEOUT.DEFAULT, // 30秒超時
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  } catch (error) {
    // 日誌發送失敗不應該影響主要功能
    // 在控制台記錄錯誤但不拋出異常
    // 日誌發送失敗不應影響主要功能，靜默處理
    
    // 返回失敗響應而不是拋出錯誤
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      logCount: request.logs.length,
      processedAt: new Date().toISOString(),
    };
  }
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
    const response = await apiClient.get<FrontendLogConfig>('/api/frontend-log-config');
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
 * 前端動態配置接口
 */
export interface FrontendConfig {
  polling: {
    pollInterval: number;
    maxPollInterval: number;
    timeout: number;
    autoStartPolling: boolean;
    backoffMultiplier: number;
    maxRetries: number;
  };
  ui: {
    progressUpdateInterval: number;
    errorDisplayDuration: number;
    successDisplayDuration: number;
    animationDuration: number;
    debounceDelay: number;
    maxConcurrentRequests: number;
  };
  api: {
    retryCount: number;
    retryDelay: number;
    enableRequestDeduplication: boolean;
    deduplicationTTL: number;
    timeouts: {
      command: number;
      aiQuery: number;
      batchCommand: number;
      taskPolling: number;
      healthCheck: number;
    };
  };
}

/**
 * 獲取後端動態配置 ✨ v2.5.2 新增
 * 從後端獲取完整的動態配置，包含 AI、網路、快取等所有模組配置
 */
export const getBackendConfig = async (): Promise<BackendConfig> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<{ success: boolean; data?: BackendConfig; message?: string }>(API_ENDPOINTS.BACKEND_CONFIG);
    
    // 處理 BaseResponse 格式
    if (!response.data.success) {
      throw new Error(response.data.message || '獲取後端配置失敗');
    }
    
    // API 回應記錄到日誌系統
    logApi('getBackendConfig API 回應', {
      success: response.data.success,
      enableAiQuery: response.data.data?.ai?.enableAiQuery
    });
    
    if (!response.data.data) {
      throw new Error('後端配置資料為空');
    }
    
    return response.data.data;
  });
};

/**
 * 獲取前端動態配置
 * 從後端獲取前端應用程式的配置參數，實現配置的集中化管理
 */
export const getFrontendConfig = async (): Promise<FrontendConfig> => {
  try {
    const response = await apiClient.get<{ success: boolean; data?: FrontendConfig; message?: string }>('/api/frontend-config');
    
    // 處理 BaseResponse 格式
    if (!response.data.success) {
      throw new Error(response.data.message || '獲取前端配置失敗');
    }
    
    return response.data.data || getDefaultFrontendConfig();
  } catch (error) {
    // 如果無法獲取配置，返回預設配置
    logError('無法獲取前端動態配置，使用預設配置', { error });
    return getDefaultFrontendConfig();
  }
};

/**
 * 獲取預設前端配置
 * 當後端配置不可用時的後備配置
 */
export const getDefaultFrontendConfig = (): FrontendConfig => {
  return {
    polling: {
      pollInterval: 2000,
      maxPollInterval: 10000,
      timeout: 30 * 60 * 1000, // 30分鐘
      autoStartPolling: true,
      backoffMultiplier: 1.2,
      maxRetries: 3,
    },
    ui: {
      progressUpdateInterval: 500,
      errorDisplayDuration: 5000,
      successDisplayDuration: 3000,
      animationDuration: 300,
      debounceDelay: 300,
      maxConcurrentRequests: 5,
    },
    api: {
      retryCount: 3,
      retryDelay: 1000,
      enableRequestDeduplication: true,
      deduplicationTTL: 5000,
      timeouts: {
        command: 60000,      // 1分鐘
        aiQuery: 120000,     // 2分鐘
        batchCommand: 300000, // 5分鐘
        taskPolling: 2000,   // 2秒
        healthCheck: 10000,  // 10秒
      },
    },
  };
};