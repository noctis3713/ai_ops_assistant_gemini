// 主要應用程式組件 (React 19 優化版)

// React 
import { useCallback, useMemo, lazy, Suspense, useRef, useEffect, useTransition } from 'react';

// 本地導入
import { 
  useBatchExecution,
  useKeyboardShortcuts,
  useAsyncTasks,
  usePrefetchCoreData,
  useBackgroundRefresh,
  useComponentPrefetch,
  useStoreActions,
  useOptimizedStoreSelectors
} from '@/hooks';

// 直接導入 API 函數
import { getDevices } from '@/api';
import { useQuery } from '@tanstack/react-query';
import { useAppStatus } from '@/hooks/useAppStatus';
import {
  Header,
  Footer,
} from '@/components';
import { ErrorBoundaryProvider, initializeErrorSystem } from '@/errors';
import {
  DeviceSelectionSkeleton,
  CommandInputSkeleton,
  BatchOutputSkeleton
} from '@/components/common/LoadingSkeletons';
import { ERROR_STYLES } from '@/config';

// 懒载入组件 - 減少初始 bundle 大小
const BatchOutputDisplay = lazy(() => import('@/components/features/BatchOutputDisplay'));
const DeviceSelectionContainer = lazy(() => import('@/components/features/DeviceSelectionContainer'));
const CommandInput = lazy(() => import('@/components/features/CommandInput'));

// 進階懶載入組件 - 延遲載入大型功能組件 (預留供將來使用)
// const VirtualizedResultList = lazy(() => import('@/components/features/VirtualizedResultList'));
// const MultiDeviceSelector = lazy(() => import('@/components/features/MultiDeviceSelector'));
// const DeviceGroupSelector = lazy(() => import('@/components/features/DeviceGroupSelector'));

