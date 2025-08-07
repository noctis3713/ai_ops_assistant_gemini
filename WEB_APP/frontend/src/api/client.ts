/**
 * API 客戶端配置
 * 提供統一的 HTTP 客戶端和錯誤處理
 * 包含請求去重機制以提升性能
 */
// 第三方庫
import axios, { type AxiosResponse, type AxiosError, type AxiosRequestConfig } from 'axios';

// 本地導入
import { type APIError } from '@/types';
import { 
  API_CONFIG, 
  ERROR_MESSAGES, 
  RETRYABLE_STATUS_CODES,
  REQUEST_HEADERS 
} from '@/config/api';
import { logApi, logError } from '@/utils/SimpleLogger';

// 請求去重機制
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<AxiosResponse<unknown>>>();

  /**
   * 生成請求的唯一標識
   */
  private generateRequestKey(config: AxiosRequestConfig): string {
    const { method = 'get', url = '', params, data } = config;
    const paramsStr = params ? JSON.stringify(params) : '';
    const dataStr = data ? JSON.stringify(data) : '';
    return `${method.toUpperCase()}:${url}:${paramsStr}:${dataStr}`;
  }

  /**
   * 檢查是否為應該去重的請求
   */
  private shouldDeduplicate(config: AxiosRequestConfig): boolean {
    const method = config.method?.toUpperCase();
    const url = config.url || '';
    
    // 只對GET請求和特定的查詢API進行去重
    return method === 'GET' || 
           url.includes('/devices') ||
           url.includes('/device-groups') ||
           url.includes('/ai-status') ||
           url.includes('/health');
  }

  /**
   * 獲取或創建請求
   */
  async deduplicateRequest<T>(
    config: AxiosRequestConfig,
    executeRequest: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    if (!this.shouldDeduplicate(config)) {
      return executeRequest();
    }

    const requestKey = this.generateRequestKey(config);
    
    // 如果相同請求正在進行中，直接返回結果
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)! as Promise<AxiosResponse<T>>;
    }

    // 創建新請求
    const requestPromise = executeRequest().finally(() => {
      // 請求完成後移除緩存
      this.pendingRequests.delete(requestKey);
    });

    this.pendingRequests.set(requestKey, requestPromise);
    return requestPromise;
  }

  /**
   * 清除所有待處理請求
   */
  clearAll(): void {
    this.pendingRequests.clear();
  }
}

// 全局請求去重器
const requestDeduplicator = new RequestDeduplicator();

// 擴展 axios 配置，添加 metadata 屬性
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number;
      deduplicated?: boolean;
    };
  }
}

// 建立 axios 實例
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT.DEFAULT,
  headers: {
    'Content-Type': REQUEST_HEADERS.CONTENT_TYPE,
    'Accept': REQUEST_HEADERS.ACCEPT,
  },
});

// 重寫 axios 實例的 request 方法以支援去重
const originalRequest = apiClient.request.bind(apiClient);
(apiClient.request as unknown) = <T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return requestDeduplicator.deduplicateRequest(
    config,
    () => originalRequest<T>(config)
  );
};

// 請求攔截器
apiClient.interceptors.request.use(
  (config) => {
    // 為請求添加時間戳用於計算響應時間
    config.metadata = { startTime: performance.now() };
    
    return config;
  },
  (error) => {
    // 記錄請求錯誤到後端
    logError('API Request Error', {
      message: error.message,
      code: error.code,
    });
    return Promise.reject(error);
  }
);

