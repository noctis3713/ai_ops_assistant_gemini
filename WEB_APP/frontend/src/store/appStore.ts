// Zustand 應用程式狀態管理 - 切片模式重構版
import { create } from 'zustand';
import { type AppStore } from '@/types';
import { createOptimizedStore } from './storeMiddlewares';
import { createSelectors } from './createSelectors';
import {
  createDeviceSlice,
  createUiSlice,
  createExecutionSlice,
  createConfigSlice
} from './slices';

// 基礎 store - 使用 Slices Pattern 組合所有狀態切片
const useAppStoreBase = create<AppStore>()(
  createOptimizedStore<AppStore>(
    (...a) => ({
      // 組合所有切片 - 順序重要，確保依賴關係正確
      ...createDeviceSlice(...a),      // 設備狀態管理
      ...createUiSlice(...a),          // UI 狀態管理
      ...createExecutionSlice(...a),   // 執行狀態管理
      ...createConfigSlice(...a),      // 配置和共享工具
    }),
    'app-store-slices' // 更新 store 名稱以反映新架構
  )
);

// 導出帶有自動選擇器的 store
export const useAppStore = createSelectors(useAppStoreBase);

// 開發環境效能監控
if (process.env.NODE_ENV === 'development') {
  // 監控 store 訂閱數量
  let subscriptionCount = 0;
  const originalSubscribe = useAppStore.subscribe;
  useAppStore.subscribe = (...args) => {
    subscriptionCount++;
    const unsubscribe = originalSubscribe.apply(useAppStore, args);
    return () => {
      subscriptionCount--;
      unsubscribe();
    };
  };
  
  // 每5秒記錄訂閱統計
  setInterval(() => {
    if (subscriptionCount > 0) {
      console.log(`📊 AppStore 活躍訂閱數: ${subscriptionCount}`);
    }
  }, 5000);
}