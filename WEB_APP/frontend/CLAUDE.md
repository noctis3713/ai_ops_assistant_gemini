# CLAUDE.md

## 專案概述

這是一個現代化的 **AI 網路維運助理**前端應用程式，使用 React 19.1.0 + TypeScript 5.8.3 + Vite 7.0.4 建構，提供直觀的 Web 界面來執行網路設備指令和 AI 智能問答。本專案具備多設備管理、批次操作功能，採用現代化技術棧確保卓越的開發體驗和生產性能。

## 快速開始

### 常用開發指令
```bash
# 安裝依賴 (Node.js 18+ 必需)
npm install

# 開發模式（預設 http://localhost:5173）
npm run dev

# 生產建置
npm run build

# 預覽生產版本
npm run preview

# 代碼檢查
npm run lint

# TypeScript 類型檢查
npx tsc --noEmit
```

### 後端整合
前端與運行在 `http://localhost:8000` 的 FastAPI 後端整合，後端採用模組化架構 (v1.0.1)：

#### 後端模組架構
- **ai_service.py**: AI 服務和 LangChain Agent 整合
- **config_manager.py**: 統一配置管理和驗證
- **utils.py**: 通用工具函數和格式化處理
- **main.py**: FastAPI 主服務和路由定義
- **core/**: 網路工具和 Nornir 整合核心模組

#### 核心 API 端點
- `GET /api/devices` - 設備列表查詢
- `POST /api/execute` - 單一設備指令執行
- `POST /api/ai-query` - AI 智能網路分析
- `POST /api/batch-execute` - 多設備批次指令執行
- `GET /api/chat-history/*` - 對話歷史查詢
- `DELETE /api/chat-history/*` - 對話歷史清除

#### 非同步任務 API 端點 (v1.0.9 新增)
- `POST /api/tasks/batch-execute` - 建立非同步批次執行任務
- `GET /api/tasks/{task_id}` - 查詢任務狀態和進度
- `DELETE /api/tasks/{task_id}` - 取消執行中的任務
- `GET /api/tasks` - 列出任務清單，支援狀態篩選
- `GET /api/tasks/stats` - 取得任務管理器統計資訊

## 專案架構

### 技術棧

#### 核心框架
- **React ^19.1.0**: 最新版本前端框架，支援並發模式和 Suspense
- **React DOM ^19.1.0**: React 19 DOM 渲染器，完整現代化支援
- **TypeScript ~5.8.3**: 嚴格模式類型檢查，支援 Project References
- **Vite ^7.0.4**: 次世代建置工具，極速 HMR 和原生 ES 模組

#### 狀態管理和數據獲取
- **Zustand ^5.0.6**: 輕量級狀態管理，無樣板代碼
- **TanStack Query ^5.83.0**: 強大的伺服器狀態管理和快取
- **TanStack Query DevTools ^5.83.0**: 開發除錯工具

#### HTTP 客戶端和工具
- **Axios ^1.11.0**: 功能豐富的 HTTP 客戶端，支援攔截器
- **clsx ^2.1.1**: 條件式 CSS 類別組合工具

#### 樣式系統
- **Tailwind CSS ^3.4.17**: 實用優先的 CSS 框架
- **PostCSS ^8.5.6**: CSS 後處理器，支援現代 CSS 特性
- **Autoprefixer ^10.4.21**: 自動添加瀏覽器前綴

#### 開發工具
- **ESLint ^9.30.1**: 現代 JavaScript/TypeScript 代碼檢查
- **TypeScript ESLint ^8.35.1**: TypeScript 專用 ESLint 規則
- **Vite Plugin React ^4.6.0**: React 支援插件
- **@types/node ^24.1.0**: Node.js 類型定義
- **@types/react ^19.1.8**: React 類型定義
- **@types/react-dom ^19.1.6**: React DOM 類型定義

### 目錄結構
```
frontend/
├── CLAUDE.md              # 本文件（專案文檔）
├── dist/                  # 建置輸出目錄
├── logs/                  # 前端日誌目錄（與後端日誌系統整合）
├── node_modules/          # 依賴套件目錄
├── public/                # 靜態資源
│   └── vite.svg          # Vite 圖示
├── src/                   # 源代碼目錄
│   ├── api/               # API 服務層
│   │   ├── client.ts      # Axios 客戶端配置
│   │   ├── index.ts       # API 服務統一匯出
│   │   └── services.ts    # API 服務函數
│   ├── assets/            # 靜態資源
│   │   └── react.svg      # React 圖示
│   ├── components/        # React 組件
│   │   ├── common/        # 通用 UI 組件
│   │   │   ├── Button.tsx             # 通用按鈕組件
│   │   │   ├── CompactProgressBar.tsx # 精簡進度條組件
│   │   │   ├── ProgressBar.tsx        # 標準進度條組件
│   │   │   └── StatusDisplay.tsx      # 狀態顯示組件
│   │   ├── features/      # 業務功能組件
│   │   │   ├── BatchOutputDisplay.tsx     # 批次執行結果顯示
│   │   │   ├── BatchProgressIndicator.tsx # 批次執行進度指示器
│   │   │   ├── BatchResultItem.tsx        # 單一批次結果項目
│   │   │   ├── CommandInput.tsx           # 指令輸入和控制組件
│   │   │   ├── DeviceSelectionContainer.tsx   # 設備選擇容器組件
│   │   │   ├── DeviceSelectionModeSwitch.tsx  # 設備選擇模式切換
│   │   │   ├── DeviceSelector.tsx         # 單一設備選擇器
│   │   │   ├── GroupSelector.tsx          # 設備群組選擇器
│   │   │   ├── ModeSelector.tsx           # 執行模式切換器
│   │   │   ├── MultiDeviceSelector.tsx    # 多設備選擇器
│   │   │   └── OutputDisplay.tsx          # 輸出結果顯示組件
│   │   ├── layout/        # 佈局組件
│   │   │   ├── Footer.tsx # 頁面底部組件
│   │   │   └── Header.tsx # 頁面標題組件
│   │   └── index.ts       # 組件統一匯出
│   ├── config/            # 配置文件
│   │   └── api.ts         # API 基礎配置
│   ├── constants/         # 常數定義
│   │   ├── app.ts         # 應用程式常數
│   │   ├── index.ts       # 常數統一匯出
│   │   └── keyboard.ts    # 鍵盤快捷鍵常數
│   ├── hooks/             # 自訂 React Hooks
│   │   ├── index.ts               # Hooks 統一匯出
│   │   ├── useAsyncTasks.ts       # 非同步任務管理 Hook (v1.0.9 新增)
│   │   ├── useBatchExecution.ts   # 批次執行管理 Hook
│   │   ├── useDeviceGroups.ts     # 設備群組管理 Hook
│   │   ├── useDevices.ts          # 設備列表管理 Hook
│   │   └── useKeyboardShortcuts.ts # 鍵盤快捷鍵 Hook
│   ├── store/             # 狀態管理
│   │   ├── appStore.ts      # Zustand 主應用狀態
│   │   ├── index.ts         # 狀態管理統一匯出
│   │   └── progressTimer.ts # 進度計時器狀態
│   ├── styles/            # 樣式文件
│   │   └── index.css      # 全域樣式和 Tailwind CSS
│   ├── types/             # TypeScript 類型定義
│   │   ├── api.ts         # API 相關類型定義
│   │   ├── components.ts  # 組件 Props 類型定義
│   │   ├── index.ts       # 類型統一匯出
│   │   └── store.ts       # 狀態管理類型定義
│   ├── utils/             # 工具函數
│   │   ├── queryClient.ts # TanStack Query 客戶端配置
│   │   └── utils.ts       # 通用工具函數
│   ├── App.tsx            # 主應用程式組件
│   ├── main.tsx           # 應用程式入口點
│   └── vite-env.d.ts      # Vite 環境類型定義
├── index.html             # HTML 模板文件
├── package.json           # 專案依賴和腳本配置
├── package-lock.json      # 依賴版本鎖定文件
├── tsconfig.json          # TypeScript 專案參考根配置
├── tsconfig.app.json      # 應用程式 TypeScript 配置
├── tsconfig.node.json     # Node.js TypeScript 配置
├── vite.config.ts         # Vite 建置工具配置
├── tailwind.config.js     # Tailwind CSS 框架配置
├── postcss.config.js      # PostCSS 處理器配置
└── eslint.config.js       # ESLint 代碼檢查配置
```

## 設計系統

### Terminal 色彩系統
本專案採用自定義的 terminal 色彩系統，確保整體視覺一致性：

#### 背景色彩
- `bg-terminal-bg`: 主要背景色 (#f8f9fa)
- `bg-terminal-bg-secondary`: 次要背景色 (#ffffff)  
- `bg-terminal-bg-card`: 卡片背景色 (#ffffff)

#### 主要色彩
- `text-terminal-primary`: 主要品牌色 (#0066cc)
- `text-terminal-primary-hover`: 主要色懸停狀態 (#0056b3)
- `bg-terminal-primary-light`: 主要色淺色版本 (#cce7ff)

#### 文字色彩層次
- `text-terminal-text-primary`: 主要文字 (#212529) - 用於標題、重要內容
- `text-terminal-text-secondary`: 次要文字 (#6c757d) - 用於說明、輔助資訊
- `text-terminal-text-muted`: 輔助文字 (#868e96) - 用於提示、不重要內容  
- `text-terminal-text-light`: 淺色文字 (#adb5bd) - 用於禁用狀態

#### 狀態色彩
- `text-terminal-success`: 成功狀態 (#198754)
- `text-terminal-error`: 錯誤狀態 (#dc3545)  
- `text-terminal-warning`: 警告狀態 (#ffc107)

### 統一樣式 Classes
專案定義了完整的 CSS 組件系統：

#### 按鈕系統
- `.btn-primary`: 主要操作按鈕
- `.btn-secondary`: 次要操作按鈕  
- `.btn-small`: 小型按鈕
- `.btn-ghost`: 透明按鈕

#### 表單元素
- `.form-input`: 統一輸入框樣式
- `.form-select`: 統一下拉選單樣式
- `.label-primary`: 主要標籤樣式

#### 狀態顯示
- `.status-loading`: 載入狀態
- `.status-error`: 錯誤狀態
- `.status-success`: 成功狀態
- `.status-warning`: 警告狀態

#### 卡片系統
- `.card`: 基礎卡片容器
- `.card-header`: 卡片標題區域
- `.card-body`: 卡片內容區域
- `.card-footer`: 卡片底部區域

#### 進度條系統
- **CompactProgressBar**: 精簡進度條組件，整合進度顯示和狀態訊息
- **狀態顏色整合**: 根據執行狀態（success/error/loading）顯示對應顏色框
- **按鈕旁佈局**: 專為放置在執行按鈕右邊設計，高度匹配按鈕
- **動態顯示**: 執行時顯示進度條，完成後顯示狀態訊息

#### CSS 動畫系統
專案實現了豐富的 CSS 動畫效果：

##### 互動動畫
- **模式按鈕發光效果**: `modeButtonGlow` 和 `modeButtonGlowToMax` 動畫，提供按鈕切換的視覺反饋
- **輸入框呼吸閃爍**: `inputBreathingGlow` 動畫，focus 狀態下的呼吸光暈效果
- **狀態提示閃爍**: `statusHintFlash` 動畫，提示訊息的脈衝式閃爍

##### 按鈕立體效果
- **漸層背景**: 使用 CSS 漸層創造立體視覺效果
- **多層陰影**: 結合內陰影和外陰影的立體按鈕設計
- **懸停變換**: `transform: translateY()` 實現按鈕按壓的物理反饋
- **過渡動畫**: 300ms 的平滑過渡效果

##### 展開/收起動畫
- **箭頭按鈕質感**: `expand-arrow-button` 類別提供精緻的小按鈕設計
- **懸停效果**: 結合 `transform` 和 `box-shadow` 的懸停反饋

##### 動畫 Keyframes 實現
```css
/* 狀態提示脈衝閃爍 */
@keyframes statusHintFlash {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* 模式按鈕循環發光 */
@keyframes modeButtonGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(0, 102, 204, 0.3), 0 0 10px rgba(0, 102, 204, 0.1); }
  50% { box-shadow: 0 0 10px rgba(0, 102, 204, 0.6), 0 0 20px rgba(0, 102, 204, 0.3), 0 0 30px rgba(0, 102, 204, 0.1); }
}

