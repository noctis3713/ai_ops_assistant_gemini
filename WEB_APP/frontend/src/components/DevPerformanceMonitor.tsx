/**
 * 開發環境效能監控面板
 * 僅在開發環境顯示，提供即時效能統計
 */
import React, { useState } from 'react';
import { usePerformanceStats } from '@/hooks';

const DevPerformanceMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { stats, getDetailedReport, clearMetrics } = usePerformanceStats(2000);

  // 只在開發環境顯示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleShowDetails = () => {
    const report = getDetailedReport();
    console.group('🚀 Performance Report');
    console.log('General Metrics:', report.general);
    console.log('Render Metrics:', report.renders);
    console.log('API Metrics:', report.apis);
    console.log('Statistics:', report.stats);
    console.groupEnd();
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="顯示效能監控"
        >
          📊
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800">🚀 效能監控</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">總指標數:</span>
          <span className="font-mono">{stats.totalMetrics}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">渲染指標:</span>
          <span className="font-mono">{stats.renderMetrics}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">API 指標:</span>
          <span className="font-mono">{stats.apiMetrics}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">平均渲染時間:</span>
          <span className="font-mono">
            {stats.averageRenderTime.toFixed(1)}ms
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">平均 API 時間:</span>
          <span className="font-mono">
            {stats.averageAPITime.toFixed(1)}ms
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">慢組件數:</span>
          <span className="font-mono text-red-600">
            {stats.slowComponents.length}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">慢 API 數:</span>
          <span className="font-mono text-red-600">
            {stats.slowAPIs.length}
          </span>
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <button
          onClick={handleShowDetails}
          className="w-full bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors"
        >
          顯示詳細報告
        </button>
        
        <button
          onClick={clearMetrics}
          className="w-full bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200 transition-colors"
        >
          清除指標
        </button>
      </div>
      
      <div className="mt-2 text-xs text-gray-500 text-center">
        每 2 秒更新一次
      </div>
    </div>
  );
};

export default DevPerformanceMonitor;