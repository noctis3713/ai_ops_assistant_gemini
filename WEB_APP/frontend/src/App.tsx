// 主要應用程式組件
import { useAppStore } from '@/store';
import { 
  useDevices, 
  useBatchExecution,
  useKeyboardShortcuts,
  useAsyncTasks
} from '@/hooks';
import {
  Header,
  Footer,
  DeviceSelectionContainer,
  CommandInput,
  BatchOutputDisplay,
} from '@/components';
import { DEFAULT_TEXT } from '@/constants';

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
    setIsAsyncMode,
  } = useAppStore();

  // API Hooks
  const { data: devices = [], isLoading: devicesLoading } = useDevices();
  const { executeBatch, isBatchExecuting } = useBatchExecution();
  const { 
    executeAsyncAndWait, 
    cancelCurrentTask, 
    isExecuting: isAsyncExecuting, 
    isPolling 
  } = useAsyncTasks();

  // 統一執行邏輯 - 支援同步和非同步模式
  const handleExecute = async () => {
    if (selectedDevices.length === 0) return;

    if (isAsyncMode) {
      // 非同步模式執行
      try {
        await executeAsyncAndWait({
          devices: selectedDevices,
          command: inputValue,
          mode: mode === 'ai' ? 'ai' : 'command',
        });
      } catch (error) {
        console.error('非同步執行失敗:', error);
      }
    } else {
      // 同步模式執行
      executeBatch(selectedDevices, inputValue);
    }
  };

  // 手動清空結果 - 同時清除執行時間戳
  const handleClearResults = () => {
    clearBatchResults();
    clearExecutionStartTime();
  };

  // 鍵盤快捷鍵
  useKeyboardShortcuts({
    onExecute: handleExecute,
    isExecuting: isBatchExecuting,
  });

  // 檢查當前執行狀態
  const currentlyExecuting = isAsyncMode ? (isAsyncExecuting || isPolling) : isBatchExecuting;

  // 判斷當前狀態的輔助函數
  const getCurrentStatus = () => {
    if (batchResults.length > 0) {
      return 'has_results';
    }
    if (selectedDevices.length === 0) {
      return 'select_device';
    }
    if (inputValue.trim() === '') {
      return 'input_command';
    }
    return 'waiting_result';
  };

  // 獲取狀態提示文字
  const getStatusText = () => {
    const status = getCurrentStatus();
    switch (status) {
      case 'select_device':
        return DEFAULT_TEXT.RESULT_STATUS.SELECT_DEVICE;
      case 'input_command':
        return DEFAULT_TEXT.RESULT_STATUS.INPUT_COMMAND;
      case 'waiting_result':
        return DEFAULT_TEXT.RESULT_STATUS.WAITING_RESULT;
      default:
        return '';
    }
  };

  // 獲取狀態提示的CSS類別
  const getStatusClassName = () => {
    const status = getCurrentStatus();
    switch (status) {
      case 'select_device':
      case 'input_command':
      case 'waiting_result':
        return 'status-hint status-hint-flash';
      default:
        return 'status-hint';
    }
  };


  return (
    <div className="min-h-screen bg-terminal-bg">
      <div className="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
        <Header />

        <main className="flex-1 flex flex-col space-y-4">
          {/* 輸入區域 */}
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

              {/* 執行模式切換器 */}
              <div className="border-t border-terminal-bg-secondary pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-terminal-text-primary">執行模式：</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setIsAsyncMode(false)}
                        disabled={currentlyExecuting}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                          !isAsyncMode
                            ? 'bg-terminal-primary text-white shadow-sm'
                            : 'bg-terminal-bg-secondary text-terminal-text-secondary hover:bg-gray-200'
                        } ${currentlyExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        同步執行
                      </button>
                      <button
                        onClick={() => setIsAsyncMode(true)}
                        disabled={currentlyExecuting}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                          isAsyncMode
                            ? 'bg-terminal-primary text-white shadow-sm'
                            : 'bg-terminal-bg-secondary text-terminal-text-secondary hover:bg-gray-200'
                        } ${currentlyExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        非同步執行
                      </button>
                    </div>
                  </div>
                  
                  {/* 任務狀態顯示 */}
                  {isAsyncMode && (
                    <div className="flex items-center space-x-3">
                      {currentTask && (
                        <div className="text-xs text-terminal-text-secondary">
                          任務：{currentTask.task_id.substring(0, 8)}...
                        </div>
                      )}
                      {taskPollingActive && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-terminal-primary rounded-full animate-pulse"></div>
                          <span className="text-xs text-terminal-text-secondary">輪詢中</span>
                        </div>
                      )}
                      {currentTask && currentTask.status === 'running' && (
                        <button
                          onClick={() => cancelCurrentTask()}
                          className="px-2 py-1 text-xs font-medium text-terminal-error hover:bg-terminal-error-light rounded transition-colors"
                        >
                          取消任務
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 模式說明 */}
                <div className="mt-2 text-xs text-terminal-text-muted">
                  {isAsyncMode ? (
                    <>
                      <span className="font-medium">非同步模式</span>：
                      適用於長時間執行的批次操作，避免 HTTP 超時問題，支援真實進度追蹤和任務取消
                    </>
                  ) : (
                    <>
                      <span className="font-medium">同步模式</span>：
                      傳統執行模式，適用於快速操作，操作完成後立即回傳結果
                    </>
                  )}
                </div>
              </div>

              <CommandInput
                value={inputValue}
                onChange={setInputValue}
                mode={mode}
                onExecute={handleExecute}
                isExecuting={currentlyExecuting}
                progress={batchProgress}
                status={status}
              />
            </div>
          </section>


          {/* 輸出區域 */}
          <section className="flex-1 flex flex-col min-h-0">
            <BatchOutputDisplay
              results={batchResults}
              onClear={handleClearResults}
              statusText={getStatusText()}
              statusClassName={getStatusClassName()}
            />
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default App;
