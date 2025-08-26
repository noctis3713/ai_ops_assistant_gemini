// 命令輸入容器組件 - 只訂閱命令相關狀態
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store';
import CommandInput from '../features/CommandInput';

const CommandInputContainer = memo(() => {
  // 只訂閱命令輸入相關的狀態
  const commandState = useAppStore(
    useShallow(state => ({
      inputValue: state.inputValue,
      isExecuting: state.isExecuting,
      status: state.status,
      mode: state.mode,
      selectedDevices: state.selectedDevices
    }))
  );
  
  // 只訂閱需要的動作
  const commandActions = useAppStore(
    useShallow(state => ({
      setInputValue: state.setInputValue,
      executeCommand: state.executeCommand,
      clearInput: state.clearInput
    }))
  );

  return <CommandInput {...commandState} {...commandActions} />;
});

CommandInputContainer.displayName = 'CommandInputContainer';

export default CommandInputContainer;