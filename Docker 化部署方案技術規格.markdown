# AI 網路運維助理專案 Docker 化部署方案技術規格

本專案將開始進行上線部署，預計將有一個標準化、可重複且易於管理的部署環境，我計畫採用基於 Docker 的「All-in-One VM」一體化部署方案。  
這份文件將詳細說明整個部署架構、所需設定檔以及執行步驟的範本。

1.請你協助評估內容是否符合專案的規格? 如有必要可以修改細節
2."二、必要設定檔與專案結構" >由你完成以完善專案資料夾內容
3."三、部署工作流程" > 這部分由使用者來執行

## 一、核心部署架構：All-in-One VM (HTTPS-First)

我們將在單一的 Ubuntu 24.04 VM 中，使用 Docker 和 Docker Compose 來統一運行所有服務。Nginx Proxy Manager 將作為唯一的對外入口 (Port 443)，負責 SSL 卸載 (SSL Offloading) 和流量路由。

架構圖如下：

```
          Internet
             │
             │ (防火牆規則: Port Forward 443 -> VM 的 IP)
             │
┌────────────▼────────────┐
│      單一 VM (All-in-One)     │
│  (Ubuntu Server 24.04 LTS)  │
│                           │
│ ┌───────────────────────┐ │
│ │   Docker & Compose    │ │
│ │ ┌───────────────────┐ │ │
│ │ │ Docker 內部網路   │ │ │
│ │ └─┬──────────┬───┬───┘ │ │
│ ├────┼──────────┼───┼─────┤ │
│ │  ┌─▼─┐      ┌─▼─┐┌─▼─┐   │ │
│ │  │ P │      │ F ││ B │   │ │ P: Proxy (Nginx Proxy Manager)
│ │  └─▲─┘      └─┬─┘└─┬─┘   │ │ F: Frontend (Nginx + React)
│ └────┼──────────┼───┼───────┘ │ B: Backend (Python/FastAPI)
│      │          │   │         │
└──────┼──────────┼───┼─────────┘
       │          │   └────────────> /api/* (via HTTPS)
       │          └────────────────> /* (via HTTPS)
       └──────────────────────────> HTTPS 流量入口 (Port 443)
```

## 二、必要設定檔與專案結構

經過完善後，專案的目錄結構如下：

```
[專案根目錄]/
├── .git/
├── .env.docker                    # ✅ Docker 環境變數配置模板
├── docker-compose.yml             # ✅ 主要部署配置檔案
├── docker-compose.override.yml    # ✅ 開發環境覆蓋配置
├── WEB_APP/
│   ├── frontend/
│   │   ├── src/
│   │   ├── package.json
│   │   ├── Dockerfile              # ✅ 前端生產環境映像檔
│   │   ├── Dockerfile.dev          # ✅ 前端開發環境映像檔
│   │   └── nginx.conf              # ✅ Nginx 自定義配置
│   └── backend/
│       ├── main.py
│       ├── requirements.txt
│       ├── Dockerfile              # ✅ 後端映像檔 (多階段構建)
│       ├── config/                 # 配置檔案目錄
│       └── logs/                   # 日誌檔案目錄
├── logs/                           # 容器日誌掛載點
├── config/                         # 配置檔案掛載點
├── proxy-data/                     # Nginx Proxy Manager 資料
└── letsencrypt/                    # SSL 憑證存放目錄
```

### 1. 後端 Dockerfile (`WEB_APP/backend/Dockerfile`)

✅ **已完善 - 企業級多階段構建版本**

主要特色：
- **多階段構建**：優化映像檔大小和安全性
- **非 root 用戶**：提升容器安全性
- **健康檢查**：自動監控服務狀態
- **環境變數支援**：完整的配置管理
- **日誌目錄掛載**：持久化日誌資料

關鍵優化：
```dockerfile
# 多階段構建減少最終映像檔大小
FROM python:3.11-slim AS dependencies
FROM python:3.11-slim AS production

# 建立非 root 用戶提升安全性
RUN groupadd -r appuser && useradd -r -g appuser appuser

# 內建健康檢查腳本
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/app/health-check.sh"]
```

### 2. 前端 Dockerfile (`WEB_APP/frontend/Dockerfile`)

✅ **已完善 - 生產環境 + 開發環境雙版本**

**生產環境特色** (`Dockerfile`)：
- **Node.js 20**：使用最新穩定版本
- **多階段構建**：Builder + Production 階段優化
- **自定義 Nginx 配置**：支援 React Router 和 API 代理
- **環境變數注入**：建置時注入 VITE 環境變數
- **健康檢查**：自動監控前端服務狀態
- **安全強化**：安全標頭和 gzip 壓縮

**開發環境特色** (`Dockerfile.dev`)：
- **熱重載支援**：Hot Module Replacement
- **即時原始碼掛載**：即時反映程式碼變更
- **開發工具整合**：完整的開發依賴和工具

**自定義 Nginx 配置** (`nginx.conf`)：
```nginx
# API 請求代理到後端
location /api/ {
    proxy_pass http://backend:8000;
    proxy_read_timeout 60s;  # 支援 AI 查詢的長時間請求
}

# React Router 支援
location / {
    try_files $uri $uri/ /index.html;
}

# 靜態資源快取優化
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Docker Compose 配置檔案

✅ **已完善 - 企業級配置管理系統**

**主要配置檔案**：

#### A. `docker-compose.yml` - 生產環境主配置

**企業級強化功能**：
- **環境變數管理**：完整的 `.env.docker` 模板支援
- **健康檢查**：所有服務自動健康監控
- **資源限制**：CPU 和記憶體限制配置
- **資料持久化**：Volume 掛載和資料備份
- **服務相依性**：智能啟動順序管理
- **網路隔離**：自定義橋接網路配置

關鍵配置亮點：
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
    
    environment:
      - AI_PROVIDER=${AI_PROVIDER:-gemini}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
```

