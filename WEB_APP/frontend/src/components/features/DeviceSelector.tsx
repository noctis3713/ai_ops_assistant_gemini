/**
 * 設備選擇組件
 * 顯示可用設備列表並支援選擇
 */
import React from 'react';
import { type DeviceSelectorProps } from '@/types';
import { DEFAULT_TEXT, ELEMENT_IDS } from '@/constants';

const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  devices,
  selectedDevice,
  onDeviceChange,
  isLoading = false,
}) => {
  // 獲取佔位符文字
  const placeholderText = isLoading 
    ? DEFAULT_TEXT.DEVICE_SELECTOR_LOADING 
    : DEFAULT_TEXT.DEVICE_SELECTOR_PLACEHOLDER;

  return (
    <div className="mb-6">
      <label 
        htmlFor={ELEMENT_IDS.DEVICE_SELECTOR} 
        className="label-primary"
      >
        選擇設備：
      </label>
      <select
        id={ELEMENT_IDS.DEVICE_SELECTOR}
        className="form-select"
        value={selectedDevice}
        onChange={(e) => onDeviceChange(e.target.value)}
        disabled={isLoading}
      >
        <option value="">
          {placeholderText}
        </option>
        {devices.map((device) => (
          <option key={device.ip} value={device.ip}>
            {device.name} ({device.ip}) - {device.model}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DeviceSelector;