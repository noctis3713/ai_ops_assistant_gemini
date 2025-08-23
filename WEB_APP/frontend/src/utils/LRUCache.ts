/**
 * 輕量化 LRU 快取實現
 * 提供高效的最近最少使用快取機制，支援泛型鍵值對
 * 
 * @template K 鍵的類型
 * @template V 值的類型
 * 
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>(100);
 * cache.set('key1', 42);
 * const value = cache.get('key1'); // 42
 * ```
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  /**
   * 創建 LRU 快取實例
   * @param maxSize 最大快取容量，預設 100
   */
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * 獲取快取項目，自動將其標記為最近使用
   * @param key 要查找的鍵
   * @returns 對應的值，如果不存在則返回 undefined
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 重新插入以更新為最近使用
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // 如果已存在，先刪除舊值
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 如果達到最大大小，刪除最久未使用的項目
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}