// 設備管理 Hook (使用 TanStack Query)

// 第三方庫
import { useQuery } from '@tanstack/react-query';

// 本地導入
import { getDevices } from '@/api';
import { type Device } from '@/types';
import { logError, logApi } from '@/utils/SimpleLogger';

export const useDevices = () => {
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
    staleTime: 5 * 60 * 1000, // 5分鐘內認為資料是新鮮的
    gcTime: 10 * 60 * 1000, // 10分鐘後清除快取 (原 cacheTime)
    retry: (failureCount, error) => {
      // 如果是網路連線問題，重試3次
      if (failureCount < 3) {
        try {
          logApi(`useDevices: 重試第 ${failureCount + 1} 次`, { error: String(error) });
        } catch {
          // 如果日誌記錄失敗，不影響重試邏輯
          // 日誌記錄失敗時靜默處理
        }
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};