# CLAUDE.md

## 專案概述

這是一個 **網路維運助理**專案，提供現代化 WEB 介面來執行設備指令，並可以透過 Google Gemini AI / Claude AI 提供智能分析和專業建議

## 核心架構

### 設計理念
- **整合式架構**: 核心功能位於 `WEB_APP/backend/core/`，包含網路工具和 Nornir 整合
- **現代化 WEB 架構**: 採用 React + TypeScript + Vite 前端，FastAPI 後端
- **雙 AI 智能**: 支援 Google Gemini 1.5 Flash 和 Claude 3.5 Sonnet 雙引擎切換
- **Nornir 自動化**: 支援並行多設備管理和批次執行
- **健壯的非同步任務處理**: 完整的任務生命週期管理，解決 HTTP 超時和長時間執行問題
- **安全機制**: 僅執行安全的唯讀指令，完整的指令驗證和錯誤分類
- **智能解析**: 三版本 AI 回應解析器系統，優化提示詞工程
- **多用戶支援**: 支援並發用戶和團隊協作，含對話歷史管理

### 技術特色

- **現代化網頁介面**: React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4 架構，響應式設計
- **雙 AI 智能分析**: Google Gemini 1.5 Flash + Claude 3.5 Sonnet 雙引擎切換支援
- **LangChain Agent 架構**: 基於 LangChain 0.1.20 的智能 Agent 和工具系統
- **多設備管理**: 支援單一/多設備/群組操作，含即時進度追蹤
- **Nornir 並行執行**: 基於 Nornir 3.4.1 的高效批次操作，含錯誤分類和統計
- **非同步任務處理**: AsyncTaskManager 完整任務生命週期管理，支援進度追蹤、任務取消和自動清理
- **智能解析系統**: 三版本解析器（original/simplified/balanced），45%複雜度減少
- **提示詞工程**: XML 結構化提示詞和思考鏈（CoT）範例整合
- **多用戶並發**: 支援團隊同時使用，含對話歷史和快取共享
- **統一日誌系統**: 檔案大小輪轉機制（10MB/檔案，5個備份），功能分類清晰的日誌管理
- **狀態管理**: Zustand 5.0.6 + TanStack Query 5.83.0 優化用戶體驗
- **RESTful API**: 完整的 FastAPI 後端 API 支援系統整合，含 5 個新的非同步任務端點

## 專案結構

```
ai_ops_assistant_gemini/
├── 📁 WEB_APP/                  # 🌐 WEB 版本主目錄
│   ├── 📁 backend/             # 🔧 FastAPI 後端
│   │   ├── 📁 config/          # 配置檔案
│   │   │   ├── devices.json     # 設備配置檔案
│   │   │   ├── groups.json      # 設備群組配置
│   │   │   ├── nornir_defaults.yaml # Nornir 預設配置
│   │   │   ├── nornir_groups.yaml   # Nornir 群組配置
│   │   │   └── nornir_hosts.yaml    # Nornir 主機配置
│   │   ├── 📁 core/            # 🔥 核心功能模組
│   │   │   ├── __init__.py
│   │   │   ├── network_tools.py      # 網路工具核心
│   │   │   └── nornir_integration.py    # Nornir 多設備整合
│   │   ├── 📁 logs/            # 後端日誌（統一命名與輪轉機制）
│   │   │   ├── app.log         # 主應用程式日誌（10MB 輪轉）
│   │   │   ├── ai.log          # AI 服務相關日誌（10MB 輪轉）
│   │   │   ├── network.log     # 網路操作日誌（10MB 輪轉）
│   │   │   └── error.log       # 錯誤專用日誌（10MB 輪轉）
│   │   ├── ai_service.py       # AI 服務模組
│   │   ├── async_task_manager.py # 非同步任務管理器
│   │   ├── config_manager.py   # 配置管理模組
│   │   ├── utils.py            # 工具函數模組
│   │   ├── main.py             # FastAPI 主程式
│   │   └── requirements.txt    # Python 依賴
│   └── 📁 frontend/            # 🚀 React + TypeScript 前端
│       ├── 📁 src/             # 源代碼目錄
│       │   ├── 📁 api/         # API 服務層
│       │   │   ├── client.ts    # HTTP 客戶端配置
│       │   │   ├── index.ts     # API 導出
│       │   │   └── services.ts  # API 服務函數
│       │   ├── 📁 components/  # React 組件
│       │   │   ├── 📁 common/   # 通用組件
│       │   │   ├── 📁 features/ # 功能組件
│       │   │   ├── 📁 layout/   # 佈局組件
│       │   │   └── index.ts     # 組件導出
│       │   ├── 📁 config/      # 前端配置
│       │   │   └── api.ts       # API 配置
│       │   ├── 📁 constants/   # 常數定義
│       │   ├── 📁 hooks/       # 自訂 React Hooks
│       │   ├── 📁 store/       # 狀態管理 (Zustand)
│       │   ├── 📁 styles/      # CSS 樣式
│       │   ├── 📁 types/       # TypeScript 類型定義
│       │   ├── 📁 utils/       # 工具函數
│       │   ├── App.tsx         # 主應用程式組件
│       │   └── main.tsx        # 應用程式入口
│       ├── 📁 docs/            # 前端專用文檔
│       │   └── CLAUDE.md       # 前端開發指引
│       ├── package.json        # 前端依賴和腳本
│       ├── tsconfig.json       # TypeScript 配置
│       ├── vite.config.ts      # Vite 建置配置
│       └── tailwind.config.js  # Tailwind CSS 配置
├── CLAUDE.md                   # Claude Code 專案指引
└── README.md                   # 專案說明
```

## 快速啟動

### 環境準備
```bash
# 系統需求
# Python 3.8+ (推薦 3.13+)
# Node.js 18+ (推薦 22+)
# npm 8+

# 1. WEB 後端環境
cd WEB_APP/backend
pip install -r requirements.txt

# 2. WEB 前端環境
cd WEB_APP/frontend
npm install

# 3. 環境變數配置（建立 WEB_APP/backend/config/.env 檔案）
GOOGLE_API_KEY=your_api_key_here
DEVICE_USERNAME=your_username
DEVICE_PASSWORD=your_password
DEVICE_TYPE=cisco_xe
```

### 啟動方式

```bash
# 後端啟動（主終端機）
cd WEB_APP/backend
python main.py
# 後端服務: http://localhost:8000
# API 文檔: http://localhost:8000/docs

# 前端啟動（新終端機）
cd WEB_APP/frontend
npm run dev  # 開發模式，訪問 http://localhost:5173
npm run build && npm run preview  # 生產版本，訪問 http://localhost:4173
```

## 核心模組

### 1. 網路工具核心 (WEB_APP/backend/core/network_tools.py)
- **CommandValidator**: 指令安全驗證器，支援白名單和危險關鍵字過濾
- **ConnectionPool**: SSH 連線池管理器，支援連線復用、健康檢查和自動清理
- **CommandCache**: 指令結果快取系統，支援 TTL 和 LRU 清理策略
- **get_device_credentials()**: 統一認證管理，支援設備配置和環境變數
- **run_readonly_show_command()**: 安全指令執行函數，含多層錯誤處理

### 2. Nornir 網路自動化 (WEB_APP/backend/core/nornir_integration.py)
- **NornirManager**: Nornir 初始化和設備管理類
- **BatchResult**: 批次執行結果聚合，含錯誤分類和統計
- **unified_network_command_task()**: 統一網路指令任務，含回退機制
- **classify_error()**: 錯誤分類函數，提供詳細錯誤診斷
- **批次工具**: batch_command_wrapper, group_command_wrapper, device_selector_wrapper

