# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 系統架構

這是一個企業級 AI 網路維運助理系統，採用微服務架構和 Docker Compose 部署：

### 三層架構
- **Proxy Layer**: Nginx Proxy Manager (反向代理/SSL 終端/負載均衡)
- **Backend**: FastAPI (Python) - AI 服務 + 網路設備自動化 + 非同步任務管理
- **Frontend**: React + TypeScript + Tailwind CSS (SPA 單頁應用)

### 核心技術棧
- **後端框架**: FastAPI + Pydantic (型別安全) + Uvicorn (ASGI 伺服器)
- **AI 整合**: LangChain + Google Gemini + Anthropic Claude (多供應商)
- **網路自動化**: Netmiko (SSH) + Nornir (並行執行) + 設備連線池
- **前端技術**: React 19 + TypeScript + Zustand (狀態) + TanStack Query (資料快取)
- **UI 框架**: Tailwind CSS + Radix UI + shadcn/ui 組件系統
- **容器化**: Docker Compose (企業級配置 + 健康檢查)

## 常用開發命令

### Docker 環境管理
```bash
# 啟動完整環境 (生產模式)
docker-compose up -d

# 查看服務狀態
docker-compose ps

# 檢視後端日誌
docker-compose logs -f backend

# 停止所有服務
docker-compose down

# 重建並啟動
docker-compose up --build -d
```

### 前端開發
```bash
cd WEB_APP/frontend

# 安裝依賴
npm install

# 開發模式 (Vite dev server)
npm run dev

# 生產建置
npm run build

# TypeScript 檢查
npm run build  # 包含 tsc -b

# ESLint 檢查
npm run lint

# 預覽建置結果
npm run preview
```

### 後端開發
```bash
cd WEB_APP/backend

# 安裝依賴
pip install -r requirements.txt

# 直接啟動 (開發模式)
python main.py

# 程式碼格式化
black . --line-length 88
isort .
```

## 重要配置文件

### 環境變數 (.env)
需要設定以下必要變數：
- `GOOGLE_API_KEY`: Google Gemini API 金鑰
- `ANTHROPIC_API_KEY`: Anthropic Claude API 金鑰  
- `AI_PROVIDER`: 預設 AI 服務商 (gemini/claude)
- `ADMIN_API_KEY`: 管理員 API 金鑰

### 核心配置
- `WEB_APP/backend/config/devices.json`: 網路設備定義
- `WEB_APP/backend/config/groups.json`: 設備群組配置
- `WEB_APP/backend/config/backend_settings.yaml`: 後端系統設定
- `docker-compose.yml`: 容器編排配置

## 程式碼架構

### 後端架構 (WEB_APP/backend/)
```
├── main.py                    # FastAPI 應用程式入口點 + 中間件配置
├── ai_service.py             # AI 服務整合 (Gemini/Claude/LangChain)
├── async_task_manager.py     # 非同步任務管理 (TaskManager + 狀態追蹤)
├── config_manager.py         # 設備與群組配置管理 (JSON 驗證)
├── core/                     # 核心模組
│   ├── settings.py           # Pydantic Settings (環境變數管理)
│   ├── network_tools.py      # 網路工具 (Netmiko + 連線池)
│   ├── nornir_integration.py # Nornir 網路自動化 (並行執行)
│   ├── error_codes.py        # 統一錯誤碼定義
│   ├── exceptions.py         # 自訂例外類別
│   └── prompt_manager/       # AI 提示詞管理系統 (Jinja2 + YAML)
│       ├── __init__.py
│       ├── manager.py        # 核心提示詞管理器
│       └── exceptions.py     # 提示詞相關例外
├── routers/                  # API 路由模組
│   ├── device_routes.py      # 設備管理 API (/api/devices, /api/groups)
│   ├── execution_routes.py   # 指令執行 API (/api/execute, /api/ai-query)
│   ├── task_routes.py        # 非同步任務 API (/api/tasks/*)
│   ├── admin_routes.py       # 系統管理 API (/api/admin/*)
│   └── dependencies.py       # 依賴注入和共用邏輯
├── models/                   # Pydantic 資料模型
│   ├── common.py            # 統一 BaseResponse 格式
│   └── ai_response.py       # AI 回應模型
├── templates/prompts/        # AI 提示詞範本
│   ├── config/              # YAML 配置檔案
│   └── zh_TW/              # 中文提示詞範本
└── logs/                    # 日誌檔案 (app.log, ai.log, network.log)
```