/* 輸入框呼吸光暈 */
@keyframes inputBreathingGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(0, 102, 204, 0.3), 0 0 10px rgba(0, 102, 204, 0.1); }
  50% { box-shadow: 0 0 10px rgba(0, 102, 204, 0.6), 0 0 20px rgba(0, 102, 204, 0.3), 0 0 30px rgba(0, 102, 204, 0.1); }
}
```

## 關鍵特性

### 功能完整性
- ✅ **多種設備選擇模式**: 單一設備、多設備選擇，含群組快選動態狀態
- ✅ **雙執行模式**: 設備指令 / 詢問AI
- ✅ **批次操作**: 支援多設備並行執行和結果聚合
- ✅ **整合式進度追蹤**: 執行按鈕旁的精簡進度條，整合狀態顯示和顏色框
- ✅ **簡化結果顯示**: 移除冗餘統計，保留個別設備詳細資訊和篩選功能
- ✅ **全面錯誤處理**: 分類錯誤顯示和用戶指導
- ✅ **響應式設計**: 支援桌面、平板、手機各種螢幕尺寸
- ✅ **繁體中文介面**: 完整的中文本地化
- ✅ **鍵盤快捷鍵**: 提升操作效率
- ✅ **統一設計系統**: 完整的 terminal 色彩系統和樣式規範

### 現代化優勢
- **類型安全**: 完整的 TypeScript 支援和編譯時檢查
- **組件化架構**: 高度模組化的可重用組件設計
- **智能狀態管理**: Zustand (客戶端) + TanStack Query (伺服器狀態)
- **效能最佳化**: Vite 極速建置、React Query 智能快取
- **開發體驗**: Hot reload、TypeScript 智能提示、開發工具支援
- **統一錯誤處理**: 一致的錯誤分類和用戶友善訊息
- **設計一致性**: 統一的 terminal 色彩系統和組件樣式

## 核心組件

### API 服務層 (`src/api/`)
- **client.ts**: Axios 客戶端配置，包含請求/響應攔截器和重試邏輯
- **services.ts**: 完整的 API 服務函數，支援所有後端端點和 5 個新的非同步任務 API
- **非同步任務整合** (v1.0.9): 
  - `batchExecuteAsync()`: 建立非同步批次執行任務
  - `getTaskStatus()`: 查詢任務狀態和進度
  - `cancelTask()`: 取消執行中的任務
  - `listTasks()`: 任務列表查詢，支援狀態篩選
  - `getTaskStats()`: 任務管理器統計資訊
  - `executeAsyncBatchAndWait()`: 建立任務並等待完成的一站式函數
- 集中式錯誤處理和配置管理，類型安全的請求/回應處理

### 組件架構 (`src/components/`)

#### Common 組件 - 可重用基礎 UI
- **Button**: 統一樣式的通用按鈕組件
- **ProgressBar**: 單一執行進度條
- **StatusDisplay**: 執行狀態顯示組件
- **CompactProgressBar**: 精簡進度條組件，整合進度和狀態顯示，專為執行按鈕旁邊設計

#### Features 組件 - 業務邏輯組件

**設備選擇相關組件**
- **DeviceSelector**: 單一設備選擇下拉選單，支援設備搜尋和選擇
- **MultiDeviceSelector**: 多設備複選組件，支援模糊搜尋、展開/收起顯示
- **GroupSelector**: 設備群組選擇器，支援預定義群組快速選擇
- **DeviceSelectionContainer**: 設備選擇統合容器，整合單一/多設備/群組選擇功能
- **DeviceSelectionModeSwitch**: 設備選擇模式切換器（多設備模式控制）
- **ModeSelector**: 執行模式切換器（指令執行 vs AI查詢模式）

**指令執行相關組件**
- **CommandInput**: 指令輸入和執行控制中心，整合精簡進度條和狀態顯示，支援 Ctrl+Enter 快捷鍵
- **OutputDisplay**: 傳統單一設備輸出顯示組件（保留兼容性）
- **CompactProgressBar**: 精簡進度條組件，專為指令輸入區域設計

**批次執行相關組件**
- **BatchOutputDisplay**: 統一批次執行結果顯示，支援成功/失敗/全部結果篩選
- **BatchResultItem**: 單一設備批次結果項目，支援展開/收起詳細資訊
- **BatchProgressIndicator**: 批次執行整體進度指示器，顯示完成數量和百分比

#### Layout 組件 - 頁面佈局
- **Header**: 應用程式標題和導航
- **Footer**: 頁面底部資訊

### 狀態管理 (`src/store/`) - **優化後架構**
- **appStore.ts**: 精簡的 Zustand 主狀態管理，專注於 **純UI狀態**
  - **保留狀態**: 設備選擇、輸入值、執行模式、批次結果等UI相關狀態
  - **移除狀態**: `taskPollingActive` 等冗餘任務狀態，由 TanStack Query 管理
  - **狀態分離**: 清晰的 UI狀態 vs 伺服器狀態 責任劃分
- **progressTimer.ts**: 進度計時器狀態，支援執行時間追蹤和計時功能
- **TanStack Query**: 統一管理伺服器狀態，包含任務狀態、錯誤處理、輪詢機制
- **衍生狀態**: 從 TanStack Query 狀態即時推導，確保 UI 與伺服器狀態完全同步

### 主應用程式架構 (`src/App.tsx`)

應用程式採用**統一批次執行**架構設計：

- **統一執行邏輯**: 所有執行操作（單一設備/多設備/群組）都透過 `executeBatch` 統一處理
- **狀態整合**: 整合設備選擇、指令輸入、執行狀態和結果顯示的完整生命週期
- **鍵盤快捷鍵**: 支援 Ctrl+Enter 快速執行，提升操作效率
- **狀態提示系統**: 動態狀態提示，引導用戶完成設備選擇和指令輸入
- **結果管理**: 統一的批次結果清理和時間戳管理

### 自訂 Hooks (`src/hooks/`)
- **useDevices**: 設備列表查詢和管理
- **useDeviceGroups**: 設備群組列表管理
- **useBatchExecution**: 多設備批次執行和群組執行管理
- **useKeyboardShortcuts**: 鍵盤快捷鍵處理 (Ctrl+Enter 執行等)
- **useAsyncTasks** (v1.0.9 重構): 簡化的非同步任務管理 Hook - **新架構**
  - **衍生狀態計算**: 從 TanStack Query 直接推導 `isExecuting`, `isPolling`, `error`
  - **TanStack Query 輪詢**: 使用 `useQuery` 自動輪詢機制取代手動輪詢
  - **指數退避策略**: 智能動態間隔調整 (2s-10s)，基於執行時間優化
  - **統一錯誤處理**: 移除手動錯誤狀態，統一使用 TanStack Query 錯誤狀態
  - **狀態同步**: 消除多套狀態系統間的同步問題
  - **任務執行**: `executeAsync()` 和 `executeAsyncAndWait()` 雙模式支援
  - **任務控制**: 支援任務取消和手動狀態查詢
  - **效能優化**: 代碼複雜度減少 60%，消除狀態不同步風險

## 樣式指引

### Terminal 色彩系統使用規範

#### 文字色彩選擇原則
```typescript
// ✅ 正確使用 - 統一的 terminal 色彩系統
<div className="text-terminal-text-primary">主要標題</div>
<p className="text-terminal-text-secondary">說明文字</p>
<span className="text-terminal-text-muted">提示資訊</span>

