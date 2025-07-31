/**
 * 簡化的進度指示器
 * 顯示基本的執行進度
 * 使用固定高度和透明度過渡，避免佈局抖動
 */
import { type BatchProgressIndicatorProps } from '@/types';

const BatchProgressIndicator = ({ progress }: BatchProgressIndicatorProps) => {
  const progressPercentage = progress.totalDevices > 0 
    ? Math.round((progress.completedDevices / progress.totalDevices) * 100)
    : 0;

  return (
    <div className={`
      mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg min-h-[120px]
      transition-all duration-5000 ease-in-out
      ${progress.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-70'}
    `}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-terminal-text-primary">執行進度</h3>
        <span className="text-sm text-terminal-text-secondary">
          {progress.isVisible ? `${progress.completedDevices}/${progress.totalDevices} 設備` : '待命中...'}
        </span>
      </div>

      {/* 簡化的總體進度條 */}
      <div>
        <div className="flex justify-between text-sm text-terminal-text-secondary mb-2">
          <span>整體進度</span>
          <span>{progress.isVisible ? `${progressPercentage}%` : '0%'}</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${progress.isVisible ? 'active' : ''}`}
            style={{ width: progress.isVisible ? `${progressPercentage}%` : '0%' }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default BatchProgressIndicator;