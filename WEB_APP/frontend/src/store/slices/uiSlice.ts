/**
 * UI 狀態管理切片
 * 
 * 負責管理用戶介面相關狀態，包括執行模式、輸入值、狀態訊息等
 * 
 * @description 此切片專注於 UI 狀態管理，提供統一的介面控制邏輯
 * @author AI Ops Assistant  
 * @version 1.0.0 - 初始切片版本
 */
import { type StateCreator } from 'zustand';
import { type AppStore, type UiSlice } from '@/types/store';
import { storeDevtools } from '../storeMiddlewares';

// UI 切片初始狀態
export const initialUiState = {
  mode: 'command' as const,
  inputValue: '',
  status: {
    message: '',
    type: '',
  },
} as const;

export const createUiSlice: StateCreator<
  AppStore,
  [],
  [],
  UiSlice
> = (set, get) => ({
  // 初始狀態
  ...initialUiState,

  // UI 動作 - 添加效能監控
  setMode: (mode) => {
    storeDevtools.measurePerformance('ui:setMode', () => {
      set({ mode }, false, 'ui:setMode');
      // 切換模式時清空輸入值
      get().setInputValue('');
    });
  },

  setInputValue: (value) => {
    set({ inputValue: value }, false, 'ui:setInputValue');
  },

  // 優化的狀態訊息動作 - 避免相同訊息重複設定
  setStatus: (message, type) => {
    const currentState = get();
    // 只有在訊息或類型實際改變時才更新
    if (currentState.status.message !== message || currentState.status.type !== type) {
      set(
        { status: { message, type } },
        false,
        'ui:setStatus'
      );
    }
  },

});