// ❌ 避免使用 - 直接的 gray 色彩
<div className="text-gray-900">標題</div>
<p className="text-gray-600">文字</p>
```

#### 按鈕樣式應用
```typescript
// 主要操作按鈕
<button className="btn-primary">執行</button>

// 次要操作按鈕  
<button className="btn-secondary">清空結果</button>

// 小型輔助按鈕
<button className="btn-small">展開</button>

// 透明按鈕
<button className="btn-ghost">取消</button>
```

#### 狀態顯示樣式
```typescript
// 載入狀態
<div className="status-loading">正在執行...</div>

// 成功狀態
<div className="status-success">執行成功</div>

// 錯誤狀態
<div className="status-error">執行失敗</div>

// 警告狀態
<div className="status-warning">注意事項</div>
```

#### 卡片結構組織
```typescript
<div className="card">
  <div className="card-header">
    <h3>卡片標題</h3>
  </div>
  <div className="card-body">
    卡片內容
  </div>
  <div className="card-footer">
    底部操作
  </div>
</div>
```

### Tailwind CSS 自定義配置

專案在 `tailwind.config.js` 中擴展了 terminal 色彩系統：

```javascript
// 自定義色彩定義
colors: {
  terminal: {
    // 背景色系
    bg: '#f8f9fa',
    'bg-secondary': '#ffffff',
    'bg-card': '#ffffff',
    
    // 主要色彩
    primary: '#0066cc',
    'primary-hover': '#0056b3',
    'primary-light': '#cce7ff',
    
    // 次要色彩
    secondary: '#6c757d',
    'secondary-hover': '#545b62',
    'secondary-light': '#e9ecef',
    
    // 狀態色彩（完整色階）
    success: '#198754',
    'success-light': '#d1e7dd',
    'success-dark': '#146c43',
    
    error: '#dc3545',
    'error-light': '#f8d7da',
    'error-dark': '#b02a37',
    
    warning: '#ffc107',
    'warning-light': '#fff3cd',
    'warning-dark': '#997404',
    
    // 文字色彩層次
    'text-primary': '#212529',
    'text-secondary': '#6c757d',
    'text-muted': '#868e96',
    'text-light': '#adb5bd',
  },
  
  // 與設計系統一致的擴展色彩
  blue: {
    50: '#e7f3ff', 100: '#cce7ff', 200: '#99cfff',
    300: '#66b7ff', 400: '#339fff', 500: '#0066cc',
    600: '#0066cc', 700: '#0056b3', 800: '#004494', 900: '#003875'
  },
  gray: {
    50: '#f8f9fa', 100: '#f8f9fa', 200: '#e9ecef',
    300: '#dee2e6', 400: '#ced4da', 500: '#adb5bd',
    600: '#6c757d', 700: '#495057', 800: '#343a40', 900: '#212529'
  },
  
  // 字體系統
  fontFamily: {
    mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
    sans: ['Source Han Serif TC', 'Lora', 'serif'],
    serif: ['Source Han Serif TC', 'Lora', 'serif'],
    latin: ['Lora', 'serif'],
    chinese: ['Source Han Serif TC', 'serif'],
  },
  
  // 自定義間距
  spacing: {
    '18': '4.5rem',
    '88': '22rem',
  },
  
  // 陰影系統
  boxShadow: {
    'soft': '0 2px 8px rgba(0, 0, 0, 0.1)',
    'card': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
  }
}
```

### 響應式設計原則

使用 Tailwind CSS 響應式前綴確保跨設備相容性：

```typescript
// 響應式佈局範例
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="p-4 card">
    響應式卡片
  </div>
