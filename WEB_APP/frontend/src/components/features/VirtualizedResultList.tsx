/**
 * 虛擬化結果列表組件 (Intersection Observer 優化版)
 * 使用 Intersection Observer API 替代 scroll 事件，提升滾動性能
 * 結合 React 19 useTransition 優化展開/收起操作
 */
import React, { useCallback, useMemo, useRef, useEffect, useTransition } from 'react';
import { type BatchExecutionResult } from '@/types';
import BatchResultItem from './BatchResultItem';
import { 
  calculateCumulativeHeights,
  recordScrollPosition,
  restoreScrollPosition,
  type ScrollPosition 
} from '@/utils/virtualListHelpers';
import { useVirtualIntersection } from '@/hooks/useVirtualIntersection';

interface VirtualizedResultListProps {
  /** 結果列表 */
  results: BatchExecutionResult[];
  /** 已展開項目的 Set */
  expandedItems: Set<string>;
  /** 展開/收起回調 */
  onToggleExpanded: (deviceIp: string) => void;
  /** 複製回調 */
  onCopy: (content: string) => void;
  /** 設備描述查詢函數 */
  getDeviceDescription?: (deviceIp: string) => string;
  /** 容器高度 */
  containerHeight?: number;
  /** 每項預估高度 */
  itemHeight?: number;
  /** 緩衝區項目數 */
  overscan?: number;
}

