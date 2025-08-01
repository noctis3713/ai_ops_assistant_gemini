# CLAUDE.md - AI 網路維運助理專案技術指南

> **專為 Claude AI 和其他 AI 助手設計的完整專案技術文檔**  
> 最後更新：2025-08-01  
> 專案版本：v1.0.9  

---

## 📋 目錄

1. [專案核心概述](#專案核心概述)
2. [系統架構詳解](#系統架構詳解)
3. [核心模組深度解析](#核心模組深度解析)
4. [API 端點完整參考](#api-端點完整參考)
5. [開發指南和最佳實踐](#開發指南和最佳實踐)
6. [配置管理指南](#配置管理指南)
7. [故障排除和維護](#故障排除和維護)
8. [版本歷程和技術演進](#版本歷程和技術演進)

---

## 專案核心概述

### 🎯 專案定位

**AI 網路維運助理**是一個現代化的網路設備管理和智能分析平台，結合了傳統網路維運的可靠性與 AI 技術的智能化優勢。

**核心價值：**
- **智能化維運**：透過 AI 分析提供專業建議和故障診斷
- **安全第一**：僅執行安全的唯讀指令，完整的指令驗證機制
- **現代化架構**：採用最新的前後端技術棧，支援多用戶並發
- **企業級穩定性**：健壯的非同步任務處理，解決大規模維運場景的技術挑戰

### 🛠 技術棧概覽

#### 前端技術棧 (WEB_APP/frontend/)
```json
{
  "核心框架": "React 19.1.0",
  "類型系統": "TypeScript 5.8.3", 
  "建置工具": "Vite 7.0.4",
  "狀態管理": ["Zustand 5.0.6", "TanStack Query 5.83.0"],
  "HTTP客戶端": "Axios 1.11.0",
  "UI框架": "Tailwind CSS 3.4.17",
  "開發工具": ["ESLint 9.30.1", "TypeScript ESLint 8.35.1"]
}
```

#### 後端技術棧 (WEB_APP/backend/)
```json
{
  "Web框架": "FastAPI[standard] 0.115.0+",
  "ASGI服務器": "Uvicorn[standard] 0.35.0+",
  "數據驗證": "Pydantic 2.10.0+",
  "AI整合": ["LangChain 0.3.0+", "Google GenerativeAI 0.8.0+", "Anthropic 0.37.0+"],
  "網路自動化": ["Nornir 3.5.0+", "Netmiko 4.6.0+", "Paramiko 3.4.0+"],
  "配置管理": ["Python-dotenv 1.1.0+", "PyYAML 6.0.1+"],
  "工具套件": ["Tenacity 8.3.0+", "PSUtil 5.9.0+", "Structlog 24.0.0+"]
}
```

### 🚀 關鍵特性

#### 1. 雙 AI 引擎智能分析
- **Google Gemini 1.5 Flash**：快速回應，適合即時查詢
- **Claude 3.5 Sonnet**：深度分析，適合複雜問題診斷
- **動態切換**：透過環境變數 `AI_PROVIDER` 控制
- **三版本解析器**：original/simplified/balanced 三種解析策略

#### 2. 企業級非同步任務系統
- **AsyncTaskManager**：完整的任務生命週期管理
- **五種任務狀態**：pending → running → completed/failed/cancelled
- **智能輪詢**：指數退避策略，從 2 秒到 10 秒動態調整
- **自動清理**：預設 24 小時 TTL，可配置清理策略
- **進度追蹤**：即時進度更新和詳細執行統計

#### 3. 安全的網路設備管理
- **指令白名單**：僅允許 `show` 類安全指令
- **危險關鍵字過濾**：自動阻擋配置變更指令
- **連線池管理**：SSH 連線復用，健康檢查，自動清理
- **智能快取**：指令結果快取，TTL 和 LRU 策略
- **錯誤分類**：統一的錯誤診斷和建議系統

#### 4. 現代化 Web 介面
- **響應式設計**：支援桌面、平板、手機全平台
- **即時狀態追蹤**：批次執行進度即時顯示
- **雙執行模式**：同步和非同步模式靈活切換
- **鍵盤快捷鍵**：提升操作效率
- **完整錯誤處理**：友善的錯誤提示和重試機制

---

## 系統架構詳解

### 🏗 整體架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                        前端層 (React SPA)                    │
├─────────────────────────────────────────────────────────────┤
│  Components  │   Hooks    │   Store    │     API Client     │
│              │            │  (Zustand) │    (Axios+Query)   │
└─────────────────────────────────────────────────────────────┘
                               │ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI 後端層                         │
├─────────────────────────────────────────────────────────────┤
│  main.py     │ ai_service │ async_task │   config_manager   │
│ (11 endpoints│    .py     │ _manager.py│        .py         │
│              │            │            │                    │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                        核心模組層                           │
├─────────────────────────────────────────────────────────────┤
│  network_tools.py      │       nornir_integration.py       │
│  (連線池+快取+驗證)     │     (批次執行+錯誤分類)           │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                        AI & 網路層                          │
├─────────────────────────────────────────────────────────────┤
│  Google Gemini API    │  Claude API   │  Cisco設備(SSH)    │
│  LangChain Agent      │  XML提示詞    │  Netmiko連線       │
└─────────────────────────────────────────────────────────────┘
```

### 📊 數據流向

#### 1. 同步執行流程
```
用戶輸入 → 前端驗證 → API請求 → 指令驗證 → 設備執行 → 結果回傳 → 前端顯示
```

#### 2. 非同步執行流程
```
用戶輸入 → 建立任務 → 回傳TaskID → 背景執行 → 前端輪詢 → 進度更新 → 完成通知
```

#### 3. AI 查詢流程
```
自然語言 → 提示詞工程 → AI分析 → 工具選擇 → 設備執行 → 結果整合 → 智能回應
```

### 🔗 模組依賴關係

```
main.py
├── ai_service.py
│   ├── core/nornir_integration.py
│   └── utils.py (提示詞工程)
├── async_task_manager.py
│   └── utils.py (日誌系統)
├── config_manager.py
│   └── config/*.json, *.yaml
└── core/network_tools.py
    └── core/nornir_integration.py
```

---

## 核心模組深度解析

### 🎯 後端核心模組 (11個主要文件)

#### 1. main.py - FastAPI 主程式 (1252行)
**核心職責：**
- 定義 11 個 RESTful API 端點
- 統一的錯誤處理和 HTTP 狀態碼映射
- 非同步任務生命週期管理
- CORS 中間件和安全配置

**關鍵端點：**
```python
# 基礎端點 (6個)
GET    /api/devices              # 取得設備列表
GET    /api/device-groups        # 取得設備群組
POST   /api/execute              # 單一設備執行
POST   /api/ai-query             # AI 智能查詢
POST   /api/batch-execute        # 批次同步執行
GET    /api/ai-status            # AI 服務狀態

# 非同步任務端點 (5個)
POST   /api/batch-execute-async  # 批次非同步執行
GET    /api/task/{task_id}       # 查詢任務狀態
GET    /api/tasks                # 列出任務列表
DELETE /api/task/{task_id}       # 取消任務
GET    /api/task-manager/stats   # 任務管理器統計
```

**生命週期事件：**
- `startup_event()`: 啟動任務管理器清理循環
- `shutdown_event()`: 清理資源和關閉服務

#### 2. ai_service.py - AI 服務統一管理 (400+ 行)
**核心職責：**
- 雙 AI 引擎初始化和管理 (Gemini + Claude)
- LangChain Agent 和工具系統整合
- 三版本解析器架構實現
- AI 查詢錯誤分類和處理

**關鍵類別：**
- `AIService`: 主要 AI 服務管理器
- `BatchCommandRunner`: 批次指令執行工具
- `CiscoCommandSearch`: Cisco 指令搜尋工具

**三版本解析器：**
```python
# 環境變數控制：PARSER_VERSION=original|simplified|balanced
def _parse_agent_result(self, result):          # 99行，最健壯
def _parse_agent_result_simplified(self, result): # 35行，最簡潔  
def _parse_agent_result_balanced(self, result):   # 55行，推薦使用
```

#### 3. async_task_manager.py - 非同步任務管理器 (500+ 行)
**核心職責：**
- 完整的任務生命週期管理
- 五種任務狀態和三種任務類型
- 智能進度追蹤和統計監控
- 執行緒安全和並發控制

**關鍵類別：**
```python
class TaskStatus(Enum):
    PENDING = "pending"      # 等待執行
    RUNNING = "running"      # 執行中  
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"        # 執行失敗
    CANCELLED = "cancelled"  # 已取消

class TaskType(Enum):
    BATCH_EXECUTE = "batch_execute"  # 批次設備執行
    AI_QUERY = "ai_query"           # AI 查詢分析
    HEALTH_CHECK = "health_check"   # 健康檢查

class AsyncTaskManager:
    # 單例模式，線程安全
    # 支援任務建立、狀態更新、進度追蹤、自動清理
```

**自動清理機制：**
- 預設 TTL：24 小時
- 清理間隔：1 小時 (可配置)
- 清理統計：完整的清理報告

#### 4. core/network_tools.py - 網路工具核心 (800+ 行)
**核心職責：**
- SSH 連線池管理和健康檢查
- 指令安全驗證和危險關鍵字過濾  
- 智能快取系統 (TTL + LRU)
- AI 輸出摘要器 (超長內容處理)

**關鍵類別：**
```python
class CommandValidator:
    # 指令安全驗證器
    SAFE_COMMANDS = ["show", "display", "get"]
    DANGEROUS_KEYWORDS = ["configure", "write", "delete", "shutdown"]

class ConnectionPool:
    # SSH 連線池管理器
    # 支援連線復用、健康檢查、自動清理

class CommandCache:
    # 指令結果快取系統
    # TTL (300秒) + LRU (512條目) 雙重策略

class OutputSummarizer:
    # AI 輸出摘要器，處理超長指令輸出
    # 支援 Gemini 和 Claude 雙引擎
```

#### 5. core/nornir_integration.py - Nornir 多設備整合 (600+ 行)
**核心職責：**
- Nornir 網路自動化框架整合
- 批次設備操作和結果聚合
- 統一錯誤分類和診斷系統
- 設備健康檢查和狀態監控

**關鍵類別：**
```python
class NornirManager:
    # Nornir 初始化和設備管理
    def run_batch_command()    # 批次指令執行
    def health_check_devices() # 設備健康檢查
    def get_device_info()      # 設備資訊獲取

class BatchResult:
    # 批次執行結果聚合
    results: Dict[str, str]           # 成功結果
    errors: Dict[str, str]            # 錯誤訊息  
    error_details: Dict[str, Dict]    # 詳細錯誤分類
    execution_time: float             # 執行時間
    cache_hits/misses: int           # 快取統計

def classify_error(error_message: str) -> Dict:
    # 統一錯誤分類函數
    # 回傳：type, category, severity, suggestion
```

#### 6. config_manager.py - 配置管理模組 (300+ 行)
**核心職責：**
- 統一的配置檔案管理
- 設備配置和群組配置驗證
- 動態配置更新和熱重載
- IP 地址驗證和設備查找

**管理的配置檔案：**
- `config/devices.json`: 設備配置 (IP、認證、類型)
- `config/groups.json`: 設備群組配置
- `config/nornir_*.yaml`: Nornir 相關配置
- `config/.env`: 環境變數配置

#### 7. utils.py - 工具函數模組 (400+ 行)
**核心職責：**
- 統一日誌系統配置 (RotatingFileHandler)
- AI 提示詞工程和思考鏈範例
- 結果格式化和前端日誌處理
- 系統監控和統計工具

**關鍵功能：**
```python
class LoggerConfig:
    # 統一日誌配置管理器
    # 4類日誌：app.log, ai.log, network.log, error.log
    # 10MB 輪轉，5個備份檔案

def build_ai_system_prompt():
    # XML 結構化提示詞建構
    # 包含安全規則、工具說明、工作流程

def build_few_shot_examples():
    # 思考鏈 (CoT) 範例整合
    # 3類範例：搜尋型、直接執行、錯誤處理

class FrontendLogHandler:
    # 前端日誌處理器
    # 支援批次處理、統計分析
```

### 🖥 前端核心架構

#### 1. 組件架構 (src/components/)
```
components/
├── common/          # 通用組件
│   ├── Button.tsx               # 統一按鈕組件
│   ├── ProgressBar.tsx          # 進度條組件
│   └── StatusDisplay.tsx        # 狀態顯示組件
├── features/        # 功能組件
│   ├── DeviceSelectionContainer.tsx  # 設備選擇容器
│   ├── CommandInput.tsx              # 指令輸入組件
│   ├── BatchOutputDisplay.tsx        # 批次結果顯示
│   └── BatchProgressIndicator.tsx    # 批次進度指示器
├── layout/          # 佈局組件
│   ├── Header.tsx               # 頁面標題
│   └── Footer.tsx               # 頁面腳注
└── debug/           # 除錯組件
    └── LoggerDashboard.tsx      # 日誌監控面板
```

#### 2. 狀態管理 (src/store/)
```typescript
// Zustand 主要狀態管理
interface AppState {
  // 基礎狀態
  mode: 'command' | 'ai';
  selectedDevices: string[];
  inputValue: string;
  
  // 執行狀態
  status: ExecutionStatus;
  batchResults: BatchExecutionResult[];
  batchProgress: ProgressState;
  
  // 非同步任務狀態  
  isAsyncMode: boolean;
  currentTask: TaskResponse | null;
  taskPollingActive: boolean;
}
```

#### 3. Hooks 系統 (src/hooks/)
```typescript
// 自訂 React Hooks
useDevices()        // 設備列表管理
useBatchExecution() // 批次執行邏輯
useAsyncTasks()     // 非同步任務管理
useKeyboardShortcuts() // 鍵盤快捷鍵
useLogger()         // 日誌記錄功能
```

#### 4. API 服務層 (src/api/)
```typescript
// 完整的 API 客戶端
class APIClient {
  // 基礎 HTTP 客戶端 (Axios)
  // 統一錯誤處理、重試機制、超時控制
  
  // 11個端點的封裝函數
  getDevices()
  executeCommand()
  batchExecute()
  batchExecuteAsync()  // 非同步批次執行
  getTaskStatus()      // 任務狀態查詢  
  // ... 其他端點
}
```

---

## API 端點完整參考

### 📡 基礎端點 (6個)

#### 1. GET /api/devices
**功能：** 取得所有設備列表  
**參數：** 無  
**回應：**
```json
{
  "devices": [
    {
      "ip": "202.3.182.202",
      "name": "SIS-LY-C0609", 
      "model": "Cisco ASR 1001-X",
      "description": "LY SIS設備"
    }
  ]
}
```

#### 2. GET /api/device-groups  
**功能：** 取得設備群組列表  
**參數：** 無  
**回應：**
```json
{
  "groups": [
    {
      "name": "cisco_xe_devices",
      "description": "所有 Cisco IOS-XE 設備",
      "device_count": 2,
      "platform": "cisco_xe"
    }
  ]
}
```

#### 3. POST /api/execute
**功能：** 單一設備指令執行  
**請求：**
```json
{
  "device_ip": "202.3.182.202",
  "command": "show version"
}
```
**回應：** 純文字指令輸出

#### 4. POST /api/ai-query
**功能：** AI 智能查詢  
**請求：**
```json
{
  "device_ip": "202.3.182.202", 
  "query": "分析這台設備的版本資訊"
}
```
**回應：** AI 分析結果 (Markdown 格式)

#### 5. POST /api/batch-execute
**功能：** 批次同步執行  
**請求：**
```json
{
  "devices": ["202.3.182.202", "202.153.183.18"],
  "command": "show version",
  "mode": "command"  // 或 "ai"
}
```
**回應：**
```json
{
  "results": [
    {
      "deviceName": "SIS-LY-C0609",
      "deviceIp": "202.3.182.202", 
      "success": true,
      "output": "...",
      "executionTime": 2.5
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2, 
    "failed": 0,
    "totalTime": 5.0
  }
}
```

#### 6. GET /api/ai-status
**功能：** AI 服務狀態檢查  
**參數：** 無  
**回應：**
```json
{
  "ai_initialized": true,
  "current_provider": "gemini",
  "model_info": {...},
  "api_keys": {
    "gemini_configured": true,
    "claude_configured": false
  },
  "recommendations": []
}
```

### ⚡ 非同步任務端點 (5個)

#### 7. POST /api/batch-execute-async
**功能：** 建立非同步批次任務  
**請求：** 同 batch-execute  
**回應：**
```json
{
  "task_id": "task_12345678-1234-1234-1234-123456789abc",
  "message": "任務已成功建立並在背景執行"
}
```

#### 8. GET /api/task/{task_id}
**功能：** 查詢任務狀態和結果  
**參數：** task_id (路徑參數)  
**回應：**
```json
{
  "task_id": "task_12345678...",
  "task_type": "batch_execute",
  "status": "running",
  "params": {...},
  "created_at": "2025-08-01T10:00:00Z",
  "started_at": "2025-08-01T10:00:01Z", 
  "progress": {
    "percentage": 65.0,
    "current_stage": "執行設備 2/3...",
    "details": {}
  },
  "result": null,  // 完成後包含執行結果
  "execution_time": null
}
```

#### 9. GET /api/tasks
**功能：** 列出任務，支援篩選  
**參數：**
- `status`: pending|running|completed|failed|cancelled
- `task_type`: batch_execute|ai_query|health_check  
- `limit`: 數量限制 (預設50)

**回應：**
```json
{
  "tasks": [...],  // TaskResponse 陣列
  "total_count": 10,
  "filters_applied": {
    "status": "running",
    "limit": 50
  }
}
```

#### 10. DELETE /api/task/{task_id}
**功能：** 取消指定任務  
**參數：** task_id (路徑參數)  
**回應：**
```json
{
  "message": "任務已成功取消",
  "task_id": "task_12345678..."
}
```

#### 11. GET /api/task-manager/stats
**功能：** 任務管理器統計資訊  
**參數：** 無  
**回應：**
```json
{
  "task_manager_stats": {
    "total_created": 150,
    "total_completed": 120,
    "total_failed": 5,
    "current_tasks": 3,
    "cleanup_runs": 24,
    "uptime_seconds": 86400
  },
  "system_info": {
    "python_version": [3, 13, 0],
    "platform": "win32"
  }
}
```

### 🔧 輔助端點

#### GET /
**功能：** 根路徑，API 資訊總覽  
#### GET /health
**功能：** 健康檢查端點  
#### GET /api/devices/status  
**功能：** 所有設備連線狀態檢查  
#### GET /api/devices/{device_ip}/status
**功能：** 特定設備狀態檢查  

---

## 開發指南和最佳實踐

### 🛠 開發環境設定

#### 1. 系統需求
```bash
# 基礎需求
Python 3.8+ (推薦 3.13+)
Node.js 18+ (推薦 22+)  
npm 8+
Git 2.30+

# 可選工具
VS Code + Python Extension
Chrome DevTools
Postman/Insomnia (API 測試)
```

#### 2. 專案初始化
```bash
# 1. 克隆專案
git clone <repository-url>
cd ai_ops_assistant_gemini

# 2. 後端環境設定  
cd WEB_APP/backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac  
source venv/bin/activate

pip install -r requirements.txt

# 3. 前端環境設定
cd ../frontend
npm install

# 4. 環境變數配置
cp config/.env.example config/.env
# 編輯 .env 檔案，設定必要的 API Keys
```

#### 3. 啟動服務
```bash
# 後端啟動 (終端機 1)
cd WEB_APP/backend  
python main.py
# 服務運行於: http://localhost:8000

# 前端啟動 (終端機 2)
cd WEB_APP/frontend
npm run dev  
# 服務運行於: http://localhost:5173
```

### 📝 代碼規範

#### 1. Python 後端規範
```python
# 遵循 PEP 8 規範
# 使用 type hints
def process_command(device_ip: str, command: str) -> Dict[str, Any]:
    """
    處理設備指令
    
    Args:
        device_ip: 設備 IP 地址
        command: 執行指令
        
    Returns:
        Dict[str, Any]: 執行結果
        
    Raises:
        ValueError: 無效的參數
        ConnectionError: 連線失敗
    """
    pass

# 統一錯誤處理模式
try:
    result = execute_command()
    logger.info(f"指令執行成功: {result}")
    return result
except SpecificException as e:
    logger.error(f"特定錯誤: {e}")
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"未預期錯誤: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="內部伺服器錯誤")
```

#### 2. TypeScript 前端規範
```typescript
// 嚴格類型定義
interface DeviceExecutionRequest {
  deviceIp: string;
  command: string;
  mode: 'command' | 'ai';
}

// 函式組件 + Hooks 模式
const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  devices,
  selectedDevices,
  onDevicesChange
}) => {
  // 使用自訂 Hooks
  const { isLoading, error } = useDevices();
  
  // 統一錯誤處理
  if (error) {
    return <ErrorDisplay error={error} />;
  }
  
  return (
    <div className="device-selector">
      {/* 組件內容 */}
    </div>
  );
};

// API 呼叫統一格式
export const executeCommand = async (
  request: DeviceExecutionRequest
): Promise<string> => {
  try {
    const response = await apiClient.post('/api/execute', request);
    return response.data;
  } catch (error) {
    throw new APIError('指令執行失敗', error);
  }
};
```

### 🔧 新功能開發流程

#### 1. 後端功能開發
```bash
# Step 1: 規劃功能
# - 定義 API 端點和參數
# - 設計數據模型 (Pydantic)
# - 確定錯誤處理策略

# Step 2: 實現核心邏輯
# - 在相應模組中實現功能 (core/, ai_service.py, 等)
# - 添加完整的類型提示和文檔

# Step 3: 添加 API 端點
# - 在 main.py 中添加路由
# - 實現請求驗證和錯誤處理
# - 添加日誌記錄

# Step 4: 測試
# - 單元測試 (如適用)
# - API 測試 (Postman/curl)
# - 錯誤情況測試
```

#### 2. 前端功能開發
```bash
# Step 1: 定義類型
# - 在 src/types/ 中添加相關介面
# - 確保與後端 API 一致

# Step 2: 實現 API 服務
# - 在 src/api/services.ts 中添加 API 函式
# - 實現錯誤處理和重試邏輯

# Step 3: 開發組件
# - 在相應目錄中創建組件
# - 使用自訂 Hooks 管理狀態
# - 實現響應式設計

# Step 4: 狀態管理整合
# - 更新 Zustand 狀態定義 (如需要)
# - 使用 TanStack Query 管理伺服器狀態
```

### 🧪 測試方法

#### 1. 後端測試
```bash
# 功能測試
python -c "from core.network_tools import CommandValidator; print(CommandValidator.validate_command('show version'))"

# 模組測試  
python -c "from ai_service import get_ai_service; ai = get_ai_service(); print('AI 服務正常' if ai.ai_initialized else 'AI 服務異常')"

# API 測試
curl -X GET http://localhost:8000/api/devices
curl -X POST http://localhost:8000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"device_ip":"202.3.182.202","command":"show version"}'
```

#### 2. 前端測試
```bash
# 開發模式測試
npm run dev

# 建置測試
npm run build
npm run preview

# 類型檢查
npx tsc --noEmit

# 代碼品質檢查
npm run lint
```

### 📦 部署指南

#### 1. 生產環境準備
```bash
# 後端建置
cd WEB_APP/backend
pip install -r requirements.txt --only-binary=all

# 前端建置
cd WEB_APP/frontend  
npm ci
npm run build

# 環境變數檢查
# 確保所有必要的環境變數都已設定
```

#### 2. 服務部署
```bash
# 使用 Uvicorn 部署後端
uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --access-log

# 使用 Nginx 部署前端
# 將 dist/ 目錄部署到 Nginx 靜態目錄
# 配置反向代理到後端 API
```

---

## 配置管理指南

### ⚙️ 環境變數完整配置

#### 1. AI 服務配置
```env
# AI 提供者選擇
AI_PROVIDER=gemini                    # gemini | claude

# API Keys
GOOGLE_API_KEY=your_google_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# AI 模型配置
GEMINI_MODEL=gemini-1.5-flash-latest  # Gemini 模型版本
CLAUDE_MODEL=claude-3-haiku-20240307  # Claude 模型版本

# AI 功能開關
ENABLE_DOCUMENT_SEARCH=false         # 搜尋功能 (暫時停用)
PARSER_VERSION=balanced               # original|simplified|balanced
```

#### 2. 設備認證配置
```env
# 設備登入憑證
DEVICE_USERNAME=admin
DEVICE_PASSWORD=your_device_password
DEVICE_TYPE=cisco_xe

# SSH 連線配置
MAX_CONNECTIONS=5                     # 最大併發連線數
CONNECTION_TIMEOUT=300                # 連線超時 (秒)
COMMAND_TIMEOUT=20                    # 指令超時 (秒)
```

#### 3. 效能調校參數
```env
# 快取系統
CACHE_MAX_SIZE=512                    # 快取最大條目數
CACHE_TTL=300                         # 快取存活時間 (秒)

# Nornir 併發配置
NORNIR_WORKERS=5                      # 並行工作者數量

# 健康檢查
HEALTH_CHECK_INTERVAL=30              # 健康檢查間隔 (秒)
```

#### 4. 日誌系統配置
```env
# 日誌輪轉配置
LOG_MAX_SIZE=10485760                 # 10MB
LOG_BACKUP_COUNT=5                    # 保留 5 個備份
LOG_LEVEL=INFO                        # DEBUG|INFO|WARNING|ERROR

# 日誌輸出控制
ENABLE_CONSOLE_LOG=true               # 是否輸出到控制台
ENABLE_FILE_LOG=true                  # 是否輸出到檔案
```

#### 5. 非同步任務配置
```env
# 任務管理
ASYNC_TASK_TTL=86400                  # 任務 TTL (秒，24小時)
ASYNC_TASK_CLEANUP_INTERVAL=3600      # 清理間隔 (秒，1小時)

# 前端輪詢配置
ASYNC_TASK_POLL_INTERVAL=2000         # 輪詢間隔 (毫秒)
ASYNC_TASK_MAX_POLL_INTERVAL=10000    # 最大輪詢間隔 (毫秒)
ASYNC_TASK_TIMEOUT=1800000            # 任務總超時 (毫秒，30分鐘)
```

### 📄 配置檔案管理

#### 1. 設備配置 (config/devices.json)
```json
{
  "devices": [
    {
      "ip": "202.3.182.202",
      "name": "SIS-LY-C0609",
      "model": "Cisco ASR 1001-X", 
      "description": "LY SIS設備",
      "os": "cisco_xe",
      "device_type": "cisco_xe",
      "username": "admin",
      "password": "password_here"
    }
  ]
}
```

#### 2. 設備群組配置 (config/groups.json)
```json
{
  "groups": [
    {
      "name": "cisco_xe_devices",
      "description": "所有 Cisco IOS-XE 設備",
      "platform": "cisco_xe",
      "filter_criteria": {
        "device_type": "cisco_xe"
      }
    }
  ]
}
```

#### 3. Nornir 配置檔案
```yaml
# config/nornir_defaults.yaml
inventory:
  plugin: SimpleInventory
  options:
    host_file: "config/nornir_hosts.yaml"
    group_file: "config/nornir_groups.yaml" 
    defaults_file: "config/nornir_defaults.yaml"

runner:
  plugin: threaded
  options:
    num_workers: 5

# config/nornir_hosts.yaml  
SIS-LY-C0609:
  hostname: 202.3.182.202
  platform: cisco_xe
  groups: [cisco_xe_devices]

# config/nornir_groups.yaml
cisco_xe_devices:
  platform: cisco_xe
  connection_options:
    netmiko:
      platform: cisco_xe
      extras:
        device_type: cisco_xe
```

### 🔧 動態配置更新

專案支援部分配置的動態更新，無需重啟服務：

```python
# 支援動態更新的配置
- 日誌級別 (LOG_LEVEL)
- 快取大小 (CACHE_MAX_SIZE, CACHE_TTL)
- 任務清理間隔 (ASYNC_TASK_CLEANUP_INTERVAL)
- AI 解析器版本 (PARSER_VERSION)

# 需要重啟的配置  
- API Keys (GOOGLE_API_KEY, ANTHROPIC_API_KEY)
- AI 提供者 (AI_PROVIDER)
- 設備認證 (DEVICE_USERNAME, DEVICE_PASSWORD)
- 網路連線參數 (MAX_CONNECTIONS, CONNECTION_TIMEOUT)
```

---

## 故障排除和維護

### 🚨 常見問題和解決方案

#### 1. AI 服務問題

**問題：AI 服務初始化失敗**
```bash
# 症狀
ERROR - AI 初始化失敗: Invalid API key

# 排查步驟
1. 檢查環境變數載入
   echo $GOOGLE_API_KEY
   
2. 驗證 API Key 有效性
   curl -H "Authorization: Bearer $GOOGLE_API_KEY" \
        "https://generativelanguage.googleapis.com/v1/models"

3. 檢查 .env 檔案路徑
   ls -la WEB_APP/backend/config/.env

# 解決方案
- 確保 API Key 正確且有效
- 檢查 .env 檔案位置和權限
- 重啟服務以重新載入環境變數
```

**問題：AI 查詢超時**
```bash
# 症狀  
HTTPException: AI 查詢超時

# 排查步驟
1. 檢查網路連線
   ping google.com
   
2. 檢查 API 配額
   # 查看 AI 日誌
   tail -f WEB_APP/backend/logs/ai.log

3. 調整超時設定
   # 在 ai_service.py 中增加 timeout 參數

# 解決方案
- 檢查網路穩定性
- 確認 API 配額充足  
- 調整超時時間或使用更快的模型
```

#### 2. 設備連線問題

**問題：設備連線超時**
```bash
# 症狀
NetmikoTimeoutException: TCP connection to device failed

# 排查步驟
1. 網路連線測試
   ping 202.3.182.202
   telnet 202.3.182.202 22

2. 檢查設備配置
   # 查看 config/devices.json
   cat WEB_APP/backend/config/devices.json

3. 檢查認證資訊
   # 手動 SSH 測試
   ssh admin@202.3.182.202

# 解決方案
- 確認設備網路可達性
- 驗證 SSH 服務運行狀態
- 檢查防火牆設定
- 確認認證資訊正確
```

**問題：認證失敗**
```bash
# 症狀
NetmikoAuthenticationException: Authentication failed

# 排查步驟  
1. 檢查使用者名稱和密碼
2. 確認設備帳戶狀態
3. 檢查 SSH 金鑰配置 (如適用)

# 解決方案
- 更新正確的認證資訊
- 確認帳戶未被鎖定
- 重置設備密碼 (如必要)
```

#### 3. 非同步任務問題

**問題：任務一直處於 pending 狀態**
```bash
# 症狀
任務建立後長時間保持 pending 狀態

# 排查步驟
1. 檢查任務管理器狀態
   GET /api/task-manager/stats

2. 檢查背景任務執行
   # 查看應用日誌
   tail -f WEB_APP/backend/logs/app.log

3. 檢查系統資源
   # CPU、記憶體使用情況
   top
   htop

# 解決方案
- 重啟服務以重置任務管理器
- 檢查系統資源充足性
- 調整任務併發數量
```

**問題：任務清理不正常**
```bash
# 症狀
過期任務未被自動清理

# 排查步驟
1. 檢查清理配置
   echo $ASYNC_TASK_CLEANUP_INTERVAL
   echo $ASYNC_TASK_TTL

2. 檢查清理日誌
   grep "cleanup" WEB_APP/backend/logs/app.log

# 解決方案
- 調整清理間隔和 TTL 配置
- 手動觸發清理或重啟服務
```

#### 4. 前端問題

**問題：API 請求失敗**
```bash
# 症狀
前端顯示 "Network Error" 或 API 呼叫失敗

# 排查步驟
1. 檢查後端服務狀態
   curl http://localhost:8000/health

2. 檢查 CORS 設定
   # 查看瀏覽器開發者工具 Console

3. 檢查網路連線
   # 瀏覽器開發者工具 Network 標籤

# 解決方案
- 確認後端服務運行正常
- 檢查 CORS 中間件配置
- 檢查前端 API 端點配置
```

**問題：狀態管理異常**
```bash
# 症狀
前端狀態不一致或更新異常

# 排查步驟
1. 檢查 Zustand DevTools
2. 檢查 TanStack Query DevTools  
3. 檢查控制台錯誤訊息

# 解決方案
- 重置相關狀態
- 檢查狀態更新邏輯
- 清除瀏覽器快取
```

### 📊 監控和維護

#### 1. 日誌分析

**主要日誌檔案：**
```bash
WEB_APP/backend/logs/
├── app.log          # 主應用程式日誌
├── ai.log           # AI 服務日誌  
├── network.log      # 網路操作日誌
├── error.log        # 錯誤專用日誌
├── frontend.log     # 前端日誌 (如有)
└── frontend_error.log # 前端錯誤日誌 (如有)
```

**日誌分析指令：**
```bash
# 查看即時日誌
tail -f logs/app.log

# 查找錯誤
grep "ERROR" logs/*.log

# 分析 AI 服務使用情況
grep "AI 查詢" logs/ai.log | wc -l

# 檢查任務執行統計
grep "任務執行完成" logs/app.log | tail -20

# 分析效能問題
grep "執行時間" logs/network.log | sort -k5 -nr
```

#### 2. 效能監控

**關鍵指標：**
- API 回應時間
- 設備連線成功率  
- AI 查詢成功率
- 任務執行統計
- 系統資源使用

**監控指令：**
```bash
# 系統資源監控
htop
iostat -x 1
netstat -tuln

# 應用程式監控  
# 查看任務管理器統計
curl http://localhost:8000/api/task-manager/stats

# AI 服務狀態檢查
curl http://localhost:8000/api/ai-status
```

#### 3. 定期維護

**每日維護：**
- 檢查日誌檔案大小和輪轉情況
- 監控 API 錯誤率
- 檢查設備連線狀態

**每週維護：**
- 分析效能趨勢
- 檢查任務執行統計
- 清理過期的快取資料

**每月維護：**
- 檢查 API Key 到期狀況
- 更新相依套件 (如有安全更新)
- 備份重要配置檔案
- 效能優化檢討

---

## 版本歷程和技術演進

### 📈 版本發展歷程

#### v1.0.9 (2025-07-31) - 健壯的後端與非同步任務處理系統
**重大更新：**
- **AsyncTaskManager 任務管理器**：完整的任務生命週期管理，支援 pending/running/completed/failed/cancelled 五種狀態
- **非同步任務 API**：新增 5 個 FastAPI 端點，支援任務建立、狀態查詢、取消、列表和統計功能
- **前端非同步整合**：useAsyncTasks Hook 完整支援任務管理、輪詢和進度追蹤
- **執行模式切換**：同步/非同步雙執行模式，解決 HTTP 超時和長時間執行問題

**技術改進：**
- 智能輪詢機制：指數退避輪詢策略，從 2 秒到 10 秒動態調整間隔
- 自動清理系統：定期清理過期任務，預設 TTL 24 小時，支援環境變數配置
- 完整錯誤處理：任務失敗恢復、取消機制和詳細錯誤分類
- 執行緒安全設計：使用 asyncio.Lock 確保多用戶並發環境下資料一致性
- requirements.txt 升級：更新到 2024-2025 最佳實踐，FastAPI[standard] 架構

#### v1.0.8 (2025-07-31) - 環境配置統一與文檔同步  
**配置優化：**
- 環境變數配置統一：將 `.env` 檔案統一移至 `WEB_APP/backend/config/.env`
- 配置檔案目錄優化：所有配置檔案統一存放在 config 目錄
- 環境變數完整實施：確認所有環境變數都在程式碼中被正確呼叫和使用

**系統驗證：**
- 日誌系統確認運作：驗證 LoggerConfig 類別和四類日誌檔案完整運作
- 三版本解析器系統確認：parser_version 環境變數配置為 "balanced"
- XML 安全護欄確認：build_ai_system_prompt() 函數中的安全規則完整實施

#### v1.0.7 (2025-07-31) - 記憶體管理優化與代碼清理
**性能大幅提升：**
- 完全移除對話歷史功能：徹底清理 ConversationSummaryMemory 系統，優化性能
- 代碼大幅清理：移除約 200-300 行記憶體管理代碼
- AI 查詢從潛在超時風險降至穩定 2-5 秒回應，Token 使用量減少 60-80%

**安全和品質：**
- ReAct 提示詞安全護欄確認：XML 結構化安全規則完整實施
- 代碼品質提升：統一註解描述，確保代碼狀態與文檔完全一致

#### v1.0.6 (2025-07-30) - 日誌系統統一與輪轉機制
**日誌系統重構：**
- 統一日誌命名：功能導向命名規範（app.log、ai.log、network.log、error.log）
- 檔案輪轉機制：RotatingFileHandler，10MB 檔案大小限制和 5 個備份檔案
- LoggerConfig 類別：統一的日誌配置管理器
- 環境變數配置：支援 LOG_MAX_SIZE、LOG_BACKUP_COUNT、LOG_LEVEL 動態配置

#### v1.0.5 (2025-07-29) - AI 解析器架構優化
**解析器系統重構：**
- parse_agent_result 函數重構：從99行複雜邏輯簡化至55行平衡版本
- 三版本解析器架構：original/simplified/balanced 三種版本，支援環境變數動態切換
- 代碼複雜度降低45%，同時保持95.9%解析成功率

#### v1.0.4 (2025-07-29) - 智能對話記憶體升級 (已移除)
**注：此版本功能已在 v1.0.7 中移除以提升性能**

#### v1.0.3 (2025-07-29) - 思考鏈 (Chain-of-Thought) 範例優化
**AI 查詢優化：**
- Few-shot Examples 整合：build_few_shot_examples() 函數
- 智能範例系統：AI 查詢自動整合思考鏈範例
- 三類思考範例：搜尋型查詢、直接執行和錯誤處理

#### v1.0.2 (2025-07-29) - AI 提示詞工程優化
**提示詞系統重構：**
- XML 結構化提示詞：使用 XML 標籤重構提示詞函數
- 工作流程標準化：4 步驟標準工作流程
- 輸出格式統一：統一 Markdown 輸出格式

#### v1.0.1 (2025-07-28) - 模組化架構優化
**架構重構：**
- 模組化重構：新增 ai_service.py、config_manager.py、utils.py
- 代碼分離：AI 服務、配置管理、工具函數獨立成模組
- 架構清晰：明確模組職責劃分，降低耦合度

#### v1.0.0 (2025-07-27) - 整合式架構實現
**里程碑版本：**
- 架構統一：整合式架構，核心功能集中在 core/ 目錄
- AI 智能整合：Google Gemini AI 整合完成
- API 端點完善：6 個主要 RESTful API 端點
- 前端現代化：React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4

### 🎯 技術決策和架構演進

#### 1. 架構演進歷程

**階段 1: 原型驗證 (v0.1.0 - v0.3.0)**
- 建立基礎的網路設備連接功能
- 實現簡單的 AI 查詢機制
- 驗證技術棧可行性

**階段 2: 功能完善 (v1.0.0 - v1.0.3)**
- 前端現代化架構
- AI 服務整合和優化
- 提示詞工程和思考鏈實現

**階段 3: 性能優化 (v1.0.4 - v1.0.7)**
- 記憶體管理實驗和最終移除
- 解析器架構優化
- 日誌系統統一

**階段 4: 企業級穩定性 (v1.0.8 - v1.0.9)**
- 配置管理統一
- 非同步任務系統完善
- 生產環境準備

#### 2. 關鍵技術決策

**前端技術選擇：**
```
選擇：React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4
原因：
- React 19 最新特性，更好的併發支援
- TypeScript 提供完整類型安全
- Vite 快速建置和熱重載
- 成熟的生態系統和社群支援

替代方案：Vue 3 + Nuxt, Angular, Svelte
決策時間：2025-07-26 (v0.2.0)
```

**後端框架選擇：**
```
選擇：FastAPI + Python 3.8+
原因：
- 自動 OpenAPI 文檔生成
- 優秀的 async/await 支援
- Pydantic 資料驗證整合
- 高效能和現代化設計

替代方案：Django REST, Node.js + Express, Go + Gin
決策時間：2025-07-20 (初始版本)
```

**AI 服務架構：**
```
選擇：雙 AI 引擎 (Gemini + Claude) + LangChain
原因：
- 不同 AI 引擎各有優勢，提供選擇彈性
- LangChain 提供統一的 Agent 和工具框架
- 三版本解析器提供穩定性保證

演進歷程：
v1.0.0: 單一 Gemini 整合
v1.0.1: 加入 Claude 支援  
v1.0.5: 三版本解析器架構
v1.0.7: 移除記憶體管理，專注核心功能
```

**非同步任務架構：**
```
選擇：自建 AsyncTaskManager + FastAPI BackgroundTasks
原因：
- 完整控制任務生命週期
- 與現有架構整合度高
- 避免額外依賴 (如 Celery + Redis)
- 滿足中小規模使用需求

決策時間：2025-07-31 (v1.0.9)
考慮因素：簡單性 vs 擴展性，選擇適合當前需求的方案
```

#### 3. 性能優化歷程

**記憶體管理實驗 (v1.0.4 → v1.0.7):**
- v1.0.4: 引入 LangChain ConversationSummaryMemory
- 目標: 減少 Token 使用，提升回應速度
- 結果: 增加了系統複雜性，實際性能提升有限
- v1.0.7: 完全移除，回歸簡潔架構
- 成果: Token 使用量減少 60-80%，回應時間改善

**解析器優化 (v1.0.5):**
- 問題: 單一解析器複雜度高 (99行)，維護困難
- 解決: 三版本解析器架構
- 成果: 代碼複雜度降低45%，保持功能完整性

**日誌系統優化 (v1.0.6):**
- 問題: 日誌散亂，檔案管理困難
- 解決: 統一命名規範，輪轉機制
- 成果: 4類日誌清晰分類，10MB 輪轉，便於維護

### 🚀 未來發展方向

#### 短期目標 (3-6個月)

**1. 功能增強**
- 支援更多網路設備類型 (Juniper, Arista, Huawei)
- AI 分析功能深化 (配置檢查、安全評估)
- 批次操作優化 (更大規模設備管理)

**2. 使用者體驗**
- 行動端響應式優化
- 更豐富的視覺化圖表
- 操作歷史和書籤功能

**3. 系統穩定性**
- 更完善的錯誤處理和恢復機制
- 監控和告警系統整合
- 自動化測試框架

#### 中期目標 (6-12個月)

**1. 擴展性提升**
- 分佈式任務處理 (考慮 Celery + Redis)
- 資料庫整合 (持久化配置和歷史記錄)
- 微服務架構探索

**2. 企業功能**
- 用戶認證和權限管理
- 多租戶支援
- 審計日誌和合規功能

**3. AI 能力擴展**
- 自定義 AI 工具和插件系統
- 預測性維護功能
- 自動化故障診斷

#### 長期目標 (1-2年)

**1. 平台化發展**
- 插件市場和第三方整合
- 開放 API 和 SDK
- 社群生態建設

**2. 智能化演進**
- 機器學習模型訓練和部署
- 自適應系統調優
- 知識圖譜建構

**3. 雲原生架構**
- Kubernetes 部署支援
- 雲平台整合 (AWS, Azure, GCP)
- 邊緣計算支援

---

## 📚 技術參考和資源

### 📖 核心技術文檔

**前端技術：**
- [React 19 官方文檔](https://react.dev/)
- [TypeScript 5.8 手冊](https://www.typescriptlang.org/docs/)
- [Vite 7.0 指南](https://vitejs.dev/guide/)
- [Zustand 狀態管理](https://zustand-demo.pmnd.rs/)
- [TanStack Query](https://tanstack.com/query/)

**後端技術：**
- [FastAPI 官方文檔](https://fastapi.tiangolo.com/)
- [Pydantic 資料驗證](https://docs.pydantic.dev/)
- [LangChain 框架](https://docs.langchain.com/)
- [Nornir 網路自動化](https://nornir.readthedocs.io/)
- [Netmiko SSH 客戶端](https://pynet.twb-tech.com/blog/netmiko/)

**AI 服務：**
- [Google Gemini API](https://ai.google.dev/docs)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference/)

### 🛠 開發工具

**推薦開發環境：**
- **IDE**: VS Code + Python Extension + TypeScript Hero
- **API 測試**: Postman / Insomnia
- **版本控制**: Git + GitHub Desktop
- **終端**: Windows Terminal / iTerm2
- **瀏覽器**: Chrome DevTools + React DevTools

**實用命令：**
```bash
# 快速開發環境檢查
python --version
node --version
npm --version
git --version

# 專案健康檢查
curl http://localhost:8000/health
curl http://localhost:8000/api/ai-status

# 日誌監控
tail -f WEB_APP/backend/logs/app.log | grep ERROR
```

---

## 📝 結語

這份 CLAUDE.md 文檔為 AI 助手提供了專案的完整技術指南。透過深入的架構分析、詳細的模組解釋、實用的開發指南和完善的故障排除方案，確保 AI 助手能夠有效理解和協助專案的開發與維護工作。

**專案特色總結：**
- 🤖 **AI 驅動**：雙引擎智能分析，三版本解析器確保穩定性
- 🏗 **現代架構**：React 19 + FastAPI，完整的類型安全和非同步支援
- 🔒 **安全第一**：完善的指令驗證和錯誤處理機制
- ⚡ **高效能**：智能快取、連線池、非同步任務處理
- 🔧 **易維護**：模組化設計、統一日誌、完整監控

這個專案代表了現代網路維運工具的發展方向，結合傳統網路管理的可靠性與 AI 技術的智能化，為網路工程師提供強大而安全的維運平台。

---

*最後更新：2025-08-01*  
*文檔版本：v2.0.0*  
*專案版本：v1.0.9*