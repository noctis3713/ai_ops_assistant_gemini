# 前端開發指南 - CLAUDE.md

## 專案概述

這是 **網路維運助理** 的前端部分，採用現代化 React + TypeScript 技術棧，提供豐富的網路設備管理和 AI 智能分析功能。

### 技術棧詳細

- **核心框架**: React 19.1.0 + TypeScript 5.8.3
- **建置工具**: Vite 7.0.4 (快速開發和建置)
- **狀態管理**: Zustand 5.0.6 (輕量級狀態管理) + TanStack Query 5.83.0 (伺服器狀態管理)
- **HTTP 客戶端**: Axios 1.11.0 (支援重試和攔截器)
- **樣式系統**: Tailwind CSS 3.4.17 (響應式設計)
- **類型工具**: clsx 2.1.1 (CSS 類別組合)

### 核心特色功能

1. **🚀 非同步任務處理系統**: 使用 `useAsyncTasks` Hook 管理長時間執行的批次操作
2. **📝 統一日誌管理**: 完整的前端日誌系統，支援多重輸出和環境配置
3. **🔄 智能重試機制**: API 調用支援指數退避重試策略
4. **⚡ 雙執行模式**: 同步/非同步執行模式切換，適應不同使用場景
5. **📊 即時進度追蹤**: 完整的任務進度監控和取消機制
6. **🎯 類型安全**: 完整的 TypeScript 類型定義，確保開發時類型安全

## 專案結構詳解

```
WEB_APP/frontend/
├── 📁 src/                     # 源代碼目錄
│   ├── 📁 api/                 # 🌐 API 服務層
│   │   ├── client.ts           # HTTP 客戶端配置 (axios + 攔截器)
│   │   ├── index.ts            # API 統一導出
│   │   └── services.ts         # API 服務函數 (11個端點)
│   ├── 📁 components/          # 🧩 React 組件庫
│   │   ├── 📁 common/          # 通用組件 (Button, ProgressBar, StatusDisplay)
│   │   ├── 📁 features/        # 功能組件 (設備選擇、指令輸入、批次顯示)
│   │   ├── 📁 layout/          # 佈局組件 (Header, Footer)
│   │   └── index.ts            # 組件統一導出
│   ├── 📁 config/              # ⚙️ 配置管理
│   │   ├── api.ts              # API 配置常數和端點定義
│   │   └── logger.ts           # 日誌系統配置管理
│   ├── 📁 constants/           # 📋 常數定義
│   │   ├── app.ts              # 應用程式常數
│   │   ├── index.ts            # 常數統一導出
│   │   └── keyboard.ts         # 鍵盤快捷鍵定義
│   ├── 📁 hooks/               # 🎣 自訂 React Hooks
│   │   ├── index.ts            # Hooks 統一導出
│   │   ├── useAsyncTasks.ts    # 🔥 非同步任務管理 Hook
│   │   ├── useBatchExecution.ts # 批次執行 Hook
│   │   ├── useDeviceGroups.ts  # 設備群組 Hook
│   │   ├── useDevices.ts       # 設備管理 Hook
│   │   ├── useKeyboardShortcuts.ts # 鍵盤快捷鍵 Hook
│   │   └── useLogger.ts        # 🔥 日誌管理 Hook
│   ├── 📁 store/               # 💾 狀態管理 (Zustand)
│   │   ├── appStore.ts         # 主要應用程式狀態
│   │   ├── index.ts            # Store 統一導出
│   │   └── progressTimer.ts    # 進度計時器
│   ├── 📁 styles/              # 🎨 CSS 樣式
│   │   └── index.css           # 全域樣式和 Tailwind CSS
│   ├── 📁 types/               # 📚 TypeScript 類型定義
│   │   ├── api.ts              # API 相關類型
│   │   ├── components.ts       # 組件相關類型
│   │   ├── index.ts            # 類型統一導出
│   │   ├── logger.ts           # 日誌系統類型
│   │   └── store.ts            # 狀態管理類型
│   ├── 📁 utils/               # 🔧 工具函數
│   │   ├── logger.ts           # 🔥 日誌服務核心實現
│   │   ├── queryClient.ts      # TanStack Query 配置
│   │   └── utils.ts            # 通用工具函數
│   ├── App.tsx                 # 🏠 主應用程式組件
│   ├── main.tsx                # 🚀 應用程式入口點
│   └── vite-env.d.ts           # Vite 環境類型定義
├── 📁 public/                  # 靜態資源
├── package.json                # 依賴和腳本配置
├── vite.config.ts              # Vite 建置配置
├── tailwind.config.js          # Tailwind CSS 配置
├── tsconfig.json               # TypeScript 配置
└── CLAUDE.md                   # 👈 本文件
```

## 環境變數配置詳解

### 前端環境變數 (VITE_ 前綴)

在專案根目錄建立 `.env.local` 檔案 (或其他 Vite 支援的環境檔案)：

```env
# =============================================================================
# 🌐 API 服務配置
# =============================================================================
VITE_API_BASE_URL=http://localhost:8000          # 後端 API 基礎 URL

# =============================================================================
# 📝 前端日誌系統配置
# =============================================================================

# 日誌級別: DEBUG | INFO | WARN | ERROR
VITE_LOG_LEVEL=DEBUG                             # 開發環境推薦 DEBUG，生產環境推薦 WARN

# 日誌輸出控制 (true/false)
VITE_ENABLE_CONSOLE_LOG=true                     # 控制台輸出 (開發: true, 生產: false)
VITE_ENABLE_REMOTE_LOG=false                     # 遠端日誌 (開發: false, 生產: true)
VITE_ENABLE_LOCAL_STORAGE_LOG=true               # 本地存儲 (推薦: true)

# 本地存儲配置
VITE_MAX_LOCAL_STORAGE_ENTRIES=200               # 最大儲存條目數 (開發: 200, 生產: 50)

# 遠端日誌端點
VITE_REMOTE_LOG_ENDPOINT=/api/frontend-logs      # 後端日誌接收端點

# 日誌類別篩選 (逗號分隔，空白表示記錄所有)
VITE_LOG_CATEGORIES=api,error,component,user     # 限制記錄的類別，空白表示全部
# 可用類別: api, auth, error, user, performance, debug, component, storage, network

# =============================================================================
# ⚡ 非同步任務配置 (影響前端輪詢行為)
# =============================================================================

# 輪詢間隔控制 (毫秒)
VITE_ASYNC_TASK_POLL_INTERVAL=2000              # 初始輪詢間隔 (推薦: 2000ms)
VITE_ASYNC_TASK_MAX_POLL_INTERVAL=10000         # 最大輪詢間隔 (推薦: 10000ms)

# 超時控制 (毫秒)
VITE_ASYNC_TASK_TIMEOUT=1800000                 # 任務總超時時間 (推薦: 30分鐘)

# 用戶體驗配置
VITE_ASYNC_TASK_AUTO_START_POLLING=true         # 自動開始輪詢 (推薦: true)

# =============================================================================
# 🔧 應用程式功能配置
# =============================================================================

# 功能開關
VITE_ENABLE_KEYBOARD_SHORTCUTS=true             # 鍵盤快捷鍵 (推薦: true)
VITE_ENABLE_PROGRESS_ANIMATION=true              # 進度動畫 (推薦: true)
VITE_ENABLE_BATCH_EXECUTION=true                 # 批次執行功能 (推薦: true)

# UI 配置
VITE_DEFAULT_EXECUTION_MODE=command              # 預設執行模式: command | ai
VITE_DEFAULT_ASYNC_MODE=false                    # 預設非同步模式 (推薦: false)

# 開發工具
VITE_ENABLE_REACT_QUERY_DEVTOOLS=true           # React Query 開發工具 (開發: true, 生產: false)
VITE_ENABLE_ZUSTAND_DEVTOOLS=true               # Zustand Redux DevTools (開發: true, 生產: false)
```

