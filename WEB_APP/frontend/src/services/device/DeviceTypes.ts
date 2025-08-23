/**
 * 設備服務相關類型定義
 */

import type { Device } from '@/types';

/**
 * 設備篩選器介面
 */
export interface DeviceFilters {
  group?: string;
  status?: 'online' | 'offline' | 'unknown';
  searchTerm?: string;
  type?: string;
}

/**
 * 設備驗證結果
 */
export interface DeviceValidationResult {
  isValid: boolean;
  device?: Device;
  errors: string[];
  warnings: string[];
}

/**
 * 設備統計資訊
 */
export interface DeviceStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  unknownDevices: number;
  devicesByGroup: Record<string, number>;
  devicesByType: Record<string, number>;
}

/**
 * 設備查詢選項
 */
export interface DeviceQueryOptions {
  includeOffline?: boolean;
  includeStats?: boolean;
  groupFilter?: string;
}

/**
 * 設備群組查詢選項
 */
export interface DeviceGroupQueryOptions {
  includeDeviceCount?: boolean;
  activeOnly?: boolean;
}