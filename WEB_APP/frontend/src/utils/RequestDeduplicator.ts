/**
 * 請求去重機制 - 智能 API 請求優化
 * 
 * 提供基於內容雜湊和時間視窗的智能去重功能，有效減少重複 API 請求
 * 支援可選日誌注入，提升模組獨立性和可重用性
 * 
 * @example
 * ```typescript
 * import { logApi } from '@/utils/SimpleLogger';
 * 
 * const deduplicator = new RequestDeduplicator({
 *   logApi: (message, data) => logApi(message, data)
 * });
 * 
 * const response = await deduplicator.deduplicateRequest(
 *   config,
 *   () => axios.request(config)
 * );
 * ```
 */
import { type AxiosResponse, type AxiosRequestConfig } from 'axios';
import { LRUCache } from './LRUCache';

// 可選的日誌介面，提升模組獨立性
interface Logger {
  logApi: (message: string, data?: Record<string, unknown>) => void;
}

export class RequestDeduplicator {
  private pendingRequests = new LRUCache<string, Promise<AxiosResponse<unknown>>>(50);
  private requestTimestamps = new LRUCache<string, number>(100);
  private logger?: Logger; // 可選注入的日誌器
  
  // 智能去重配置
  private readonly DEDUPE_TIME_WINDOW = 5000; // 5秒內相同請求自動去重
  private readonly CONTENT_HASH_LENGTH = 8;   // 內容雜湊長度

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * 生成請求內容的雜湊值
   */
  private generateContentHash(content: string): string {
    let hash = 0;
    if (content.length === 0) return hash.toString();
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 轉為 32 位整數
    }
    
    return Math.abs(hash).toString(36).substring(0, this.CONTENT_HASH_LENGTH);
  }

  /**
   * 生成請求的唯一標識（基於內容雜湊的智能去重）
   */
  private generateRequestKey(config: AxiosRequestConfig): string {
    const { method = 'get', url = '', params, data } = config;
    
    // 對於 GET 請求，使用 URL + params
    if (method.toUpperCase() === 'GET') {
      const paramsStr = params ? JSON.stringify(params) : '';
      const content = `${url}:${paramsStr}`;
      const hash = this.generateContentHash(content);
      return `GET:${url}:${hash}`;
    }
    
    // 對於 POST 請求，使用 URL + data 內容雜湊
    const dataStr = data ? JSON.stringify(data) : '';
    const content = `${url}:${dataStr}`;
    const hash = this.generateContentHash(content);
    return `${method.toUpperCase()}:${url}:${hash}`;
  }

  /**
   * 檢查時間間隔去重
   */
  private shouldDeduplicateByTime(requestKey: string): boolean {
    const now = Date.now();
    const lastRequestTime = this.requestTimestamps.get(requestKey);
    
    if (lastRequestTime && (now - lastRequestTime) < this.DEDUPE_TIME_WINDOW) {
      return true; // 在時間視窗內，應該去重
    }
    
    // 更新時間戳
    this.requestTimestamps.set(requestKey, now);
    return false;
  }

  /**
   * 檢查是否為應該去重的請求
   */
  private shouldDeduplicate(config: AxiosRequestConfig): boolean {
    const method = config.method?.toUpperCase();
    const url = config.url || '';
    
    // GET 請求都進行去重
    if (method === 'GET') {
      return true;
    }
    
    // 幂等的 POST 請求也進行去重
    const idempotentPosts = [
      '/ai-query',         // AI 查詢相同問題會有相同結果
      '/health',           // 健康檢查
      '/ai-status',        // AI 狀態查詢
      '/devices/status',   // 設備狀態查詢
    ];
    
    // 檢查是否為幂等的 POST 請求
    if (method === 'POST') {
      return idempotentPosts.some(path => url.includes(path));
    }
    
    return false;
  }

  /**
   * 獲取或創建請求（智能去重版本）
   */
  async deduplicateRequest<T>(
    config: AxiosRequestConfig,
    executeRequest: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    if (!this.shouldDeduplicate(config)) {
      return executeRequest();
    }

    const requestKey = this.generateRequestKey(config);
    
    // 檢查時間間隔去重
    if (this.shouldDeduplicateByTime(requestKey)) {
      // 如果存在正在進行的相同請求，返回該請求
      if (this.pendingRequests.has(requestKey)) {
        this.logger?.logApi('智能去重：返回進行中的相同請求', { requestKey });
        return this.pendingRequests.get(requestKey)! as Promise<AxiosResponse<T>>;
      }
    }
    
    // 如果相同請求正在進行中，直接返回結果
    if (this.pendingRequests.has(requestKey)) {
      this.logger?.logApi('去重：返回進行中的請求', { requestKey });
      return this.pendingRequests.get(requestKey)! as Promise<AxiosResponse<T>>;
    }

    // 創建新請求
    const requestPromise = executeRequest().finally(() => {
      // 請求完成後移除緩存，但保留時間戳用於智能去重
      this.pendingRequests.delete(requestKey);
    });

    this.pendingRequests.set(requestKey, requestPromise);
    return requestPromise;
  }

  /**
   * 清除所有待處理請求和時間戳
   */
  clearAll(): void {
    this.pendingRequests.clear();
    this.requestTimestamps.clear();
  }

  /**
   * 獲取快取狀態資訊（用於監控）
   */
  getCacheStats(): { pendingSize: number; timestampSize: number } {
    return {
      pendingSize: this.pendingRequests.size,
      timestampSize: this.requestTimestamps.size
    };
  }
}