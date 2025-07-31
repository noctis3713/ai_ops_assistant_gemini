# 前端架構指南 - CLAUDE.md

> **專為 Claude AI 編寫的前端完整技術文檔**  
> 版本：v1.0.9 | 更新日期：2025-08-01

## 🌟 專案概述

這是**網路維運助理專案**的前端部分，採用現代化 React 技術棧構建，提供直觀的 Web 介面來管理網路設備，支援智能 AI 分析和批次操作。前端與 FastAPI 後端緊密整合，實現了完整的網路維運工作流程。

### 核心定位
- **現代化 Web 前端**: 基於 React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4
- **網路維運介面**: 專業的網路設備管理和指令執行介面
- **AI 智能整合**: 與 Google Gemini AI / Claude AI 無縫整合
- **非同步任務處理**: 完整的長時間任務管理和進度追蹤
- **企業級可靠性**: 完善的錯誤處理、日誌系統和效能監控

### 主要功能特色
- ✅ **雙執行模式**: 同步/非同步執行模式靈活切換
- ✅ **非同步任務管理**: 完整的任務生命週期管理、取消機制、進度追蹤
- ✅ **統一日誌系統**: 多輸出、分級分類、遠端發送、敏感資訊過濾
- ✅ **響應式設計**: 支援桌面、平板、手機多種設備
- ✅ **類型安全**: 完整的 TypeScript 類型定義和嚴格模式
- ✅ **現代化狀態管理**: Zustand + TanStack Query 組合
- ✅ **智能錯誤處理**: 統一錯誤格式、自動重試、使用者友善訊息

---

## 🏗️ 技術架構詳解

### 現代化技術棧

#### 核心框架
```json
{
  "react": "^19.1.0",           // 最新 React 19，Fiber 架構
  "react-dom": "^19.1.0",      // DOM 渲染引擎
  "typescript": "~5.8.3",      // TypeScript 5.8，完整類型安全
  "vite": "^7.0.4"             // Vite 7.0，極速開發建置
}
```

#### 狀態管理和資料層
```json
{
  "zustand": "^5.0.6",              // 輕量級全域狀態管理
  "@tanstack/react-query": "^5.83.0", // 伺服器狀態管理和快取
  "axios": "^1.11.0"                // HTTP 客戶端，完整錯誤處理
}
```

#### UI 和樣式
```json
{
  "tailwindcss": "^3.4.17",    // Utility-first CSS 框架
  "clsx": "^2.1.1"             // CSS 類別條件組合
}
```

#### 開發工具
```json
{
  "@tanstack/react-query-devtools": "^5.83.0", // React Query 調試工具
  "eslint": "^9.30.1",                          // ESLint 程式碼檢查
  "typescript-eslint": "^8.35.1"                // TypeScript ESLint 整合
}
```

### 架構設計原則

#### 1. **模組化分層架構**
```
├── api/           # API 服務層
│   ├── client.ts   # HTTP 客戶端配置
│   └── services.ts # API 服務函數
├── components/     # 組件層
│   ├── common/     # 通用組件
│   ├── features/   # 功能組件
│   └── layout/     # 佈局組件
├── hooks/         # 自訂 Hooks
├── store/         # 狀態管理
├── types/         # TypeScript 類型
└── utils/         # 工具函數
```

#### 2. **關注點分離 (Separation of Concerns)**
- **API 層**: 處理所有後端通訊和錯誤處理
- **狀態層**: 客戶端狀態 (Zustand) + 伺服器狀態 (TanStack Query)
- **組件層**: 純展示組件 + 容器組件
- **工具層**: 日誌、工具函數、配置管理

#### 3. **函式組件 + Hooks 模式**
- 全面採用 React Hooks，無 Class 組件
- 自訂 Hooks 封裝業務邏輯
- 組件責任單一，高度可重用

---

## 📁 目錄結構詳解

