/**
 * 完整的日誌系統測試與診斷工具
 * 用於驗證日誌系統的環境變數、配置和功能是否正確運作
 */

import { logger, LogCategory } from './LoggerService';

export function testEnvironmentVariables() {
  console.group('🔧 前端日誌系統環境變數載入測試');
  
  // 基本環境資訊
  console.log('環境模式:', import.meta.env.MODE);
  console.log('是否為開發環境:', import.meta.env.DEV);
  console.log('是否為生產環境:', import.meta.env.PROD);
  
  // 日誌系統環境變數
  const logEnvVars = {
    'VITE_LOG_LEVEL': import.meta.env.VITE_LOG_LEVEL,
    'VITE_ENABLE_CONSOLE_LOG': import.meta.env.VITE_ENABLE_CONSOLE_LOG,
    'VITE_ENABLE_REMOTE_LOG': import.meta.env.VITE_ENABLE_REMOTE_LOG,
    'VITE_ENABLE_LOCAL_STORAGE_LOG': import.meta.env.VITE_ENABLE_LOCAL_STORAGE_LOG,
    'VITE_MAX_LOCAL_STORAGE_ENTRIES': import.meta.env.VITE_MAX_LOCAL_STORAGE_ENTRIES,
    'VITE_REMOTE_LOG_ENDPOINT': import.meta.env.VITE_REMOTE_LOG_ENDPOINT,
    'VITE_LOG_CATEGORIES': import.meta.env.VITE_LOG_CATEGORIES,
    'VITE_LOG_SHOW_STACK_TRACE': import.meta.env.VITE_LOG_SHOW_STACK_TRACE,
    'VITE_LOG_PERFORMANCE_THRESHOLD': import.meta.env.VITE_LOG_PERFORMANCE_THRESHOLD,
  };
  
  console.table(logEnvVars);
  
  // 檢查必要的環境變數是否存在
  const missingVars = Object.entries(logEnvVars)
    .filter(([key, value]) => value === undefined)
    .map(([key]) => key);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ 以下環境變數未設定:', missingVars);
    console.info('💡 建議檢查 config/.env.* 檔案是否正確配置');
  } else {
    console.log('✅ 所有環境變數載入成功');
  }
  
  // 載入來源分析
  const envSource = import.meta.env.MODE === 'development' 
    ? 'config/.env.development 或 config/.env.local'
    : 'config/.env.production';
  console.info(`📂 當前環境變數載入來源: ${envSource}`);
  
  console.groupEnd();
  
  return {
    allLoaded: missingVars.length === 0,
    missingVars,
    loadedVars: logEnvVars,
    envSource
  };
}

/**
 * 測試日誌系統功能
 * 驗證日誌記錄、分類、級別等功能是否正常運作
 */
export function testLoggerService() {
  console.group('🧪 日誌系統功能測試');

  try {
    // 測試各級別日誌
    logger.debug(LogCategory.DEBUG, '測試 DEBUG 級別日誌', { test: 'debug' });
    logger.info(LogCategory.DEBUG, '測試 INFO 級別日誌', { test: 'info' });
    logger.warn(LogCategory.DEBUG, '測試 WARN 級別日誌', { test: 'warn' });
    logger.error(LogCategory.DEBUG, '測試 ERROR 級別日誌', { test: 'error' });

    // 測試各分類日誌
    const categories = Object.values(LogCategory);
    categories.forEach(category => {
      logger.info(category, `測試 ${category} 分類日誌`, { category });
    });

    // 測試效能記錄
    logger.performance('test_operation', 123, { test: true });

    // 獲取日誌統計
    const stats = logger.getLogStats();
    console.log('📊 日誌系統統計:', stats);

    // 獲取本地日誌
    const localLogs = logger.getLocalLogs();
    console.log(`💾 本地存儲日誌數量: ${localLogs.length}`);

    if (localLogs.length > 0) {
      console.log('📋 最近的日誌條目:', localLogs.slice(-3));
    }

    console.log('✅ 日誌系統功能測試完成');
    
    return {
      success: true,
      stats,
      localLogCount: localLogs.length,
      testResults: {
        basicLogging: true,
        categoryLogging: true,
        performanceLogging: true,
        statisticsCollection: true,
        localStorageAccess: true,
      }
    };

  } catch (error) {
    console.error('❌ 日誌系統功能測試失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      testResults: {
        basicLogging: false,
        categoryLogging: false,
        performanceLogging: false,
        statisticsCollection: false,
        localStorageAccess: false,
      }
    };
  } finally {
    console.groupEnd();
  }
}

/**
 * 測試遠端日誌發送功能
 */
