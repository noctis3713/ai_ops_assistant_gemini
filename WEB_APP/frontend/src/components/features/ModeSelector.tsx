/**
 * 執行模式選擇組件
 * 支援在指令執行和 AI 問答模式間切換
 */
import React from 'react';
import { type ModeSelectorProps } from '@/types';
import { EXECUTION_MODE } from '@/constants';

// 模式選項配置
const MODE_OPTIONS = [
  { value: EXECUTION_MODE.COMMAND, label: '設備指令', icon: '🔧' },
  { value: EXECUTION_MODE.AI, label: '詢問AI', icon: '🤖' },
] as const;

const ModeSelector: React.FC<ModeSelectorProps> = ({
  mode,
  onModeChange,
}) => {
  return (
    <div className="flex space-x-1 bg-gray-100 rounded-lg">
      {MODE_OPTIONS.map(({ value, label, icon }) => (
        <button
          key={value}
          onClick={() => onModeChange(value)}
          className={`
            flex items-center space-x-2 px-3 py-3 rounded-md text-sm font-medium transition-all duration-200
            ${mode === value
              ? 'bg-terminal-bg-card text-blue-600 ring-1 ring-blue-200 mode-button-glow'
              : 'text-terminal-text-secondary hover:text-terminal-text-primary hover:bg-gray-50'
            }
          `}
        >
          <span className="text-base">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default ModeSelector;