### 完整目錄樹狀圖
```
WEB_APP/frontend/
├── 📁 config/                    # 前端環境配置
│   └── ...
├── 📁 src/                      # 源代碼主目錄
│   ├── 📄 main.tsx               # 應用程式入口點
│   ├── 📄 App.tsx                # 主應用程式組件
│   ├── 📄 vite-env.d.ts          # Vite 環境類型定義
│   ├── 📁 api/                   # 🌐 API 服務層
│   │   ├── client.ts              # HTTP 客戶端和攔截器
│   │   ├── services.ts            # API 服務函數
│   │   └── index.ts              # API 層統一導出
│   ├── 📁 components/            # 🧩 React 組件
│   │   ├── 📁 common/             # 通用組件
│   │   │   ├── Button.tsx         # 統一按鈕組件
│   │   │   ├── ProgressBar.tsx    # 進度條組件
│   │   │   ├── StatusDisplay.tsx  # 狀態顯示組件
│   │   │   └── ...
│   │   ├── 📁 features/           # 功能組件
│   │   │   ├── DeviceSelectionContainer.tsx # 設備選擇容器
│   │   │   ├── CommandInput.tsx   # 指令輸入組件
│   │   │   ├── BatchOutputDisplay.tsx # 批次輸出顯示
│   │   │   └── ...
│   │   ├── 📁 layout/             # 佈局組件
│   │   │   ├── Header.tsx         # 頁面標頭
│   │   │   └── Footer.tsx         # 頁面尾部
│   │   ├── 📁 debug/              # 調試組件
│   │   │   └── LoggerDashboard.tsx # 日誌監控面板
│   │   └── index.ts              # 組件統一導出
│   ├── 📁 config/                # ⚙️ 前端配置
│   │   └── api.ts                # API 配置常數
│   ├── 📁 constants/             # 📊 常數定義
│   │   ├── app.ts                # 應用程式常數
│   │   ├── keyboard.ts           # 鍵盤快捷鍵配置
│   │   └── index.ts              # 常數統一導出
│   ├── 📁 hooks/                 # 🎣 自訂 React Hooks
│   │   ├── useAsyncTasks.ts      # 非同步任務管理
│   │   ├── useLogger.ts          # 日誌記錄 Hook
│   │   ├── useBatchExecution.ts  # 批次執行邏輯
│   │   ├── useDevices.ts         # 設備管理
│   │   ├── useDeviceGroups.ts    # 設備群組管理
│   │   ├── useKeyboardShortcuts.ts # 鍵盤快捷鍵
│   │   └── index.ts              # Hooks 統一導出
│   ├── 📁 store/                 # 🗃️ 狀態管理
│   │   ├── appStore.ts           # Zustand 主要應用狀態
│   │   ├── progressTimer.ts      # 進度計時器狀態
│   │   └── index.ts              # 狀態管理統一導出
│   ├── 📁 types/                 # 📝 TypeScript 類型定義
│   │   ├── api.ts                # API 相關類型
│   │   ├── components.ts         # 組件相關類型
│   │   ├── store.ts              # 狀態管理類型
│   │   └── index.ts              # 類型統一導出
│   ├── 📁 utils/                 # 🛠️ 工具函數
│   │   ├── LoggerService.ts      # 統一日誌服務
│   │   ├── queryClient.ts        # TanStack Query 配置
│   │   ├── utils.ts              # 通用工具函數
│   │   └── envTest.ts            # 環境變數測試
│   └── 📁 styles/                # 🎨 樣式檔案
│       └── index.css             # 全域 CSS 樣式
├── 📄 package.json               # 專案依賴和腳本
├── 📄 tsconfig.json              # TypeScript 配置
├── 📄 vite.config.ts             # Vite 建置配置
├── 📄 tailwind.config.js         # Tailwind CSS 配置
├── 📄 eslint.config.js           # ESLint 配置
└── 📄 index.html                 # HTML 入口模板
```