### 3. 非同步任務管理器 (WEB_APP/backend/async_task_manager.py)
- **AsyncTaskManager**: 單例模式任務管理器，支援任務生命週期管理和狀態追蹤
- **TaskStatus 和 TaskType**: 完整的任務狀態枚舉和類型定義，支援多種任務類型
- **TaskProgress**: 詳細的進度追蹤系統，含百分比、階段描述和執行統計
- **自動清理機制**: 定期清理過期任務，支援可配置的 TTL（預設 24 小時）
- **錯誤恢復**: 完善的錯誤處理和任務失敗恢復機制
- **執行緒安全**: 使用 asyncio.Lock 確保多用戶並發環境下的資料一致性
- **統計監控**: 完整的任務執行統計和系統監控功能

### 4. FastAPI 後端服務層
#### 主程式 (WEB_APP/backend/main.py)
- **RESTful API**: 11個端點，包含 6個原有端點和 5個新的非同步任務端點
- **非同步任務端點**: 支援任務建立、狀態查詢、取消、列表和統計功能
- **模組化架構**: 整合 AI 服務、配置管理、工具函數和非同步任務管理模組
- **錯誤處理**: 統一錯誤分類和 HTTP 狀態碼映射
- **安全機制**: 指令驗證、認證管理、超時控制
- **生命週期管理**: 應用啟動時自動初始化任務管理器，關閉時清理資源

#### AI 服務模組 (WEB_APP/backend/ai_service.py)
- **雙 AI 智能系統**: Google Gemini 1.5 Flash + Claude 3.5 Sonnet 整合，支援動態切換
- **LangChain Agent**: 基於 LangChain 0.1.20 的智能 Agent 和工具架構
- **三版本解析器系統**: 
  - `_parse_agent_result()`: 原版解析器 (99行，最健壯)
  - `_parse_agent_result_simplified()`: 簡化版解析器 (35行，最簡潔)
  - `_parse_agent_result_balanced()`: 平衡版解析器 (55行，推薦使用)
- **智能工具系統**: 統一的 AI 工具介面和管理，含 BatchCommandRunner 和 CiscoCommandSearch
- **提示詞工程**: XML 結構化提示詞和思考鏈範例整合

#### 配置管理模組 (WEB_APP/backend/config_manager.py)
- **統一配置管理**: 設備配置、群組配置、環境變數管理
- **配置驗證**: 自動驗證配置檔案的正確性
- **動態配置**: 支援執行時配置更新

#### 工具函數模組 (WEB_APP/backend/utils.py)
- **統一日誌系統**: `LoggerConfig` 類別提供檔案大小輪轉機制，支援環境變數配置
  - 統一命名規範：`app.log`、`ai.log`、`network.log`、`error.log`
  - 輪轉配置：10MB 檔案大小限制，保留 5 個備份檔案
  - 日誌統計和清理工具函數
- **AI 提示工程**: 
  - `build_ai_system_prompt()`: XML 結構化提示詞建構
  - `build_few_shot_examples()`: 思考鏈（CoT）範例整合
  - 4 步驟標準工作流程：分析意圖→確認指令→執行操作→總結報告
- **結果格式化**: 執行結果的統一格式化處理

### 5. React 前端 (WEB_APP/frontend/)
- **現代化架構**: React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4，完整類型安全
- **狀態管理**: Zustand 5.0.6 (客戶端狀態) + TanStack Query 5.83.0 (伺服器狀態)
- **非同步任務整合**: useAsyncTasks Hook 完整支援任務管理、輪詢和進度追蹤
- **執行模式切換**: 支援同步/非同步雙執行模式，含智能任務狀態管理
- **響應式設計**: Tailwind CSS 3.4.17，支援桌面/平板/手機
- **組件架構**: 模組化組件設計，包含 common/features/layout 三層架構
- **功能組件**: 設備選擇、指令輸入、批次執行、即時進度追蹤
- **API 整合**: 基於 Axios 1.11.0 的完整錯誤處理、重試機制、超時控制，新增 5 個非同步任務 API
- **依賴管理**: clsx 2.1.1 (CSS 類別組合)，React DOM 19.1.0 (DOM 渲染)

