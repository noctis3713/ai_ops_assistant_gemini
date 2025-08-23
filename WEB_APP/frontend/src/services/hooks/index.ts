/**
 * 服務層 Hooks 統一導出
 */

// 設備服務 Hooks
export {
  useDevices,
  useDevice,
  useDeviceStats,
  useDeviceGroups,
  useDeviceSearch,
  useDeviceValidation,
  useRefreshDeviceCache,
  useRefreshDeviceGroupCache,
  usePrefetchDevices,
  usePrefetchDevice,
  deviceQueryKeys,
  deviceGroupQueryKeys,
  deviceListQueryOptions,
  deviceDetailQueryOptions,
  deviceStatsQueryOptions,
  deviceGroupListQueryOptions
} from './useDeviceService';

// 執行服務 Hooks
export {
  useExecuteCommand,
  useQueryAI,
  useExecuteBatch,
  useExecuteBatchAsync,
  useClearExecutionHistory,
  useExecutionHealthCheck,
  useCommandExecution,
  useExecutionService,
  executionQueryKeys
} from './useExecutionService';

// 配置服務 Hooks
export {
  useBackendConfig,
  useAiQueryEnabled,
  useConfigHealth,
  useReloadConfig,
  useClearConfigCache,
  useConfigManagement,
  useConfigService,
  configQueryKeys
} from './useConfigService';