### 關鍵目錄說明

#### `/src/api/` - API 服務層
**職責**: 處理所有與後端的通訊邏輯
- `client.ts`: Axios 客戶端配置、請求/回應攔截器、錯誤處理
- `services.ts`: 所有後端 API 的封裝函數，包含 11 個端點

#### `/src/hooks/` - 自訂 Hooks 生態系統
**職責**: 封裝可重用的業務邏輯
- `useAsyncTasks.ts`: 非同步任務管理的完整 Hook
- `useLogger.ts`: 日誌記錄功能，支援多種特殊化版本
- `useBatchExecution.ts`: 批次執行邏輯封裝

#### `/src/store/` - 狀態管理中心
**職責**: 管理全域應用狀態
- `appStore.ts`: Zustand 狀態管理，包含 UI 狀態、執行狀態、任務狀態

#### `/src/components/` - 組件生態系統
**職責**: 三層組件架構
- `common/`: 可重用的基礎組件
- `features/`: 業務功能組件
- `layout/`: 頁面佈局組件

---

## 🔧 核心模組深度分析

### 1. API 層架構 (`/src/api/`)

#### HTTP 客戶端 (`client.ts`)
```typescript
// 主要特色
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,          // 環境變數配置
  timeout: API_CONFIG.TIMEOUT.DEFAULT,   // 統一超時控制
  headers: { /* 統一請求標頭 */ }
});
```

**核心功能**:
- ✅ **請求攔截器**: 自動添加時間戳、記錄 API 請求日誌
- ✅ **回應攔截器**: 計算響應時間、記錄效能指標、統一錯誤處理
- ✅ **自動重試機制**: 指數退避策略，最多 3 次重試
- ✅ **錯誤統一化**: 轉換為 `APIError` 介面，提供使用者友善訊息

#### API 服務層 (`services.ts`)
**11 個後端端點完整封裝**:

##### 基礎設備管理
```typescript
export const getDevices = async (): Promise<Device[]>         // 獲取設備列表
export const getDeviceGroups = async (): Promise<DeviceGroup[]> // 獲取設備群組
```

##### 同步執行 API
```typescript
export const executeCommand = async (request: ExecuteRequest): Promise<string>
export const queryAI = async (request: AIQueryRequest): Promise<string>
export const batchExecuteCommand = async (request: BatchExecuteRequest): Promise<BatchExecutionResponse>
```

##### 非同步任務管理 API (v1.0.9 新增)
```typescript
export const batchExecuteAsync = async (request: BatchExecuteRequest): Promise<TaskCreationResponse>
export const getTaskStatus = async (taskId: string): Promise<TaskResponse>
export const getTasks = async (params?: TaskListParams): Promise<TaskListResponse>
export const cancelTask = async (taskId: string): Promise<TaskCancelResponse>
export const getTaskManagerStats = async (): Promise<TaskManagerStatsResponse>
```

##### 日誌系統 API
```typescript
export const sendFrontendLogs = async (request: RemoteLogRequest): Promise<RemoteLogResponse>
export const getFrontendLogConfig = async (): Promise<FrontendLogConfig>
```

##### 輔助工具
```typescript
export const pollTaskUntilComplete = async (taskId: string, options: PollOptions): Promise<TaskResponse>
export const executeAsyncBatchAndWait = async (request: BatchExecuteRequest): Promise<BatchExecutionResponse>
```

### 2. 狀態管理架構 (`/src/store/`)

