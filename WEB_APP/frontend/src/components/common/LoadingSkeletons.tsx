/**
 * 載入骨架屏組件
 * 提供各種功能區域的載入動畫效果
 */
import React from 'react';

/**
 * 基礎骨架屏組件
 */
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width = '100%', 
  height = '1rem',
  rounded = false 
}) => (
  <div
    className={`animate-pulse bg-gray-200 ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
    style={{ width, height }}
  />
);

/**
 * 設備選擇容器載入骨架屏
 */
export const DeviceSelectionSkeleton: React.FC = () => (
  <div className="card">
    <div className="card-body space-y-6">
      {/* 模式選擇器骨架 */}
      <div className="space-y-2">
        <Skeleton height="1.5rem" width="120px" />
        <div className="flex space-x-2">
          <Skeleton height="2.5rem" width="80px" rounded />
          <Skeleton height="2.5rem" width="80px" rounded />
        </div>
      </div>

      {/* 設備群組選擇器骨架 */}
      <div className="space-y-3">
        <Skeleton height="1.25rem" width="100px" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="2rem" rounded />
          ))}
        </div>
      </div>

      {/* 設備列表骨架 */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton height="1.25rem" width="80px" />
          <Skeleton height="1rem" width="100px" />
        </div>
        
        {/* 搜尋框骨架 */}
        <Skeleton height="2.5rem" />
        
        {/* 設備項目骨架 */}
        <div className="space-y-2 max-h-48 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-2">
              <Skeleton width="1rem" height="1rem" rounded />
              <div className="flex-1 space-y-1">
                <Skeleton height="1rem" width="60%" />
                <Skeleton height="0.75rem" width="40%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * 指令輸入區域載入骨架屏
 */
export const CommandInputSkeleton: React.FC = () => (
  <div className="space-y-4">
    {/* 輸入框骨架 */}
    <div className="space-y-2">
      <Skeleton height="1.25rem" width="120px" />
      <Skeleton height="6rem" />
    </div>

    {/* 控制按鈕骨架 */}
    <div className="flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <Skeleton width="1rem" height="1rem" rounded />
        <Skeleton height="1rem" width="80px" />
      </div>
      <div className="flex space-x-2">
        <Skeleton height="2.5rem" width="60px" rounded />
        <Skeleton height="2.5rem" width="80px" rounded />
      </div>
    </div>

    {/* 進度條骨架 */}
    <div className="space-y-2">
      <Skeleton height="0.5rem" />
      <div className="flex justify-between">
        <Skeleton height="0.75rem" width="80px" />
        <Skeleton height="0.75rem" width="50px" />
      </div>
    </div>
  </div>
);

/**
 * 批次輸出顯示載入骨架屏
 */
export const BatchOutputSkeleton: React.FC = () => (
  <div className="card">
    <div className="card-body">
      {/* 標題列骨架 */}
      <div className="flex justify-between items-center mb-4">
        <Skeleton height="1.5rem" width="150px" />
        <div className="flex space-x-2">
          <Skeleton height="2rem" width="60px" rounded />
          <Skeleton height="2rem" width="80px" rounded />
        </div>
      </div>

      {/* 狀態欄骨架 */}
      <div className="mb-4 p-3 rounded-lg border">
        <div className="flex items-center space-x-3">
          <Skeleton width="1.5rem" height="1.5rem" rounded />
          <Skeleton height="1rem" width="200px" />
        </div>
      </div>

      {/* 結果列表骨架 */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            {/* 設備資訊骨架 */}
            <div className="flex justify-between items-start mb-3">
              <div className="space-y-2">
                <Skeleton height="1.25rem" width="150px" />
                <Skeleton height="1rem" width="100px" />
              </div>
              <Skeleton width="2rem" height="2rem" rounded />
            </div>

            {/* 指令輸出骨架 */}
            <div className="space-y-2">
              <Skeleton height="1rem" width="80%" />
              <Skeleton height="1rem" width="90%" />
              <Skeleton height="1rem" width="70%" />
              <Skeleton height="1rem" width="85%" />
            </div>

            {/* 時間戳骨架 */}
            <div className="mt-3 flex justify-end">
              <Skeleton height="0.75rem" width="120px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * 虛擬化列表載入骨架屏
 */
export const VirtualizedListSkeleton: React.FC = () => (
  <div className="space-y-1">
    {Array.from({ length: 15 }).map((_, i) => (
      <div key={i} className="flex items-center space-x-3 p-3 border-b">
        <Skeleton width="1rem" height="1rem" rounded />
        <div className="flex-1 grid grid-cols-3 gap-4">
          <Skeleton height="1rem" />
          <Skeleton height="1rem" />
          <Skeleton height="1rem" />
        </div>
        <Skeleton width="1.5rem" height="1.5rem" rounded />
      </div>
    ))}
  </div>
);

/**
 * 多設備選擇器載入骨架屏
 */
export const MultiDeviceSelectorSkeleton: React.FC = () => (
  <div className="space-y-4">
    {/* 搜尋和篩選骨架 */}
    <div className="flex space-x-3">
      <Skeleton height="2.5rem" className="flex-1" />
      <Skeleton height="2.5rem" width="120px" />
      <Skeleton height="2.5rem" width="100px" />
    </div>

    {/* 選中項目顯示骨架 */}
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
          <Skeleton height="0.75rem" width="60px" />
          <Skeleton width="1rem" height="1rem" rounded />
        </div>
      ))}
    </div>

    {/* 設備列表骨架 */}
    <div className="border rounded-lg max-h-64 overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 border-b last:border-b-0">
          <div className="flex items-center space-x-3">
            <Skeleton width="1rem" height="1rem" rounded />
            <div className="space-y-1">
              <Skeleton height="1rem" width="120px" />
              <Skeleton height="0.75rem" width="80px" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton width="0.5rem" height="0.5rem" rounded />
            <Skeleton height="0.75rem" width="40px" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * 設備群組選擇器載入骨架屏
 */
export const DeviceGroupSelectorSkeleton: React.FC = () => (
  <div className="space-y-3">
    <Skeleton height="1.25rem" width="100px" />
    
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Skeleton height="1rem" width="80px" />
            <Skeleton width="1rem" height="1rem" rounded />
          </div>
          <Skeleton height="0.75rem" width="60%" />
          <div className="mt-2">
            <Skeleton height="0.75rem" width="40px" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * 通用載入指示器
 */
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg', text?: string }> = ({ 
  size = 'md', 
  text = '載入中...' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`animate-spin rounded-full border-2 border-blue-600 border-t-transparent ${sizeClasses[size]} mb-4`} />
      <p className="text-gray-600 text-sm">{text}</p>
    </div>
  );
};

export default {
  DeviceSelectionSkeleton,
  CommandInputSkeleton,
  BatchOutputSkeleton,
  VirtualizedListSkeleton,
  MultiDeviceSelectorSkeleton,
  DeviceGroupSelectorSkeleton,
  LoadingSpinner,
  Skeleton
};