/**
 * 日誌系統監控面板
 * 僅在開發環境顯示，用於監控和管理前端日誌系統
 */

import React, { useState, useEffect, useCallback } from 'react';
import { logger, LogCategory } from '@/utils/LoggerService';
import { 
  testEnvironmentVariables, 
  testLoggerService, 
  testRemoteLogging,
  runFullLoggerDiagnostics,
  benchmarkLoggerPerformance 
} from '@/utils/envTest';

interface LogStats {
  localCount: number;
  bufferCount: number;
  sessionId: string;
  config: any;
}

interface LogEntry {
  timestamp: string;
  level: number;
  category: string;
  message: string;
  data?: any;
}

const LoggerDashboard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // 更新統計資訊
  const updateStats = useCallback(() => {
    const currentStats = logger.getLogStats();
    setStats(currentStats);
    
    const logs = logger.getLocalLogs();
    setLocalLogs(logs);
  }, []);

  // 定期更新統計
  useEffect(() => {
    if (isVisible) {
      updateStats();
      const interval = setInterval(updateStats, 5000); // 每5秒更新一次
      return () => clearInterval(interval);
    }
  }, [isVisible, updateStats]);

  // 運行診斷測試
  const runDiagnostics = async () => {
    setIsRunningTests(true);
    try {
      const results = await runFullLoggerDiagnostics();
      setTestResults(results);
    } catch (error) {
      console.error('診斷測試失敗:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // 清除本地日誌
  const clearLocalLogs = () => {
    logger.clearLocalLogs();
    updateStats();
  };

  // 手動刷新遠端日誌
  const flushRemoteLogs = async () => {
    try {
      await logger.flush();
      updateStats();
    } catch (error) {
      console.error('刷新遠端日誌失敗:', error);
    }
  };

  // 測試日誌記錄
  const testLogging = () => {
    logger.debug(LogCategory.DEBUG, '測試 Debug 日誌', { timestamp: Date.now() });
    logger.info(LogCategory.API, '測試 API 日誌', { test: true });
    logger.warn(LogCategory.PERFORMANCE, '測試 Performance 警告', { duration: 150 });
    logger.error(LogCategory.ERROR, '測試錯誤日誌', { error: 'test error' });
    updateStats();
  };

  // 過濾日誌
  const filteredLogs = localLogs.filter(log => 
    selectedCategory === 'all' || log.category === selectedCategory
  ).slice(-50); // 只顯示最近50條

  if (!import.meta.env.DEV) {
    return null; // 生產環境不顯示
  }

  return (
    <>
      {/* 觸發按鈕 */}
      <div 
        className="fixed bottom-4 right-4 z-50"
        style={{ zIndex: 9999 }}
      >
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full shadow-lg text-sm font-medium transition-colors"
          title="開啟日誌監控面板"
        >
          📊 Logger
        </button>
      </div>

      {/* 監控面板 */}
      {isVisible && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ zIndex: 10000 }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
            {/* 標題列 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">📊 前端日誌系統監控面板</h2>
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* 內容區域 */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* 左側：統計資訊 */}
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">📈 日誌統計</h3>
                    {stats && (
                      <div className="space-y-2 text-sm">
                        <div>本地日誌: <span className="font-mono">{stats.localCount}</span></div>
                        <div>緩衝區: <span className="font-mono">{stats.bufferCount}</span></div>
                        <div>會話ID: <span className="font-mono text-xs">{stats.sessionId.substring(0, 16)}...</span></div>
                        <div className="pt-2 border-t">
                          <div>控制台: <span className={stats.config.enableConsole ? 'text-green-600' : 'text-red-600'}>
                            {stats.config.enableConsole ? '✅' : '❌'}
                          </span></div>
                          <div>遠端: <span className={stats.config.enableRemote ? 'text-green-600' : 'text-red-600'}>
                            {stats.config.enableRemote ? '✅' : '❌'}
                          </span></div>
                          <div>本地存儲: <span className={stats.config.enableLocalStorage ? 'text-green-600' : 'text-red-600'}>
                            {stats.config.enableLocalStorage ? '✅' : '❌'}
                          </span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 操作按鈕 */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">🛠️ 操作</h3>
                    <div className="space-y-2">
                      <button
                        onClick={updateStats}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        🔄 更新統計
                      </button>
                      <button
                        onClick={testLogging}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        🧪 測試日誌
                      </button>
                      <button
                        onClick={flushRemoteLogs}
                        className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                      >
                        📤 刷新遠端
                      </button>
                      <button
                        onClick={clearLocalLogs}
                        className="w-full px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        🗑️ 清除本地日誌
                      </button>
                      <button
                        onClick={runDiagnostics}
                        disabled={isRunningTests}
                        className="w-full px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
                      >
                        {isRunningTests ? '⏳ 診斷中...' : '🔍 完整診斷'}
                      </button>
                    </div>
                  </div>

                  {/* 診斷結果 */}
                  {testResults && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-3">📋 診斷結果</h3>
                      <div className="space-y-2 text-sm">
                        <div>環境變數: <span className={testResults.environment.allLoaded ? 'text-green-600' : 'text-red-600'}>
                          {testResults.environment.allLoaded ? '✅' : '❌'}
                        </span></div>
                        <div>日誌服務: <span className={testResults.logger.success ? 'text-green-600' : 'text-red-600'}>
                          {testResults.logger.success ? '✅' : '❌'}
                        </span></div>
                        <div>遠端日誌: <span className={
                          testResults.remote.success === true ? 'text-green-600' : 
                          testResults.remote.success === false ? 'text-red-600' : 'text-gray-500'
                        }>
                          {testResults.remote.success === true ? '✅' : 
                           testResults.remote.success === false ? '❌' : '⏸️'}
                        </span></div>
                        {testResults.recommendations.length > 0 && (
                          <div className="pt-2 border-t">
                            <div className="font-medium">建議:</div>
                            {testResults.recommendations.map((rec: string, index: number) => (
                              <div key={index} className="text-xs text-gray-600 mt-1">• {rec}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 右側：日誌列表 */}
                <div className="lg:col-span-2 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">📜 本地日誌 (最近50條)</h3>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="all">所有分類</option>
                      {Object.values(LogCategory).map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1 overflow-auto bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs">
                    {filteredLogs.length === 0 ? (
                      <div className="text-gray-500">無日誌記錄</div>
                    ) : (
                      <div className="space-y-1">
                        {filteredLogs.map((log, index) => (
                          <div key={index} className="flex">
                            <span className="text-gray-500 mr-2">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`mr-2 ${
                              log.level === 0 ? 'text-gray-400' :  // DEBUG
                              log.level === 1 ? 'text-blue-400' :  // INFO
                              log.level === 2 ? 'text-yellow-400' : // WARN
                              'text-red-400'  // ERROR
                            }`}>
                              [{['DEBUG', 'INFO', 'WARN', 'ERROR'][log.level]}]
                            </span>
                            <span className="text-purple-400 mr-2">[{log.category}]</span>
                            <span className="text-green-400 flex-1">{log.message}</span>
                            {log.data && (
                              <span className="text-gray-400 ml-2 truncate max-w-xs">
                                {JSON.stringify(log.data)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LoggerDashboard;