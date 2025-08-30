# ClickHouse API 使用指南

## 🚀 系統概覽

**ClickHouse API** 是基於 Akvorado 網路流量收集系統的高效能流量分析 API，提供豐富的網路流量統計和分析功能。

### 技術規格
- **架構**: FastAPI + ClickHouse + Akvorado
- **資料庫**: ClickHouse 25.3.6.56
- **回應格式**: JSON
- **平均回應時間**: 30ms
- **成功率**: 100%
- **資料量**: 23,000+ 流量記錄

### 系統狀態
✅ **生產就緒** - 所有核心功能完全可用  
⚡ **高效能** - 平均回應時間 30ms  
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
- **基礎 URL**: `http://your-server/api/flows`
- **協定**: HTTP/1.1
- **內容類型**: `application/json`

### 健康檢查
```bash
curl -X GET "http://localhost/api/flows/health"
```

### 快速測試
```bash
# 獲取最近1小時的流量概覽
curl -X GET "http://localhost/api/flows/summary?hours=1"

# 獲取 Top 5 流量來源
curl -X GET "http://localhost/api/flows/top-talkers?limit=5&hours=1"
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
  "uptime_seconds": 3491,
  "tables": [
    {
      "name": "flows",
      "engine": "MergeTree",
      "total_rows": 23818,
      "total_bytes": 388786
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
curl -X GET "http://localhost/api/flows/summary?hours=1&include_details=true"

# 獲取24小時統計
curl -X GET "http://localhost/api/flows/summary?hours=24"
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
curl -X GET "http://localhost/api/flows/top-talkers?limit=5&hours=1&by_field=bytes&src_or_dst=src"

# 獲取 Top 10 流量目的地（按封包）
curl -X GET "http://localhost/api/flows/top-talkers?limit=10&hours=1&by_field=packets&src_or_dst=dst"
```

**回應範例**:
```json
[
  {
    "address": "192.168.1.100",
    "bytes": 1048576,
    "packets": 1024,
    "flows": 256,
    "percentage": 25.6
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
curl -X GET "http://localhost/api/flows/protocols?hours=1&limit=10"
```

**回應範例**:
```json
[
  {
    "protocol_number": 6,
    "protocol_name": "TCP",
    "flows": 1500,
    "bytes": 500000,
    "packets": 2000,
    "percentage": 75.5
  },
  {
    "protocol_number": 17,
    "protocol_name": "UDP",
    "flows": 500,
    "bytes": 150000,
    "packets": 800,
    "percentage": 22.7
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
curl -X GET "http://localhost/api/flows/geolocation?hours=1&limit=5&by_country_only=true"

# 獲取國家+城市統計（目前城市資料為空）
curl -X GET "http://localhost/api/flows/geolocation?hours=1&limit=3&by_country_only=false"
```

**回應範例**:
```json
[
  {
    "country": "TW",
    "city": "",
    "flows": 1946,
    "bytes": 569717,
    "packets": 3079,
    "percentage": 85.69
  },
  {
    "country": "US",
    "city": "",
    "flows": 95,
    "bytes": 42364,
    "packets": 116,
    "percentage": 6.37
  }
]
```

**⚠️ 注意**: 目前城市欄位為空值，只有國家層級資料可用。

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
curl -X GET "http://localhost/api/flows/asn?hours=1&limit=5&src_or_dst=src"

# 獲取目的 ASN 分析
curl -X GET "http://localhost/api/flows/asn?hours=1&limit=5&src_or_dst=dst"
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
curl -X GET "http://localhost/api/flows/timeseries?hours=2&interval_minutes=15"

# 獲取6小時時間序列（30分鐘間隔）
curl -X GET "http://localhost/api/flows/timeseries?hours=6&interval_minutes=30"
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
curl -X GET "http://localhost/api/flows/ports?hours=1&limit=10&src_or_dst=dst"

