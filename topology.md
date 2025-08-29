# 🌐 外部-宿主機-Docker網路拓撲架構

## 📊 網路層級架構

```
Internet (外網)
      ↓ 
202.3.184.82 (外部IP)
      ↓	NAT
10.60.21.11/24 (宿主機內網IP, ens160)
      ↓
┌─────────────────────────────────────────────────────────┐
│                    宿主機 (Ubuntu)                        │
├─────────────────────────────────────────────────────────┤
│  Bridge Networks: (四個網路統一管理模式)                   │
│  • docker0: 172.17.0.1/16 (預設)                       │
│  • br-4dd659933249: 172.21.0.1/16 (ai-ops-network)    │
│  • br-903859ba5897: 172.22.0.1/16 (akvorado-network)  │
│  • br-2ea55f987da5: 172.23.0.1/16 (grafana-network)   │
│  • br-8dc43b2bf838: 172.99.0.1/16 (postgres-network)  │
└─────────────────────────────────────────────────────────┘
      ↓
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ ai-ops-network  │ │grafana-network  │ │akvorado-network │ │postgres-network │
│ 172.21.0.0/16   │ │ 172.23.0.0/16   │ │ 172.22.0.0/16   │ │ 172.99.0.0/16   │
│ 🏷️ AI運維系統   │ │ 🏷️ 監控系統     │ │ 🏷️ 網路分析     │ │ 🏷️ 資料庫系統   │
│ 🔒 標籤保護     │ │ 🔒 標籤保護     │ │ 🔒 標籤保護     │ │ 🔒 標籤保護     │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 🏗️ 網路管理架構說明

五個專案採用兩種不同的網路管理模式：

| 專案         | 網路配置模式 | 標籤保護狀態   | 設計邏輯               |
|------------|--------|----------|--------------------|
| AI Ops     | 內建定義網路 | ✅ 自動標籤保護 | 主專案，完整定義           |
| Grafana    | 內建定義網路 | ✅ 自動標籤保護 | 獨立系統，完整定義          |
| Akvorado   | 內建定義網路 | ✅ 自動標籤保護 | 獨立系統，完整定義          |
| PostgreSQL | 內建定義網路 | ✅ 自動標籤保護 | 獨立系統，完整定義          |
| N8N        | 外部網路引用 | ❌ 無標籤保護  | 依附於 ai-ops-network |

#### 網路管理模式詳細對比

| 網路名稱 | 管理模式 | 標籤保護 | 創建方式 | 抗清理能力 |
|---------|---------|---------|---------|----------|
| **ai-ops-network** | 🏗️ 內建自動管理 | ✅ Compose 完整標籤 | docker-compose.yml 定義 | 🔒 防止 `docker system prune -a` |
| **grafana-network** | 🏗️ 內建自動管理 | ✅ Compose 完整標籤 | docker-compose.yml 定義 | 🔒 防止 `docker system prune -a` |
| **akvorado-network** | 🏗️ 內建自動管理 | ✅ Compose 完整標籤 | docker-compose.yml 定義 | 🔒 防止 `docker system prune -a` |
| **postgres-network** | 🏗️ 內建自動管理 | ✅ Compose 完整標籤 | docker-compose.yml 定義 | 🔒 防止 `docker system prune -a` |

**內建自動管理模式優勢**：
- 🚀 **統一管理**: 四個核心系統採用一致的網路管理方式
- 🔒 **自動保護**: Docker Compose 標籤防止意外網路刪除
- ⚡ **自動重建**: 服務重啟時網路自動重建，無需手動干預
- 🛡️ **清理安全**: `docker system prune -a` 不再影響系統網路
- 📊 **配置透明**: 網路配置完全在 docker-compose.yml 中定義
- 🌐 **跨網路整合**: ai_ops_traefik 統一代理四個系統的服務

**外部網路引用模式特性**：
- ⚠️ **依附模式**: N8N 依附於 ai-ops-network，簡化部署
- 🔗 **直接連接**: 與主系統共享網路空間，降低複雜度
- 📋 **標籤缺失**: 缺少 Docker Compose 保護標籤，需要額外注意
- 🔄 **依賴關係**: 依賴主系統網路的生命週期

## 🚪 對外端口映射

| 外部端口 | 內部目標 | 服務 | 網路 |
|---------|----------|------|------|
| **80** → | ai_ops_traefik:80 | AI Ops Web界面 | ai-ops-network |
| **81** → | ai_ops_traefik:8080 | AI Ops管理界面 | ai-ops-network |
| **8001** → | n8n_main:5678 | N8N工作流 | ai-ops-network |
| **8002** → | ai_ops_traefik:8002 | Akvorado Web界面 | akvorado-network |
| **8003** → | ai_ops_traefik:8003 | Grafana 監控界面 | grafana-network |
| **8004** → | ai_ops_traefik:8004 | PostgreSQL TCP代理 | postgres-network |
| **2055** → | akvorado-akvorado-inlet-1:2055/udp | NetFlow接收器 | akvorado-network |
| **6343** → | akvorado-akvorado-inlet-1:6343/udp | sFlow接收器 | akvorado-network |
| **10179** → | akvorado-akvorado-outlet-1:10179 | BMP服務 | akvorado-network |

## 🏠 AI Ops Network (172.21.0.0/16)

| 容器名稱 | 內部IP | 內部端口 | 服務描述 | 狀態 |
|----------|--------|----------|----------|------|
| **ai_ops_traefik** | 172.21.0.x (動態分配) | 80, 8080 | 反向代理入口點 | Healthy |
| **n8n_main** | 172.21.0.x (動態分配) | 5678 | 工作流自動化 | Healthy |
| **ai_ops_backend** | 172.21.0.x (動態分配) | 8000 | 後端API | Healthy |
| **ai_ops_frontend** | 172.21.0.x (動態分配) | 80 | React前端 (Nginx靜態服務) | Healthy |

### AI Ops網路特性
- **子網段**: 172.21.0.0/16
- **網關**: 172.21.0.1 (宿主機)
- **用途**: AI運維系統、工作流自動化
- **主要服務**: Web界面、API後端、N8N工作流、MCP服務

### AI Ops流量路由機制
```
外部請求 → ai_ops_traefik:80 ← 反向代理入口點
    ↓ 根據路由規則分發流量
    ├─ PathPrefix(`/api/`) → ai_ops_backend:8000
    └─ 根路徑 (`/`) → ai_ops_frontend:80

