/**
 * 執行模式選擇組件
 * 支援在指令執行和 AI 問答模式間切換
 * ✨ v2.5.2 新增動態功能開關支援
 */
import React, { useState, useEffect } from 'react';
import { type ModeSelectorProps } from '@/types';
import { EXECUTION_MODE } from '@/constants';
import { getBackendConfig } from '@/api/services';
import { logError } from '@/utils/SimpleLogger';

// 模式選項配置
const MODE_OPTIONS = [
  { value: EXECUTION_MODE.COMMAND, label: '設備指令', icon: '🔧' },
  { value: EXECUTION_MODE.AI, label: '詢問AI', icon: '🤖' },
] as const;

const ModeSelector: React.FC<ModeSelectorProps> = ({
  mode,
  onModeChange,
}) => {
  // ✨ v2.5.2 新增：AI 功能開關狀態管理
  const [isAiQueryEnabled, setIsAiQueryEnabled] = useState<boolean>(true);
  const [configLoading, setConfigLoading] = useState<boolean>(true);

  // 組件掛載時獲取後端配置
  useEffect(() => {
    const fetchBackendConfig = async () => {
      try {
        const config = await getBackendConfig();
        setIsAiQueryEnabled(config.ai?.enableAiQuery ?? true);
      } catch (error) {
        logError('獲取後端配置失敗，AI 功能將預設禁用以確保安全', { error });
        // 設定失敗時預設為禁用，確保安全性
        setIsAiQueryEnabled(false);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchBackendConfig();
  }, []);

  // 當 AI 功能被停用時，自動切換到指令模式
  useEffect(() => {
    if (!configLoading && !isAiQueryEnabled && mode === EXECUTION_MODE.AI) {
      onModeChange(EXECUTION_MODE.COMMAND);
    }
  }, [isAiQueryEnabled, configLoading, mode, onModeChange]);

  return (
    <div className="flex space-x-1 bg-gray-100 rounded-lg">
      {MODE_OPTIONS.map(({ value, label, icon }) => {
        // AI 模式的特殊處理
        const isAiMode = value === EXECUTION_MODE.AI;
        const isDisabled = isAiMode && !isAiQueryEnabled;
        const isLoading = configLoading;

        return (
          <button
            key={value}
            onClick={() => !isDisabled && onModeChange(value)}
            disabled={isDisabled}
            title={
              isDisabled 
                ? '管理員已停用 AI 查詢功能' 
                : isLoading && isAiMode 
                  ? '正在載入配置...' 
                  : undefined
            }
            className={`
              flex items-center space-x-2 px-3 py-3 rounded-md text-sm font-medium transition-all duration-200
              ${isDisabled
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                : mode === value
                  ? 'bg-terminal-bg-card text-blue-600 ring-1 ring-blue-200 mode-button-glow'
                  : 'text-terminal-text-secondary hover:text-terminal-text-primary hover:bg-gray-50'
              }
              ${isLoading && isAiMode ? 'animate-pulse' : ''}
            `}
          >
            <span className="text-base">{isLoading && isAiMode ? '⏳' : icon}</span>
            <span>{isLoading && isAiMode ? '載入中...' : label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(ModeSelector);