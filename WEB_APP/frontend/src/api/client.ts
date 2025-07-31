/**
 * API 客戶端配置
 * 提供統一的 HTTP 客戶端和錯誤處理
 */
import axios, { type AxiosResponse, type AxiosError } from 'axios';
import { type APIError } from '@/types';
import { 
  API_CONFIG, 
  ERROR_MESSAGES, 
  RETRYABLE_STATUS_CODES,
  REQUEST_HEADERS 
} from '@/config/api';

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
    // 開發環境下記錄請求日誌
    if (import.meta.env.DEV) {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// 回應攔截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 開發環境下記錄回應日誌
    if (import.meta.env.DEV) {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError) => {
    // 詳細錯誤日誌記錄
    const errorDetails = {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    };
    
    console.error('❌ API Response Error Details:', errorDetails);
    
    // 特別記錄 AI 相關錯誤
    if (error.config?.url?.includes('/ai-') || error.response?.status === 429) {
      console.error('🤖 AI Service Error:', {
        timestamp: new Date().toISOString(),
        provider: 'unknown', // 前端無法直接獲取，但可以從後端回應中推斷
        ...errorDetails
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
            
            console.log(`🔄 Request failed, retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => attempt(retryCount + 1), delay);
          } else {
            reject(error);
          }
        });
    };
    
    attempt(0);
  });
};