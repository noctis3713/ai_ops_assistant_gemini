// 簡化的進度管理輔助函數
import { useAppStore } from './appStore';

export const useProgressTimer = () => {
  const setProgress = useAppStore((state) => state.setProgress);

  // 開始進度顯示
  const startTimer = () => {
    setProgress({ isVisible: true, percentage: 0 });
  };

  // 停止進度顯示
  const stopTimer = () => {
    setProgress({ isVisible: false, percentage: 100 });
  };

  // 重置進度
  const resetTimer = () => {
    setProgress({ isVisible: false, percentage: 0 });
  };

  return {
    startTimer,
    stopTimer,
    resetTimer,
  };
};