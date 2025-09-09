// 工具函數
// 注意: cn 函數已移至 @/lib/utils.ts，請從該處導入

/**
 * 設備查詢工具函數
 */

// 設備查找工具函數
export const findDeviceByIp = <T extends { ip: string }>(devices: T[], ip: string): T | undefined => {
  return devices.find(device => device.ip === ip);
};

// 群組查找  
export const findGroupByName = <T extends { name: string }>(groups: T[], name: string): T | undefined => {
  return groups.find(group => group.name === name);
};

// 通用查找
export const findByProperty = <T, K extends keyof T>(
  items: T[], 
  property: K, 
  value: T[K]
): T | undefined => {
  return items.find(item => item[property] === value);
};

/**
 * 通用工具函數
 */

// 深拷貝
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as T;
  if (typeof obj === 'object') {
    const cloneObj = {} as { [K in keyof T]: T[K] };
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloneObj[key] = deepClone(obj[key]);
      }
    }
    return cloneObj as T;
  }
  return obj;
};

// 淺層比較
export const shallowEqual = (obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  return true;
};

// 屬性去重
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

// 值去重
export const uniqueArray = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

// 延遲執行
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 檔案大小格式化
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// 時間格式化
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

// 類型守衛
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

export const isEmpty = (value: unknown): value is null | undefined | '' | [] | Record<string, never> => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
  return false;
};

// 安全 JSON 解析
export const safeJSONParse = <T = unknown>(str: string, fallback: T): T => {
  if (typeof str !== 'string') return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed as T;
  } catch {
    return fallback;
  }
};

// 文字截斷
export const truncateText = (text: string, maxLength: number, suffix = '...'): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
};

// 隨機 ID 生成
export const generateRandomId = (length = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};