/**
 * 執行服務
 * 提供指令執行和 AI 查詢的統一介面
 */

import { BaseService } from '../base/BaseService';
import { 
  ExecutionRequestTransformer,
  ExecutionResponseTransformer,
  ExecutionHistoryTransformer,
  ExecutionStatsTransformer
} from './ExecutionTransformers';
import { API_ENDPOINTS } from '@/config/api';
import type { 
  BatchExecuteRequest, 
  BatchExecutionResponse 
} from '@/types';
import type { ServiceDependencies } from '../base/ServiceTypes';
import type { 
  SingleExecutionRequest,
  SingleExecutionResponse,
  ExecutionOptions,
  ExecutionHistory,
  ExecutionStats,
  ExecutionFilters,
  AIQueryOptions
} from './ExecutionTypes';

/**
 * 執行服務類別
 */
export class ExecutionService extends BaseService {
  private executionHistory: Map<string, ExecutionHistory> = new Map();

  constructor(dependencies: ServiceDependencies) {
    super(dependencies, 'ExecutionService');
  }

  /**
   * 執行單一設備指令
   */
  async executeCommand(
    deviceIp: string,
    command: string,
    options: ExecutionOptions = {}
  ): Promise<SingleExecutionResponse> {
    // 建立單一執行請求
    const singleRequest: SingleExecutionRequest = {
      deviceIp,
      command,
      mode: 'command',
      timeout: options.timeout
    };

    // 轉換為批次請求
    const batchRequest = ExecutionRequestTransformer.singleToBatch(singleRequest);
    
    // 應用執行選項
    this.applyExecutionOptions(batchRequest, options);

    // 執行批次請求
    const batchResponse = await this.executeBatch(batchRequest);

    // 轉換回單一回應
    const singleResponse = ExecutionResponseTransformer.batchToSingle(
      batchResponse, 
      deviceIp
    );

    if (!singleResponse) {
      throw this.handleError(
        new Error('無法獲取設備執行結果'),
        'executeCommand',
        { deviceIp, command }
      );
    }

    return singleResponse;
  }

  /**
   * 執行 AI 查詢
   */
  async queryAI(
    deviceIp: string,
    query: string,
    options: AIQueryOptions = {}
  ): Promise<SingleExecutionResponse> {
    const singleRequest: SingleExecutionRequest = {
      deviceIp,
      command: query,
      mode: 'ai',
      timeout: options.timeout
    };

    const batchRequest = ExecutionRequestTransformer.singleToBatch(singleRequest);
    this.applyExecutionOptions(batchRequest, options);

    const batchResponse = await this.executeBatch(batchRequest);
    const singleResponse = ExecutionResponseTransformer.batchToSingle(
      batchResponse, 
      deviceIp
    );

    if (!singleResponse) {
      throw this.handleError(
        new Error('無法獲取 AI 查詢結果'),
        'queryAI',
        { deviceIp, query }
      );
    }

    return singleResponse;
  }

