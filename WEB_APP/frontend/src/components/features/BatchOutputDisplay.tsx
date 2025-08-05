/**
 * 輸出顯示組件
 * 顯示多設備執行結果的詳細信息
 */
import { useState, useEffect } from 'react';
import { type BatchOutputDisplayProps } from '@/types';
import BatchResultItem from './BatchResultItem';
import Button from '@/components/common/Button';

const BatchOutputDisplay = ({ 
  results, 
  onClear
}: BatchOutputDisplayProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');

  // 當執行完成時自動展開所有項目
  useEffect(() => {
    if (results.length > 0 && expandedItems.size === 0) {
      // 只在首次有結果且當前沒有展開項目時自動展開
      setExpandedItems(new Set(results.map(r => r.deviceIp)));
    }
  }, [results.length, expandedItems.size, results]);

  if (results.length === 0) {
    return null;
  }

  const toggleExpanded = (deviceIp: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(deviceIp)) {
      newExpanded.delete(deviceIp);
    } else {
      newExpanded.add(deviceIp);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      // 複製成功，可以在未來添加通知組件
    });
  };

  const filteredResults = results.filter(result => {
    if (filterStatus === 'success') return result.success;
    if (filterStatus === 'failed') return !result.success;
    return true;
  });

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

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
        ) : (
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

export default BatchOutputDisplay;