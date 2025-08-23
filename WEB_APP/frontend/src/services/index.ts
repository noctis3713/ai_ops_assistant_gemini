/**
 * 服務層統一導出
 * 提供完整的服務層 API 和工具
 */

// 基礎服務
export * from './base';

// 領域服務
export * from './device';
export * from './execution';
export * from './config';

// 任務相關
export { TaskPoller, createTaskPoller } from './task/TaskPoller';
export * from './task/TaskTypes';

// Hooks
export * from './hooks';

// 服務工廠函數
import { apiClient } from '@/api/client';
import type { QueryClient } from '@tanstack/react-query';
import { DeviceService } from './device/DeviceService';
import { ExecutionService } from './execution/ExecutionService';
import { ConfigService } from './config/ConfigService';
import type { ServiceDependencies } from './base/ServiceTypes';

/**
 * 建立服務依賴物件
 */
export function createServiceDependencies(queryClient: QueryClient): ServiceDependencies {
  return {
    apiClient,
    queryClient
  };
}

/**
 * 服務工廠類別
 * 提供統一的服務實例建立和管理
 */
export class ServiceFactory {
  private dependencies: ServiceDependencies;
  private deviceService?: DeviceService;
  private executionService?: ExecutionService;
  private configService?: ConfigService;

  constructor(queryClient: QueryClient) {
    this.dependencies = createServiceDependencies(queryClient);
  }

  /**
   * 獲取設備服務實例（單例）
   */
  getDeviceService(): DeviceService {
    if (!this.deviceService) {
      this.deviceService = new DeviceService(this.dependencies);
    }
    return this.deviceService;
  }

  /**
   * 獲取執行服務實例（單例）
   */
  getExecutionService(): ExecutionService {
    if (!this.executionService) {
      this.executionService = new ExecutionService(this.dependencies);
    }
    return this.executionService;
  }

  /**
   * 獲取配置服務實例（單例）
   */
  getConfigService(): ConfigService {
    if (!this.configService) {
      this.configService = new ConfigService(this.dependencies);
    }
    return this.configService;
  }

  /**
   * 獲取所有服務的健康狀態
   */
  async getAllServicesHealth(): Promise<Record<string, boolean>> {
    const deviceHealth = await this.getDeviceService().healthCheck();
    const executionHealth = await this.getExecutionService().healthCheck();
    const configHealth = await this.getConfigService().healthCheck();

    return {
      device: deviceHealth,
      execution: executionHealth,
      config: configHealth
    };
  }

  /**
   * 清理所有服務快取
   */
  clearAllCaches(): void {
    this.dependencies.queryClient.clear();
  }

  /**
   * 重新整理所有服務快取
   */
  async refreshAllCaches(): Promise<void> {
    await this.getDeviceService().refreshDeviceCache();
    await this.getDeviceService().refreshDeviceGroupCache();
  }
}

/**
 * 全域服務工廠實例（需要在應用初始化時設定）
 */
let globalServiceFactory: ServiceFactory | null = null;

/**
 * 初始化全域服務工廠
 */
export function initializeServices(queryClient: QueryClient): ServiceFactory {
  globalServiceFactory = new ServiceFactory(queryClient);
  return globalServiceFactory;
}

/**
 * 獲取全域服務工廠實例
 */
export function getServiceFactory(): ServiceFactory {
  if (!globalServiceFactory) {
    throw new Error('服務工廠尚未初始化，請先調用 initializeServices()');
  }
  return globalServiceFactory;
}

/**
 * 便利函數：獲取設備服務
 */
export function getDeviceService(): DeviceService {
  return getServiceFactory().getDeviceService();
}

/**
 * 便利函數：獲取執行服務
 */
export function getExecutionService(): ExecutionService {
  return getServiceFactory().getExecutionService();
}

/**
 * 便利函數：獲取配置服務
 */
export function getConfigService(): ConfigService {
  return getServiceFactory().getConfigService();
}