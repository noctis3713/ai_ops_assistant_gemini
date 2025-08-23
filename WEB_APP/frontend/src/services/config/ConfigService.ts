/**
 * 配置服務
 * 提供後端配置相關的 API 操作
 */

import { BaseService } from '../base/BaseService';
import { ServiceError } from '../base/ServiceError';
import type { ServiceDependencies } from '../base/ServiceTypes';
import type { 
  ConfigServiceOptions,
  ConfigHealthResult,
  ConfigCacheStats
} from './ConfigTypes';
import type { BackendConfig } from '@/types';
import { API_ENDPOINTS } from '@/config/api';

/**
 * 配置服務實作
 */
export class ConfigService extends BaseService {
  private configCache: BackendConfig | null = null;
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘快取

  constructor(dependencies: ServiceDependencies) {
    super(dependencies, 'ConfigService');
  }

  /**
   * 獲取後端配置
   */
  async getBackendConfig(options: ConfigServiceOptions = {}): Promise<BackendConfig> {
    try {
      // 檢查快取
      if (!options.forceReload && this.isCacheValid()) {
        return this.configCache!;
      }

      const config = await this.makeRequest(
        () => this.apiClient.get<BackendConfig>(API_ENDPOINTS.BACKEND_CONFIG),
        'getBackendConfig',
        options,
        {
          timeout: options.timeout || 10000,
          retryCount: 2
        }
      );

      // 更新快取
      this.configCache = config;
      this.cacheTimestamp = new Date();

      return config;
    } catch (error) {
      throw new ServiceError(
        `獲取後端配置失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
        'getBackendConfig',
        'NETWORK_ERROR',
        'ERROR',
        { originalError: error, options }
      );
    }
  }

  /**
   * 重新載入配置（清除快取並重新獲取）
   */
  async reloadConfig(): Promise<BackendConfig> {
    this.clearCache();
    return this.getBackendConfig({ forceReload: true });
  }

  /**
   * 檢查 AI 查詢功能是否啟用
   */
  async isAiQueryEnabled(options: ConfigServiceOptions = {}): Promise<boolean> {
    try {
      const config = await this.getBackendConfig(options);
      const result = config.ai?.enableAiQuery ?? true;
      console.log('AI 查詢配置獲取成功:', { enableAiQuery: result, config: config.ai });
      return result;
    } catch (error) {
      // 發生錯誤時預設為啟用，提供更好的使用者體驗
      console.warn('無法獲取 AI 查詢配置，預設為啟用:', error);
      return true; // 改為預設啟用
    }
  }

  /**
   * 獲取配置健康狀態
   */
  async getConfigHealth(): Promise<ConfigHealthResult> {
    try {
      const config = await this.getBackendConfig({ forceReload: true });
      
      return {
        healthy: true,
        version: config.version,
        lastUpdated: this.cacheTimestamp || new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : '未知錯誤'
      };
    }
  }

  /**
   * 獲取配置快取統計
   */
  getCacheStats(): ConfigCacheStats {
    return {
      hits: 0, // 實際實作中需要統計
      misses: 0,
      size: this.configCache ? 1 : 0,
      lastUpdate: this.cacheTimestamp || new Date()
    };
  }

  /**
   * 清除配置快取
   */
  clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = null;
  }

  /**
   * 服務健康檢查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.getConfigHealth();
      return health.healthy;
    } catch {
      return false;
    }
  }

  /**
   * 檢查快取是否有效
   */
  private isCacheValid(): boolean {
    if (!this.configCache || !this.cacheTimestamp) {
      return false;
    }

    const now = new Date();
    const cacheAge = now.getTime() - this.cacheTimestamp.getTime();
    return cacheAge < this.CACHE_DURATION;
  }
}