#### Zustand 應用狀態 (`appStore.ts`)
**完整狀態樹結構**:
```typescript
interface AppState {
  // UI 狀態
  mode: 'command' | 'ai'                    // 執行模式
  deviceSelectionMode: 'multiple'          // 設備選擇模式
  selectedDevices: string[]                // 已選設備列表
  inputValue: string                       // 輸入指令內容
  
  // 執行狀態  
  isExecuting: boolean                     // 是否正在執行
  isBatchExecution: boolean                // 是否批次執行
  
  // 進度狀態
  progress: ProgressState                  // 單一操作進度
  batchProgress: BatchProgressState        // 批次操作進度
  
  // 輸出狀態
  batchResults: BatchExecutionResult[]     // 批次執行結果
  status: StatusMessage                    // 狀態訊息
  
  // 非同步任務狀態 (v1.0.9)
  currentTask: TaskResponse | null         // 當前任務
  isAsyncMode: boolean                     // 是否非同步模式
  taskPollingActive: boolean               // 是否正在輪詢
}
```

**Redux DevTools 整合**:
```typescript
export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({ /* 狀態和動作 */ }),
    { name: 'app-store' }  // Redux DevTools 中的名稱
  )
);
```

#### TanStack Query 配置 (`utils/queryClient.ts`)
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5分鐘快取
      cacheTime: 10 * 60 * 1000,     // 10分鐘記憶體保存
      retry: (failureCount, error) => {
        return failureCount < 3;       // 最多重試3次
      },
    },
  },
});
```

### 3. 非同步任務管理系統 (`/src/hooks/useAsyncTasks.ts`)

#### 完整功能特色
- ✅ **任務建立**: `executeAsync()` - 建立非同步任務並返回 task_id
- ✅ **任務輪詢**: 智能輪詢策略，2秒到10秒指數退避
- ✅ **進度追蹤**: 即時進度百分比和階段描述更新
- ✅ **任務取消**: `cancelCurrentTask()` - 使用者主動取消
- ✅ **執行等待**: `executeAsyncAndWait()` - 建立任務並等待完成
- ✅ **超時控制**: 30分鐘總超時時間
- ✅ **錯誤恢復**: 完善的錯誤處理和失敗恢復

#### 核心輪詢邏輯
```typescript
const pollTask = useCallback(async (taskId: string) => {
  let currentInterval = pollInterval;  // 起始 2 秒
  
  const poll = async () => {
    const task = await getTaskStatus(taskId);
    
    // 更新進度到全域狀態
    updateTaskProgress(taskId, task.progress.percentage, task.progress.current_stage);
    
    // 檢查任務完成狀態
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return handleTaskCompletion(task);
    }
    
    // 指數退避策略
    currentInterval = Math.min(currentInterval * 1.2, maxPollInterval);
    pollingRef.current = setTimeout(poll, currentInterval);
  };
  
  await poll();
}, [/* 相依項目 */]);
```

### 4. 統一日誌系統 (`/src/utils/LoggerService.ts`)

#### 多輸出架構
```typescript
class LoggerService {
  // 三種輸出模式
  private outputToConsole(entry: LogEntry): void     // 瀏覽器控制台
  private saveToLocalStorage(entry: LogEntry): void  // 本地存儲
  private addToBuffer(entry: LogEntry): void         // 遠端後端
}
```

#### 分級分類系統
```typescript
// 日誌級別
enum LogLevel {
  DEBUG = 0,    // 調試資訊
  INFO = 1,     // 一般資訊  
  WARN = 2,     // 警告訊息
  ERROR = 3     // 錯誤訊息
}

