/**
 * 虛擬列表效能測試工具
 * 用於測試大數據量場景下的效能表現
 */

import { 
  calculateVisibleItems, 
  calculateCumulativeHeights
} from './virtualListHelpers';

export interface PerformanceTestResult {
  operationName: string;
  executionTime: number;
  itemsProcessed: number;
  avgTimePerItem: number;
}

/**
 * 測試結果項目的介面定義
 */
export interface TestResult {
  deviceIp: string;
  deviceName: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  timestamp: string;
}

/**
 * 生成測試用的批次執行結果
 * @param count 項目數量
 * @returns 測試資料陣列
 */
export function generateTestResults(count: number) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push({
      deviceIp: `192.168.1.${i % 255}`,
      deviceName: `Device-${i}`,
      success: Math.random() > 0.1,
      output: `Test output for device ${i}\n`.repeat(Math.floor(Math.random() * 50) + 10),
      error: Math.random() > 0.9 ? `Error message for device ${i}` : undefined,
      executionTime: Math.random() * 1000 + 100,
      timestamp: new Date().toISOString()
    });
  }
  return results;
}

/**
 * 生成測試用的展開項目集合
 * @param results 結果陣列
 * @param expandRatio 展開比例 (0-1)
 * @returns 展開項目的 Set
 */
export function generateExpandedItems(results: TestResult[], expandRatio: number = 0.3): Set<string> {
  const expanded = new Set<string>();
  const expandCount = Math.floor(results.length * expandRatio);
  
  for (let i = 0; i < expandCount; i++) {
    const randomIndex = Math.floor(Math.random() * results.length);
    expanded.add(results[randomIndex].deviceIp);
  }
  
  return expanded;
}

/**
 * 測試高度計算效能（舊版本模擬）
 * @param results 結果陣列
 * @param expandedItems 展開項目集合
 * @param itemHeight 基礎項目高度
 * @returns 效能測試結果
 */
export function testOldHeightCalculation(
  results: TestResult[], 
  expandedItems: Set<string>, 
  itemHeight: number
): PerformanceTestResult {
  const start = performance.now();
  
  // 模擬舊版本的計算方式 - 每次都重新計算整個陣列
  results.forEach(result => {
    const isExpanded = expandedItems.has(result.deviceIp);
    const expandedMultiplier = isExpanded ? 
      Math.min(4, Math.max(2, (result.output?.length || 0) / 1000 + 2)) : 1;
    Math.floor(itemHeight * expandedMultiplier);
  });
  
  const end = performance.now();
  
  return {
    operationName: 'Old Height Calculation',
    executionTime: end - start,
    itemsProcessed: results.length,
    avgTimePerItem: (end - start) / results.length
  };
}

/**
 * 測試新版本高度計算效能（使用快取）
 * @param results 結果陣列
 * @param expandedItems 展開項目集合
 * @param itemHeight 基礎項目高度
 * @param cache 快取 Map
 * @returns 效能測試結果
 */
export function testNewHeightCalculation(
  results: TestResult[], 
  expandedItems: Set<string>, 
  itemHeight: number,
  cache: Map<string, number> = new Map()
): PerformanceTestResult {
  const start = performance.now();
  
  const heights: number[] = [];
  
  results.forEach((result, index) => {
    const isExpanded = expandedItems.has(result.deviceIp);
    const cacheKey = `${result.deviceIp}_${isExpanded}_${result.output?.length || 0}`;
    
    let height = cache.get(cacheKey);
    if (height === undefined) {
      const expandedMultiplier = isExpanded ? 
        Math.min(4, Math.max(2, (result.output?.length || 0) / 1000 + 2)) : 1;
      height = Math.floor(itemHeight * expandedMultiplier);
      cache.set(cacheKey, height);
    }
    
    heights[index] = height;
  });
  
  const end = performance.now();
  
  return {
    operationName: 'New Height Calculation (Cached)',
    executionTime: end - start,
    itemsProcessed: results.length,
    avgTimePerItem: (end - start) / results.length
  };
}

/**
 * 測試可視範圍計算效能
 * @param results 結果陣列
 * @param itemHeights 高度陣列
 * @param scrollTop 滾動位置
 * @param containerHeight 容器高度
 * @returns 效能測試結果
 */
export function testVisibleRangeCalculation(
  results: TestResult[],
  itemHeights: number[],
  scrollTop: number = 1000,
  containerHeight: number = 600
): PerformanceTestResult {
  const start = performance.now();
  
  const cumulativeHeights = calculateCumulativeHeights(itemHeights);
  const visibleItems = calculateVisibleItems(
    results,
    scrollTop,
    containerHeight,
    cumulativeHeights,
    itemHeights
  );
  
  const end = performance.now();
  
  return {
    operationName: 'Visible Range Calculation',
    executionTime: end - start,
    itemsProcessed: visibleItems.items.length,
    avgTimePerItem: (end - start) / visibleItems.items.length
  };
}

/**
 * 執行完整的效能測試套件
 * @param itemCounts 要測試的項目數量陣列
 * @returns 測試結果陣列
 */
export function runPerformanceTestSuite(itemCounts: number[] = [100, 500, 1000, 2000]): PerformanceTestResult[] {
  const results: PerformanceTestResult[] = [];
  const cache = new Map<string, number>();
  
  for (const count of itemCounts) {
    console.log(`測試 ${count} 個項目...`);
    
    const testResults = generateTestResults(count);
    const expandedItems = generateExpandedItems(testResults, 0.3);
    const itemHeight = 120;
    
    // 測試舊版本高度計算
    const oldResult = testOldHeightCalculation(testResults, expandedItems, itemHeight);
    oldResult.operationName += ` (${count} items)`;
    results.push(oldResult);
    
    // 測試新版本高度計算
    const newResult = testNewHeightCalculation(testResults, expandedItems, itemHeight, cache);
    newResult.operationName += ` (${count} items)`;
    results.push(newResult);
    
    // 計算改進百分比
    const improvement = ((oldResult.executionTime - newResult.executionTime) / oldResult.executionTime) * 100;
    console.log(`${count} 項目效能提升: ${improvement.toFixed(1)}%`);
    
    // 測試可視範圍計算
    const itemHeights = Array(count).fill(0).map(() => 
      Math.floor(itemHeight * (Math.random() + 1))
    );
    const visibleResult = testVisibleRangeCalculation(testResults, itemHeights);
    visibleResult.operationName += ` (${count} items)`;
    results.push(visibleResult);
  }
  
  return results;
}

/**
 * 格式化效能測試結果為可讀的字串
 * @param results 測試結果陣列
 * @returns 格式化的結果字串
 */
export function formatTestResults(results: PerformanceTestResult[]): string {
  let output = '=== 虛擬列表效能測試結果 ===\n\n';
  
  results.forEach(result => {
    output += `${result.operationName}:\n`;
    output += `  執行時間: ${result.executionTime.toFixed(2)}ms\n`;
    output += `  處理項目: ${result.itemsProcessed}\n`;
    output += `  平均每項: ${(result.avgTimePerItem * 1000).toFixed(2)}μs\n\n`;
  });
  
  return output;
}