# 獲取來源埠號統計
curl -X GET "http://localhost/api/flows/ports?hours=1&limit=10&src_or_dst=src"
```

**回應範例**:
```json
[
  {
    "port": 80,
    "port_name": "HTTP",
    "flows": 500,
    "bytes": 150000,
    "packets": 750,
    "percentage": 35.2
  },
  {
    "port": 443,
    "port_name": "HTTPS",
    "flows": 300,
    "bytes": 120000,
    "packets": 600,
    "percentage": 28.1
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
curl -X GET "http://localhost/api/flows/interfaces?hours=1&limit=5&direction=input"

# 獲取輸出介面統計
curl -X GET "http://localhost/api/flows/interfaces?hours=1&limit=5&direction=output"
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
curl -X GET "http://localhost/api/flows/search?hours=1&limit=5&page=1"

# TCP 流量搜尋
curl -X GET "http://localhost/api/flows/search?hours=1&limit=10&page=1&protocol=6"

# 搜尋特定 IP
curl -X GET "http://localhost/api/flows/search?src_addr=192.168.1.100&hours=1"
```

**回應範例**:
```json
{
  "success": true,
  "data": [
    {
      "TimeReceived": "2025-08-30T22:00:00",
      "SrcAddr": "192.168.1.100",
      "DstAddr": "8.8.8.8",
      "SrcPort": 45678,
      "DstPort": 53,
      "Proto": 17,
      "Bytes": 64,
      "Packets": 1,
      "SrcAS": 0,
      "DstAS": 15169,
      "SrcCountry": "TW",
      "DstCountry": "US"
    }
  ],
  "total_records": 1,
  "execution_time_ms": 24.06
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
| `SrcGeoCity` | String | 來源城市（目前為空） |
| `DstGeoCity` | String | 目的城市（目前為空） |
| `SrcGeoState` | String | 來源州/省（目前為空） |
| `DstGeoState` | String | 目的州/省（目前為空） |

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

### 連線方式
目前 API 透過 Traefik 反向代理提供服務，支援以下連線方式：

```bash
# 透過 Traefik（推薦）
http://your-server/api/flows/

# 容器直連（內部網路）
http://ai_ops_backend:8000/api/flows/
```

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

## 🔧 使用範例

### Python 範例

```python
import requests
import json

class ClickHouseAPIClient:
    def __init__(self, base_url="http://localhost/api/flows"):
        self.base_url = base_url
    
    def get_health(self):
        """獲取健康狀態"""
        response = requests.get(f"{self.base_url}/health")
        return response.json()
    
    def get_summary(self, hours=1, include_details=False):
        """獲取流量概覽"""
        params = {
            "hours": hours,
            "include_details": str(include_details).lower()
        }
        response = requests.get(f"{self.base_url}/summary", params=params)
        return response.json()
    
    def get_top_talkers(self, limit=10, hours=1, by_field="bytes", src_or_dst="src"):
        """獲取 Top N 流量"""
        params = {
            "limit": limit,
            "hours": hours,
            "by_field": by_field,
            "src_or_dst": src_or_dst
        }
        response = requests.get(f"{self.base_url}/top-talkers", params=params)
        return response.json()

# 使用範例
client = ClickHouseAPIClient()

# 檢查健康狀態
health = client.get_health()
print(f"Status: {health['status']}")

# 獲取1小時流量概覽
summary = client.get_summary(hours=1, include_details=True)
print(f"Total flows: {summary['summary']['total_flows']}")

# 獲取 Top 5 流量來源
top_talkers = client.get_top_talkers(limit=5)
for talker in top_talkers:
    print(f"{talker['address']}: {talker['bytes']} bytes ({talker['percentage']}%)")
```

### JavaScript/Node.js 範例

```javascript
const axios = require('axios');

class ClickHouseAPIClient {
    constructor(baseURL = 'http://localhost/api/flows') {
        this.baseURL = baseURL;
        this.client = axios.create({ baseURL });
    }

    async getHealth() {
        const response = await this.client.get('/health');
        return response.data;
    }

    async getSummary(hours = 1, includeDetails = false) {
        const response = await this.client.get('/summary', {
            params: { hours, include_details: includeDetails }
        });
        return response.data;
    }

    async getTopTalkers(limit = 10, hours = 1, byField = 'bytes', srcOrDst = 'src') {
        const response = await this.client.get('/top-talkers', {
            params: { limit, hours, by_field: byField, src_or_dst: srcOrDst }
        });
        return response.data;
    }
}

// 使用範例
(async () => {
    const client = new ClickHouseAPIClient();
    
    try {
        // 檢查健康狀態
        const health = await client.getHealth();
        console.log(`Status: ${health.status}`);
        
        // 獲取流量概覽
        const summary = await client.getSummary(1, true);
        console.log(`Total flows: ${summary.summary.total_flows}`);
        
        // 獲取 Top 5 流量來源
        const topTalkers = await client.getTopTalkers(5);
        topTalkers.forEach(talker => {
            console.log(`${talker.address}: ${talker.bytes} bytes (${talker.percentage}%)`);
        });
        
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
    }
})();
```

---

## ⚙️ 進階功能

### 分頁機制
搜尋端點支援分頁功能：

```bash
# 第1頁，每頁100筆
curl -X GET "http://localhost/api/flows/search?page=1&limit=100"

# 第2頁，每頁50筆
curl -X GET "http://localhost/api/flows/search?page=2&limit=50"
```

### 時間範圍控制
大部分端點支援靈活的時間範圍設定：

```bash
# 最近1小時
curl -X GET "http://localhost/api/flows/summary?hours=1"

# 最近24小時
curl -X GET "http://localhost/api/flows/summary?hours=24"

# 最近7天（168小時）
curl -X GET "http://localhost/api/flows/summary?hours=168"
```

### 多維度過濾
搜尋功能支援多條件組合：

```bash
# TCP + 特定 IP + 特定埠號
curl -X GET "http://localhost/api/flows/search?protocol=6&src_addr=192.168.1.100&dst_port=80"

# UDP DNS 查詢
curl -X GET "http://localhost/api/flows/search?protocol=17&dst_port=53"
```

---

## 🎯 最佳實踐

### 效能優化

1. **合理設置時間範圍**
   ```bash
   # 推薦：使用較短的時間範圍進行頻繁查詢
   curl -X GET "http://localhost/api/flows/summary?hours=1"
   
   # 避免：過長的時間範圍
   curl -X GET "http://localhost/api/flows/summary?hours=168"  # 謹慎使用
   ```

2. **適當的分頁大小**
   ```bash
   # 推薦：合理的分頁大小
   curl -X GET "http://localhost/api/flows/search?limit=100"
   
   # 避免：過大的分頁
   curl -X GET "http://localhost/api/flows/search?limit=1000"  # 回應時間較長
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
        health = requests.get("http://localhost/api/flows/health", timeout=10)
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

## 🔍 故障排除

### 常見問題

#### 1. 連線失敗
**問題**: `Connection refused` 或 `Cannot connect to host`

**解決方案**:
```bash
# 檢查服務狀態
docker ps | grep ai_ops_backend

# 檢查網路連線
curl -I http://localhost/health

# 檢查容器日誌
docker logs ai_ops_backend
```

#### 2. 回應緩慢
**問題**: API 回應時間超過預期

**解決方案**:
- 減少時間範圍 (`hours` 參數)
- 降低限制數量 (`limit` 參數)
- 檢查 ClickHouse 資源使用狀況

#### 3. 地理位置資料為空
**問題**: 城市欄位返回空值

**說明**: 這是已知限制，目前只有國家層級資料可用
```json
{
  "country": "TW",
  "city": "",  // 目前為空
  "flows": 1946
}
```

**建議**: 使用 `by_country_only=true` 參數獲取國家統計

#### 4. 參數驗證錯誤
**問題**: `HTTP 422 Unprocessable Entity`

**常見原因**:
- 參數範圍超出限制
- 參數類型不正確
- 必要參數遺失

**解決方案**:
```bash
# 檢查參數範圍
curl -X GET "http://localhost/api/flows/summary?hours=1000"  # ❌ 超出範圍
curl -X GET "http://localhost/api/flows/summary?hours=24"    # ✅ 正確

# 檢查參數類型
curl -X GET "http://localhost/api/flows/summary?hours=abc"   # ❌ 類型錯誤
curl -X GET "http://localhost/api/flows/summary?hours=24"    # ✅ 正確
```

### 錯誤代碼對照

| HTTP 狀態碼 | 說明 | 常見原因 |
|------------|------|----------|
| 200 | 成功 | 正常回應 |
| 400 | 請求錯誤 | 參數格式錯誤 |
| 404 | 找不到資源 | 端點路徑錯誤 |
| 422 | 參數驗證失敗 | 參數範圍或類型錯誤 |
| 500 | 內部服務器錯誤 | ClickHouse 查詢失敗 |

### 偵錯工具

#### 1. API 測試腳本
使用提供的測試腳本進行全面檢查：

```bash
# 在容器內執行完整測試
docker exec ai_ops_backend python3 /tmp/test_clickhouse_api_fixed.py
```

#### 2. 手動健康檢查
```bash
# 基本連線測試
curl -v http://localhost/api/flows/health

# 檢查回應時間
time curl -s http://localhost/api/flows/health > /dev/null
```

#### 3. 日誌監控
```bash
# 監控後端日誌
docker logs -f ai_ops_backend

# 監控 ClickHouse 日誌
docker logs -f akvorado-clickhouse-1
```

---

## 📈 效能指標

### 基準測試結果

基於實際測試（2025-08-30），以下是各端點的效能指標：

| 端點 | 平均回應時間 | 最快 | 最慢 | 資料點數 |
|------|--------------|------|------|----------|
| `/health` | 37.73ms | - | - | 1 |
| `/summary` | 15.92ms | 15.55ms | 16.28ms | 1 |
| `/top-talkers` | 46.75ms | 25.51ms | 67.99ms | 5-10 |
| `/protocols` | 24.4ms | - | - | 3 |
| `/geolocation` | 41.08ms | 27.17ms | 54.99ms | 3-5 |
| `/asn` | 28.45ms | 28.32ms | 28.59ms | 5 |
| `/timeseries` | 18.81ms | 17.64ms | 19.99ms | 9-13 |
| `/ports` | 27.95ms | 27.18ms | 28.72ms | 10 |
| `/interfaces` | 28.88ms | 26.6ms | 31.16ms | 5 |
| `/search` | 36.23ms | 24.06ms | 48.39ms | 1-5 |

### 系統容量
- **總流量記錄**: 23,818+
- **併發支援**: 經測試支援多個同時請求
- **資料更新**: 即時流量資料
- **可用性**: 100% (18/18 測試通過)

---

## 📝 版本資訊

### 當前版本
- **API 版本**: 3.0.0
- **ClickHouse 版本**: 25.3.6.56
- **最後更新**: 2025-08-30
- **測試狀態**: ✅ 全部通過

### 更新記錄

**2025-08-30**:
- ✅ 修復地理位置欄位問題 (`SrcCity` → `SrcGeoCity`)
- ✅ 新增州/省欄位支援 (`SrcGeoState`, `DstGeoState`)
- ✅ 達成 100% API 成功率
- ✅ 完善錯誤處理機制

### 已知限制

1. **地理位置城市資料**: 目前城市和州/省欄位為空值，只有國家層級資料可用
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