function App() {
  // React 19: 使用 useTransition 管理非緊急更新
  const [isPendingNavigation, startNavigationTransition] = useTransition();
  
  // 初始化錯誤處理系統
  useEffect(() => {
    initializeErrorSystem({
      enableGlobalErrorHandler: true,
      enableUnhandledRejectionHandler: true,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
    });
  }, []);
  
  // 全域狀態 - 使用優化的選擇器 hook
  const {
    mode,
    selectedDevices,
    inputValue,
    status,
    batchProgress,
    batchResults,
    isAsyncMode,
    currentTask,
    taskPollingActive
  } = useOptimizedStoreSelectors();
  
  // 使用 ref 存儲頻繁變化的值，避免函數重新創建
  const selectedDevicesRef = useRef(selectedDevices);
  const inputValueRef = useRef(inputValue);
  const modeRef = useRef(mode);
  const isAsyncModeRef = useRef(isAsyncMode);

  // 更新 ref 值
  useEffect(() => {
    selectedDevicesRef.current = selectedDevices;
  }, [selectedDevices]);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isAsyncModeRef.current = isAsyncMode;
  }, [isAsyncMode]);

  // 使用自定義 hook 獲取穩定的 store 動作引用
  const storeActions = useStoreActions();

  // 直接使用 useQuery 獲取設備資料
  const { data: devices = [], isLoading: devicesLoading, error: devicesError } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    staleTime: 5 * 60 * 1000, // 快取 5 分鐘
    gcTime: 10 * 60 * 1000,   // 10 分鐘
    // 新增 select 來處理後端 device_type, location 與前端 model, description 的不一致
    select: (apiData) => {
      if (!Array.isArray(apiData)) return [];
      return apiData.map(device => ({
        ip: device.ip,
        name: device.name,
        model: device.device_type || 'unknown',     // device_type → model
        description: device.location || ''          // location → description
      }));
    }
  });
  const { executeBatch, isBatchExecuting } = useBatchExecution();
  const { 
    executeAsyncAndWait, 
    cancelCurrentTask, 
    isExecuting: isAsyncExecuting, 
    isPolling 
  } = useAsyncTasks();

  // 統一重載處理函數 - 避免重複的重載邏輯 (使用 useCallback 避免重新創建)
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  // 統一執行邏輯 - 使用 ref 減少依賴 (useCallback 優化版)
  const handleExecute = useCallback(async () => {
    const currentSelectedDevices = selectedDevicesRef.current;
    const currentInputValue = inputValueRef.current;
    const currentMode = modeRef.current;
    const currentIsAsyncMode = isAsyncModeRef.current;

    if (currentSelectedDevices.length === 0) return;

    if (currentIsAsyncMode) {
      // 非同步模式執行
      try {
        await executeAsyncAndWait({
          devices: currentSelectedDevices,
          command: currentInputValue,
          mode: currentMode === 'ai' ? 'ai' : 'command',
        });
      } catch {
        // 非同步執行錯誤由 executeAsyncAndWait 內部處理
      }
    } else {
      // 同步模式執行
      executeBatch(currentSelectedDevices, currentInputValue);
    }
  }, [executeAsyncAndWait, executeBatch]); // 只保留穩定的函數依賴


  // 手動清空結果 - 使用 storeActions 優化版本
  const handleClearResults = useCallback(() => {
    storeActions.clearExecutionData({ results: true, status: true, timestamp: true });
    storeActions.setProgressVisibility('normal', false);
    storeActions.setProgressVisibility('batch', false);
  }, [storeActions]);

  // 鍵盤快捷鍵 (使用 useMemo 避免每次重新創建選項物件)
  const keyboardShortcutsOptions = useMemo(() => ({
    onExecute: handleExecute,
    isExecuting: isBatchExecuting,
  }), [handleExecute, isBatchExecuting]);
  
  useKeyboardShortcuts(keyboardShortcutsOptions);
  
  // 預取核心資料，提升首次載入體驗
  usePrefetchCoreData();
  
  // 背景資料重新整理（僅在有執行中任務時啟用）
  useBackgroundRefresh(isAsyncExecuting || isPolling);

  // 使用自定義 Hook 來集中處理狀態計算
  const { currentlyExecuting, statusText, statusClassName } = useAppStatus({
    isAsyncMode,
    isAsyncExecuting,
    isPolling,
    isBatchExecuting,
    batchResultsLength: batchResults.length,
    selectedDevicesLength: selectedDevices.length,
    inputValue
  });

  // 智能預載入功能
  const {
    deviceSelectionPrefetch,
    batchOutputPrefetch,
    aiQueryPrefetch
  } = useComponentPrefetch();


  return (
    <ErrorBoundaryProvider>
      <div className="min-h-screen bg-terminal-bg">
        <div className="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
          <Header />

        <main className="flex-1 flex flex-col space-y-4">
          {/* 輸入區域 */}
            <section className="card" {...deviceSelectionPrefetch}>
              <div className="card-body space-y-6">
                {/* React 19: 增強 Suspense 邀界，支援操作狀態 */}
                <Suspense 
                  fallback={
                    <div className={`${isPendingNavigation ? 'opacity-75' : ''}`}>
                      <DeviceSelectionSkeleton />
                    </div>
                  }
                >
                  <DeviceSelectionContainer
                    devices={devices}
                    selectedDevices={selectedDevices}
                    onDevicesChange={(devices) => {
                      // 非緊急更新設備選擇
                      startNavigationTransition(() => {
                        storeActions.setSelectedDevices(devices);
                      });
                    }}
                    executionMode={mode}
                    onExecutionModeChange={(mode) => {
                      // 非緊急更新模式切換
                      startNavigationTransition(() => {
                        storeActions.setMode(mode);
                      });
                    }}
                    isLoading={devicesLoading}
                  />
                </Suspense>
                
                {/* 設備載入錯誤提示 */}
                {devicesError && (
                  <div className={ERROR_STYLES.CONTAINER_ROUNDED_PADDED}>
                    <div className="flex items-start space-x-3">
                      <div className="text-red-600 mt-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800 mb-2">
                          設備 API 連線失敗
                        </h3>
                        <div className="text-sm text-red-700">
                          {devicesError.message}
                        </div>
                        <div className="mt-3">
                          <button
                            onClick={handleReload}
                            className={ERROR_STYLES.BUTTON}
                          >
                            重新載入
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* React 19: 細粒度 Suspense 邀界 */}
                <Suspense 
                  fallback={
                    <div className={`transition-opacity duration-200 ${isPendingNavigation ? 'opacity-75' : ''}`}>
                      <CommandInputSkeleton />
                    </div>
                  }
                >
                  <div {...aiQueryPrefetch}>
                    <CommandInput
                    value={inputValue}
                    onChange={storeActions.setInputValue}
                    mode={mode}
                    onExecute={handleExecute}
                    isExecuting={currentlyExecuting}
                    progress={batchProgress}
                    status={status}
                    isAsyncMode={isAsyncMode}
                    onToggleAsyncMode={storeActions.setIsAsyncMode}
                    currentTask={currentTask}
                    onCancelTask={cancelCurrentTask}
                    taskPollingActive={taskPollingActive}
                    />
                  </div>
                </Suspense>
              </div>
            </section>

          {/* 輸出區域 */}
            <section className="flex-1 flex flex-col min-h-0" {...batchOutputPrefetch}>
              {/* React 19: 優化 Suspense 邊界，支援漸進式渲染 */}
              <Suspense 
                fallback={
                  <div className="transition-all duration-300">
                    <BatchOutputSkeleton />
                    {/* 新增加載進度指示 */}
                    {isPendingNavigation && (
                      <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                        更新中...
                      </div>
                    )}
                  </div>
                }
              >
                <BatchOutputDisplay
                  results={batchResults}
                  onClear={handleClearResults}
                  statusText={statusText}
                  statusClassName={statusClassName}
                />
              </Suspense>
            </section>
        </main>

          <Footer />
        </div>
      </div>
    </ErrorBoundaryProvider>
  );
}

export default App;