### 環境別建議配置

#### 開發環境 (.env.development)
```env
VITE_LOG_LEVEL=DEBUG
VITE_ENABLE_CONSOLE_LOG=true
VITE_ENABLE_REMOTE_LOG=false
VITE_MAX_LOCAL_STORAGE_ENTRIES=200
VITE_ENABLE_REACT_QUERY_DEVTOOLS=true
VITE_ENABLE_ZUSTAND_DEVTOOLS=true
```

#### 生產環境 (.env.production)
```env
VITE_LOG_LEVEL=WARN
VITE_ENABLE_CONSOLE_LOG=false
VITE_ENABLE_REMOTE_LOG=true
VITE_MAX_LOCAL_STORAGE_ENTRIES=50
VITE_ENABLE_REACT_QUERY_DEVTOOLS=false
VITE_ENABLE_ZUSTAND_DEVTOOLS=false
```

## 前端日誌系統深度解析

### 架構設計

前端日誌系統採用**單例模式**設計，提供統一的日誌管理功能：

```typescript
// 核心架構
LoggerService (單例) → 多重輸出目標
├── 控制台輸出 (開發環境)
├── 本地存儲 (持久化)
└── 遠端伺服器 (生產環境)
```

### LoggerService 核心功能

#### 1. 日誌級別管理
```typescript
export enum LogLevel {
  DEBUG = 0,    // 🔍 開發除錯資訊
  INFO = 1,     // 🚀 一般資訊
  WARN = 2,     // ⚠️ 警告訊息
  ERROR = 3,    // ❌ 錯誤訊息
}
```

#### 2. 多重輸出策略
- **控制台輸出**: 開發環境即時查看，支援彩色標記
- **本地存儲**: 使用 localStorage 持久化，支援條目數量限制
- **遠端傳送**: WARN 和 ERROR 級別自動傳送到後端

#### 3. 環境感知配置
```typescript
// 自動根據 NODE_ENV 調整配置
const defaultConfig = {
  minLevel: isDevelopment() ? LogLevel.DEBUG : LogLevel.WARN,
  enableConsole: isDevelopment(),
  enableRemote: !isDevelopment(),
  // ...
};
```

### useLogger Hook 使用指南

#### 基本使用方式
```typescript
// 在組件中使用
function MyComponent() {
  const { info, error, logUserAction } = useLogger({
    component: 'MyComponent',
    autoLogMount: true,     // 自動記錄組件掛載
    autoLogUnmount: true,   // 自動記錄組件卸載
  });

  const handleClick = () => {
    logUserAction('button-click', 'submit-btn', { timestamp: Date.now() });
    info('使用者點擊了提交按鈕');
  };

  return <button onClick={handleClick}>提交</button>;
}
```

#### 專用日誌方法
```typescript
const {
  // 基本日誌方法
  debug, info, warn, error,
  
  // 組件生命週期
  logComponentMount,
  logComponentUnmount, 
  logComponentError,
  
  // 使用者操作
  logUserAction,
  
  // 效能監控
  logPerformance,
  
  // 工具方法
  getLogs,
  clearLogs,
  getStats,
  exportLogs,
} = useLogger();
```

#### 錯誤邊界整合
```typescript
function ErrorBoundary({ children }) {
  const logError = useErrorLogger('ErrorBoundary');

  return (
    <ReactErrorBoundary
      onError={(error, errorInfo) => {
        logError(error, errorInfo);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

### 日誌類別系統

```typescript
export const LOG_CATEGORIES = {
  API: 'api',              // API 調用相關
  AUTH: 'auth',            // 認證相關
  ERROR: 'error',          // 錯誤處理
  USER: 'user',            // 使用者操作
  PERFORMANCE: 'performance', // 效能監控
  DEBUG: 'debug',          // 除錯資訊
  COMPONENT: 'component',  // 組件生命週期
  STORAGE: 'storage',      // 資料存儲
  NETWORK: 'network',      // 網路操作
} as const;
```

### 日誌輸出範例

#### 控制台輸出格式
```
14:32:15 🚀 INFO [api]<DeviceSelector> API Request: GET /api/devices
14:32:16 🚀 INFO [api]<DeviceSelector> API Response: 200 /api/devices
14:32:20 🚀 INFO [user]<App> 使用者操作: execute | {deviceCount: 2, mode: "command"}
```

#### 本地存儲格式
```json
{
  "timestamp": "2025-07-31T06:32:15.123Z",
  "level": 1,
  "category": "api",
  "message": "API Request: GET /api/devices",
  "component": "DeviceSelector",
  "userId": undefined
}
```

## 前後端 API 協作機制

### HTTP 客戶端配置

#### Axios 實例配置
```typescript
// src/api/client.ts
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,           // 從環境變數載入
  timeout: API_CONFIG.TIMEOUT.DEFAULT,   // 預設 30 秒
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});
```

#### 請求/回應攔截器
```typescript
// 請求攔截器 - 自動日誌記錄
apiClient.interceptors.request.use(
  (config) => {
    log.api.request(config.method?.toUpperCase() || 'UNKNOWN', config.url || '');
    return config;
  }
);

// 回應攔截器 - 錯誤處理和日誌記錄
apiClient.interceptors.response.use(
  (response) => {
    log.api.response(response.status, response.config.url || '');
    return response;
  },
  (error) => {
    // 統一錯誤處理邏輯
    const apiError = {
      status: error.response?.status || 0,
      statusText: error.response?.statusText || 'Network Error',
      message: getErrorMessage(error),
    };
    
    log.api.error('API Response Error', apiError);
    return Promise.reject(apiError);
  }
);
```

### 智能重試機制

#### 重試策略配置
```typescript
export const API_CONFIG = {
  RETRY: {
    MAX_ATTEMPTS: 3,        // 最大重試次數
    DELAY_BASE: 1000,       // 基礎延遲 1 秒
    MAX_DELAY: 30000,       // 最大延遲 30 秒
  },
} as const;

// 可重試的錯誤狀態碼
export const RETRYABLE_STATUS_CODES = [
  502, // Bad Gateway
  503, // Service Unavailable
  0,   // 網路錯誤
] as const;
```

#### 指數退避實現
```typescript
export const createRetryableRequest = <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const attempt = (retryCount: number) => {
      requestFn()
        .then(resolve)
        .catch((error: APIError) => {
          const shouldRetry = 
            retryCount < maxRetries && 
            RETRYABLE_STATUS_CODES.includes(error.status);
            
          if (shouldRetry) {
            // 指數退避: delay = baseDelay * 2^retryCount
            const delay = Math.min(
              baseDelay * Math.pow(2, retryCount), 
              API_CONFIG.RETRY.MAX_DELAY
            );
            
            log.api.retry(retryCount, maxRetries, delay);
            setTimeout(() => attempt(retryCount + 1), delay);
          } else {
            reject(error);
          }
        });
    };
    
    attempt(0);
  });
};
```

### API 端點詳細說明

#### 同步操作端點
```typescript
// 1. 設備管理
getDevices(): Promise<Device[]>                    // GET /api/devices
getDeviceGroups(): Promise<DeviceGroup[]>          // GET /api/device-groups