// 回應攔截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 記錄成功的 API 回應（僅錯誤或重要請求）
    const method = response.config.method?.toUpperCase() || 'UNKNOWN';
    const url = response.config.url || 'unknown';
    const status = response.status;
    
    // 只記錄特定的重要 API 或錯誤狀態
    if (url.includes('/ai-') || url.includes('batch-execute') || status >= 400) {
      const startTime = response.config.metadata?.startTime;
      const duration = startTime ? Math.round(performance.now() - startTime) : 0;
      
      logApi(`API Response: ${status} ${method} ${url}`, {
        method,
        url,
        status,
        duration,
      });
    }
    
    return response;
  },
  (error: AxiosError) => {
    // 記錄 API 錯誤到後端
    const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
    const url = error.config?.url || 'unknown';
    const status = error.response?.status || 0;
    const startTime = error.config?.metadata?.startTime;
    const duration = startTime ? Math.round(performance.now() - startTime) : 0;
    
    const errorDetails = {
      method,
      url,
      status,
      statusText: error.response?.statusText,
      duration,
      errorCode: error.code,
      message: error.message,
    };
    
    // 根據錯誤類型記錄不同級別的日誌
    if (status >= 500) {
      // 伺服器錯誤
      logError(`API Server Error: ${status} ${method} ${url}`, errorDetails);
    } else if (status >= 400) {
      // 客戶端錯誤
      logError(`API Client Error: ${status} ${method} ${url}`, errorDetails);
    } else if (status === 0) {
      // 網路錯誤
      logError(`Network Error: ${method} ${url}`, errorDetails);
    }
    
    // 特別記錄 AI 相關錯誤
    if (url.includes('/ai-') || url.includes('ai-query') || status === 429) {
      logError(`AI Service Error: ${status} ${url}`, {
        ...errorDetails,
        isAiService: true,
        rateLimited: status === 429,
      });
    }
    
    // 轉換為統一的錯誤格式
    const apiError: APIError = {
      status: error.response?.status || 0,
      statusText: error.response?.statusText || 'Network Error',
      message: getErrorMessage(error),
    };
    
    return Promise.reject(apiError);
  }
);

/**
 * 錯誤訊息處理函數 - 強化 BaseResponse 支援
 * 根據錯誤類型返回用戶友好的錯誤訊息，優先使用 BaseResponse.message
 */
function getErrorMessage(error: AxiosError): string {
  // 伺服器回應錯誤
  if (error.response) {
    const status = error.response.status;
    const responseData = error.response.data;
    
    // 檢查是否為 BaseResponse 格式的錯誤回應
    if (responseData && typeof responseData === 'object') {
      const baseResponse = responseData as Record<string, unknown>;
      
      // BaseResponse 格式：{ success: false, message: "...", error_code: "..." }
      if (baseResponse.success === false && baseResponse.message) {
        logError('API 回傳 BaseResponse 錯誤格式', {
          status,
          message: baseResponse.message,
          error_code: baseResponse.error_code,
        });
        return String(baseResponse.message);
      }
      
      // 處理其他常見的錯誤訊息欄位
      const errorFields = ['detail', 'error'] as const;
      for (const field of errorFields) {
        if (baseResponse[field] && typeof baseResponse[field] === 'string') {
          return String(baseResponse[field]);
        }
      }
    }
    
    // 處理純文字錯誤回應（向後相容）
    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData;
    }
    
    // 使用統一的錯誤訊息映射，替換長 switch 語句
    return ERROR_MESSAGES[status as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.DEFAULT;
  }
  
  // 網路請求錯誤
  if (error.request) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  // 其他錯誤
  return error.message || ERROR_MESSAGES.DEFAULT;
}

/**
 * 創建可重試的請求
 * 對特定錯誤類型進行自動重試，支援請求去重
 */
export const createRetryableRequest = <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = API_CONFIG.RETRY.MAX_ATTEMPTS,
  baseDelay: number = API_CONFIG.RETRY.DELAY_BASE
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const attempt = (retryCount: number) => {
      requestFn()
        .then(resolve)
        .catch((error: APIError) => {
          // 檢查是否應該重試
          const shouldRetry = 
            retryCount < maxRetries && 
            error.status !== undefined &&
            (RETRYABLE_STATUS_CODES as readonly number[]).includes(error.status);
            
          if (shouldRetry) {
            // 指數退避延遲策略
            const delay = Math.min(
              baseDelay * Math.pow(2, retryCount), 
              API_CONFIG.RETRY.MAX_DELAY
            );
            
            logApi(`API 請求重試`, {
              attempt: retryCount + 1,
              maxRetries,
              delay,
              error: error.message
            });
            
            setTimeout(() => attempt(retryCount + 1), delay);
          } else {
            reject(error);
          }
        });
    };
    
    attempt(0);
  });
};

/**
 * 清除所有請求緩存
 * 用於錯誤恢復或狀態重置
 */
export const clearRequestCache = (): void => {
  requestDeduplicator.clearAll();
};