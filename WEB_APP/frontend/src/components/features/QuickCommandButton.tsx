/**
 * 快速命令按鈕組件
 * 單獨的記憶化組件，減少 CommandInput 的重新渲染
 */
import React from 'react';

interface QuickCommandButtonProps {
  /** 命令物件 */
  command: {
    id: string;
    command: string;
    shortcut: string;
    description: string;
  };
  /** 是否已選中 */
  isSelected: boolean;
  /** 是否禁用 */
  disabled: boolean;
  /** 點擊回調 */
  onClick: (command: string) => void;
}

const QuickCommandButton: React.FC<QuickCommandButtonProps> = ({
  command,
  isSelected,
  disabled,
  onClick
}) => {
  return (
    <button
      onClick={() => onClick(command.command)}
      disabled={disabled}
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full transition-colors ${
        isSelected 
          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {command.shortcut}
      <span className={`ml-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
        ({command.description})
      </span>
    </button>
  );
};

// 自定義比較函數 - 優化重新渲染
const areEqual = (
  prevProps: QuickCommandButtonProps, 
  nextProps: QuickCommandButtonProps
): boolean => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.command.id === nextProps.command.id &&
    prevProps.onClick === nextProps.onClick
  );
};

export default React.memo(QuickCommandButton, areEqual);