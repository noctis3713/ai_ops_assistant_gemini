/**
 * 指令輸入組件
 * 提供指令/問題輸入和執行功能
 */
import React from 'react';
import { type CommandInputProps } from '@/types';
import { DEFAULT_TEXT, ELEMENT_IDS, QUICK_COMMANDS, AI_QUICK_COMMANDS } from '@/constants';
import Button from '@/components/common/Button';
import CompactProgressBar from '@/components/common/CompactProgressBar';

const CommandInput: React.FC<CommandInputProps> = ({
  value,
  onChange,
  mode,
  onExecute,
  isExecuting,
  placeholder,
  progress,
  status,
  isAsyncMode,
  onToggleAsyncMode,
  currentTask,
  onCancelTask,
  taskPollingActive,
}) => {
  // 處理 Enter 鍵執行
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isExecuting) {
      onExecute();
    }
  };

  // 獲取輸入標籤文字
  const inputLabel = DEFAULT_TEXT.INPUT_LABEL[mode.toUpperCase() as keyof typeof DEFAULT_TEXT.INPUT_LABEL];
  
  // 獲取輸入佔位符
  const inputPlaceholder = placeholder || 
    DEFAULT_TEXT.INPUT_PLACEHOLDER[mode.toUpperCase() as keyof typeof DEFAULT_TEXT.INPUT_PLACEHOLDER];
  
  // 獲取按鈕文字
  const buttonText = isExecuting 
    ? DEFAULT_TEXT.BUTTON_TEXT[`${mode.toUpperCase()}_EXECUTING` as keyof typeof DEFAULT_TEXT.BUTTON_TEXT]
    : DEFAULT_TEXT.BUTTON_TEXT[mode.toUpperCase() as keyof typeof DEFAULT_TEXT.BUTTON_TEXT];

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
              onClick={() => onChange('')}
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
            {(mode === 'command' ? QUICK_COMMANDS : AI_QUICK_COMMANDS).map((cmd) => {
              const isSelected = value === cmd.command;
              return (
                <button
                  key={cmd.id}
                  onClick={() => onChange(cmd.command)}
                  disabled={isExecuting}
                  className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected 
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {cmd.shortcut}
                  <span className={`ml-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                    ({cmd.description})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 第一行：非同步執行按鈕和任務狀態 */}
      <div className="mb-2 flex items-center space-x-3">
        {/* 非同步執行按鈕 */}
        <button
          onClick={() => onToggleAsyncMode?.(!isAsyncMode)}
          disabled={isExecuting}
          className={`px-5 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
            isAsyncMode
              ? 'bg-blue-100 text-blue-800 shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          非同步執行
        </button>

        {/* 任務狀態顯示 */}
        {isAsyncMode && currentTask && (
          <div className="flex items-center space-x-2">
            <div className="text-xs text-terminal-text-secondary">
              任務：{currentTask.task_id.substring(0, 8)}...
            </div>
            {taskPollingActive && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-terminal-primary rounded-full animate-pulse"></div>
                <span className="text-xs text-terminal-text-secondary">輪詢中</span>
              </div>
            )}
            {currentTask.status === 'running' && onCancelTask && (
              <button
                onClick={onCancelTask}
                className="px-2 py-1 text-xs font-medium text-terminal-error hover:bg-terminal-error-light rounded transition-colors"
              >
                取消執行
              </button>
            )}
          </div>
        )}
      </div>

      {/* 第二行：執行按鈕和進度條 */}
      <div className="mb-0 flex items-center space-x-3">
        {/* 執行按鈕 */}
        <Button 
          onClick={onExecute}
          disabled={isExecuting}
          isLoading={isExecuting}
        >
          {buttonText}
        </Button>
        
        {/* 進度條 */}
        {(progress || status) && <CompactProgressBar progress={progress || { isVisible: false, totalDevices: 0, completedDevices: 0 }} status={status} />}
      </div>
    </>
  );
};

export default CommandInput;