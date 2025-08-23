# AI Ops Assistant Gemini - n8n API 調用指南

本指南專為 n8n 工作流自動化平台使用者設計，提供完整的 AI Ops Assistant Gemini 後端 API 調用說明和實際範例。

> **最新更新**: 2025-08-23 - 標準架構版
> 主要更新：統一任務管理、統一路由架構、標準 API 端點

## 系統架構概覽

### 網路配置
- **AI Ops Backend**: `http://ai_ops_backend:8000` (Docker 內部網路)
- **n8n 容器**: `http://n8n_main:5678` (Docker 內部網路)
- **共享網路**: `ai-ops-network`
- **外部訪問**: `http://203.0.113.10:8001`
- **Traefik 代理**: 自動 HTTPS 證書管理

### n8n Docker 部署配置
```yaml
services:
  n8n_main:
    image: docker.n8n.io/n8nio/n8n
    container_name: n8n_main
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=203.0.113.10
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://203.0.113.10:8001/
      - N8N_RUNNERS_ENABLED=true
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
      - NODE_ENV=production
      - GENERIC_TIMEZONE=Asia/Taipei
      - TZ=Asia/Taipei
      - N8N_PAYLOAD_SIZE_MAX=200
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - ai-ops-network

volumes:
  n8n_data:

networks:
  ai-ops-network:
    external: true
```

### 認證設定
- **API 認證**: 使用 `X-API-Key` Header
- **API 金鑰**: `[YOUR_API_KEY]`
- **基本驗證**: `core/validators.py` 驗證器
- **n8n 帳號**: 用戶名 `[請參考環境變數設定]` / 密碼 `[請參考環境變數設定]`

### 架構特點
- **統一主程式**: `main.py` 統一入口
- **統一路由**: `unified_routes.py` 集中管理所有 API
- **異步任務管理**: `AsyncTaskManager` 提供穩定的任務處理
- **AI 服務整合**: 提供智能分析和查詢功能
- **簡化管理**: 精簡的管理 API，專注核心功能

## API 端點總覽

### 核心功能 API
| 端點 | 方法 | 用途 | 適用場景 |
|------|------|------|----------|
| `/health` | GET | 健康檢查 | 監控系統狀態 |
| `/api/devices` | GET | 獲取設備列表 | 設備發現和管理 |
| `/api/device-groups` | GET | 獲取設備群組 | 群組化管理 |
| `/api/devices/status` | GET | 設備狀態檢查 | 設備健康監控 |
| `/api/ai-status` | GET | AI 服務狀態 | AI 功能監控 |
| `/api/frontend-config` | GET | 前端配置 | 動態配置管理 |

### 任務執行 API
| 端點 | 模式 | 執行類型 | 適用場景 |
|------|------|----------|---------|
| `/api/tasks` | 異步 | 返回 task_id | n8n 工作流、長時間運行 |

#### 支援的操作類型
- **device_command**: 執行設備指令
- **ai_query**: AI 查詢和分析

#### 核心功能特點
- **異步任務處理**: 支援長時間運行的設備操作
- **錯誤處理機制**: 完整的錯誤處理和重試機制
- **統一回應格式**: 所有 API 使用一致的回應結構

### 任務管理 API
| 端點 | 方法 | 用途 | 功能 |
|------|------|------|---------|
| `/api/tasks/{id}` | GET | 查詢任務狀態 | 完整進度追蹤 |

#### 管理 API
| 端點 | 方法 | 用途 | 請求格式 |
|------|------|------|----------|
| `/api/admin/tasks/stats` | GET | 任務統計資訊 | 無需參數 |

## n8n HTTP Request 節點標準配置

### 基本配置模板
```json
{
  "authentication": "genericCredentialType",
  "nodeCredentialType": "httpHeaderAuth",
  "method": "POST",
  "url": "http://ai_ops_backend:8000/api/tasks",
  "sendHeaders": true,
  "specifyHeaders": "usingFieldsBelow",
  "headerParameters": {
    "parameters": [
      {
        "name": "X-API-Key",
        "value": "[YOUR_API_KEY]"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyContentType": "json",
  "jsonBody": "",
  "options": {
    "timeout": 30000,
    "response": {
      "responseFormat": "autodetect"
    }
  }
}
```

### 認證配置選項
根據 n8n 官方文檔，支援的認證方法：
- **None**: 無需認證
- **Basic Auth**: 用戶名/密碼認證
- **Header Auth**: 標頭認證（推薦用於 API Key）
- **OAuth1/OAuth2**: OAuth 認證
- **Custom Auth**: 自定義認證
- **Query Auth**: 查詢參數認證

