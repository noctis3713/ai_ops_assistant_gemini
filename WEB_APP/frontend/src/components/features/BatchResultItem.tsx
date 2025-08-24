/**
 * 結果項目組件
 * 顯示單個設備的執行結果
 */
import React from 'react';
import { type BatchResultItemProps } from '@/types';
import { ERROR_STYLES, NEUTRAL_STYLES } from '@/config';
import { handleCopyToClipboard } from '@/utils/commonHandlers';
import { StatusIndicator } from '@/components/composite';

interface OptimizedBatchResultItemProps extends BatchResultItemProps {
  isExpanded: boolean;
  onExpand: () => void;
  deviceDescription?: string; // 從父組件傳入設備描述
}

const BatchResultItem = ({ 
  result, 
  isExpanded, 
  onExpand, 
  onCopy,
  deviceDescription = '' // 預設空字串
}: OptimizedBatchResultItemProps) => {
  const handleCopyOutput = async () => {
    if (onCopy) {
      const content = `設備: ${result.deviceName} • ${result.deviceIp} • ${deviceDescription}\n\n輸出:\n${result.output || '(無輸出)'}${result.error ? `\n\n錯誤:\n${result.error}` : ''}`;
      const success = await handleCopyToClipboard(content);
      if (success && onCopy) {
        onCopy(content); // 保持原有的回調行為
      }
    }
  };

  return (
    <div className="p-4">
      {/* 標題行 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-3">
          <button
            onClick={onExpand}
            className="expand-arrow-button"
            title={isExpanded ? '收起' : '展開'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          
          <div className="flex items-center space-x-2">
            <StatusIndicator success={result.success} />
            <span className="font-medium text-terminal-text-primary">
              {result.deviceName} • {result.deviceIp} • {deviceDescription}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {onCopy && (
            <button
              onClick={handleCopyOutput}
              className="copy-button"
              title="複製輸出"
            >
              📋
            </button>
          )}
        </div>
      </div>

      {/* 展開的詳細內容 */}
      {isExpanded && (
        <div className="ml-6 space-y-3">
          {/* 輸出內容 */}
          <div>
            <div className={NEUTRAL_STYLES.CODE_BLOCK}>
              {result.output || '(無輸出)'}
            </div>
          </div>

          {/* 錯誤信息 */}
          {result.error && (
            <div>
              <div className="text-sm font-medium text-red-700 mb-1">錯誤信息:</div>
              <div className={ERROR_STYLES.CODE_BLOCK}>
                {result.error}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// 自定義比較函數 - 只在關鍵 props 改變時重新渲染
const areEqual = (
  prevProps: OptimizedBatchResultItemProps, 
  nextProps: OptimizedBatchResultItemProps
): boolean => {
  // 檢查展開狀態
  if (prevProps.isExpanded !== nextProps.isExpanded) {
    return false;
  }

  // 檢查設備描述
  if (prevProps.deviceDescription !== nextProps.deviceDescription) {
    return false;
  }

  // 檢查結果物件的關鍵屬性
  const prevResult = prevProps.result;
  const nextResult = nextProps.result;
  
  if (
    prevResult.deviceIp !== nextResult.deviceIp ||
    prevResult.deviceName !== nextResult.deviceName ||
    prevResult.success !== nextResult.success ||
    prevResult.output !== nextResult.output ||
    prevResult.error !== nextResult.error
  ) {
    return false;
  }

  // 函數引用比較（通常這些是穩定的）
  if (
    prevProps.onExpand !== nextProps.onExpand ||
    prevProps.onCopy !== nextProps.onCopy
  ) {
    return false;
  }

  return true;
};

export default React.memo(BatchResultItem, areEqual);