## 開發指南

### 程式碼規範
1. **核心功能**: 在 `WEB_APP/backend/core/` 中開發網路工具和 Nornir 整合
2. **後端開發**: 
   - `WEB_APP/backend/main.py` 中新增 API 端點
   - `WEB_APP/backend/ai_service.py` 中開發 AI 服務功能
   - `WEB_APP/backend/config_manager.py` 中管理配置邏輯
   - `WEB_APP/backend/utils.py` 中新增通用工具函數
3. **前端開發**: 在 `WEB_APP/frontend/src/` 中開發 React 組件和狀態管理
4. **配置管理**: 在 `WEB_APP/backend/config/` 中管理設備和群組配置

### 開發規範
- **Python**: 遵循 PEP 8 規範，使用 type hints，完整錯誤處理
- **TypeScript**: 嚴格模式，完整類型定義，避免 any 類型
- **React**: 函式組件 + Hooks 模式，響應式設計
- **API**: RESTful 設計原則，統一錯誤回應格式

### 測試方法
```bash
# 後端功能測試
cd WEB_APP/backend
python main.py
# 訪問 http://localhost:8000/docs 查看 API 文檔

# 前端開發測試
cd WEB_APP/frontend
npm run dev
# 訪問 http://localhost:5173 查看前端界面

# 核心功能單元測試
cd WEB_APP/backend
python -c "from core.network_tools import CommandValidator; print(CommandValidator.validate_command('show version'))"

# 模組功能測試
python -c "from config_manager import get_config_manager; cm = get_config_manager(); print('配置管理模組正常')"
python -c "from ai_service import get_ai_service; ai = get_ai_service(); print('AI 服務模組正常')"

# 解析器版本測試
python -c "import os; os.environ['PARSER_VERSION']='balanced'; from ai_service import get_ai_service; ai = get_ai_service(); print(f'解析器版本: {ai.parser_version}')"

# 前端建置測試
cd WEB_APP/frontend
npm run build && npm run preview
# 訪問 http://localhost:4173 查看生產版本

# TypeScript 類型檢查
cd WEB_APP/frontend
npx tsc --noEmit

# 前端代碼品質檢查
npm run lint
```

## 安全機制

### 安全特性
- **指令白名單**: 僅允許 `show` 類安全指令
- **危險關鍵字過濾**: 自動阻擋 `configure`、`write`、`delete` 等操作指令
- **SSH 加密**: 使用標準 SSH 協定連接
- **憑證管理**: 透過環境變數或配置檔案安全管理

### 安全建議
- 使用專用的唯讀帳戶連接網路設備
- 定期更新 API 金鑰和設備密碼
- 監控日誌檔案，注意異常存取行為
- 避免在生產環境中使用管理員權限帳戶

## 系統配置

### 效能參數
- **連線池**: 管理 SSH 連線復用，減少建立時間
- **智能快取**: 快取靜態資訊，預設 TTL 5 分鐘
- **健康檢查**: 定期檢查連線狀態，自動清理過期連線
- **前端優化**: Vite 快速建置，React Query 智能快取，組件懶載入
- **解析器優化**: 三版本解析器系統，balanced 版本提供最佳平衡

