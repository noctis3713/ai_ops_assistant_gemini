/**
 * 資料預取 Hook
 * 提供智能的資料預取功能，提升用戶體驗
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getDevices, getDeviceGroups } from '@/api';
import { getCacheStrategy } from '@/utils/cacheStrategies';

/**
 * 預取核心資料的自定義 Hook
 * 在應用程式載入時預取重要資料，減少用戶等待時間
 */
export const usePrefetchCoreData = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // 預取設備清單
    queryClient.prefetchQuery({
      queryKey: ['devices'],
      queryFn: getDevices,
      ...getCacheStrategy('STATIC_DATA')
    });
    
    // 預取設備群組
    queryClient.prefetchQuery({
      queryKey: ['device-groups'],
      queryFn: getDeviceGroups,
      ...getCacheStrategy('STATIC_DATA')
    });
  }, [queryClient]);
};

/**
 * 條件式資料預取 Hook
 * 根據用戶行為智能預取可能需要的資料
 */
export const useConditionalPrefetch = (conditions: {
  /** 是否預取設備狀態資料 */
  shouldPrefetchDeviceStatus?: boolean;
  /** 是否預取任務資料 */
  shouldPrefetchTasks?: boolean;
}) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (conditions.shouldPrefetchDeviceStatus) {
      // 可以在這裡添加設備狀態預取邏輯
      // queryClient.prefetchQuery({...});
    }
    
    if (conditions.shouldPrefetchTasks) {
      // 可以在這裡添加任務資料預取邏輯
      // queryClient.prefetchQuery({...});
    }
  }, [queryClient, conditions]);
};

/**
 * 背景重新整理 Hook
 * 在背景定期重新整理動態資料，保持資料新鮮度
 */
export const useBackgroundRefresh = (enabled: boolean = true) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(() => {
      // 重新整理動態資料
      queryClient.invalidateQueries({
        queryKey: ['device-status'],
        refetchType: 'active' // 只重新整理當前使用的查詢
      });
      
      queryClient.invalidateQueries({
        queryKey: ['tasks'],
        refetchType: 'active'
      });
    }, 30 * 1000); // 每 30 秒重新整理一次
    
    return () => clearInterval(interval);
  }, [queryClient, enabled]);
};