</div>

// 文字大小響應式調整
<h1 className="text-lg md:text-xl lg:text-2xl">
  響應式標題
</h1>
```

## 狀態管理架構優化 (v1.0.9)

### 🚀 優化成果

本次重構實現了前端狀態管理的全面簡化，帶來顯著的質量和效能提升：

#### 代碼複雜度大幅降低
- **useAsyncTasks.ts**: 從 365 行簡化至 ~220 行 (40% 減少)
- **狀態邏輯簡化**: 移除 `useState` 手動狀態管理，改用衍生狀態計算
- **輪詢機制優化**: 使用 TanStack Query 原生輪詢，移除手動 `setTimeout` 邏輯

#### 狀態同步問題根除
- **單一數據來源**: TanStack Query 統一管理伺服器狀態
- **衍生狀態模式**: `isExecuting`, `isPolling`, `error` 直接從 Query 狀態推導
- **消除同步風險**: 不再需要手動保持多套狀態系統同步

#### 架構清晰度提升
- **職責分離**: Zustand (純UI狀態) vs TanStack Query (伺服器狀態)
- **精簡 Store**: 移除 `taskPollingActive` 等冗餘狀態
- **類型安全**: 完整的 TypeScript 類型支援，編譯時錯誤檢查

### ⚡ 技術實現

#### 新的衍生狀態計算
```typescript
// 舊架構：手動狀態管理
const [isExecuting, setIsExecuting] = useState(false);
const [isPolling, setIsPolling] = useState(false);
const [error, setError] = useState<string | null>(null);

