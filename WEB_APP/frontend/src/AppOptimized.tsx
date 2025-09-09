/**
 * 優化版主應用組件
 * 
 * 使用 Suspense 與細粒度狀態管理提升效能
 */

import { Suspense, useEffect, useTransition, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDevices } from '@/api';
import { useAppStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';

// 容器組件 - 細粒度狀態訂閱
import { 
  CommandInputContainer,
  DeviceSelectorContainer,
  BatchOutputContainer 
} from '@/components/containers';

// 佈局組件 - 直接導入（重要且輕量）
import { Header, Footer } from '@/components';

// 載入骨架
import {
  DeviceSelectionSkeleton,
  CommandInputSkeleton,
  BatchOutputSkeleton
} from '@/components/common/LoadingSkeletons';

// 懶載入次要功能組件
const MultiDeviceSelector = lazy(() => 
  import('@/components/features/MultiDeviceSelector')
);
const DeviceGroupSelector = lazy(() => 
  import('@/components/features/DeviceGroupSelector')
);

// 自定義 hooks
import { useKeyboardShortcuts, useAsyncTasks } from '@/hooks';
import { useSmartPreload } from '@/hooks/useSmartPreload';

function AppOptimized() {
  // 導航狀態管理
  useTransition();

  // 全局狀態訂閱
  const showMultiDevice = useAppStore.use.showMultiDevice?.() ?? false;
  const showGroupSelector = useAppStore.use.showGroupSelector?.() ?? false;
  
  // 批次獲取執行狀態（使用 useShallow）
  const executionState = useAppStore(
    useShallow(state => ({
      isExecuting: state.isExecuting,
      hasResults: state.batchResults?.length > 0,
      taskPollingActive: state.taskPollingActive
    }))
  );

  // 設備資料查詢
  const { 
    data: devices = [], 
    error: devicesError 
  } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (apiData) => {
      if (!Array.isArray(apiData)) return [];
      return apiData.map(device => ({
        ip: device.ip,
        name: device.name,
        model: device.device_type || 'unknown',
        description: device.location || ''
      }));
    }
  });

  // 非同步任務
  useAsyncTasks();

  // 鍵盤快捷鍵
  useKeyboardShortcuts();

  // 智慧預載入
  useSmartPreload();

  // 預載入多設備選擇器（當有多個設備時）
  useEffect(() => {
    if (devices.length > 3) {
      // 動態導入，但不立即使用
      import('@/components/features/MultiDeviceSelector');
    }
  }, [devices.length]);

  // 錯誤邊界後備
  if (devicesError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-red-500 mb-4">載入設備資料失敗</h2>
          <p className="text-muted-foreground">{devicesError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - 立即顯示 */}
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* 第一層 Suspense：核心功能 */}
        <Suspense fallback={<MainContentSkeleton />}>
          <div className="space-y-6">
            {/* 命令輸入區域 - 優先載入 */}
            <section className="command-section">
              <Suspense fallback={<CommandInputSkeleton />}>
                <CommandInputContainer />
              </Suspense>
            </section>

            {/* 設備選擇區域 - 第二優先級 */}
            <section className="device-section">
              <Suspense fallback={<DeviceSelectionSkeleton />}>
                <DeviceSelectorContainer />
                
                {/* 巢狀 Suspense：次要功能 */}
                {showMultiDevice && (
                  <Suspense fallback={<div className="h-20 animate-pulse bg-muted rounded" />}>
                    <MultiDeviceSelector devices={devices} />
                  </Suspense>
                )}
                
                {showGroupSelector && (
                  <Suspense fallback={<div className="h-16 animate-pulse bg-muted rounded" />}>
                    <DeviceGroupSelector />
                  </Suspense>
                )}
              </Suspense>
            </section>

            {/* 輸出顯示區域 - 條件渲染 */}
            {executionState.hasResults && (
              <section className="output-section">
                <Suspense fallback={<BatchOutputSkeleton />}>
                  <BatchOutputContainer />
                </Suspense>
              </section>
            )}

            {/* 執行狀態指示器 */}
            {executionState.isExecuting && (
              <div className="fixed bottom-4 right-4 z-50">
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>執行中...</span>
                </div>
              </div>
            )}
          </div>
        </Suspense>
      </main>

      {/* Footer - 低優先級 */}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>

      {/* 開發工具 - 最低優先級 */}
      {process.env.NODE_ENV === 'development' && (
        <Suspense fallback={null}>
          <DevTools />
        </Suspense>
      )}
    </div>
  );
}

// 主要內容載入骨架
const MainContentSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-32 bg-muted rounded-lg" />
    <div className="h-48 bg-muted rounded-lg" />
    <div className="h-64 bg-muted rounded-lg" />
  </div>
);

// 開發工具懶載入
const DevTools = lazy(() => import('@/components/DevToolsLazy'));

export default AppOptimized;