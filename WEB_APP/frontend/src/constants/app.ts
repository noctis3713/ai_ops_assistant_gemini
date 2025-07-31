/**
 * 應用程式常數定義
 */

// 執行模式枚舉
export const EXECUTION_MODE = {
  COMMAND: 'command',
  AI: 'ai',
} as const;

export type ExecutionMode = typeof EXECUTION_MODE[keyof typeof EXECUTION_MODE];

// 狀態類型枚舉
export const STATUS_TYPE = {
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  NONE: '',
} as const;

export type StatusType = typeof STATUS_TYPE[keyof typeof STATUS_TYPE];

// 進度階段枚舉
export const PROGRESS_STAGE = {
  INIT: 'init',
  CONNECTING: 'connecting',
  EXECUTING: 'executing',
  AI_ANALYZING: 'ai-analyzing',
  COMPLETED: 'completed',
} as const;

export type ProgressStage = typeof PROGRESS_STAGE[keyof typeof PROGRESS_STAGE];

// 進度階段文字對應
export const PROGRESS_STAGE_TEXT = {
  [PROGRESS_STAGE.INIT]: '初始化中...',
  [PROGRESS_STAGE.CONNECTING]: '連接設備中...',
  [PROGRESS_STAGE.EXECUTING]: '執行指令中...',
  [PROGRESS_STAGE.AI_ANALYZING]: 'AI 分析中...',
  [PROGRESS_STAGE.COMPLETED]: '處理完成',
} as const;

// 進度百分比配置
export const PROGRESS_PERCENTAGES = {
  [PROGRESS_STAGE.INIT]: 10,
  [PROGRESS_STAGE.CONNECTING]: 30,
  [PROGRESS_STAGE.EXECUTING]: 70,
  [PROGRESS_STAGE.AI_ANALYZING]: 75,
  [PROGRESS_STAGE.COMPLETED]: 100,
} as const;

// AI 查詢進度時間配置（毫秒）
export const AI_PROGRESS_TIMING = {
  CONNECTING_DELAY: 500,
  EXECUTING_DELAY: 1500,
  ANALYZING_DELAY: 3000,
} as const;

// 常規進度時間配置（毫秒）
export const COMMAND_PROGRESS_TIMING = {
  EXECUTING_DELAY: 1000,
} as const;

// 狀態顯示時間配置（毫秒）
export const STATUS_DISPLAY_DURATION = {
  SUCCESS: 2000,
  ERROR: 5000,
  QUOTA_ERROR: 15000,
} as const;

// 預設文字
export const DEFAULT_TEXT = {
  OUTPUT_WAITING: '等待指令執行...',
  DEVICE_SELECTOR_PLACEHOLDER: '請選擇設備...',
  DEVICE_SELECTOR_LOADING: '載入設備中...',
  
  // 執行結果區域狀態提示
  RESULT_STATUS: {
    SELECT_DEVICE: '請選擇要操作的設備...',
    INPUT_COMMAND: '等待輸入指令...',
    WAITING_RESULT: '請執行...',
  },
  
  // 輸入提示文字
  INPUT_LABEL: {
    COMMAND: '輸入指令',
    AI: '輸入指令',
  },
  
  // 輸入佔位符
  INPUT_PLACEHOLDER: {
    COMMAND: '請輸入 show 指令...',
    AI: '請輸入您想了解的網路設備問題...',
  },
  
  // 按鈕文字
  BUTTON_TEXT: {
    COMMAND: '執行',
    AI: '執行',
    COMMAND_EXECUTING: '執行中...',
    AI_EXECUTING: 'AI 分析中...',
  },
  
  // 狀態訊息
  STATUS_MESSAGE: {
    COMMAND_SUCCESS: '指令執行完成',
    AI_SUCCESS: 'AI 問答完成',
    COMMAND_FAILED: '指令執行失敗',
    AI_FAILED: 'AI 問答失敗',
    DEVICE_REQUIRED: '請選擇設備',
    INPUT_REQUIRED: {
      COMMAND: '請輸入指令',
      AI: '請輸入指令',
    },
  },
} as const;

// 常用指令配置 - 設備指令模式
export const QUICK_COMMANDS = [
  {
    id: 'show_ip_int_br',
    command: 'show ip int br',
    description: '介面狀態',
    shortcut: 'IP介面'
  },
] as const;

// AI 問答模式專用指令配置
export const AI_QUICK_COMMANDS = [
  {
    id: 'check_device_temperature',
    command: '確認設備溫度',
    description: '設備溫度',
    shortcut: '溫度檢查'
  },
] as const;

// React Query 快取配置
export const CACHE_CONFIG = {
  STALE_TIME: 2 * 60 * 1000,  // 2分鐘
  CACHE_TIME: 5 * 60 * 1000,  // 5分鐘（gcTime）
  DEVICES_STALE_TIME: 5 * 60 * 1000,  // 設備列表 5分鐘
  DEVICES_CACHE_TIME: 10 * 60 * 1000, // 設備列表 10分鐘
} as const;