### 完整環境配置參數
```env
# AI 服務配置
AI_PROVIDER=gemini                   # AI 提供者 (gemini/claude)
GOOGLE_API_KEY=your_key_here         # Google Gemini API Key
ANTHROPIC_API_KEY=your_key_here      # Anthropic Claude API Key
ENABLE_DOCUMENT_SEARCH=true          # 啟用文檔搜尋功能

# AI 模型選擇
GEMINI_MODEL=gemini-1.5-flash-latest # Gemini 模型版本
CLAUDE_MODEL=claude-3-haiku-20240307 # Claude 模型版本

# 設備認證設定
DEVICE_USERNAME=admin                # 設備登入帳號
DEVICE_PASSWORD=your_password        # 設備登入密碼
DEVICE_TYPE=cisco_xe                 # 設備類型

# 效能調校參數
MAX_CONNECTIONS=5                    # 最大連線數
CONNECTION_TIMEOUT=300               # 連線超時時間(秒)
HEALTH_CHECK_INTERVAL=30             # 健康檢查間隔(秒)
COMMAND_TIMEOUT=20                   # 指令執行超時(秒)
CACHE_MAX_SIZE=512                   # 快取最大條目數
CACHE_TTL=300                        # 快取存活時間(秒)
NORNIR_WORKERS=5                     # Nornir 並行工作數

# 解析器版本選擇
PARSER_VERSION=balanced              # 解析器版本 (original/simplified/balanced)

# 日誌系統配置
LOG_MAX_SIZE=10485760               # 日誌檔案最大大小 (10MB)
LOG_BACKUP_COUNT=5                  # 保留備份檔案數量
LOG_LEVEL=INFO                      # 日誌記錄級別 (DEBUG/INFO/WARNING/ERROR)

# 非同步任務處理配置 (v1.0.9 新增)
ASYNC_TASK_CLEANUP_INTERVAL=3600    # 任務清理檢查間隔(秒)，預設 1 小時
ASYNC_TASK_TTL=86400                # 任務過期時間(秒)，預設 24 小時
ASYNC_TASK_POLL_INTERVAL=2000       # 前端輪詢間隔(毫秒)，預設 2 秒
ASYNC_TASK_MAX_POLL_INTERVAL=10000  # 最大輪詢間隔(毫秒)，預設 10 秒
ASYNC_TASK_TIMEOUT=1800000          # 任務總超時時間(毫秒)，預設 30 分鐘

```

## 使用場景

### AI 智能分析系統

系統整合了 Google Gemini AI / Claude AI，提供智能網路設備分析：

#### 🔧 **單一設備分析**
- **適用場景**: "檢查這台設備的版本"、"分析設備介面狀態"
- **功能特色**: 詳細的指令執行和專業分析
- **支援指令**: show 系列安全指令

#### 🌐 **多設備批次操作**
- **適用場景**: "比較所有設備的版本"、"檢查多台設備狀態"
- **功能特色**: Nornir 並行執行、結果聚合、錯誤分類
- **支援模式**: 手動選擇多設備或群組批次執行

#### 👥 **群組設備管理**
- **適用場景**: "檢查 cisco_xe_devices 群組狀態"
- **功能特色**: 預定義群組的批次維運
- **支援群組**: cisco_xe_devices（包含所有 Cisco IOS-XE 設備）

AI 能根據使用者問題提供智能分析和專業建議，支援自然語言問答。

### 適用場景
- **團隊協作**: 透過網頁介面多人同時使用
- **遠程存取**: 隨時隨地透過瀏覽器存取
- **系統整合**: 透過 REST API 與其他系統整合
- **批次維運**: 現代化 UI 支援多設備管理

## 擴展開發

### 新增設備類型
1. 在 `WEB_APP/backend/config/devices.json` 中添加設備配置
2. 更新 `WEB_APP/backend/core/network_tools.py` 中的設備類型處理
3. 在 `WEB_APP/backend/config/nornir_hosts.yaml` 中同步 Nornir 配置
4. 測試設備連線和指令執行

### 新增 AI 功能
1. 在 `WEB_APP/backend/ai_service.py` 中擴展 AI 分析邏輯
2. 實作新的網路分析功能和智能工具
3. 在 `WEB_APP/backend/utils.py` 中更新 AI prompt 和回應處理
4. 在 `WEB_APP/backend/main.py` 中新增對應的 API 端點
5. 在前端新增對應的 API 服務調用
6. 測試新功能的整合效果