### 前端架構 (WEB_APP/frontend/src/)
```
├── main.tsx                  # React 應用入口點 + 全域錯誤捕獲
├── App.tsx                   # 主應用組件 + 路由配置
├── components/
│   ├── common/               # 通用組件 (Button, ErrorBoundary, ProgressBar)
│   ├── features/             # 功能組件
│   │   ├── BatchOutputDisplay.tsx    # 批次結果顯示
│   │   ├── CommandInput.tsx          # 指令輸入組件
│   │   ├── DeviceSelectionContainer.tsx # 設備選擇容器
│   │   ├── ModeSelector.tsx          # 模式切換器
│   │   └── MultiDeviceSelector.tsx   # 多設備選擇器
│   ├── layout/               # 版面組件 (Header, Footer)
│   └── ui/                   # shadcn/ui 基礎組件
├── hooks/                    # 自訂 React Hooks
│   ├── useBatchExecution.ts # 批次執行邏輯
│   ├── useDevices.ts        # 設備管理
│   ├── useTimer.ts          # 計時器
│   └── useAsyncTasks.ts     # 非同步任務管理
├── store/                    # Zustand 狀態管理
│   ├── appStore.ts          # 主應用狀態
│   └── selectors.ts         # 狀態選擇器
├── api/                      # API 客戶端
│   ├── client.ts            # Axios 客戶端配置
│   ├── services.ts          # API 服務函數
│   └── TaskPoller.ts        # 任務輪詢機制
├── utils/                    # 工具函式
│   ├── SimpleLogger.ts      # 前端日誌系統
│   ├── queryClient.ts       # React Query 配置
│   └── errorHandler.ts      # 錯誤處理
├── types/                    # TypeScript 型別定義
│   ├── api.ts              # API 相關型別
│   ├── components.ts       # 組件型別
│   └── store.ts           # 狀態型別
└── constants/               # 常數定義
    ├── app.ts              # 應用常數
    └── ui.ts              # UI 常數
```

## 關鍵功能模組

### 1. AI 服務整合 (`ai_service.py`)
- **多供應商支援**: Google Gemini 1.5 Flash + Anthropic Claude 3 Haiku
- **LangChain 整合**: ReAct 代理架構 + 工具鏈
- **提示詞管理**: Jinja2 範本系統 (`core/prompt_manager/`)
- **中文優化**: zh_TW 語言包和網路專業術語
- **智能分析**: 網路設備狀態分析和故障診斷

### 2. 網路設備自動化 (`core/network_tools.py`, `core/nornir_integration.py`)
- **SSH 連線管理**: Netmiko 連線池 + 自動重連機制
- **多設備並行**: Nornir ThreadedRunner (最多 5 並行連線)
- **設備支援**: Cisco IOS-XE, IOS, NX-OS, Juniper 等
- **指令驗證**: CommandValidator (安全檢查 + 只讀限制)
- **結果聚合**: 統一的執行結果格式化

### 3. 非同步任務系統 (`async_task_manager.py`)
- **任務類型**: BATCH_EXECUTE, AI_QUERY, HEALTH_CHECK
- **狀態追蹤**: PENDING → RUNNING → COMPLETED/FAILED/CANCELLED
- **進度回報**: 即時進度更新 + 剩餘時間估算
- **任務管理**: 建立、查詢、取消、清理機制
- **資源控制**: 最大並行任務數限制