### 進階配置選項
```json
{
  "options": {
    "timeout": 30000,
    "redirect": {
      "followRedirects": true,
      "maxRedirects": 5
    },
    "response": {
      "fullResponse": false,
      "responseFormat": "autodetect",
      "neverError": false
    },
    "batchSize": 1,
    "batchInterval": 0,
    "ignoreSSLIssues": false,
    "lowercaseHeaders": true,
    "arrayFormat": "indices"
  },
  "retry": {
    "enabled": true,
    "maxTries": 3,
    "waitBetween": 1000
  }
}
```

#### 配置說明
- **timeout**: 請求超時時間（毫秒）
- **responseFormat**: 回應格式（autodetect, json, text, file）
- **neverError**: 無論回應代碼如何都視為成功
- **batchSize/batchInterval**: 批次處理配置
- **arrayFormat**: 查詢參數陣列格式（indices, brackets, repeat, comma）

#### 錯誤處理機制
- **自動重試**: 網路錯誤和連線超時自動重試
- **參數驗證**: 完整的輸入參數和 API 權限檢查
- **統一錯誤回應**: 使用 BaseResponse 格式提供一致的錯誤訊息

## API 調用範例

### 1. 設備健康檢查工作流

#### 步驟 1: 獲取設備列表
```json
{
  "method": "GET",
  "url": "http://ai_ops_backend:8000/api/devices",
  "headers": {
    "X-API-Key": "[YOUR_API_KEY]"
  }
}
```

#### 步驟 2: 執行健康檢查任務
```json
{
  "method": "POST",
  "url": "http://ai_ops_backend:8000/api/tasks",
  "headers": {
    "X-API-Key": "[YOUR_API_KEY]",
    "Content-Type": "application/json"
  },
  "body": {
    "operation_type": "device_command",
    "devices": ["192.168.1.1", "192.168.1.2"],
    "command": "show version",
    "webhook_url": "http://n8n_main:5678/webhook/health-check-complete"
  }
}
```

#### 步驟 3: 即時監控任務狀態
```json
// 初始查詢
{
  "method": "GET",
  "url": "http://ai_ops_backend:8000/api/tasks/{{ $('Execute Health Check').item.json.data.task_id }}",
  "headers": {
    "X-API-Key": "[YOUR_API_KEY]"
  }
}

// 預期回應 - 進行中
{
  "success": true,
  "data": {
    "task_id": "hc-20250823-001",
    "status": "running",
    "operation_type": "device_command",
    "created_at": "2025-08-23T08:00:00Z",
    "started_at": "2025-08-23T08:00:01Z",
    "progress": {
      "percentage": 50,
      "current_stage": "執行指令中...",
      "details": {}
    },
    "results": null,
    "error": null
  }
}

// 預期回應 - 完成
{
  "success": true,
  "data": {
    "task_id": "hc-20250823-001",
    "status": "completed",
    "operation_type": "device_command",
    "progress": { "percentage": 100, "current_stage": "執行完成" },
    "results": {
      "results": [
        {"deviceName": "Router-1", "deviceIp": "192.168.1.1", "success": true, "output": "Cisco IOS..."},
        {"deviceName": "Router-2", "deviceIp": "192.168.1.2", "success": true, "output": "Cisco IOS..."}
      ],
      "summary": {
        "total": 2,
        "successful": 2,
        "failed": 0
      }
    }
  }
}
```

### 2. AI 驅動的設備分析

#### AI 分析範例
```json
{
  "method": "POST",
  "url": "http://ai_ops_backend:8000/api/tasks",
  "headers": {
    "X-API-Key": "[YOUR_API_KEY]",
    "Content-Type": "application/json"
  },
  "body": {
    "operation_type": "ai_query",
    "devices": ["192.168.1.1", "192.168.1.2"],
    "query": "比較這些設備的效能表現，識別潛在問題並提供維護建議",
    "webhook_url": "http://n8n:5678/webhook/ai-analysis-complete"
  }
}
```

### 3. 設備配置部署

```json
{
  "method": "POST",
  "url": "http://ai_ops_backend:8000/api/tasks",
  "headers": {
    "X-API-Key": "[YOUR_API_KEY]",
    "Content-Type": "application/json"
  },
  "body": {
    "operation_type": "device_command",
    "devices": ["192.168.1.1", "192.168.1.2", "192.168.1.3"],
    "command": "vlan {{ $json.vlan_id }}; name {{ $json.vlan_name }}",
    "webhook_url": "http://n8n:5678/webhook/config-deploy-complete"
  }
}
```

