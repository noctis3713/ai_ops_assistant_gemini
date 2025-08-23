/**
 * 設備列表組件
 * 提供可展開的設備清單，支援多選和搜尋結果顯示
 */
import React, { useCallback } from 'react';
import { type Device } from '@/types';
import DeviceItem from './DeviceItem';

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
  // 設備選擇切換處理函數 - 使用穩定的引用
  const handleDeviceToggle = useCallback((deviceIp: string) => {
    onDeviceToggle(deviceIp);
  }, [onDeviceToggle]);

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
        devices.map((device, index) => (
          <DeviceItem
            key={device.ip}
            device={device}
            isSelected={selectedDevices.includes(device.ip)}
            isLastItem={index === devices.length - 1}
            onToggle={handleDeviceToggle}
          />
        ))
      )}
    </div>
  );
};

// 自定義比較函數 - 只在關鍵 props 改變時重新渲染
const areEqual = (
  prevProps: DeviceListProps, 
  nextProps: DeviceListProps
): boolean => {
  // 檢查基本狀態
  if (
    prevProps.isExpanded !== nextProps.isExpanded ||
    prevProps.searchTerm !== nextProps.searchTerm ||
    prevProps.className !== nextProps.className
  ) {
    return false;
  }

  // 檢查設備陣列 - 比較長度和內容
  if (prevProps.devices.length !== nextProps.devices.length) {
    return false;
  }

  // 淺層比較設備陣列（檢查關鍵欄位）
  for (let i = 0; i < prevProps.devices.length; i++) {
    const prev = prevProps.devices[i];
    const next = nextProps.devices[i];
    
    if (
      prev.ip !== next.ip ||
      prev.name !== next.name ||
      prev.description !== next.description ||
      prev.model !== next.model
    ) {
      return false;
    }
  }

  // 檢查選中的設備陣列
  if (prevProps.selectedDevices.length !== nextProps.selectedDevices.length) {
    return false;
  }

  // 比較選中設備的內容
  for (let i = 0; i < prevProps.selectedDevices.length; i++) {
    if (prevProps.selectedDevices[i] !== nextProps.selectedDevices[i]) {
      return false;
    }
  }

  // 函數引用比較
  if (prevProps.onDeviceToggle !== nextProps.onDeviceToggle) {
    return false;
  }

  return true;
};

export default React.memo(DeviceList, areEqual);