### 4. 設備配置管理 (`config_manager.py`)
- **JSON 配置**: `devices.json` (設備定義) + `groups.json` (群組定義)
- **Pydantic 驗證**: 嚴格的資料格式驗證
- **快取機制**: `@lru_cache` 提升查詢效能
- **群組管理**: 設備分組和批次操作支援

### 5. API 路由架構
- **設備管理** (`device_routes.py`): `/api/devices`, `/api/groups`
- **指令執行** (`execution_routes.py`): `/api/execute`, `/api/ai-query`, `/api/batch-execute`
- **任務管理** (`task_routes.py`): `/api/tasks/*` (CRUD + 輪詢)
- **系統管理** (`admin_routes.py`): `/api/admin/*` (需要 API 金鑰認證)
- **健康檢查**: `/health` (Docker 健康檢查端點)

## 開發規範與最佳實踐

### TypeScript 開發
- **嚴格模式**: `tsconfig.json` 啟用 strict mode，所有型別必須明確定義
- **狀態管理**: Zustand 型別安全狀態管理，避免 Redux 複雜度
- **資料快取**: TanStack Query 自動快取、背景更新、錯誤重試
- **組件設計**: 功能組件 (`features/`) + 通用組件 (`common/`) 分離
- **Hooks 模式**: 自訂 Hooks 封裝業務邏輯 (如 `useBatchExecution`)

### Python 程式碼品質
- **型別安全**: Pydantic 資料驗證 + Python 3.9+ 型別提示
- **程式碼格式**: Black (line-length=88) + isort 自動排序
- **架構模式**: 分層架構 + 依賴注入 + 模組化設計
- **錯誤處理**: 統一例外處理 (`core/exceptions.py`) + 錯誤碼定義
- **日誌系統**: 結構化日誌 (app.log, ai.log, network.log)

### 安全與權限管理
- **API 金鑰**: 環境變數管理，絕不硬編碼
- **設備認證**: 加密存儲設備憑證，連線池管理
- **管理員路由**: ADMIN_API_KEY 認證保護系統管理功能
- **指令限制**: CommandValidator 確保只執行安全的只讀指令
- **CORS 配置**: 嚴格的跨域資源存取控制

### 響應式設計標準
- **CSS 框架**: Tailwind CSS + 自訂主題 (`tailwind.config.js`)
- **斷點設計**: Mobile-first 設計，支援 sm/md/lg/xl 斷點
- **組件系統**: shadcn/ui + Radix UI 無障礙組件
- **參考指南**: 詳細設計規範見 `FRONTEND_LAYOUT_GUIDE.md`

## API 設計規範

### 統一回應格式 (`models/common.py`)
所有 API 端點使用 `BaseResponse<T>` 泛型格式：
```python
{
  "success": boolean,
  "data": T | null,
  "message": string,
  "error_code": string | null,
  "timestamp": string
}
```

### 關鍵 API 端點
- **設備管理**: `GET /api/devices`, `GET /api/groups`
- **指令執行**: `POST /api/execute`, `POST /api/ai-query`
- **批次操作**: `POST /api/batch-execute` (同步/非同步)
- **任務管理**: `POST /api/tasks/create`, `GET /api/tasks/{task_id}/status`
- **健康檢查**: `GET /health` (Docker 容器健康檢查)

## 測試與部署策略

### 開發環境
```bash
# 1. 後端開發 (熱重載)
cd WEB_APP/backend && python main.py

# 2. 前端開發 (Vite dev server)
cd WEB_APP/frontend && npm run dev

# 3. 完整容器環境
docker-compose up --build
```

### 程式碼品質檢查
```bash
# Python 格式化和檢查
cd WEB_APP/backend
black . --line-length 88 --check
isort . --check-only

# TypeScript 編譯和 Linting
cd WEB_APP/frontend
npm run build  # 包含 TypeScript 檢查
npm run lint   # ESLint 檢查
```