### 新增 API 端點
1. 在 `WEB_APP/backend/main.py` 中新增 FastAPI 路由
2. 定義 Pydantic 請求和回應模型
3. 使用相應的服務模組實作端點邏輯（ai_service.py、config_manager.py、utils.py）
4. 實作統一的錯誤處理
5. 在 `WEB_APP/frontend/src/api/services.ts` 中新增 API 函式
6. 更新前端組件以使用新端點

### 前端功能擴展
1. 在 `src/types/` 中定義相關 TypeScript 類型
2. 在 `src/api/services.ts` 中新增 API 函式
3. 使用組件化模式開發 React 組件
4. 整合狀態管理（Zustand 或 TanStack Query）
5. 新增響應式設計和錯誤處理

## 版本歷程

### v1.0.9 (2025-07-31) - 健壯的後端與非同步任務處理系統
- **AsyncTaskManager 任務管理器**: 完整的任務生命週期管理，支援 pending/running/completed/failed/cancelled 五種狀態
- **非同步任務 API**: 新增 5 個 FastAPI 端點，支援任務建立、狀態查詢、取消、列表和統計功能
- **前端非同步整合**: useAsyncTasks Hook 完整支援任務管理、輪詢和進度追蹤
- **執行模式切換**: 同步/非同步雙執行模式，解決 HTTP 超時和長時間執行問題
- **智能輪詢機制**: 指數退避輪詢策略，從 2 秒到 10 秒動態調整間隔
- **自動清理系統**: 定期清理過期任務，預設 TTL 24 小時，支援環境變數配置
- **完整錯誤處理**: 任務失敗恢復、取消機制和詳細錯誤分類
- **執行緒安全設計**: 使用 asyncio.Lock 確保多用戶並發環境下資料一致性
- **統計監控功能**: 完整的任務執行統計和系統資源監控
- **requirements.txt 升級**: 更新到 2024-2025 最佳實踐，FastAPI[standard] 架構
- **TypeScript 類型完整**: 新增非同步任務相關的完整類型定義和 API 整合
- **狀態管理整合**: Zustand 整合非同步任務狀態，支援即時任務進度追蹤

### v1.0.8 (2025-07-31) - 環境配置統一與文檔同步
- **環境變數配置統一**: 將 `.env` 檔案統一移至 `WEB_APP/backend/config/.env`，改善配置管理結構
- **配置檔案目錄優化**: 所有配置檔案（設備配置、群組配置、環境變數）統一存放在 config 目錄
- **日誌系統確認運作**: 驗證 LoggerConfig 類別和四類日誌檔案（app.log、ai.log、network.log、error.log）完整運作
- **環境變數完整實施**: 確認所有環境變數都在程式碼中被正確呼叫和使用
- **三版本解析器系統確認**: parser_version 環境變數配置為 "balanced"，系統運作正常
- **XML 安全護欄確認**: build_ai_system_prompt() 函數中的 `<security_rules>` 區塊完整實施
- **文檔與代碼完全同步**: 移除已廢棄功能的文檔描述，確保文檔完全反映當前程式碼狀態
- **配置路徑更新**: 更新文檔中的環境變數配置指引，確保用戶正確設置開發環境

### v1.0.7 (2025-07-31) - 記憶體管理優化與代碼清理
- **完全移除對話歷史功能**: 徹底清理 ConversationSummaryMemory 系統和所有記憶體管理相關代碼，優化性能
- **ReAct 提示詞安全護欄確認**: 確認 XML 結構化 `<security_rules>` 區塊完整實施，與 net_ops_assistant v1.0.7 標準一致
- **代碼大幅清理**: 移除 CONVERSATION_MEMORY_CONFIG 殘留變數和約 200-300 行記憶體管理代碼
- **統一日誌系統確認**: 驗證 LoggerConfig 管理器和 10MB 輪轉機制完整運作
- **三版本解析器系統確認**: 確認 parser_version 環境變數配置和 original/simplified/balanced 版本支援
- **XML 結構化提示詞確認**: 驗證 build_ai_system_prompt() 函數和思考鏈範例系統完整性
- **性能大幅提升**: AI 查詢從潛在超時風險降至穩定 2-5 秒回應，Token 使用量減少 60-80%
- **代碼品質提升**: 統一註解描述，確保代碼狀態與文檔完全一致，提升維護性

