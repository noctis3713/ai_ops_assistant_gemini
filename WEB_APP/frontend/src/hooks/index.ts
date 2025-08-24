/**
 * Hooks 統一導出
 * 
 * 極度推薦使用方式：
 * ```typescript
 * import {
 *   useMemoizedFn,     // 來自 utils
 *   useMount,          // 來自 lifecycle  
 *   useExecutionCore,  // 來自 batch-execution
 *   useDeviceFilter,   // 來自業務 hooks
 * } from '@/hooks';
 * ```
 * 
 * 清晰、一致、且對內部結構無感知
 */

// ========== 通用工具 Hooks ==========
// 生命週期、狀態管理、性能優化、DOM 操作等通用工具
export * from './utils';

// ========== 特色功能 Hooks ==========
// 具有特定業務邏輯的進階 Hooks
export * from './features';

// ========== 進階功能 Hooks ==========
// 包含複雜邏輯的高級 Hooks
export * from './advanced';

// ========== 批次執行模組 ==========
// 完整的批次執行相關 hooks
export * from './batch-execution';

// ========== 業務 Hooks ==========
// 設備管理
export * from './useDeviceFilter';

// 應用狀態與互動
export * from './useKeyboardShortcuts';
export * from './useAsyncTasks';
export * from './useAppStatus';
export * from './useAppSelector';
export * from './useOptimizedAppState';
export * from './useStoreActions';
export * from './useOptimizedStoreSelectors';

// 搜尋與預取
export * from './useDebounceSearch';
export * from './usePrefetch';
export * from './useSmartPrefetch';

// UI 與工具
export * from './useTimer';
export * from './useVirtualIntersection';
