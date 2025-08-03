/**
 * 精簡進度條組件
 * 專為放置在執行按鈕旁邊設計，高度匹配按鈕
 * 包含進度條和狀態顯示
 */
import { type StatusMessage, type BatchProgressState } from '@/types';
import { PROGRESS_STAGE_TEXT } from '@/constants';

interface CompactProgressBarProps {
  progress: BatchProgressState;
  status?: StatusMessage;
}

const CompactProgressBar = ({ progress, status }: CompactProgressBarProps) => {
  const progressPercentage = progress.totalDevices > 0 
    ? Math.round((progress.completedDevices / progress.totalDevices) * 100)
    : 0;

  // 獲取階段顯示文字（優先顯示自訂訊息）
  const getStageText = () => {
    if (progress.stageMessage) {
      return progress.stageMessage;
    }
    if (progress.currentStage && PROGRESS_STAGE_TEXT[progress.currentStage]) {
      return PROGRESS_STAGE_TEXT[progress.currentStage];
    }
    // 統一的未定義狀態顯示
    if (progress.isVisible && progress.currentStage) {
      return '處理中...';
    }
    return null;
  };

  // 獲取狀態樣式，考慮階段狀態
  const getStatusStyles = (statusType?: string) => {
    // 優先使用階段狀態來決定樣式
    if (progress.currentStage) {
      switch (progress.currentStage) {
        case 'completed':
          return 'bg-terminal-success-light text-terminal-success-dark border-terminal-success/30';
        case 'failed':
          return 'bg-terminal-error-light text-terminal-error-dark border-terminal-error/30';
        case 'cancelled':
          return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        case 'submitting':
        case 'submitted':
        case 'connecting':
        case 'executing':
        case 'ai-analyzing':
          return 'bg-gray-50 text-gray-700 border-gray-200';
        default:
          break;
      }
    }
    
    // 回退到原有的狀態樣式
    switch (statusType) {
      case 'loading':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'success':
        return 'bg-terminal-success-light text-terminal-success-dark border-terminal-success/30';
      case 'error':
        return 'bg-terminal-error-light text-terminal-error-dark border-terminal-error/30';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  // 根據階段決定進度條樣式
  const getProgressBarClass = () => {
    if (!progress.currentStage) {
      return 'active';
    }
    
    switch (progress.currentStage) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'cancelled':  
        return 'error';
      case 'executing':
      case 'ai-analyzing':
      case 'connecting':
      case 'submitting':
      case 'submitted':
        return 'active';
      default:
        return 'active';
    }
  };

  // 判斷是否有內容需要顯示
  const hasProgress = progress.isVisible;
  const hasStatus = status?.message && status?.type;
  const hasStageText = getStageText();
  
  // 如果沒有任何內容，不渲染
  if (!hasProgress && !hasStatus && !hasStageText) {
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
                  className={`progress-fill h-full rounded-full transition-all duration-500 ease-out ${getProgressBarClass()}`}
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

        {/* 狀態訊息或階段訊息 */}
        {(hasStatus || hasStageText) && (
          <div className={`px-3 flex items-center min-w-0 flex-1 ${hasProgress ? 'border-l border-current/20' : ''}`}>
            <span className="text-sm font-medium whitespace-nowrap overflow-visible transition-all duration-200">
              {hasStageText || status?.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompactProgressBar;