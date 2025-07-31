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
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-terminal-text-muted hover:text-terminal-text-secondary"
              type="button"
              disabled={isExecuting}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      <div className="mb-0 flex items-center">
        <Button 
          onClick={onExecute}
          disabled={isExecuting}
          isLoading={isExecuting}
        >
          {buttonText}
        </Button>
        {(progress || status) && <CompactProgressBar progress={progress || { isVisible: false, totalDevices: 0, completedDevices: 0 }} status={status} />}
      </div>
    </>
  );
};

export default CommandInput;