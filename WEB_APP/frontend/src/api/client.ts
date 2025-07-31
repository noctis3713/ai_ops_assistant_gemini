/**
 * API 客戶端配置
 * 提供統一的 HTTP 客戶端和錯誤處理
 */
import axios, { type AxiosResponse, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { type APIError } from '@/types';

// 擴展 axios 配置，添加 metadata 屬性
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number;
    };
  }
}
import { 
  API_CONFIG, 
  ERROR_MESSAGES, 
  RETRYABLE_STATUS_CODES,
  REQUEST_HEADERS 
} from '@/config/api';
import { logInfo, logWarn, logError, logPerformance, LogCategory } from '@/utils/LoggerService';

// 建立 axios 實例
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT.DEFAULT,
  headers: {
    'Content-Type': REQUEST_HEADERS.CONTENT_TYPE,
    'Accept': REQUEST_HEADERS.ACCEPT,
  },
});

// 請求攔截器
apiClient.interceptors.request.use(
  (config) => {
    // 記錄 API 請求日誌
    const method = config.method?.toUpperCase() || 'UNKNOWN';
    const url = config.url || 'unknown';
    
    logInfo(
      LogCategory.API,
      `API Request: ${method} ${url}`,
      {
        method,
        url,
        timeout: config.timeout,
        baseURL: config.baseURL,
      }
    );
    
    // 為請求添加時間戳用於計算響應時間
    config.metadata = { startTime: performance.now() };
    
    return config;
  },
  (error) => {
    logError(
      LogCategory.API,
      'API Request Error',
      {
        message: error.message,
        code: error.code,
      },
      error
    );
    return Promise.reject(error);
  }
);

// 回應攔截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 計算響應時間
    const startTime = response.config.metadata?.startTime;
    const duration = startTime ? performance.now() - startTime : 0;
    
    const method = response.config.method?.toUpperCase() || 'UNKNOWN';
    const url = response.config.url || 'unknown';
    const status = response.status;
    
    // 記錄成功響應
    logInfo(
      LogCategory.API,
      `API Response: ${status} ${method} ${url} (${Math.round(duration)}ms)`,
      {
        method,
        url,
        status,
        duration: Math.round(duration),
        dataSize: JSON.stringify(response.data).length,
      }
    );
    
    // 記錄響應時間性能
    logPerformance(`API ${method} ${url}`, duration, {
      status,
      endpoint: url,
    });
    
    return response;
  },
  (error: AxiosError) => {
    // 計算響應時間（即使失敗也記錄）
    const startTime = error.config?.metadata?.startTime;
    const duration = startTime ? performance.now() - startTime : 0;
    
    const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
    const url = error.config?.url || 'unknown';
    const status = error.response?.status || 0;
    
    // 詳細錯誤日誌記錄
    const errorDetails = {
      method,
      url,
      status,
      statusText: error.response?.statusText,
      duration: Math.round(duration),
      errorCode: error.code,
      message: error.message,
    };
    
    // 根據錯誤類型記錄不同級別的日誌
    if (status >= 500) {
      // 伺服器錯誤
      logError(
        LogCategory.API,
        `API Server Error: ${status} ${method} ${url}`,
        errorDetails,
        error
      );
    } else if (status >= 400) {
      // 客戶端錯誤
      logWarn(
        LogCategory.API,
        `API Client Error: ${status} ${method} ${url}`,
        errorDetails
      );
    } else if (status === 0) {
      // 網路錯誤
      logError(
        LogCategory.NETWORK,
        `Network Error: ${method} ${url}`,
        errorDetails,
        error
      );
    }
    
    // 特別記錄 AI 相關錯誤
    if (url.includes('/ai-') || url.includes('ai-query') || status === 429) {
      logError(
        LogCategory.API,
        `AI Service Error: ${status} ${url}`,
        {
          ...errorDetails,
          isAiService: true,
          rateLimited: status === 429,
        },
        error
      );
    }
    
    // 記錄失敗請求的性能（用於分析超時等問題）
    if (duration > 0) {
      logPerformance(`API ${method} ${url} (FAILED)`, duration, {
        status,
        endpoint: url,
        error: true,
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
 * 錯誤訊息處理函數
 * 根據錯誤類型返回用戶友好的錯誤訊息
 */
function getErrorMessage(error: AxiosError): string {
  // 伺服器回應錯誤
  if (error.response) {
    const status = error.response.status;
    const responseData = error.response.data;
    
    // 優先使用後端回傳的具體錯誤訊息
    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData;
    }
    
    // 使用預定義的錯誤訊息
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
 * 對特定錯誤類型進行自動重試
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
            
            logWarn(
              LogCategory.API,
              `Request retry: ${retryCount + 1}/${maxRetries} in ${delay}ms`,
              {
                retryCount: retryCount + 1,
                maxRetries,
                delay,
                status: error.status,
                statusText: error.statusText,
              }
            );
            
            setTimeout(() => attempt(retryCount + 1), delay);
          } else {
            reject(error);
          }
        });
    };
    
    attempt(0);
  });
};