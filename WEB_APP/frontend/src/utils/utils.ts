// 工具函數
// 注意: cn 函數已移至 @/lib/utils.ts，請從該處導入

/**
 * 設備查詢工具函數
 * 統一處理不同類型的查找邏輯，減少程式碼重複
 */

// 設備查找工具函數
export const findDeviceByIp = <T extends { ip: string }>(devices: T[], ip: string): T | undefined => {
  return devices.find(device => device.ip === ip);
};

// 群組查找工具函數  
export const findGroupByName = <T extends { name: string }>(groups: T[], name: string): T | undefined => {
  return groups.find(group => group.name === name);
};

// 通用查找工具函數
export const findByProperty = <T, K extends keyof T>(
  items: T[], 
  property: K, 
  value: T[K]
): T | undefined => {
  return items.find(item => item[property] === value);
};

/**
 * 通用工具函數集合
 * 減少各組件中的重複邏輯
 */

// 深拷貝函數
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloneObj = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloneObj[key] = deepClone(obj[key]);
      }
    }
    return cloneObj;
  }
  return obj;
};

// 淺層對象比較
export const shallowEqual = (obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  return true;
};

// 陣列去重（基於屬性）
export const uniqueByProperty = <T, K extends keyof T>(
  array: T[], 
  property: K
): T[] => {
  const seen = new Set();
  return array.filter(item => {
    const value = item[property];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

// 陣列去重（基於值）
export const uniqueArray = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

// 延遲執行工具函數（Promise-based）
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 格式化檔案大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// 格式化時間戳
export const formatTimestamp = (timestamp: number, format: 'time' | 'datetime' | 'date' = 'datetime'): string => {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'time':
      return date.toLocaleTimeString('zh-TW', { hour12: false });
    case 'date':
      return date.toLocaleDateString('zh-TW');
    case 'datetime':
    default:
      return date.toLocaleString('zh-TW', { hour12: false });
  }
};

// 類型守衛函數
export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

export const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

// 安全的 JSON 解析
export const safeJSONParse = <T>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
};

// 截斷文字
export const truncateText = (text: string, maxLength: number, suffix = '...'): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
};

// 隨機字串生成器
export const generateRandomId = (length = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};