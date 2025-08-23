/**
 * 配置服務類型定義
 */

import type { BackendConfig } from '@/types';

/**
 * 配置查詢選項
 */
export interface ConfigQueryOptions {
  /** 是否啟用快取 */
  enableCache?: boolean;
  /** 快取時間（秒） */
  cacheTime?: number;
  /** 錯誤重試次數 */
  retryCount?: number;
}

/**
 * 配置服務方法選項
 */
export interface ConfigServiceOptions {
  /** 是否強制重新載入 */
  forceReload?: boolean;
  /** 超時時間（毫秒） */
  timeout?: number;
}

/**
 * 配置更新結果
 */
export interface ConfigUpdateResult {
  /** 更新是否成功 */
  success: boolean;
  /** 錯誤訊息（如有） */
  error?: string;
  /** 更新的配置數據 */
  config?: BackendConfig;
}

/**
 * 配置健康檢查結果
 */
export interface ConfigHealthResult {
  /** 配置服務是否健康 */
  healthy: boolean;
  /** 配置版本 */
  version?: string;
  /** 最後更新時間 */
  lastUpdated?: Date;
  /** 錯誤訊息（如有） */
  error?: string;
}

/**
 * 配置快取統計
 */
export interface ConfigCacheStats {
  /** 快取命中次數 */
  hits: number;
  /** 快取未命中次數 */
  misses: number;
  /** 快取大小 */
  size: number;
  /** 最後更新時間 */
  lastUpdate: Date;
}