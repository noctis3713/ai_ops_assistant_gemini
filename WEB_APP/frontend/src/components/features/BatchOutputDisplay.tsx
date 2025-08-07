/**
 * 輸出顯示組件
 * 顯示多設備執行結果的詳細信息
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { type BatchOutputDisplayProps } from '@/types';
import BatchResultItem from './BatchResultItem';
import VirtualizedResultList from './VirtualizedResultList';
import Button from '@/components/common/Button';
import { createToggleHandler, handleCopyToClipboard } from '@/utils/commonHandlers';

const BatchOutputDisplay = ({ 
  results, 
  onClear,
  statusText,
  statusClassName
}: BatchOutputDisplayProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  
  // 虛擬化閾值 - 當結果數量超過此值時使用虛擬化渲染
  const VIRTUALIZATION_THRESHOLD = 20;

  // 當執行完成時自動展開所有項目
  useEffect(() => {
    if (results.length > 0 && expandedItems.size === 0) {
      // 只在首次有結果且當前沒有展開項目時自動展開
      setExpandedItems(new Set(results.map(r => r.deviceIp)));
    }
  }, [results.length, expandedItems.size, results]);

  // 使用共用的切換處理器
  const toggleExpanded = useMemo(
    () => createToggleHandler(expandedItems, setExpandedItems),
    [expandedItems]
  );

  const copyToClipboard = useCallback(handleCopyToClipboard, []);

  const filteredResults = useMemo(() => {
    return results.filter(result => {
      if (filterStatus === 'success') return result.success;
      if (filterStatus === 'failed') return !result.success;
      return true;
    });
  }, [results, filterStatus]);

  const { successCount, failedCount } = useMemo(() => ({
    successCount: results.filter(r => r.success).length,
    failedCount: results.filter(r => !r.success).length
  }), [results]);

  // 判斷是否使用虛擬化渲染
  const shouldUseVirtualization = useMemo(() => {
    return filteredResults.length > VIRTUALIZATION_THRESHOLD;
  }, [filteredResults.length, VIRTUALIZATION_THRESHOLD]);

  // 條件渲染必須在所有 Hooks 之後
  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        {statusText && (
          <div className={statusClassName}>
            {statusText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      {/* 標題和控制項 */}
      <div className="card-header">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg">
            執行結果
          </h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="small"
              size="sm"
              onClick={() => setExpandedItems(new Set(results.map(r => r.deviceIp)))}
            >
              全部展開
            </Button>
            <Button
              variant="small"
              size="sm"
              onClick={() => setExpandedItems(new Set())}
            >
              全部收起
            </Button>
            <Button
              variant="small"
              size="sm"
              onClick={onClear}
            >
              清空結果
            </Button>
          </div>
        </div>


        {/* 篩選器 */}
        <div className="flex space-x-2">
          {(['all', 'success', 'failed'] as const).map((status) => (
            <Button
              key={status}
              variant="small"
              size="sm"
              onClick={() => setFilterStatus(status)}
              className={filterStatus === status ? 'bg-terminal-primary-light text-terminal-primary' : ''}
            >
              {status === 'all' && '全部'}
              {status === 'success' && `成功 (${successCount})`}
              {status === 'failed' && `失敗 (${failedCount})`}
            </Button>
          ))}
        </div>
      </div>

      {/* 結果列表 */}
      <div>
        {filteredResults.length === 0 ? (
          <div className="card-body text-center text-terminal-text-muted">
            沒有符合篩選條件的結果
          </div>
        ) : shouldUseVirtualization ? (
          /* 大數據量時使用虛擬化渲染 */
          <VirtualizedResultList
            results={filteredResults}
            expandedItems={expandedItems}
            onToggleExpanded={toggleExpanded}
            onCopy={copyToClipboard}
            containerHeight={500}
          />
        ) : (
          /* 小數據量時使用普通渲染 */
          <div className="divide-y divide-gray-100">
            {filteredResults.map((result) => (
              <BatchResultItem
                key={result.deviceIp}
                result={result}
                isExpanded={expandedItems.has(result.deviceIp)}
                onExpand={() => toggleExpanded(result.deviceIp)}
                onCopy={copyToClipboard}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部統計 */}
      <div className="card-footer">
        <div className="text-xs text-terminal-text-secondary text-center">
          顯示 {filteredResults.length} 項結果，共 {results.length} 項
        </div>
      </div>
    </div>
  );
};

export default React.memo(BatchOutputDisplay);