const VirtualizedResultList: React.FC<VirtualizedResultListProps> = ({
  results,
  expandedItems,
  onToggleExpanded,
  onCopy,
  getDeviceDescription,
  containerHeight = 400,
  itemHeight = 120, // 收起狀態的高度
  overscan = 5
}) => {
  // React 19: 使用 useTransition 處理展開/收起操作
  const [, startExpansionTransition] = useTransition();
  
  // 滾動位置保持機制
  const savedScrollPosition = useRef<ScrollPosition | null>(null);
  const isRestoringScroll = useRef<boolean>(false);

  // 高度快取 - 使用 Map 避免重複計算
  const heightsCache = useRef(new Map<string, number>());
  
  // 計算每項的實際高度（考慮展開狀態）- 優化版本使用快取
  const itemHeights = useMemo(() => {
    const heights: number[] = [];
    
    results.forEach((result, index) => {
      const isExpanded = expandedItems.has(result.deviceIp);
      const cacheKey = `${result.deviceIp}_${isExpanded}_${result.output?.length || 0}`;
      
      let height = heightsCache.current.get(cacheKey);
      if (height === undefined) {
        // 只有當快取中沒有時才計算
        const expandedMultiplier = isExpanded ? 
          Math.min(4, Math.max(2, (result.output?.length || 0) / 1000 + 2)) : 1;
        height = Math.floor(itemHeight * expandedMultiplier);
        heightsCache.current.set(cacheKey, height);
      }
      
      heights[index] = height;
    });
    
    // 清理不再需要的快取項目，避免記憶體洩漏
    const validKeys = new Set(
      results.map(result => {
        const isExpanded = expandedItems.has(result.deviceIp);
        return `${result.deviceIp}_${isExpanded}_${result.output?.length || 0}`;
      })
    );
    
    for (const key of heightsCache.current.keys()) {
      if (!validKeys.has(key)) {
        heightsCache.current.delete(key);
      }
    }
    
    return heights;
  }, [results, expandedItems, itemHeight]);

  // 計算累積高度，用於快速定位 - 使用工具函數
  const cumulativeHeights = useMemo(() => {
    return calculateCumulativeHeights(itemHeights);
  }, [itemHeights]);

  // 使用 Intersection Observer 虛擬化 Hook
  const {
    containerRef,
    topSentinelRef,
    bottomSentinelRef,
    scrollTop,
    visibleItems,
    isScrolling,
    scrollToPosition,
    sentinelPositions,
    totalHeight
  } = useVirtualIntersection(results, {
    containerHeight,
    itemHeights,
    cumulativeHeights,
    overscan,
    rootMargin: '100px', // 提前 100px 開始載入
    threshold: [0, 0.1, 0.5, 0.9, 1.0] // 多個閾值提供更精確的檢測
  });

  // 移除原有的 scroll 事件處理，改用 Intersection Observer

  // 智能滾動位置保持 - 當展開狀態改變時保持視覺連續性
  useEffect(() => {
    if (!containerRef.current || isRestoringScroll.current) return;
    
    // 記錄當前滾動位置
    savedScrollPosition.current = recordScrollPosition(scrollTop, cumulativeHeights);
  }, [expandedItems, scrollTop, cumulativeHeights, containerRef]);

  // 當累積高度變化時（通常是展開/收起操作後），恢復滾動位置
  useEffect(() => {
    if (!containerRef.current || !savedScrollPosition.current) return;
    
    const newScrollTop = restoreScrollPosition(
      savedScrollPosition.current,
      cumulativeHeights
    );
    
    // 避免在恢復滾動時觸發新的記錄
    isRestoringScroll.current = true;
    
    // 使用新的 scrollToPosition 方法
    requestAnimationFrame(() => {
      scrollToPosition(newScrollTop);
      
      // 延遲重置標記，確保滾動操作完成
      setTimeout(() => {
        isRestoringScroll.current = false;
        savedScrollPosition.current = null;
      }, 50);
    });
  }, [cumulativeHeights, scrollToPosition, containerRef]);

  // React 19: 優化的展開/收起處理函數
  const handleToggleExpanded = useCallback((deviceIp: string) => {
    // 使用 startTransition 避免大量項目展開時的 UI 凍結
    startExpansionTransition(() => {
      onToggleExpanded(deviceIp);
    });
  }, [onToggleExpanded, startExpansionTransition]);

  // 清理函數已由 useVirtualIntersection Hook 處理

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-terminal-text-muted">
        沒有符合篩選條件的結果
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto transition-opacity duration-200 ${
        isScrolling ? 'scrollbar-thumb-blue-400' : 'scrollbar-thumb-gray-400'
      }`}
      style={{ height: containerHeight }}
    >
      {/* 虛擬化容器 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 頂部哨兵元素 */}
        <div
          ref={topSentinelRef}
          style={{
            position: 'absolute',
            height: '1px',
            width: '100%',
            top: sentinelPositions.topPosition,
            pointerEvents: 'none',
            zIndex: -1
          }}
          aria-hidden="true"
        />
        
        {/* 可見項目渲染 */}
        {visibleItems.items.map((item) => (
          <div
            key={item.data.deviceIp}
            style={{
              position: 'absolute',
              top: item.top,
              height: item.height,
              left: 0,
              right: 0
            }}
            className="border-b border-gray-100"
          >
            <BatchResultItem
              result={item.data}
              isExpanded={expandedItems.has(item.data.deviceIp)}
              onExpand={() => handleToggleExpanded(item.data.deviceIp)}
              onCopy={onCopy}
              deviceDescription={getDeviceDescription?.(item.data.deviceIp) || ''}
            />
          </div>
        ))}
        
        {/* 底部哨兵元素 */}
        <div
          ref={bottomSentinelRef}
          style={{
            position: 'absolute',
            height: '1px',
            width: '100%',
            top: sentinelPositions.bottomPosition,
            pointerEvents: 'none',
            zIndex: -1
          }}
          aria-hidden="true"
        />
        
        {/* 滾動狀態指示器 */}
        {isScrolling && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs opacity-75 pointer-events-none">
            滾動中...
          </div>
        )}
      </div>
    </div>
  );
};

// 自定義比較函數 - 只在關鍵 props 改變時重新渲染
const areEqual = (
  prevProps: VirtualizedResultListProps, 
  nextProps: VirtualizedResultListProps
): boolean => {
  // 檢查基本屬性
  if (
    prevProps.containerHeight !== nextProps.containerHeight ||
    prevProps.itemHeight !== nextProps.itemHeight ||
    prevProps.overscan !== nextProps.overscan
  ) {
    return false;
  }

  // 檢查 results 陣列 - 比較長度和內容
  if (prevProps.results.length !== nextProps.results.length) {
    return false;
  }

  // 淺層比較 results 內容（檢查關鍵欄位）
  for (let i = 0; i < prevProps.results.length; i++) {
    const prev = prevProps.results[i];
    const next = nextProps.results[i];
    
    if (
      prev.deviceIp !== next.deviceIp ||
      prev.success !== next.success ||
      prev.output?.length !== next.output?.length ||
      prev.error !== next.error
    ) {
      return false;
    }
  }

  // 檢查 expandedItems Set - 比較大小和內容
  if (prevProps.expandedItems.size !== nextProps.expandedItems.size) {
    return false;
  }

  // 檢查 Set 中的每個元素
  for (const item of prevProps.expandedItems) {
    if (!nextProps.expandedItems.has(item)) {
      return false;
    }
  }

  // 函數引用比較（通常這些是穩定的）
  if (
    prevProps.onToggleExpanded !== nextProps.onToggleExpanded ||
    prevProps.onCopy !== nextProps.onCopy ||
    prevProps.getDeviceDescription !== nextProps.getDeviceDescription
  ) {
    return false;
  }

  return true;
};

export default React.memo(VirtualizedResultList, areEqual);