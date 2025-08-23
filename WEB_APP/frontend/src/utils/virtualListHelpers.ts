/**
 * 虛擬列表工具函數
 * 提供高效的可視範圍計算和滾動位置管理
 */

export interface VisibleRange {
  start: number;
  end: number;
}

export interface VisibleItem<T> {
  data: T;
  index: number;
  top: number;
  height: number;
}

export interface VisibleItemsResult<T> {
  start: number;
  end: number;
  items: VisibleItem<T>[];
}

/**
 * 使用二分查找計算可視範圍的開始索引
 * @param scrollTop 當前滾動位置
 * @param cumulativeHeights 累積高度陣列
 * @param overscan 額外渲染的項目數量
 * @returns 開始索引
 */
export function findStartIndex(
  scrollTop: number,
  cumulativeHeights: number[],
  overscan: number = 0
): number {
  if (cumulativeHeights.length <= 1) return 0;
  
  let start = 0;
  let end = cumulativeHeights.length - 2; // 減1因為最後一個是總高度
  
  while (start < end) {
    const mid = Math.floor((start + end) / 2);
    if (cumulativeHeights[mid] < scrollTop) {
      start = mid + 1;
    } else {
      end = mid;
    }
  }
  
  return Math.max(0, start - overscan);
}

/**
 * 計算可視範圍的結束索引
 * @param startIndex 開始索引
 * @param scrollTop 當前滾動位置
 * @param containerHeight 容器高度
 * @param cumulativeHeights 累積高度陣列
 * @param totalItems 總項目數
 * @param overscan 額外渲染的項目數量
 * @returns 結束索引
 */
export function findEndIndex(
  startIndex: number,
  scrollTop: number,
  containerHeight: number,
  cumulativeHeights: number[],
  totalItems: number,
  overscan: number = 0
): number {
  const viewportBottom = scrollTop + containerHeight;
  let end = startIndex;
  
  while (end < totalItems && cumulativeHeights[end] < viewportBottom) {
    end++;
  }
  
  return Math.min(totalItems - 1, end + overscan);
}

/**
 * 計算可視範圍內的項目
 * @param items 所有項目
 * @param scrollTop 當前滾動位置
 * @param containerHeight 容器高度
 * @param cumulativeHeights 累積高度陣列
 * @param itemHeights 每項高度陣列
 * @param overscan 額外渲染的項目數量
 * @returns 可視項目結果
 */
export function calculateVisibleItems<T>(
  items: T[],
  scrollTop: number,
  containerHeight: number,
  cumulativeHeights: number[],
  itemHeights: number[],
  overscan: number = 5
): VisibleItemsResult<T> {
  if (items.length === 0) {
    return { start: 0, end: 0, items: [] };
  }

  const start = findStartIndex(scrollTop, cumulativeHeights, overscan);
  const end = findEndIndex(
    start,
    scrollTop,
    containerHeight,
    cumulativeHeights,
    items.length,
    overscan
  );

  const visibleItems = items.slice(start, end + 1);

  return {
    start,
    end,
    items: visibleItems.map((item, index) => ({
      data: item,
      index: start + index,
      top: cumulativeHeights[start + index],
      height: itemHeights[start + index]
    }))
  };
}

/**
 * 計算累積高度陣列
 * @param itemHeights 每項高度陣列
 * @returns 累積高度陣列，第一個元素為0，最後一個元素為總高度
 */
export function calculateCumulativeHeights(itemHeights: number[]): number[] {
  const heights = [0];
  let total = 0;
  
  for (const height of itemHeights) {
    total += height;
    heights.push(total);
  }
  
  return heights;
}

/**
 * 記錄滾動位置和項目的資訊，用於位置恢復
 */
export interface ScrollPosition {
  itemIndex: number;
  offsetFromTop: number;
  timestamp: number;
}

/**
 * 計算當前滾動位置對應的項目和偏移
 * @param scrollTop 當前滾動位置
 * @param cumulativeHeights 累積高度陣列
 * @returns 滾動位置資訊
 */
export function recordScrollPosition(
  scrollTop: number,
  cumulativeHeights: number[]
): ScrollPosition {
  const itemIndex = findStartIndex(scrollTop, cumulativeHeights, 0);
  const itemTop = cumulativeHeights[itemIndex] || 0;
  const offsetFromTop = scrollTop - itemTop;
  
  return {
    itemIndex,
    offsetFromTop,
    timestamp: Date.now()
  };
}

/**
 * 根據記錄的位置資訊計算新的滾動位置
 * @param position 之前記錄的位置
 * @param newCumulativeHeights 新的累積高度陣列
 * @returns 新的滾動位置
 */
export function restoreScrollPosition(
  position: ScrollPosition,
  newCumulativeHeights: number[]
): number {
  if (position.itemIndex >= newCumulativeHeights.length - 1) {
    // 如果項目索引超出範圍，滾動到底部
    return newCumulativeHeights[newCumulativeHeights.length - 1] || 0;
  }
  
  const newItemTop = newCumulativeHeights[position.itemIndex] || 0;
  return newItemTop + position.offsetFromTop;
}