// 日誌分類
enum LogCategory {
  API = 'api',                    // API 請求/回應
  AUTH = 'auth',                  // 認證相關
  ERROR = 'error',                // 錯誤記錄
  USER = 'user',                  // 使用者操作
  PERFORMANCE = 'performance',    // 效能監控
  DEBUG = 'debug',                // 調試資訊
  COMPONENT = 'component',        // 組件生命週期
  STORAGE = 'storage',            // 本地存儲
  NETWORK = 'network'             // 網路相關
}
```

#### 智能功能
- ✅ **敏感資訊過濾**: 自動過濾 `password`, `token`, `apiKey` 等欄位
- ✅ **批次發送**: 10 條日誌為一批，30 秒間隔發送到後端
- ✅ **效能監控**: 自動記錄超過閾值 (100ms) 的操作
- ✅ **LRU 清理**: 本地存儲最多保留 100 條日誌
- ✅ **環境配置**: 支援 12 個 Vite 環境變數配置

### 5. React Hooks 生態系統

#### `useLogger` Hook - 日誌記錄
```typescript
export const useLogger = (options: UseLoggerOptions = {}): UseLoggerReturn => {
  const { componentName, enablePerformanceTracking } = options;
  
  return {
    debug: (message: string, data?: any) => void,
    info: (message: string, data?: any) => void,
    warn: (message: string, data?: any, error?: Error) => void,
    error: (message: string, data?: any, error?: Error) => void,
    logPerformance: (operation: string, duration: number) => void,
    measureAsyncOperation: <T>(operation: string, asyncFn: () => Promise<T>) => Promise<T>,
  };
};
```

#### 特殊化版本
- **`useApiLogger`**: API 專用日誌記錄
- **`useUserActionLogger`**: 使用者行為追蹤
- **`usePerformanceLogger`**: 效能監控專用

---

## 🚀 關鍵功能深度說明

### 1. 雙執行模式系統

#### 同步執行模式
**適用場景**: 快速操作，即時回應需求
```typescript
// 同步執行流程
const { executeBatch } = useBatchExecution();
await executeBatch(selectedDevices, command);
// 立即獲得結果，更新 UI
```

#### 非同步執行模式 (v1.0.9 核心功能)
**適用場景**: 長時間批次操作，避免 HTTP 超時
```typescript
// 非同步執行流程
const { executeAsyncAndWait } = useAsyncTasks();
await executeAsyncAndWait({
  devices: selectedDevices,
  command: inputValue,
  mode: 'ai'
});
// 支援進度追蹤、任務取消、超時控制
```

#### UI 模式切換
```typescript
// App.tsx 中的模式切換邏輯
const handleExecute = async () => {
  if (isAsyncMode) {
    await executeAsyncAndWait({ /* 參數 */ });
  } else {
    executeBatch(selectedDevices, inputValue);
  }
};
```

### 2. 設備管理系統

#### 多設備選擇支援
- **單一設備**: `devices: ["192.168.1.1"]`
- **多設備選擇**: `devices: ["192.168.1.1", "192.168.1.2", "192.168.1.3"]`
- **群組選擇**: 自動展開為群組內所有設備

#### 設備狀態管理
```typescript
// TanStack Query 管理設備數據
const { data: devices = [], isLoading } = useQuery({
  queryKey: ['devices'],
  queryFn: getDevices,
  staleTime: 5 * 60 * 1000,  // 5分鐘快取
});
```

### 3. 智能錯誤處理系統

#### 錯誤分類和映射
```typescript
// API 配置中的錯誤訊息映射
export const ERROR_MESSAGES = {
  400: '請求參數錯誤',
  401: '認證失敗，請檢查設備憑證設定',
  404: '設備不在配置列表中',
  408: 'AI 分析超時，請簡化問題或稍後重試',
  429: 'AI 服務配額已用完，請稍後再試',
  500: '伺服器內部錯誤',
  502: 'Google AI 服務暫時不可用',
  DEFAULT: '未知錯誤',
  NETWORK_ERROR: '網路連接失敗'
};
```

#### 自動重試策略
```typescript
export const createRetryableRequest = <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  // 指數退避延遲策略
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
};
```

---

## 🎨 設計系統 (Tailwind CSS)

### 自訂顏色系統
```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      terminal: {
        // 背景色系
        bg: '#f8f9fa',                    // 主背景色
        'bg-secondary': '#ffffff',        // 次要背景色
        'bg-card': '#ffffff',             // 卡片背景色
        
        // 主要色彩
        primary: '#0066cc',               // 主色
        'primary-hover': '#0056b3',       // 主色懸停
        'primary-light': '#cce7ff',       // 主色淺色
        
        // 狀態色彩
        success: '#198754',               // 成功色
        error: '#dc3545',                 // 錯誤色
        warning: '#ffc107',               // 警告色
        
        // 文字色彩
        'text-primary': '#212529',        // 主要文字
        'text-secondary': '#6c757d',      // 次要文字
        'text-muted': '#868e96',          // 弱化文字
      }
    }
  }
}
```

### 語意化 CSS 類別
```css
/* /src/styles/index.css */
.card {
  @apply bg-terminal-bg-card rounded-lg shadow-card border border-gray-200;
}

