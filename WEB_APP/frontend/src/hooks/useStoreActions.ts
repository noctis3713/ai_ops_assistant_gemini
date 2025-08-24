/**
 * Store Actions Hook
 * 提供穩定的 store 動作引用，減少 App 組件的重新渲染
 */
import { useMemo } from 'react';
import { useAppStore } from '@/store';

export const useStoreActions = () => {
  // 使用 useMemo 確保動作引用穩定
  const storeActions = useMemo(() => ({
    setMode: useAppStore.getState().setMode,
    setSelectedDevices: useAppStore.getState().setSelectedDevices,
    setInputValue: useAppStore.getState().setInputValue,
    clearExecutionData: useAppStore.getState().clearExecutionData,
    setProgressVisibility: useAppStore.getState().setProgressVisibility
  }), []);

  return storeActions;
};