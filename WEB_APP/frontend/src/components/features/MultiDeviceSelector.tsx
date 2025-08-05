/**
 * 統一設備選擇器
 * 支援單選、多選、群組快速選擇
 * 內含折疊顯示、模糊搜尋、群組選擇功能
 */
import { useState, useMemo } from 'react';
import { type MultiDeviceSelectorProps, type DeviceGroup } from '@/types';
import { useDeviceGroups } from '@/hooks';

const MultiDeviceSelector = ({
  devices,
  selectedDevices,
  onDevicesChange,
  isLoading = false
}: MultiDeviceSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 獲取設備群組資料 - 強化容錯處理
  const { data: deviceGroups = [], isLoading: groupsLoading, error: groupsError } = useDeviceGroups();

  // 檢查設備資料是否為空的原因
  const getEmptyDevicesReason = () => {
    if (isLoading) return '正在載入設備資料...';
    if (devices.length === 0) {
      return '無法從後端 API 獲取設備資料。請檢查：\n1. 後端服務是否正常運行 (http://localhost:8000)\n2. 網路連線是否正常\n3. 設備配置檔案是否存在';
    }
    return null;
  };

  const handleDeviceToggle = (deviceIp: string) => {
    const newSelection = selectedDevices.includes(deviceIp)
      ? selectedDevices.filter(ip => ip !== deviceIp)
      : [...selectedDevices, deviceIp];
    
    onDevicesChange(newSelection);
  };

  const handleClearSelection = () => {
    onDevicesChange([]);
  };

  // 判斷群組是否被完全選取
  const isGroupSelected = (groupName: string) => {
    if (groupName === 'cisco_xe_devices') {
      const allDeviceIps = devices.map(device => device.ip);
      return allDeviceIps.every(ip => selectedDevices.includes(ip)) && 
             allDeviceIps.length === selectedDevices.length;
    }
    // 未來可以擴展其他群組的選擇邏輯
    return false;
  };

  // 群組快速選擇函數
  const handleGroupSelect = (groupName: string) => {
    // 對於 cisco_xe_devices 群組，實現切換選擇邏輯
    if (groupName === 'cisco_xe_devices') {
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
  };

  // 模糊搜尋過濾設備
  const filteredDevices = useMemo(() => {
    if (!searchTerm.trim()) return devices;
    
    const searchLower = searchTerm.toLowerCase();
    return devices.filter(device => 
      device.name?.toLowerCase().includes(searchLower) ||
      device.ip.toLowerCase().includes(searchLower) ||
      device.model?.toLowerCase().includes(searchLower) ||
      device.description?.toLowerCase().includes(searchLower)
    );
  }, [devices, searchTerm]);

  // 處理搜尋輸入
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // 當輸入搜尋關鍵字時自動展開列表
    if (value.trim() && !isExpanded) {
      setIsExpanded(true);
    }
  };

  // 清除搜尋
  const handleClearSearch = () => {
    setSearchTerm('');
  };

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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
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
                  className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded hover:bg-amber-200 transition-colors"
                >
                  重新載入頁面
                </button>
                <a
                  href="http://localhost:8000/api/devices"
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

        {/* 除錯資訊 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2">除錯資訊</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>設備陣列長度: {devices.length}</div>
              <div>載入狀態: {isLoading ? '載入中' : '已完成'}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const devicesForDisplay = searchTerm ? filteredDevices : devices;

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
      <div className="relative">
        <input
          type="text"
          placeholder="搜尋設備名稱、IP、型號或描述..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="form-input pr-10"
        />
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-terminal-text-muted hover:text-terminal-text-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 群組快速選擇 - 強化容錯處理 */}
      <div className="min-h-[2rem]">
        {groupsLoading ? (
          /* 載入中狀態 */
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-terminal-text-secondary">群組快選：</span>
            <div className="flex gap-2">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-full px-3 py-1 w-20 h-6"></div>
              ))}
            </div>
          </div>
        ) : groupsError ? (
          /* 錯誤狀態 */
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-terminal-text-secondary">群組快選：</span>
            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              群組載入失敗，但不影響設備選擇功能
            </div>
          </div>
        ) : deviceGroups && Array.isArray(deviceGroups) && deviceGroups.length > 0 ? (
          /* 正常狀態 */
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-terminal-text-secondary">群組快選：</span>
            {deviceGroups
              .filter((group): group is DeviceGroup => {
                // 使用類型守衛確保資料有效
                return group != null && typeof group === 'object' && 'name' in group && typeof group.name === 'string';
              })
              .map((group: DeviceGroup) => {
                try {
                  const isSelected = isGroupSelected(group.name);
                  return (
                    <button
                      key={group.name}
                      onClick={() => handleGroupSelect(group.name)}
                      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                        isSelected 
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {group.description || group.name}
                      <span className={`ml-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                        ({group.device_count || 0})
                      </span>
                    </button>
                  );
                } catch (error) {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('渲染群組按鈕時發生錯誤:', error, group);
                  }
                  return null; // 跳過有問題的群組，不影響其他群組
                }
              })
              .filter(Boolean) // 移除 null 值
            }
          </div>
        ) : (
          /* 無資料狀態 */
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-terminal-text-secondary">群組快選：</span>
            <span className="text-xs text-gray-500">暫無可用群組</span>
          </div>
        )}
      </div>

      {/* 設備列表 */}
      {isExpanded && (
        <div className={`
          max-h-64 overflow-y-auto border border-gray-200 rounded-lg
          transition-all duration-300 ease-in-out
        `}>
          {devicesForDisplay.length === 0 ? (
            <div className="text-center py-8 text-terminal-text-secondary">
              {searchTerm ? '沒有找到符合搜尋條件的設備' : '沒有可用的設備'}
            </div>
          ) : (
            devicesForDisplay.map((device, index) => {
              const isSelected = selectedDevices.includes(device.ip);
              
              return (
                <label
                  key={device.ip}
                  className={`
                    flex items-center space-x-3 p-3 cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}
                    ${index !== devicesForDisplay.length - 1 ? 'border-b border-gray-100' : ''}
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
            })
          )}
        </div>
      )}

      {/* 選擇狀態摘要 */}
      {selectedDevices.length > 0 && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-800 font-medium mb-1">
            已選擇 {selectedDevices.length} 個設備
          </div>
          <div className="text-xs text-blue-600">
            {selectedDevices.map(ip => {
              const device = devices.find(d => d.ip === ip);
              return device?.name || ip;
            }).join(', ')}
          </div>
        </div>
      )}

      {/* 搜尋結果提示 */}
      {searchTerm && isExpanded && (
        <div className="text-xs text-terminal-text-secondary text-center">
          搜尋到 {filteredDevices.length} 個設備
        </div>
      )}
    </div>
  );
};

export default MultiDeviceSelector;