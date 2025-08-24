/**
 * API 回應處理工具模組
 * 統一處理 BaseResponse 格式，消除重複邏輯
 */
import type { AxiosResponse } from 'axios';

/**
 * 統一的 BaseResponse 介面定義
 */
export interface BaseResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string | null;
  timestamp?: string;
}

/**
 * API 錯誤類別
 */
export class ApiError extends Error {
  public errorCode?: string;
  public status?: number;

  constructor(
    message: string,
    errorCode?: string,
    status?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.errorCode = errorCode;
    this.status = status;
  }
}

/**
 * 統一處理 BaseResponse 格式的回應
 * 
 * @param response Axios 回應物件
 * @param errorMessage 預設錯誤訊息
 * @param fallbackData 當 data 為空時的預設值
 * @returns 解析後的資料
 * @throws ApiError 當回應表示失敗時
 */
export const handleBaseResponse = <T>(
  response: AxiosResponse<BaseResponse<T>>,
  errorMessage: string,
  fallbackData?: T
): T => {
  // 處理標準 BaseResponse 格式
  if (!response.data.success) {
    const errorMsg = response.data.message || errorMessage;
    const errorCode = response.data.error_code || undefined;
    throw new ApiError(errorMsg, errorCode, response.status);
  }

  // 返回資料，如果為 null/undefined 則使用 fallback
  return response.data.data ?? fallbackData as T;
};

/**
 * 處理可能為 BaseResponse 或直接格式的回應
 * 用於向後相容性支援
 * 
 * @param response Axios 回應物件
 * @param errorMessage 預設錯誤訊息
 * @param fallbackData 當 data 為空時的預設值
 * @param directFields 直接格式時的欄位名稱
 * @returns 解析後的資料
 */
export const handleFlexibleResponse = <T>(
  response: AxiosResponse<BaseResponse<T> | T>,
  errorMessage: string,
  fallbackData?: T,
  directFields?: string[]
): T => {
  const data = response.data as unknown;

  // 檢查是否為 BaseResponse 格式
  if (typeof data === 'object' && data !== null && 'success' in data) {
    return handleBaseResponse(response as AxiosResponse<BaseResponse<T>>, errorMessage, fallbackData);
  }

  // 處理直接格式（向後相容）
  if (directFields) {
    // 檢查直接格式的必要欄位是否存在
    const hasDirectFields = directFields.some(field => 
      typeof data === 'object' && data !== null && field in data
    );
    if (hasDirectFields) {
      return data as T;
    }
  }

  // 如果無法識別格式，返回原始資料或 fallback
  return ((data as T) ?? fallbackData) as T;
};

/**
 * 創建標準的 API 調用處理器
 * 
 * @param apiCall API 調用函數
 * @param context 上下文描述（用於日誌和錯誤）
 * @param fallbackData 預設資料
 * @returns 處理後的 API 調用函數
 */
export const createApiHandler = <T>(
  context: string,
  fallbackData?: T
) => {
  return async (apiCall: () => Promise<AxiosResponse<BaseResponse<T>>>): Promise<T> => {
    const response = await apiCall();
    return handleBaseResponse(response, `${context}失敗`, fallbackData);
  };
};

/**
 * 創建帶重試機制的 API 處理器
 * 
 * @param context 上下文描述
 * @param fallbackData 預設資料
 * @param retryableRequest 現有的重試函數
 * @returns 帶重試的 API 處理器
 */
export const createRetryableApiHandler = <T>(
  context: string,
  fallbackData?: T,
  retryableRequest?: <R>(fn: () => Promise<R>) => Promise<R>
) => {
  const handler = createApiHandler<T>(context, fallbackData);
  
  return async (apiCall: () => Promise<AxiosResponse<BaseResponse<T>>>): Promise<T> => {
    if (retryableRequest) {
      return retryableRequest(() => handler(apiCall));
    }
    return handler(apiCall);
  };
};

/**
 * 簡化的 API 調用包裝器
 * 用於最常見的 GET 請求模式
 */
export const simpleApiCall = <T>(
  response: AxiosResponse<BaseResponse<T>>,
  context: string,
  fallbackData?: T
): T => {
  return handleBaseResponse(response, `${context}失敗`, fallbackData);
};

/**
 * 批次 API 結果處理器
 * 專門處理批次操作的回應格式
 */
export const handleBatchResponse = <T>(
  response: AxiosResponse<BaseResponse<T>>,
  context: string = '批次操作'
): T => {
  const result = handleBaseResponse(response, `${context}失敗`);
  
  // 額外驗證批次回應的資料完整性
  if (!result) {
    throw new ApiError(`${context}回應資料格式錯誤`);
  }
  
  return result;
};

/**
 * 任務相關 API 的專門處理器
 * 包含任務 ID 驗證邏輯
 */
export const handleTaskResponse = <T>(
  response: AxiosResponse<BaseResponse<T>>,
  taskId?: string,
  context: string = '任務操作'
): T => {
  // 驗證任務 ID 格式（如果提供）
  if (taskId && (taskId === 'undefined' || taskId === 'null' || !taskId.trim())) {
    throw new ApiError(`無效的任務 ID: '${taskId}'`);
  }
  
  return handleBaseResponse(response, `${context}失敗`);
};