// 鍵盤快捷鍵 Hook
import { useEffect } from 'react';
import { useAppStore } from '@/store';

interface UseKeyboardShortcutsProps {
  onExecute: () => void;
  isExecuting: boolean;
}

export const useKeyboardShortcuts = ({ 
  onExecute, 
  isExecuting 
}: UseKeyboardShortcutsProps) => {
  const { clearOutput, setMode } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果正在執行，忽略快捷鍵
      if (isExecuting) return;

      // 如果焦點在輸入框，讓輸入框處理 Enter 鍵
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl+Enter: 執行指令
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        onExecute();
      }

      // Ctrl+L: 清空輸出
      if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        clearOutput();
      }

      // Ctrl+1: 切換到指令模式
      if (event.ctrlKey && event.key === '1') {
        event.preventDefault();
        setMode('command');
      }

      // Ctrl+2: 切換到 AI 模式
      if (event.ctrlKey && event.key === '2') {
        event.preventDefault();
        setMode('ai');
      }

      // ESC: 聚焦到指令輸入框
      if (event.key === 'Escape') {
        event.preventDefault();
        const commandInput = document.getElementById('command-input') as HTMLInputElement;
        if (commandInput) {
          commandInput.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onExecute, isExecuting, clearOutput, setMode]);
};