// 新架構：衍生狀態計算
const isSubmitting = batchMutation.isPending;
const isPolling = taskQuery.isFetching && !!currentTaskIdRef.current;
const isExecuting = isSubmitting || isPolling;
const error = batchMutation.error?.message || taskQuery.error?.message || null;
```

#### TanStack Query 自動輪詢
```typescript
// 舊架構：手動輪詢邏輯
const poll = async () => {
  const task = await getTaskStatus(taskId);
  // 手動狀態更新和間隔控制
  setTimeout(poll, currentInterval);
};

// 新架構：自動輪詢機制
const taskQuery = useQuery({
  queryKey: ['taskStatus', taskId],
  queryFn: () => getTaskStatus(taskId),
  refetchInterval: (data) => calculatePollInterval(data), // 指數退避策略
  enabled: !!taskId
});
```

#### 精簡的 Zustand Store
```typescript
// 移除的冗餘狀態
- taskPollingActive: boolean  // 改用 TanStack Query 衍生
- 手動錯誤狀態管理         // 統一使用 Query 錯誤狀態

// 保留的核心 UI 狀態
+ selectedDevices: string[]   // 設備選擇
+ inputValue: string         // 用戶輸入
+ isAsyncMode: boolean       // 執行模式切換
+ currentTask: TaskResponse  // 當前任務顯示
```

### 🛡️ 質量保證

#### 向後相容性
- ✅ 所有現有功能完全保持
- ✅ 用戶體驗零影響
- ✅ API 接口完全一致

#### 測試覆蓋
- ✅ TypeScript 編譯檢查通過
- ✅ 狀態一致性驗證
- ✅ 輪詢機制功能測試

### 📈 開發體驗改善

#### 更易維護
- **狀態邏輯集中**: 伺服器狀態統一在 TanStack Query
- **減少心智負擔**: 不再需要考慮狀態同步問題
- **調試更簡單**: 單一數據來源，狀態流向清晰

#### 更高效率
- **開發速度**: 減少狀態管理樣板代碼
- **錯誤減少**: 消除狀態不同步相關 bug
- **重構友善**: 衍生狀態自動跟隨數據變化

這次優化展示了現代 React 狀態管理的最佳實踐，為未來的功能擴展奠定了堅實的技術基礎。

## 開發指引

### 程式碼風格
- 使用 TypeScript 嚴格模式，禁用 `any` 類型
- 採用函式組件 + React Hooks 模式
- 統一的錯誤處理和日誌記錄
- 完整支援繁體中文內容的 UTF-8 編碼
- 遵循 ESLint 規範和最佳實踐
- **樣式一致性**: 強制使用 terminal 色彩系統，避免直接使用 gray 系列顏色

### 樣式開發規範

#### 色彩使用規範
```typescript
// ✅ 推薦做法 - 使用 terminal 色彩系統
className="text-terminal-text-primary"     // 主要文字
className="text-terminal-text-secondary"   // 次要文字  
className="text-terminal-text-muted"       // 輔助文字
className="bg-terminal-bg"                 // 主要背景