路由規則詳解：
• 外部訪問 202.3.184.82/ → Traefik → Frontend (Nginx靜態檔案)
• 外部訪問 202.3.184.82/api/ → Traefik → Backend (FastAPI)
• 容器80端口不衝突：Traefik暴露到宿主機，Frontend僅內網可見
```

## 📊 Akvorado Network (172.22.0.0/16)

| 容器名稱 | 內部IP | 內部端口 | 服務描述 | 狀態 |
|----------|--------|----------|----------|------|
| **akvorado-traefik-1** | 172.22.0.x (動態分配) | 8002, 8080 | 反向代理 | Running |
| **akvorado-redis-1** | 172.22.0.x (動態分配) | 6379 | 快取數據庫 | Healthy |
| **akvorado-kafka-1** | 172.22.0.x (動態分配) | 9092 | 訊息佇列 | Healthy |
| **akvorado-clickhouse-1** | 172.22.0.x (動態分配) | 8123, 9000, 9009 | 分析數據庫 | Healthy |
| **akvorado-kafka-ui-1** | 172.22.0.x (動態分配) | 8080 | Kafka管理界面 | Running |
| **akvorado-akvorado-orchestrator-1** | 172.22.0.x (動態分配) | 8080 | 協調器 | Healthy |
| **akvorado-akvorado-inlet-1** | 172.22.0.x (動態分配) | 8080 | 數據接收器 | Healthy |
| **akvorado-akvorado-outlet-1** | 172.22.0.x (動態分配) | 8080 | 數據輸出器 | Healthy |
| **akvorado-akvorado-console-1** | 172.22.0.x (動態分配) | 8080 | Web控制台 | Healthy |
| **akvorado-geoip-1** | 172.22.0.x (動態分配) | N/A | GeoIP 數據更新 | Running |

### Akvorado網路特性
- **子網段**: 172.22.0.0/16
- **網關**: 172.22.0.1 (宿主機)
- **用途**: 網路流量分析和監控
- **主要服務**: 流量收集、數據分析、Web儀表板

## 📊 Grafana Network (172.23.0.0/16)

| 容器名稱 | 內部IP | 內部端口 | 服務描述 | 狀態 |
|----------|--------|----------|----------|------|
| **grafana_dashboard** | 172.23.0.x (動態分配) | 3000 | Grafana 儀表板 | Running |
| **grafana_prometheus** | 172.23.0.x (動態分配) | 9090 | Prometheus 監控 | Running |
| **grafana_loki** | 172.23.0.x (動態分配) | 3100 | Loki 日誌聚合 | Running |
| **grafana_node_exporter** | 172.23.0.x (動態分配) | 9100 | 節點監控 | Running |
| **grafana_cadvisor** | 172.23.0.x (動態分配) | 8080 | 容器監控 | Running |
| **grafana_snmp_exporter** | 172.23.0.x (動態分配) | 9116 | SNMP 監控 | Running |

### Grafana網路特性
- **子網段**: 172.23.0.0/16
- **網關**: 172.23.0.1 (宿主機)
- **用途**: 系統監控和可視化
- **主要服務**: 指標收集、日誌聚合、監控儀表板

## 🗃️ PostgreSQL Network (172.99.0.0/16)

| 容器名稱 | 內部IP | 內部端口 | 服務描述 | 狀態 |
|----------|--------|----------|----------|------|
| **postgres_main** | 172.99.0.x (動態分配) | 5432 | PostgreSQL 主資料庫 | Running |
| **postgres_pgadmin** | 172.99.0.x (動態分配) | 80 | pgAdmin 管理界面 | Running |

### PostgreSQL網路特性
- **子網段**: 172.99.0.0/16
- **網關**: 172.99.0.1 (宿主機)
- **用途**: 關聯式資料庫服務
- **主要服務**: 資料存儲、備份、資料庫管理

## 🔧 特殊網路配置

| 容器名稱 | 網路模式 | 描述 | 用途 |
|----------|----------|------|------|
| **akvorado-akvorado-conntrack-fixer-1** | host | 直接使用宿主機網路 | 修復conntrack問題 |

## 🌍 外部訪問方式

### 外部用戶訪問 (202.3.184.82)
```
202.3.184.82:80    → AI Ops系統主界面
202.3.184.82:81    → AI Ops管理界面  
202.3.184.82:8001  → N8N工作流管理
202.3.184.82:8002  → Akvorado網路監控儀表板
202.3.184.82:8003  → Grafana監控儀表板
202.3.184.82:8004  → PostgreSQL TCP代理
202.3.184.82:2055  → NetFlow數據接收 (UDP)
202.3.184.82:6343  → sFlow數據接收 (UDP)  
202.3.184.82:10179 → BMP協議服務
```

### 內部訪問 (10.60.21.11)
```
10.60.21.11:80     → AI Ops系統主界面
10.60.21.11:81     → AI Ops管理界面
10.60.21.11:8001   → N8N工作流管理  
10.60.21.11:8002   → Akvorado網路監控儀表板
10.60.21.11:8003   → Grafana監控儀表板
10.60.21.11:8004   → PostgreSQL TCP代理
10.60.21.11:2055   → NetFlow數據接收 (UDP)
10.60.21.11:6343   → sFlow數據接收 (UDP)
10.60.21.11:10179  → BMP協議服務
```

## 🏷️ Docker Compose 標籤保護機制

### 網路標籤保護詳情

四個系統網路現在都具有完整的 Docker Compose 保護標籤：

#### AI Ops Network 標籤
```json
{
  "com.docker.compose.config-hash": "c6749a2abdcb04b753fd9eb5b52aed39e572d929acb48a4581855a96f0967609",
  "com.docker.compose.network": "ai-ops-network", 
  "com.docker.compose.project": "ai_ops_assistant_gemini",
  "com.docker.compose.version": "2.39.1"
}
```

#### Akvorado Network 標籤
```json
{
  "com.docker.compose.config-hash": "e970f81dd7d90997246c6d96aa437686cfa5aec0f2da660fea934c7dbe0fb196",
  "com.docker.compose.network": "default",
  "com.docker.compose.project": "akvorado", 
  "com.docker.compose.version": "2.39.1"
}
```

#### PostgreSQL Network 標籤
```json
{
  "com.docker.compose.config-hash": "9bf679040a1eeb1f858e115e22518840ff013e3be24a696713cb9c9a177c20b8",
  "com.docker.compose.network": "postgres-network",
  "com.docker.compose.project": "postgresql", 
  "com.docker.compose.version": "2.39.1"
}
```

### 標籤保護效果驗證

```bash
# 檢查網路標籤
docker network inspect ai-ops-network --format='{{json .Labels}}' | jq -r .
docker network inspect grafana-network --format='{{json .Labels}}' | jq -r .
docker network inspect akvorado-network --format='{{json .Labels}}' | jq -r .
docker network inspect postgres-network --format='{{json .Labels}}' | jq -r .

# 測試清理命令安全性
docker system prune -a -f  # 現在可以安全使用，不會刪除系統網路

# 確認網路仍存在
docker network ls | grep -E "(ai-ops-network|grafana-network|akvorado-network|postgres-network)"
```

**重要改進**：
- ✅ **四重保護**：四個系統都具備 Compose 標籤保護
- ✅ **統一管理**：消除管理方式差異，降低運維複雜度  
- ✅ **自動恢復**：服務重啟時網路自動重建
- ✅ **清理安全**：系統清理命令不再影響核心網路架構

## 🔒 網路隔離策略與容器間通信

### 統一管理的多系統架構 - 跨網路 + 標籤路由機制
```
┌─────────────────────┐    ┌─────────────────────────┐
│   AI Ops System     │    │   Akvorado System       │
│   172.21.0.0/16     │    │   172.22.0.0/16         │
│                     │    │                         │
│   ┌─────────────┐   │    │   ┌─────────────────┐   │
│   │ Traefik     │   │    │   │ Traefik         │   │
│   │ (Proxy)     │   │    │   │ (Proxy)         │   │
│   └─────────────┘   │    │   └─────────────────┘   │
│   ┌─────────────┐   │    │   ┌─────────────────┐   │
│   │ Frontend    │   │    │   │ Console         │   │
│   └─────────────┘   │    │   └─────────────────┘   │
│   ┌─────────────┐   │    │   ┌─────────────────┐   │
│   │ Backend     │   │    │   │ Orchestrator    │   │
│   └─────────────┘   │    │   └─────────────────┘   │
│   ┌─────────────┐   │    │   ┌─────────────────┐   │
│   │ N8N         │   │    │   │ Inlet/Outlet    │   │
│   └─────────────┘   │    │   └─────────────────┘   │
│   ┌─────────────┐   │    │   ┌─────────────────┐   │
│   │ MCP Services│   │    │   │ ClickHouse      │   │
│   └─────────────┘   │    │   └─────────────────┘   │
└─────────────────────┘    └─────────────────────────┘
        ↑                            ↑
        │                            │
    Port 80,81,8001              Port 8002,2055,
                                 6343,10179