#### B. `docker-compose.override.yml` - 開發環境配置

**開發環境特色**：
- **原始碼掛載**：即時程式碼更新
- **開發端口暴露**：直接訪問各服務
- **詳細日誌**：DEBUG 級別日誌輸出
- **自動重載**：後端 uvicorn --reload 模式
- **前端熱重載**：Vite HMR 支援

#### C. `.env.docker` - 環境變數配置模板

**配置類別**：
- AI 服務配置 (API 金鑰、模型選擇)
- 功能開關配置 (文檔搜尋、AI 查詢等)
- 網路設備配置 (連線超時、並發數)
- 日誌系統配置 (級別、詳細程度)
- 資料持久化配置 (掛載路徑)

## 三、部署工作流程

### 🚀 生產環境部署步驟

#### 步驟一：準備 VM 環境

1. **建立 VM**：在 ESXi 上建立 Ubuntu Server 24.04 LTS VM
   - 建議配置：4 vCPU, 8GB RAM, 100GB 儲存空間
   - 網路配置：靜態 IP，開放必要端口 (443, 22)

2. **安裝系統依賴**：
```bash
# 更新系統
sudo apt update && sudo apt upgrade -y

# 安裝 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安裝 Docker Compose
sudo apt install docker-compose-plugin -y

# 建立 Docker 用戶群組
sudo usermod -aG docker $USER
newgrp docker

# 驗證安裝
docker --version
docker compose version
```

#### 步驟二：部署專案

1. **拉取專案程式碼**：
```bash
git clone [您的 Git 倉庫地址] ai-ops-assistant
cd ai-ops-assistant
```

2. **配置環境變數**：
```bash
# 複製環境變數模板
cp .env.docker .env

# 編輯環境變數 (填入實際的 API 金鑰)
nano .env
```

3. **建立必要目錄**：
```bash
mkdir -p logs config proxy-data letsencrypt
chmod 755 logs config proxy-data letsencrypt
```

4. **啟動服務**：
```bash
# 生產環境部署
docker compose up --build -d

# 檢查服務狀態
docker compose ps
docker compose logs -f
```

### 🛠️ 開發環境部署步驟

```bash
# 開發環境會自動載入 docker-compose.override.yml
docker compose -f docker-compose.yml -f docker-compose.override.yml up --build

# 或者直接使用 (會自動載入 override 檔案)
docker compose up --build
```

**開發環境服務端口**：
- 前端：http://localhost:5173 (Vite 開發伺服器)
- 後端：http://localhost:8000 (FastAPI with --reload)
- Proxy 管理：http://localhost:81

## 四、企業級方案優勢

### 🎯 **部署管理優勢**
- **一鍵部署**：`docker compose up` 即可完成整套系統部署
- **環境一致**：開發、測試、生產環境完全一致，消除環境差異問題
- **配置外部化**：`.env` 檔案管理所有環境變數，易於維護和版本控制
- **熱重載支援**：開發環境支援前後端程式碼即時更新

### 🛡️ **安全性強化**
- **HTTPS-First 架構**：強制 HTTPS 流量，提升資料傳輸安全性
- **容器隔離**：各服務運行在獨立容器中，提升系統安全性
- **非 root 用戶**：容器內使用非特權用戶運行，降低安全風險
- **網路隔離**：自定義 Docker 網路，限制服務間通訊

### ⚡ **效能與監控優勢**
- **健康檢查**：所有服務自動健康監控，異常時自動重啟
- **資源限制**：CPU 和記憶體限制，防止資源濫用
- **多階段構建**：優化映像檔大小，提升部署速度
- **快取優化**：前端靜態資源快取，提升用戶體驗

### 🔧 **維運管理優勢**
- **日誌集中化**：所有服務日誌統一管理，便於問題診斷
- **資料持久化**：重要資料外部掛載，容器重啟不丟失資料
- **服務編排**：智能啟動順序，確保服務相依性正確
- **擴展彈性**：未來可輕易遷移至 Kubernetes 或雲端環境

### 📊 **成本效益優勢**
- **資源共享**：All-in-One 架構節省硬體成本
- **管理簡化**：單一 VM 管理，降低維運複雜度
- **快速部署**：自動化部署流程，節省人力成本
- **災難恢復**：備份和恢復流程簡單，降低風險成本

## 五、監控與維護

### 📈 **服務監控指令**
```bash
# 查看所有服務狀態
docker compose ps

# 查看服務日誌
docker compose logs -f [service_name]

# 查看資源使用情況
docker stats

# 重啟特定服務
docker compose restart [service_name]
```

### 🔄 **備份與還原**
```bash
# 備份重要資料
tar -czf backup-$(date +%Y%m%d).tar.gz logs config proxy-data letsencrypt

# 還原資料
tar -xzf backup-YYYYMMDD.tar.gz
```

### 🚨 **故障排除**
- **服務異常**：檢查 `docker compose logs` 輸出
- **網路問題**：檢查防火牆和端口配置
- **憑證問題**：檢查 `letsencrypt` 目錄權限
- **資源不足**：監控 `docker stats` 輸出