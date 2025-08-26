// 批次輸出容器組件 - 只訂閱執行結果相關狀態
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store';
import BatchOutputDisplay from '../features/BatchOutputDisplay';

const BatchOutputContainer = memo(() => {
  // 只訂閱執行結果相關的狀態
  const outputState = useAppStore(
    useShallow(state => ({
      batchResults: state.batchResults,
      batchProgress: state.batchProgress,
      isExecuting: state.isExecuting,
      status: state.status,
      currentTask: state.currentTask
    }))
  );
  
  // 只訂閱輸出相關動作
  const outputActions = useAppStore(
    useShallow(state => ({
      clearBatchResults: state.clearBatchResults,
      exportResults: state.exportResults
    }))
  );

  // 只在有結果時渲染
  if (!outputState.batchResults?.length && !outputState.isExecuting) {
    return null;
  }

  return <BatchOutputDisplay {...outputState} {...outputActions} />;
});

BatchOutputContainer.displayName = 'BatchOutputContainer';

export default BatchOutputContainer;