  /**
   * 執行批次指令
   */
  async executeBatch(request: BatchExecuteRequest): Promise<BatchExecutionResponse> {
    // 驗證請求
    const validation = ExecutionRequestTransformer.validateBatchRequest(request);
    if (!validation.isValid) {
      throw this.handleError(
        new Error(`批次請求驗證失敗: ${validation.errors.join(', ')}`),
        'executeBatch',
        request
      );
    }

    // 正規化請求
    const normalizedRequest = ExecutionRequestTransformer.normalizeBatchRequest(request);

    // 記錄執行開始
    const executionId = this.generateExecutionId();
    const history = ExecutionHistoryTransformer.createHistory(
      executionId,
      normalizedRequest
    );
    this.executionHistory.set(executionId, history);

    try {
      // 執行 API 請求
      const response = await this.makeRequest(
        () => this.apiClient.post<BatchExecutionResponse>(
          API_ENDPOINTS.BATCH_EXECUTE,
          normalizedRequest
        ),
        'executeBatch',
        normalizedRequest
      );

      // 正規化回應
      const normalizedResponse = ExecutionResponseTransformer.normalizeBatchResponse(response);

      // 更新執行歷史
      const updatedHistory = ExecutionHistoryTransformer.updateHistory(
        history,
        normalizedResponse
      );
      this.executionHistory.set(executionId, updatedHistory);

      this.logOperation('executeBatch', {
        executionId,
        deviceCount: normalizedRequest.devices.length,
        mode: normalizedRequest.mode,
        success: normalizedResponse.success,
      });

      return normalizedResponse;
    } catch (error) {
      // 更新執行歷史為失敗狀態
      const failedHistory: ExecutionHistory = {
        ...history,
        status: 'failed',
        endTime: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
      this.executionHistory.set(executionId, failedHistory);

      throw error;
    }
  }

  /**
   * 執行批次指令（異步）
   */
  async executeBatchAsync(request: BatchExecuteRequest): Promise<string> {
    // 這裡需要調用異步批次執行 API
    // 由於原有的 batchExecuteAsync 在 api/services.ts 中，
    // 我們需要重新實現或者依賴注入
    throw this.handleError(
      new Error('異步執行服務尚未實現'),
      'executeBatchAsync',
      request
    );
  }

  /**
   * 獲取執行歷史
   */
  getExecutionHistory(filters?: ExecutionFilters): ExecutionHistory[] {
    let histories = Array.from(this.executionHistory.values());

    if (filters) {
      histories = histories.filter(history => {
        if (filters.mode && history.request.mode !== filters.mode) {
          return false;
        }
        
        if (filters.status && history.status !== filters.status) {
          return false;
        }
        
        if (filters.deviceIp && !history.request.devices.includes(filters.deviceIp)) {
          return false;
        }
        
        if (filters.command) {
          const command = filters.command.toLowerCase();
          if (!history.request.command.toLowerCase().includes(command)) {
            return false;
          }
        }

        if (filters.startDate) {
          if (new Date(history.startTime) < new Date(filters.startDate)) {
            return false;
          }
        }

        if (filters.endDate) {
          if (new Date(history.startTime) > new Date(filters.endDate)) {
            return false;
          }
        }

        return true;
      });
    }

    return histories.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * 獲取執行統計
   */
  getExecutionStats(filters?: ExecutionFilters): ExecutionStats {
    const histories = this.getExecutionHistory(filters);
    return ExecutionStatsTransformer.calculateStats(histories);
  }

  /**
   * 清除執行歷史
   */
  clearExecutionHistory(olderThan?: Date): void {
    if (olderThan) {
      for (const [id, history] of this.executionHistory.entries()) {
        if (new Date(history.startTime) < olderThan) {
          this.executionHistory.delete(id);
        }
      }
    } else {
      this.executionHistory.clear();
    }

    this.logOperation('clearExecutionHistory', {
      clearedCount: olderThan ? 'filtered' : 'all',
      olderThan: olderThan?.toISOString()
    });
  }

  /**
   * 應用執行選項到批次請求
   */
  private applyExecutionOptions(
    request: BatchExecuteRequest,
    options: ExecutionOptions
  ): void {
    if (options.idempotencyKey) {
      request.idempotency_key = options.idempotencyKey;
    }

    if (options.webhookUrl) {
      request.webhook_url = options.webhookUrl;
    }

    if (options.webhookHeaders) {
      request.webhook_headers = options.webhookHeaders;
    }

    if (options.metadata) {
      request.task_metadata = options.metadata;
    }
  }

  /**
   * 生成執行 ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 健康檢查：驗證執行服務狀態
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 嘗試執行一個簡單的健康檢查請求
      await this.makeRequest(
        () => this.apiClient.get('/health'),
        'healthCheck'
      );

      this.logOperation('healthCheck', {
        historyCount: this.executionHistory.size,
        status: 'healthy'
      });

      return true;
    } catch (error) {
      this.logError('healthCheck', error, {
        status: 'unhealthy'
      });

      return false;
    }
  }
}

/**
 * 建立執行服務實例的工廠函數
 */
export function createExecutionService(dependencies: ServiceDependencies): ExecutionService {
  return new ExecutionService(dependencies);
}