.card-body {
  @apply p-6;
}

.btn-primary {
  @apply bg-terminal-primary text-white px-4 py-2 rounded hover:bg-terminal-primary-hover transition-colors;
}

.label-primary {
  @apply block text-sm font-medium text-terminal-text-primary mb-2;
}
```

### 響應式設計
- **桌面優先**: 針對桌面專業使用者設計
- **平板相容**: 支援 iPad 等平板設備
- **手機適配**: 基本的手機瀏覽支援

---

## ⚙️ 環境配置完整指南

### Vite 環境變數
```bash
# /config/.env 檔案配置

# API 配置
VITE_API_BASE_URL=http://localhost:8000     # 後端 API 地址

# 日誌系統配置
VITE_LOG_LEVEL=INFO                         # 日誌級別: DEBUG/INFO/WARN/ERROR
VITE_ENABLE_CONSOLE_LOG=true                # 啟用控制台日誌
VITE_ENABLE_REMOTE_LOG=true                 # 啟用遠端日誌發送
VITE_ENABLE_LOCAL_STORAGE_LOG=true          # 啟用本地存儲日誌
VITE_MAX_LOCAL_STORAGE_ENTRIES=100          # 本地存儲最大條目數
VITE_REMOTE_LOG_ENDPOINT=/api/frontend-logs # 遠端日誌端點
VITE_LOG_CATEGORIES=api,error,user,performance # 啟用的日誌分類
VITE_LOG_SHOW_STACK_TRACE=false             # 顯示錯誤堆疊
VITE_LOG_PERFORMANCE_THRESHOLD=100          # 效能監控閾值(ms)
VITE_LOG_BATCH_SIZE=10                      # 日誌批次大小
VITE_LOG_BATCH_INTERVAL=30000               # 日誌批次間隔(ms)
```

### TypeScript 配置
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,                          // 嚴格模式
    "noUnusedLocals": true,                 // 未使用變數警告
    "noUnusedParameters": true,             // 未使用參數警告
    "noFallthroughCasesInSwitch": true,     // Switch 語句檢查
    "paths": {
      "@/*": ["./src/*"]                    // 路徑別名
    }
  }
}
```

### Vite 建置配置
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  envDir: './config',                       // 環境變數檔案目錄
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // @ 別名指向 src
    },
  },
});
```

---

## 🔍 開發和調試工具

### 1. React Query DevTools
```typescript
// main.tsx 中的整合
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```
**功能**: 查看快取狀態、查詢歷史、手動觸發重新獲取

### 2. LoggerDashboard 調試面板
```typescript
// 開發環境專用的日誌監控面板
<LoggerDashboard />
```
**功能**: 
- 即時日誌查看
- 日誌級別過濾
- 本地存儲日誌瀏覽
- 遠端日誌發送狀態

### 3. Zustand Redux DevTools
```typescript
// 在瀏覽器中安裝 Redux DevTools 擴展
// 可以查看所有狀態變化和時間旅行調試
```

### 4. 環境變數測試 (`utils/envTest.ts`)
```typescript
// 開發環境下自動執行，驗證環境配置
if (import.meta.env.DEV) {
  import('@/utils/envTest');
}
```

---

## 📊 效能優化策略

### 1. 代碼分割和懶載入
```typescript
// React.lazy() 組件懶載入
const LoggerDashboard = React.lazy(() => import('@/components/debug/LoggerDashboard'));
```

### 2. TanStack Query 快取策略
```typescript
// 智能快取配置
{
  staleTime: 5 * 60 * 1000,      // 5分鐘內視為新鮮
  cacheTime: 10 * 60 * 1000,     // 10分鐘記憶體保存
  refetchOnWindowFocus: false,    // 視窗聚焦時不重新獲取
}
```

### 3. 輪詢優化
```typescript
// 指數退避輪詢策略
let currentInterval = 2000;  // 起始 2 秒
currentInterval = Math.min(currentInterval * 1.2, 10000);  // 最大 10 秒
```

### 4. 效能監控
```typescript
// 自動記錄超過閾值的操作
logger.performance(operation, duration, data);
```

---

## 🐛 疑難排解指南

### 常見問題診斷

#### 1. 日誌系統問題
**症狀**: 日誌未發送到後端
```bash
# 檢查環境變數
VITE_ENABLE_REMOTE_LOG=true
VITE_REMOTE_LOG_ENDPOINT=/api/frontend-logs

