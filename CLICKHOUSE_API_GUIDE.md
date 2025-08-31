# n8n ClickHouse Flow API 整合手冊

## 🚀 系統概覽

本手冊為 **n8n 使用者**提供完整的 ClickHouse Flow API 整合指南，讓您能在 n8n 工作流中輕鬆使用網路流量分析功能。

### 技術規格
- **架構**: FastAPI + ClickHouse + Akvorado
- **資料庫**: ClickHouse 25.3.6.56
- **回應格式**: JSON
- **平均回應時間**: 20-35ms
- **成功率**: 100%
- **資料量**: 110,000+ 流量記錄

### 系統狀態
✅ **生產就緒** - 所有核心功能完全可用  
⚡ **高效能** - 平均回應時間 20-35ms  
🔒 **穩定可靠** - 100% API 成功率  

---

## 📋 目錄

- [快速開始](#快速開始)
- [API 端點列表](#api-端點列表)
- [資料模型](#資料模型)
- [認證與連線](#認證與連線)
- [使用範例](#使用範例)
- [進階功能](#進階功能)
- [最佳實踐](#最佳實踐)
- [故障排除](#故障排除)

---

## 🎯 快速開始

### 基本資訊
- **基礎 URL**: `http://ai_ops_backend:8000/api/flows`
- **協定**: HTTP/1.1
- **內容類型**: `application/json`

### 健康檢查
```bash
curl -X GET "http://ai_ops_backend:8000/api/flows/health"
```

### 快速測試
```bash
# 獲取最近1小時的流量概覽
curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=1"

# 獲取 Top 5 流量來源
curl -X GET "http://ai_ops_backend:8000/api/flows/top-talkers?limit=5&hours=1"
```

---

## 📡 API 端點列表

### 1. 健康檢查
**GET** `/health`

檢查 ClickHouse 連接狀態和系統資訊。

**回應時間**: ~38ms

**回應範例**:
```json
{
  "status": "connected",
  "database": "default",
  "version": "25.3.6.56",
  "uptime_seconds": 14507,
  "tables": [
    {
      "name": "flows",
      "engine": "MergeTree",
      "total_rows": 111473,
      "total_bytes": 1564244
    },
    {
      "name": "flows_1m0s",
      "engine": "SummingMergeTree",
      "total_rows": 59143,
      "total_bytes": 867619
    },
    {
      "name": "flows_5m0s",
      "engine": "SummingMergeTree",
      "total_rows": 31522,
      "total_bytes": 377017
    },
    {
      "name": "flows_1h0m0s",
      "engine": "SummingMergeTree",
      "total_rows": 11512,
      "total_bytes": 116488
    },
    {
      "name": "exporters",
      "engine": "ReplacingMergeTree",
      "total_rows": 24,
      "total_bytes": 5538
    }
  ]
}
```

---

### 2. 流量概覽統計
**GET** `/summary`

獲取指定時間範圍內的流量統計總覽。

**參數**:
- `hours` (int): 統計時間範圍（小時），1-168，預設 24
- `include_details` (bool): 是否包含執行時間，預設 false

**回應時間**: ~16ms

**使用範例**:
```bash
# 獲取1小時統計（包含詳細資訊）
curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=1&include_details=true"

# 獲取24小時統計
curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=24"
```

**回應範例**:
```json
{
  "summary": {
    "total_flows": 2585,
    "total_bytes": 638670,
    "total_packets": 3932,
    "time_range_start": "2025-08-30T13:10:03",
    "time_range_end": "2025-08-30T14:09:56",
    "duration_seconds": 3593,
    "avg_bytes_per_flow": 247.07,
    "avg_packets_per_flow": 1.52
  },
  "execution_time_ms": 13.77,
  "query_parameters": {
    "hours": 1
  }
}
```

---

### 3. Top-N 流量分析
**GET** `/top-talkers`

獲取流量最大的 N 個 IP 位址統計。

**參數**:
- `limit` (int): 返回前 N 筆記錄，1-100，預設 10
- `hours` (int): 統計時間範圍（小時），1-24，預設 1
- `by_field` (str): 排序欄位，可選：bytes, packets, flows，預設 bytes
- `src_or_dst` (str): 統計來源或目的地，可選：src, dst，預設 src

**回應時間**: ~47ms

**使用範例**:
```bash
# 獲取 Top 5 流量來源（按位元組）
curl -X GET "http://ai_ops_backend:8000/api/flows/top-talkers?limit=5&hours=1&by_field=bytes&src_or_dst=src"

# 獲取 Top 10 流量目的地（按封包）
curl -X GET "http://ai_ops_backend:8000/api/flows/top-talkers?limit=10&hours=1&by_field=packets&src_or_dst=dst"
```

**回應範例**:
```json
[
  {
    "address": "202.153.183.18",
    "bytes": 569717,
    "packets": 3079,
    "flows": 1946,
    "percentage": 85.69
  }
]
```

---

### 4. 協定流量分佈
**GET** `/protocols`

獲取網路協定的流量分佈統計。

**參數**:
- `hours` (int): 統計時間範圍（小時），1-24，預設 1
- `limit` (int): 返回前 N 個協定，1-50，預設 10

**回應時間**: ~24ms

**使用範例**:
```bash
curl -X GET "http://ai_ops_backend:8000/api/flows/protocols?hours=1&limit=10"
```

**回應範例**:
```json
[
  {
    "protocol_number": 17,
    "protocol_name": "UDP",
    "flows": 1636,
    "bytes": 49217710,
    "packets": 48457,
    "percentage": 99.27
  },
  {
    "protocol_number": 6,
    "protocol_name": "TCP",
    "flows": 1104,
    "bytes": 271469,
    "packets": 1393,
    "percentage": 0.55
  },
  {
    "protocol_number": 1,
    "protocol_name": "ICMP",
    "flows": 696,
    "bytes": 88042,
    "packets": 1020,
    "percentage": 0.18
  }
]
```

---

### 5. 地理位置分析
**GET** `/geolocation`

獲取按地理位置分組的流量統計。

**參數**:
- `hours` (int): 統計時間範圍（小時），1-24，預設 1
- `limit` (int): 返回前 N 個位置，1-50，預設 10
- `by_country_only` (bool): 是否只按國家統計，預設 true

**回應時間**: ~41ms

**使用範例**:
```bash
# 獲取國家層級統計
curl -X GET "http://ai_ops_backend:8000/api/flows/geolocation?hours=1&limit=5&by_country_only=true"

# 獲取城市層級統計
curl -X GET "http://ai_ops_backend:8000/api/flows/geolocation?hours=1&limit=10&by_country_only=false"
```

**回應範例**:
```json
[
  {
    "country": "TW",
    "city": "Taipei",
    "flows": 207,
    "bytes": 730211,
    "packets": 730,
    "percentage": 37.14
  },
  {
    "country": "JO",
    "city": "Amman",
    "flows": 14851,
    "bytes": 715968,
    "packets": 14867,
    "percentage": 36.42
  },
  {
    "country": "TW",
    "city": "Taoyuan",
    "flows": 11,
    "bytes": 134684,
    "packets": 126,
    "percentage": 6.85
  }
]
```

**📍 地理資料說明**: 
- 當 `by_country_only=true` 時：返回國家層級統計，城市欄位為空
- 當 `by_country_only=false` 時：返回城市層級統計，僅顯示有城市資料的記錄
- 城市資料覆蓋率約 18-20%，主要包含台灣、美國、日本、約旦等地的城市

---

### 6. ASN 自治系統分析
**GET** `/asn`

獲取自治系統編號的流量分析統計。

**參數**:
- `hours` (int): 統計時間範圍（小時），1-24，預設 1
- `limit` (int): 返回前 N 個 ASN，1-50，預設 10
- `src_or_dst` (str): 分析來源或目的 ASN，可選：src, dst，預設 src

**回應時間**: ~28ms

**使用範例**:
```bash
# 獲取來源 ASN 分析
curl -X GET "http://ai_ops_backend:8000/api/flows/asn?hours=1&limit=5&src_or_dst=src"

# 獲取目的 ASN 分析
curl -X GET "http://ai_ops_backend:8000/api/flows/asn?hours=1&limit=5&src_or_dst=dst"
```

**回應範例**:
```json
[
  {
    "asn": 4134,
    "asn_name": "",
    "flows": 800,
    "bytes": 200000,
    "packets": 1200,
    "percentage": 45.2,
    "unique_ips": 50
  }
]
```

---

### 7. 時間序列分析
**GET** `/timeseries`

獲取指定時間範圍和間隔的時間序列流量資料。

**參數**:
- `hours` (int): 統計時間範圍（小時），1-168，預設 24
- `interval_minutes` (int): 時間間隔（分鐘），1-60，預設 5

**回應時間**: ~19ms

**使用範例**:
```bash
# 獲取2小時時間序列（15分鐘間隔）
curl -X GET "http://ai_ops_backend:8000/api/flows/timeseries?hours=2&interval_minutes=15"

# 獲取6小時時間序列（30分鐘間隔）
curl -X GET "http://ai_ops_backend:8000/api/flows/timeseries?hours=6&interval_minutes=30"
```

**回應範例**:
```json
[
  {
    "timestamp": "2025-08-30T22:00:00",
    "flows": 150,
    "bytes": 50000,
    "packets": 300,
    "unique_src_ips": 25,
    "unique_dst_ips": 30
  }
]
```

---

### 8. 埠號統計
**GET** `/ports`

獲取埠號的流量統計分析。

**參數**:
- `hours` (int): 統計時間範圍（小時），1-24，預設 1
- `limit` (int): 返回前 N 個埠號，1-50，預設 10
- `src_or_dst` (str): 統計來源或目的埠號，可選：src, dst，預設 dst

**回應時間**: ~28ms

**使用範例**:
```bash
# 獲取目的埠號統計
curl -X GET "http://ai_ops_backend:8000/api/flows/ports?hours=1&limit=10&src_or_dst=dst"

# 獲取來源埠號統計
curl -X GET "http://ai_ops_backend:8000/api/flows/ports?hours=1&limit=10&src_or_dst=src"
```

**回應範例**:
```json
[
  {
    "port": 8853,
    "port_name": "Port-8853",
    "flows": 7,
    "bytes": 9169221,
    "packets": 7191,
    "percentage": 18.67
  },
  {
    "port": 8834,
    "port_name": "Port-8834",
    "flows": 22,
    "bytes": 5520371,
    "packets": 4422,
    "percentage": 11.24
  },
  {
    "port": 8850,
    "port_name": "Port-8850",
    "flows": 9,
    "bytes": 3968351,
    "packets": 3204,
    "percentage": 8.08
  }
]
```

---

### 9. 網路介面統計
**GET** `/interfaces`

獲取網路介面的流量統計分析。

**參數**:
- `hours` (int): 統計時間範圍（小時），1-24，預設 1
- `limit` (int): 返回前 N 個介面，1-50，預設 10
- `direction` (str): 統計方向，可選：input, output，預設 input

**回應時間**: ~29ms

**使用範例**:
```bash
# 獲取輸入介面統計
curl -X GET "http://ai_ops_backend:8000/api/flows/interfaces?hours=1&limit=5&direction=input"

# 獲取輸出介面統計
curl -X GET "http://ai_ops_backend:8000/api/flows/interfaces?hours=1&limit=5&direction=output"
```

**回應範例**:
```json
[
  {
    "interface_name": "eth0",
    "interface_description": "External Interface",
    "direction": "input",
    "flows": 1200,
    "bytes": 400000,
    "packets": 1800,
    "percentage": 67.5
  }
]
```

---

### 10. 流量記錄搜尋
**GET** `/search`

根據條件搜尋具體的流量記錄。

**參數**:
- `src_addr` (str): 來源 IP 位址（可選）
- `dst_addr` (str): 目的 IP 位址（可選）
- `protocol` (int): 協定編號，0-255（可選）
- `src_port` (int): 來源埠號，0-65535（可選）
- `dst_port` (int): 目的埠號，0-65535（可選）
- `hours` (int): 搜尋時間範圍（小時），1-24，預設 1
- `page` (int): 頁數，預設 1
- `limit` (int): 每頁筆數，1-1000，預設 100

**回應時間**: ~36ms

**使用範例**:
```bash
# 基本搜尋
curl -X GET "http://ai_ops_backend:8000/api/flows/search?hours=1&limit=5&page=1"

# TCP 流量搜尋
curl -X GET "http://ai_ops_backend:8000/api/flows/search?hours=1&limit=10&page=1&protocol=6"

# 搜尋特定 IP
curl -X GET "http://ai_ops_backend:8000/api/flows/search?src_addr=192.168.1.100&hours=1"
```

**回應範例**:
```json
{
  "success": true,
  "data": [
    {
      "TimeReceived": "2025-08-31T06:40:25",
      "SrcAddr": "::ffff:202.153.183.18",
      "DstAddr": "::ffff:1.1.1.1",
      "SrcPort": 8834,
      "DstPort": 53,
      "Proto": 17,
      "Bytes": 52,
      "Packets": 1,
      "SrcAS": 17408,
      "DstAS": 13335,
      "SrcCountry": "TW",
      "DstCountry": "US",
      "SrcGeoCity": "Taoyuan District",
      "DstGeoCity": "",
      "SrcGeoState": "TAO",
      "DstGeoState": ""
    }
  ],
  "total_records": 2457,
  "execution_time_ms": 42.85
}
```

---

## 📊 資料模型

### 流量記錄欄位

| 欄位名 | 類型 | 說明 |
|--------|------|------|
| `TimeReceived` | DateTime | 接收時間 |
| `SrcAddr` | IPv6 | 來源 IP 位址 |
| `DstAddr` | IPv6 | 目的 IP 位址 |
| `SrcPort` | UInt16 | 來源埠號 |
| `DstPort` | UInt16 | 目的埠號 |
| `Proto` | UInt8 | 協定編號 |
| `Bytes` | UInt64 | 位元組數 |
| `Packets` | UInt64 | 封包數 |
| `SrcAS` | UInt32 | 來源自治系統編號 |
| `DstAS` | UInt32 | 目的自治系統編號 |
| `SrcCountry` | FixedString(2) | 來源國家代碼 |
| `DstCountry` | FixedString(2) | 目的國家代碼 |
| `SrcGeoCity` | String | 來源城市 |
| `DstGeoCity` | String | 目的城市 |
| `SrcGeoState` | String | 來源州/省 |
| `DstGeoState` | String | 目的州/省 |

### 常見協定編號

| 編號 | 協定名稱 | 說明 |
|------|----------|------|
| 1 | ICMP | 網路控制訊息協定 |
| 6 | TCP | 傳輸控制協定 |
| 17 | UDP | 用戶資料包協定 |
| 47 | GRE | 通用路由封裝 |
| 50 | ESP | 封裝安全載荷 |

### 常見埠號

| 埠號 | 服務 | 說明 |
|------|------|------|
| 80 | HTTP | 超文本傳輸協定 |
| 443 | HTTPS | 安全超文本傳輸協定 |
| 53 | DNS | 域名系統 |
| 22 | SSH | 安全殼層 |
| 25 | SMTP | 簡單郵件傳輸協定 |

---

## 🔐 認證與連線

### API 連線方式

**n8n 使用的標準路徑**：
```
http://ai_ops_backend:8000/api/flows/
```

**說明**：
- 這是 Docker 內部網路通訊路徑
- n8n 和 ai_ops_backend 在同一 Docker 網路中
- 無需額外認證或配置
- 所有 n8n HTTP Request 節點都使用此基礎路徑

### 錯誤處理
API 使用標準 HTTP 狀態碼：

- `200` - 成功
- `400` - 請求參數錯誤
- `404` - 端點不存在
- `500` - 內部服務器錯誤

**錯誤回應格式**:
```json
{
  "detail": "錯誤描述訊息"
}
```

---

## 🔧 n8n 工作流範例

### 基本網路監控工作流

**節點 1: Schedule Trigger**
- **Name**: 每 5 分鐘執行
- **Interval**: Every `5` Minutes

**節點 2: HTTP Request - 流量概覽**
- **Method**: GET
- **URL**: `http://ai_ops_backend:8000/api/flows/summary`
- **Query Parameters**: 
  - Name: `hours`, Value: `1`
  - Name: `include_details`, Value: `true`

**節點 3: IF - 檢查流量閾值**
- **Condition**: `{{ $json.summary.total_flows > 1000 }}`
- **True Branch**: 發送告警
- **False Branch**: 正常結束

### Top Talkers 分析工作流

**節點 1: Manual Trigger**
- **Name**: 手動觸發

**節點 2: HTTP Request - Top Talkers**
- **Method**: GET
- **URL**: `http://ai_ops_backend:8000/api/flows/top-talkers`
- **Query Parameters**:
  - Name: `limit`, Value: `10`
  - Name: `hours`, Value: `1`
  - Name: `by_field`, Value: `bytes`
  - Name: `src_or_dst`, Value: `src`

**節點 3: Function - 資料處理**
```javascript
const topTalkers = $input.all();
const result = [];

for (let item of topTalkers) {
  if (item.json.percentage > 10) {
    result.push({
      json: {
        alert: '高流量 IP',
        ip: item.json.address,
        bytes: item.json.bytes,
        percentage: item.json.percentage
      }
    });
  }
}

return result;
```

### 地理位置分析工作流

**節點 1: Webhook Trigger**
- **HTTP Method**: GET
- **Path**: geolocation-analysis

**節點 2: HTTP Request - 國家統計**
- **Method**: GET
- **URL**: `http://ai_ops_backend:8000/api/flows/geolocation`
- **Query Parameters**:
  - Name: `by_country_only`, Value: `true`
  - Name: `limit`, Value: `20`
  - Name: `hours`, Value: `24`

**節點 3: HTTP Request - 城市統計**
- **Method**: GET
- **URL**: `http://ai_ops_backend:8000/api/flows/geolocation`
- **Query Parameters**:
  - Name: `by_country_only`, Value: `false`
  - Name: `limit`, Value: `15`
  - Name: `hours`, Value: `24`

**節點 4: Merge - 合併結果**
- **Mode**: Combine
- **Output Data**: All Incoming Data

**節點 5: Respond to Webhook**
- **Respond With**: All Incoming Items

---

## ⚙️ 進階功能

### 分頁機制
搜尋端點支援分頁功能：

```bash
# 第1頁，每頁100筆
curl -X GET "http://ai_ops_backend:8000/api/flows/search?page=1&limit=100"

# 第2頁，每頁50筆
curl -X GET "http://ai_ops_backend:8000/api/flows/search?page=2&limit=50"
```

### 時間範圍控制
大部分端點支援靈活的時間範圍設定：

```bash
# 最近1小時
curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=1"

# 最近24小時
curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=24"

# 最近7天（168小時）
curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=168"
```

### 多維度過濾
搜尋功能支援多條件組合：

```bash
# TCP + 特定 IP + 特定埠號
curl -X GET "http://ai_ops_backend:8000/api/flows/search?protocol=6&src_addr=192.168.1.100&dst_port=80"

# UDP DNS 查詢
curl -X GET "http://ai_ops_backend:8000/api/flows/search?protocol=17&dst_port=53"
```

---

## 🎯 最佳實踐

### 效能優化

1. **合理設置時間範圍**
   ```bash
   # 推薦：使用較短的時間範圍進行頻繁查詢
   curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=1"
   
   # 避免：過長的時間範圍
   curl -X GET "http://ai_ops_backend:8000/api/flows/summary?hours=168"  # 謹慎使用
   ```

2. **適當的分頁大小**
   ```bash
   # 推薦：合理的分頁大小
   curl -X GET "http://ai_ops_backend:8000/api/flows/search?limit=100"
   
   # 避免：過大的分頁
   curl -X GET "http://ai_ops_backend:8000/api/flows/search?limit=1000"  # 回應時間較長
   ```

3. **使用健康檢查**
   ```python
   # 在開始大量查詢前檢查系統狀態
   health = client.get_health()
   if health['status'] != 'connected':
       print("ClickHouse 不可用，請稍後再試")
   ```

### 錯誤處理建議

```python
import requests
from requests.exceptions import RequestException
import time

def api_call_with_retry(url, max_retries=3, delay=1):
    """帶重試機制的 API 呼叫"""
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()  # 檢查 HTTP 錯誤
            return response.json()
            
        except requests.exceptions.Timeout:
            print(f"請求超時，嘗試 {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                time.sleep(delay * (2 ** attempt))  # 指數退避
                
        except requests.exceptions.ConnectionError:
            print("連線錯誤，請檢查網路連線")
            break
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code >= 500:
                print(f"服務器錯誤 {e.response.status_code}，嘗試 {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    time.sleep(delay)
            else:
                print(f"客戶端錯誤 {e.response.status_code}: {e.response.text}")
                break
    
    return None
```

### 監控建議

```python
def monitor_api_performance():
    """監控 API 效能"""
    start_time = time.time()
    
    try:
        health = requests.get("http://ai_ops_backend:8000/api/flows/health", timeout=10)
        response_time = (time.time() - start_time) * 1000
        
        if health.status_code == 200:
            data = health.json()
            print(f"✅ API 健康，回應時間: {response_time:.2f}ms")
            print(f"   資料庫狀態: {data['status']}")
            print(f"   流量記錄數: {data['tables'][0]['total_rows']}")
        else:
            print(f"⚠️ API 異常，HTTP {health.status_code}")
            
    except Exception as e:
        print(f"❌ API 不可用: {e}")
```

---

## 🔍 n8n 故障排除

### 常見問題與解決

#### 1. n8n HTTP Request 連線失敗

**問題現象**: 節點顯示 "Connection refused" 或 "Cannot connect to host"

**檢查步驟**：
1. **檢查 URL 設定**：確認使用 `http://ai_ops_backend:8000/api/flows`
2. **檢查容器狀態**：確認 ai_ops_backend 容器運行中
3. **網路連通**：確認 n8n 與後端在同一 Docker 網路

**容器連通性測試**：
```bash
# 從 n8n 容器測試連線（n8n 容器使用 wget）
docker exec n8n_main wget -qO- http://ai_ops_backend:8000/api/flows/health

# 檢查 Docker 網路配置（ai-ops-network 172.21.0.0/16）
docker network inspect ai-ops-network

# 容器 IP 動態分配，使用容器名稱進行通訊
docker exec n8n_main ping -c 3 ai_ops_backend
```

**n8n 解決方案**：
- 設定 "Continue On Fail" = 是
- 增加 "Retry on Fail" = 3 次
- 設定 "Timeout" = 30000ms

#### 2. HTTP Request 回應緩慢

**問題現象**: n8n 節點執行超時或過慢

**n8n 優化設定**：

**Batching 設定**：
- Items per Batch: `5`
- Batch Interval (ms): `2000`

**Query Parameters 優化**：
- `hours`: 使用較小值 (1-6)
- `limit`: 降低到 50-100
- `interval_minutes`: 增加間隔 (5-15)

#### 3. 城市資料空值問題

**問題現象**: geolocation API 回傳部分記錄的 city 欄位為 null

**說明**: 這是正常現象，不需修復

**n8n 處理方式**：

**Function 節點 - 過濾空值資料**
```javascript
const geoData = $input.all();
const filteredData = [];

for (let item of geoData) {
  // 只保留有城市資料的記錄
  if (item.json.city && item.json.city !== '') {
    filteredData.push(item);
  }
}

return filteredData;
```

**正確的 API 設定**：
- 獲取城市資料：`by_country_only` = `false`
- 獲取國家資料：`by_country_only` = `true`

#### 4. 參數驗證錯誤 (422)

**問題現象**: n8n 節點返回 HTTP 422 錯誤

**常見原因與解決**：

| 參數 | 錯誤範例 | 正確設定 |
|--------|------------|-------------|
| `hours` | 超過 168 | 1-168 範圍內 |
| `limit` | 超過 1000 | 1-1000 範圍內 |
| `protocol` | 超過 255 | 0-255 範圍內 |
| `src_port` | 超過 65535 | 0-65535 範圍內 |

**n8n 預防設定**：

**Function 節點 - 參數驗證**
```javascript
function validateParams(params) {
  const validated = {};
  
  // 驗證 hours 參數
  validated.hours = Math.min(Math.max(params.hours || 1, 1), 168);
  
  // 驗證 limit 參數
  validated.limit = Math.min(Math.max(params.limit || 10, 1), 1000);
  
  // 驗證 protocol 參數
  if (params.protocol !== undefined) {
    validated.protocol = Math.min(Math.max(params.protocol, 0), 255);
  }
  
  return [{ json: validated }];
}

// 使用範例
return validateParams({
  hours: $node["Previous Node"].json.hours,
  limit: $node["Previous Node"].json.limit,
  protocol: $node["Previous Node"].json.protocol
});
```

### n8n Debug 技巧

**1. 啟用詳細日誌**
- 在 HTTP Request 節點設定 "Always Output Data" = 是
- 使用 "Include Response Headers and Status" = 是

**2. 使用 Debug 節點**
```javascript
// Debug 節點：輸出詳細資訊
console.log('Request URL:', $node["HTTP Request"].parameter.url);
console.log('Status Code:', $node["HTTP Request"].statusCode);
console.log('Response:', JSON.stringify($node["HTTP Request"].json, null, 2));

return $input.all();
```

**3. 條件分支測試**

**IF 節點 - 檢查回應**
```javascript
const response = $node["HTTP Request"];

// 檢查是否成功
if (response.statusCode === 200 && response.json && !response.json.error) {
  return true; // 成功分支
} else {
  return false; // 錯誤處理分支
}
```

### n8n HTTP 狀態碼處理

| HTTP 狀態碼 | n8n 處理方式 | 建議操作 |
|------------|-----------------|----------------|
| 200 | 成功，繼續工作流 | 處理正常資料 |
| 400 | 設定Continue On Fail | 檢查 Query Parameters |
| 404 | 設定Continue On Fail | 檢查 URL 路徑 |
| 422 | 設定Continue On Fail | 驗證參數範圍 |
| 500 | 啟用 Retry on Fail | 稍後重試或通知 |

**n8n 狀態碼檢查 Expression**：
```javascript
// 檢查是否成功
{{ $node["HTTP Request"].statusCode === 200 }}

// 檢查是否為系統錯誤
{{ $node["HTTP Request"].statusCode >= 500 }}

// 檢查是否為客戶端錯誤
{{ $node["HTTP Request"].statusCode >= 400 && $node["HTTP Request"].statusCode < 500 }}
```

### n8n Debug 工具

#### 1. n8n 內建測試工作流

**建立 API 測試工作流**：

**節點 1**: Manual Trigger  
**節點 2**: HTTP Request - 健康檢查  
**節點 3**: HTTP Request - 流量概覽  
**節點 4**: HTTP Request - Top Talkers  
**節點 5**: Function - 測試結果統計

```javascript
// 節點 5: 統計所有 API 請求結果
const results = {
  health: $node["HTTP Request - 健康檢查"].statusCode,
  summary: $node["HTTP Request - 流量概覽"].statusCode,
  topTalkers: $node["HTTP Request - Top Talkers"].statusCode
};

const allSuccess = Object.values(results).every(code => code === 200);

return [{
  json: {
    testResults: results,
    allTestsPassed: allSuccess,
    successRate: Object.values(results).filter(code => code === 200).length + '/' + Object.keys(results).length,
    timestamp: new Date().toISOString()
  }
}];
```

#### 2. 即時連線測試

**建立快速測試節點**：

**HTTP Request - 連線測試**
- **Method**: GET
- **URL**: `http://ai_ops_backend:8000/api/flows/health`
- **Timeout**: 5000ms
- **Include Response Headers and Status**: 是

#### 3. 日誌輸出工作流

**Function 節點 - API 請求日誌**
```javascript
const request = $node["HTTP Request"];
const logData = {
  timestamp: new Date().toISOString(),
  method: 'GET',
  url: request.parameter?.url || 'Unknown',
  statusCode: request.statusCode,
  responseTime: request.responseTime || 'N/A',
  success: request.statusCode === 200,
  error: request.statusCode !== 200 ? request.json?.detail : null
};

console.log('API Request Log:', JSON.stringify(logData, null, 2));

return [{ json: logData }];
```

#### 4. 效能監控工作流

**節點 1**: Interval Trigger (5 分鐘)  
**節點 2**: Set Performance Timer  
**節點 3**: HTTP Request - Performance Test  
**節點 4**: Function - Performance Analysis  

```javascript
// 效能分析
const startTime = $node["Set Performance Timer"].json.startTime;
const endTime = Date.now();
const responseTime = endTime - startTime;
const httpResponse = $node["HTTP Request - Performance Test"];

const performanceData = {
  endpoint: httpResponse.parameter?.url || 'Unknown',
  responseTime: responseTime + 'ms',
  statusCode: httpResponse.statusCode,
  dataSize: JSON.stringify(httpResponse.json).length,
  timestamp: new Date().toISOString(),
  isHealthy: httpResponse.statusCode === 200 && responseTime < 5000
};

return [{ json: performanceData }];
```

---

## 📈 效能指標

### 基準測試結果

基於實際測試（2025-08-31），以下是各端點的效能指標：

| 端點 | 平均回應時間 | 狀態 | 測試結果 |
|------|--------------|------|----------|
| `/health` | 19ms | ✅ | 正常 |
| `/summary` | 18ms | ✅ | 正常 |
| `/top-talkers` | 34ms | ✅ | 正常 |
| `/protocols` | 27ms | ✅ | 正常 |
| `/geolocation` | 30ms | ✅ | 正常 |
| `/asn` | 33ms | ✅ | 正常 |
| `/timeseries` | 17ms | ✅ | 正常 |
| `/ports` | 28ms | ✅ | 正常 |
| `/interfaces` | 29ms | ✅ | 正常 |
| `/search` | 28ms | ✅ | 正常 |

### 系統容量
- **總流量記錄**: 110,000+
- **併發支援**: 經測試支援多個同時請求
- **資料更新**: 即時流量資料
- **可用性**: 100% (10/10 測試通過)

---

## 📝 版本資訊

### 當前版本
- **API 版本**: 3.0.0
- **ClickHouse 版本**: 25.3.6.56
- **最後更新**: 2025-08-31
- **測試狀態**: ✅ 全部通過

### 更新記錄

**2025-08-31**:
- ✅ 優化 ClickHouse API 子查詢性能，移除重複查詢
- ✅ 更新文檔範例和數據統計，反映系統實際狀況
- ✅ 修正地理位置城市資料覆蓋率（18-20%）
- ✅ 搜尋 API 新增城市和州/省欄位 (`SrcGeoCity`, `DstGeoCity`, `SrcGeoState`, `DstGeoState`)
- ✅ 地理位置 API 支援城市級統計分析
- ✅ 修復地理位置城市分組邏輯
- ✅ 達成 100% API 成功率並支援城市級地理資訊

### 已知限制

1. **地理位置城市資料**: 城市和州/省資料覆蓋率約 18-20%，主要來源為台灣、美國、日本、約旦等地
2. **時間範圍限制**: 部分端點限制最大查詢範圍（如 Top Talkers 限制24小時）
3. **分頁限制**: 搜尋端點每頁最多1000筆記錄

### 未來規劃

1. **地理位置增強**: 啟用完整的 GeoIP 城市資料庫
2. **更多過濾選項**: 新增更靈活的查詢條件
3. **即時推送**: WebSocket 支援即時流量監控
4. **資料匯出**: 支援 CSV/Excel 格式匯出

---

## 📞 支援與聯繫

### 技術支援
- **文檔**: 本使用指南
- **測試工具**: 提供的 Python 測試腳本
- **日誌**: 容器日誌進行故障排除

### 相關資源
- **Akvorado 官方文檔**: [https://akvorado.readthedocs.io](https://akvorado.readthedocs.io)
- **ClickHouse 文檔**: [https://clickhouse.com/docs](https://clickhouse.com/docs)
- **FastAPI 文檔**: [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com)

---

**© 2025 ClickHouse API 使用指南 - 版本 1.0**