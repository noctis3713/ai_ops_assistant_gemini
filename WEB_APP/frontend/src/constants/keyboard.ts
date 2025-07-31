/**
 * 鍵盤快捷鍵常數定義
 */

// 鍵盤按鍵
export const KEYS = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  CTRL: 'Control',
  L: 'l',
  NUM_1: '1',
  NUM_2: '2',
} as const;

// 快捷鍵組合
export const KEYBOARD_SHORTCUTS = {
  // Ctrl + Enter: 執行指令
  EXECUTE: {
    ctrl: true,
    key: KEYS.ENTER,
    description: '執行指令',
  },
  
  // Ctrl + L: 清空輸出
  CLEAR_OUTPUT: {
    ctrl: true,
    key: KEYS.L,
    description: '清空輸出',
  },
  
  // Ctrl + 1: 切換到指令模式
  SWITCH_TO_COMMAND: {
    ctrl: true,
    key: KEYS.NUM_1,
    description: '切換到指令模式',
  },
  
  // Ctrl + 2: 切換到 AI 模式
  SWITCH_TO_AI: {
    ctrl: true,
    key: KEYS.NUM_2,
    description: '切換到 AI 模式',
  },
  
  // ESC: 聚焦到指令輸入框
  FOCUS_INPUT: {
    key: KEYS.ESCAPE,
    description: '聚焦到指令輸入框',
  },
} as const;

// DOM 元素 ID
export const ELEMENT_IDS = {
  COMMAND_INPUT: 'command-input',
  DEVICE_SELECTOR: 'device-selector', 
  MODE_SELECTOR: 'mode-selector',
} as const;

// 可接受鍵盤輸入的元素標籤
export const FOCUSABLE_ELEMENTS = ['INPUT', 'TEXTAREA', 'SELECT'] as const;