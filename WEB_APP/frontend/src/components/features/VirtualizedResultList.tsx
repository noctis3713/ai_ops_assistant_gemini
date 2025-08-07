/**
 * 虛擬化結果列表組件
 * 使用虛擬滾動提升大數據量渲染性能
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { type BatchExecutionResult } from '@/types';
import BatchResultItem from './BatchResultItem';

interface VirtualizedResultListProps {
  /** 結果列表 */
  results: BatchExecutionResult[];
  /** 已展開項目的 Set */
  expandedItems: Set<string>;
  /** 展開/收起回調 */
  onToggleExpanded: (deviceIp: string) => void;
  /** 複製回調 */
  onCopy: (content: string) => void;
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
  containerHeight = 400,
  itemHeight = 120, // 收起狀態的高度
  overscan = 5
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // 計算每項的實際高度（考慮展開狀態）
  const itemHeights = useMemo(() => {
    return results.map(result => {
      const isExpanded = expandedItems.has(result.deviceIp);
      // 展開時高度大約為基礎高度的 2-4 倍，取決於內容長度
      const expandedMultiplier = isExpanded ? 
        Math.min(4, Math.max(2, (result.output?.length || 0) / 1000 + 2)) : 1;
      
      return Math.floor(itemHeight * expandedMultiplier);
    });
  }, [results, expandedItems, itemHeight]);

  // 計算累積高度，用於快速定位
  const cumulativeHeights = useMemo(() => {
    const heights = [0];
    let total = 0;
    for (const height of itemHeights) {
      total += height;
      heights.push(total);
    }
    return heights;
  }, [itemHeights]);

  // 計算可視範圍內的項目
  const visibleItems = useMemo(() => {
    if (results.length === 0) return { start: 0, end: 0, items: [] };

    // 二分查找找到開始索引
    let start = 0;
    let end = results.length - 1;
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (cumulativeHeights[mid] < scrollTop) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }
    start = Math.max(0, start - overscan);

    // 找到結束索引
    const viewportBottom = scrollTop + containerHeight;
    end = start;
    while (end < results.length && cumulativeHeights[end] < viewportBottom) {
      end++;
    }
    end = Math.min(results.length - 1, end + overscan);

    const visibleResults = results.slice(start, end + 1);

    return {
      start,
      end,
      items: visibleResults.map((result, index) => ({
        ...result,
        index: start + index,
        top: cumulativeHeights[start + index],
        height: itemHeights[start + index]
      }))
    };
  }, [results, scrollTop, containerHeight, cumulativeHeights, itemHeights, overscan]);

  // 滾動事件處理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 當展開狀態改變時，可能需要調整滾動位置
  useEffect(() => {
    if (containerRef.current) {
      // 這裡可以添加智能滾動邏輯，比如保持當前可見項目在視窗中
      containerRef.current.scrollTop = scrollTop;
    }
  }, [expandedItems, scrollTop]);

  const totalHeight = cumulativeHeights[cumulativeHeights.length - 1] || 0;

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
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* 虛擬化容器 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.items.map((item) => (
          <div
            key={item.deviceIp}
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
              result={item}
              isExpanded={expandedItems.has(item.deviceIp)}
              onExpand={() => onToggleExpanded(item.deviceIp)}
              onCopy={onCopy}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(VirtualizedResultList);