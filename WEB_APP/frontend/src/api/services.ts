/**
 * API 服務函數
 * 提供所有後端 API 的調用接口
 */
import { apiClient, createRetryableRequest } from './client';
import { API_CONFIG, API_ENDPOINTS } from '@/config/api';
import { 
  type Device, 
  type DevicesResponse, 
  type DeviceGroup,
  type DeviceGroupsResponse,
  type ExecuteRequest, 
  type AIQueryRequest,
  type BatchExecuteRequest,
  type BatchExecutionResponse,
  type APIResponse,
  // 非同步任務相關類型
  type TaskCreationResponse,
  type TaskResponse,
  type TaskListResponse,
  type TaskCancelResponse,
  type TaskManagerStatsResponse,
  type TaskStatus,
  type TaskType
} from '@/types';

/**
 * 獲取設備列表
 * 支援自動重試機制
 */
export const getDevices = async (): Promise<Device[]> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<DevicesResponse>(API_ENDPOINTS.DEVICES);
    return response.data.devices;
  });
};

/**
 * 執行網路設備指令
 * 使用較長的超時時間以適應網路設備回應時間
 */
export const executeCommand = async (request: ExecuteRequest): Promise<string> => {
  const response = await apiClient.post<APIResponse>(
    API_ENDPOINTS.EXECUTE, 
    request, 
    {
      timeout: API_CONFIG.TIMEOUT.COMMAND,
    }
  );
  
  return response.data;
};

/**
 * 執行 AI 查詢
 * 使用最長的超時時間以適應 AI 模型處理時間
 */
export const queryAI = async (request: AIQueryRequest): Promise<string> => {
  const response = await apiClient.post<APIResponse>(
    API_ENDPOINTS.AI_QUERY, 
    request, 
    {
      timeout: API_CONFIG.TIMEOUT.AI_QUERY,
    }
  );
  
  return response.data;
};

/**
 * 健康檢查
 * 檢查後端服務是否正常運行
 */
export const healthCheck = async (): Promise<{ 
  status: string; 
  message: string 
}> => {
  const response = await apiClient.get(API_ENDPOINTS.HEALTH);
  return response.data;
};

/**
 * 獲取設備群組列表
 * 支援自動重試機制
 */
export const getDeviceGroups = async (): Promise<DeviceGroup[]> => {
  return createRetryableRequest(async () => {
    const response = await apiClient.get<DeviceGroupsResponse>(API_ENDPOINTS.DEVICE_GROUPS);
    return response.data.groups;
  });
};

/**
 * 統一的批次執行網路設備指令
 * 支援單一設備、多設備、以及所有設備操作
 * 透過 devices 陣列的內容來決定操作範圍：
 * - devices: ["單一IP"] -> 單設備操作
 * - devices: ["IP1", "IP2", "IP3"] -> 多設備操作  
 * - devices: [所有設備IP] -> 全設備操作
 */
export const batchExecuteCommand = async (request: BatchExecuteRequest): Promise<BatchExecutionResponse> => {
  const response = await apiClient.post<BatchExecutionResponse>(
    API_ENDPOINTS.BATCH_EXECUTE,
    request,
    {
      timeout: API_CONFIG.TIMEOUT.BATCH_COMMAND,
    }
  );
  
  return response.data;
};

/**
 * 獲取 API 根資訊
 * 包含版本資訊和可用端點
 */
export const getAPIInfo = async (): Promise<{
  message: string;
  version: string;
  endpoints: Record<string, string>;
  ai_available: boolean;
}> => {
  const response = await apiClient.get(API_ENDPOINTS.ROOT);
  return response.data;
};

/**
 * 獲取 AI 服務狀態
 * 包含配額、初始化狀態和建議
 */
export const getAIStatus = async (): Promise<{
  ai_available: boolean;
  ai_initialized: boolean;
  ai_provider: string;
  parser_version: string;
  search_enabled: boolean;
  api_keys: {
    gemini_configured: boolean;
    claude_configured: boolean;
    current_provider: string;
  };
  recommendations: string[];
}> => {
  const response = await apiClient.get('/api/ai-status');
  return response.data;
};

