/**
 * 服務層使用示範組件
 * 展示如何使用新的統一服務層
 */

import React, { useState } from 'react';
import { 
  useDevices,
  useDeviceGroups,
  useDeviceSearch,
  useCommandExecution,
  useRefreshDeviceCache
} from '@/services';
import type { Device, DeviceGroup } from '@/types';
import type { DeviceFilters } from '@/services/device/DeviceTypes';

/**
 * 設備管理示範組件
 */
const DeviceManagementExample: React.FC = () => {
  const [searchFilters, setSearchFilters] = useState<DeviceFilters>({});
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [command, setCommand] = useState<string>('show version');

  // 使用新的服務層 Hooks
  const { 
    data: devices = [], 
    isLoading: devicesLoading, 
    error: devicesError 
  } = useDevices();

  const { 
    data: deviceGroups = [], 
    isLoading: groupsLoading 
  } = useDeviceGroups();

  const { 
    data: searchResults = [], 
    isLoading: searchLoading 
  } = useDeviceSearch(searchFilters);

  // 執行相關 Hooks
  const { executeWithMode, isLoading: executionLoading } = useCommandExecution();
  
  // 快取管理
  const refreshCache = useRefreshDeviceCache();

  // 處理設備選擇
  const handleDeviceSelect = (deviceIp: string) => {
    setSelectedDevice(deviceIp);
  };

  // 處理指令執行
  const handleExecuteCommand = async () => {
    if (!selectedDevice || !command) {
      alert('請選擇設備並輸入指令');
      return;
    }

    try {
      const result = await executeWithMode(selectedDevice, command, 'command');
      
      if ('output' in result) {
        // 單一設備結果
        alert(`執行成功:\n${result.output}`);
      } else {
        // 批次執行結果
        const deviceResult = result.results?.find(r => r.device === selectedDevice);
        if (deviceResult) {
          alert(`執行成功:\n${deviceResult.output}`);
        }
      }
    } catch (error) {
      alert(`執行失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  };

  // 處理搜尋
  const handleSearch = (searchTerm: string) => {
    setSearchFilters({ searchTerm });
  };

  // 處理快取刷新
  const handleRefreshCache = () => {
    refreshCache.mutate();
  };

  // 錯誤顯示
  if (devicesError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">載入設備時發生錯誤</h3>
        <p className="text-red-600">{devicesError.message}</p>
        <button 
          onClick={handleRefreshCache}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          重新載入
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">服務層示範</h2>
      
      {/* 設備列表區域 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">設備列表</h3>
          <button
            onClick={handleRefreshCache}
            disabled={refreshCache.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshCache.isPending ? '刷新中...' : '刷新快取'}
          </button>
        </div>

        {devicesLoading ? (
          <div className="text-center py-4">載入設備中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device: Device) => (
              <div
                key={device.ip}
                onClick={() => handleDeviceSelect(device.ip)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedDevice === device.ip
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">{device.name}</div>
                <div className="text-sm text-gray-600">{device.ip}</div>
                <div className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                  device.status === 'online' 
                    ? 'bg-green-100 text-green-800'
                    : device.status === 'offline'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {device.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 設備群組區域 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">設備群組</h3>
        {groupsLoading ? (
          <div className="text-center py-4">載入群組中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deviceGroups.map((group: DeviceGroup) => (
              <div key={group.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="font-semibold">{group.name}</div>
                <div className="text-sm text-gray-600">{group.description}</div>
                <div className="text-xs text-gray-500 mt-2">
                  設備數量: {group.deviceCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 搜尋區域 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">設備搜尋</h3>
        <input
          type="text"
          placeholder="搜尋設備..."
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {searchLoading && (
          <div className="text-center py-2">搜尋中...</div>
        )}
        {searchResults.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">搜尋結果:</h4>
            <div className="space-y-2">
              {searchResults.map((device: Device) => (
                <div
                  key={device.ip}
                  onClick={() => handleDeviceSelect(device.ip)}
                  className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50"
                >
                  {device.name} ({device.ip})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 指令執行區域 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">指令執行</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              選擇的設備: {selectedDevice || '未選擇'}
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">指令:</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleExecuteCommand}
            disabled={!selectedDevice || !command || executionLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executionLoading ? '執行中...' : '執行指令'}
          </button>
        </div>
      </div>

      {/* 狀態資訊 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">系統狀態</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium">設備總數</div>
            <div className="text-gray-600">{devices.length}</div>
          </div>
          <div>
            <div className="font-medium">群組總數</div>
            <div className="text-gray-600">{deviceGroups.length}</div>
          </div>
          <div>
            <div className="font-medium">在線設備</div>
            <div className="text-green-600">
              {devices.filter(d => d.status === 'online').length}
            </div>
          </div>
          <div>
            <div className="font-medium">離線設備</div>
            <div className="text-red-600">
              {devices.filter(d => d.status === 'offline').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceManagementExample;