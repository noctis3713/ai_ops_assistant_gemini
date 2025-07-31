/**
 * 簡化的進度指示器組件
 * 顯示基本的執行進度
 */
import React from 'react';
import { type ProgressIndicatorProps } from '@/types';

const ProgressBar: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  // 如果進度不可見，不渲染組件
  if (!progress.isVisible) {
    return null;
  }

  // 判斷進度條是否應該顯示動畫
  const isActive = progress.percentage > 0 && progress.percentage < 100;

  return (
    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      {/* 簡化的進度條 */}
      <div className="progress-bar">
        <div 
          className={`progress-fill ${isActive ? 'active' : ''}`}
          style={{ width: `${Math.min(progress.percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;