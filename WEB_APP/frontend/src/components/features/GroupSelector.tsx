/**
 * 群組選擇器
 * 允許用戶選擇設備群組進行操作
 */
import { type GroupSelectorProps } from '@/types';
import { INFO_STYLES } from '@/config';
import { findGroupByName } from '@/utils/utils';

const GroupSelector = ({
  groups,
  selectedGroup,
  onGroupChange,
  isLoading = false
}: GroupSelectorProps) => {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-terminal-text-secondary text-center py-4">
        沒有可用的設備群組
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="label-primary">
        選擇設備群組
      </label>
      
      <select
        value={selectedGroup}
        onChange={(e) => onGroupChange(e.target.value)}
        className="form-select"
      >
        <option value="">請選擇群組...</option>
        {groups.map((group) => (
          <option key={group.name} value={group.name}>
            {group.description} ({group.device_count} 個設備)
          </option>
        ))}
      </select>

      {selectedGroup && (
        <div className={`mt-3 ${INFO_STYLES.CONTAINER_ROUNDED_PADDED}`}>
          {(() => {
            const group = findGroupByName(groups, selectedGroup);
            if (!group) return null;
            
            return (
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  {group.description}
                </h4>
                <div className="text-xs text-blue-700">
                  <div className="mb-1">
                    包含 {group.device_count} 個 {group.platform} 設備
                  </div>
                  <div className="text-blue-600">
                    群組內的設備將透過統一批次操作執行指令
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default GroupSelector;