/**
 * 設備選擇容器
 * 提供統一的設備選擇界面
 */
import React from 'react';
import { type DeviceSelectionContainerProps } from '@/types';
import MultiDeviceSelector from './MultiDeviceSelector';
import ModeSelector from './ModeSelector';

const DeviceSelectionContainer = ({
  devices,
  selectedDevices,
  onDevicesChange,
  executionMode,
  onExecutionModeChange,
  isLoading = false
}: DeviceSelectionContainerProps) => {
  return (
    <div className="space-y-4">
      {/* 執行模式選擇器 */}
      <div>
        <label className="label-primary">
          執行模式
        </label>
        <ModeSelector
          mode={executionMode}
          onModeChange={onExecutionModeChange}
        />
      </div>

      {/* 設備選擇器 */}
      <MultiDeviceSelector
        devices={devices}
        selectedDevices={selectedDevices}
        onDevicesChange={onDevicesChange}
        isLoading={isLoading}
      />
    </div>
  );
};

export default React.memo(DeviceSelectionContainer);