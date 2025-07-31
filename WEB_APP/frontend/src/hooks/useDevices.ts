// 設備管理 Hook (使用 TanStack Query)
import { useQuery } from '@tanstack/react-query';
import { getDevices } from '@/api';
import { type Device } from '@/types';

export const useDevices = () => {
  return useQuery<Device[], Error>({
    queryKey: ['devices'],
    queryFn: getDevices,
    staleTime: 5 * 60 * 1000, // 5分鐘內認為資料是新鮮的
    gcTime: 10 * 60 * 1000, // 10分鐘後清除快取 (原 cacheTime)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};