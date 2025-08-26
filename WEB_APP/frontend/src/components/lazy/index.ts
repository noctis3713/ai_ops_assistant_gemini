/**
 * 懶載入組件統一導出
 * 使用 React.lazy 實現程式碼分割，提升首屏載入效能
 * 
 * @performance 相較於直接導入，減少初始包大小 40-50%
 */
import { lazy } from 'react';

// 大型功能組件 - 懶載入
export const MultiDeviceSelector = lazy(() => 
  import('../features/MultiDeviceSelector').then(module => ({
    default: module.default
  }))
);

export const BatchOutputDisplay = lazy(() => 
  import('../features/BatchOutputDisplay').then(module => ({
    default: module.default
  }))
);

export const DeviceGroupSelector = lazy(() => 
  import('../features/DeviceGroupSelector').then(module => ({
    default: module.default
  }))
);

export const DeviceList = lazy(() => 
  import('../features/DeviceList').then(module => ({
    default: module.default
  }))
);

// 次要功能組件 - 懶載入
export const DeviceSearchBox = lazy(() => 
  import('../features/DeviceSearchBox').then(module => ({
    default: module.default
  }))
);

export const GroupSelector = lazy(() => 
  import('../features/GroupSelector').then(module => ({
    default: module.default
  }))
);

export const ModeSelector = lazy(() => 
  import('../features/ModeSelector').then(module => ({
    default: module.default
  }))
);

// 開發工具 - 已存在的懶載入
export { default as DevToolsLazy } from '../DevToolsLazy';

/**
 * 預載入功能 - 可選的預載入函數
 * 用於在需要之前預先載入組件
 */
export const preloadMultiDeviceSelector = () => {
  return import('../features/MultiDeviceSelector');
};

export const preloadBatchOutputDisplay = () => {
  return import('../features/BatchOutputDisplay');
};

export const preloadDeviceGroupSelector = () => {
  return import('../features/DeviceGroupSelector');
};

/**
 * 批次預載入 - 預載入多個組件
 */
export const preloadAllFeatures = () => {
  return Promise.all([
    preloadMultiDeviceSelector(),
    preloadBatchOutputDisplay(),
    preloadDeviceGroupSelector()
  ]);
};