/**
 * 設備服務相關 Hooks
 * 整合 TanStack Query 與設備服務
 */

/* eslint-disable @tanstack/query/exhaustive-deps */

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  queryOptions,
  type UseQueryResult,
  type UseMutationResult
} from '@tanstack/react-query';
import { DeviceService } from '../device/DeviceService';
import { apiClient } from '@/api/client';
import type { QueryClient } from '@tanstack/react-query';
import type { Device, DeviceGroup } from '@/types';
import type { DeviceFilters, DeviceStats, DeviceQueryOptions, DeviceGroupQueryOptions } from '../device/DeviceTypes';

/**
 * 建立設備服務實例
 */
function createDeviceServiceInstance(queryClient: QueryClient): DeviceService {
  return new DeviceService({ apiClient, queryClient });
}

/**
 * 設備相關 Query Keys
 */
export const deviceQueryKeys = {
  all: ['devices'] as const,
  lists: () => [...deviceQueryKeys.all, 'list'] as const,
  list: (filters: DeviceFilters = {}) => [...deviceQueryKeys.lists(), filters] as const,
  details: () => [...deviceQueryKeys.all, 'detail'] as const,
  detail: (ip: string) => [...deviceQueryKeys.details(), ip] as const,
  stats: () => [...deviceQueryKeys.all, 'stats'] as const,
  validation: (ip: string) => [...deviceQueryKeys.all, 'validation', ip] as const
};

/**
 * 設備群組相關 Query Keys
 */
export const deviceGroupQueryKeys = {
  all: ['deviceGroups'] as const,
  lists: () => [...deviceGroupQueryKeys.all, 'list'] as const,
  list: (options: DeviceGroupQueryOptions = {}) => [...deviceGroupQueryKeys.lists(), options] as const,
  details: () => [...deviceGroupQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...deviceGroupQueryKeys.details(), id] as const,
  devices: (groupId: string) => [...deviceGroupQueryKeys.all, 'devices', groupId] as const
};

/**
 * 設備列表 Query Options
 */
export function deviceListQueryOptions(
  queryClient: QueryClient,
  options: DeviceQueryOptions = {}
) {
  return queryOptions({
    queryKey: deviceQueryKeys.list(options),
    queryFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      return service.getDevices(options);
    },
    staleTime: 5 * 60 * 1000, // 5分鐘
    gcTime: 10 * 60 * 1000    // 10分鐘
  });
}

/**
 * 設備詳情 Query Options
 */
export function deviceDetailQueryOptions(
  queryClient: QueryClient,
  ip: string
) {
  return queryOptions({
    queryKey: deviceQueryKeys.detail(ip),
    queryFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      return service.getDeviceByIp(ip);
    },
    enabled: !!ip,
    staleTime: 2 * 60 * 1000,  // 2分鐘
    gcTime: 5 * 60 * 1000      // 5分鐘
  });
}

/**
 * 設備統計 Query Options
 */
export function deviceStatsQueryOptions(queryClient: QueryClient) {
  return queryOptions({
    queryKey: deviceQueryKeys.stats(),
    queryFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      return service.getDeviceStats();
    },
    staleTime: 1 * 60 * 1000,  // 1分鐘
    gcTime: 3 * 60 * 1000      // 3分鐘
  });
}

/**
 * 設備群組列表 Query Options
 */
export function deviceGroupListQueryOptions(
  queryClient: QueryClient,
  options: DeviceGroupQueryOptions = {}
) {
  return queryOptions({
    queryKey: deviceGroupQueryKeys.list(options),
    queryFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      return service.getDeviceGroups(options);
    },
    staleTime: 10 * 60 * 1000, // 10分鐘
    gcTime: 20 * 60 * 1000     // 20分鐘
  });
}

/**
 * 使用設備列表
 */
export function useDevices(
  options: DeviceQueryOptions = {}
): UseQueryResult<Device[], Error> {
  const queryClient = useQueryClient();
  
  return useQuery(deviceListQueryOptions(queryClient, options));
}

/**
 * 使用設備詳情
 */
export function useDevice(
  ip: string
): UseQueryResult<Device | null, Error> {
  const queryClient = useQueryClient();
  
  return useQuery(deviceDetailQueryOptions(queryClient, ip));
}

/**
 * 使用設備統計
 */
export function useDeviceStats(): UseQueryResult<DeviceStats, Error> {
  const queryClient = useQueryClient();
  
  return useQuery(deviceStatsQueryOptions(queryClient));
}

/**
 * 使用設備群組列表
 */
export function useDeviceGroups(
  options: DeviceGroupQueryOptions = {}
): UseQueryResult<DeviceGroup[], Error> {
  const queryClient = useQueryClient();
  
  return useQuery(deviceGroupListQueryOptions(queryClient, options));
}

/**
 * 使用設備搜尋
 */
export function useDeviceSearch(
  filters: DeviceFilters
): UseQueryResult<Device[], Error> {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: deviceQueryKeys.list(filters),
    queryFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      return service.searchDevices(filters);
    },
    enabled: Object.keys(filters).length > 0,
    staleTime: 2 * 60 * 1000
  });
}

/**
 * 使用設備驗證
 */
export function useDeviceValidation(
  ip: string,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: deviceQueryKeys.validation(ip),
    queryFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      return service.validateDevice(ip);
    },
    enabled: enabled && !!ip,
    staleTime: 30 * 1000, // 30秒
    retry: false // 驗證錯誤不重試
  });
}

/**
 * 使用設備快取刷新 Mutation
 */
export function useRefreshDeviceCache(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      await service.refreshDeviceCache();
    },
    onSuccess: () => {
      // 使所有設備相關查詢失效
      queryClient.invalidateQueries({
        queryKey: deviceQueryKeys.all
      });
    }
  });
}

/**
 * 使用設備群組快取刷新 Mutation
 */
export function useRefreshDeviceGroupCache(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const service = createDeviceServiceInstance(queryClient);
      await service.refreshDeviceGroupCache();
    },
    onSuccess: () => {
      // 使所有設備群組相關查詢失效
      queryClient.invalidateQueries({
        queryKey: deviceGroupQueryKeys.all
      });
    }
  });
}

/**
 * 預載入設備列表
 */
export function usePrefetchDevices() {
  const queryClient = useQueryClient();
  
  return (options: DeviceQueryOptions = {}) => {
    queryClient.prefetchQuery(deviceListQueryOptions(queryClient, options));
  };
}

/**
 * 預載入設備詳情
 */
export function usePrefetchDevice() {
  const queryClient = useQueryClient();
  
  return (ip: string) => {
    if (ip) {
      queryClient.prefetchQuery(deviceDetailQueryOptions(queryClient, ip));
    }
  };
}