// 2. 單一設備操作 (向後相容)
executeCommand(request): Promise<string>           // POST /api/execute
queryAI(request): Promise<string>                  // POST /api/ai-query

// 3. 批次操作 (統一端點)
batchExecuteCommand(request): Promise<BatchExecutionResponse>  // POST /api/batch-execute

// 4. 系統狀態
healthCheck(): Promise<{status, message}>          // GET /health
getAPIInfo(): Promise<{version, endpoints, ...}>   // GET /
getAIStatus(): Promise<{ai_available, ...}>        // GET /api/ai-status
```

#### 非同步操作端點 (v1.0.9 新增)
```typescript
// 5. 非同步任務管理
batchExecuteAsync(request): Promise<TaskCreationResponse>      // POST /api/batch-execute-async
getTaskStatus(taskId): Promise<TaskResponse>                  // GET /api/task/{task_id}
getTasks(params?): Promise<TaskListResponse>                  // GET /api/tasks
cancelTask(taskId): Promise<TaskCancelResponse>               // DELETE /api/task/{task_id}
getTaskManagerStats(): Promise<TaskManagerStatsResponse>      // GET /api/task-manager/stats
```

### 超時控制策略

```typescript
export const API_CONFIG = {
  TIMEOUT: {
    DEFAULT: 30000,         // 一般操作 30 秒
    COMMAND: 60000,         // 設備指令 60 秒
    AI_QUERY: 90000,        // AI 查詢 90 秒
    BATCH_COMMAND: 180000,  // 批次操作 3 分鐘
  },
} as const;
```

## 非同步任務處理流程詳解

### useAsyncTasks Hook 架構

這是整個前端最複雜的 Hook，負責管理長時間執行的批次操作：

```typescript
/**
 * 🔥 useAsyncTasks Hook - 核心功能架構
 * 
 * 【設計理念】
 * 1. 使用 TanStack Query 管理伺服器狀態，避免手動狀態管理
 * 2. 採用 useRef 儲存非渲染數據，提升效能
 * 3. 指數退避輪詢策略，減少伺服器負載
 * 4. 完整的錯誤處理和任務取消機制
 * 5. 與 Zustand store 深度整合，同步狀態更新
 */
export const useAsyncTasks = (options: UseAsyncTasksOptions = {}): UseAsyncTasksReturn => {
  // 配置參數解構，提供預設值
  const {
    pollInterval = 2000,           // 初始輪詢間隔 2 秒
    maxPollInterval = 10000,       // 最大輪詢間隔 10 秒
    timeout = 30 * 60 * 1000,      // 總超時 30 分鐘
    autoStartPolling = true,       // 自動開始輪詢
  } = options;

  // 使用 useRef 儲存非渲染數據，避免不必要的重新渲染
  const currentTaskIdRef = useRef<string | null>(null);      // 當前任務 ID
  const pollingStartTimeRef = useRef<number>(0);             // 輪詢開始時間
  const isCancellingRef = useRef<boolean>(false);            // 取消狀態標記

  // Store 狀態管理集成
  const {
    setCurrentTask,        // 設置當前任務
    setIsAsyncMode,        // 設置非同步模式
    updateTaskProgress,    // 更新任務進度
    setBatchResults,       // 設置批次結果
    setStatus,             // 設置狀態訊息
    setIsExecuting,        // 設置執行狀態
  } = useAppStore();
  
  // ... 其他實現邏輯
};
```

### 任務生命週期管理

#### 1. 任務建立階段
```typescript
// 任務建立 Mutation - 使用 TanStack Query 管理狀態
const batchMutation = useMutation<TaskResponse, APIError, BatchExecuteRequest>({
  mutationFn: async (request) => {
    // 📡 調用後端 API 建立非同步任務
    const response = await batchExecuteAsync(request);
    
    // 🔄 轉換為統一的任務格式
    return {
      task_id: response.task_id,
      status: 'pending' as const,
      task_type: 'batch_execute' as const,
      created_at: new Date().toISOString(),
      progress: { 
        percentage: 0, 
        current_stage: '初始化任務...', 
        completed_devices: 0, 
        total_devices: request.devices.length 
      },
      result: null,
      error: null
    };
  },
  
  // 🚀 任務建立前的狀態設置
  onMutate: () => {
    setIsAsyncMode(true);           // 啟用非同步模式
    setStoreExecuting(true);        // 設置執行狀態
    setStatus('建立非同步任務...', 'loading');
  },
  
  // ✅ 任務建立成功
  onSuccess: (taskData) => {
    currentTaskIdRef.current = taskData.task_id;         // 儲存任務 ID
    pollingStartTimeRef.current = Date.now();            // 記錄輪詢開始時間
    setCurrentTask(taskData);                             // 更新 Store 狀態
    setStatus('任務已建立，開始執行...', 'loading');
  },
  
  // ❌ 任務建立失敗
  onError: (error) => {
    setStoreExecuting(false);
    setIsAsyncMode(false);
    const errorMessage = error.message || '建立任務失敗';
    setStatus(`建立任務失敗: ${errorMessage}`, 'error');
  },
});
```

#### 2. 任務輪詢階段
```typescript
// 🔄 智能輪詢策略 - 指數退避算法
const calculatePollInterval = useCallback((data: TaskResponse | undefined) => {
  if (!data || !currentTaskIdRef.current) return false;
  
  // 任務完成時停止輪詢
  if (['completed', 'failed', 'cancelled'].includes(data.status)) {
    return false;
  }
  
  // 📈 根據執行時間動態調整間隔
  const elapsedTime = Date.now() - pollingStartTimeRef.current;
  const baseInterval = pollInterval;
  
  // 每 10 秒增加一個倍數，最多 5 倍，最大不超過 maxPollInterval
  const multiplier = Math.min(Math.floor(elapsedTime / 10000) + 1, 5);
  
  return Math.min(baseInterval * multiplier, maxPollInterval);
}, [pollInterval, maxPollInterval]);

// 任務狀態輪詢 Query - 核心輪詢邏輯
const taskQuery = useQuery<TaskResponse, APIError>({
  queryKey: ['taskStatus', currentTaskIdRef.current],
  queryFn: () => getTaskStatus(currentTaskIdRef.current!),
  enabled: !!currentTaskIdRef.current,                    // 只有當任務 ID 存在時才啟用
  refetchInterval: (data) => calculatePollInterval(data), // 動態輪詢間隔
  refetchIntervalInBackground: true,                      // 背景輪詢
  staleTime: 0,                                          // 總是認為數據過時
  
  // ✅ 輪詢成功回呼
  onSuccess: (taskData) => {
    setCurrentTask(taskData);                                      // 更新當前任務
    updateTaskProgress(taskData.task_id, taskData.progress.percentage, taskData.progress.current_stage);
    
    // 🏁 檢查任務是否完成
    if (taskData.status === 'completed') {
      setStoreExecuting(false);
      if (taskData.result) {
        setBatchResults(taskData.result.results || []);
        setStatus('任務執行完成', 'success');
      }
      currentTaskIdRef.current = null;  // 清理任務 ID
      
    } else if (taskData.status === 'failed') {
      setStoreExecuting(false);
      setStatus(taskData.error || '任務執行失敗', 'error');
      currentTaskIdRef.current = null;
      
    } else if (taskData.status === 'cancelled') {
      setStoreExecuting(false);
      setStatus('任務已被取消', 'warning');
      currentTaskIdRef.current = null;
    }
  },
  
  // ❌ 輪詢失敗回呼
  onError: (error) => {
    setStoreExecuting(false);
    const errorMessage = error.message || '查詢任務狀態失敗';
    setStatus(`輪詢失敗: ${errorMessage}`, 'error');
    currentTaskIdRef.current = null;
  },
});
```

#### 3. 任務取消機制
```typescript
/**
 * 🛑 取消當前任務
 * 
 * 【實現邏輯】
 * 1. 檢查任務狀態和取消鎖定
 * 2. 向後端發送取消請求
 * 3. 根據取消結果更新前端狀態
 * 4. 錯誤處理：取消失敗時保留任務繼續監控
 */
