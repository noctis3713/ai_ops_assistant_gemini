// 設備選擇器容器組件 - 只訂閱設備相關狀態
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store';
import DeviceSelectionContainer from '../features/DeviceSelectionContainer';

const DeviceSelectorContainer = memo(() => {
  // 只訂閱設備相關的狀態
  const deviceState = useAppStore(
    useShallow(state => ({
      selectedDevices: state.selectedDevices,
      mode: state.mode,
      searchQuery: state.searchQuery,
      filterOptions: state.filterOptions
    }))
  );
  
  // 只訂閱設備相關動作
  const deviceActions = useAppStore(
    useShallow(state => ({
      toggleDeviceSelection: state.toggleDeviceSelection,
      selectAllDevices: state.selectAllDevices,
      clearDeviceSelection: state.clearDeviceSelection,
      setMode: state.setMode,
      setSearchQuery: state.setSearchQuery,
      setFilterOptions: state.setFilterOptions
    }))
  );

  return <DeviceSelectionContainer {...deviceState} {...deviceActions} />;
});

DeviceSelectorContainer.displayName = 'DeviceSelectorContainer';

export default DeviceSelectorContainer;