### 生產部署
- **容器化**: Docker Compose 多服務編排
- **健康檢查**: 自動健康檢查 + 重啟策略
- **資源限制**: CPU/記憶體限制防止資源濫用
- **SSL/TLS**: Nginx Proxy Manager 自動 SSL 憑證
- **日誌管理**: 持久化日誌存儲 + 輪轉策略

## 除錯和監控

### 日誌系統
- **後端日誌**: `logs/app.log` (一般日誌), `logs/ai.log` (AI 操作), `logs/network.log` (網路連線)
- **前端日誌**: `SimpleLogger.ts` 自動發送錯誤到後端
- **任務追蹤**: 非同步任務執行狀態和進度日誌

### 開發工具
- **React Query DevTools**: 開發環境 API 狀態監控
- **Zustand DevTools**: 狀態變化追蹤和除錯
- **FastAPI 自動文件**: `/docs` (Swagger UI) 和 `/redoc`

## AI 提示詞系統架構

### Jinja2 範本引擎 (`templates/prompts/`)
這是系統 AI 智能的核心，使用企業級範本管理：

#### 系統提示詞 (`zh_TW/system_prompt.j2`)
```jinja2
<role>
你是一名專業的 {{ device_vendor|default("Cisco") }} 網路工程師和 AI 助理
具備 {{ certification_level|default("CCIE") }} 級別的專業知識
</role>

<security_rules>
{%- for rule in security_rules %}
{{ loop.index }}. {{ rule }}
{%- endfor %}
</security_rules>
```

#### 工具配置 (`config/tools.yaml`)
```yaml
tools:
  - name: "BatchCommandRunner"
    description: "在指定的網路設備上執行安全的 show 指令"
    always_enabled: true
    input_formats:
      single_device: "device_ip: command"
      multi_device: "device_ip1,device_ip2: command"
```

#### 提示詞管理器 (`core/prompt_manager/manager.py`)
- **熱重載機制**: 自動偵測範本變更
- **快取系統**: `@lru_cache` 提升渲染效能
- **多語言支援**: zh_TW 中文優化
- **線程安全**: RLock 並行保護

## 前端狀態管理系統

### 執行進度階段 (`constants/app.ts`)
```typescript
export const PROGRESS_STAGE = {
  SUBMITTING: 'submitting',     // 正在提交任務
  SUBMITTED: 'submitted',       // 任務已提交
  CONNECTING: 'connecting',     // 連接設備中
  EXECUTING: 'executing',       // 執行指令中
  AI_ANALYZING: 'ai-analyzing', // AI 分析中
  COMPLETED: 'completed',       // 任務完成
  FAILED: 'failed',            // 執行失敗
  CANCELLED: 'cancelled',      // 任務取消
} as const;
```

### 狀態管理模式
- **Zustand Store**: 型別安全的狀態管理 (`store/appStore.ts`)
- **React Query**: 自動快取和背景同步 (`utils/queryClient.ts`)
- **進度回調**: 即時進度更新機制 (`createProgressCallback`)

### 執行模式系統
```typescript
export const EXECUTION_MODE = {
  COMMAND: 'command',  // 直接指令模式
  AI: 'ai',           // AI 智能分析模式
} as const;
```

## 錯誤處理和監控系統

### 統一錯誤碼架構 (`core/error_codes.py`)
```python
class AIErrorCodes:
    QUOTA_EXCEEDED = "AI_QUOTA_EXCEEDED"
    RATE_LIMIT = "AI_RATE_LIMIT" 
    SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE"

class NetworkErrorCodes:
    CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT"
    AUTH_FAILED = "AUTH_FAILED"
    HOST_UNREACHABLE = "HOST_UNREACHABLE"
```

