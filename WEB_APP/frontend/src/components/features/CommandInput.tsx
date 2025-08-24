/**
 * 指令輸入組件
 * 提供指令/問題輸入和執行功能
 */
import React, { useCallback, useMemo } from 'react';
import { type CommandInputProps } from '@/types';
import { DEFAULT_TEXT, ELEMENT_IDS, QUICK_COMMANDS, AI_QUICK_COMMANDS } from '@/config';
import Button from '@/components/common/Button';
import CompactProgressBar from '@/components/common/CompactProgressBar';
import QuickCommandButton from './QuickCommandButton';

const CommandInput: React.FC<CommandInputProps> = ({
  value,
  onChange,
  mode,
  onExecute,
  isExecuting,
  placeholder,
  progress,
  status,
  currentTask,
  taskPollingActive,
}) => {
  // 處理 Enter 鍵執行 - 接受 ESLint 依賴建議
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isExecuting) {
      onExecute();
    }
  }, [isExecuting, onExecute]); // 保持 isExecuting 依賴以符合 ESLint 規則

  // 獲取輸入標籤文字
  const inputLabel = useMemo(() => 
    DEFAULT_TEXT.INPUT_LABEL[mode.toUpperCase() as keyof typeof DEFAULT_TEXT.INPUT_LABEL], 
    [mode]
  );
  
  // 獲取輸入佔位符
  const inputPlaceholder = useMemo(() => placeholder || 
    DEFAULT_TEXT.INPUT_PLACEHOLDER[mode.toUpperCase() as keyof typeof DEFAULT_TEXT.INPUT_PLACEHOLDER], 
    [mode, placeholder]
  );
  
  // 獲取按鈕文字
  const buttonText = useMemo(() => isExecuting 
    ? DEFAULT_TEXT.BUTTON_TEXT[`${mode.toUpperCase()}_EXECUTING` as keyof typeof DEFAULT_TEXT.BUTTON_TEXT]
    : DEFAULT_TEXT.BUTTON_TEXT[mode.toUpperCase() as keyof typeof DEFAULT_TEXT.BUTTON_TEXT], 
    [mode, isExecuting]
  );

  // 清空輸入處理器 - 穩定的回調優化版本
  const handleClearInput = useCallback(() => {
    onChange('');
  }, [onChange]);

  // 快速命令列表 - 根據模式選擇
  const quickCommands = useMemo(() => 
    mode === 'command' ? QUICK_COMMANDS : AI_QUICK_COMMANDS, 
    [mode]
  );

  return (
    <>
      <div className="mb-6">
        <label 
          htmlFor={ELEMENT_IDS.COMMAND_INPUT} 
          className="label-primary"
        >
          {inputLabel}
        </label>
        <div className="relative">
          <input
            type="text"
            id={ELEMENT_IDS.COMMAND_INPUT}
            className="form-input pr-10"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={inputPlaceholder}
            disabled={isExecuting}
            autoComplete="off"
          />
          {value && (
            <button
              onClick={handleClearInput}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800 cursor-pointer z-10"
              type="button"
              disabled={isExecuting}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* 指令快選 - 根據模式顯示對應的指令集合 */}
        {(mode === 'command' || mode === 'ai') && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs font-medium text-terminal-text-secondary">指令快選：</span>
            {quickCommands.map((cmd) => (
              <QuickCommandButton
                key={cmd.id}
                command={cmd}
                isSelected={value === cmd.command}
                disabled={isExecuting}
                onClick={onChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* 任務狀態顯示 */}
      {currentTask && (
        <div className="mb-2 flex items-center space-x-2">
          <div className="text-xs text-terminal-text-secondary font-mono">
            任務：{currentTask.task_id}
          </div>
          {taskPollingActive && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-terminal-primary rounded-full animate-pulse"></div>
              <span className="text-xs text-terminal-text-secondary">輪詢中</span>
            </div>
          )}
        </div>
      )}

      {/* 執行按鈕 */}
      <div className="mb-3">
        <Button 
          onClick={onExecute}
          disabled={isExecuting}
          isLoading={isExecuting}
        >
          {buttonText}
        </Button>
      </div>
        
      {/* 進度條 */}
      {(progress?.isVisible || status?.message) && (
        <div className="mb-0">
          <CompactProgressBar 
            progress={progress || { 
              isVisible: false, 
              totalDevices: 0, 
              completedDevices: 0,
              currentStage: undefined,
              stageMessage: undefined
            }} 
            status={status} 
          />
        </div>
      )}
    </>
  );
};

// 自定義比較函數 - 只在關鍵 props 改變時重新渲染
const areEqual = (
  prevProps: CommandInputProps, 
  nextProps: CommandInputProps
): boolean => {
  // 檢查基本狀態
  if (
    prevProps.value !== nextProps.value ||
    prevProps.mode !== nextProps.mode ||
    prevProps.isExecuting !== nextProps.isExecuting ||
    prevProps.placeholder !== nextProps.placeholder ||
    prevProps.isAsyncMode !== nextProps.isAsyncMode ||
    prevProps.taskPollingActive !== nextProps.taskPollingActive
  ) {
    return false;
  }

  // 檢查進度物件（深度比較關鍵屬性）
  const prevProgress = prevProps.progress;
  const nextProgress = nextProps.progress;
  
  if (prevProgress?.isVisible !== nextProgress?.isVisible ||
      prevProgress?.totalDevices !== nextProgress?.totalDevices ||
      prevProgress?.completedDevices !== nextProgress?.completedDevices ||
      prevProgress?.currentStage !== nextProgress?.currentStage ||
      prevProgress?.stageMessage !== nextProgress?.stageMessage) {
    return false;
  }

  // 檢查狀態物件
  const prevStatus = prevProps.status;
  const nextStatus = nextProps.status;
  
  if (prevStatus?.message !== nextStatus?.message ||
      prevStatus?.type !== nextStatus?.type) {
    return false;
  }

  // 檢查當前任務物件
  const prevTask = prevProps.currentTask;
  const nextTask = nextProps.currentTask;
  
  if (prevTask?.task_id !== nextTask?.task_id ||
      prevTask?.status !== nextTask?.status) {
    return false;
  }

  // 函數引用比較（通常這些是穩定的）
  if (
    prevProps.onChange !== nextProps.onChange ||
    prevProps.onExecute !== nextProps.onExecute ||
    prevProps.onToggleAsyncMode !== nextProps.onToggleAsyncMode ||
    prevProps.onCancelTask !== nextProps.onCancelTask
  ) {
    return false;
  }

  return true;
};

export default React.memo(CommandInput, areEqual);