# 檢查網路請求
# 在瀏覽器開發者工具 Network 面板查看 POST /api/frontend-logs
```

#### 2. 非同步任務問題
**症狀**: 任務輪詢停止或失敗
```typescript
// 檢查任務狀態
const { queryTaskStatus } = useAsyncTasks();
const task = await queryTaskStatus(taskId);
console.log('Task status:', task.status, task.progress);
```

#### 3. API 請求失敗
**症狀**: 所有 API 請求 404 或 500 錯誤
```bash
# 檢查後端服務狀態
curl http://localhost:8000/health

# 檢查 API 基礎 URL 配置
VITE_API_BASE_URL=http://localhost:8000
```

#### 4. TanStack Query 快取問題
**症狀**: 數據未更新或過度請求
```typescript
// 手動重新獲取
const { refetch } = useDevices();
await refetch();

// 清除快取
queryClient.removeQueries(['devices']);
```

### 日誌分析方法

#### 1. 瀏覽器控制台日誌
```bash
# 日誌格式
[2025-08-01T05:43:01.000Z] [INFO] [api] API Request: POST /api/batch-execute-async
```

#### 2. 本地存儲日誌
```javascript
// 獲取本地存儲的日誌
const logs = JSON.parse(localStorage.getItem('frontend_logs') || '[]');
console.table(logs);
```

#### 3. 後端日誌檔案
```bash
# 前端日誌存放位置
/WEB_APP/backend/logs/frontend.log        # 一般前端日誌
/WEB_APP/backend/logs/frontend_error.log  # 前端錯誤日誌
```

---

## 📈 版本資訊和演進歷程

### 當前版本: v1.0.9 (2025-08-01)
**主要特色**: 健壯的非同步任務處理系統

#### 核心更新內容
- ✅ **AsyncTaskManager 整合**: 完整的任務生命週期管理
- ✅ **5 個新 API 端點**: 非同步任務建立、查詢、取消、列表、統計
- ✅ **useAsyncTasks Hook**: 546 行完整的非同步任務管理 Hook
- ✅ **智能輪詢機制**: 2-10 秒指數退避策略
- ✅ **任務取消功能**: 使用者主動取消長時間任務
- ✅ **進度追蹤**: 即時進度百分比和階段描述
- ✅ **雙執行模式**: 同步/非同步執行模式無縫切換
- ✅ **30 分鐘超時控制**: 防止無限等待
- ✅ **完整錯誤恢復**: 失敗重試和異常處理

#### 技術債務和未來規劃
- 🔄 **組件虛擬化**: 大量設備列表的效能優化
- 🔄 **PWA 支援**: 添加 Service Worker 和離線功能
- 🔄 **國際化**: i18n 多語言支援
- 🔄 **主題系統**: 明亮/暗黑主題切換
- 🔄 **WebSocket 整合**: 即時任務狀態推送
- 🔄 **單元測試**: 提升測試覆蓋率

### 演進歷程

#### v1.0.8 - 統一配置管理
- 環境變數配置統一
- 日誌系統運作確認

#### v1.0.7 - 記憶體管理優化  
- 移除對話歷史功能
- 代碼大幅清理
- 性能提升 60-80%

#### v1.0.6 - 日誌系統統一
- 統一日誌命名規範
- 檔案輪轉機制
- LoggerConfig 類別

#### v1.0.5 - AI 解析器優化
- 三版本解析器架構
- 代碼複雜度降低 45%

#### v1.0.0 - 整合式架構實現
- React 19 + TypeScript 5.8
- Zustand + TanStack Query
- 完整 API 整合

---

## 🎯 最佳實踐建議

### 1. 組件開發規範
```typescript
// 組件必須使用 TypeScript 嚴格模式
interface ComponentProps {
  data: RequiredType;
  onAction?: OptionalCallback;
}

