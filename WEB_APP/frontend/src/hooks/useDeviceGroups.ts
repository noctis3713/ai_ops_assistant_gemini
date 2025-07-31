// 設備群組管理 Hook (使用 TanStack Query)
import { useQuery } from '@tanstack/react-query';
import { getDeviceGroups } from '@/api';
import { type DeviceGroup } from '@/types';

export const useDeviceGroups = () => {
  return useQuery<DeviceGroup[], Error>({
    queryKey: ['device-groups'],
    queryFn: getDeviceGroups,
    staleTime: 5 * 60 * 1000, // 5分鐘內認為資料是新鮮的
    gcTime: 10 * 60 * 1000, // 10分鐘後清除快取
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};