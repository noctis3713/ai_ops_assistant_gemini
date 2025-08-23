/**
 * 虛擬化列表效能測試
 * 可以在瀏覽器開發者工具中執行
 */

import { 
  generateTestResults,
  generateExpandedItems,
  testOldHeightCalculation,
  testNewHeightCalculation,
  runPerformanceTestSuite,
  formatTestResults
} from '../../utils/performanceTest';

// 將測試函數掛載到全域物件，方便在控制台中調用
declare global {
  interface Window {
    virtualListPerfTest: {
      runTest: () => void;
      runQuickTest: (itemCount?: number) => void;
      runFullSuite: () => void;
    };
  }
}

// 快速測試函數
function runQuickTest(itemCount: number = 500) {
  console.log(`🧪 執行虛擬列表快速效能測試 (${itemCount} 項目)`);
  console.time('Total Test Time');
  
  const testResults = generateTestResults(itemCount);
  const expandedItems = generateExpandedItems(testResults, 0.3);
  const itemHeight = 120;
  const cache = new Map<string, number>();
  
  // 測試舊版本
  console.time('Old Version');
  const oldResult = testOldHeightCalculation(testResults, expandedItems, itemHeight);
  console.timeEnd('Old Version');
  
  // 測試新版本
  console.time('New Version');
  const newResult = testNewHeightCalculation(testResults, expandedItems, itemHeight, cache);
  console.timeEnd('New Version');
  
  // 計算改進
  const improvement = ((oldResult.executionTime - newResult.executionTime) / oldResult.executionTime) * 100;
  
  console.log(`📊 效能測試結果:`);
  console.log(`   舊版本: ${oldResult.executionTime.toFixed(2)}ms`);
  console.log(`   新版本: ${newResult.executionTime.toFixed(2)}ms`);
  console.log(`   🚀 效能提升: ${improvement.toFixed(1)}%`);
  console.log(`   💾 快取命中率: ${((itemCount - cache.size) / itemCount * 100).toFixed(1)}%`);
  
  console.timeEnd('Total Test Time');
}

// 完整測試套件
function runFullSuite() {
  console.log('🧪 執行完整虛擬列表效能測試套件');
  console.time('Full Test Suite');
  
  const results = runPerformanceTestSuite([100, 500, 1000, 2000, 5000]);
  console.log(formatTestResults(results));
  
  console.timeEnd('Full Test Suite');
}

// 基本測試
function runTest() {
  console.log('🧪 執行基本虛擬列表效能測試');
  runQuickTest(1000);
}

// 設置全域測試函數
if (typeof window !== 'undefined') {
  window.virtualListPerfTest = {
    runTest,
    runQuickTest,
    runFullSuite
  };
  
  console.log('🔧 虛擬列表效能測試工具已載入！');
  console.log('使用方法:');
  console.log('  window.virtualListPerfTest.runTest() - 基本測試');
  console.log('  window.virtualListPerfTest.runQuickTest(1000) - 快速測試指定數量');
  console.log('  window.virtualListPerfTest.runFullSuite() - 完整測試套件');
}

export { runTest, runQuickTest, runFullSuite };