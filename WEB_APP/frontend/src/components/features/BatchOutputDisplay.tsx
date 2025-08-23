/**
 * 輸出顯示組件 (React 19 優化版)
 * 顯示多設備執行結果的詳細信息
 * 使用 useTransition 優化漸進式渲染
 */
import React, { useState, useEffect, useCallback, useMemo, useTransition, useDeferredValue } from 'react';
import { type BatchOutputDisplayProps } from '@/types';
import BatchResultItem from './BatchResultItem';
import VirtualizedResultList from './VirtualizedResultList';
import Button from '@/components/common/Button';
import { useDevices } from '@/services';
import { findDeviceByIp } from '@/utils/utils';
import { handleCopyToClipboard } from '@/utils/commonHandlers';

const BatchOutputDisplay = ({ 
  results, 
  onClear,
  statusText,
  statusClassName
}: BatchOutputDisplayProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  
  // React 19: 使用 useTransition 處理漸進式渲染
  const [isPendingRender, startRenderTransition] = useTransition();
  
  // React 19: 使用 useDeferredValue 延遲非緊急的篩選更新
  const deferredFilterStatus = useDeferredValue(filterStatus);
  
  // 虛擬化閾值 - 當結果數量超過此值時使用虛擬化渲染
  const VIRTUALIZATION_THRESHOLD = 20;

  // 獲取設備資料用於描述查詢
  const { data: devices } = useDevices();

  // 設備描述查詢函數 - 使用 useCallback 確保穩定引用
  const getDeviceDescription = useCallback((deviceIp: string) => {
    const device = devices ? findDeviceByIp(devices, deviceIp) : undefined;
    return device?.description || '';
  }, [devices]);

  // 當執行完成時自動展開所有項目
  useEffect(() => {
    if (results.length > 0 && expandedItems.size === 0) {
      // 只在首次有結果且當前沒有展開項目時自動展開
      setExpandedItems(new Set(results.map(r => r.deviceIp)));
    }
  }, [results.length, expandedItems.size, results]);

  // 優化 Set 操作 - 使用 useMemo 快取 Set 操作函數
  const setOperations = useMemo(() => ({
    toggle: (deviceIp: string) => {
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(deviceIp)) {
          newSet.delete(deviceIp);
        } else {
          newSet.add(deviceIp);
        }
        return newSet;
      });
    },
    expandAll: () => {
      setExpandedItems(new Set(results.map(r => r.deviceIp)));
    },
    collapseAll: () => {
      setExpandedItems(new Set());
    }
  }), [results]);

  // 簡化的 toggle 函數
  const toggleExpanded = useCallback((deviceIp: string) => {
    setOperations.toggle(deviceIp);
  }, [setOperations]);

  const copyToClipboard = useCallback(handleCopyToClipboard, []);

  // 優化篩選邏輯 - 使用單次遍歷計算所有統計資料
  const filterData = useMemo(() => {
    let successCount = 0;
    let failedCount = 0;
    const filteredResults = [];

    for (const result of results) {
      // 統計計數
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      // 篩選邏輯 - 使用 deferredFilterStatus 提升性能
      if (deferredFilterStatus === 'success' && !result.success) continue;
      if (deferredFilterStatus === 'failed' && result.success) continue;
      
      filteredResults.push(result);
    }

    return {
      filteredResults,
      successCount,
      failedCount
    };
  }, [results, deferredFilterStatus]);

  const { filteredResults, successCount, failedCount } = filterData;

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
              onClick={setOperations.expandAll}
            >
              全部展開
            </Button>
            <Button
              variant="small"
              size="sm"
              onClick={setOperations.collapseAll}
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
              onClick={() => {
                // React 19: 使用 startRenderTransition 優化篩選
                startRenderTransition(() => {
                  setFilterStatus(status);
                });
              }}
              className={`${filterStatus === status ? 'bg-terminal-primary-light text-terminal-primary' : ''} ${
                isPendingRender ? 'opacity-75' : ''
              }`}
              disabled={isPendingRender}
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
            getDeviceDescription={getDeviceDescription}
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
                deviceDescription={getDeviceDescription(result.deviceIp)}
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

// 自定義比較函數 - 只在關鍵 props 改變時重新渲染
const areEqual = (
  prevProps: BatchOutputDisplayProps, 
  nextProps: BatchOutputDisplayProps
): boolean => {
  // 檢查基本屬性
  if (
    prevProps.statusText !== nextProps.statusText ||
    prevProps.statusClassName !== nextProps.statusClassName
  ) {
    return false;
  }

  // 檢查結果陣列 - 比較長度和內容
  if (prevProps.results.length !== nextProps.results.length) {
    return false;
  }

  // 淺層比較結果陣列（檢查關鍵欄位）
  for (let i = 0; i < prevProps.results.length; i++) {
    const prev = prevProps.results[i];
    const next = nextProps.results[i];
    
    if (
      prev.deviceIp !== next.deviceIp ||
      prev.success !== next.success ||
      prev.output?.length !== next.output?.length ||
      prev.error !== next.error
    ) {
      return false;
    }
  }

  // 函數引用比較
  if (prevProps.onClear !== nextProps.onClear) {
    return false;
  }

  return true;
};

export default React.memo(BatchOutputDisplay, areEqual);