const cancelCurrentTask = useCallback(async (): Promise<boolean> => {
  // 🔒 防重複取消檢查
  if (!currentTaskIdRef.current || isCancellingRef.current) {
    return false;
  }

  const taskId = currentTaskIdRef.current;
  
  // 設置取消狀態，防止重複操作
  isCancellingRef.current = true;
  
  try {
    // 📤 更新 UI 狀態
    setStatus('正在取消任務...', 'loading');
    
    // 📡 向後端發送取消請求
    await cancelTask(taskId);
    
    // ✅ 取消成功：清理所有狀態
    setStatus('任務已成功取消', 'success');
    cleanup();  // 清理函數
    return true;
    
  } catch (error) {
    // ⚠️ 取消失敗：顯示警告但保留任務狀態
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    setStatus(
      `向伺服器發送取消請求失敗：${errorMessage}。任務可能仍在執行中，建議繼續監控任務狀態。`, 
      'warning'
    );
    
    // 🔑 重要：不調用 cleanup()，保留任務 ID 以供繼續輪詢
    return false;
    
  } finally {
    // 🔓 無論成功或失敗，都重置取消狀態
    isCancellingRef.current = false;
  }
}, [setStatus, cleanup]);
```

### 狀態衍生和計算

```typescript
// 🎯 從 TanStack Query 狀態衍生的計算屬性
const isSubmitting = batchMutation.isPending;                    // 任務建立中
const isPolling = taskQuery.isFetching && !!currentTaskIdRef.current;  // 輪詢中
const isExecuting = isSubmitting || isPolling;                   // 總執行狀態
const error = batchMutation.error?.message || taskQuery.error?.message || null;  // 錯誤狀態

// 返回的 Hook 介面
return {
  // 核心方法
  executeAsync,           // 建立並執行非同步任務
  executeAsyncAndWait,    // 建立任務並等待完成 (便利方法)
  startPolling,           // 開始輪詢指定任務
  stopPolling,            // 停止當前輪詢
  cancelCurrentTask,      // 取消當前任務
  queryTaskStatus,        // 手動查詢任務狀態
  
  // 狀態屬性 (衍生自 TanStack Query)
  isExecuting,            // 當前執行狀態
  isPolling,              // 當前輪詢狀態
  isCancelling: isCancellingRef.current,  // 當前取消狀態
  error,                  // 錯誤狀態
  
  // 工具方法
  cleanup,                // 清理函數
};
```

### 使用範例

#### 在組件中使用 useAsyncTasks
```typescript
function BatchExecutionComponent() {
  // 🎣 Hook 初始化
  const { 
    executeAsyncAndWait, 
    cancelCurrentTask, 
    isExecuting, 
    isPolling,
    isCancelling,
    error 
  } = useAsyncTasks({
    pollInterval: 3000,      // 自訂輪詢間隔
    timeout: 45 * 60 * 1000, // 自訂超時時間 45 分鐘
  });

  // 🚀 執行非同步批次任務
  const handleAsyncExecution = async () => {
    try {
      const result = await executeAsyncAndWait({
        devices: ['192.168.1.10', '192.168.1.11'],
        command: 'show version',
        mode: 'command',
      });
      
      console.log('任務完成:', result);
    } catch (executionError) {
      console.error('執行失敗:', executionError);
    }
  };

  // 🛑 取消任務
  const handleCancel = async () => {
    const cancelled = await cancelCurrentTask();
    if (cancelled) {
      console.log('任務已成功取消');
    } else {
      console.log('取消請求失敗，任務可能仍在執行');
    }
  };

  return (
    <div>
      <button 
        onClick={handleAsyncExecution}
        disabled={isExecuting}
      >
        {isExecuting ? '執行中...' : '開始執行'}
      </button>
      
      {isPolling && (
        <div>
          <span>任務進行中...</span>
          {isPolling && <div className="spinner">⟳</div>}
        </div>
      )}
      
      {isExecuting && (
        <button 
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? '取消中...' : '取消任務'}
        </button>
      )}
      
      {error && <div className="error">錯誤: {error}</div>}
    </div>
  );
}
```

## ASYNC_TASK_ 環境變數詳解

### 後端環境變數 (影響任務管理器行為)

在 `WEB_APP/backend/config/.env` 檔案中配置：

```env
# =============================================================================
# 🔄 非同步任務管理器配置 (AsyncTaskManager)
# =============================================================================

# 任務清理配置
ASYNC_TASK_CLEANUP_INTERVAL=3600        # 清理檢查間隔(秒)，預設 1 小時
# 說明：系統每隔指定時間檢查一次過期任務並清理
# 建議值：開發環境 600 (10分鐘)，生產環境 3600 (1小時)

ASYNC_TASK_TTL=86400                     # 任務過期時間(秒)，預設 24 小時
# 說明：任務完成後在系統中保留的時間，超過此時間將被自動清理
# 建議值：開發環境 3600 (1小時)，生產環境 86400 (24小時)

# 前端輪詢控制 (影響 useAsyncTasks Hook 行為)
ASYNC_TASK_POLL_INTERVAL=2000            # 前端輪詢間隔(毫秒)，預設 2 秒
# 說明：前端向後端查詢任務狀態的初始間隔時間
# 建議值：本地開發 1000，遠端測試 2000，生產環境 3000

ASYNC_TASK_MAX_POLL_INTERVAL=10000       # 最大輪詢間隔(毫秒)，預設 10 秒
# 說明：指數退避策略的最大間隔時間，避免過度頻繁的請求
# 建議值：開發環境 5000，生產環境 10000

ASYNC_TASK_TIMEOUT=1800000               # 任務總超時時間(毫秒)，預設 30 分鐘
# 說明：單個任務的最大執行時間，超過此時間前端將停止輪詢
# 建議值：快速測試 300000 (5分鐘)，正常操作 1800000 (30分鐘)，大型操作 3600000 (60分鐘)

# 任務管理器效能配置
ASYNC_TASK_MAX_CONCURRENT=10             # 最大並發任務數，預設 10
# 說明：系統同時處理的最大任務數量
# 建議值：根據伺服器效能調整，一般 5-20

ASYNC_TASK_PROGRESS_UPDATE_INTERVAL=1000 # 進度更新間隔(毫秒)，預設 1 秒
# 說明：任務進度更新的頻率
# 建議值：開發環境 500，生產環境 1000
```

### 前端環境變數 (影響用戶體驗)

```env
# =============================================================================
# 🖥️ 前端非同步任務配置 (影響 useAsyncTasks Hook)
# =============================================================================

# 用戶介面配置
VITE_ASYNC_TASK_POLL_INTERVAL=2000       # 前端輪詢間隔(毫秒)
# 說明：與後端 ASYNC_TASK_POLL_INTERVAL 保持一致或略小
# 建議值：與後端配置相同或稍小 100-200ms

VITE_ASYNC_TASK_MAX_POLL_INTERVAL=10000  # 最大輪詢間隔(毫秒)
# 說明：前端指數退避的最大間隔
# 建議值：與後端配置保持一致

VITE_ASYNC_TASK_TIMEOUT=1800000          # 前端任務超時(毫秒)
# 說明：前端等待任務完成的最大時間
# 建議值：與後端配置保持一致或略小

VITE_ASYNC_TASK_AUTO_START_POLLING=true  # 自動開始輪詢
# 說明：任務建立後是否自動開始輪詢
# 建議值：true (用戶體驗更好)

VITE_ASYNC_TASK_SHOW_TASK_ID=false       # 顯示任務 ID
# 說明：是否在 UI 中顯示完整的任務 ID
# 建議值：開發環境 true，生產環境 false

VITE_ASYNC_TASK_ENABLE_CANCEL=true       # 啟用任務取消
# 說明：是否允許用戶取消正在執行的任務
# 建議值：true (提供更好的用戶控制)
```

### 環境別配置建議

#### 開發環境配置
```env
# 開發環境 - 快速反饋和除錯
ASYNC_TASK_CLEANUP_INTERVAL=600          # 10 分鐘清理一次
ASYNC_TASK_TTL=3600                      # 1 小時過期
ASYNC_TASK_POLL_INTERVAL=1000            # 1 秒輪詢
ASYNC_TASK_MAX_POLL_INTERVAL=5000        # 最大 5 秒
ASYNC_TASK_TIMEOUT=600000                # 10 分鐘超時

# 前端對應配置
VITE_ASYNC_TASK_POLL_INTERVAL=1000
VITE_ASYNC_TASK_MAX_POLL_INTERVAL=5000
VITE_ASYNC_TASK_TIMEOUT=600000
VITE_ASYNC_TASK_SHOW_TASK_ID=true        # 開發時顯示 Task ID
```

#### 測試環境配置
```env
# 測試環境 - 平衡效能和回應速度
ASYNC_TASK_CLEANUP_INTERVAL=1800         # 30 分鐘清理
ASYNC_TASK_TTL=21600                     # 6 小時過期
ASYNC_TASK_POLL_INTERVAL=2000            # 2 秒輪詢
ASYNC_TASK_MAX_POLL_INTERVAL=8000        # 最大 8 秒
ASYNC_TASK_TIMEOUT=1200000               # 20 分鐘超時

# 前端對應配置
VITE_ASYNC_TASK_POLL_INTERVAL=2000
VITE_ASYNC_TASK_MAX_POLL_INTERVAL=8000
VITE_ASYNC_TASK_TIMEOUT=1200000
VITE_ASYNC_TASK_SHOW_TASK_ID=false
```

#### 生產環境配置
```env
# 生產環境 - 優化伺服器負載和穩定性  
ASYNC_TASK_CLEANUP_INTERVAL=3600         # 1 小時清理
ASYNC_TASK_TTL=86400                     # 24 小時過期
ASYNC_TASK_POLL_INTERVAL=3000            # 3 秒輪詢 (減少伺服器負載)
ASYNC_TASK_MAX_POLL_INTERVAL=15000       # 最大 15 秒
ASYNC_TASK_TIMEOUT=2700000               # 45 分鐘超時

# 前端對應配置
VITE_ASYNC_TASK_POLL_INTERVAL=3000
VITE_ASYNC_TASK_MAX_POLL_INTERVAL=15000
VITE_ASYNC_TASK_TIMEOUT=2700000
VITE_ASYNC_TASK_SHOW_TASK_ID=false
```

### 配置調優建議

#### 🔧 效能調優
```env
# 高負載環境 - 優先考慮伺服器效能
ASYNC_TASK_POLL_INTERVAL=5000            # 降低輪詢頻率
ASYNC_TASK_MAX_POLL_INTERVAL=30000       # 增加最大間隔
ASYNC_TASK_CLEANUP_INTERVAL=7200         # 延長清理間隔

# 低延遲環境 - 優先考慮回應速度
ASYNC_TASK_POLL_INTERVAL=1000            # 提高輪詢頻率
ASYNC_TASK_MAX_POLL_INTERVAL=5000        # 降低最大間隔
ASYNC_TASK_PROGRESS_UPDATE_INTERVAL=500  # 更頻繁的進度更新
```

#### 🧪 除錯配置
```env
# 除錯模式 - 最大化資訊透明度
VITE_ASYNC_TASK_SHOW_TASK_ID=true        # 顯示任務 ID
VITE_LOG_LEVEL=DEBUG                     # 詳細日誌
VITE_ENABLE_CONSOLE_LOG=true             # 控制台日誌
ASYNC_TASK_TTL=1800                      # 縮短保留時間，方便測試清理
```

## 狀態管理架構 (Zustand + TanStack Query)

### 雙層狀態管理設計

```typescript
/**
 * 🏗️ 狀態管理架構說明
 * 
 * 【設計理念】
 * 1. Zustand: 管理客戶端狀態 (UI 狀態、用戶輸入、本地設定)
 * 2. TanStack Query: 管理伺服器狀態 (API 資料、快取、同步)
 * 3. 兩者協同工作，避免狀態重複和衝突
 */

// 客戶端狀態 (Zustand)
interface AppState {
  // UI 控制狀態
  mode: ExecutionMode;                    // 執行模式: 'command' | 'ai'
  selectedDevices: string[];              // 選中的設備列表
  inputValue: string;                     // 用戶輸入的指令
  isAsyncMode: boolean;                   // 是否為非同步模式
  
  // 視覺反饋狀態  
  progress: ProgressState;                // 進度條狀態
  status: StatusMessage;                  // 狀態訊息
  batchResults: BatchExecutionResult[];   // 批次執行結果
  
  // 非同步任務狀態
  currentTask: TaskResponse | null;       // 當前任務資訊
}

