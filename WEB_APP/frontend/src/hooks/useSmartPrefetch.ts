/**
 * 智能預載入 Hook
 * 基於用戶互動模式智能預載入組件，提升載入體驗
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface SmartPrefetchOptions {
  /** 是否啟用滑鼠懸停預載入 */
  enableHoverPrefetch?: boolean;
  /** 是否啟用視窗預載入 */
  enableIntersectionPrefetch?: boolean;
  /** 預載入延遲時間 (毫秒) */
  hoverDelayMs?: number;
  /** 視窗預載入閾值 */
  intersectionThreshold?: number;
}

/**
 * 智能預載入 Hook
 * 提供基於用戶行為的組件預載入策略
 */
export const useSmartPrefetch = (options: SmartPrefetchOptions = {}) => {
  const {
    enableHoverPrefetch = true,
    enableIntersectionPrefetch = true,
    hoverDelayMs = 200,
    intersectionThreshold = 0.1
  } = options;

  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  // 預載入函數映射
  const prefetchActions = {
    // 批次輸出相關功能
    batchOutput: () => {
      // 預載入批次結果相關數據
      queryClient.prefetchQuery({
        queryKey: ['batch-results'],
        queryFn: () => Promise.resolve([]), // 空數據，僅用於緩存初始化
        staleTime: 5 * 60 * 1000 // 5分鐘
      });
    },

    // 設備選擇相關功能  
    deviceSelection: () => {
      queryClient.prefetchQuery({
        queryKey: ['device-groups'],
        queryFn: async () => {
          // 預載入設備群組資料
          const response = await fetch('/api/device-groups');
          return response.json();
        },
        staleTime: 10 * 60 * 1000 // 10分鐘
      });
    },

    // AI 查詢相關功能
    aiQuery: () => {
      queryClient.prefetchQuery({
        queryKey: ['ai-suggestions'],
        queryFn: () => Promise.resolve([]), // 預載入空的 AI 建議緩存
        staleTime: 2 * 60 * 1000 // 2分鐘
      });
    },

    // 虛擬化列表相關
    virtualizedList: () => {
      // 預載入虛擬化列表所需的基礎配置
      queryClient.prefetchQuery({
        queryKey: ['virtualized-config'],
        queryFn: () => Promise.resolve({
          itemHeight: 50,
          overscan: 5,
          threshold: 10
        }),
        staleTime: 30 * 60 * 1000 // 30分鐘
      });
    }
  };

  /**
   * 創建滑鼠懸停預載入處理器
   */
  const createHoverPrefetch = (action: keyof typeof prefetchActions) => {
    return {
      onMouseEnter: () => {
        if (!enableHoverPrefetch) return;
        
        hoverTimerRef.current = setTimeout(() => {
          prefetchActions[action]();
        }, hoverDelayMs);
      },
      onMouseLeave: () => {
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
      }
    };
  };

  /**
   * 創建視窗預載入觀察器
   */
  const createIntersectionPrefetch = (
    element: HTMLElement | null,
    action: keyof typeof prefetchActions
  ) => {
    if (!enableIntersectionPrefetch || !element) return;

    // 清理舊的觀察器
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect();
    }

    intersectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            prefetchActions[action]();
            // 預載入完成後停止觀察
            intersectionObserverRef.current?.unobserve(entry.target);
          }
        });
      },
      { threshold: intersectionThreshold }
    );

    intersectionObserverRef.current.observe(element);
  };

  // 清理函數
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
      }
    };
  }, []);

  return {
    createHoverPrefetch,
    createIntersectionPrefetch,
    prefetchActions
  };
};

/**
 * 組件級預載入 Hook
 * 為特定組件提供預載入功能
 */
export const useComponentPrefetch = () => {
  const { createHoverPrefetch } = useSmartPrefetch();

  return {
    // 批次輸出區域預載入
    batchOutputPrefetch: createHoverPrefetch('batchOutput'),
    
    // 設備選擇區域預載入
    deviceSelectionPrefetch: createHoverPrefetch('deviceSelection'),
    
    // AI 查詢區域預載入
    aiQueryPrefetch: createHoverPrefetch('aiQuery'),
    
    // 虛擬化列表預載入
    virtualizedListPrefetch: createHoverPrefetch('virtualizedList')
  };
};