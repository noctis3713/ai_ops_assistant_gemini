/**
 * 虛擬化列表 Intersection Observer Hook
 * 使用 Intersection Observer API 替代 scroll 事件，提升性能
 * 支援動態高度和精確的可見範圍計算
 */
import { useRef, useEffect, useState, useMemo } from 'react';
import { useMemoizedFn } from '@/hooks';
import { 
  calculateVisibleItems,
  type VisibleItemsResult 
} from '@/utils/virtualListHelpers';

interface UseVirtualIntersectionOptions {
  /** 容器高度 */
  containerHeight: number;
  /** 項目高度陣列 */
  itemHeights: number[];
  /** 累積高度陣列 */
  cumulativeHeights: number[];
  /** 緩衝區項目數 */
  overscan?: number;
  /** 提前載入的距離（像素） */
  rootMargin?: string;
  /** 觸發回調的交集比例閾值 */
  threshold?: number | number[];
}

interface VirtualIntersectionState<T> {
  /** 當前滾動位置 */
  scrollTop: number;
  /** 可見項目結果 */
  visibleItems: VisibleItemsResult<T>;
  /** 是否正在滾動 */
  isScrolling: boolean;
}

/**
 * 虛擬化 Intersection Observer Hook
 * 提供基於 Intersection Observer 的高性能虛擬滾動
 */
export function useVirtualIntersection<T>(
  items: T[],
  {
    containerHeight,
    itemHeights,
    cumulativeHeights,
    overscan = 5,
    rootMargin = '50px',
    threshold = [0, 0.1, 0.9, 1.0]
  }: UseVirtualIntersectionOptions
) {
  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 哨兵元素引用 - 用於檢測滾動邊界
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  
  // 狀態管理
  const [state, setState] = useState<VirtualIntersectionState<T>>(() => ({
    scrollTop: 0,
    visibleItems: calculateVisibleItems(
      items,
      0,
      containerHeight,
      cumulativeHeights,
      itemHeights,
      overscan
    ),
    isScrolling: false
  }));
  
  // 滾動超時計時器
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  
  // 創建 Intersection Observer 實例
  const observer = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    const handleIntersection: IntersectionObserverCallback = (entries) => {
      let shouldUpdateScroll = false;
      let newScrollTop = state.scrollTop;
      
      entries.forEach((entry) => {
        // 檢查哨兵元素的交集狀態
        if (entry.target === topSentinelRef.current) {
          // 頂部哨兵元素進入視口，表示向上滾動
          if (entry.isIntersecting) {
            shouldUpdateScroll = true;
          }
        } else if (entry.target === bottomSentinelRef.current) {
          // 底部哨兵元素進入視口，表示向下滾動
          if (entry.isIntersecting) {
            shouldUpdateScroll = true;
          }
        }
      });
      
      // 如果需要更新滾動位置，從容器獲取實際滾動位置
      if (shouldUpdateScroll && containerRef.current) {
        newScrollTop = containerRef.current.scrollTop;
        
        // 設置滾動狀態
        setState(prev => ({
          ...prev,
          scrollTop: newScrollTop,
          isScrolling: true,
          visibleItems: calculateVisibleItems(
            items,
            newScrollTop,
            containerHeight,
            cumulativeHeights,
            itemHeights,
            overscan
          )
        }));
        
        // 清除之前的超時
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        // 設置滾動結束檢測
        scrollTimeoutRef.current = setTimeout(() => {
          setState(prev => ({ ...prev, isScrolling: false }));
        }, 150);
      }
    };
    
    return new IntersectionObserver(handleIntersection, {
      root: containerRef.current,
      rootMargin,
      threshold
    });
  }, [
    items,
    containerHeight, 
    cumulativeHeights, 
    itemHeights, 
    overscan, 
    rootMargin, 
    threshold,
    state.scrollTop
  ]);
  
  // 設置哨兵元素觀察
  useEffect(() => {
    if (!observer) return;
    
    // 觀察哨兵元素
    if (topSentinelRef.current) {
      observer.observe(topSentinelRef.current);
    }
    if (bottomSentinelRef.current) {
      observer.observe(bottomSentinelRef.current);
    }
    
    return () => {
      observer.disconnect();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [observer]);
  
  // 當數據改變時更新可見項目
  useEffect(() => {
    setState(prev => ({
      ...prev,
      visibleItems: calculateVisibleItems(
        items,
        prev.scrollTop,
        containerHeight,
        cumulativeHeights,
        itemHeights,
        overscan
      )
    }));
  }, [items, containerHeight, cumulativeHeights, itemHeights, overscan]);
  
  // 手動滾動到指定位置 - 使用 useMemoizedFn 優化
  const scrollToPosition = useMemoizedFn((scrollTop: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollTop;
      setState(prev => ({
        ...prev,
        scrollTop,
        visibleItems: calculateVisibleItems(
          items,
          scrollTop,
          containerHeight,
          cumulativeHeights,
          itemHeights,
          overscan
        )
      }));
    }
  });
  
  // 滾動到指定項目 - 使用 useMemoizedFn 優化
  const scrollToItem = useMemoizedFn((index: number) => {
    if (index >= 0 && index < cumulativeHeights.length - 1) {
      const targetScrollTop = cumulativeHeights[index];
      scrollToPosition(targetScrollTop);
    }
  });
  
  // 計算哨兵元素位置
  const sentinelPositions = useMemo(() => {
    const { start, end } = state.visibleItems;
    const topPosition = Math.max(0, cumulativeHeights[start] - 100);
    const bottomPosition = Math.min(
      cumulativeHeights[cumulativeHeights.length - 1],
      cumulativeHeights[end + 1] + 100
    );
    
    return { topPosition, bottomPosition };
  }, [state.visibleItems, cumulativeHeights]);
  
  return {
    // 引用
    containerRef,
    topSentinelRef,
    bottomSentinelRef,
    
    // 狀態
    scrollTop: state.scrollTop,
    visibleItems: state.visibleItems,
    isScrolling: state.isScrolling,
    
    // 控制函數
    scrollToPosition,
    scrollToItem,
    
    // 哨兵元素位置
    sentinelPositions,
    
    // 總高度
    totalHeight: cumulativeHeights[cumulativeHeights.length - 1] || 0
  };
}

export type { VirtualIntersectionState };