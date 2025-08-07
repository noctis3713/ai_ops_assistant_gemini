// 設備管理 Hook (使用 TanStack Query)

// 第三方庫
import { useQuery } from '@tanstack/react-query';

// 本地導入
import { getDevices } from '@/api';
import { type Device } from '@/types';
import { logError, logApi } from '@/utils/SimpleLogger';
import { getCacheStrategy } from '@/utils/cacheStrategies';

export const useDevices = () => {
  const cacheStrategy = getCacheStrategy('STATIC_DATA'); // 設備清單屬於靜態資料

  return useQuery<Device[], Error>({
    queryKey: ['devices'],
    queryFn: async () => {
      try {
        try {
          logApi('useDevices: 開始獲取設備列表', {});
        } catch {
          // 日誌記錄失敗時靜默處理
        }
        
        const devices = await getDevices();
        
        try {
          logApi('useDevices: 成功獲取設備列表', { 
            deviceCount: devices.length,
            deviceIps: devices.map(d => d.ip)
          });
        } catch {
          // 日誌記錄失敗時靜默處理
        }
        
        return devices;
      } catch (error) {
        try {
          logError('useDevices: 獲取設備列表失敗', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }, error instanceof Error ? error : new Error(String(error)));
        } catch {
          // 日誌記錄失敗時靜默處理
        }
        throw error;
      }
    },
    
    // 使用優化的快取策略
    ...cacheStrategy,
    
    // 提供空陣列作為 placeholder，改善初始載入體驗
    placeholderData: [],
    
    // 設備清單是應用程式核心資料，提高重試容錯性
    retry: (failureCount, error) => {
      if (failureCount < cacheStrategy.retry) {
        try {
          logApi(`useDevices: 重試第 ${failureCount + 1} 次`, { error: String(error) });
        } catch {
          // 日誌記錄失敗時靜默處理
        }
        return true;
      }
      return false;
    },
    retryDelay: cacheStrategy.retryDelay,
  });
};