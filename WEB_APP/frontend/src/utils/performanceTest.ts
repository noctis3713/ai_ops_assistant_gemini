/**
 * 虛擬化列表效能測試工具
 * 用於測試和比較不同的高度計算實作效能
 */

export interface TestResult {
  deviceIp: string;
  success: boolean;
  output: string;
  timestamp: string;
}

export interface PerformanceTestResult {
  executionTime: number;
  memoryUsage: number;
  cacheHitRatio: number;
}

export interface TestSuiteResult {
  itemCount: number;
  oldVersion: PerformanceTestResult;
  newVersion: PerformanceTestResult;
  improvement: number;
}

/**
 * 生成測試用的結果資料
 */
export function generateTestResults(count: number): TestResult[] {
  const results: TestResult[] = [];
  
  for (let i = 0; i < count; i++) {
    results.push({
      deviceIp: `192.168.1.${(i % 254) + 1}`,
      success: Math.random() > 0.2, // 80% 成功率
      output: `Test output for device ${i + 1}\n`.repeat(Math.floor(Math.random() * 10) + 1),
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
    });
  }
  
  return results;
}

/**
 * 生成展開項目清單
 */
export function generateExpandedItems(results: TestResult[], expandRatio: number): Set<string> {
  const expanded = new Set<string>();
  const expandCount = Math.floor(results.length * expandRatio);
  
  for (let i = 0; i < expandCount; i++) {
    const randomIndex = Math.floor(Math.random() * results.length);
    expanded.add(results[randomIndex].deviceIp);
  }
  
  return expanded;
}

/**
 * 測試舊版本高度計算（模擬）
 */
export function testOldHeightCalculation(
  results: TestResult[],
  expandedItems: Set<string>,
  baseHeight: number
): PerformanceTestResult {
  const startTime = performance.now();
  const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
  
  let totalHeight = 0;
  
  // 模擬舊版本的低效計算
  for (const result of results) {
    let itemHeight = baseHeight;
    
    if (expandedItems.has(result.deviceIp)) {
      // 模擬複雜的高度計算
      const lines = result.output.split('\n').length;
      itemHeight += lines * 20;
      
      // 模擬一些不必要的重複計算
      for (let i = 0; i < 10; i++) {
        itemHeight = Math.max(itemHeight, baseHeight + lines * 20);
      }
    }
    
    totalHeight += itemHeight;
  }
  
  const endTime = performance.now();
  const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
  
  return {
    executionTime: endTime - startTime,
    memoryUsage: finalMemory - initialMemory,
    cacheHitRatio: 0 // 舊版本沒有快取
  };
}

/**
 * 測試新版本高度計算（模擬）
 */
export function testNewHeightCalculation(
  results: TestResult[],
  expandedItems: Set<string>,
  baseHeight: number,
  cache: Map<string, number>
): PerformanceTestResult {
  const startTime = performance.now();
  const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
  
  let totalHeight = 0;
  let cacheHits = 0;
  
  // 模擬新版本的高效計算
  for (const result of results) {
    const cacheKey = `${result.deviceIp}-${expandedItems.has(result.deviceIp)}`;
    
    if (cache.has(cacheKey)) {
      totalHeight += cache.get(cacheKey)!;
      cacheHits++;
    } else {
      let itemHeight = baseHeight;
      
      if (expandedItems.has(result.deviceIp)) {
        const lines = result.output.split('\n').length;
        itemHeight += lines * 20;
      }
      
      cache.set(cacheKey, itemHeight);
      totalHeight += itemHeight;
    }
  }
  
  const endTime = performance.now();
  const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
  
  return {
    executionTime: endTime - startTime,
    memoryUsage: finalMemory - initialMemory,
    cacheHitRatio: cacheHits / results.length
  };
}

/**
 * 執行完整的效能測試套件
 */
export function runPerformanceTestSuite(itemCounts: number[]): TestSuiteResult[] {
  const results: TestSuiteResult[] = [];
  
  for (const count of itemCounts) {
    const testResults = generateTestResults(count);
    const expandedItems = generateExpandedItems(testResults, 0.3);
    const baseHeight = 120;
    const cache = new Map<string, number>();
    
    const oldResult = testOldHeightCalculation(testResults, expandedItems, baseHeight);
    const newResult = testNewHeightCalculation(testResults, expandedItems, baseHeight, cache);
    
    const improvement = ((oldResult.executionTime - newResult.executionTime) / oldResult.executionTime) * 100;
    
    results.push({
      itemCount: count,
      oldVersion: oldResult,
      newVersion: newResult,
      improvement
    });
  }
  
  return results;
}

/**
 * 格式化測試結果
 */
export function formatTestResults(results: TestSuiteResult[]): string {
  let output = '\n📊 虛擬化列表效能測試結果\n';
  output += '=' .repeat(50) + '\n\n';
  
  for (const result of results) {
    output += `項目數量: ${result.itemCount}\n`;
    output += `  舊版本: ${result.oldVersion.executionTime.toFixed(2)}ms\n`;
    output += `  新版本: ${result.newVersion.executionTime.toFixed(2)}ms\n`;
    output += `  效能提升: ${result.improvement.toFixed(1)}%\n`;
    output += `  快取命中率: ${(result.newVersion.cacheHitRatio * 100).toFixed(1)}%\n\n`;
  }
  
  const avgImprovement = results.reduce((sum, r) => sum + r.improvement, 0) / results.length;
  output += `平均效能提升: ${avgImprovement.toFixed(1)}%\n`;
  
  return output;
}