const Component: React.FC<ComponentProps> = ({ data, onAction }) => {
  // 使用自訂 Hooks 封裝邏輯
  const logger = useLogger({ componentName: 'Component' });
  
  // 統一錯誤處理
  const handleError = (error: Error) => {
    logger.error('Component error', { error: error.message }, error);
  };
  
  return <div>{/* JSX */}</div>;
};
```

### 2. API 呼叫規範
```typescript
// 使用 TanStack Query 管理伺服器狀態
const { data, error, isLoading } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => getResource(id),
  enabled: !!id,  // 條件式查詢
  retry: 3,       // 自動重試
});

// 手動 API 呼叫使用統一錯誤處理
try {
  const result = await apiCall();
} catch (error) {
  logger.error('API call failed', { endpoint: '/api/test' }, error);
  // 使用者友善錯誤提示
}
```

### 3. 日誌記錄規範
```typescript
// 使用語意化的日誌分類
logger.info(LogCategory.USER, 'User clicked button', { buttonId: 'submit' });
logger.warn(LogCategory.PERFORMANCE, 'Slow operation detected', { duration: 1500 });
logger.error(LogCategory.API, 'Request failed', { endpoint: '/api/test' }, error);
```

### 4. 狀態管理規範
```typescript
// Zustand actions 必須包含 action name
set({ isLoading: true }, false, 'setLoading');

// 複雜狀態更新使用函數式更新
set((state) => ({
  items: [...state.items, newItem]
}), false, 'addItem');
```

---

## 📋 總結

這份前端架構文檔涵蓋了**網路維運助理專案**前端的所有技術細節，從基礎的技術棧選擇到複雜的非同步任務管理系統。前端採用現代化的 React 19 + TypeScript 5.8 技術棧，結合 Zustand 和 TanStack Query 實現了強大的狀態管理能力。

### 核心優勢
- 🚀 **現代化架構**: React 19 + TypeScript 5.8 + Vite 7.0
- 🔧 **完整功能**: 雙執行模式、非同步任務管理、統一日誌系統
- 📊 **企業級**: 完善的錯誤處理、效能監控、類型安全
- 🛠️ **開發友善**: 豐富的調試工具、完整的文檔和範例

### 技術亮點
- **useAsyncTasks Hook**: 546行的完整非同步任務管理系統
- **LoggerService**: 多輸出、分級分類的統一日誌管理
- **API 層**: 統一錯誤處理、自動重試、效能監控
- **類型安全**: 完整的 TypeScript 類型定義和嚴格模式

這個前端系統不僅提供了直觀的使用者介面，更重要的是建立了一個可擴展、可維護的現代化 Web 應用程式架構，為網路維運工作提供了強大的技術支援。

---

**文檔版本**: v1.0.9  
**最後更新**: 2025-08-01  
**適用版本**: React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4  
**作者**: Claude AI (Anthropic)