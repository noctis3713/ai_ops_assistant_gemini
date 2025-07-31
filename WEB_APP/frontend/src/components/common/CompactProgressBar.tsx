/**
 * 精簡進度條組件
 * 專為放置在執行按鈕旁邊設計，高度匹配按鈕
 * 包含進度條和狀態顯示
 */
import { type BatchProgressIndicatorProps, type StatusMessage } from '@/types';

interface CompactProgressBarProps extends BatchProgressIndicatorProps {
  status?: StatusMessage;
}

const CompactProgressBar = ({ progress, status }: CompactProgressBarProps) => {
  const progressPercentage = progress.totalDevices > 0 
    ? Math.round((progress.completedDevices / progress.totalDevices) * 100)
    : 0;

  // 獲取狀態樣式
  const getStatusStyles = (statusType?: string) => {
    switch (statusType) {
      case 'loading':
        return 'bg-terminal-primary-light text-terminal-primary border-terminal-primary/20';
      case 'success':
        return 'bg-terminal-success-light text-terminal-success-dark border-terminal-success/30';
      case 'error':
        return 'bg-terminal-error-light text-terminal-error-dark border-terminal-error/30';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  // 判斷是否有內容需要顯示
  const hasProgress = progress.isVisible;
  const hasStatus = status?.message && status?.type;
  
  // 如果沒有任何內容，不渲染
  if (!hasProgress && !hasStatus) {
    return null;
  }

  return (
    <div className="flex items-center ml-4">
      {/* 統一容器 - 當有狀態時使用狀態顏色框 */}
      <div className={`
        flex items-center rounded-lg border transition-all duration-300 h-[48px]
        ${hasStatus ? getStatusStyles(status.type) : 'bg-gray-50 border-gray-200'}
      `}>
        {/* 進度條區域 */}
        {hasProgress && (
          <div className="flex items-center space-x-2 px-3 min-w-[200px]">
            {/* 進度資訊 */}
            <div className={`text-sm whitespace-nowrap ${
              hasStatus && status.type === 'success' ? 'text-terminal-success-dark' :
              hasStatus && status.type === 'error' ? 'text-terminal-error-dark' :
              hasStatus && status.type === 'loading' ? 'text-terminal-primary' :
              'text-terminal-text-secondary'
            }`}>
              {progress.completedDevices}/{progress.totalDevices}
            </div>
            
            {/* 精簡進度條 */}
            <div className="flex-1 min-w-[120px]">
              <div className={`w-full h-2 rounded-full overflow-hidden ${
                hasStatus ? 'bg-white/30' : 'bg-gray-200'
              }`}>
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    hasStatus && status.type === 'success' ? 'bg-terminal-success-dark' :
                    hasStatus && status.type === 'error' ? 'bg-terminal-error-dark' :
                    hasStatus && status.type === 'loading' ? 'bg-terminal-primary' :
                    'bg-terminal-primary'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
            
            {/* 百分比 */}
            <div className={`text-sm whitespace-nowrap min-w-[35px] text-right ${
              hasStatus && status.type === 'success' ? 'text-terminal-success-dark' :
              hasStatus && status.type === 'error' ? 'text-terminal-error-dark' :
              hasStatus && status.type === 'loading' ? 'text-terminal-primary' :
              'text-terminal-text-secondary'
            }`}>
              {progressPercentage}%
            </div>
          </div>
        )}

        {/* 狀態訊息 */}
        {hasStatus && (
          <div className={`px-3 flex items-center min-w-0 flex-1 ${hasProgress ? 'border-l border-current/20' : ''}`}>
            <span className="text-sm font-medium whitespace-nowrap overflow-visible">
              {status.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompactProgressBar;