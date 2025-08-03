# AI 網路運維助理專案完整技術文件

> 📋 **目的**: 此文件是為Claude AI助理編寫的完整專案理解指南  
> 🎯 **用途**: 每次對話初始化時快速掌握專案架構、功能模組和技術細節  
> 📅 **最後更新**: 2025-08-03  
> 🔄 **維護頻率**: 隨專案重大更新同步修改

---

## 📖 目錄

1. [專案概覽](#專案概覽)
2. [後端系統架構](#後端系統架構)
3. [前端架構設計](#前端架構設計)
4. [配置和部署](#配置和部署)
5. [開發指南](#開發指南)
6. [系統特色功能](#系統特色功能)
7. [最佳實踐](#最佳實踐)
8. [問題診斷](#問題診斷)

---

## 專案概覽

### 🎯 專案簡介
**AI 網路運維助理 (AI Ops Assistant)** 是一個現代化的網路設備管理和智能分析平台：

- **核心功能**: 網路設備指令執行、AI智能分析、批次操作管理
- **技術架構**: FastAPI 後端 + React TypeScript 前端
- **AI 能力**: 支援 Google Gemini 和 Claude AI 雙引擎
- **自動化**: 基於 Netmiko 和 Nornir 的網路自動化框架
- **用戶目標**: CCIE 級網路工程師的專業運維工具

### 🏗️ 技術架構圖

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React 前端    │    │   FastAPI 後端  │    │   網路設備群   │
│                 │    │                 │    │                 │
│ • TypeScript    │◄──►│ • AI Service    │◄──►│ • Cisco IOS-XE │
│ • Zustand狀態   │    │ • Network Tools │    │ • SSH/Netmiko  │
│ • TailwindCSS   │    │ • Nornir整合    │    │ • 批次執行      │
│ • React Query   │    │ • 非同步任務    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI/UX 層      │    │   AI 分析層     │    │   設備管理層    │
│                 │    │                 │    │                 │
│ • 設備選擇      │    │ • Gemini API    │    │ • 設備清單      │
│ • 指令輸入      │    │ • Claude API    │    │ • 群組管理      │
│ • 結果展示      │    │ • 提示詞工程    │    │ • 安全驗證      │
│ • 進度監控      │    │ • ReAct 思考鏈  │    │ • 連線池        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🎮 主要功能模組

1. **設備管理系統**
   - 支援 Cisco IOS-XE 設備
   - 動態設備清單和群組配置
   - SSH 連線池和健康檢查

2. **AI 智能分析**
   - 雙 AI 引擎支援 (Gemini/Claude)
   - 自然語言問題理解
   - 結構化分析報告輸出

3. **批次操作執行**
   - 同步/非同步執行模式
   - 多設備並行處理
   - 實時進度追蹤

4. **安全與驗證**
   - 只允許唯讀指令執行
   - 指令安全性自動驗證
   - 設備憑證管理

---

## 後端系統架構

### 📁 核心檔案結構

```
WEB_APP/backend/
├── main.py                    # FastAPI 應用程式入口
├── ai_service.py             # AI 服務核心模組
├── async_task_manager.py     # 非同步任務管理器
├── config_manager.py         # 統一配置檔案管理器 (新增)
├── utils.py                  # 工具函數和日誌配置
├── formatters.py             # 資料格式化工具 (新增)
├── models/                   # Pydantic 模型定義
│   ├── ai_response.py        # AI 回應模型
│   └── __init__.py
├── core/                     # 核心功能模組
│   ├── network_tools.py      # 網路工具核心
│   ├── nornir_integration.py # Nornir 整合層
│   ├── __init__.py
│   └── prompt_manager/       # 企業級提示詞管理系統 (重構)
│       ├── __init__.py       # 模組初始化和便利函數
│       ├── manager.py        # 核心提示詞管理器
│       └── exceptions.py     # 專用例外處理
├── templates/prompts/        # Jinja2 提示詞模板系統 (全新架構)
│   ├── config/              # YAML 配置檔案
│   │   ├── examples.yaml     # ReAct 思考鏈範例配置
│   │   ├── tools.yaml       # 工具描述配置
│   │   └── variables.yaml   # 全域變數配置
│   └── zh_TW/               # 繁體中文模板目錄
│       ├── system_prompt.j2 # 系統主提示詞模板
│       ├── react_examples.j2 # 思考鏈範例模板
│       ├── tool_descriptions_with_search.j2    # 含搜尋工具說明
│       └── tool_descriptions_no_search.j2      # 無搜尋工具說明
├── config/                  # 系統配置檔案
│   ├── devices.json         # 設備清單配置
│   ├── groups.json          # 設備群組配置
│   └── security.json        # 安全規則配置 (新增)
└── logs/                    # 日誌檔案目錄
    ├── app.log              # 應用程式主日誌
    ├── ai.log               # AI 服務專用日誌
    ├── error.log            # 錯誤日誌
    ├── network.log          # 網路操作日誌
    ├── frontend.log         # 前端日誌收集
    └── frontend_error.log   # 前端錯誤日誌
```

### 🤖 AI 服務系統 (`ai_service.py`)

**核心特色**:
- **雙引擎支援**: Google Gemini + Claude AI
- **ReAct 思考鏈**: 結構化的問題分析流程
- **PydanticOutputParser**: 確保 JSON 格式輸出
- **範例防洩漏機制**: 防止 AI 直接使用訓練範例

**關鍵類別**:
```python
class AIService:
    """AI 服務管理器核心"""
    def __init__(self):
        self.agent_executor = None
        self.search_enabled = False
        self.ai_initialized = False
        self.parser = PydanticOutputParser(pydantic_object=NetworkAnalysisResponse)
        self.prompt_manager = get_prompt_manager()
    
    async def query_ai(self, prompt: str, timeout: float = 60.0, 
                      device_ips: List[str] = None) -> str:
        """執行 AI 查詢，返回結構化分析結果"""
```

**AI 工具整合**:
- `BatchCommandRunner`: 網路設備指令執行工具
- `CiscoCommandSearch`: Cisco 文檔搜尋工具 (可選)

### 🌐 網路自動化核心 (`core/network_tools.py` + `core/nornir_integration.py`)

**設計原則**:
- 基於 Netmiko 的 SSH 連線管理
- Nornir 框架提供批次操作能力
- 指令安全驗證和錯誤分類
- 連線池和快取機制優化效能

**關鍵功能**:
```python
def run_readonly_show_command(device_ip: str, command: str, device_config: dict) -> str:
    """執行安全的 show 指令"""

class NornirManager:
    """Nornir 批次操作管理器"""
    def run_batch_command(self, command: str, device_ips: List[str]) -> BatchResult:
        """批次執行指令並返回結構化結果"""
```

**安全機制**:
- `CommandValidator`: 指令安全性驗證器
- 只允許 `show` 類唯讀指令
- 自動阻止配置變更指令

### 📝 企業級提示詞管理系統 (`core/prompt_manager/`)

**🏢 企業級特色** (重大重構):
- **Jinja2 模板引擎**: 完整的模板變數注入和條件渲染
- **配置分離架構**: YAML 配置與模板分離，便於維護
- **多語言支援**: 完整的國際化架構 (目前支援 zh_TW)
- **熱重載機制**: 不重啟服務即可更新所有提示詞和配置
- **LRU 快取優化**: 減少檔案 I/O，提升效能
- **線程安全**: 支援並發訪問和更新

**🗂️ 全新檔案組織架構**:
```
templates/prompts/
├── config/                        # 集中化 YAML 配置管理
│   ├── examples.yaml             # ReAct 思考鏈範例和用例
│   ├── tools.yaml               # 工具描述和使用說明
│   └── variables.yaml           # 全域變數和安全規則
└── zh_TW/                        # 語言特定模板目錄
    ├── system_prompt.j2          # 動態系統主提示詞
    ├── react_examples.j2         # 範例防洩漏機制模板
    ├── tool_descriptions_with_search.j2    # 含搜尋工具說明
    └── tool_descriptions_no_search.j2      # 無搜尋工具說明
```

**🔧 核心管理器實現**:
```python
class PromptManager:
    """企業級提示詞管理器 - 線程安全實現"""
    
    def __init__(self, base_dir: Optional[Path] = None, language: str = None):
        """支援自動路徑偵測和環境變數配置"""
        
    def render_system_prompt(self, search_enabled: bool = False, 
                            format_instructions: str = "", **kwargs) -> str:
        """動態渲染系統提示詞 - 取代舊的 build_ai_system_prompt"""
        
    def render_react_examples(self, **kwargs) -> str:
        """渲染範例防洩漏機制 - 取代舊的 _get_react_examples"""
        
    def clear_cache(self):
        """熱重載支援 - 清除快取並重新載入配置"""
        
    def get_stats(self) -> Dict[str, Any]:
        """管理器統計和監控資訊"""
```

**🚀 管理 API 端點**:
```bash
# 熱重載提示詞配置
POST /api/admin/reload-prompts

# 查看提示詞管理器狀態
GET /api/admin/prompt-manager/stats
```

**⚡ 快取和效能優化**:
- `@lru_cache(maxsize=32)` 快取 YAML 檔案載入
- 線程安全的配置更新機制
- 智能模板路徑解析和自動偵測

### ⚡ 非同步任務管理器 (`async_task_manager.py`)

**設計目標**: 解決長時間批次操作的 HTTP 超時問題

**核心功能**:
- 非同步任務建立和追蹤
- 實時進度更新機制
- 任務取消和清理功能
- 任務統計和監控

**關鍵類別**:
```python
class AsyncTaskManager:
    """企業級非同步任務管理器"""
    async def create_task(self, task_type: TaskType, params: Dict[str, Any]) -> AsyncTask:
        """建立新的非同步任務"""
    
    async def update_progress(self, task_id: str, percentage: float, stage: str):
        """更新任務進度"""
```

### 🔌 API 端點設計 (`main.py`)

**RESTful API 架構** (最新版本):

| 端點路徑 | 方法 | 功能描述 |
|---------|------|----------|
| `/health` | GET | 健康檢查 |
| `/api/devices` | GET | 取得設備清單 |
| `/api/device-groups` | GET | 取得設備群組 |
| `/api/execute` | POST | 單一設備指令執行 |
| `/api/ai-query` | POST | AI 智能查詢 |
| `/api/batch-execute` | POST | 同步批次執行 |
| `/api/batch-execute-async` | POST | 非同步批次執行 |
| `/api/task/{task_id}` | GET | 查詢任務狀態 |
| `/api/tasks` | GET | 列出所有任務 |
| `/api/tasks/{task_id}/cancel` | POST | 取消指定任務 ✨ |
| `/api/admin/reload-config` | POST | 重載配置檔案 |
| `/api/admin/reload-prompts` | POST | 重載提示詞配置 ✨ |
| `/api/admin/prompt-manager/stats` | GET | 提示詞管理器統計 ✨ |
| `/api/frontend-logs` | POST | 前端日誌收集 ✨ |

**統一錯誤處理**:
```python
async def _handle_ai_request(query: str, device_ips: List[str] = None) -> str:
    """統一處理所有 AI 相關請求的輔助函數"""
```

---

## 前端架構設計

### 🎨 技術棧組成

**核心框架**:
- **React 19**: 最新版本的 React 框架
- **TypeScript**: 完整的型別安全
- **Vite**: 現代化的建構工具
- **TailwindCSS**: 實用優先的 CSS 框架

**狀態管理**:
- **Zustand**: 輕量級全域狀態管理
- **React Query (@tanstack/react-query)**: API 資料快取和同步

**HTTP 客戶端**:
- **Axios**: HTTP 請求處理

### 📁 精簡化前端檔案結構 (重大重構)

**🧹 簡化成果**: 移除約 800+ 行無用程式碼，提升維護性和效能

```
WEB_APP/frontend/src/
├── App.tsx                   # 主應用程式組件 (簡化邏輯)
├── main.tsx                  # 應用程式入口點
├── components/               # 精簡 React 組件庫
│   ├── common/              # 核心通用組件
│   │   ├── Button.tsx       # 統一按鈕組件
│   │   └── CompactProgressBar.tsx # 精簡進度條組件 (新增)
│   ├── features/            # 核心功能組件 (精簡)
│   │   ├── DeviceSelectionContainer.tsx  # 設備選擇容器
│   │   ├── CommandInput.tsx              # 指令輸入介面
│   │   ├── BatchOutputDisplay.tsx        # 批次結果顯示
│   │   ├── BatchResultItem.tsx           # 結果項目組件 (新增)
│   │   ├── GroupSelector.tsx             # 群組選擇器 (新增)
│   │   ├── ModeSelector.tsx              # 模式選擇器 (新增)
│   │   └── MultiDeviceSelector.tsx       # 多設備選擇器 (新增)
│   ├── layout/              # 版面配置組件
│   │   ├── Header.tsx       # 頁首組件
│   │   └── Footer.tsx       # 頁尾組件
│   └── index.ts             # 組件匯出 (精簡)
├── hooks/                   # 自定義 React Hooks (優化)
│   ├── useDevices.ts        # 設備資料管理
│   ├── useBatchExecution.ts # 批次執行邏輯
│   ├── useAsyncTasks.ts     # 非同步任務管理 (優化)
│   ├── useDeviceGroups.ts   # 設備群組管理 (新增)
│   ├── useKeyboardShortcuts.ts # 鍵盤快捷鍵
│   └── index.ts             # Hook 匯出
├── store/                   # 精簡 Zustand 狀態管理
│   ├── appStore.ts          # 主應用程式狀態 (精簡)
│   └── index.ts             # Store 匯出
├── api/                     # API 客戶端 (優化)
│   ├── client.ts            # Axios 客戶端配置 (增強錯誤處理)
│   ├── services.ts          # API 服務函數
│   └── index.ts             # API 匯出
├── types/                   # TypeScript 型別定義 (精簡)
│   ├── api.ts               # API 相關型別
│   ├── components.ts        # 組件 Props 型別 (精簡)
│   ├── store.ts             # 狀態型別定義 (精簡)
│   └── index.ts             # 型別匯出
├── utils/                   # 工具函數 (大幅簡化)
│   ├── SimpleLogger.ts      # 簡化日誌服務 (取代 LoggerService)
│   ├── queryClient.ts       # React Query 配置 (新增)
│   └── utils.ts             # 通用工具函數
├── config/                  # 配置檔案 (新增)
│   └── api.ts               # API 配置
├── styles/                  # 樣式檔案
│   └── index.css            # 主樣式檔案
└── constants/               # 常數定義
    ├── app.ts               # 應用程式常數
    ├── keyboard.ts          # 鍵盤快捷鍵常數
    └── index.ts             # 常數匯出
```

**🗑️ 已移除的冗餘組件**:
- ~~`ProgressBar.tsx`~~ → 整合為 `CompactProgressBar.tsx`
- ~~`StatusDisplay.tsx`~~ → 整合到其他組件
- ~~`BatchProgressIndicator.tsx`~~ → 功能整合
- ~~`DeviceSelectionModeSwitch.tsx`~~ → 簡化邏輯
- ~~`DeviceSelector.tsx`~~ → 拆分為專用組件
- ~~`OutputDisplay.tsx`~~ → 整合到 `BatchOutputDisplay.tsx`
- ~~`LoggerDashboard.tsx`~~ → 移除除錯介面
- ~~`LoggerExample.tsx`~~ → 移除範例組件

**🗃️ 已移除的工具和狀態**:
- ~~`LoggerService.ts`~~ → 簡化為 `SimpleLogger.ts`
- ~~`useLogger.ts`~~ → 功能整合到其他 hooks
- ~~`progressTimer.ts`~~ → 邏輯整合到 appStore
- ~~`envTest.ts`~~ → 移除環境測試工具

### 🎮 核心組件說明

**主應用程式 (`App.tsx`)**:
```typescript
function App() {
  const { mode, selectedDevices, inputValue, batchResults, isAsyncMode } = useAppStore();
  const { executeBatch, isBatchExecuting } = useBatchExecution();
  const { executeAsyncAndWait, isExecuting: isAsyncExecuting } = useAsyncTasks();
  
  // 統一執行邏輯 - 支援同步和非同步模式
  const handleExecute = async () => {
    if (isAsyncMode) {
      await executeAsyncAndWait({ devices: selectedDevices, command: inputValue, mode });
    } else {
      executeBatch(selectedDevices, inputValue);
    }
  };
}
```

**設備選擇容器 (`DeviceSelectionContainer.tsx`)**:
- 設備快選按鈕 (所有設備、群組選擇)
- 個別設備多選清單
- 已選擇設備的摘要顯示

**指令輸入介面 (`CommandInput.tsx`)**:
- 執行模式切換 (指令模式/AI模式)
- 指令快選按鈕
- 非同步/同步模式切換
- 執行按鈕和進度顯示

**批次結果顯示 (`BatchOutputDisplay.tsx`)**:
- 設備執行結果列表
- 成功/失敗篩選器
- 結果展開/收起控制
- 複製功能和清空操作

### 🔄 狀態管理架構 (`store/appStore.ts`)

**Zustand Store 設計**:
```typescript
interface AppStore {
  // 核心狀態
  mode: 'command' | 'ai';
  selectedDevices: string[];
  inputValue: string;
  batchResults: BatchResult[];
  isAsyncMode: boolean;
  
  // 非同步任務狀態
  currentTask: AsyncTaskResponse | null;
  taskPollingActive: boolean;
  
  // 進度和狀態
  batchProgress: number;
  status: string;
  
  // Actions
  setMode: (mode: 'command' | 'ai') => void;
  setSelectedDevices: (devices: string[]) => void;
  clearBatchResults: () => void;
  updateBatchProgress: (progress: number) => void;
}
```

### 🌐 API 整合層 (`api/services.ts`)

**核心 API 服務**:
```typescript
// 設備管理
export const fetchDevices = (): Promise<DevicesResponse> => 
  apiClient.get('/api/devices');

// 批次執行 (同步)
export const executeBatchCommand = (request: BatchExecuteRequest): Promise<BatchResponse> => 
  apiClient.post('/api/batch-execute', request);

// 批次執行 (非同步)
export const executeBatchAsync = (request: BatchExecuteRequest): Promise<TaskCreationResponse> => 
  apiClient.post('/api/batch-execute-async', request);

// 任務狀態查詢
export const fetchTaskStatus = (taskId: string): Promise<TaskResponse> => 
  apiClient.get(`/api/task/${taskId}`);
```

---

## 配置和部署

### 🔧 環境配置檔案

**後端環境變數 (`.env`)**:
```bash
# AI 服務配置
AI_PROVIDER=gemini                    # 或 claude
GOOGLE_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_claude_api_key

# 模型配置
GEMINI_MODEL=gemini-1.5-flash-latest
CLAUDE_MODEL=claude-3-haiku-20240307

# 功能開關
ENABLE_DOCUMENT_SEARCH=false
PARSER_VERSION=original

# 管理配置
ADMIN_API_KEY=admin123

# 提示詞配置
PROMPT_LANGUAGE=zh_TW
PROMPT_TEMPLATE_DIR=/path/to/templates/prompts
```

### 📋 設備配置 (`config/devices.json`)

```json
{
  "devices": [
    {
      "ip": "202.3.182.202",
      "model": "Cisco ASR 1001-X",
      "os": "cisco_xe",
      "name": "SIS-LY-C0609",
      "description": "LY SIS設備",
      "username": "admin",
      "password": "mbfg2017",
      "device_type": "cisco_xe"
    }
  ]
}
```

### 👥 群組配置 (`config/groups.json`)

```json
{
  "groups": [
    {
      "name": "cisco_xe_devices",
      "description": "所有 Cisco IOS-XE 設備",
      "platform": "cisco_xe",
      "device_filter": {
        "device_type": "cisco_xe"
      }
    }
  ]
}
```

### 🔒 企業級安全配置 (`config/security.json`) ✨ 新增

**🛡️ 完整的安全規則配置系統**:

```json
{
  "version": "1.0.0",
  "last_updated": "2025-08-02",
  "command_validation": {
    "allowed_command_prefixes": [
      "show",
      "ping", 
      "traceroute",
      "display",
      "get"
    ],
    "dangerous_keywords": [
      "configure",
      "write",
      "delete",
      "shutdown",
      "reload",
      "copy",
      "erase",
      "format",
      "reset",
      "clear ip route",
      "clear arp",
      "no "
    ],
    "max_command_length": 200,
    "enable_strict_validation": true
  },
  "description": {
    "allowed_command_prefixes": "允許執行的指令前綴清單，只有以這些關鍵字開頭的指令才會被執行",
    "dangerous_keywords": "危險關鍵字清單，包含這些關鍵字的指令將被阻擋",
    "max_command_length": "指令最大長度限制，超過此長度的指令將被拒絕",
    "enable_strict_validation": "是否啟用嚴格驗證模式"
  },
  "audit": {
    "log_all_validations": true,
    "log_blocked_commands": true,
    "alert_on_security_violations": true
  }
}
```

**🔧 統一配置管理器 (`config_manager.py`)** ✨ 新增:

```python
class ConfigManager:
    """統一的配置檔案管理器"""
    
    def __init__(self):
        self.config_dir = Path(__file__).parent / "config"
        self._configs = {}
        self._load_all_configs()
    
    def get_security_config(self) -> Dict[str, Any]:
        """取得安全配置"""
        return self._configs.get("security", {})
    
    def get_devices_config(self) -> Dict[str, Any]:
        """取得設備配置"""
        return self._configs.get("devices", {})
    
    def reload_config(self, config_name: str):
        """熱重載指定配置檔案"""
        
    def validate_command_security(self, command: str) -> Tuple[bool, str]:
        """基於配置檔案驗證指令安全性"""
```

**🔄 熱重載 API**:
```bash
# 重載所有配置檔案
POST /api/admin/reload-config

# 重載特定配置
POST /api/admin/reload-config?type=security
```

### 🚀 部署指南

**後端啟動**:
```bash
cd WEB_APP/backend
python -m pip install -r requirements.txt
python main.py
# 服務運行在 http://localhost:8000
```

**前端啟動**:
```bash
cd WEB_APP/frontend
npm install
npm run dev
# 服務運行在 http://localhost:5173
```

**生產環境部署**:
```bash
# 後端生產模式
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# 前端建置
npm run build
# 建置檔案在 dist/ 目錄
```

---

## 開發指南

### 🛠️ 開發環境設置

**Python 後端環境**:
```bash
# 建立虛擬環境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安裝依賴
pip install -r requirements.txt

# 設定環境變數
cp .env.example .env
# 編輯 .env 檔案設定 API 金鑰
```

**Node.js 前端環境**:
```bash
# 確認 Node.js 版本 (建議 18+)
node --version
npm --version

# 安裝依賴
npm install

# 啟動開發服務器
npm run dev
```

### 🔍 API 測試指南

**健康檢查**:
```bash
curl http://localhost:8000/health
```

**設備清單查詢**:
```bash
curl http://localhost:8000/api/devices
```

**AI 查詢測試**:
```bash
curl -X POST http://localhost:8000/api/ai-query \
  -H "Content-Type: application/json" \
  -d '{
    "device_ip": "202.3.182.202",
    "query": "檢查設備版本"
  }'
```

**批次執行測試**:
```bash
curl -X POST http://localhost:8000/api/batch-execute \
  -H "Content-Type: application/json" \
  -d '{
    "devices": ["202.3.182.202"],
    "command": "show version",
    "mode": "command"
  }'
```

### 📊 日誌系統

**日誌檔案結構**:
```
logs/
├── app.log           # 應用程式主日誌
├── ai.log            # AI 服務專用日誌
├── error.log         # 錯誤日誌
├── network.log       # 網路操作日誌
├── frontend.log      # 前端日誌 (後端收集)
└── frontend_error.log # 前端錯誤日誌
```

**日誌級別和用途**:
- `INFO`: 正常操作記錄
- `WARNING`: 非致命性問題
- `ERROR`: 錯誤和例外狀況
- `DEBUG`: 詳細除錯資訊

### 🔧 除錯技巧

**後端除錯**:
```python
# 啟用詳細日誌
import logging
logging.basicConfig(level=logging.DEBUG)

# AI 服務除錯
ai_logger.debug("詳細的 AI 處理資訊")

# 網路操作除錯
logger.debug(f"設備 {device_ip} 連線狀態: {connection_status}")
```

**前端除錯**:
```typescript
// React Query Devtools (開發模式自動啟用)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// 狀態變化追蹤
useEffect(() => {
  console.log('設備清單更新:', selectedDevices);
}, [selectedDevices]);

// API 呼叫除錯
axios.interceptors.request.use(request => {
  console.log('API 請求:', request);
  return request;
});
```

---

## 系統特色功能

### 🛡️ 企業級安全機制強化 ✨ 重大升級

#### 🧠 AI 範例防洩漏機制 (完善版)

**⚠️ 問題背景**: AI 可能直接使用訓練範例的答案，而不是執行實際的設備指令，導致過時或錯誤的分析結果

**🔒 五層防護機制** (新增兩層):

1. **強化系統提示詞** (`templates/prompts/zh_TW/system_prompt.j2`):
```jinja2
🚨🚨🚨 **嚴格禁令 - 違反將導致系統失效** 🚨🚨🚨

**❌ 絕對禁止的行為**：
- **❌ 嚴格禁止**複製或使用下方範例中的任何內容作為最終答案
- **❌ 嚴格禁止**跳過工具調用直接給出答案
- **❌ 嚴格禁止**基於先驗知識而非實際工具輸出進行回答
- **❌ 嚴格禁止**使用範例中的虛構數據作為真實結果

**✅ 強制執行要求**：
- **✅ 每次查詢都必須**執行至少一次 BatchCommandRunner 工具調用
- **✅ 最終答案必須**完全基於工具回傳的 Observation 結果
- **✅ 範例僅用於**學習思考流程，其內容均為虛構且過時
- **✅ 即使查詢與範例高度相似**，也必須執行實際工具獲取最新資料

⚠️ **記住**：沒有工具調用 = 沒有答案 ⚠️
```

2. **範例模板防洩漏強化** (`templates/prompts/zh_TW/react_examples.j2`):
```jinja2
**⚠️ 範例用途說明**：
- 這些範例**僅供學習思考流程**，絕對不可直接複製作為答案
- 每次實際查詢時，**必須執行真實的工具調用**獲取當前設備資料
- 範例中的設備資訊、IP 位址、輸出結果都是虛構的，實際回答必須基於工具執行結果
- **即使用戶查詢與範例相似，也必須進行實際工具執行**
```

3. **動態時間戳記強制要求** (`ai_service.py`):
```python
# 動態添加即時執行強制要求
real_time_enforcement = f"\n\n🚨 **強制執行要求** (時間戳: {time.time()})：\n"
real_time_enforcement += "- 這是一個實時查詢，你必須執行實際的工具調用獲取當前設備資料\n"
real_time_enforcement += "- 絕對禁止使用上述範例的回答作為最終答案\n"
real_time_enforcement += "- 必須基於當前執行的 BatchCommandRunner 工具結果進行分析\n"
enhanced_prompt = enhanced_prompt + real_time_enforcement
```

4. **🆕 設備範圍限制機制** (`device_scope_restriction`):
```python
def restrict_device_scope(self, device_ips: List[str], user_selected: List[str]) -> List[str]:
    """確保 AI 只能操作用戶選擇的設備，防止越權操作"""
    if not user_selected:
        raise SecurityError("未選擇任何設備，AI 無法執行操作")
    
    # 確保 AI 請求的設備都在用戶選擇範圍內
    unauthorized_devices = set(device_ips) - set(user_selected)
    if unauthorized_devices:
        raise SecurityError(f"AI 嘗試訪問未授權設備: {unauthorized_devices}")
    
    return device_ips
```

5. **🆕 工具執行驗證機制**:
```python
class ToolExecutionValidator:
    """驗證 AI 是否確實執行了工具調用"""
    
    @staticmethod
    def validate_ai_response(response: str, tool_execution_count: int) -> bool:
        """驗證 AI 回應是否基於實際工具執行"""
        if tool_execution_count == 0:
            raise SecurityError("AI 未執行任何工具調用，回應無效")
        
        # 檢查回應中是否包含工具執行的證據
        evidence_keywords = ["Observation:", "Action:", "工具執行結果"]
        has_evidence = any(keyword in response for keyword in evidence_keywords)
        
        if not has_evidence:
            logger.warning("AI 回應缺乏工具執行證據")
            
        return has_evidence
```

#### 🔐 設備訪問權限控制

**零信任安全模型**:
```python
def validate_device_access_permission(user_role: str, device_ip: str, operation: str) -> bool:
    """設備訪問權限驗證"""
    security_config = get_security_config()
    
    # 檢查用戶角色權限
    if user_role not in security_config.get("allowed_roles", []):
        return False
    
    # 檢查設備訪問權限
    allowed_devices = security_config.get("user_device_access", {}).get(user_role, [])
    if device_ip not in allowed_devices and "*" not in allowed_devices:
        return False
    
    # 檢查操作權限
    allowed_operations = security_config.get("role_operations", {}).get(user_role, [])
    return operation in allowed_operations
```

### ⚡ 非同步任務系統

**設計目標**: 解決大規模批次操作的 HTTP 超時問題

**核心特色**:
- **即時回應**: 立即返回任務 ID，避免長時間等待
- **進度追蹤**: 實時更新任務執行進度
- **狀態管理**: 完整的任務生命週期管理
- **資源控制**: 任務數量和資源使用限制

**工作流程**:
```python
# 1. 建立非同步任務
task = await task_manager.create_task(
    task_type=TaskType.BATCH_EXECUTE,
    params={"devices": device_list, "command": command, "mode": mode}
)

# 2. 背景執行
background_tasks.add_task(run_batch_task_worker, task.task_id, devices, command, mode)

# 3. 前端輪詢查詢進度
task_status = await task_manager.get_task(task_id)
```

**前端整合**:
```typescript
const { executeAsyncAndWait, cancelCurrentTask, isExecuting } = useAsyncTasks();

// 非同步執行並等待結果
await executeAsyncAndWait({
  devices: selectedDevices,
  command: inputValue,
  mode: 'command'
});
```

### 📝 企業級提示詞管理

**核心特色**:
- **模板化設計**: 使用 Jinja2 模板引擎
- **熱重載功能**: 不重啟服務即可更新提示詞
- **多語言支援**: 支援不同語言的提示詞版本
- **配置分離**: 範例、工具描述、變數分別管理

**檔案組織**:
```
templates/prompts/
├── config/
│   ├── examples.yaml      # ReAct 思考鏈範例
│   ├── tools.yaml        # 工具描述配置
│   └── variables.yaml    # 全域變數
└── zh_TW/
    ├── system_prompt.j2  # 主系統提示詞
    └── react_examples.j2 # 範例模板
```

**動態渲染**:
```python
class PromptManager:
    def render_system_prompt(self, search_enabled: bool = False, 
                            format_instructions: str = "") -> str:
        """根據配置動態渲染系統提示詞"""
        template = self.env.get_template('zh_TW/system_prompt.j2')
        return template.render(
            search_enabled=search_enabled,
            format_instructions=format_instructions,
            security_rules=self.config['variables']['security_rules']
        )
```

**熱重載 API**:
```bash
curl -X POST http://localhost:8000/api/admin/reload-prompts
```

### 🔒 指令安全驗證系統

**安全原則**: 只允許唯讀查詢指令，絕對禁止配置變更

**驗證機制**:
```python
class CommandValidator:
    @staticmethod
    def validate_command(command: str) -> Tuple[bool, str]:
        """驗證指令安全性"""
        # 檢查是否為允許的 show 指令
        if not any(cmd in command.lower() for cmd in ALLOWED_SHOW_COMMANDS):
            return False, "只允許執行 show 類查詢指令"
        
        # 檢查危險關鍵字
        if any(blocked in command.lower() for blocked in BLOCKED_KEYWORDS):
            return False, "指令包含危險操作，已被阻止"
        
        return True, "指令安全"
```

**允許的指令類別**:
- `show version`: 系統版本資訊
- `show interface`: 介面狀態
- `show ip route`: 路由表
- `show environment`: 環境狀態
- `show processes`: 行程資訊

**禁止的操作**:
- `configure`: 進入配置模式
- `write`: 儲存配置
- `reload`: 重啟設備
- `shutdown`: 關閉介面/設備

---

## 最佳實踐

### 🎯 程式碼品質

**TypeScript 類型安全**:
```typescript
// 完整的型別定義
interface BatchExecuteRequest {
  devices: string[];
  command: string;
  mode: 'command' | 'ai';
}

interface BatchResult {
  deviceName: string;
  deviceIp: string;
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

// 使用泛型確保 API 回應型別安全
const useBatchExecution = () => {
  const mutation = useMutation<BatchResponse, Error, BatchExecuteRequest>({
    mutationFn: executeBatchCommand,
  });
};
```

**Python 型別標註**:
```python
from typing import List, Dict, Optional, Tuple, Any

async def query_ai(
    self, 
    prompt: str, 
    timeout: float = 60.0, 
    device_ips: Optional[List[str]] = None
) -> str:
    """完整的型別標註確保程式碼安全"""
```

### 🚀 效能優化策略

**前端快取策略**:
```typescript
// React Query 快取配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 分鐘
      cacheTime: 10 * 60 * 1000,   // 10 分鐘
      refetchOnWindowFocus: false,
    },
  },
});

// 設備清單快取
const { data: devices, isLoading } = useQuery({
  queryKey: ['devices'],
  queryFn: fetchDevices,
  staleTime: 10 * 60 * 1000, // 設備清單較少變動，延長快取時間
});
```

**後端快取機制**:
```python
# LRU 快取配置載入
@lru_cache(maxsize=32)
def _load_yaml(self, file_path: str) -> Dict[str, Any]:
    """快取 YAML 配置檔案"""

# Nornir 連線池
class NornirManager:
    def __init__(self):
        self.connection_pool = {}  # 連線池快取
        self.command_cache = {}    # 指令結果快取
```

**批次操作優化**:
```python
# 使用 asyncio.to_thread 避免阻塞
batch_result: BatchResult = await asyncio.to_thread(
    manager.run_batch_command, command, devices
)

# 並行處理多設備
async def parallel_device_execution(devices: List[str], command: str):
    tasks = [execute_on_device(device, command) for device in devices]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

### 🔧 錯誤處理最佳實踐

**統一錯誤分類**:
```python
def classify_error(error_str: str) -> Dict[str, str]:
    """統一的錯誤分類機制"""
    if "timeout" in error_str.lower():
        return {
            "type": "connection_timeout",
            "category": "網路連線",
            "severity": "medium",
            "suggestion": "檢查設備網路連線狀態"
        }
    elif "authentication" in error_str.lower():
        return {
            "type": "authentication_failed", 
            "category": "認證失敗",
            "severity": "high",
            "suggestion": "檢查設備登入憑證"
        }
```

**前端錯誤邊界**:
```typescript
// 錯誤邊界組件
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React 錯誤邊界捕獲:', error, errorInfo);
    // 可選：發送錯誤到日誌服務
  }
}

// API 錯誤處理
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      // AI API 配額限制
      toast.error('AI 服務配額已用完，請稍後再試');
    } else if (error.response?.status >= 500) {
      // 伺服器錯誤
      toast.error('伺服器暫時不可用，請稍後再試');
    }
    return Promise.reject(error);
  }
);
```

### 🔐 安全考量

**API 金鑰保護**:
```python
# 環境變數載入和驗證
google_api_key = os.getenv("GOOGLE_API_KEY")
if not google_api_key:
    logger.error("GOOGLE_API_KEY 未設定")
    raise ValueError("必須設定 AI API 金鑰")

# 日誌中隱藏敏感資訊
logger.info(f"API Key 已載入: {google_api_key[:10]}...")
```

**設備憑證管理**:
```json
{
  "devices": [
    {
      "ip": "202.3.182.202",
      "username": "admin",
      "password": "encrypted_password_here",
      "key_file": "/path/to/ssh/key"
    }
  ]
}
```

**輸入驗證**:
```python
class ExecuteRequest(BaseModel):
    device_ip: str = Field(..., regex=r'^(\d{1,3}\.){3}\d{1,3}$')
    command: str = Field(..., min_length=1, max_length=500)
    
    @validator('command')
    def validate_command_safety(cls, v):
        is_safe, error_msg = CommandValidator.validate_command(v)
        if not is_safe:
            raise ValueError(error_msg)
        return v
```

---

## 問題診斷

### 🚨 常見問題和解決方案

**1. AI 服務初始化失敗**

*症狀*: `AI 服務未啟用或初始化失敗`

*可能原因*:
- API 金鑰未設定或無效
- 套件安裝不完整
- 網路連線問題

*解決步驟*:
```bash
# 檢查環境變數
echo $GOOGLE_API_KEY
echo $ANTHROPIC_API_KEY

# 檢查套件安裝
pip show langchain-google-genai
pip show langchain-anthropic

# 測試 API 連線
curl -H "Authorization: Bearer $GOOGLE_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models
```

**2. 設備連線超時**

*症狀*: `設備連線超時: 202.3.182.202`

*可能原因*:
- 設備網路不可達
- SSH 服務未啟用
- 防火牆阻擋

*解決步驟*:
```bash
# 網路連通性測試
ping 202.3.182.202

# SSH 連線測試
ssh admin@202.3.182.202

# 檢查設備配置
cat config/devices.json
```

**3. 批次執行部分失敗**

*症狀*: 部分設備執行成功，部分設備失敗

*分析方法*:
```python
# 查看詳細錯誤資訊
for device_ip, error_detail in batch_result.error_details.items():
    print(f"設備: {device_ip}")
    print(f"錯誤類型: {error_detail['type']}")
    print(f"建議: {error_detail['suggestion']}")
```

**4. 前端 API 呼叫失敗**

*症狀*: 前端無法與後端通信

*檢查清單*:
- 後端服務是否運行 (`http://localhost:8000/health`)
- CORS 設定是否正確
- 網路代理設定

*除錯方法*:
```typescript
// 開啟 axios 請求日誌
axios.interceptors.request.use(request => {
  console.log('API 請求:', request.url, request.data);
  return request;
});

axios.interceptors.response.use(
  response => {
    console.log('API 回應:', response.status, response.data);
    return response;
  },
  error => {
    console.error('API 錯誤:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);
```

### 📊 效能監控

**後端效能指標**:
- API 回應時間
- 設備連線成功率
- AI 查詢耗時
- 記憶體使用量

**監控 API**:
```bash
# 取得任務管理器統計
curl http://localhost:8000/api/task-manager/stats

# AI 服務狀態
curl http://localhost:8000/api/ai-status

# 設備健康檢查
curl http://localhost:8000/api/devices/status
```

**前端效能優化**:
```typescript
// React Query Devtools 檢查快取效率
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// 組件渲染效能分析
const MemoizedComponent = React.memo(ExpensiveComponent);

// 狀態更新頻率控制
const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  [handleSearch]
);
```

### 🔍 日誌分析

**重要日誌模式**:

*AI 查詢成功*:
```
2025-08-02 10:30:15,123 - ai_operations - INFO - 成功解析結構化回應: multi_device
```

*設備連線失敗*:
```
2025-08-02 10:31:20,456 - network_operations - ERROR - 設備連線超時: 202.3.182.202
```

*API 配額限制*:
```
2025-08-02 10:32:10,789 - ai_operations - ERROR - API 配額已用完
```

*批次執行統計*:
```
2025-08-02 10:33:05,012 - ai_operations - INFO - 背景批次任務執行完成
```

**日誌查看指令**:
```bash
# 即時監控應用程式日誌
tail -f logs/app.log

# 查看 AI 相關錯誤
grep "ERROR" logs/ai.log | tail -20

# 統計設備連線成功率
grep "設備連線" logs/network.log | grep -c "成功"
```

---

## 📈 專案發展方向

### 🚀 已實現的核心功能

✅ **基礎架構完成**:
- FastAPI 後端 + React 前端架構
- AI 雙引擎支援 (Gemini + Claude)
- 網路設備自動化框架 (Netmiko + Nornir)
- 企業級提示詞管理系統

✅ **核心功能實現**:
- 設備管理和批次操作
- AI 智能分析和結構化輸出
- 非同步任務處理系統
- 完整的安全驗證機制

✅ **使用者體驗優化**:
- 直觀的 Web 介面
- 實時進度追蹤
- 完整的錯誤處理和反饋

### 🛠️ 技術債務和改進空間

**架構優化**:
- [ ] 微服務化架構考量 (目前為單體架構)
- [ ] Redis 快取層引入
- [ ] 資料庫持久化 (目前使用 JSON 檔案)

**功能擴展**:
- [ ] 更多網路設備廠商支援 (目前只支援 Cisco)
- [ ] 配置備份和版本管理
- [ ] 報告生成和排程功能

**監控和維運**:
- [ ] Prometheus + Grafana 監控
- [ ] 分散式日誌收集
- [ ] 健康檢查和自動恢復

---

---

## 📈 版本更新記錄

### 🚀 v2.0.0 - 2025-08-03 (當前版本)

**🔥 重大架構升級**:
- ✅ **企業級提示詞管理系統**: 完整 Jinja2 + YAML 配置架構
- ✅ **五層 AI 範例防洩漏機制**: 防止 AI 直接使用訓練範例
- ✅ **前端架構大幅簡化**: 移除 800+ 行無用程式碼
- ✅ **設備範圍限制機制**: 防止 AI 越權操作設備
- ✅ **企業級安全配置**: 新增 security.json 配置系統
- ✅ **統一配置管理器**: 支援熱重載的配置管理
- ✅ **簡化日誌系統**: 從複雜 LoggerService 簡化為 SimpleLogger

**📊 程式碼品質提升**:
- 程式碼行數減少: -1,220 行
- 新增功能: +1,745 行
- 淨改善: 提升維護性和安全性

### 📜 v1.0.0 - 2025-08-02

**初始架構**:
- FastAPI 後端 + React 前端基礎架構
- AI 雙引擎支援 (Gemini + Claude)
- 基礎網路設備自動化
- 簡單提示詞管理

---

*📝 文件版本: v2.0.0*  
*🔄 最後更新: 2025-08-03*  
*👤 維護者: Claude AI Assistant*
