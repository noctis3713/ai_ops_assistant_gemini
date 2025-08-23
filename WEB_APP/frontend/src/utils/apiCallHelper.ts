/**
 * API 調用輔助工具
 * 提供高階 API 調用包裝器，進一步簡化 API 函數實作
 */
import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '@/api/client';
import { 
  handleBaseResponse, 
  handleFlexibleResponse,
  type BaseResponse 
} from './responseHandler';

/**
 * 標準 GET 請求包裝器
 * 
 * @param endpoint API 端點
 * @param context 上下文描述
 * @param options 請求選項
 * @param fallbackData 預設資料
 * @returns API 調用函數
 */
export const createGetApiCall = <T>(
  endpoint: string,
  context: string,
  options?: AxiosRequestConfig,
  fallbackData?: T
) => {
  return async (): Promise<T> => {
    const response = await apiClient.get<BaseResponse<T>>(endpoint, options);
    return handleBaseResponse(response, `${context}失敗`, fallbackData);
  };
};

/**
 * 標準 POST 請求包裝器
 * 
 * @param endpoint API 端點
 * @param context 上下文描述
 * @param options 請求選項
 * @returns API 調用函數
 */
export const createPostApiCall = <TRequest, TResponse>(
  endpoint: string,
  context: string,
  options?: AxiosRequestConfig
) => {
  return async (data: TRequest): Promise<TResponse> => {
    const response = await apiClient.post<BaseResponse<TResponse>>(endpoint, data, options);
    return handleBaseResponse(response, `${context}失敗`);
  };
};

/**
 * 標準 DELETE 請求包裝器
 * 
 * @param endpointFactory 端點工廠函數
 * @param context 上下文描述
 * @param options 請求選項
 * @returns API 調用函數
 */
export const createDeleteApiCall = <TParam, TResponse>(
  endpointFactory: (param: TParam) => string,
  context: string,
  options?: AxiosRequestConfig
) => {
  return async (param: TParam): Promise<TResponse> => {
    const endpoint = endpointFactory(param);
    const response = await apiClient.delete<BaseResponse<TResponse>>(endpoint, options);
    return handleBaseResponse(response, `${context}失敗`);
  };
};

/**
 * 帶重試機制的 GET 請求包裝器
 * 
 * @param endpoint API 端點
 * @param context 上下文描述
 * @param retryableRequest 重試函數
 * @param options 請求選項
 * @param fallbackData 預設資料
 * @returns API 調用函數
 */
export const createRetryableGetCall = <T>(
  endpoint: string,
  context: string,
  retryableRequest: <R>(fn: () => Promise<R>) => Promise<R>,
  options?: AxiosRequestConfig,
  fallbackData?: T
) => {
  return async (): Promise<T> => {
    return retryableRequest(async () => {
      const response = await apiClient.get<BaseResponse<T>>(endpoint, options);
      return handleBaseResponse(response, `${context}失敗`, fallbackData);
    });
  };
};

/**
 * 靈活回應格式處理的 GET 請求
 * 用於向後相容性支援
 * 
 * @param endpoint API 端點
 * @param context 上下文描述
 * @param directFields 直接格式的欄位名稱
 * @param options 請求選項
 * @param fallbackData 預設資料
 * @returns API 調用函數
 */
export const createFlexibleGetCall = <T>(
  endpoint: string,
  context: string,
  directFields?: string[],
  options?: AxiosRequestConfig,
  fallbackData?: T
) => {
  return async (): Promise<T> => {
    const response = await apiClient.get<BaseResponse<T> | T>(endpoint, options);
    return handleFlexibleResponse(response, `${context}失敗`, fallbackData, directFields);
  };
};

/**
 * 任務 ID 驗證包裝器
 * 專門用於任務相關 API
 * 
 * @param apiCall 原始 API 調用函數
 * @param taskId 任務 ID
 * @param context 上下文描述
 * @returns 驗證後的 API 調用函數
 */
export const validateTaskId = <T>(
  apiCall: () => Promise<T>,
  taskId: string
): (() => Promise<T>) => {
  // 驗證任務 ID
  if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
    throw new Error(`無效的任務 ID: '${taskId}'`);
  }
  
  if (taskId === 'undefined' || taskId === 'null') {
    throw new Error(`不可接受的任務 ID 值: '${taskId}'`);
  }
  
  // 基本格式驗證（可選）
  const taskIdPattern = /^task_\d+_[a-zA-Z0-9]+$/;
  if (!taskIdPattern.test(taskId)) {
    // 基本格式檢查（靜默處理）
  }
  
  return apiCall;
};

/**
 * 查詢參數建構器
 * 
 * @param params 參數物件
 * @returns 查詢字串
 */
export const buildQueryString = (params: Record<string, unknown>): string => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  
  return queryParams.toString();
};

/**
 * 帶查詢參數的 GET 請求包裝器
 * 
 * @param baseEndpoint 基礎端點
 * @param context 上下文描述
 * @param options 請求選項
 * @param fallbackData 預設資料
 * @returns API 調用函數
 */
export const createQueryGetCall = <TParams, TResponse>(
  baseEndpoint: string,
  context: string,
  options?: AxiosRequestConfig,
  fallbackData?: TResponse
) => {
  return async (params?: TParams): Promise<TResponse> => {
    let endpoint = baseEndpoint;
    
    if (params) {
      const queryString = buildQueryString(params as Record<string, unknown>);
      if (queryString) {
        endpoint = `${baseEndpoint}?${queryString}`;
      }
    }
    
    const response = await apiClient.get<BaseResponse<TResponse>>(endpoint, options);
    return handleBaseResponse(response, `${context}失敗`, fallbackData);
  };
};

/**
 * 預定義的常用 API 調用工廠
 */

/**
 * 設備列表 API 調用工廠
 */
export const createDeviceListCall = (
  endpoint: string,
  retryableRequest?: <R>(fn: () => Promise<R>) => Promise<R>
) => {
  if (retryableRequest) {
    return createRetryableGetCall(endpoint, '獲取設備列表', retryableRequest, undefined, []);
  }
  return createGetApiCall(endpoint, '獲取設備列表', undefined, []);
};

/**
 * 指令執行 API 調用工廠
 */
export const createCommandExecutionCall = (endpoint: string, timeout?: number) => {
  const options = timeout ? { timeout } : undefined;
  return createPostApiCall(endpoint, '執行指令', options);
};

/**
 * 批次操作 API 調用工廠
 */
export const createBatchOperationCall = <TRequest, TResponse>(
  endpoint: string,
  timeout?: number
) => {
  const options = timeout ? { timeout } : undefined;
  return createPostApiCall<TRequest, TResponse>(endpoint, '批次執行', options);
};

/**
 * 任務狀態 API 調用工廠
 */
export const createTaskStatusCall = (baseEndpoint: string) => {
  return (taskId: string) => {
    const apiCall = createGetApiCall(
      `${baseEndpoint}/${encodeURIComponent(taskId)}`,
      '查詢任務狀態'
    );
    return validateTaskId(apiCall, taskId);
  };
};

/**
 * 任務取消 API 調用工廠
 */
export const createTaskCancelCall = (baseEndpoint: string) => {
  return (taskId: string) => {
    const apiCall = createDeleteApiCall(
      (id: string) => `${baseEndpoint}/${encodeURIComponent(id)}`,
      '取消任務'
    );
    return validateTaskId(() => apiCall(taskId), taskId);
  };
};