// 伺服器狀態 (TanStack Query)
// - 設備列表: useQuery(['devices'])
// - 設備群組: useQuery(['deviceGroups'])  
// - 任務狀態: useQuery(['taskStatus', taskId])
// - 批次執行: useMutation(['batchExecute'])
```

### Zustand Store 實現

```typescript
// src/store/appStore.ts
export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // 🏠 初始狀態
      ...initialAppState,

      // 🔄 UI 控制動作
      setMode: (mode) => {
        set({ mode }, false, 'setMode');
        // 模式切換時自動清空輸入
        get().setInputValue('');
      },

      setSelectedDevices: (deviceIps) => {
        set({ selectedDevices: deviceIps }, false, 'setSelectedDevices');
      },

      setInputValue: (value) => {
        set({ inputValue: value }, false, 'setInputValue');  
      },

      // 🎯 狀態訊息管理
      setStatus: (message, type) => {
        set(
          { status: { message, type } },
          false,
          'setStatus'
        );
      },

      // 📊 進度狀態管理
      setProgress: (progressUpdate) => {
        set(
          (state) => ({
            progress: { ...state.progress, ...progressUpdate },
          }),
          false,
          'setProgress'
        );
      },

      // 📋 批次結果管理
      setBatchResults: (results) => {
        set({ batchResults: results }, false, 'setBatchResults');
      },

      // 🔄 非同步任務狀態
      setCurrentTask: (task) => {
        set({ currentTask: task }, false, 'setCurrentTask');
      },

      setIsAsyncMode: (isAsync) => {
        set({ isAsyncMode: isAsync }, false, 'setIsAsyncMode');
      },

      // 📈 任務進度更新 (與非同步任務整合)
      updateTaskProgress: (taskId, progress, stage) => {
        set(
          (state) => {
            // 確保是當前任務才更新進度
            if (state.currentTask?.task_id === taskId) {
              return {
                currentTask: {
                  ...state.currentTask,
                  progress: {
                    ...state.currentTask.progress,
                    percentage: progress,
                    current_stage: stage,
                  },
                },
                progress: {
                  isVisible: true,
                  percentage: progress,
                },
              };
            }
            return state;
          },
          false,
          'updateTaskProgress'
        );
      },

      // 🔄 重置所有狀態
      reset: () => {
        set(initialAppState, false, 'reset');
      },
    }),
    {
      name: 'app-store', // Redux DevTools 名稱
    }
  )
);
```

### TanStack Query 配置

```typescript
// src/utils/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🔄 重試配置
      retry: (failureCount, error: any) => {
        // API 錯誤不重試，網路錯誤重試 3 次
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      
      // ⏱️ 快取配置
      staleTime: 5 * 60 * 1000,        // 5 分鐘內認為資料新鮮
      cacheTime: 10 * 60 * 1000,       // 10 分鐘後清除快取
      
      // 🔄 重新獲取配置
      refetchOnWindowFocus: false,      // 視窗焦點變化時不重新獲取
      refetchOnReconnect: true,         // 網路重新連接時重新獲取
    },
    mutations: {
      // 🔄 Mutation 重試配置
      retry: 1,                         // 失敗時重試 1 次
    },
  },
});
```

### Hook 整合範例

```typescript
// 在組件中同時使用兩種狀態管理
function DeviceManagementComponent() {
  // 🏪 客戶端狀態 (Zustand)
  const {
    selectedDevices,
    setSelectedDevices,
    mode,
    setMode,
    isAsyncMode,
    setIsAsyncMode,
  } = useAppStore();

  // 🌐 伺服器狀態 (TanStack Query)  
  const { 
    data: devices = [], 
    isLoading: devicesLoading,
    error: devicesError 
  } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    staleTime: 5 * 60 * 1000,  // 設備列表 5 分鐘內不重新獲取
  });

  // 🔄 批次執行 Mutation
  const batchMutation = useMutation({
    mutationFn: batchExecuteCommand,
    onSuccess: (results) => {
      // 成功後更新客戶端狀態
      useAppStore.getState().setBatchResults(results.results);
      useAppStore.getState().setStatus('執行完成', 'success');
    },
    onError: (error) => {
      useAppStore.getState().setStatus(`執行失敗: ${error.message}`, 'error');
    },
  });

  // 🚀 執行處理函數
  const handleExecute = async () => {
    if (selectedDevices.length === 0) return;

    // 根據模式決定執行方式
    if (isAsyncMode) {
      // 非同步執行 - 使用 useAsyncTasks Hook
      // (由 useAsyncTasks 處理狀態更新)
    } else {
      // 同步執行 - 使用 TanStack Query Mutation
      batchMutation.mutate({
        devices: selectedDevices,
        command: inputValue,
        mode: mode === 'ai' ? 'ai' : 'command',
      });
    }
  };

  return (
    <div>
      {/* 設備選擇 */}
      <DeviceSelector
        devices={devices}
        selectedDevices={selectedDevices}
        onSelectionChange={setSelectedDevices}
        isLoading={devicesLoading}
      />
      
      {/* 執行模式切換 */}
      <ModeToggle
        syncMode={!isAsyncMode}
        onModeChange={(sync) => setIsAsyncMode(!sync)}
      />
      
      {/* 執行按鈕 */}
      <button 
        onClick={handleExecute}
        disabled={batchMutation.isPending}
      >
        {batchMutation.isPending ? '執行中...' : '執行'}
      </button>
    </div>
  );
}
```

## 開發工作流程

### 本地開發環境設置

#### 1. 環境需求
```bash
# 系統需求檢查
node --version     # 需要 Node.js 18+
npm --version      # 需要 npm 8+
```

#### 2. 專案初始化
```bash
# 進入前端目錄
cd WEB_APP/frontend

# 安裝依賴
npm install

# 建立環境變數檔案
cp .env.example .env.local  # 複製範例檔案 (如果有的話)
# 或手動建立 .env.local 檔案
```

#### 3. 開發伺服器啟動
```bash
# 開發模式 (熱重載)
npm run dev
# 預設訪問: http://localhost:5173

# 檢查 TypeScript 類型
npm run type-check  # 或 npx tsc --noEmit

# 代碼品質檢查
npm run lint        # ESLint 檢查
npm run lint:fix    # 自動修復可修復的問題
```

### 建置和部署流程

#### 1. 生產建置
```bash
# 建置生產版本
npm run build

# 預覽建置結果
npm run preview
# 預設訪問: http://localhost:4173

# 檢查建置大小
npm run analyze     # 如果有配置 bundle analyzer
```

#### 2. 建置產出檢查
```bash
# 建置產出目錄結構
dist/
├── assets/           # 靜態資源 (CSS, JS, 圖片)
│   ├── index-[hash].css
│   ├── index-[hash].js
│   └── ...
├── index.html        # 主要 HTML 檔案
└── vite.svg          # 網站圖示

# 檢查檔案大小
ls -lah dist/assets/  # 確保 JS 和 CSS 檔案大小合理
```

#### 3. 部署配置
```nginx
# Nginx 配置範例
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/frontend/dist;
    index index.html;
    
    # SPA 路由支援
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 靜態資源快取
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API 代理 (如果需要)
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 除錯和測試方法

#### 1. 瀏覽器開發工具
```javascript
// 開發時可用的全域除錯工具
window.__APP_DEBUG__ = {
  // 訪問 Zustand store
  store: () => useAppStore.getState(),
  
  // 清空所有狀態
  reset: () => useAppStore.getState().reset(),
  
  // 訪問 TanStack Query 快取
  queryCache: () => queryClient.getQueryCache(),
  
  // 清空查詢快取
  clearCache: () => queryClient.clear(),
  
  // 訪問日誌
  logs: () => logger.getLocalStorageLogs(),
  
  // 清空日誌
  clearLogs: () => logger.clearLocalStorageLogs(),
};
```

#### 2. React Query Devtools
```typescript
// 開發環境啟用 DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      <YourAppComponents />
      
      {/* 只在開發環境顯示 */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </>
  );
}
```

#### 3. 日誌系統除錯
```typescript
// 開發時的日誌除錯
function DebugComponent() {
  const { 
    getLogs, 
    getStats, 
    exportLogs,
    debug, 
    info 
  } = useLogger({
    component: 'DebugComponent'
  });

  // 匯出日誌進行分析
  const exportDebugLogs = () => {
    const logs = exportLogs({ 
      format: 'json',
      filters: { levels: [LogLevel.DEBUG, LogLevel.ERROR] }
    });
    
    // 下載或傳送到分析工具
    console.log('Debug logs:', logs);
  };

  // 檢視日誌統計
  const checkLogStats = () => {
    const stats = getStats();
    info('日誌統計', stats);
  };

  return (
    <div>
      <button onClick={exportDebugLogs}>匯出除錯日誌</button>
      <button onClick={checkLogStats}>檢視日誌統計</button>
    </div>
  );
}
```

#### 4. 非同步任務除錯
```typescript
// 除錯非同步任務
function AsyncTaskDebugger() {
  const { 
    queryTaskStatus, 
    isExecuting, 
    isPolling,
    error 
  } = useAsyncTasks();

  // 手動查詢任務狀態
  const debugTaskStatus = async (taskId: string) => {
    try {
      const task = await queryTaskStatus(taskId);
      console.log('任務狀態:', task);
    } catch (err) {
      console.error('查詢失敗:', err);
    }
  };

  // 監控執行狀態
  useEffect(() => {
    console.log('執行狀態變化:', { isExecuting, isPolling, error });
  }, [isExecuting, isPolling, error]);

  return (
    <div>
      <div>執行中: {isExecuting ? 'Yes' : 'No'}</div>
      <div>輪詢中: {isPolling ? 'Yes' : 'No'}</div>
      <div>錯誤: {error || 'None'}</div>
    </div>
  );
}
```

