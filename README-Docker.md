# AI 網路運維助理 - Docker 部署指南

> 🚀 **企業級 All-in-One Docker 部署方案**  
> 📅 最後更新：2025-08-06  
> 🎯 支援生產環境和開發環境的完整 Docker 化部署  

## 🏗️ 架構概覽

本專案採用 All-in-One VM 部署架構，所有服務運行在單一 Docker Compose 環境中：

```
Internet → VM:443 → Nginx Proxy Manager → Frontend (Nginx) + Backend (FastAPI)
```

**核心服務**：
- **Nginx Proxy Manager**：反向代理和 SSL 終端
- **Frontend**：React + TypeScript + Vite (生產) / 開發伺服器 (開發)
- **Backend**：FastAPI + Python 3.11

## 🚀 快速開始

### 1️⃣ 環境要求

- **作業系統**：Ubuntu Server 24.04 LTS
- **硬體建議**：4 vCPU, 8GB RAM, 100GB 儲存空間
- **軟體需求**：Docker 24.0+, Docker Compose v2

### 2️⃣ 一鍵部署

```bash
# 1. 複製專案
git clone <your-repo-url> ai-ops-assistant
cd ai-ops-assistant

# 2. 配置環境變數
cp .env.docker .env
nano .env  # 填入您的 API 金鑰

# 3. 建立必要目錄
mkdir -p logs config proxy-data letsencrypt

# 4. 啟動服務
docker compose up --build -d

# 5. 檢查狀態
docker compose ps
```

### 3️⃣ 服務端點

- **生產環境**：https://your-domain.com (透過 Nginx Proxy Manager)
- **Proxy 管理**：http://your-server-ip:81
- **開發環境**：
  - 前端：http://localhost:5173
  - 後端：http://localhost:8000

## ⚙️ 環境配置

### 生產環境部署

```bash
# 使用默認配置 (包含 override 檔案)
docker compose up --build -d
```

### 開發環境部署

```bash
# 開發模式 (自動熱重載)
docker compose up --build

# 或明確指定配置檔案
docker compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

### 環境變數配置

**必須設定的環境變數**：

```bash
# AI 服務配置
AI_PROVIDER=gemini                    # 或 claude
GOOGLE_API_KEY=your_api_key_here     # Gemini API 金鑰
ANTHROPIC_API_KEY=your_api_key_here  # Claude API 金鑰

# 管理配置
ADMIN_API_KEY=your_admin_key         # 管理 API 金鑰
```

完整的環境變數範例請參考 `.env.docker` 檔案。

## 📁 專案結構

```
ai-ops-assistant/
├── .env.docker                      # 環境變數配置模板
├── docker-compose.yml               # 生產環境配置
├── docker-compose.override.yml      # 開發環境覆蓋配置
├── WEB_APP/
│   ├── backend/
│   │   ├── Dockerfile               # 後端多階段構建
│   │   └── ...
│   └── frontend/
│       ├── Dockerfile               # 前端生產環境
│       ├── Dockerfile.dev           # 前端開發環境
│       ├── nginx.conf               # Nginx 自定義配置
│       └── ...
├── logs/                            # 日誌掛載點
├── config/                          # 配置掛載點
├── proxy-data/                      # Nginx Proxy Manager 資料
└── letsencrypt/                     # SSL 憑證
```

## 🔧 常用指令

### 服務管理
```bash
# 查看服務狀態
docker compose ps

# 查看服務日誌
docker compose logs -f [service_name]

# 重啟服務
docker compose restart [service_name]

# 停止所有服務
docker compose down

# 完全清理 (包含 volumes)
docker compose down -v
```

### 除錯指令
```bash
# 進入容器 shell
docker compose exec backend /bin/bash
docker compose exec frontend /bin/sh

# 查看資源使用
docker stats

# 檢查網路連線
docker compose exec backend curl -I http://frontend/
```

### 更新部署
```bash
# 拉取最新程式碼
git pull

# 重新建構並重啟
docker compose up --build -d

# 查看更新狀態
docker compose logs -f
```

## 🛡️ 安全性配置

### SSL/TLS 設定

1. 訪問 Nginx Proxy Manager：http://your-server-ip:81
2. 預設登入：`admin@example.com` / `changeme`
3. 設定 Proxy Host 指向 `frontend:80`
4. 啟用 SSL 憑證 (Let's Encrypt)

### 防火牆配置

```bash
# Ubuntu UFW 設定
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 81/tcp    # Proxy 管理 (限內網)
sudo ufw enable
```

## 📊 監控與維護

### 健康檢查

所有服務都配置了自動健康檢查：

```bash
# 檢查健康狀態
docker compose ps

# 手動健康檢查
curl -f http://localhost:8000/health  # 後端
curl -f http://localhost:80/          # 前端
```

### 日誌管理

```bash
# 查看特定服務日誌
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f proxy

# 查看所有服務日誌
docker compose logs -f

# 限制日誌輸出行數
docker compose logs --tail 100 backend
```

### 備份與還原

```bash
# 備份重要資料
tar -czf backup-$(date +%Y%m%d).tar.gz \
  logs config proxy-data letsencrypt .env

# 還原資料
tar -xzf backup-YYYYMMDD.tar.gz
```

## 🚨 故障排除

### 常見問題

**1. 服務無法啟動**
```bash
# 檢查日誌
docker compose logs [service_name]

# 檢查磁碟空間
df -h

# 檢查記憶體使用
free -m
```

**2. 網路連線問題**
```bash
# 檢查容器網路
docker network ls
docker network inspect ai_ops_network

# 檢查端口占用
netstat -tulpn | grep :443
```

**3. API 金鑰問題**
```bash
# 檢查環境變數
docker compose exec backend env | grep API_KEY

# 重新載入環境變數
docker compose up --force-recreate -d
```

**4. SSL 憑證問題**
```bash
# 檢查憑證目錄權限
ls -la letsencrypt/
sudo chown -R 1001:1001 letsencrypt/
```

### 效能優化

**調整資源限制**：
```yaml
# 在 docker-compose.yml 中調整
deploy:
  resources:
    limits:
      memory: 2G      # 增加記憶體限制
      cpus: '2.0'     # 增加 CPU 限制
```

**啟用日誌滾動**：
```bash
# 設定 Docker 日誌滾動
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
```

## 📞 支援與協助

- **專案文件**：參考 `CLAUDE.md` 了解詳細架構
- **Docker 配置**：參考 `Docker 化部署方案技術規格.markdown`
- **問題回報**：請提供完整的 `docker compose logs` 輸出

---

> 🎉 **恭喜！** 您已成功部署 AI 網路運維助理  
> 💡 **提示**：建議先在開發環境測試，確認無誤後再部署到生產環境