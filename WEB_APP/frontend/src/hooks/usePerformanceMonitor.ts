/**
 * 效能監控 React Hook
 * 提供組件級別的效能監控功能
 */
import { useEffect, useRef, useState } from 'react';
import { performanceMonitor } from '@/utils/performanceMonitor';

/**
 * 組件渲染效能監控 Hook
 */
export const useRenderPerformance = (componentName: string, props?: Record<string, unknown>) => {
  const renderCountRef = useRef(0);
  const renderStartTimeRef = useRef(0);

  useEffect(() => {
    renderStartTimeRef.current = performance.now();
  });

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTimeRef.current;
    renderCountRef.current += 1;

    performanceMonitor.recordComponentRender(
      componentName,
      renderDuration,
      renderCountRef.current,
      props
    );
  });

  return {
    renderCount: renderCountRef.current
  };
};

/**
 * API 調用效能監控 Hook
 */
export const useAPIPerformance = () => {
  const trackAPICall = <T = unknown>(
    url: string,
    method: string,
    promise: Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();

    return promise
      .then((response) => {
        const duration = performance.now() - startTime;
        // 安全地檢查回應是否有 data 屬性
        let responseSize = 0;
        let status = 200;
        
        if (response && typeof response === 'object') {
          const responseObj = response as Record<string, unknown>;
          if ('data' in responseObj && responseObj.data) {
            responseSize = JSON.stringify(responseObj.data).length;
          }
          if ('status' in responseObj && typeof responseObj.status === 'number') {
            status = responseObj.status;
          }
        }
        
        performanceMonitor.recordAPICall(
          url,
          method,
          duration,
          status,
          responseSize
        );

        return response;
      })
      .catch((error) => {
        const duration = performance.now() - startTime;
        let status = 0;
        
        if (error && typeof error === 'object' && error !== null) {
          const errorObj = error as Record<string, unknown>;
          if ('response' in errorObj && errorObj.response && typeof errorObj.response === 'object') {
            const responseObj = errorObj.response as Record<string, unknown>;
            if ('status' in responseObj && typeof responseObj.status === 'number') {
              status = responseObj.status;
            }
          }
        }
        
        performanceMonitor.recordAPICall(
          url,
          method,
          duration,
          status
        );

        throw error;
      });
  };

  return { trackAPICall };
};

/**
 * 一般效能測量 Hook
 */
export const usePerformanceMeasure = () => {
  const measureOperation = <T>(name: string, operation: () => T, metadata?: Record<string, unknown>): T => {
    return performanceMonitor.measureFunction(name, operation, metadata);
  };

  const measureAsyncOperation = <T>(
    name: string, 
    operation: () => Promise<T>, 
    metadata?: Record<string, unknown>
  ): Promise<T> => {
    return performanceMonitor.measureAsyncFunction(name, operation, metadata);
  };

  return {
    measureOperation,
    measureAsyncOperation
  };
};

/**
 * 效能統計 Hook
 */
export const usePerformanceStats = (refreshInterval: number = 5000) => {
  const [stats, setStats] = useState(() => performanceMonitor.getPerformanceStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(performanceMonitor.getPerformanceStats());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getDetailedReport = () => performanceMonitor.getDetailedReport();
  const clearMetrics = () => {
    performanceMonitor.clearMetrics();
    setStats(performanceMonitor.getPerformanceStats());
  };

  return {
    stats,
    getDetailedReport,
    clearMetrics
  };
};