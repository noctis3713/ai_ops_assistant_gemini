/**
 * 基礎服務抽象類別
 * 為所有領域服務提供統一的基礎功能和介面
 */

import type { AxiosInstance, AxiosResponse } from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { ServiceError } from './ServiceError';
import { logApiInfo, logError } from '@/errors';
import type { 
  ServiceDependencies, 
  ServiceRequestConfig, 
  ServiceResponse, 
  ServiceErrorContext,
  ApiResponseTransformer
} from './ServiceTypes';

/**
 * 基礎服務抽象類別
 * 提供統一的錯誤處理、請求配置、資料轉換等功能
 */
export abstract class BaseService {
  protected readonly apiClient: AxiosInstance;
  protected readonly queryClient: QueryClient;
  protected readonly serviceName: string;

  constructor(dependencies: ServiceDependencies, serviceName: string) {
    this.apiClient = dependencies.apiClient;
    this.queryClient = dependencies.queryClient;
    this.serviceName = serviceName;
  }

  /**
   * 統一的錯誤處理方法
   */
  protected handleError(
    error: unknown, 
    operation: string, 
    input?: unknown
  ): ServiceError {
    const context: ServiceErrorContext = {
      operation,
      service: this.serviceName,
      input,
      metadata: {
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Node.js'
      }
    };

    return ServiceError.from(error, context);
  }

  /**
   * 統一的 API 請求方法
   */
  protected async makeRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    operation: string,
    input?: unknown,
    config?: ServiceRequestConfig
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      // 記錄請求開始
      logApiInfo(`${this.serviceName}.${operation} 開始`, { input });

      const response = await this.executeWithRetry(
        requestFn,
        config?.retries || 0,
        config?.retryDelay || 1000
      );

      // 記錄請求成功
      const duration = performance.now() - startTime;
      logApiInfo(`${this.serviceName}.${operation} 成功`, {
        duration: Math.round(duration),
        status: response.status
      });

      return this.extractData<T>(response);
    } catch (error) {
      // 記錄請求失敗
      const duration = performance.now() - startTime;
      logError(`${this.serviceName}.${operation} 失敗`, {
        duration: Math.round(duration),
        error: error instanceof Error ? error.message : String(error),
        input
      });

      throw this.handleError(error, operation, input);
    }
  }

  /**
   * 帶重試機制的請求執行
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    retries: number,
    delay: number
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // 如果是最後一次嘗試，或錯誤不可重試，直接拋出
        if (attempt === retries || !this.isRetryableError(error)) {
          throw error;
        }

        // 等待後重試
        await this.delay(delay * Math.pow(2, attempt)); // 指數退避
      }
    }

    throw lastError;
  }

  /**
   * 判斷錯誤是否可重試
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof ServiceError) {
      return error.retryable;
    }

    // 對於非 ServiceError，檢查狀態碼
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as { response?: { status?: number } };
      const status = axiosError.response?.status;
      
      // 5xx 錯誤和部分 4xx 錯誤可重試
      return (
        status === undefined || // 網路錯誤
        (status >= 500 && status < 600) || // 伺服器錯誤
        status === 408 || // Request Timeout
        status === 429    // Too Many Requests
      );
    }

    return false;
  }

  /**
   * 延遲工具方法
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 統一的資料轉換方法
   */
  protected transform<TInput, TOutput>(
    data: TInput,
    transformer: (input: TInput) => TOutput
  ): TOutput {
    try {
      return transformer(data);
    } catch (error) {
      throw this.handleError(error, 'transform', data);
    }
  }

  /**
   * 批次資料轉換
   */
  protected transformList<TInput, TOutput>(
    dataList: TInput[],
    transformer: (input: TInput) => TOutput
  ): TOutput[] {
    try {
      return dataList.map(transformer);
    } catch (error) {
      throw this.handleError(error, 'transformList', dataList);
    }
  }

  /**
   * 建立標準的服務回應
   */
  protected createResponse<T>(data: T, message: string = '操作成功'): ServiceResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 處理 API 回應並提取資料
   */
  protected extractData<T>(
    response: AxiosResponse,
    transformer?: ApiResponseTransformer<T>
  ): T {
    if (transformer) {
      return transformer(response);
    }

    // 預設處理邏輯，支援 BaseResponse 格式
    const data = response.data;
    
    if (typeof data === 'object' && data !== null && 'data' in data) {
      return data.data as T;
    }

    return data as T;
  }

  /**
   * 建立查詢鍵值
   */
  protected createQueryKey(baseKey: string[], ...parts: (string | number | boolean | undefined)[]): string[] {
    const filteredParts = parts.filter(part => part !== undefined && part !== null);
    return [...baseKey, ...filteredParts.map(String)];
  }

  /**
   * 記錄操作日誌
   */
  protected logOperation(operation: string, data?: Record<string, unknown>): void {
    logApiInfo(`${this.serviceName}.${operation}`, data);
  }

  /**
   * 記錄錯誤日誌
   */
  protected logError(operation: string, error: unknown, data?: Record<string, unknown>): void {
    logError(`${this.serviceName}.${operation} 錯誤`, {
      error: error instanceof Error ? error.message : String(error),
      ...data
    });
  }

  /**
   * 取得服務名稱
   */
  public getServiceName(): string {
    return this.serviceName;
  }

  /**
   * 健康檢查方法（子類別可覆寫）
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // 預設實作：檢查 API 客戶端是否可用
      await this.apiClient.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}