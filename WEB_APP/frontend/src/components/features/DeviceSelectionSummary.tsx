/**
 * 設備選擇摘要組件
 * 顯示已選擇設備的數量和詳細名稱列表
 */
import React, { useMemo } from 'react';
import { type Device } from '@/types';
import { INFO_STYLES } from '@/constants';
import { findDeviceByIp } from '@/utils/utils';

interface DeviceSelectionSummaryProps {
  /** 設備列表 */
  devices: Device[];
  /** 已選擇的設備 IP 列表 */
  selectedDevices: string[];
  /** 自定義容器樣式 */
  className?: string;
}

const DeviceSelectionSummary: React.FC<DeviceSelectionSummaryProps> = ({
  devices,
  selectedDevices,
  className = `mt-2 ${INFO_STYLES.CONTAINER_ROUNDED_PADDED}`
}) => {
  // 計算選擇設備的名稱列表，使用 useMemo 優化性能
  const selectedDeviceNames = useMemo(() => {
    return selectedDevices
      .map(ip => {
        const device = findDeviceByIp(devices, ip);
        return device?.name || ip;
      })
      .join(', ');
  }, [devices, selectedDevices]);

  // 如果沒有選擇任何設備，不顯示摘要
  if (selectedDevices.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="text-xs text-blue-800 font-medium mb-1">
        已選擇 {selectedDevices.length} 個設備
      </div>
      <div className="text-xs text-blue-600 break-words">
        {selectedDeviceNames}
      </div>
    </div>
  );
};

export default React.memo(DeviceSelectionSummary);