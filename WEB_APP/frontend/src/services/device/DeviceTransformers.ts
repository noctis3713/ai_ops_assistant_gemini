/**
 * 設備資料轉換器
 * 處理 API 資料與前端模型之間的轉換
 */

import type { Device, DeviceGroup } from '@/types';
import type { DeviceStats } from './DeviceTypes';

/**
 * 設備資料轉換器
 */
export class DeviceTransformer {
  /**
   * 正規化設備物件
   */
  static normalize(device: Device): Device {
    return {
      ip: device.ip,
      name: device.name || device.ip,
      type: device.type || 'unknown',
      group: device.group || 'default',
      status: device.status || 'unknown',
      description: device.description || '',
      location: device.location || '',
      vendor: device.vendor || '',
      model: device.model || '',
      lastSeen: device.lastSeen,
      tags: device.tags || []
    };
  }

  /**
   * 正規化設備列表
   */
  static normalizeList(devices: Device[]): Device[] {
    return devices.map(DeviceTransformer.normalize);
  }

  /**
   * 從 API 回應轉換設備
   */
  static fromApiResponse(apiDevice: unknown): Device {
    // 類型守衛確保 apiDevice 是物件
    const device = apiDevice as Record<string, unknown>;
    
    return DeviceTransformer.normalize({
      ip: (device.ip || device.device_ip || device.address) as string,
      name: (device.name || device.hostname || device.ip) as string,
      type: (device.type || device.device_type || 'unknown') as string,
      group: (device.group || device.group_name || 'default') as string,
      status: DeviceTransformer.normalizeStatus(device.status),
      description: (device.description || device.desc || '') as string,
      location: (device.location || device.site || '') as string,
      vendor: (device.vendor || device.manufacturer || '') as string,
      model: (device.model || device.device_model || '') as string,
      lastSeen: device.last_seen || device.lastSeen,
      tags: Array.isArray(device.tags) ? device.tags : []
    });
  }

  /**
   * 正規化設備狀態
   */
  private static normalizeStatus(status: unknown): 'online' | 'offline' | 'unknown' {
    if (typeof status !== 'string') {
      return 'unknown';
    }

    const normalizedStatus = status.toLowerCase().trim();
    
    switch (normalizedStatus) {
      case 'online':
      case 'up':
      case 'active':
      case 'reachable':
        return 'online';
      
      case 'offline':
      case 'down':
      case 'inactive':
      case 'unreachable':
        return 'offline';
      
      default:
        return 'unknown';
    }
  }

  /**
   * 篩選設備
   */
  static filterDevices(devices: Device[], filters: {
    group?: string;
    status?: string;
    searchTerm?: string;
    type?: string;
  }): Device[] {
    return devices.filter(device => {
      // 群組篩選
      if (filters.group && device.group !== filters.group) {
        return false;
      }

      // 狀態篩選
      if (filters.status && device.status !== filters.status) {
        return false;
      }

      // 類型篩選
      if (filters.type && device.type !== filters.type) {
        return false;
      }

      // 搜尋篩選
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const searchableText = [
          device.ip,
          device.name,
          device.description,
          device.location,
          device.vendor,
          device.model,
          ...(device.tags || [])
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 計算設備統計
   */
  static calculateStats(devices: Device[]): DeviceStats {
    const stats: DeviceStats = {
      totalDevices: devices.length,
      onlineDevices: 0,
      offlineDevices: 0,
      unknownDevices: 0,
      devicesByGroup: {},
      devicesByType: {}
    };

    devices.forEach(device => {
      // 狀態統計
      switch (device.status) {
        case 'online':
          stats.onlineDevices++;
          break;
        case 'offline':
          stats.offlineDevices++;
          break;
        default:
          stats.unknownDevices++;
          break;
      }

      // 群組統計
      const group = device.group || 'unknown';
      stats.devicesByGroup[group] = (stats.devicesByGroup[group] || 0) + 1;

      // 類型統計
      const type = device.type || 'unknown';
      stats.devicesByType[type] = (stats.devicesByType[type] || 0) + 1;
    });

    return stats;
  }
}

/**
 * 設備群組資料轉換器
 */
export class DeviceGroupTransformer {
  /**
   * 正規化設備群組
   */
  static normalize(group: DeviceGroup): DeviceGroup {
    return {
      id: group.id,
      name: group.name,
      description: group.description || '',
      devices: group.devices || [],
      deviceCount: group.deviceCount || group.devices?.length || 0,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };
  }

  /**
   * 正規化設備群組列表
   */
  static normalizeList(groups: DeviceGroup[]): DeviceGroup[] {
    return groups.map(DeviceGroupTransformer.normalize);
  }

  /**
   * 從 API 回應轉換群組
   */
  static fromApiResponse(apiGroup: unknown): DeviceGroup {
    // 類型守衛確保 apiGroup 是物件
    const group = apiGroup as Record<string, unknown>;
    
    return DeviceGroupTransformer.normalize({
      id: (group.id || group.group_id) as string,
      name: (group.name || group.group_name) as string,
      description: (group.description || group.desc || '') as string,
      devices: Array.isArray(group.devices) 
        ? group.devices.map(DeviceTransformer.fromApiResponse)
        : [],
      deviceCount: (group.device_count || group.deviceCount || 0) as number,
      createdAt: group.created_at || group.createdAt,
      updatedAt: group.updated_at || group.updatedAt
    });
  }

  /**
   * 計算群組統計
   */
  static calculateGroupStats(groups: DeviceGroup[]) {
    return {
      totalGroups: groups.length,
      totalDevicesInGroups: groups.reduce((sum, group) => sum + group.deviceCount, 0),
      averageDevicesPerGroup: groups.length > 0 
        ? groups.reduce((sum, group) => sum + group.deviceCount, 0) / groups.length 
        : 0,
      largestGroup: groups.reduce((largest, group) => 
        group.deviceCount > largest.deviceCount ? group : largest, 
        groups[0] || { deviceCount: 0 }
      )
    };
  }
}