export async function testRemoteLogging() {
  console.group('🌐 遠端日誌發送測試');

  try {
    // 動態導入，避免循環依賴
    const { sendSingleLogEntry } = await import('@/api/services');
    
    const testLogEntry = {
      timestamp: new Date().toISOString(),
      level: 1, // INFO
      category: LogCategory.DEBUG,
      message: '遠端日誌發送測試',
      data: { test: true, timestamp: Date.now() },
      sessionId: 'test-session',
    };

    console.log('🚀 發送測試日誌到遠端...');
    const response = await sendSingleLogEntry(testLogEntry);
    
    console.log('📦 遠端日誌回應:', response);

    if (response.success) {
      console.log('✅ 遠端日誌發送測試成功');
      return {
        success: true,
        response,
        endpoint: import.meta.env.VITE_REMOTE_LOG_ENDPOINT,
      };
    } else {
      console.warn('⚠️ 遠端日誌發送失敗:', response.message);
      return {
        success: false,
        response,
        endpoint: import.meta.env.VITE_REMOTE_LOG_ENDPOINT,
      };
    }

  } catch (error) {
    console.error('❌ 遠端日誌發送測試失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      endpoint: import.meta.env.VITE_REMOTE_LOG_ENDPOINT,
    };
  } finally {
    console.groupEnd();
  }
}

/**
 * 執行完整的日誌系統診斷
 */
export async function runFullLoggerDiagnostics() {
  console.group('🔍 完整日誌系統診斷');
  
  const results = {
    timestamp: new Date().toISOString(),
    environment: {},
    logger: {},
    remote: {},
    recommendations: [] as string[],
  };

  // 1. 環境變數測試
  console.log('1️⃣ 測試環境變數...');
  results.environment = testEnvironmentVariables();

  // 2. 日誌服務測試
  console.log('2️⃣ 測試日誌服務...');
  results.logger = testLoggerService();

  // 3. 遠端日誌測試（如果啟用）
  if (import.meta.env.VITE_ENABLE_REMOTE_LOG === 'true') {
    console.log('3️⃣ 測試遠端日誌...');
    results.remote = await testRemoteLogging();
  } else {
    console.log('3️⃣ 遠端日誌未啟用，跳過測試');
    results.remote = { success: null, reason: '未啟用遠端日誌' };
  }

  // 4. 生成建議
  console.log('4️⃣ 生成診斷建議...');
  
  if (!results.environment.allLoaded) {
    results.recommendations.push('部分環境變數未設定，建議檢查 config/.env.* 檔案');
  }

  if (!results.logger.success) {
    results.recommendations.push('日誌服務功能異常，建議檢查 LoggerService 初始化');
  }

  if (results.remote.success === false) {
    results.recommendations.push('遠端日誌發送失敗，建議檢查後端 API 端點和網路連接');
  }

  if (results.logger.stats?.localCount > 500) {
    results.recommendations.push('本地日誌數量較多，建議適當清理或調整 maxLocalStorageEntries');
  }

  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_REMOTE_LOG === 'true') {
    results.recommendations.push('開發環境下啟用了遠端日誌，建議關閉以減少後端負載');
  }

  if (!import.meta.env.DEV && import.meta.env.VITE_ENABLE_CONSOLE_LOG === 'true') {
    results.recommendations.push('生產環境下啟用了控制台日誌，建議關閉以防資訊洩露');
  }

  if (results.recommendations.length === 0) {
    results.recommendations.push('日誌系統運作正常，無需特別調整');
  }

  console.log('📋 診斷建議:', results.recommendations);
  console.log('📊 完整診斷結果:', results);
  
  console.groupEnd();
  
  return results;
}

/**
 * 日誌系統效能基準測試
 */
export function benchmarkLoggerPerformance() {
  console.group('⚡ 日誌系統效能基準測試');
  
  const iterations = 1000;
  const testData = { test: true, value: 42, text: 'performance test' };
  
  // 測試各級別日誌記錄效能
  const benchmarks: Record<string, number> = {};
  
  // DEBUG 日誌
  const debugStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    logger.debug(LogCategory.DEBUG, `Debug log ${i}`, testData);
  }
  benchmarks.debug = performance.now() - debugStart;
  
  // INFO 日誌
  const infoStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    logger.info(LogCategory.DEBUG, `Info log ${i}`, testData);
  }
  benchmarks.info = performance.now() - infoStart;
  
  // 效能日誌
  const perfStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    logger.performance(`operation_${i}`, 100 + Math.random() * 50, testData);
  }
  benchmarks.performance = performance.now() - perfStart;
  
  // 計算平均值
  const averages = Object.entries(benchmarks).reduce((acc, [key, time]) => {
    acc[key] = time / iterations;
    return acc;
  }, {} as Record<string, number>);
  
  console.table({
    總時間: benchmarks,
    平均時間: averages,
  });
  
  console.log(`📈 執行 ${iterations} 次日誌記錄的效能基準:`);
  console.log(`   DEBUG 平均: ${averages.debug.toFixed(3)}ms`);
  console.log(`   INFO 平均: ${averages.info.toFixed(3)}ms`);
  console.log(`   PERFORMANCE 平均: ${averages.performance.toFixed(3)}ms`);
  
  const stats = logger.getLogStats();
  console.log('📊 測試後日誌統計:', stats);
  
  console.groupEnd();
  
  return {
    iterations,
    benchmarks,
    averages,
    stats,
  };
}

// 僅在開發環境下自動執行測試
if (import.meta.env.DEV) {
  // 延遲執行，確保頁面載入完成
  setTimeout(() => {
    testEnvironmentVariables();
  }, 1000);
}