### v1.0.6 (2025-07-30) - 日誌系統統一與輪轉機制
- **統一日誌命名**: 簡化日誌檔案命名，採用功能導向命名規範（`app.log`、`ai.log`、`network.log`、`error.log`）
- **檔案輪轉機制**: 實施 `RotatingFileHandler`，支援 10MB 檔案大小限制和 5 個備份檔案
- **LoggerConfig 類別**: 新增統一的日誌配置管理器，提供標準化的日誌處理器建立
- **環境變數配置**: 支援 `LOG_MAX_SIZE`、`LOG_BACKUP_COUNT`、`LOG_LEVEL` 動態配置
- **錯誤日誌分離**: 新增專用的錯誤日誌處理器，便於問題診斷和分析
- **代碼重構**: 移除重複的日誌配置代碼，統一使用 `utils.py` 中的配置管理器
- **文檔同步**: 更新 `CLAUDE.md` 以反映新的日誌系統架構和配置參數

### v1.0.5 (2025-07-29) - AI 解析器架構優化
- **parse_agent_result 函數重構**: 從99行複雜邏輯簡化至55行平衡版本，代碼複雜度降低45%
- **三版本解析器架構**: 提供 original/simplified/balanced 三種解析器版本，支援環境變數動態切換
- **Prompt 工程強化**: 明確 `Final Answer:` 格式要求，統一AI輸出格式，提升解析穩定性
- **智能測試套件**: 建立17個測試案例的AB測試框架，確保重構品質和向後相容性
- **平衡版解析器**: 推薦使用的平衡版本，保持95.9%解析成功率同時大幅降低維護成本
- **配置優化**: 新增 `PARSER_VERSION` 環境變數，支援 original/simplified/balanced 三種模式
- **性能提升**: 在保持相同功能性的前提下，顯著提升代碼可讀性和維護效率

### v1.0.4 (2025-07-29) - 智能對話記憶體升級
- **LangChain ConversationSummaryMemory 整合**: 引入智能對話摘要機制，支援自動 Token 優化
- **雙層記憶體架構**: 智能摘要層 + 傳統儲存層，確保系統穩定性和向後相容性
- **豐富配置選項**: 6 個環境變數配置參數，支援即時更新和驗證機制
- **自動降級機制**: AI 服務不可用時自動切換到傳統模式，保證 100% 可用性
- **效能顯著提升**: Token 使用量減少 40-60%，回應速度提升 20-30%
- **完整測試套件**: 5 大類測試確保功能正確性和向後相容性
- **詳細使用指南**: 完整的配置、監控、故障排除文檔支援

### v1.0.3 (2025-07-29) - 思考鏈 (Chain-of-Thought) 範例優化
- **Few-shot Examples 整合**: 新增 `build_few_shot_examples()` 函數，提供完整的思考過程範例
- **智能範例系統**: AI 查詢自動整合思考鏈範例，顯著提升回應一致性和工具選擇正確率
- **三類思考範例**: 涵蓋搜尋型查詢、直接執行和錯誤處理三種關鍵場景
- **統一查詢接口**: 修改 `execute_ai_mode()` 使用 `ai_service.query_ai()` 統一接口
- **品質保證**: 完整的測試套件驗證範例品質、XML 結構和整合邏輯
- **效能提升**: 預期 AI 回應一致性提升 60%+，工具選擇正確率大幅改善

