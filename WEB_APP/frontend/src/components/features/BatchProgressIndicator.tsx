/**
 * 簡化的進度指示器
 * 顯示基本的執行進度
 * 使用固定高度和透明度過渡，避免佈局抖動
 */
import { type BatchProgressIndicatorProps } from '@/types';
import { PROGRESS_STAGE_TEXT } from '@/constants';

const BatchProgressIndicator = ({ progress }: BatchProgressIndicatorProps) => {
  const progressPercentage = progress.totalDevices > 0 
    ? Math.round((progress.completedDevices / progress.totalDevices) * 100)
    : 0;

  // 獲取當前階段顯示文字
  const getStageText = () => {
    if (progress.stageMessage) {
      return progress.stageMessage;
    }
    if (progress.currentStage && PROGRESS_STAGE_TEXT[progress.currentStage]) {
      return PROGRESS_STAGE_TEXT[progress.currentStage];
    }
    return progress.isVisible ? '執行中...' : '待命中...';
  };

  // 根據階段決定樣式
  const getStageStyles = () => {
    if (!progress.currentStage) {
      return 'text-terminal-text-secondary';
    }
    
    switch (progress.currentStage) {
      case 'completed':
        return 'text-terminal-success-dark';
      case 'failed':
      case 'cancelled':
        return 'text-terminal-error-dark';
      case 'executing':
      case 'ai-analyzing':
        return 'text-terminal-primary';
      default:
        return 'text-terminal-text-secondary';
    }
  };

  return (
    <div className={`
      mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg min-h-[140px]
      transition-all duration-300 ease-in-out
      ${progress.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-70'}
    `}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-terminal-text-primary">執行進度</h3>
        <span className="text-sm text-terminal-text-secondary">
          {progress.isVisible ? `${progress.completedDevices}/${progress.totalDevices} 設備` : '待命中...'}
        </span>
      </div>

      {/* 階段訊息顯示 */}
      <div className="mb-3">
        <div className={`text-sm font-medium transition-colors duration-200 ${getStageStyles()}`}>
          {getStageText()}
        </div>
      </div>

      {/* 簡化的總體進度條 */}
      <div>
        <div className="flex justify-between text-sm text-terminal-text-secondary mb-2">
          <span>整體進度</span>
          <span>{progress.isVisible ? `${progressPercentage}%` : '0%'}</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill transition-all duration-300 ease-out ${progress.isVisible ? 'active' : ''}`}
            style={{ width: progress.isVisible ? `${progressPercentage}%` : '0%' }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default BatchProgressIndicator;