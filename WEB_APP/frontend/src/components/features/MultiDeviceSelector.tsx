/**
 * 統一設備選擇器
 * 支援單選、多選、群組快速選擇
 * 內含折疊顯示、模糊搜尋、群組選擇功能
 */
import React, { useState, useCallback } from 'react';
import { type MultiDeviceSelectorProps } from '@/types';
import { useDeviceGroups, useDeviceFilter } from '@/hooks';
import { WARNING_STYLES, INFO_STYLES, DEVICE_GROUPS } from '@/constants';
import { API_CONFIG, API_ENDPOINTS } from '@/config/api';
import { findDeviceByIp } from '@/utils/utils';
import DeviceSearchBox from './DeviceSearchBox';
import DeviceGroupSelector from './DeviceGroupSelector';
import DeviceList from './DeviceList';

const MultiDeviceSelector = ({
  devices,
  selectedDevices,
  onDevicesChange,
  isLoading = false
}: MultiDeviceSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // 獲取設備群組資料 - 強化容錯處理
  const { data: deviceGroups = [], isLoading: groupsLoading, error: groupsError } = useDeviceGroups();
  

  // 檢查設備資料是否為空的原因
  const getEmptyDevicesReason = () => {
    if (isLoading) return '正在載入設備資料...';
    if (devices.length === 0) {
      return `無法從後端 API 獲取設備資料。請檢查：\n1. 後端服務是否正常運行 (${API_CONFIG.BASE_URL})\n2. 網路連線是否正常\n3. 設備配置檔案是否存在`;
    }
    return null;
  };

  const handleDeviceToggle = useCallback((deviceIp: string) => {
    const newSelection = selectedDevices.includes(deviceIp)
      ? selectedDevices.filter(ip => ip !== deviceIp)
      : [...selectedDevices, deviceIp];
    
    onDevicesChange(newSelection);
  }, [selectedDevices, onDevicesChange]);

  const handleClearSelection = useCallback(() => {
    onDevicesChange([]);
  }, [onDevicesChange]);

  // 判斷群組是否被完全選取 - 使用 useCallback 優化
  const isGroupSelected = useCallback((groupName: string) => {
    if (groupName === DEVICE_GROUPS.ALL_DEVICES) {
      const allDeviceIps = devices.map(device => device.ip);
      return allDeviceIps.every(ip => selectedDevices.includes(ip)) && 
             allDeviceIps.length === selectedDevices.length;
    }
    // 未來可以擴展其他群組的選擇邏輯
    return false;
  }, [devices, selectedDevices]);

  // 群組快速選擇函數 - 添加節流優化防止快速點擊
  const handleGroupSelect = useCallback((groupName: string) => {
    // 對於所有設備群組，實現切換選擇邏輯
    if (groupName === DEVICE_GROUPS.ALL_DEVICES) {
      const allDeviceIps = devices.map(device => device.ip);
      
      if (isGroupSelected(groupName)) {
        // 如果群組完全被選擇，則取消選擇所有設備
        onDevicesChange([]);
      } else {
        // 否則選擇群組內所有設備
        onDevicesChange(allDeviceIps);
      }
    }
    // 未來可以擴展其他群組的選擇邏輯
  }, [devices, isGroupSelected, onDevicesChange]);


  // 使用自定義 Hook 進行設備篩選
  const { filteredDevices, filterStats } = useDeviceFilter(devices, debouncedSearchTerm);

  // 處理搜尋輸入變更
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  // 處理防抖搜尋變更
  const handleDebouncedSearchChange = useCallback((value: string) => {
    setDebouncedSearchTerm(value);
  }, []);

  // 清除搜尋
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  // 自動展開列表（當有搜尋內容時）
  const handleAutoExpand = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }


  // 設備資料為空的詳細處理
  const emptyReason = getEmptyDevicesReason();
  if (emptyReason) {
    return (
      <div className="space-y-4">
        {/* 錯誤提示卡片 */}
        <div className={WARNING_STYLES.CONTAINER_ROUNDED_PADDED}>
          <div className="flex items-start space-x-3">
            <div className="text-amber-600 mt-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-800 mb-2">
                設備資料載入問題
              </h3>
              <div className="text-sm text-amber-700 whitespace-pre-line">
                {emptyReason}
              </div>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => window.location.reload()}
                  className={WARNING_STYLES.BUTTON}
                >
                  重新載入頁面
                </button>
                <a
                  href={`${API_CONFIG.BASE_URL}${API_ENDPOINTS.DEVICES}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded hover:bg-amber-200 transition-colors"
                >
                  測試後端 API
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }


  return (
    <div className="space-y-3">
      {/* 標題行和摘要 */}
      <div className="flex items-center justify-between">
        <label className="label-primary">
          選擇設備
        </label>
        <div className="flex items-center space-x-2">
          {isExpanded && selectedDevices.length > 0 && (
            <button
              onClick={handleClearSelection}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              取消選擇
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-terminal-text-secondary hover:text-terminal-text-primary font-medium"
          >
            {isExpanded ? '收起設備列表' : '展開設備列表'}
          </button>
        </div>
      </div>

      {/* 搜尋框 */}
      <DeviceSearchBox
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onDebouncedSearchChange={handleDebouncedSearchChange}
        onClearSearch={handleClearSearch}
        onAutoExpand={handleAutoExpand}
      />

      {/* 群組快速選擇 */}
      <DeviceGroupSelector
        deviceGroups={deviceGroups}
        groupsLoading={groupsLoading}
        groupsError={groupsError}
        isGroupSelected={isGroupSelected}
        onGroupSelect={handleGroupSelect}
      />

      {/* 設備列表 */}
      <DeviceList
        devices={filteredDevices}
        selectedDevices={selectedDevices}
        isExpanded={isExpanded}
        onDeviceToggle={handleDeviceToggle}
        searchTerm={searchTerm}
      />

      {/* 選擇狀態摘要 */}
      {selectedDevices.length > 0 && (
        <div className={`mt-2 ${INFO_STYLES.CONTAINER_ROUNDED_PADDED}`}>
          <div className="text-xs text-blue-800 font-medium mb-1">
            已選擇 {selectedDevices.length} 個設備
          </div>
          <div className="text-xs text-blue-600">
            {selectedDevices.map(ip => {
              const device = findDeviceByIp(devices, ip);
              return device?.name || ip;
            }).join(', ')}
          </div>
        </div>
      )}

      {/* 搜尋結果提示 */}
      {filterStats.hasFilter && isExpanded && (
        <div className="text-xs text-terminal-text-secondary text-center">
          搜尋到 {filterStats.filteredCount} 個設備（共 {filterStats.totalCount} 個）
        </div>
      )}
    </div>
  );
};

export default React.memo(MultiDeviceSelector);