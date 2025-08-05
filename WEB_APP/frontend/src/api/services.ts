/**
 * API 服務函數
 * 提供所有後端 API 的調用接口
 */
import { apiClient, createRetryableRequest } from './client';
import { API_CONFIG, API_ENDPOINTS } from '@/config/api';
import { PROGRESS_STAGE, type ProgressStage } from '@/constants';
import { 
  type Device, 
  type DeviceGroup,
  type ExecuteRequest, 
  type AIQueryRequest,
  type BatchExecuteRequest,
  type BatchExecutionResponse,
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
 * 使用較長的超時時間以適應網路設備回應時間，適配 BaseResponse 格式
 */
export const executeCommand = async (request: ExecuteRequest): Promise<string> => {
  const response = await apiClient.post<{ success: boolean; data?: string; message?: string; error_code?: string }>(
    API_ENDPOINTS.EXECUTE, 
    request, 
    {
      timeout: API_CONFIG.TIMEOUT.COMMAND,
    }
  );
  
  // 對於純文字回應的端點，可能直接回傳字串而非 BaseResponse
  // 先嘗試解析為 BaseResponse，如果失敗則當作純文字處理
  if (typeof response.data === 'string') {
    return response.data;
  }
  
  // 處理 BaseResponse 格式
  if (response.data && typeof response.data === 'object') {
    if (!response.data.success) {
      throw new Error(response.data.message || '執行指令失敗');
    }
    return response.data.data || '';
  }
  
  return String(response.data || '');
};

/**
 * 執行 AI 查詢
 * 使用最長的超時時間以適應 AI 模型處理時間，適配 BaseResponse 格式
 */
export const queryAI = async (request: AIQueryRequest): Promise<string> => {
  const response = await apiClient.post<{ success: boolean; data?: string; message?: string; error_code?: string }>(
    API_ENDPOINTS.AI_QUERY, 
    request, 
    {
      timeout: API_CONFIG.TIMEOUT.AI_QUERY,
    }
  );
  
  // 對於純文字回應的端點，可能直接回傳字串而非 BaseResponse
  // 先嘗試解析為 BaseResponse，如果失敗則當作純文字處理
  if (typeof response.data === 'string') {
    return response.data;
  }
  
  // 處理 BaseResponse 格式
  if (response.data && typeof response.data === 'object') {
    if (!response.data.success) {
      throw new Error(response.data.message || 'AI 查詢失敗');
    }
    return response.data.data || '';
  }
  
  return String(response.data || '');
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
  search_enabled: boolean;
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
      search_enabled: boolean;
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
      search_enabled: false,
      api_keys: {
        gemini_configured: false,
        claude_configured: false,
        current_provider: 'unknown'
      },
      recommendations: []
    };
  }
  
  // 直接格式（向後兼容）
  const directData = response.data as any;
  return {
    ai_available: directData.ai_available || false,
    ai_initialized: directData.ai_initialized || false,
    ai_provider: directData.ai_provider || 'unknown',
    parser_version: directData.parser_version || 'unknown',
    search_enabled: directData.search_enabled || false,
    api_keys: directData.api_keys || {
      gemini_configured: false,
      claude_configured: false,
      current_provider: 'unknown'
    },
    recommendations: directData.recommendations || []
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

/**
 * 輪詢元數據接口
 */
export interface PollMeta {
  pollCount: number;
  duration: number;
  currentInterval: number;
  startTime: number;
}


/**
 * 增強版輪詢回調接口
 */
export interface EnhancedPollCallbacks {
  /**
   * 進度更新回調
   */
  onProgress?: (task: TaskResponse, meta: PollMeta) => void;
  
  /**
   * 階段變化回調
   */
  onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
  
  /**
   * 錯誤處理回調
   */
  onError?: (error: Error, context: string) => void;
  
  /**
   * 任務完成回調（成功、失敗、取消都會觸發）
   */
  onComplete?: (task: TaskResponse, meta: PollMeta) => void;
  
  /**
   * 任務開始回調
   */
  onStart?: (taskId: string) => void;
}

// pollTaskUntilComplete 函數已移動到 TaskPoller 類別的私有方法中

// 這些函數已移動到 TaskPoller 類別的私有方法中

/**
 * 高級任務輪詢器類別
 * 提供完整的任務輪詢和管理功能
 */
export class TaskPoller {
  private abortController: AbortController;
  private callbacks: Partial<EnhancedPollCallbacks>;
  private isActive: boolean = false;
  
  constructor(callbacks: Partial<EnhancedPollCallbacks> = {}) {
    this.callbacks = callbacks;
    this.abortController = new AbortController();
  }
  
  /**
   * 輪詢單個任務
   */
  public async pollTask(
    taskId: string,
    options: {
      onProgress?: (task: TaskResponse, meta: PollMeta) => void;
      onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
      onError?: (error: Error, context: string) => void;
      onComplete?: (task: TaskResponse, meta: PollMeta) => void;
      onStart?: (taskId: string) => void;
      pollInterval?: number;
      maxPollInterval?: number;
      timeout?: number;
    } = {}
  ): Promise<TaskResponse> {
    // 參數驗證 - 防止無效的任務 ID
    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      const error = new Error(`TaskPoller: 無效的任務 ID '${taskId}'`);
      if (options.onError) {
        options.onError(error, '任務 ID 驗證失敗');
      }
      throw error;
    }
    
    // 防止 'undefined' 字串
    if (taskId === 'undefined' || taskId === 'null') {
      const error = new Error(`TaskPoller: 不可接受的任務 ID 值 '${taskId}'`);
      if (options.onError) {
        options.onError(error, '任務 ID 值無效');
      }
      throw error;
    }
    // 合併預設回調和選項回調
    const mergedOptions = {
      ...options,
      onProgress: options.onProgress || this.callbacks.onProgress,
      onStageChange: options.onStageChange || this.callbacks.onStageChange,
      onError: options.onError || this.callbacks.onError,
      onComplete: options.onComplete || this.callbacks.onComplete,
      onStart: options.onStart || this.callbacks.onStart,
      abortSignal: this.abortController.signal,
    };
    
    this.isActive = true;
    
    try {
      const result = await this.pollTaskUntilComplete(taskId, mergedOptions);
      return result;
    } finally {
      this.isActive = false;
    }
  }
  
  /**
   * 執行並等待任務完成
   */
  public async executeAndWait(
    request: BatchExecuteRequest,
    options: {
      onProgress?: (task: TaskResponse, meta: PollMeta) => void;
      onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
      onError?: (error: Error, context: string) => void;
      onComplete?: (task: TaskResponse, meta: PollMeta) => void;
      onStart?: (taskId: string) => void;
      pollInterval?: number;
      maxPollInterval?: number;
      timeout?: number;
    } = {}
  ): Promise<BatchExecutionResponse> {
    // 建立非同步任務
    const taskCreation = await batchExecuteAsync(request);
    
    // 輪詢直到完成
    const completedTask = await this.pollTask(taskCreation.task_id, options);
    
    // 檢查任務結果
    if (completedTask.status === 'failed') {
      throw new Error(completedTask.error || '任務執行失敗');
    }
    
    if (completedTask.status === 'cancelled') {
      throw new Error('任務已被取消');
    }
    
    // 返回執行結果
    return completedTask.result as BatchExecutionResponse;
  }
  
  /**
   * 取消當前輪詢
   */
  public cancel(): void {
    this.abortController.abort();
    this.isActive = false;
  }
  
  /**
   * 檢查是否正在輪詢
   */
  public isPolling(): boolean {
    return this.isActive;
  }
  
  /**
   * 重置輪詢器（創建新的 AbortController）
   */
  public reset(): void {
    this.cancel();
    this.abortController = new AbortController();
  }
  
  /**
   * 內部輪詢實現（從 pollTaskUntilComplete 遷移過來）
   */
  private async pollTaskUntilComplete(
    taskId: string,
    options: {
      onProgress?: (task: TaskResponse, meta: PollMeta) => void;
      onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
      onError?: (error: Error, context: string) => void;
      onComplete?: (task: TaskResponse, meta: PollMeta) => void;
      onStart?: (taskId: string) => void;
      pollInterval?: number;
      maxPollInterval?: number;
      timeout?: number;
      abortSignal?: AbortSignal;
    } = {}
  ): Promise<TaskResponse> {
    const {
      onProgress,
      onStageChange,
      onError,
      onComplete,
      onStart,
      pollInterval = 2000,
      maxPollInterval = 10000,
      timeout = 30 * 60 * 1000, // 30 分鐘
      abortSignal
    } = options;
    
    // 觸發開始回調
    if (onStart) {
      onStart(taskId);
    }
    
    const startTime = Date.now();
    let currentInterval = pollInterval;
    let pollCount = 0;
    let lastStage: string | undefined;
    
    while (true) {
      // 檢查是否被取消
      if (abortSignal?.aborted) {
        throw new Error('輪詢已被用戶取消');
      }
      
      // 檢查超時
      const currentTime = Date.now();
      const duration = currentTime - startTime;
      if (duration > timeout) {
        const error = new Error(`任務輪詢超時: ${taskId}`);
        if (onError) {
          onError(error, '輪詢超時');
        }
        throw error;
      }
      
      try {
        pollCount++;
        const task = await getTaskStatus(taskId);
        
        // 驗證任務資料有效性
        if (!task || !task.task_id) {
          throw new Error(`無效的任務資料: taskId=${taskId}`);
        }
        
        const meta: PollMeta = { 
          pollCount, 
          duration: currentTime - startTime, 
          currentInterval, 
          startTime 
        };
        
        // 調用進度回調
        if (onProgress) {
          onProgress(task, meta);
        }
        
        // 檢查階段變化
        if (onStageChange && task.progress.current_stage !== lastStage) {
          const stage = this.mapTaskProgressToStage(task);
          const message = this.generateStageMessage(task, stage);
          onStageChange(stage, message, task);
          lastStage = task.progress.current_stage;
        }
        
        // 檢查任務是否完成
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          // 觸發完成回調
          if (onComplete) {
            onComplete(task, meta);
          }
          return task;
        }
        
        // 等待下次輪詢
        await new Promise(resolve => setTimeout(resolve, currentInterval));
        
        // 使用指數退避策略增加輪詢間隔
        currentInterval = Math.min(currentInterval * 1.2, maxPollInterval);
        
      } catch (error) {
        // 如果是 404 錯誤，任務可能已被清理
        if (error instanceof Error && error.message.includes('404')) {
          const notFoundError = new Error(`任務不存在或已被清理: ${taskId}`);
          if (onError) {
            onError(notFoundError, '任務不存在');
          }
          throw notFoundError;
        }
        
        // 觸發錯誤回調
        if (onError && error instanceof Error) {
          onError(error, '查詢任務狀態失敗');
        }
        
        // 其他錯誤重新拋出
        throw error;
      }
    }
  }
  
  /**
   * 將任務進度映射到前端階段
   */
  private mapTaskProgressToStage(task: TaskResponse): ProgressStage {
    const requestMode = task.params?.mode;
    
    switch (task.status) {
      case 'completed':
        return PROGRESS_STAGE.COMPLETED;
      case 'failed':
        return PROGRESS_STAGE.FAILED;
      case 'cancelled':
        return PROGRESS_STAGE.CANCELLED;
      case 'running':
        if (task.progress.percentage < 20) {
          return PROGRESS_STAGE.CONNECTING;
        } else {
          return requestMode === 'ai' ? PROGRESS_STAGE.AI_ANALYZING : PROGRESS_STAGE.EXECUTING;
        }
      default:
        return PROGRESS_STAGE.SUBMITTED;
    }
  }
  
  /**
   * 生成階段對應的訊息
   */
  private generateStageMessage(task: TaskResponse, stage: ProgressStage): string {
    const deviceCount = task.params?.devices?.length || 1;
    
    switch (stage) {
      case PROGRESS_STAGE.CONNECTING:
        return '連接到設備中...';
      case PROGRESS_STAGE.EXECUTING:
        return deviceCount === 1 ? '執行中... (1 個設備)' : `執行中... (${deviceCount} 個設備)`;
      case PROGRESS_STAGE.AI_ANALYZING:
        return 'AI 分析中...';
      case PROGRESS_STAGE.COMPLETED:
        return '執行完成';
      case PROGRESS_STAGE.FAILED:
        return '執行失敗';
      case PROGRESS_STAGE.CANCELLED:
        return '任務已取消';
      default:
        return task.progress.current_stage || '處理中...';
    }
  }
}

/**
 * 創建高級任務輪詢器工廠函數（向後兼容）
 * 提供配置化的輪詢器創建
 */
export const createAdvancedTaskPoller = (defaultCallbacks: Partial<EnhancedPollCallbacks> = {}) => {
  const poller = new TaskPoller(defaultCallbacks);
  
  return {
    /**
     * 輪詢單個任務
     */
    pollTask: async (
      taskId: string, 
      options: {
        onProgress?: (task: TaskResponse, meta: PollMeta) => void;
        onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
        onError?: (error: Error, context: string) => void;
        onComplete?: (task: TaskResponse, meta: PollMeta) => void;
        onStart?: (taskId: string) => void;
        pollInterval?: number;
        maxPollInterval?: number;
        timeout?: number;
        abortSignal?: AbortSignal;
      } = {}
    ): Promise<TaskResponse> => {
      return poller.pollTask(taskId, options);
    },
    
    /**
     * 執行並等待任務完成
     */
    executeAndWait: async (
      request: BatchExecuteRequest,
      options: {
        onProgress?: (task: TaskResponse, meta: PollMeta) => void;
        onStageChange?: (stage: ProgressStage, message: string, task: TaskResponse) => void;
        onError?: (error: Error, context: string) => void;
        onComplete?: (task: TaskResponse, meta: PollMeta) => void;
        onStart?: (taskId: string) => void;
        pollInterval?: number;
        maxPollInterval?: number;
        timeout?: number;
        abortSignal?: AbortSignal;
      } = {}
    ): Promise<BatchExecutionResponse> => {
      return poller.executeAndWait(request, options);
    }
  };
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
    onProgress: options.onProgress ? (task: TaskResponse, _meta: PollMeta) => {
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
  } catch (error) {
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