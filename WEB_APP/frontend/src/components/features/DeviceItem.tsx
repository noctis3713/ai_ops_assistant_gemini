/**
 * 設備項目組件
 * 獨立的記憶化組件，減少 DeviceList 的重新渲染
 */
import React from 'react';
import { type Device } from '@/types';
import { INFO_STYLES } from '@/config';

interface DeviceItemProps {
  /** 設備物件 */
  device: Device;
  /** 是否已選中 */
  isSelected: boolean;
  /** 是否為最後一個項目（用於邊框樣式） */
  isLastItem: boolean;
  /** 設備切換回調 */
  onToggle: (deviceIp: string) => void;
}

const DeviceItem: React.FC<DeviceItemProps> = ({
  device,
  isSelected,
  isLastItem,
  onToggle
}) => {
  return (
    <label
      className={`
        flex items-center space-x-3 p-3 cursor-pointer transition-colors
        ${isSelected ? INFO_STYLES.SELECTED : 'hover:bg-gray-50'}
        ${!isLastItem ? 'border-b border-gray-100' : ''}
      `}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(device.ip)}
        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-terminal-text-primary truncate">
            {device.name || device.ip}
          </p>
          <span className="text-xs text-terminal-text-secondary ml-2">
            {device.model}
          </span>
        </div>
        <p className="text-xs text-terminal-text-secondary truncate">
          {device.ip} • {device.description}
        </p>
      </div>
    </label>
  );
};

// 自定義比較函數 - 優化重新渲染
const areEqual = (
  prevProps: DeviceItemProps, 
  nextProps: DeviceItemProps
): boolean => {
  // 檢查選中狀態和最後項目狀態
  if (
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isLastItem !== nextProps.isLastItem
  ) {
    return false;
  }

  // 檢查設備物件的關鍵屬性
  const prevDevice = prevProps.device;
  const nextDevice = nextProps.device;
  
  if (
    prevDevice.ip !== nextDevice.ip ||
    prevDevice.name !== nextDevice.name ||
    prevDevice.description !== nextDevice.description ||
    prevDevice.model !== nextDevice.model
  ) {
    return false;
  }

  // 函數引用比較
  if (prevProps.onToggle !== nextProps.onToggle) {
    return false;
  }

  return true;
};

export default React.memo(DeviceItem, areEqual);