### 效能優化建議

#### 1. 組件優化
```typescript
// 使用 React.memo 避免不必要的重新渲染
const DeviceListItem = React.memo(({ device, selected, onSelect }) => {
  return (
    <div 
      className={selected ? 'selected' : ''} 
      onClick={() => onSelect(device.ip)}
    >
      {device.name} ({device.ip})
    </div>
  );
});

// 使用 useCallback 快取函數參考
function DeviceList({ devices, selectedDevices, onSelectionChange }) {
  const handleDeviceSelect = useCallback((deviceIp: string) => {
    const newSelection = selectedDevices.includes(deviceIp)
      ? selectedDevices.filter(ip => ip !== deviceIp)
      : [...selectedDevices, deviceIp];
    
    onSelectionChange(newSelection);
  }, [selectedDevices, onSelectionChange]);

  return (
    <div>
      {devices.map(device => (
        <DeviceListItem
          key={device.ip}
          device={device}
          selected={selectedDevices.includes(device.ip)}
          onSelect={handleDeviceSelect}
        />
      ))}
    </div>
  );
}
```

#### 2. 查詢優化
```typescript
// 智能快取策略
const { data: devices } = useQuery({
  queryKey: ['devices'],
  queryFn: getDevices,
  staleTime: 5 * 60 * 1000,        // 5 分鐘內不重新獲取
  cacheTime: 10 * 60 * 1000,       // 10 分鐘後清除快取
  refetchOnWindowFocus: false,      // 避免不必要的重新獲取
});

// 預加載相關資料
const prefetchDeviceGroups = () => {
  queryClient.prefetchQuery({
    queryKey: ['deviceGroups'],
    queryFn: getDeviceGroups,
    staleTime: 5 * 60 * 1000,
  });
};
```

#### 3. 打包優化
```typescript
// vite.config.ts - 建置優化配置
export default defineConfig({
  plugins: [react()],
  
  build: {
    // 代碼分割
    rollupOptions: {
      output: {
        manualChunks: {
          // 將大型依賴庫分離
          'react-vendor': ['react', 'react-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['zustand', 'clsx'],
        },
      },
    },
    
    // 壓縮配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // 生產環境移除 console.log
        drop_debugger: true,
      },
    },
  },
  
  // 別名配置 (改善導入路徑)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

## 最佳實踐指南

### TypeScript 類型安全實踐

#### 1. 嚴格類型配置
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,                    // 啟用所有嚴格檢查
    "noImplicitAny": true,            // 禁止隱式 any
    "strictNullChecks": true,         // 嚴格空值檢查
    "noImplicitReturns": true,        // 函數必須有返回值
    "noUnusedLocals": true,           // 檢查未使用的局部變數
    "noUnusedParameters": true,       // 檢查未使用的參數
    "exactOptionalPropertyTypes": true // 精確的可選屬性類型
  }
}
```

#### 2. 類型定義最佳實踐
```typescript
// ✅ 好的類型定義
interface Device {
  readonly ip: string;           // 使用 readonly 保護不變數據
  readonly name: string;
  readonly model: string;
  description?: string;          // 明確標記可選屬性
}

// 使用聯合類型代替字串
type ExecutionMode = 'command' | 'ai';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 泛型約束
interface APIResponse<T = unknown> {
  data: T;
  status: number;
  message?: string;
}

// 使用 const assertions 建立嚴格常數
export const API_ENDPOINTS = {
  DEVICES: '/api/devices',
  EXECUTE: '/api/execute',
} as const;

// 從常數推導類型
type APIEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];
```

#### 3. Hook 類型安全
```typescript
// 為自訂 Hook 提供完整類型
interface UseAsyncTasksReturn {
  executeAsync: (request: BatchExecuteRequest) => Promise<string>;
  isExecuting: boolean;
  error: string | null;
  // 明確所有返回值類型
}

export const useAsyncTasks = (
  options: UseAsyncTasksOptions = {}
): UseAsyncTasksReturn => {
  // 實現邏輯...
};

// 組件 Props 類型定義
interface DeviceSelectorProps {
  devices: readonly Device[];      // 使用 readonly 陣列
  selectedDevices: readonly string[];
  onSelectionChange: (devices: readonly string[]) => void;
  isLoading?: boolean;
  className?: string;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  devices,
  selectedDevices,
  onSelectionChange,
  isLoading = false,
  className = '',
}) => {
  // 組件實現...
};
```

### React Hooks 使用規範

#### 1. Hook 調用順序
```typescript
// ✅ 正確：Hook 在組件頂層調用，順序固定
function MyComponent() {
  const [state, setState] = useState(initialValue);
  const { data, isLoading } = useQuery(queryOptions);
  const { executeAsync } = useAsyncTasks();
  
  // 條件 Hook 調用正確方式
  const conditionalData = useMemo(() => {
    if (someCondition) {
      return computeData();
    }
    return null;
  }, [someCondition]);
  
  // ❌ 錯誤：條件性調用 Hook
  // if (someCondition) {
  //   const data = useQuery(queryOptions); // 這會導致錯誤
  // }
  
  return <div>...</div>;
}
```

#### 2. 依賴陣列最佳實踐
```typescript
function MyComponent({ userId }: { userId: string }) {
  const [userData, setUserData] = useState(null);
  
  // ✅ 正確：明確列出所有依賴
  useEffect(() => {
    fetchUserData(userId).then(setUserData);
  }, [userId]); // userId 變化時重新執行
  
  // ✅ 正確：使用 useCallback 快取函數
  const handleSubmit = useCallback((data: FormData) => {
    // 處理提交邏輯
    submitData(userId, data);
  }, [userId]); // 只有 userId 變化時重新建立函數
  
  // ✅ 正確：使用 useMemo 快取計算結果
  const expensiveValue = useMemo(() => {
    return performExpensiveCalculation(userData);
  }, [userData]); // 只有 userData 變化時重新計算
  
  // ❌ 錯誤：遺漏依賴
  // useEffect(() => {
  //   fetchUserData(userId).then(setUserData);
  // }, []); // 遺漏了 userId 依賴
  
  return <div>...</div>;
}
```

#### 3. 自訂 Hook 設計原則
```typescript
// ✅ 好的自訂 Hook 設計
function useDeviceSelection(initialDevices: string[] = []) {
  const [selectedDevices, setSelectedDevices] = useState<string[]>(initialDevices);
  
  // 提供語義化的操作方法
  const selectDevice = useCallback((deviceIp: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceIp) ? prev : [...prev, deviceIp]
    );
  }, []);
  
  const deselectDevice = useCallback((deviceIp: string) => {
    setSelectedDevices(prev => prev.filter(ip => ip !== deviceIp));  
  }, []);
  
  const toggleDevice = useCallback((deviceIp: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceIp) 
        ? prev.filter(ip => ip !== deviceIp)
        : [...prev, deviceIp]
    );
  }, []);
  
  const clearSelection = useCallback(() => {
    setSelectedDevices([]);
  }, []);
  
  const isSelected = useCallback((deviceIp: string) => {
    return selectedDevices.includes(deviceIp);
  }, [selectedDevices]);
  
  // 返回完整的介面
  return {
    selectedDevices,
    selectDevice,
    deselectDevice, 
    toggleDevice,
    clearSelection,
    isSelected,
    hasSelection: selectedDevices.length > 0,
    selectionCount: selectedDevices.length,
  };
}
```

