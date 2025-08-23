/**
 * 設備群組選擇器組件
 * 提供設備群組快速選擇功能，支援載入狀態和錯誤處理
 */
import React, { useCallback } from 'react';
import { type DeviceGroup } from '@/types';
import { WARNING_STYLES } from '@/config';

interface DeviceGroupSelectorProps {
  /** 設備群組列表 */
  deviceGroups: DeviceGroup[];
  /** 群組載入中狀態 */
  groupsLoading: boolean;
  /** 群組載入錯誤 */
  groupsError: Error | null;
  /** 檢查群組是否被選中 */
  isGroupSelected: (groupName: string) => boolean;
  /** 群組選擇回調 */
  onGroupSelect: (groupName: string) => void;
  /** 自定義容器樣式 */
  className?: string;
}

const DeviceGroupSelector: React.FC<DeviceGroupSelectorProps> = ({
  deviceGroups,
  groupsLoading,
  groupsError,
  isGroupSelected,
  onGroupSelect,
  className = "min-h-[2rem]"
}) => {
  // 群組選擇處理函數
  const handleGroupSelect = useCallback((groupName: string) => {
    onGroupSelect(groupName);
  }, [onGroupSelect]);

  // 渲染群組按鈕
  const renderGroupButton = useCallback((group: DeviceGroup) => {
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
    } catch {
      return null; // 跳過有問題的群組，不影響其他群組
    }
  }, [isGroupSelected, handleGroupSelect]);

  return (
    <div className={className}>
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
          <div className={WARNING_STYLES.BADGE}>
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
            .map(renderGroupButton)
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
  );
};

export default React.memo(DeviceGroupSelector);