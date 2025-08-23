/**
 * 執行服務資料轉換器
 */

import type { 
  BatchExecuteRequest, 
  BatchExecutionResponse,
  BatchResult 
} from '@/types';
import type { 
  SingleExecutionRequest,
  SingleExecutionResponse,
  ExecutionHistory,
  ExecutionProgress,
  ExecutionStats,
  ExecutionStatus
} from './ExecutionTypes';

/**
 * 執行請求轉換器
 */
export class ExecutionRequestTransformer {
  /**
   * 單一執行請求轉換為批次請求
   */
  static singleToBatch(request: SingleExecutionRequest): BatchExecuteRequest {
    return {
      devices: [request.deviceIp],
      command: request.command,
      mode: request.mode,
      // 將超時時間轉換為批次請求格式
      ...(request.timeout && { timeout: request.timeout })
    };
  }

  /**
   * 批次請求正規化
   */
  static normalizeBatchRequest(request: BatchExecuteRequest): BatchExecuteRequest {
    return {
      devices: Array.isArray(request.devices) ? request.devices : [request.devices],
      command: request.command?.trim() || '',
      mode: request.mode || 'command',
      enable_tracking: request.enable_tracking ?? false,
      idempotency_key: request.idempotency_key,
      webhook_url: request.webhook_url,
      webhook_headers: request.webhook_headers,
      task_metadata: request.task_metadata
    };
  }

  /**
   * 驗證批次請求
   */
  static validateBatchRequest(request: BatchExecuteRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 檢查設備列表
    if (!request.devices || request.devices.length === 0) {
      errors.push('設備列表不能為空');
    } else if (request.devices.some(ip => !ip || typeof ip !== 'string')) {
      errors.push('設備 IP 地址格式不正確');
    }

    // 檢查指令
    if (!request.command || typeof request.command !== 'string' || !request.command.trim()) {
      errors.push('指令不能為空');
    }

    // 檢查模式
    if (!['command', 'ai'].includes(request.mode)) {
      errors.push('執行模式必須是 command 或 ai');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * 執行回應轉換器
 */
export class ExecutionResponseTransformer {
  /**
   * 批次回應轉換為單一回應
   */
  static batchToSingle(
    response: BatchExecutionResponse, 
    deviceIp: string
  ): SingleExecutionResponse | null {
    if (!response.results || response.results.length === 0) {
      return null;
    }

    const deviceResult = response.results.find(r => r.device === deviceIp);
    if (!deviceResult) {
      return null;
    }

    return {
      deviceIp: deviceResult.device,
      success: deviceResult.success,
      output: deviceResult.output || '',
      error: deviceResult.error,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 正規化批次回應
   */
  static normalizeBatchResponse(response: BatchExecutionResponse): BatchExecutionResponse {
    return {
      success: response.success ?? false,
      message: response.message || '',
      results: Array.isArray(response.results) 
        ? response.results.map(ExecutionResponseTransformer.normalizeResult)
        : [],
      total_devices: response.total_devices || 0,
      successful_devices: response.successful_devices || 0,
      failed_devices: response.failed_devices || 0,
      timestamp: response.timestamp || new Date().toISOString()
    };
  }

  /**
   * 正規化單一設備結果
   */
  private static normalizeResult(result: BatchResult): BatchResult {
    return {
      device: result.device || '',
      success: result.success ?? false,
      output: result.output || '',
      error: result.error || undefined
    };
  }

  /**
   * 計算執行進度
   */
  static calculateProgress(
    response: BatchExecutionResponse,
    totalDevices: number
  ): ExecutionProgress {
    const completed = response.results?.length || 0;
    const percentage = totalDevices > 0 ? (completed / totalDevices) * 100 : 0;

    return {
      completed,
      total: totalDevices,
      percentage: Math.round(percentage * 100) / 100,
      currentStage: completed === totalDevices ? 'completed' : 'executing',
      startTime: response.timestamp || new Date().toISOString()
    };
  }
}

/**
 * 執行歷史轉換器
 */
export class ExecutionHistoryTransformer {
  /**
   * 建立執行歷史記錄
   */
  static createHistory(
    id: string,
    request: BatchExecuteRequest,
    response?: BatchExecutionResponse
  ): ExecutionHistory {
    const startTime = new Date().toISOString();
    const status = ExecutionHistoryTransformer.determineStatus(response);

    return {
      id,
      request,
      response,
      status,
      startTime,
      endTime: response ? new Date().toISOString() : undefined,
      progress: response 
        ? ExecutionResponseTransformer.calculateProgress(response, request.devices.length)
        : undefined
    };
  }

  /**
   * 更新執行歷史
   */
  static updateHistory(
    history: ExecutionHistory,
    response: BatchExecutionResponse
  ): ExecutionHistory {
    return {
      ...history,
      response,
      status: ExecutionHistoryTransformer.determineStatus(response),
      endTime: new Date().toISOString(),
      progress: ExecutionResponseTransformer.calculateProgress(
        response, 
        history.request.devices.length
      )
    };
  }

  /**
   * 根據回應決定狀態
   */
  private static determineStatus(response?: BatchExecutionResponse): ExecutionStatus {
    if (!response) {
      return 'pending';
    }

    if (response.success) {
      return 'completed';
    }

    // 檢查是否有部分成功
    if (response.successful_devices && response.successful_devices > 0) {
      return 'completed'; // 部分成功也視為完成
    }

    return 'failed';
  }
}

/**
 * 執行統計轉換器
 */
export class ExecutionStatsTransformer {
  /**
   * 從執行歷史計算統計
   */
  static calculateStats(histories: ExecutionHistory[]): ExecutionStats {
    const stats: ExecutionStats = {
      totalExecutions: histories.length,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsByMode: { command: 0, ai: 0 },
      executionsByStatus: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      },
      deviceExecutionCount: {}
    };

    let totalExecutionTime = 0;
    let executionsWithTime = 0;

    histories.forEach(history => {
      // 狀態統計
      stats.executionsByStatus[history.status]++;

      if (history.status === 'completed') {
        stats.successfulExecutions++;
      } else if (history.status === 'failed') {
        stats.failedExecutions++;
      }

      // 模式統計
      stats.executionsByMode[history.request.mode]++;

      // 執行時間統計
      if (history.duration) {
        totalExecutionTime += history.duration;
        executionsWithTime++;
      }

      // 設備執行次數統計
      history.request.devices.forEach(device => {
        stats.deviceExecutionCount[device] = (stats.deviceExecutionCount[device] || 0) + 1;
      });
    });

    // 計算平均執行時間
    if (executionsWithTime > 0) {
      stats.averageExecutionTime = totalExecutionTime / executionsWithTime;
    }

    return stats;
  }
}