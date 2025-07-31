/**
 * 日誌系統使用範例組件
 * 展示如何在 React 組件中正確使用日誌系統
 */

import React, { useState } from 'react';
import { useLogger, useApiLogger, useUserActionLogger, usePerformanceLogger } from '@/hooks';

const LoggerExampleComponent: React.FC = () => {
  const [counter, setCounter] = useState(0);
  
  // 基本日誌記錄
  const logger = useLogger({ 
    componentName: 'LoggerExample',
    enableComponentLogs: true,
    enablePerformanceTracking: true,
  });

  // API 日誌記錄（專用）
  const apiLogger = useApiLogger('LoggerExample');

  // 用戶行為追蹤（專用）
  const userLogger = useUserActionLogger('LoggerExample');

  // 效能監控（專用）
  const perfLogger = usePerformanceLogger('LoggerExample');

  // 模擬 API 呼叫
  const handleApiCall = async () => {
    try {
      const result = await apiLogger.logApiCall(
        '/api/test',
        async () => {
          // 模擬 API 延遲
          await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
          return { success: true, data: 'test data' };
        },
        {
          method: 'GET',
          requestData: { test: true },
        }
      );
      
      logger.info('API 呼叫成功', { result });
    } catch (error) {
      logger.error('API 呼叫失敗', { error }, error as Error);
    }
  };

  // 記錄用戶操作
  const handleUserAction = (action: string) => {
    userLogger.trackClick(`button-${action}`, { counter, timestamp: Date.now() });
    
    if (action === 'increment') {
      setCounter(prev => prev + 1);
      logger.debug('計數器增加', { newValue: counter + 1 });
    } else if (action === 'reset') {
      const oldValue = counter;
      setCounter(0);
      logger.info('計數器重置', { oldValue, newValue: 0 });
    }
  };

  // 效能測試
  const runPerformanceTest = async () => {
    // 同步操作測量
    const stopMeasure = logger.startPerformanceMeasure('heavy_calculation');
    
    // 模擬重計算
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.random();
    }
    
    const duration = stopMeasure();
    logger.info('重計算完成', { result: result.toFixed(2), duration });

    // 異步操作測量
    try {
      const asyncResult = await logger.measureAsyncOperation(
        'async_data_processing',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return { processed: true, items: 100 };
        }
      );
      
      logger.info('異步處理完成', asyncResult);
    } catch (error) {
      logger.error('異步處理失敗', {}, error as Error);
    }
  };

  // 記錄不同級別的日誌
  const logDifferentLevels = () => {
    logger.debug('這是 DEBUG 日誌 - 用於開發調試', { 
      component: 'LoggerExample',
      action: 'test_logging',
      counter 
    });

    logger.info('這是 INFO 日誌 - 用於一般資訊', { 
      level: 'info',
      message: '正常運作狀態' 
    });

    logger.warn('這是 WARN 日誌 - 用於警告訊息', { 
      level: 'warning',
      condition: 'counter > 10',
      currentCounter: counter 
    });

    // 模擬錯誤
    try {
      if (counter > 5) {
        throw new Error(`計數器過高: ${counter}`);
      }
    } catch (error) {
      logger.error('這是 ERROR 日誌 - 用於錯誤記錄', {
        level: 'error',
        counter,
        threshold: 5
      }, error as Error);
    }
  };

  // 清理日誌
  const handleClearLogs = () => {
    logger.clearLogs();
    logger.info('本地日誌已清除');
  };

  // 查看日誌統計
  const handleShowStats = () => {
    const stats = logger.getLogStats();
    logger.info('日誌系統統計', stats);
    console.log('📊 日誌統計:', stats);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">🧪 日誌系統使用範例</h2>
      
      <div className="space-y-4">
        {/* 計數器顯示 */}
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">計數器: {counter}</h3>
          <div className="space-x-2">
            <button
              onClick={() => handleUserAction('increment')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              增加
            </button>
            <button
              onClick={() => handleUserAction('reset')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              重置
            </button>
          </div>
        </div>

        {/* 日誌測試按鈕 */}
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">日誌測試</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={logDifferentLevels}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              📝 測試各級別日誌
            </button>
            <button
              onClick={handleApiCall}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
            >
              🌐 模擬 API 呼叫
            </button>
            <button
              onClick={runPerformanceTest}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
            >
              ⚡ 效能測試
            </button>
            <button
              onClick={handleShowStats}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 text-sm"
            >
              📊 查看統計
            </button>
          </div>
        </div>

        {/* 日誌管理 */}
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">日誌管理</h3>
          <div className="space-x-2">
            <button
              onClick={handleClearLogs}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              🗑️ 清除本地日誌
            </button>
            <button
              onClick={() => logger.flushLogs()}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
            >
              📤 刷新遠端日誌
            </button>
          </div>
        </div>

        {/* 使用說明 */}
        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-400">
          <h3 className="font-semibold mb-2 text-blue-800">💡 使用說明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 開啟瀏覽器開發者工具的 Console 面板查看日誌輸出</li>
            <li>• 點擊右下角的 "📊 Logger" 按鈕開啟日誌監控面板</li>
            <li>• 在開發環境下，所有日誌都會輸出到控制台</li>
            <li>• 日誌會自動存儲到瀏覽器的 localStorage 中</li>
            <li>• 如果啟用遠端日誌，會自動發送到後端</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoggerExampleComponent;