/**
 * 配置和共享工具切片
 * 
 * 負責管理跨切片的共享功能，包括清理、重置、批次更新等工具函數
 * 
 * @description 此切片提供跨領域的工具函數，協調多個切片之間的互動
 * @author AI Ops Assistant  
 * @version 1.0.0 - 初始切片版本
 */
import { type StateCreator } from 'zustand';
import { type AppStore, type ConfigSlice } from '@/types/store';
import { createStateResetHandler, createBatchUpdateHandler } from '@/utils/storeHelpers';

export const createConfigSlice: StateCreator<
  AppStore,
  [],
  [],
  ConfigSlice
> = (set, get) => ({
  // =============================================================================
  // 統一清理和重置功能
  // =============================================================================

  // 統一的清理執行資料
  clearExecutionData: (options?: { status?: boolean; results?: boolean; timestamp?: boolean }) => {
    const { status = true, results = true, timestamp = true } = options || {};
    
    set(
      (state) => ({
        ...state,
        ...(status && { status: { message: '', type: '' } }),
        ...(results && { batchResults: [] }),
        ...(timestamp && { executionStartTime: null }),
      }),
      false,
      'config:clearExecutionData'
    );
  },

  // 重置執行狀態
  resetExecutionState: () => {
    const handler = createStateResetHandler(get());
    handler();
  },

  // =============================================================================
  // 批次更新和組合動作
  // =============================================================================

  // 批次更新設備選擇和輸入狀態
  updateSelectionAndInput: (devices: string[], input: string, mode?: 'command' | 'ai') => {
    const handler = createBatchUpdateHandler(get());
    handler(devices, input, mode);
  },

  // =============================================================================
  // 跨切片協調動作
  // =============================================================================

  // 智能狀態切換邏輯 - 協調多個切片之間的互動
  smartToggle: (action: 'clear_all' | 'restart_execution' | 'switch_mode') => {
    const state = get();
    
    switch (action) {
      case 'clear_all':
        // 清空所有內容和結果 - 跨切片協調
        state.setSelectedDevices([]);           // device slice
        state.setInputValue('');               // ui slice
        state.clearExecutionData({ results: true, status: true }); // config slice
        state.setProgressVisibility('batch', false);  // execution slice
        state.setProgressVisibility('normal', false); // execution slice
        break;
        
      case 'restart_execution':
        // 保持選擇和輸入，只重置執行狀態 - 跨切片協調
        state.clearExecutionData({ results: true, status: true }); // config slice
        state.setProgressVisibility('batch', false);  // execution slice
        state.setProgressVisibility('normal', false); // execution slice
        state.setIsExecuting(false);           // execution slice
        state.setIsBatchExecution(false);      // execution slice
        break;
        
      case 'switch_mode': {
        // 智能切換執行模式（command ↔ ai） - 跨切片協調
        const newMode = state.mode === 'command' ? 'ai' : 'command';
        state.setMode(newMode);                // ui slice
        // 切換模式時清空輸入，但保持設備選擇
        state.setInputValue('');               // ui slice
        break;
      }
    }
  },

  // 條件性狀態更新（使用新的統一 actions）
  conditionalUpdate: (updates: {
    status?: { message: string; type: 'loading' | 'success' | 'error' | 'warning' | '' };
    progress?: { percentage: number; visible?: boolean };
    batchProgress?: { completed: number; total: number; visible?: boolean };
  }) => {
    const { setProgressVisibility, setBatchProgress, setStatus } = get();
    
    if (updates.status) {
      setStatus(updates.status.message, updates.status.type);
    }
    
    if (updates.progress) {
      setProgressVisibility('normal', updates.progress.visible !== false, {
        percentage: updates.progress.percentage
      });
    }
    
    if (updates.batchProgress) {
      if (updates.batchProgress.visible !== undefined) {
        setProgressVisibility('batch', updates.batchProgress.visible, {
          totalDevices: updates.batchProgress.total
        });
      }
      setBatchProgress({ completedDevices: updates.batchProgress.completed });
    }
  },
});