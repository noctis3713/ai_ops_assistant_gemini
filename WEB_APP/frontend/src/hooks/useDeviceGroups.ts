// 設備群組管理 Hook (使用 TanStack Query) - 強化錯誤處理和容錯機制
import { useQuery } from '@tanstack/react-query';
import { getDeviceGroups } from '@/api';
import { type DeviceGroup } from '@/types';
import { logError, logSystem } from '@/utils/SimpleLogger';
import { ErrorHandler } from '@/utils/errorHandler';
import { getCacheStrategy } from '@/utils/cacheStrategies';

export const useDeviceGroups = () => {
  const cacheStrategy = getCacheStrategy('STATIC_DATA'); // 群組資料也屬於靜態資料

  return useQuery<DeviceGroup[], Error>({
    queryKey: ['device-groups'],
    queryFn: async () => {
      try {
        const groups = await getDeviceGroups();
        
        // 確保返回有效的陣列，即使後端回傳格式異常
        if (!Array.isArray(groups)) {
          logError('Device groups API 回傳非陣列格式', { 
            receivedType: typeof groups, 
            receivedData: groups 
          });
          return []; // 返回空陣列而非拋出錯誤
        }
        
        // 過濾並驗證群組資料
        const validGroups = groups.filter(group => {
          if (!group || typeof group !== 'object') {
            logError('發現無效的群組資料項目', { group });
            return false;
          }
          
          // 確保必要欄位存在
          if (!group.name || typeof group.name !== 'string') {
            logError('群組缺少 name 欄位', { group });
            return false;
          }
          
          return true;
        });
        
        logSystem('成功載入設備群組', { 
          total: groups.length, 
          valid: validGroups.length,
          invalid: groups.length - validGroups.length
        });
        
        return validGroups;
        
      } catch (error) {
        await ErrorHandler.handleApiError(error, '載入設備群組');
        
        // 返回空陣列而非讓查詢失敗，確保 UI 不會崩潰
        return [];
      }
    },
    
    // 使用優化的快取策略
    ...cacheStrategy,
    
    // 智能重試策略
    retry: (failureCount, error) => {
      // 限制重試次數，避免無限重試
      if (failureCount >= cacheStrategy.retry) {
        logError('設備群組載入重試次數已達上限', { 
          failureCount, 
          error: error?.message 
        });
        return false;
      }
      return true;
    },
    retryDelay: cacheStrategy.retryDelay,
    
    // 提供預設值，確保 UI 有資料可以渲染
    placeholderData: [],
  });
};