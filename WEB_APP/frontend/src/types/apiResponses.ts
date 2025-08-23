/**
 * API 回應型別定義
 * 統一所有 API 回應的型別定義，提升型別安全性
 */

// 重新導出 BaseResponse 型別定義，確保一致性
export type { BaseResponse, ApiError } from '@/utils/responseHandler';
import type { BaseResponse } from '@/utils/responseHandler';

// 導入需要的業務型別（避免重複導出）
import type {
  Device,
  DeviceGroup,
  BatchExecutionResponse,
  TaskCreationResponse,
  TaskResponse,
  TaskListResponse,
  TaskCancelResponse,
  TaskManagerStatsResponse,
  BackendConfig
} from '@/types';

/**
 * 常見的 API 回應型別別名
 * 提供更簡潔的型別引用方式
 */

// 字串資料回應
export type StringResponse = BaseResponse<string>;

// 陣列資料回應
export type ArrayResponse<T> = BaseResponse<T[]>;

// 物件資料回應  
export type ObjectResponse<T> = BaseResponse<T>;

// 布林值回應
export type BooleanResponse = BaseResponse<boolean>;

// 數字回應
export type NumberResponse = BaseResponse<number>;

/**
 * 特定業務邏輯的回應型別
 */

// 設備相關回應型別
export type DeviceListResponse = ArrayResponse<Device>;
export type DeviceGroupListResponse = ArrayResponse<DeviceGroup>;

// 執行相關回應型別
export type CommandExecutionResponse = StringResponse;
export type AIQueryResponse = StringResponse;
export type BatchExecutionResponseType = ObjectResponse<BatchExecutionResponse>;

// 任務相關回應型別
export type TaskCreationResponseType = ObjectResponse<TaskCreationResponse>;
export type TaskStatusResponseType = ObjectResponse<TaskResponse>;
export type TaskListResponseType = ObjectResponse<TaskListResponse>;
export type TaskCancelResponseType = ObjectResponse<TaskCancelResponse>;
export type TaskStatsResponseType = ObjectResponse<TaskManagerStatsResponse>;

// 系統狀態回應型別
export type HealthCheckResponse = ObjectResponse<HealthStatus>;
export type AIStatusResponse = ObjectResponse<AIStatusInfo>;
export type APIInfoResponse = ObjectResponse<APIInfo>;
export type BackendConfigResponse = ObjectResponse<BackendConfig>;

/**
 * 業務邏輯資料型別
 * 與現有的型別定義保持一致
 */

// 導出型別別名供外部使用
export type BatchExecutionData = BatchExecutionResponse;
export type TaskCreationResult = TaskCreationResponse;
export type TaskResult = TaskResponse;
export type TaskListResult = TaskListResponse;
export type TaskCancelResult = TaskCancelResponse;
export type TaskManagerStatsResult = TaskManagerStatsResponse;

/**
 * 補充的介面定義
 * 針對回應處理中需要但可能缺失的型別
 */

export interface HealthStatus {
  status: string;
  message: string;
  timestamp?: string;
}

export interface AIStatusInfo {
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

export interface APIInfo {
  message: string;
  version: string;
  endpoints: Record<string, string>;
  ai_available: boolean;
}

/**
 * API 錯誤回應型別
 */
export interface ApiErrorResponse {
  success: false;
  data?: null;
  message: string;
  error_code?: string;
  timestamp?: string;
}

/**
 * 型別守衛函數
 * 用於運行時型別檢查
 */

export const isBaseResponse = <T>(obj: unknown): obj is BaseResponse<T> => {
  return typeof obj === 'object' && 
         obj !== null && 
         typeof (obj as Record<string, unknown>).success === 'boolean';
};

export const isSuccessResponse = <T>(obj: unknown): obj is BaseResponse<T> => {
  return isBaseResponse(obj) && obj.success === true;
};

export const isErrorResponse = (obj: unknown): obj is ApiErrorResponse => {
  return isBaseResponse(obj) && obj.success === false;
};

/**
 * 工具型別
 * 用於型別操作和轉換
 */

// 提取 BaseResponse 中的 data 型別
export type ExtractResponseData<T> = T extends BaseResponse<infer U> ? U : never;

// 將普通型別包裝為 BaseResponse
export type WrapResponse<T> = BaseResponse<T>;

// 可選的回應型別（用於可能失敗的 API）
export type OptionalResponse<T> = BaseResponse<T | null>;