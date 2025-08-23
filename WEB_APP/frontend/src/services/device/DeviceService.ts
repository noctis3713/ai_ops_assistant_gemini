/**
 * 設備服務
 * 提供設備和設備群組的統一管理介面
 */

import { BaseService } from '../base/BaseService';
import { DeviceTransformer, DeviceGroupTransformer } from './DeviceTransformers';
import { API_ENDPOINTS } from '@/config/api';
import type { Device, DeviceGroup } from '@/types';
import type { ServiceDependencies } from '../base/ServiceTypes';
import type { 
  DeviceFilters, 
  DeviceValidationResult, 
  DeviceStats, 
  DeviceQueryOptions,
  DeviceGroupQueryOptions 
} from './DeviceTypes';

/**
 * 設備服務類別
 */
export class DeviceService extends BaseService {
  constructor(dependencies: ServiceDependencies) {
    super(dependencies, 'DeviceService');
  }

  /**
   * 獲取設備列表
   */
  async getDevices(options: DeviceQueryOptions = {}): Promise<Device[]> {
    return this.makeRequest(
      () => this.apiClient.get(API_ENDPOINTS.DEVICES),
      'getDevices',
      options
    ).then(data => {
      // 轉換和正規化資料
      const devices = Array.isArray(data) ? data : [];
      return DeviceTransformer.normalizeList(
        devices.map(DeviceTransformer.fromApiResponse)
      );
    });
  }

  /**
   * 根據 IP 獲取單一設備
   */
  async getDeviceByIp(ip: string): Promise<Device | null> {
    if (!ip || typeof ip !== 'string') {
      throw this.handleError(
        new Error('設備 IP 地址不能為空'),
        'getDeviceByIp',
        { ip }
      );
    }

    try {
      return await this.makeRequest(
        () => this.apiClient.get(`${API_ENDPOINTS.DEVICES}/${encodeURIComponent(ip)}`),
        'getDeviceByIp',
        { ip }
      ).then(data => {
        if (!data) return null;
        return DeviceTransformer.normalize(DeviceTransformer.fromApiResponse(data));
      });
    } catch (error) {
      // 如果是 404 錯誤，返回 null 而不是拋出錯誤
      if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 搜尋設備
   */
  async searchDevices(filters: DeviceFilters): Promise<Device[]> {
    const devices = await this.getDevices();
    return DeviceTransformer.filterDevices(devices, filters);
  }

  /**
   * 驗證設備連線狀態
   */
  async validateDevice(ip: string): Promise<DeviceValidationResult> {
    const result: DeviceValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    try {
      // 基本 IP 格式驗證
      if (!this.isValidIpAddress(ip)) {
        result.errors.push('IP 地址格式不正確');
        return result;
      }

      // 檢查設備是否存在
      const device = await this.getDeviceByIp(ip);
      if (!device) {
        result.errors.push('設備不存在或無法連線');
        return result;
      }

      result.device = device;
      result.isValid = true;

      // 添加狀態警告
      if (device.status !== 'online') {
        result.warnings.push(`設備狀態為 ${device.status}`);
      }

      return result;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : '設備驗證失敗'
      );
      return result;
    }
  }

  /**
   * 獲取設備統計資訊
   */
  async getDeviceStats(): Promise<DeviceStats> {
    const devices = await this.getDevices();
    return DeviceTransformer.calculateStats(devices);
  }

  /**
   * 獲取設備群組列表
   */
  async getDeviceGroups(options: DeviceGroupQueryOptions = {}): Promise<DeviceGroup[]> {
    return this.makeRequest(
      () => this.apiClient.get(API_ENDPOINTS.DEVICE_GROUPS),
      'getDeviceGroups',
      options
    ).then(data => {
      const groups = Array.isArray(data) ? data : [];
      return DeviceGroupTransformer.normalizeList(
        groups.map(DeviceGroupTransformer.fromApiResponse)
      );
    });
  }

  /**
   * 根據 ID 獲取設備群組
   */
  async getDeviceGroupById(id: string): Promise<DeviceGroup | null> {
    if (!id || typeof id !== 'string') {
      throw this.handleError(
        new Error('群組 ID 不能為空'),
        'getDeviceGroupById',
        { id }
      );
    }

    try {
      return await this.makeRequest(
        () => this.apiClient.get(`${API_ENDPOINTS.DEVICE_GROUPS}/${encodeURIComponent(id)}`),
        'getDeviceGroupById',
        { id }
      ).then(data => {
        if (!data) return null;
        return DeviceGroupTransformer.normalize(
          DeviceGroupTransformer.fromApiResponse(data)
        );
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 獲取群組內的設備
   */
  async getDevicesInGroup(groupId: string): Promise<Device[]> {
    const group = await this.getDeviceGroupById(groupId);
    if (!group) {
      return [];
    }

    // 如果群組包含設備列表，直接返回
    if (group.devices && group.devices.length > 0) {
      return group.devices;
    }

    // 否則透過篩選獲取
    return this.searchDevices({ group: group.name });
  }

  /**
   * 驗證 IP 地址格式
   */
  private isValidIpAddress(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * 刷新設備快取
   */
  async refreshDeviceCache(): Promise<void> {
    this.queryClient.invalidateQueries({
      queryKey: this.createQueryKey(['devices'])
    });
    
    this.logOperation('refreshDeviceCache', {
      message: '設備快取已刷新'
    });
  }

  /**
   * 刷新設備群組快取
   */
  async refreshDeviceGroupCache(): Promise<void> {
    this.queryClient.invalidateQueries({
      queryKey: this.createQueryKey(['deviceGroups'])
    });
    
    this.logOperation('refreshDeviceGroupCache', {
      message: '設備群組快取已刷新'
    });
  }

  /**
   * 健康檢查：驗證設備服務狀態
   */
  async healthCheck(): Promise<boolean> {
    try {
      const devices = await this.getDevices();
      const groups = await this.getDeviceGroups();
      
      this.logOperation('healthCheck', {
        deviceCount: devices.length,
        groupCount: groups.length,
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
 * 建立設備服務實例的工廠函數
 */
export function createDeviceService(dependencies: ServiceDependencies): DeviceService {
  return new DeviceService(dependencies);
}