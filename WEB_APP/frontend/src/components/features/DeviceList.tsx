/**
 * 設備列表組件
 * 提供可展開的設備清單，支援多選和搜尋結果顯示
 */
import React, { useCallback } from 'react';
import { type Device } from '@/types';
import { INFO_STYLES } from '@/constants';

interface DeviceListProps {
  /** 要顯示的設備列表（已篩選） */
  devices: Device[];
  /** 已選擇的設備 IP 列表 */
  selectedDevices: string[];
  /** 是否展開列表 */
  isExpanded: boolean;
  /** 設備選擇切換回調 */
  onDeviceToggle: (deviceIp: string) => void;
  /** 搜尋關鍵字（用於空狀態訊息） */
  searchTerm?: string;
  /** 自定義容器樣式 */
  className?: string;
}

const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  selectedDevices,
  isExpanded,
  onDeviceToggle,
  searchTerm = '',
  className = "max-h-64 overflow-y-auto border border-gray-200 rounded-lg transition-all duration-300 ease-in-out"
}) => {
  // 設備選擇切換處理函數
  const handleDeviceToggle = useCallback((deviceIp: string) => {
    onDeviceToggle(deviceIp);
  }, [onDeviceToggle]);

  // 渲染設備項目
  const renderDeviceItem = useCallback((device: Device, index: number) => {
    const isSelected = selectedDevices.includes(device.ip);
    
    return (
      <label
        key={device.ip}
        className={`
          flex items-center space-x-3 p-3 cursor-pointer transition-colors
          ${isSelected ? INFO_STYLES.SELECTED : 'hover:bg-gray-50'}
          ${index !== devices.length - 1 ? 'border-b border-gray-100' : ''}
        `}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleDeviceToggle(device.ip)}
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
  }, [selectedDevices, devices.length, handleDeviceToggle]);

  // 渲染空狀態
  const renderEmptyState = useCallback(() => {
    const message = searchTerm ? '沒有找到符合搜尋條件的設備' : '沒有可用的設備';
    return (
      <div className="text-center py-8 text-terminal-text-secondary">
        {message}
      </div>
    );
  }, [searchTerm]);

  // 如果列表未展開，不渲染任何內容
  if (!isExpanded) {
    return null;
  }

  return (
    <div className={className}>
      {devices.length === 0 ? (
        renderEmptyState()
      ) : (
        devices.map(renderDeviceItem)
      )}
    </div>
  );
};

export default React.memo(DeviceList);