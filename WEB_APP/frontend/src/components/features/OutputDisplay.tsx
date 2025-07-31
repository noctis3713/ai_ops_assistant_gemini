// 輸出顯示組件
import React, { useRef, useEffect } from 'react';
import { type OutputDisplayProps } from '@/types';
import { cn } from '@/utils/utils';
import Button from '@/components/common/Button';

const OutputDisplay: React.FC<OutputDisplayProps> = ({
  output,
  isError,
  onClear,
}) => {
  const outputRef = useRef<HTMLPreElement>(null);

  // 當輸出更新時，滾動到頂部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = 0;
    }
  }, [output]);

  return (
    <div className="card">
      {/* 標題和控制項 */}
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg">
            指令輸出結果
          </h3>
          <Button
            variant="small"
            size="sm"
            onClick={onClear}
          >
            清空輸出
          </Button>
        </div>
      </div>

      {/* 輸出內容 */}
      <div className="card-body">
        <pre
          ref={outputRef}
          className={cn(
            'output-display',
            isError && 'error'
          )}
        >
          {output || '等待指令執行...'}
        </pre>
      </div>
    </div>
  );
};

export default OutputDisplay;