// =============================================================================
// 非同步任務相關 API 函數
// =============================================================================

/**
 * 非同步批次執行指令
 * 立即返回任務 ID，適用於長時間執行的操作
 */
export const batchExecuteAsync = async (request: BatchExecuteRequest): Promise<TaskCreationResponse> => {
  const response = await apiClient.post<TaskCreationResponse>(
    API_ENDPOINTS.BATCH_EXECUTE_ASYNC,
    request,
    {
      timeout: API_CONFIG.TIMEOUT.DEFAULT, // 只需要短時間等待任務建立
    }
  );
  
  return response.data;
};

/**
 * 查詢特定任務的狀態和結果
 * 用於輪詢任務執行進度
 */
export const getTaskStatus = async (taskId: string): Promise<TaskResponse> => {
  const response = await apiClient.get<TaskResponse>(
    `${API_ENDPOINTS.TASK_STATUS}/${taskId}`
  );
  
  return response.data;
};

/**
 * 列出任務，支援篩選和分頁
 * 用於任務管理和歷史查詢
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
  
  const response = await apiClient.get<TaskListResponse>(url);
  return response.data;
};

/**
 * 取消指定任務
 * 用於用戶主動取消長時間執行的任務
 */
export const cancelTask = async (taskId: string): Promise<TaskCancelResponse> => {
  const response = await apiClient.delete<TaskCancelResponse>(
    `${API_ENDPOINTS.CANCEL_TASK}/${taskId}`
  );
  
  return response.data;
};

/**
 * 獲取任務管理器統計資訊
 * 用於系統監控和診斷
 */
export const getTaskManagerStats = async (): Promise<TaskManagerStatsResponse> => {
  const response = await apiClient.get<TaskManagerStatsResponse>(
    API_ENDPOINTS.TASK_MANAGER_STATS
  );
  
  return response.data;
};

// =============================================================================
// 任務輪詢相關輔助函數
// =============================================================================

/**
 * 輪詢任務狀態直到完成
 * 使用指數退避策略減少伺服器負載
 */
export const pollTaskUntilComplete = async (
  taskId: string,
  options: {
    onProgress?: (task: TaskResponse) => void;
    pollInterval?: number; // 毫秒，預設 2000ms
    maxPollInterval?: number; // 最大輪詢間隔，預設 10000ms
    timeout?: number; // 總超時時間，預設 30 分鐘
  } = {}
): Promise<TaskResponse> => {
  const {
    onProgress,
    pollInterval = 2000,
    maxPollInterval = 10000,
    timeout = 30 * 60 * 1000 // 30 分鐘
  } = options;
  
  const startTime = Date.now();
  let currentInterval = pollInterval;
  
  while (true) {
    // 檢查超時
    if (Date.now() - startTime > timeout) {
      throw new Error(`任務輪詢超時: ${taskId}`);
    }
    
    try {
      const task = await getTaskStatus(taskId);
      
      // 調用進度回呼
      if (onProgress) {
        onProgress(task);
      }
      
      // 檢查任務是否完成
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        return task;
      }
      
      // 等待下次輪詢
      await new Promise(resolve => setTimeout(resolve, currentInterval));
      
      // 使用指數退避策略增加輪詢間隔
      currentInterval = Math.min(currentInterval * 1.2, maxPollInterval);
      
    } catch (error) {
      // 如果是 404 錯誤，任務可能已被清理
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`任務不存在或已被清理: ${taskId}`);
      }
      
      // 其他錯誤重新拋出
      throw error;
    }
  }
};

/**
 * 執行非同步批次任務並等待完成
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
  // 建立非同步任務
  const taskCreation = await batchExecuteAsync(request);
  
  // 輪詢直到完成
  const completedTask = await pollTaskUntilComplete(taskCreation.task_id, options);
  
  // 檢查任務結果
  if (completedTask.status === 'failed') {
    throw new Error(completedTask.error || '任務執行失敗');
  }
  
  if (completedTask.status === 'cancelled') {
    throw new Error('任務已被取消');
  }
  
  // 返回執行結果
  return completedTask.result as BatchExecutionResponse;
};