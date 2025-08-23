/**
 * 狀態指示器組件
 * 用於顯示操作成功或失敗狀態
 * 注意：完全保持原有 CSS 類名，確保視覺樣式不變
 */
import React from 'react';

interface StatusIndicatorProps {
  success: boolean;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  success,
  className = ''
}) => {
  // 使用原有的 CSS 類名，不做任何修改
  const statusClass = success 
    ? 'status-indicator-success' 
    : 'status-indicator-error';

  return (
    <span 
      className={`${statusClass} ${className}`.trim()}
    />
  );
};

export default StatusIndicator;