```

### 端口暴露與內部通信說明

#### 端口類型區別
- **暴露端口 (ports)**：映射到宿主機，外部可訪問
- **內部端口 (expose)**：僅在Docker網路內可見

```
AI Ops 端口配置：
• ai_ops_traefik: 80:80, 81:8080 (暴露) → 外部入口點
• ai_ops_frontend: 80 (僅內部) → 接收Traefik轉發
• ai_ops_backend: 8000 (僅內部) → 接收Traefik轉發
• n8n_main: 8001:5678 (暴露) → 直接外部訪問

容器間通信：
• 同網路內使用容器名稱：ai_ops_backend:8000
• 同網路內使用內部IP：172.21.0.x:8000 (動態分配)
• Traefik自動發現：通過Docker標籤配置路由
```

#### Traefik 路由隔離配置

**AI Ops Traefik 配置** (`/home/sysadmin/ai_ops_assistant_gemini/traefik/traefik.yml`):
```yaml
providers:
  docker:
    network: "ai-ops-network"
    constraints: "Label(`traefik.constraint-label`,`ai-ops`)"
```

**Akvorado Traefik 配置** (`/home/sysadmin/akvorado/docker-compose.yml`):
```yaml
environment:
  TRAEFIK_PROVIDERS_DOCKER_NETWORK: "akvorado-network"
  TRAEFIK_PROVIDERS_DOCKER_CONSTRAINTS: "Label(`traefik.constraint-label`,`akvorado`)"