### 分層例外系統 (`core/exceptions.py`)
```python
class ServiceError(Exception):
    def __init__(self, detail: str, error_code: str = None, status_code: int = 400):
        self.detail = detail
        self.error_code = error_code
        self.status_code = status_code

class DeviceNotFoundError(ServiceError): pass
class AIServiceError(ServiceError): pass
```

### 前端日誌系統 (`utils/SimpleLogger.ts`)
- **自動錯誤上傳**: 前端錯誤自動發送到後端
- **分類日誌**: API、ERROR、USER、SYSTEM、PERFORMANCE
- **全域錯誤捕獲**: window.addEventListener('error') 自動處理

### 後端日誌輪轉 (`utils.py`)
```python
class LoggerConfig:
    @staticmethod
    def create_rotating_handler(log_filename: str) -> RotatingFileHandler:
        # 自動日誌輪轉 (10MB + 5個備份檔案)
        # logs/app.log, logs/ai.log, logs/network.log
```

## 管理器類別架構

### 1. AsyncTaskManager (`async_task_manager.py`)
- **任務類型**: BATCH_EXECUTE, AI_QUERY, HEALTH_CHECK
- **狀態追蹤**: PENDING → RUNNING → COMPLETED/FAILED/CANCELLED
- **資源控制**: 最大並行任務限制
- **進度回報**: 即時進度更新和剩餘時間估算

### 2. ConfigManager (`config_manager.py`)
- **JSON 驗證**: Pydantic 嚴格資料驗證
- **設備管理**: devices.json + groups.json 配置
- **快取優化**: `@lru_cache` 提升查詢效能
- **群組操作**: 設備分組和批次選擇

### 3. NornirManager (`core/nornir_integration.py`)
- **並行執行**: ThreadedRunner (最多 5 並行連線)
- **設備範圍**: 線程安全的設備限制機制
- **結果聚合**: 統一的執行結果格式化
- **連線管理**: 自動重連和錯誤處理

### 4. PromptManager (`core/prompt_manager/manager.py`)
- **Jinja2 引擎**: 動態範本渲染
- **YAML 配置**: 工具和變數配置載入
- **熱重載**: 開發環境自動重載範本
- **快取系統**: 模板編譯結果快取

## 建置和效能優化

### Vite 配置優化 (`vite.config.ts`)
```typescript
rollupOptions: {
  output: {
    manualChunks: (id) => {
      if (id.includes('react')) return 'vendor';
      if (id.includes('@radix-ui')) return 'ui';
      if (id.includes('zustand')) return 'state';
      if (id.includes('/hooks/')) return 'hooks';
      if (id.includes('/components/features/')) return 'components';
    }
  }
}
```

### 效能優化策略
- **Code Splitting**: 自動 chunk 分割 (vendor, ui, state, hooks, components)
- **Bundle 分析**: `npm run build:analyze` 視覺化分析
- **Lazy Loading**: BatchOutputDisplay 等大型組件懶載入
- **快取策略**: React Query 2分鐘 stale time + 5分鐘 cache time

### Tailwind 主題系統 (`tailwind.config.js`)
- **shadcn/ui 整合**: CSS 變數主題系統
- **響應式斷點**: Mobile-first 設計
- **深色模式**: 基於 class 的深色模式支援
- **自訂顏色**: HSL 顏色系統 + CSS 變數

## API 設計模式

### RESTful 端點架構
```
GET    /api/devices           # 設備列表
GET    /api/groups            # 設備群組
POST   /api/execute           # 單設備指令執行
POST   /api/ai-query          # AI 智能查詢
POST   /api/batch-execute     # 批次執行 (同步/非同步)
GET    /api/tasks/{id}/status # 任務狀態查詢
DELETE /api/tasks/{id}        # 任務取消
GET    /health                # 健康檢查
```

### 統一回應格式
```typescript
interface BaseResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  error_code: string | null;
  timestamp: string;
}
```

### HTTP 狀態碼管理 (`config/api.ts`)
```typescript
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const RETRYABLE_STATUS_CODES = [502, 503, 0];
```