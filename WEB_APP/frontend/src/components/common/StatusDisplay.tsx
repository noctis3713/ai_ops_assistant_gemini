// 狀態顯示組件
import React from 'react';
import { type StatusDisplayProps } from '@/types';
import { cn } from '@/utils/utils';

const StatusDisplay: React.FC<StatusDisplayProps> = ({ status }) => {
  if (!status.message || !status.type) {
    return <div className="min-h-[3rem]" />;
  }

  const statusClasses = {
    loading: 'status-loading',
    error: 'status-error',
    success: 'status-success',
    warning: 'status-warning',
  };

  return (
    <div className="min-h-[3rem]">
      <div className={cn(
        'transition-all duration-300',
        statusClasses[status.type as keyof typeof statusClasses] || 'status-loading'
      )}>
        {status.message}
      </div>
    </div>
  );
};

export default StatusDisplay;