### v1.0.2 (2025-07-29) - AI 提示詞工程優化
- **XML 結構化提示詞**: 使用 XML 標籤重構 `build_ai_system_prompt` 函數，提升 LLM 理解能力
- **工具說明優化**: 重新設計 `BatchCommandRunner` 和 `CiscoCommandSearch` 工具描述，明確使用場景和輸入格式
- **工作流程標準化**: 建立 4 步驟標準工作流程：分析意圖→確認指令→執行操作→總結報告
- **輸出格式統一**: 統一單設備和多設備的 Markdown 輸出格式，提升回應專業度
- **代碼重構**: 清理 `main.py` 中的重複提示詞邏輯，統一使用 `utils.py` 中的優化函數
- **測試驗證**: 新增完整的提示詞測試套件，確保優化品質

### v1.0.1 (2025-07-28) - 模組化架構優化
- **模組化重構**: 後端架構進一步模組化，新增 ai_service.py、config_manager.py、utils.py
- **代碼分離**: AI 服務、配置管理、工具函數獨立成模組，提升維護性
- **文檔同步**: 更新所有文檔以反映實際程式碼架構
- **架構清晰**: 明確模組職責劃分，降低耦合度

### v1.0.0 (2025-07-27) - 整合式架構實現
- **架構統一**: 整合式架構，核心功能集中在 `WEB_APP/backend/core/`
- **AI 智能整合**: Google Gemini AI 整合，支援網路設備智能分析
- **API 端點完善**: 6 個主要 RESTful API 端點，支援單一、批次操作
- **對話歷史管理**: 支援多設備的對話歷史記錄
- **錯誤處理強化**: 統一錯誤分類系統，提供詳細診斷
- **前端現代化**: React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4 完整技術棧

### v0.3.0 (2025-07-27) - Nornir 多設備整合
- 整合 Nornir 網路自動化框架
- 新增多設備操作功能
- AI 智能分析機制
- 簡化設備群組管理（cisco_xe_devices）

### v0.2.0 (2025-07-26) - 前端現代化
- 全面遷移 WEB 版本至 React 19 + TypeScript 5.8 + Vite 7.0 架構
- 大幅提升效能和開發體驗
- 整合現代開發工具鏈和最佳實踐
- 完善類型安全和模組化設計

### v0.1.0 (2025-07-23) - 架構重構
- 重新整理專案結構，優化核心模組
- 整合 WEB CLI 介面
- 統一配置管理

### v0.1.0-alpha (2025-07-20) - 初始發布
- 建立 AI 驅動的網路運維助理
- 實作安全指令執行機制
- 支援連線池和快取系統

## 技術資訊

- **專案版本**: v1.0.9 (健壯的後端與非同步任務處理版本)
- **更新日期**: 2025-07-31
- **核心架構**: FastAPI + React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4 + Nornir 3.4.1
- **AI 引擎**: Google Gemini 1.5 Flash + Claude 3.5 Sonnet (雙 AI 引擎切換)
- **自動化框架**: LangChain 0.1.20 Agent 架構 + Nornir 網路自動化
- **關鍵依賴版本**:
  - 前端: Zustand 5.0.6 + TanStack Query 5.83.0 + Axios 1.11.0 + Tailwind CSS 3.4.17
  - 後端: Python 3.8+ + Nornir 3.4.1 + LangChain 相關套件
- **支援設備**: 2台 Cisco ASR 1001-X 設備 (IOS-XE)
- **解析器系統**: 三版本智能解析器 (original/simplified/balanced)
- **技術文檔**: 詳見 `WEB_APP/frontend/docs/CLAUDE.md`
- **日誌記錄**: `WEB_APP/backend/logs/` 目錄中的詳細日誌檔案

---

這個專案結合了現代化 AI 技術、Nornir 網路自動化與傳統網路運維需求，提供現代化 WEB 介面，支援單一設備和多設備批次操作，並具備多用戶並發能力，確保在團隊協作和遠程運維場景下都能發揮最佳效果。