/**
 * API 配置常數
 * 集中管理所有 API 相關的配置和常數
 */

// API 基礎配置
export const API_CONFIG = {
  BASE_URL: '/api', // 強制使用相對路徑通過代理訪問
  TIMEOUT: {
    DEFAULT: 30000,      // 30秒
    COMMAND: 60000,      // 指令執行 60秒
    AI_QUERY: 90000,     // AI 查詢 90秒
    BATCH_COMMAND: 180000, // 批次執行 3分鐘
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_BASE: 1000,  // 1秒基礎延遲
    MAX_DELAY: 30000,  // 最大 30秒延遲
  },
} as const;

// API 端點路徑（baseURL 已經包含 /api，這裡不需要重複）
export const API_ENDPOINTS = {
  DEVICES: '/devices',
  DEVICE_GROUPS: '/device-groups',
  BATCH_EXECUTE: '/batch-execute',  // 統一的執行端點，處理所有指令和AI查詢（同步）
  TASK_STATUS: '/tasks',  // 任務狀態查詢端點 (需要加上 /{task_id})
  TASKS: '/tasks',  // 統一的任務端點，處理所有異步操作
  CANCEL_TASK: '/tasks',  // 取消任務端點 (需要加上 /{task_id})
  TASK_MANAGER_STATS: '/task-manager/stats',  // 任務管理器統計端點
  BACKEND_CONFIG: '/backend-config',  // 後端配置端點
  HEALTH: '/health',
  ROOT: '/',
} as const;

// HTTP 狀態碼
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// 錯誤訊息對應 - 統一管理所有 HTTP 狀態碼錯誤訊息
export const ERROR_MESSAGES = {
  [HTTP_STATUS.BAD_REQUEST]: '請求參數錯誤，請檢查輸入內容',
  [HTTP_STATUS.UNAUTHORIZED]: '認證失敗，請檢查憑證設定',
  [HTTP_STATUS.FORBIDDEN]: '權限不足，無法執行此操作',
  [HTTP_STATUS.NOT_FOUND]: '請求的資源不存在',
  [HTTP_STATUS.TIMEOUT]: '請求超時，請稍後再試',
  [HTTP_STATUS.UNPROCESSABLE_ENTITY]: '資料驗證失敗，請檢查輸入格式',
  [HTTP_STATUS.TOO_MANY_REQUESTS]: 'API 呼叫頻率過高，請稍後再試',
  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: '伺服器內部錯誤，請聯繫管理員',
  [HTTP_STATUS.BAD_GATEWAY]: '網路閘道器錯誤，請稍後再試',
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: '服務暫時不可用，請稍後再試',
  [HTTP_STATUS.GATEWAY_TIMEOUT]: '網路閘道器超時，請稍後再試',
  DEFAULT: '未知錯誤',
  NETWORK_ERROR: '網路連接失敗，請檢查網路連接或稍後重試',
} as const;

// 可重試的 HTTP 狀態碼
export const RETRYABLE_STATUS_CODES = [
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  0, // 網路錯誤
] as const;

// 請求標頭
export const REQUEST_HEADERS = {
  CONTENT_TYPE: 'application/json',
  ACCEPT: 'application/json',
} as const;