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
    // 統一的未定義狀態顯示
    if (progress.isVisible) {
      return progress.currentStage ? '處理中...' : '執行中...';
    }
    return '待命中...';
  };

  // 根據階段決定文字樣式
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
        return 'text-terminal-text-primary';
      default:
        return 'text-terminal-text-secondary';
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

  return (
    <div className={`
      mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg min-h-[140px]
      transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
      ${progress.isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}
    `}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-terminal-text-primary">執行進度</h3>
        <span className="text-sm text-terminal-text-secondary">
          {progress.isVisible ? `${progress.completedDevices}/${progress.totalDevices} 設備` : '待命中...'}
        </span>
      </div>

      {/* 階段訊息顯示 */}
      <div className="mb-3">
        <div className={`stage-text text-sm font-medium ${getStageStyles()}`}>
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
            className={`progress-fill ${progress.isVisible ? getProgressBarClass() : ''}`}
            style={{ width: progress.isVisible ? `${progressPercentage}%` : '0%' }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default BatchProgressIndicator;