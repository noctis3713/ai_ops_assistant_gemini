// 主要應用程式組件

// React 
import { useCallback, useMemo, lazy, Suspense } from 'react';

// 本地導入
import { useAppStore } from '@/store';
import { 
  useDevices, 
  useBatchExecution,
  useKeyboardShortcuts,
  useAsyncTasks,
  usePrefetchCoreData,
  useBackgroundRefresh
} from '@/hooks';
import { useAppStatus } from '@/hooks/useAppStatus';
import {
  Header,
  Footer,
  DeviceSelectionContainer,
  CommandInput,
  ErrorBoundary,
} from '@/components';
import { SplashCursor } from '@/components/ui/splash-cursor';
import { ERROR_STYLES } from '@/constants';

// 懒载入组件 - 減少初始 bundle 大小
const BatchOutputDisplay = lazy(() => import('@/components/features/BatchOutputDisplay'));

function App() {
  // 全域狀態
  const {
    mode,
    selectedDevices,
    inputValue,
    status,
    batchProgress,
    batchResults,
    isAsyncMode,
    currentTask,
    taskPollingActive,
    setMode,
    setSelectedDevices,
    setInputValue,
    clearBatchResults,
    clearExecutionStartTime,
    hideProgress,
    hideBatchProgress,
    clearStatus,
    setIsAsyncMode,
  } = useAppStore();

  // API Hooks
  const { data: devices = [], isLoading: devicesLoading, error: devicesError } = useDevices();
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

  // 統一執行邏輯 - 支援同步和非同步模式 (使用 useCallback 避免重新創建)
  const handleExecute = useCallback(async () => {
    if (selectedDevices.length === 0) return;

    if (isAsyncMode) {
      // 非同步模式執行
      try {
        await executeAsyncAndWait({
          devices: selectedDevices,
          command: inputValue,
          mode: mode === 'ai' ? 'ai' : 'command',
        });
      } catch {
        // 非同步執行錯誤由 executeAsyncAndWait 內部處理
      }
    } else {
      // 同步模式執行
      executeBatch(selectedDevices, inputValue);
    }
  }, [selectedDevices, isAsyncMode, executeAsyncAndWait, inputValue, mode, executeBatch]);


  // 手動清空結果 - 同時清除執行時間戳和進度條狀態 (使用 useCallback 避免重新創建)
  const handleClearResults = useCallback(() => {
    clearBatchResults();
    clearExecutionStartTime();
    hideProgress();
    hideBatchProgress();
    clearStatus();
  }, [clearBatchResults, clearExecutionStartTime, hideProgress, hideBatchProgress, clearStatus]);

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


  return (
    <div className="min-h-screen bg-terminal-bg">
      <SplashCursor 
        BACK_COLOR={{ r: 0.1, g: 0.2, b: 0.4 }}
        TRANSPARENT={true}
        SPLAT_FORCE={3000}
        COLOR_UPDATE_SPEED={5}
        DENSITY_DISSIPATION={2.5}
        VELOCITY_DISSIPATION={1.5}
      />
      <div className="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
        <ErrorBoundary fallback={
          <div className={`text-center py-4 ${ERROR_STYLES.CONTAINER_ROUNDED}`}>
            <p className="text-red-700">標題載入失敗，請重新載入頁面</p>
          </div>
        }>
          <Header />
        </ErrorBoundary>

        <main className="flex-1 flex flex-col space-y-4">
          {/* 輸入區域 */}
          <ErrorBoundary 
            fallback={
              <div className="card">
                <div className="card-body text-center py-8">
                  <div className="text-red-600 mb-2">
                    <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">設備選擇功能發生錯誤</h3>
                  <p className="text-gray-600 mb-4">無法載入設備選擇介面，這可能是由於網路問題或後端服務異常</p>
                  <button 
                    onClick={handleReload} 
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    重新載入頁面
                  </button>
                </div>
              </div>
            }
            resetKeys={[devices.length, selectedDevices.length]}
            resetOnPropsChange={true}
          >
            <section className="card">
              <div className="card-body space-y-6">
                <DeviceSelectionContainer
                  devices={devices}
                  selectedDevices={selectedDevices}
                  onDevicesChange={setSelectedDevices}
                  executionMode={mode}
                  onExecutionModeChange={setMode}
                  isLoading={devicesLoading}
                />
                
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

                <CommandInput
                  value={inputValue}
                  onChange={setInputValue}
                  mode={mode}
                  onExecute={handleExecute}
                  isExecuting={currentlyExecuting}
                  progress={batchProgress}
                  status={status}
                  isAsyncMode={isAsyncMode}
                  onToggleAsyncMode={setIsAsyncMode}
                  currentTask={currentTask}
                  onCancelTask={cancelCurrentTask}
                  taskPollingActive={taskPollingActive}
                />
              </div>
            </section>
          </ErrorBoundary>

          {/* 輸出區域 */}
          <ErrorBoundary 
            fallback={
              <div className="flex-1 flex flex-col min-h-0">
                <div className="card">
                  <div className="card-body text-center py-8">
                    <div className="text-amber-600 mb-2">
                      <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">結果顯示功能發生錯誤</h3>
                    <p className="text-gray-600 mb-4">無法顯示執行結果，但您仍可繼續執行指令</p>
                    <button 
                      onClick={handleClearResults}
                      className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 mr-2"
                    >
                      清空結果
                    </button>
                    <button 
                      onClick={handleReload} 
                      className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                    >
                      重新載入
                    </button>
                  </div>
                </div>
              </div>
            }
            resetKeys={[batchResults.length]}
            resetOnPropsChange={true}
          >
            <section className="flex-1 flex flex-col min-h-0">
              <Suspense fallback={
                <div className="card">
                  <div className="card-body text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">載入結果顯示元件...</p>
                  </div>
                </div>
              }>
                <BatchOutputDisplay
                  results={batchResults}
                  onClear={handleClearResults}
                  statusText={statusText}
                  statusClassName={statusClassName}
                />
              </Suspense>
            </section>
          </ErrorBoundary>
        </main>

        <ErrorBoundary fallback={
          <div className="text-center py-2 text-gray-500">
            <p>頁尾載入失敗</p>
          </div>
        }>
          <Footer />
        </ErrorBoundary>
      </div>
      
    </div>
  );
}

export default App;