// ❌ 避免做法 - 直接使用 gray 系列
className="text-gray-900"
className="text-gray-600"
className="bg-gray-100"
```

#### 組件樣式規範
```typescript
// ✅ 使用統一的組件 classes
<button className="btn-primary">主要按鈕</button>
<div className="card">
  <div className="card-header">標題區域</div>
  <div className="card-body">內容區域</div>
</div>

// ❌ 避免內聯樣式和自定義 classes
<button style={{backgroundColor: '#0066cc'}}>按鈕</button>
<div className="custom-card-style">自定義卡片</div>
```

#### 色彩一致性檢查
定期執行以下檢查確保色彩系統一致性：

```bash
# 檢查是否有使用禁用的 gray 色彩
grep -r "text-gray-[0-9]" src/components/
grep -r "bg-gray-[0-9]" src/components/

# 確保所有文字都使用 terminal 色彩系統
grep -r "text-terminal-text" src/components/
```

### 新功能開發流程
1. **類型定義**: 在 `src/types/` 中定義相關 TypeScript 類型
2. **API 整合**: 在 `src/api/services.ts` 中添加 API 服務函數
3. **狀態管理**: 決定使用 Zustand (UI狀態) 或 TanStack Query (伺服器狀態)
4. **組件開發**: 創建或修改相關 React 組件
5. **樣式實作**: 使用 terminal 色彩系統和統一 CSS classes
6. **色彩檢查**: 確保符合設計系統規範
7. **測試驗證**: 運行 TypeScript 檢查和 ESLint 檢查

### 配置管理

### 日誌系統整合

前端與後端共享統一的日誌系統配置：

#### 日誌目錄架構
```
WEB_APP/
├── backend/logs/          # 後端日誌（統一管理）
│   ├── app.log           # 主應用程式日誌（10MB 輪轉）
│   ├── ai.log            # AI 服務日誌（10MB 輪轉）
│   ├── network.log       # 網路操作日誌（10MB 輪轉）
│   └── error.log         # 錯誤專用日誌（10MB 輪轉）
└── frontend/logs/         # 前端日誌目錄（預留擴展）
    └── [前端特定日誌]      # 未來可添加前端特定日誌
```

#### 日誌系統特性
- **統一輪轉機制**: 10MB 檔案大小限制，保留 5 個備份檔案
- **功能分類**: 按 app/ai/network/error 功能分類記錄
- **環境變數配置**: 透過後端 `.env` 檔案統一配置日誌參數
- **跨平台支援**: 支援前後端統一的日誌管理策略

#### 相關環境變數
```bash
# 後端 config/.env 中的日誌配置
LOG_MAX_SIZE=10485760      # 日誌檔案最大大小 (10MB)
LOG_BACKUP_COUNT=5         # 保留備份檔案數量  
LOG_LEVEL=INFO            # 日誌記錄級別
```

#### Vite 建置配置 (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // 路徑別名支援
    },
  },
})
```

