/**
 * 前端效能監控工具
 * 提供組件渲染效能、API 請求效能、用戶互動效能的監控
 */

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

interface ComponentRenderMetric extends PerformanceMetric {
  componentName: string;
  renderCount: number;
  props?: Record<string, unknown>;
}

interface APIMetric extends PerformanceMetric {
  url: string;
  method: string;
  status?: number;
  responseSize?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private renderMetrics: ComponentRenderMetric[] = [];
  private apiMetrics: APIMetric[] = [];
  private maxMetrics = 100; // 最多保留 100 個指標

  /**
   * 開始效能測量
   */
  startTiming(name: string, metadata?: Record<string, unknown>): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metric: PerformanceMetric = {
      name: id,
      startTime: performance.now(),
      metadata
    };
    
    this.metrics.push(metric);
    this.limitMetrics();
    
    return id;
  }

  /**
   * 結束效能測量
   */
  endTiming(id: string): number | null {
    const metric = this.metrics.find(m => m.name === id);
    if (!metric) return null;

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // 如果效能較差（超過 100ms），記錄警告
    if (metric.duration > 100) {
      console.warn(`Performance Warning: ${id} took ${metric.duration.toFixed(2)}ms`, metric.metadata);
    }

    return metric.duration;
  }

  /**
   * 測量函數執行效能
   */
  measureFunction<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const id = this.startTiming(name, metadata);
    try {
      const result = fn();
      this.endTiming(id);
      return result;
    } catch (error) {
      this.endTiming(id);
      throw error;
    }
  }

  /**
   * 測量異步函數效能
   */
  async measureAsyncFunction<T>(
    name: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const id = this.startTiming(name, metadata);
    try {
      const result = await fn();
      this.endTiming(id);
      return result;
    } catch (error) {
      this.endTiming(id);
      throw error;
    }
  }

  /**
   * 記錄組件渲染效能
   */
  recordComponentRender(
    componentName: string, 
    renderTime: number, 
    renderCount: number,
    props?: Record<string, unknown>
  ): void {
    const metric: ComponentRenderMetric = {
      name: `render_${componentName}`,
      componentName,
      startTime: performance.now() - renderTime,
      endTime: performance.now(),
      duration: renderTime,
      renderCount,
      props
    };

    this.renderMetrics.push(metric);
    this.limitRenderMetrics();

    // 如果渲染時間過長，記錄警告
    if (renderTime > 16) { // 60fps = 16.67ms per frame
      console.warn(`Render Performance Warning: ${componentName} took ${renderTime.toFixed(2)}ms to render`);
    }
  }

  /**
   * 記錄 API 請求效能
   */
  recordAPICall(
    url: string,
    method: string,
    duration: number,
    status?: number,
    responseSize?: number
  ): void {
    const metric: APIMetric = {
      name: `api_${method}_${url}`,
      url,
      method,
      startTime: performance.now() - duration,
      endTime: performance.now(),
      duration,
      status,
      responseSize
    };

    this.apiMetrics.push(metric);
    this.limitAPIMetrics();

    // 如果 API 請求時間過長，記錄警告
    if (duration > 5000) { // 5 秒
      console.warn(`API Performance Warning: ${method} ${url} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * 獲取效能統計
   */
  getPerformanceStats() {
    return {
      totalMetrics: this.metrics.length,
      renderMetrics: this.renderMetrics.length,
      apiMetrics: this.apiMetrics.length,
      averageRenderTime: this.calculateAverageRenderTime(),
      averageAPITime: this.calculateAverageAPITime(),
      slowComponents: this.getSlowComponents(),
      slowAPIs: this.getSlowAPIs()
    };
  }

  /**
   * 獲取詳細效能報告
   */
  getDetailedReport() {
    return {
      general: this.metrics.slice(-20), // 最近 20 個通用指標
      renders: this.renderMetrics.slice(-20), // 最近 20 個渲染指標
      apis: this.apiMetrics.slice(-20), // 最近 20 個 API 指標
      stats: this.getPerformanceStats()
    };
  }

  /**
   * 清除所有效能指標
   */
  clearMetrics(): void {
    this.metrics = [];
    this.renderMetrics = [];
    this.apiMetrics = [];
  }

  // 私有方法
  private limitMetrics(): void {
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private limitRenderMetrics(): void {
    if (this.renderMetrics.length > this.maxMetrics) {
      this.renderMetrics = this.renderMetrics.slice(-this.maxMetrics);
    }
  }

  private limitAPIMetrics(): void {
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics);
    }
  }

  private calculateAverageRenderTime(): number {
    if (this.renderMetrics.length === 0) return 0;
    const total = this.renderMetrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    return total / this.renderMetrics.length;
  }

  private calculateAverageAPITime(): number {
    if (this.apiMetrics.length === 0) return 0;
    const total = this.apiMetrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    return total / this.apiMetrics.length;
  }

  private getSlowComponents(): ComponentRenderMetric[] {
    return this.renderMetrics
      .filter(metric => (metric.duration || 0) > 16)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);
  }

  private getSlowAPIs(): APIMetric[] {
    return this.apiMetrics
      .filter(metric => (metric.duration || 0) > 1000)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);
  }
}

// 創建全域效能監控實例
export const performanceMonitor = new PerformanceMonitor();

// 瀏覽器開發者工具整合
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).performanceMonitor = performanceMonitor;
}