### 4. 異常監控和報警

#### 觸發器工作流範例
```json
{
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "*/5 * * * *"
            }
          ]
        }
      },
      "name": "定時觸發器 (每5分鐘)",
      "type": "n8n-nodes-base.cron"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://ai_ops_backend:8000/api/tasks",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "X-API-Key",
              "value": "[YOUR_API_KEY]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyContentType": "json",
        "jsonBody": "={\n  \"operation_type\": \"device_command\",\n  \"devices\": [\"192.168.1.1\", \"192.168.1.2\"],\n  \"command\": \"show log | grep ERROR\",\n  \"webhook_url\": \"http://n8n:5678/webhook/error-check-complete\"\n}"
      },
      "name": "檢查設備錯誤",
      "type": "n8n-nodes-base.httpRequest"
    }
  ]
}
```

## 進階功能

### Webhook 回調處理

#### n8n Webhook 觸發器配置
```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "ai-ops-callback",
    "responseMode": "noResponseBody",
    "authentication": "headerAuth",
    "options": {
      "ignoreBots": true,
      "rawBody": false,
      "binaryPropertyName": "data"
    }
  },
  "name": "AI Ops 回調接收",
  "type": "n8n-nodes-base.webhook"
}
```

#### Webhook 安全配置
根據 n8n 官方文檔，支援的認證方法：
- **None**: 無認證（僅限內部網路）
- **Basic Auth**: 基本認證
- **Header Auth**: 標頭認證（推薦）
- **JWT Auth**: JWT 令牌認證

#### Webhook 回應配置
- **Immediately**: 立即回應 "Workflow got started"
- **When Last Node Finishes**: 等待工作流完成後回應
- **Using 'Respond to Webhook' Node**: 使用專用回應節點

#### 安全選項
- **IP 白名單**: 限制允許的 IP 地址
- **忽略機器人**: 忽略爬蟲和預覽請求
- **最大載荷**: 16MB（可通過 `N8N_PAYLOAD_SIZE_MAX` 配置）

#### 處理任務完成通知
```json
{
  "parameters": {
    "conditions": {
      "string": [
        {
          "value1": "={{ $json.status }}",
          "operation": "equal",
          "value2": "completed"
        }
      ]
    }
  },
  "name": "判斷任務狀態",
  "type": "n8n-nodes-base.if"
}
```

### 錯誤處理機制

#### 任務失敗處理
當任務失敗時，可以創建新任務重新執行：
```json
{
  "method": "POST",
  "url": "http://ai_ops_backend:8000/api/tasks",
  "headers": {
    "X-API-Key": "[YOUR_API_KEY]",
    "Content-Type": "application/json"
  },
  "body": {
    "operation_type": "device_command",
    "devices": ["{{ $json.failed_device_ip }}"],
    "command": "{{ $json.original_command }}",
    "webhook_url": "http://n8n:5678/webhook/retry-complete"
  }
}
```

### 條件執行和分支邏輯

#### 基於設備類型的條件執行
```json
{
  "parameters": {
    "conditions": {
      "string": [
        {
          "value1": "={{ $json.device_type }}",
          "operation": "equal",
          "value2": "cisco_ios"
        }
      ]
    }
  },
  "name": "檢查設備類型",
  "type": "n8n-nodes-base.if"
}
```

#### Cisco 設備專用指令
```json
{
  "body": {
    "operation_type": "device_command",
    "devices": ["{{ $json.device_ip }}"],
    "command": "show interfaces status",
    "webhook_url": "http://n8n:5678/webhook/interface-check-complete"
  }
}
```

## 統一回應格式

所有 API 都遵循統一的回應格式：

```typescript
interface BaseResponse<T> {
  success: boolean;        // 操作是否成功
  data: T | null;         // 回應數據
  message: string;        // 狀態訊息
  error_code: string | null; // 錯誤碼 (如果有)
  timestamp: string;      // 時間戳記
}
```

### 成功回應範例
```json
{
  "success": true,
  "data": {
    "task_id": "abc123-def456-789",
    "status": "pending",
    "created_at": "2025-01-15T10:30:00Z",
    "polling_url": "/api/tasks/abc123-def456-789"
  },
  "message": "任務已成功建立",
  "error_code": null,
  "timestamp": "2025-01-15T10:30:00.123456Z"
}
```