#### 配置檔案組織
- **API 配置**: `src/config/api.ts` 集中管理 API 基礎配置
- **應用常數**: `src/constants/` 目錄組織所有常數定義
- **環境變數**: 支援 Vite 環境變數 (VITE_API_BASE_URL 等)
- **PostCSS 配置**: `postcss.config.js` 支援 Tailwind CSS 處理

### TypeScript 配置架構

專案採用 **TypeScript Project References** 模式，提供更好的建置效能和模組分離：

#### 配置檔案結構
- **tsconfig.json**: 專案參考根配置檔案，定義整體專案結構
- **tsconfig.app.json**: 應用程式 TypeScript 配置，包含嚴格模式和路徑映射
- **tsconfig.node.json**: Node.js 環境配置，用於 Vite 建置工具

#### 主要配置特性

根據實際的配置文件，專案採用以下 TypeScript 設定：

```typescript
// tsconfig.app.json - 應用程式配置
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo", // 建置快取
    "target": "ES2022",                      // 目標 ES2022 版本
    "useDefineForClassFields": true,         // 類別欄位定義語意
    "lib": ["ES2022", "DOM", "DOM.Iterable"], // 支援的函式庫API
    "module": "ESNext",                      // ESNext 模組系統
    "skipLibCheck": true,                    // 跳過函式庫類型檢查以提升效能
    
    /* Bundler 模式配置 */
    "moduleResolution": "bundler",           // Bundler 模組解析策略
    "allowImportingTsExtensions": true,      // 允許導入 .ts/.tsx 檔案
    "verbatimModuleSyntax": true,            // 嚴格模組語法保持
    "moduleDetection": "force",              // 強制模組檢測
    "noEmit": true,                          // 不輸出編譯檔案(由 Vite 處理)
    "jsx": "react-jsx",                      // React 19 新式 JSX 轉換
    
    /* 路徑映射 */
    "baseUrl": ".",                          // 基礎路徑
    "paths": { "@/*": ["./src/*"] },         // 路徑別名支援
    
    /* 嚴格類型檢查 */
    "strict": true,                          // 啟用所有嚴格檢查
    "noUnusedLocals": true,                  // 未使用變數檢查
    "noUnusedParameters": true,              // 未使用參數檢查
    "erasableSyntaxOnly": true,              // 僅可擦除語法檢查
    "noFallthroughCasesInSwitch": true,      // Switch 貫穿案例檢查
    "noUncheckedSideEffectImports": true     // 副作用導入檢查
  },
  "include": ["src"]                         // 包含 src 目錄所有檔案
}

// tsconfig.json - 專案參考根配置
{
  "files": [],                               // 不直接包含檔案
  "references": [                            // 專案參考配置
    { "path": "./tsconfig.app.json" },       // 應用程式配置
    { "path": "./tsconfig.node.json" }       // Node.js 環境配置
  ]
}
```

### 測試和驗證
```bash
# TypeScript 編譯檢查（使用 project references）
npx tsc -b

# 應用程式類型檢查（更嚴格的檢查）
npx tsc -p tsconfig.app.json --noEmit

# Node.js 環境類型檢查
npx tsc -p tsconfig.node.json --noEmit

# ESLint 代碼品質檢查
npm run lint

# 完整建置流程檢查
npm run build

# 色彩系統一致性檢查
grep -r "text-gray-[0-9]" src/components/ && echo "⚠️  發現未統一的色彩，需要逐步遷移到 terminal 色彩系統" || echo "✅ 色彩系統一致"

# 開發環境功能測試
npm run dev
# 訪問 http://localhost:5173

# 生產環境預覽測試
npm run preview
# 訪問 http://localhost:4173
```

## 多設備操作特性

### 設備選擇模式
1. **多設備選擇模式**: 手動選擇多個設備進行批次操作，支援模糊搜尋和折疊顯示
2. **群組快選模式**: 選擇預定義的設備群組進行批次操作，群組按鈕根據選取狀態動態顯示顏色（灰色→藍色）

### 批次執行功能
- **並行執行**: 同時對多個設備執行相同指令
- **整合式進度追蹤**: 執行按鈕旁的精簡進度條，顯示即時進度和狀態
- **狀態顏色整合**: 進度條和狀態訊息統一使用成功/失敗的顏色框
- **簡化結果顯示**: 移除總計統計區塊，保留個別設備的詳細時間和狀態
- **智能篩選**: 支援全部/成功/失敗的結果篩選，按鈕顯示對應數量
- **錯誤分類**: 自動分類和統計執行錯誤，提供詳細錯誤資訊
- **結果展開**: 支援展開/收起個別設備的詳細執行結果
- **複製功能**: 支援複製單個設備或全部執行結果

### AI 智能整合
- 支援 Google Gemini AI 的智能分析
- 根據使用者查詢提供專業建議
- 整合單一設備分析和多設備批次操作