### 組件化設計模式

#### 1. 組件分層架構
```
src/components/
├── common/          # 🔧 通用組件 (Button, Input, Modal)
│   ├── Button.tsx
│   ├── Modal.tsx  
│   └── Form/
├── features/        # 🎯 功能組件 (業務邏輯相關)
│   ├── DeviceManagement/
│   ├── TaskExecution/
│   └── ResultDisplay/
└── layout/          # 🏗️ 佈局組件 (Header, Footer, Sidebar)
    ├── Header.tsx
    └── Footer.tsx
```

#### 2. 組件設計原則
```typescript
// ✅ 好的組件設計
interface ButtonProps {
  // 明確的屬性類型
  variant: 'primary' | 'secondary' | 'danger';
  size: 'small' | 'medium' | 'large';
  
  // 可選屬性有預設值
  disabled?: boolean;
  loading?: boolean;
  
  // 事件處理器明確類型
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  
  // 支援自訂樣式和 HTML 屬性
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium', 
  disabled = false,
  loading = false,
  onClick,
  className = '',
  children,
  ...restProps
}) => {
  // 使用 clsx 組合 CSS 類別
  const buttonClasses = clsx(
    'btn',                                // 基礎樣式
    `btn-${variant}`,                     // 變體樣式
    `btn-${size}`,                        // 尺寸樣式
    {
      'btn-loading': loading,             // 條件樣式
      'btn-disabled': disabled,
    },
    className                             // 自訂樣式
  );
  
  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      {...restProps}
    >
      {loading && <LoadingSpinner />}
      {children}
    </button>
  );
};
```

#### 3. 複合組件模式
```typescript
// ✅ 複合組件設計 - Modal 範例
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> & {
  Header: React.FC<{ children: React.ReactNode }>;
  Body: React.FC<{ children: React.ReactNode }>;
  Footer: React.FC<{ children: React.ReactNode }>;
} = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

// 子組件定義
Modal.Header = ({ children }) => (
  <div className="modal-header">{children}</div>
);

Modal.Body = ({ children }) => (
  <div className="modal-body">{children}</div>
);

Modal.Footer = ({ children }) => (
  <div className="modal-footer">{children}</div>
);

// 使用方式
function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <Modal.Header>
        <h2>設備選擇</h2>
      </Modal.Header>
      <Modal.Body>
        <DeviceSelector />
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={() => setIsOpen(false)}>關閉</Button>
      </Modal.Footer>
    </Modal>
  );
}
```

### 前端安全考量

#### 1. XSS 防護
```typescript
// ✅ 安全的內容渲染
function DisplayOutput({ output }: { output: string }) {
  // React 預設會轉義字串，防止 XSS
  return <div>{output}</div>;
  
  // 如果需要渲染 HTML，使用 DOMPurify 淨化
  const sanitizedHTML = DOMPurify.sanitize(output);
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
}

// ❌ 危險：直接渲染 HTML
// return <div dangerouslySetInnerHTML={{ __html: output }} />;
```

#### 2. 敏感資料保護
```typescript
// ✅ 安全的環境變數處理
const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  // 只有 VITE_ 前綴的變數會暴露到前端
  
  // ❌ 永遠不要把敏感資料放在前端環境變數
  // apiKey: import.meta.env.VITE_API_KEY, // 這是不安全的！
};

// ✅ 敏感操作的安全處理
function DeviceCommandInput({ onExecute }: { onExecute: (cmd: string) => void }) {
  const [command, setCommand] = useState('');
  
  const handleSubmit = () => {
    // 前端基本驗證（但不能替代後端驗證）
    if (command.trim().length === 0) {
      return;
    }
    
    // 記錄操作日誌（不包含敏感內容）
    logger.info('執行指令', { 
      commandLength: command.length,
      timestamp: Date.now()
      // 不記錄實際指令內容，避免日誌洩露
    });
    
    onExecute(command);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder="輸入設備指令..."
      />
      <button type="submit">執行</button>
    </form>
  );
}
```

#### 3. CSRF 和請求安全
```typescript
// ✅ 安全的 API 客戶端配置
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 30000,
  
  // 安全標頭
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF 保護
  },
  
  // 只發送同源 Cookie (如果使用 Cookie 認證)
  withCredentials: false, // 根據實際認證方案調整
});

// 請求攔截器 - 添加認證資訊
apiClient.interceptors.request.use((config) => {
  // 如果使用 JWT Token
  const token = getAuthToken(); // 從安全儲存取得
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});
```

## 故障排除指南

### 常見問題與解決方案

#### 1. 建置問題
```bash
# 問題：TypeScript 編譯錯誤
# 解決：檢查類型定義
npm run type-check
# 查看具體錯誤並修復類型問題

# 問題：記憶體不足
# 解決：增加 Node.js 記憶體限制
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 問題：依賴版本衝突
# 解決：清除快取並重新安裝
rm -rf node_modules package-lock.json
npm install
```

#### 2. 執行時問題
```typescript
// 問題：非同步任務輪詢失敗
// 診斷方法
const { error, isPolling } = useAsyncTasks();

useEffect(() => {
  if (error) {
    console.error('輪詢錯誤:', error);
    // 檢查網路連接、API 狀態、任務 ID 是否有效
  }
}, [error]);

// 問題：狀態更新不同步
// 解決：檢查 Zustand store 和 TanStack Query 整合
const debugStoreState = () => {
  console.log('Store State:', useAppStore.getState());
  console.log('Query Cache:', queryClient.getQueryCache());
};
```

#### 3. 效能問題
```typescript
// 問題：組件過度重新渲染
// 診斷：使用 React DevTools Profiler

// 解決：優化依賴陣列和記憶化
const memoizedComponent = React.memo(Component, (prevProps, nextProps) => {
  // 自訂比較邏輯
  return prevProps.data === nextProps.data;
});

// 問題：記憶體洩漏
// 解決：清理訂閱和計時器
useEffect(() => {
  const interval = setInterval(() => {
    // 定期任務
  }, 1000);
  
  return () => {
    clearInterval(interval); // 清理計時器
  };
}, []);
```

---

## 總結

這份前端開發指南涵蓋了網路維運助理前端的所有重要面向，從技術架構到實際開發實踐，從環境配置到故障排除。

### 🎯 核心亮點

1. **🚀 現代化技術棧**: React 19 + TypeScript 5.8 + Vite 7.0，提供最佳的開發體驗
2. **🔄 智能非同步處理**: 完整的任務管理系統，支援長時間執行的批次操作
3. **📝 統一日誌管理**: 環境感知的日誌系統，支援開發除錯和生產監控
4. **🎨 響應式設計**: Tailwind CSS 驅動的現代化 UI，適配各種設備
5. **🔧 類型安全**: 完整的 TypeScript 類型定義，確保程式碼品質

### 📚 開發建議

- **開發時**: 啟用詳細日誌和開發工具，使用熱重載提升開發效率
- **測試時**: 使用平衡的配置，模擬真實使用場景
- **生產時**: 優化效能和安全性，啟用遠端日誌和監控

### 🛠️ 持續改進

這份文件會隨著專案的發展持續更新，確保始終反映最新的架構和最佳實踐。

---

**版本**: v1.0.9 (健壯的後端與非同步任務處理版本)  
**更新日期**: 2025-07-31  
**維護者**: 前端開發團隊