### 錯誤回應範例
```json
{
  "success": false,
  "data": null,
  "message": "設備 192.168.1.100 未在配置中找到",
  "error_code": "DEVICE_NOT_FOUND",
  "timestamp": "2025-01-15T10:30:00.123456Z"
}
```

## 最佳實踐

### 1. 任務管理
- **異步操作**: 所有任務通過 `/api/tasks` 端點執行
- **任務追蹤**: 使用 `task_id` 監控進度
- **進度更新**: 即時進度追蹤和狀態更新

### 2. 錯誤處理
- **設定適當超時**: 根據操作複雜度調整 `timeout` 
- **實施重試機制**: 網路問題使用指數退避
- **錯誤分類**: 區分網路錯誤、認證錯誤、業務邏輯錯誤
- **日誌記錄**: 記錄完整的請求和回應以便除錯

### 3. 效能優化
#### API 呼叫優化
- **批次處理**: 支援多設備同時操作，提高執行效率
- **任務監控**: 使用 `GET /api/tasks/{task_id}` 進行個別任務追蹤
- **狀態監控**: 透過 Webhook 回調獲得任務完成通知

#### n8n 效能優化
- **並行執行**: 獨立操作使用並行節點提升效率
- **Webhook 優化**: 異步回調機制，避免輪詢消耗
- **條件執行**: 使用 IF 節點減少不必要的 API 呼叫

### 4. 安全考量
#### 安全驗證系統
- **輸入驗證**: 完整的參數檢查和指令驗證
- **API 認證**: X-API-Key 驗證機制
- **輸入清洗**: 防止注入攻擊和惡意指令

#### 認證和權限
- **API 金鑰管理**: 在 n8n 中使用安全存儲 (`HTTP Header Auth`)
- **工作流隔離**: n8n 工作流間資料隔離

#### 網路和基礎設施安全
- **Docker 網路隔離**: 利用內部網路 `ai-ops-network` 確保安全
- **Traefik TLS**: 自動 HTTPS 證書管理
- **日誌安全**: 敏感資訊遾蔽和日誌輪轉

#### 異常和安全事件處理
- **異常分類**: 區分可重試錯誤與安全事件
- **安全事件記錄**: 失敗登入和異常操作追蹤

## 常用工作流範例

### 設備巡檢工作流
```json
{
  "name": "每日設備巡檢",
  "nodes": [
    {
      "name": "定時觸發 (每日 8:00)",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "rule": {
          "interval": [{"field": "cronExpression", "expression": "0 8 * * *"}]
        }
      }
    },
    {
      "name": "獲取設備列表",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "http://ai_ops_backend:8000/api/devices"
      }
    },
    {
      "name": "執行健康檢查",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://ai_ops_backend:8000/api/tasks",
        "jsonBody": "={{ {\n  \"operation_type\": \"device_command\",\n  \"devices\": $json.data.map(d => d.ip),\n  \"command\": \"show version\",\n  \"webhook_url\": \"http://n8n_main:5678/webhook/patrol-complete\"\n} }}"
      }
    }
  ]
}
```

### 故障響應工作流
```json
{
  "name": "智能故障響應",
  "trigger": "webhook",
  "nodes": [
    {
      "name": "AI 故障分析",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://ai_ops_backend:8000/api/tasks",
        "jsonBody": "={\n  \"operation_type\": \"ai_query\",\n  \"devices\": [$json.device_ip],\n  \"query\": \"分析當前告警 '{{ $json.alert_message }}' 並提供解決方案\",\n  \"webhook_url\": \"http://n8n:5678/webhook/ai-analysis-complete\"\n}"
      }
    },
    {
      "name": "發送修復建議",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#network-ops",
        "text": "設備 {{ $json.device_ip }} 故障分析完成：\n{{ $('AI 故障分析').item.json.data.results[0].output }}"
      }
    }
  ]
}
```

## 技術支援和監控

### 系統日誌和監控
#### 日誌檢查
```bash
# AI Ops Backend 日誌 (分級監控)
docker logs ai_ops_backend -f --since=10m | grep ERROR
docker logs ai_ops_backend -f --since=1h | grep "task_id"

# n8n 日誌 (工作流監控)
docker logs n8n_main -f | grep "workflow"
docker logs n8n_main -f | grep "webhook"

# Traefik 代理日誌
docker logs ai_ops_traefik -f | grep "ai_ops"

# 任務統計監控
curl -H "X-API-Key: [YOUR_API_KEY]" http://ai_ops_backend:8000/api/admin/tasks/stats
```

