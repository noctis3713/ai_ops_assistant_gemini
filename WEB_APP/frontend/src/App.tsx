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
import LoggerDashboard from '@/components/debug/LoggerDashboard';
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
    hideProgress,
    hideBatchProgress,
    clearStatus,
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

  // 手動清空結果 - 同時清除執行時間戳和進度條狀態
  const handleClearResults = () => {
    clearBatchResults();
    clearExecutionStartTime();
    hideProgress();
    hideBatchProgress();
    clearStatus();
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
      
      {/* 開發環境日誌監控面板 */}
      <LoggerDashboard />
    </div>
  );
}

export default App;
