/**
 * 設備篩選自定義 Hook
 * 提供設備清單的搜尋篩選功能，支援多欄位模糊搜尋
 */
import { useMemo } from 'react';
import { type Device } from '@/types';

interface UseDeviceFilterOptions {
  /** 篩選欄位配置 */
  searchFields?: {
    /** 是否搜尋設備名稱 */
    name?: boolean;
    /** 是否搜尋 IP 位址 */
    ip?: boolean;
    /** 是否搜尋設備型號 */
    model?: boolean;
    /** 是否搜尋設備描述 */
    description?: boolean;
  };
  /** 是否區分大小寫 */
  caseSensitive?: boolean;
}

interface UseDeviceFilterReturn {
  /** 篩選後的設備列表 */
  filteredDevices: Device[];
  /** 篩選統計資訊 */
  filterStats: {
    /** 總設備數 */
    totalCount: number;
    /** 篩選後設備數 */
    filteredCount: number;
    /** 是否有篩選條件 */
    hasFilter: boolean;
  };
}

/**
 * 設備篩選自定義 Hook
 * 
 * @param devices 設備列表
 * @param searchTerm 搜尋關鍵字
 * @param options 篩選選項
 * @returns 篩選結果和統計資訊
 * 
 * @example
 * ```tsx
 * const { filteredDevices, filterStats } = useDeviceFilter(devices, searchTerm, {
 *   searchFields: {
 *     name: true,
 *     ip: true,
 *     model: true,
 *     description: true
 *   },
 *   caseSensitive: false
 * });
 * ```
 */
export const useDeviceFilter = (
  devices: Device[],
  searchTerm: string,
  options: UseDeviceFilterOptions = {}
): UseDeviceFilterReturn => {
  const {
    searchFields = {
      name: true,
      ip: true,
      model: true,
      description: true
    },
    caseSensitive = false
  } = options;

  const filteredDevices = useMemo(() => {
    // 如果沒有搜尋關鍵字，直接返回所有設備
    if (!searchTerm.trim()) {
      return devices;
    }

    const searchValue = caseSensitive ? searchTerm : searchTerm.toLowerCase();

    return devices.filter(device => {
      // 檢查每個搜尋欄位
      const checks: boolean[] = [];

      // 設備名稱搜尋
      if (searchFields.name && device.name) {
        const name = caseSensitive ? device.name : device.name.toLowerCase();
        checks.push(name.includes(searchValue));
      }

      // IP 位址搜尋
      if (searchFields.ip && device.ip) {
        const ip = caseSensitive ? device.ip : device.ip.toLowerCase();
        checks.push(ip.includes(searchValue));
      }

      // 設備型號搜尋
      if (searchFields.model && device.model) {
        const model = caseSensitive ? device.model : device.model.toLowerCase();
        checks.push(model.includes(searchValue));
      }

      // 設備描述搜尋
      if (searchFields.description && device.description) {
        const description = caseSensitive ? device.description : device.description.toLowerCase();
        checks.push(description.includes(searchValue));
      }

      // 任一欄位符合條件即通過篩選
      return checks.some(check => check);
    });
  }, [devices, searchTerm, searchFields, caseSensitive]);

  const filterStats = useMemo(() => ({
    totalCount: devices.length,
    filteredCount: filteredDevices.length,
    hasFilter: searchTerm.trim() !== ''
  }), [devices.length, filteredDevices.length, searchTerm]);

  return {
    filteredDevices,
    filterStats
  };
};