#### 即時監控 API
```bash
# 基本健康檢查 (無需 API Key)
curl http://ai_ops_backend:8000/health

# AI 服務狀態檢查
curl -H "X-API-Key: [YOUR_API_KEY]" http://ai_ops_backend:8000/api/ai-status

# 任務統計監控
curl -H "X-API-Key: [YOUR_API_KEY]" http://ai_ops_backend:8000/api/admin/tasks/stats
```

### 網路和連接測試
```bash
# 從 n8n 容器測試連通性
docker exec n8n_main ping -c 3 ai_ops_backend
docker exec n8n_main wget -qO- http://ai_ops_backend:8000/health

# 測試 API 認證
curl -H "X-API-Key: [YOUR_API_KEY]" -I http://ai_ops_backend:8000/api/devices

# 測試 Webhook 連接
curl -X POST http://n8n_main:5678/webhook/test -d '{"test": true}'

# 測試任務管理器狀態
curl -H "X-API-Key: [YOUR_API_KEY]" http://ai_ops_backend:8000/api/admin/tasks/stats
```

### 效能監控和診斷
#### 系統資源監控
```bash
# CPU 和記憶體使用率
docker stats --no-stream ai_ops_backend n8n_main ai_ops_traefik

# 磁碟空間使用
df -h
docker system df

# 任務管理器統計
curl -H "X-API-Key: [YOUR_API_KEY]" http://ai_ops_backend:8000/api/admin/tasks/stats
```

### 常見問題和解決方案
#### 1. 連接和網路問題
- **連接超時**: 檢查 Docker 網路配置和防火牆設定
- **DNS 解析失敗**: 使用 IP 位址取代域名
- **端口衝突**: 檢查端口占用情況 `netstat -tlnp`

#### 2. 認證和權限問題
- **API 金鑰錯誤**: 檢查 n8n 認證配置和環境變數
- **權限不足**: 確認使用正確的 API 端點和 HTTP 方法
- **CORS 問題**: 更新 ALLOWED_ORIGINS 環境變數

#### 3. 任務執行問題
- **任務卡住**: 檢查後端服務狀態和資源使用
- **設備連接失敗**: 確認設備配置和網路可達性
- **AI 服務錯誤**: 檢查 API 金鑰和服務可用性

#### 4. 效能問題
- **記憶體使用過高**: 監控系統資源並適時重啟服務
- **響應時間慢**: 檢查系統負載和網路連接
- **任務執行緩慢**: 檢查設備連接狀況和系統資源

#### 5. n8n 工作流問題
- **Webhook 未觸發**: 檢查 URL 格式和網路連接
- **工作流異常中斷**: 檢查錯誤訊息和重試機制
- **資料傳遞問題**: 確認 JSON 格式和變數引用

---

本指南涵蓋了 AI Ops Assistant Gemini 與 n8n 整合的所有核心功能。

---

## 2025-08-23 標準架構更新

### 後端架構的主要特點：

#### 1. 統一架構設計
- **统一路由管理**: `unified_routes.py` 整合所有 API 功能，提供一致的接口
- **異步任務管理**: `AsyncTaskManager` 提供穩定的任務處理能力
- **模組化設計**: 清晰的模組分離，便於維護和擴展

#### 2. 核心功能完善
- **雙核心操作**: device_command 和 ai_query 兩種完整的操作類型
- **完整驗證機制**: 提供完整的輸入驗證和 API 認證
- **統一回應格式**: BaseResponse 確保 API 回應的一致性

#### 3. 系統穩定性
- **穩定的架構**: 經過最佳化的架構設計確保系統穩定運行
- **良好的維護性**: 清晰的代碼結構便於理解和維護
- **錯誤處理**: 完善的錯誤處理機制確保系統可靠性

#### 4. n8n 整合優化
- **標準配置**: 提供完整的 n8n 整合配置範例
- **Webhook 支援**: 完整的回調功能支援異步操作
- **統一 API**: 所有功能通過 `/api/tasks` 端點提供一致的操作體驗

#### 5. 效能與安全
- **效能最佳化**: 支援批次處理和並行執行，提升操作效率
- **安全機制**: 完整的認證和輸入驗證機制確保系統安全
- **監控支援**: 完整的日誌和監控功能便於系統維護

這個標準架構版本為 n8n 整合提供穩定、可靠、功能完整的 API 服務。

**相關文件**：
- **主程式**: `/home/sysadmin/ai_ops_assistant_gemini/WEB_APP/backend/main.py`
- **統一路由**: `/home/sysadmin/ai_ops_assistant_gemini/WEB_APP/backend/unified_routes.py`