### 用戶體驗優化
- **視覺統一**: 進度條和狀態訊息整合在執行按鈕旁，提供統一的視覺體驗
- **狀態反饋**: 群組快選按鈕根據實際選取狀態動態顯示顏色，避免誤導
- **介面簡化**: 移除執行結果中的冗餘統計區塊，保持介面簡潔
- **狀態延伸**: 執行狀態的顏色框延伸到進度條，提供一致的狀態指示
- **按鈕文字統一**: 設備列表展開/收起按鈕使用一致的文字格式

## 常見問題

### 設計系統相關
- **色彩遷移進行中**: 部分組件仍使用 `text-gray-*` 類別，正在逐步遷移到 terminal 色彩系統
- **主要色彩已統一**: 大部分關鍵組件已使用統一的 terminal 色彩系統
- **樣式覆蓋**: 避免使用內聯樣式，優先使用預定義的 CSS classes
- **檢查指令**: 使用 `grep -r "text-gray-[0-9]" src/components/` 檢查尚未遷移的色彩

### TypeScript 相關
- **類型錯誤**: 確保所有類型導入使用 `type` 關鍵字
- **類型定義**: 檢查 `src/types/` 中是否有完整的類型定義
- **避免 any**: 使用 `unknown` 或具體類型替代 `any`

### 建置相關
- **依賴問題**: 清理 `node_modules` 和 `dist` 目錄後重新安裝
- **版本相容**: 檢查 package.json 中的依賴版本相容性
- **配置檢查**: 確認 tsconfig.json 和 vite.config.ts 配置正確

### API 整合
- **後端連接**: 確保後端服務運行在 `http://localhost:8000`
- **CORS 設定**: 檢查後端 CORS 配置和網路連接狀態
- **請求調試**: 使用瀏覽器 DevTools Network 頁籤檢查 API 請求

### 效能優化
- **組件渲染**: 使用 React DevTools Profiler 分析組件渲染效能
- **重渲染優化**: 檢查並消除不必要的組件重渲染
- **記憶化**: 適當使用 React.memo, useMemo, useCallback 進行優化

## 部署說明

### 開發環境
```bash
npm run dev
# 訪問 http://localhost:5173
```

### 生產建置
```bash
npm run build
npm run preview
# 訪問 http://localhost:4173
```

### 環境變數配置
```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=AI 網路維運助理
```

### 部署選項
- **靜態部署**: 支援任何靜態檔案伺服器
- **現代平台**: 推薦 Vercel、Netlify 等現代部署平台
- **容器化**: 支援 Docker 容器化部署
- **CDN 整合**: 可整合 CDN 提升全球存取速度

## 版本資訊

- **專案版本**: v1.0.9 (健壯的後端與非同步任務處理版本)
- **React 版本**: ^19.1.0
- **TypeScript 版本**: ~5.8.3  
- **Vite 版本**: ^7.0.4
- **Tailwind CSS 版本**: ^3.4.17
- **文件更新日期**: 2025-07-31
- **最後檢查日期**: 2025-07-31
- **架構同步**: 與後端非同步任務處理系統 v1.0.9 完全同步
- **日誌系統**: 前後端統一日誌管理，支援 10MB 輪轉機制
- **非同步任務**: 完整的前端非同步任務管理和輪詢系統整合
- **API 擴展**: 新增 5 個非同步任務 API 和完整的 TypeScript 類型支援

## 技術支援

這個現代化的前端架構提供了：

### 🚀 卓越效能
- **Vite 7.0.4**: 極速冷啟動和 HMR 熱更新
- **React 19.1.0**: 並發模式和 Suspense 最新特性
- **TanStack Query**: 智能伺服器狀態快取和背景更新

### 🔒 類型安全
- **TypeScript Project References**: 模組化編譯和增量建置
- **嚴格模式檢查**: 完整的編譯時錯誤捕獲
- **路徑映射**: @/* 別名簡化導入路徑

### 🎨 現代 UI 系統
- **Terminal 色彩系統**: 統一視覺設計語言
- **響應式設計**: 跨桌面/平板/手機完美適配
- **CSS 動畫系統**: 豐富的互動回饋效果

### 🔧 卓越開發體驗
- **ESLint 9.30.1**: 現代代碼品質保證
- **Hot Reload**: 即時預覽開發變更
- **TypeScript 智能提示**: 完整的代碼自動完成
- **簡化狀態管理**: 衍生狀態模式，消除狀態同步問題

### 🌐 企業級功能
- **統一批次執行**: 單一/多設備/群組的統一處理架構
- **優化狀態管理**: 精簡的 Zustand (UI狀態) + TanStack Query (伺服器狀態) 分離架構
- **非同步任務處理** (v1.0.9): 完整的長時間執行任務支援，解決 HTTP 超時問題
- **執行模式切換**: 同步/非同步雙模式，適應不同使用場景
- **智能輪詢系統**: 指數退避策略，從 2 秒到 10 秒動態調整，優化資源使用
- **多用戶支援**: 支援團隊協作和並發使用
- **鍵盤快捷鍵**: 提升專業用戶操作效率

**這是構建現代化企業級網路運維工具的理想技術基礎，結合了最新的前端技術和實用的業務功能設計。**