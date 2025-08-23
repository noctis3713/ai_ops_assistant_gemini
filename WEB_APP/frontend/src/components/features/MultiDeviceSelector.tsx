/**
 * 統一設備選擇器
 * 支援單選、多選、群組快速選擇
 * 內含折疊顯示、模糊搜尋、群組選擇功能
 */
import React, { useState, useCallback, useMemo } from 'react';
import { type MultiDeviceSelectorProps } from '@/types';
import { useDeviceFilter } from '@/hooks';
import { useDeviceGroups } from '@/services';
import { WARNING_STYLES, DEVICE_GROUPS } from '@/config';
import { API_CONFIG, API_ENDPOINTS } from '@/config/api';
import DeviceSearchBox from './DeviceSearchBox';
import DeviceGroupSelector from './DeviceGroupSelector';
import DeviceList from './DeviceList';
import DeviceSelectionSummary from './DeviceSelectionSummary';
import SearchResultHint from './SearchResultHint';
import { createBatchHandler, handlePageReload } from '@/utils/commonHandlers';

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

  // 設備選擇切換處理函數 - 直接傳遞新陣列
  const handleDeviceToggle = useCallback((deviceIp: string) => {
    const newSelection = selectedDevices.includes(deviceIp)
      ? selectedDevices.filter(ip => ip !== deviceIp)
      : [...selectedDevices, deviceIp];
    
    onDevicesChange(newSelection);
  }, [selectedDevices, onDevicesChange]);

  // 使用 useMemo 快取批次處理器和相關邏輯
  const deviceHandlers = useMemo(() => {
    const allDeviceIps = devices.map(device => device.ip);
    const batchHandler = createBatchHandler(
      allDeviceIps,
      selectedDevices,
      onDevicesChange,
      (ip) => ip
    );

    return {
      batchHandler,
      isGroupSelected: (groupName: string) => {
        if (groupName === DEVICE_GROUPS.ALL_DEVICES) {
          return batchHandler.isAllSelected();
        }
        return false;
      },
      handleGroupSelect: (groupName: string) => {
        if (groupName === DEVICE_GROUPS.ALL_DEVICES) {
          if (batchHandler.isAllSelected()) {
            batchHandler.selectNone();
          } else {
            batchHandler.selectAll();
          }
        }
      }
    };
  }, [devices, selectedDevices, onDevicesChange]);


  // 使用自定義 Hook 進行設備篩選
  const { filteredDevices, filterStats } = useDeviceFilter(devices, debouncedSearchTerm);

  // 合併搜尋相關的處理函數
  const searchHandlers = useMemo(() => ({
    handleSearchChange: (value: string) => setSearchTerm(value),
    handleDebouncedSearchChange: (value: string) => setDebouncedSearchTerm(value),
    handleClearSearch: () => {
      setSearchTerm('');
      setDebouncedSearchTerm('');
    },
    handleAutoExpand: () => {
      if (!isExpanded) {
        setIsExpanded(true);
      }
    }
  }), [isExpanded]);

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
                  onClick={handlePageReload}
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
              onClick={deviceHandlers.batchHandler.selectNone}
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
        onSearchChange={searchHandlers.handleSearchChange}
        onDebouncedSearchChange={searchHandlers.handleDebouncedSearchChange}
        onClearSearch={searchHandlers.handleClearSearch}
        onAutoExpand={searchHandlers.handleAutoExpand}
      />

      {/* 群組快速選擇 */}
      <DeviceGroupSelector
        deviceGroups={deviceGroups}
        groupsLoading={groupsLoading}
        groupsError={groupsError}
        isGroupSelected={deviceHandlers.isGroupSelected}
        onGroupSelect={deviceHandlers.handleGroupSelect}
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
      <DeviceSelectionSummary
        devices={devices}
        selectedDevices={selectedDevices}
      />

      {/* 搜尋結果提示 */}
      <SearchResultHint
        filterStats={filterStats}
        isVisible={isExpanded}
      />
    </div>
  );
};

// 自定義比較函數 - 只在關鍵 props 改變時重新渲染
const areEqual = (
  prevProps: MultiDeviceSelectorProps, 
  nextProps: MultiDeviceSelectorProps
): boolean => {
  // 檢查載入狀態
  if (prevProps.isLoading !== nextProps.isLoading) {
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
  if (prevProps.onDevicesChange !== nextProps.onDevicesChange) {
    return false;
  }

  return true;
};

export default React.memo(MultiDeviceSelector, areEqual);