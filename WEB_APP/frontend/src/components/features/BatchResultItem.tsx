/**
 * 結果項目組件
 * 顯示單個設備的執行結果
 */
import { type BatchResultItemProps } from '@/types';
import { useAppStore } from '@/store';
import { useDevices } from '@/hooks';

const BatchResultItem = ({ 
  result, 
  isExpanded, 
  onExpand, 
  onCopy 
}: BatchResultItemProps & { 
  isExpanded: boolean; 
  onExpand: () => void; 
}) => {
  const { executionStartTime } = useAppStore();
  const { data: devices } = useDevices();
  
  // 根據 IP 查找設備描述
  const getDeviceDescription = (deviceIp: string) => {
    const device = devices?.find((d) => d.ip === deviceIp);
    return device?.description || '';
  };
  const handleCopyOutput = () => {
    if (onCopy) {
      const content = `設備: ${result.deviceName} • ${result.deviceIp} • ${getDeviceDescription(result.deviceIp)}\n\n輸出:\n${result.output}${result.error ? `\n\n錯誤:\n${result.error}` : ''}`;
      onCopy(content);
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
            <span className={result.success ? 'status-indicator-success' : 'status-indicator-error'}></span>
            <span className="font-medium text-terminal-text-primary">
              {result.deviceName} • {result.deviceIp} • {getDeviceDescription(result.deviceIp)}
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
            <div className="text-sm font-medium text-terminal-text-primary mb-1">
              {executionStartTime ? new Date(executionStartTime).toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).replace(/\//g, '-') : '執行時間未知'}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm font-mono text-terminal-text-primary whitespace-pre-wrap">
              {result.output || '(無輸出)'}
            </div>
          </div>

          {/* 錯誤信息 */}
          {result.error && (
            <div>
              <div className="text-sm font-medium text-red-700 mb-1">錯誤信息:</div>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm font-mono text-red-800 whitespace-pre-wrap">
                {result.error}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default BatchResultItem;