```

**服務標籤範例**:
```yaml
# AI Ops 服務
labels:
  - traefik.enable=true
  - traefik.constraint-label=ai-ops

# Akvorado 服務  
labels:
  - traefik.enable=true
  - traefik.constraint-label=akvorado
```

#### 為什麼兩個容器都有80端口但不衝突？
1. **不同網路層級**：
   - Traefik的80端口暴露到宿主機 (0.0.0.0:80→容器:80)
   - Frontend的80端口僅在容器網路內 (172.21.0.x:80)

2. **流量流向**：
   ```
   外部 → 宿主機:80 → ai_ops_traefik:80 → 根據路由 → ai_ops_frontend:80
   ```

3. **Docker網路隔離**：每個容器在獨立的網路命名空間內運行

## 🛡️ Traefik 統一路由管理機制詳解

### 架構設計理念
AI Ops Traefik 採用統一管理模式，作為四個系統（ai-ops, grafana, akvorado, postgres）的中央路由器：
- 統一的反向代理入口點
- 跨網路服務發現和路由
- 基於標籤的精確路由控制

### 實施方案：統一標籤約束管理

#### 1. 統一標籤約束管理
Traefik 通過標籤約束實現精確的服務發現：
```yaml
# 統一 Traefik 支援四個系統的服務發現
constraints: "Label(`traefik.constraint-label`,`ai-ops`) || Label(`traefik.constraint-label`,`grafana`) || Label(`traefik.constraint-label`,`akvorado`) || Label(`traefik.constraint-label`,`postgres`)"

# 預設路由規則
defaultRule: "Host(`10.60.21.11`) || Host(`202.3.184.82`)"
```

#### 2. 跨網路連接配置
ai_ops_traefik 連接到多個網路以實現統一管理：
```yaml
networks:
  - ai-ops-network      # 主要管理網路
  - grafana-network     # Grafana 監控網路
  - akvorado-network    # Akvorado 網路監控網路
  - postgres-network    # PostgreSQL 資料庫網路
```

#### 3. 路由統一管理效果
```bash
# 統一 Traefik 管理所有系統路由：
# - api@internal, dashboard@internal, ping@internal (Traefik 內部管理)
# - backend@docker, backend-health@docker, frontend@docker (AI Ops 系統)
# - n8n@docker (N8N 工作流)
# - grafana@docker (Grafana 監控)
# - akvorado-*@docker (Akvorado 網路監控系統)
# - kafka-ui@docker, clickhouse@docker (Akvorado 相關服務)
# - postgres@docker, pgadmin@docker (PostgreSQL 資料庫系統)
```

## 📝 維護說明

### 網路管理命令
```bash
# 查看所有Docker網路
docker network ls

# 檢查特定網路配置
docker network inspect ai-ops-network
docker network inspect akvorado-network

# 查看容器網路配置
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Networks}}"

# 檢查端口使用情況
netstat -tlpn | grep -E ":(80|81|8001|8002|2055|6343|10179)\s"

# 檢查容器內部連接
docker exec ai_ops_traefik wget -qO- http://ai_ops_frontend:80
docker exec ai_ops_traefik wget -qO- http://ai_ops_backend:8000/health
```

### 網路診斷指令

⚠️ **重要**: 由於 NAT 環境限制，內部測試必須使用內網 IP `10.60.21.11`，不能使用外部 IP `202.3.184.82`

```bash
# 測試容器間連通性
docker exec ai_ops_traefik ping -c 3 ai_ops_frontend
docker exec ai_ops_traefik ping -c 3 ai_ops_frontend

# 檢查Traefik路由配置
docker exec ai_ops_traefik wget -qO- http://localhost:8080/api/http/routers

# 檢查服務發現
docker exec ai_ops_traefik wget -qO- http://localhost:8080/api/http/services

# 外部訪問測試 (使用內網 IP)
curl -s -o /dev/null -w "%{http_code}" http://10.60.21.11/health          # AI Ops 後端
curl -s -o /dev/null -w "%{http_code}" http://10.60.21.11/                # AI Ops 前端  
curl -s -o /dev/null -w "%{http_code}" http://10.60.21.11:8002/           # Akvorado Console
curl -s -o /dev/null -w "%{http_code}" http://10.60.21.11:8002/kafka-ui/  # Kafka UI

# 驗證路由隔離效果
docker exec ai_ops_traefik wget -qO- http://localhost:8080/api/http/routers | jq -r '.[].name' | sort
# 應該只看到：api@internal, backend@docker, backend-health@docker, dashboard@internal, frontend@docker, n8n@docker, ping@internal
```

### 🔄 網路管理模式說明

**v5.0 重大改進**: 五個專案採用兩種網路管理模式，四個核心系統統一管理：

| 系統 | 網路管理模式 | Docker Compose 標籤保護 | 抗清理能力 |
|------|------------|-------------------|----------|
| **AI Ops** | ✅ 內建自動管理 | ✅ 完整標籤 | 🔒 防止意外刪除 |
| **Grafana** | ✅ 內建自動管理 | ✅ 完整標籤 | 🔒 防止意外刪除 |
| **Akvorado** | ✅ 內建自動管理 | ✅ 完整標籤 | 🔒 防止意外刪除 |
| **PostgreSQL** | ✅ 內建自動管理 | ✅ 完整標籤 | 🔒 防止意外刪除 |
| **N8N** | ⚠️ 外部網路引用 | ❌ 缺少標籤 | ⚠️ 依賴主系統保護 |

**架構優勢**: 
- 四個核心系統：`docker system prune -a` 不再影響網路
- 統一管理方式，降低維護複雜度
- 網路配置由 Docker Compose 完全管理
- ai_ops_traefik 作為中央路由器統一代理四個系統
- N8N 採用依附模式，簡化部署並共享網路資源

### 網路重建指令 (如需要)

⚠️ **改進提醒**: 由於四個核心系統都使用內建網路管理，現在可以安全使用 `docker system prune -a`
⚠️ **注意事項**: N8N 使用外部網路引用，清理前請確認 ai-ops-network 的狀態

```bash
# 現在可以安全使用的清理命令
docker system prune -a -f

# 網路會自動重建 (如果容器重啟)
cd /home/sysadmin/ai_ops_assistant_gemini && docker compose up -d
cd /home/sysadmin/akvorado && docker compose up -d

# 重新啟動服務以應用網路隔離配置
cd /home/sysadmin/ai_ops_assistant_gemini && docker compose restart traefik
cd /home/sysadmin/akvorado && docker compose restart traefik
```

---

**最後更新**: 2025-08-29  
**文檔版本**: 5.1  
**系統狀態**: 運行正常，實施統一 Traefik 路由管理，**五個專案採用兩種網路管理模式**  
**更新內容**: 
- **v5.1**: **網路管理模式澄清** - 修正網路配置模式描述：
  - 📊 新增專案網路配置模式對比表格
  - 🔍 區分內建定義網路與外部網路引用兩種模式
  - 📋 明確四個核心系統（AI Ops, Grafana, Akvorado, PostgreSQL）採用內建管理
  - ⚠️ 標註 N8N 採用外部網路引用模式，依附於 ai-ops-network
  - 🛡️ 更新網路保護機制說明，反映實際配置差異
- **v5.0**: **重大架構升級** - 從雙系統擴展為四系統統一管理：
  - 🌐 新增 Grafana Network (172.23.0.0/16) 監控系統
  - 🗃️ 新增 PostgreSQL Network (172.99.0.0/16) 資料庫系統
  - 🚪 新增端口 8003 (Grafana) 和 8004 (PostgreSQL TCP代理)
  - 🔧 升級 ai_ops_traefik 為四系統中央路由器
  - 📊 更新網路架構圖和基礎設施描述
  - ⚙️ Traefik 約束條件升級支援四系統標籤
- 新增完整的 Grafana 和 PostgreSQL 網路配置說明
- 更新對外訪問端口映射表
- 修正網路管理模式說明
- **歷史版本**:
  - **v4.1**: 修正實際系統狀態差異，更新容器名稱和 IP 分配
  - **v4.0**: 雙系統網路管理模式統一升級
  - **v3.1**: 修正容器 IP 地址和診斷命令