#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse API 測試腳本（修正版）

修正了布林參數處理問題的完整測試腳本
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
import aiohttp
import logging

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

class ClickHouseAPITester:
    """ClickHouse API 測試器"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """初始化測試器
        
        Args:
            base_url: API 基礎 URL
        """
        self.base_url = base_url
        self.api_base = f"{base_url}/api/flows"
        self.session: Optional[aiohttp.ClientSession] = None
        self.results: List[Dict[str, Any]] = []
        
    async def __aenter__(self):
        """異步上下文管理器進入"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """異步上下文管理器退出"""
        if self.session:
            await self.session.close()
    
    def _prepare_params(self, params: Dict[str, Any]) -> Dict[str, str]:
        """準備查詢參數，將所有值轉換為字符串
        
        Args:
            params: 原始參數字典
            
        Returns:
            Dict: 字符串化的參數字典
        """
        if not params:
            return {}
        
        processed_params = {}
        for key, value in params.items():
            if isinstance(value, bool):
                processed_params[key] = "true" if value else "false"
            else:
                processed_params[key] = str(value)
        return processed_params
    
    async def test_endpoint(
        self, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None,
        description: str = ""
    ) -> Dict[str, Any]:
        """測試單個端點
        
        Args:
            endpoint: 端點路徑
            params: 查詢參數
            description: 測試描述
            
        Returns:
            Dict: 測試結果
        """
        url = f"{self.api_base}{endpoint}"
        processed_params = self._prepare_params(params)
        test_start = time.time()
        
        result = {
            "endpoint": endpoint,
            "description": description or endpoint,
            "url": url,
            "params": params or {},
            "success": False,
            "status_code": None,
            "response_time_ms": 0,
            "data": None,
            "error": None,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            logger.info(f"測試端點: {description or endpoint}")
            
            async with self.session.get(url, params=processed_params) as response:
                result["status_code"] = response.status
                result["response_time_ms"] = round((time.time() - test_start) * 1000, 2)
                
                if response.status == 200:
                    result["data"] = await response.json()
                    result["success"] = True
                    logger.info(f"✅ 測試成功: {endpoint} ({result['response_time_ms']}ms)")
                else:
                    result["error"] = f"HTTP {response.status}: {await response.text()}"
                    logger.error(f"❌ 測試失敗: {endpoint} - {result['error']}")
                    
        except Exception as e:
            result["response_time_ms"] = round((time.time() - test_start) * 1000, 2)
            result["error"] = str(e)
            logger.error(f"❌ 測試異常: {endpoint} - {str(e)}")
        
        self.results.append(result)
        return result
    
    async def test_all_endpoints(self) -> List[Dict[str, Any]]:
        """測試所有端點"""
        logger.info("開始執行完整的 ClickHouse API 測試")
        test_start = time.time()
        
        # 所有測試端點和參數
        test_cases = [
            {
                "endpoint": "/health",
                "params": {},
                "description": "ClickHouse 健康檢查"
            },
            {
                "endpoint": "/summary",
                "params": {"hours": 1, "include_details": True},
                "description": "流量概覽統計（包含詳細資訊）"
            },
            {
                "endpoint": "/summary",
                "params": {"hours": 24, "include_details": False},
                "description": "24小時流量概覽統計"
            },
            {
                "endpoint": "/top-talkers",
                "params": {"limit": 5, "hours": 1, "by_field": "bytes", "src_or_dst": "src"},
                "description": "Top 5 流量來源（按位元組）"
            },
            {
                "endpoint": "/top-talkers",
                "params": {"limit": 10, "hours": 1, "by_field": "packets", "src_or_dst": "dst"},
                "description": "Top 10 流量目的地（按封包）"
            },
            {
                "endpoint": "/protocols",
                "params": {"hours": 1, "limit": 10},
                "description": "協定流量分佈"
            },
            {
                "endpoint": "/geolocation",
                "params": {"hours": 1, "limit": 5, "by_country_only": True},
                "description": "地理位置統計（國家）"
            },
            {
                "endpoint": "/geolocation",
                "params": {"hours": 1, "limit": 3, "by_country_only": False},
                "description": "地理位置統計（國家+城市）"
            },
            {
                "endpoint": "/asn",
                "params": {"hours": 1, "limit": 5, "src_or_dst": "src"},
                "description": "來源 ASN 分析"
            },
            {
                "endpoint": "/asn",
                "params": {"hours": 1, "limit": 5, "src_or_dst": "dst"},
                "description": "目的 ASN 分析"
            },
            {
                "endpoint": "/timeseries",
                "params": {"hours": 2, "interval_minutes": 15},
                "description": "2小時時間序列（15分鐘間隔）"
            },
            {
                "endpoint": "/timeseries",
                "params": {"hours": 6, "interval_minutes": 30},
                "description": "6小時時間序列（30分鐘間隔）"
            },
            {
                "endpoint": "/ports",
                "params": {"hours": 1, "limit": 10, "src_or_dst": "dst"},
                "description": "目的埠號統計"
            },
            {
                "endpoint": "/ports",
                "params": {"hours": 1, "limit": 10, "src_or_dst": "src"},
                "description": "來源埠號統計"
            },
            {
                "endpoint": "/interfaces",
                "params": {"hours": 1, "limit": 5, "direction": "input"},
                "description": "輸入介面統計"
            },
            {
                "endpoint": "/interfaces",
                "params": {"hours": 1, "limit": 5, "direction": "output"},
                "description": "輸出介面統計"
            },
            {
                "endpoint": "/search",
                "params": {"hours": 1, "limit": 5, "page": 1},
                "description": "基本流量搜尋"
            },
            {
                "endpoint": "/search",
                "params": {"hours": 1, "limit": 10, "page": 1, "protocol": 6},
                "description": "TCP 流量搜尋"
            }
        ]
        
        # 依序執行所有測試
        for test_case in test_cases:
            await self.test_endpoint(**test_case)
            # 測試間隔，避免過度負載
            await asyncio.sleep(0.3)
        
        total_time = time.time() - test_start
        logger.info(f"所有測試完成，總耗時: {total_time:.2f}秒")
        
        return self.results
    
    def generate_comprehensive_report(self) -> Dict[str, Any]:
        """產生詳細測試報告"""
        if not self.results:
            return {"error": "沒有測試結果"}
        
        successful_tests = [r for r in self.results if r["success"]]
        failed_tests = [r for r in self.results if not r["success"]]
        
        total_response_time = sum(r["response_time_ms"] for r in self.results)
        avg_response_time = total_response_time / len(self.results) if self.results else 0
        
        # 按端點分組統計
        endpoint_stats = {}
        for result in self.results:
            endpoint = result["endpoint"]
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = {
                    "total_tests": 0,
                    "successful_tests": 0,
                    "failed_tests": 0,
                    "avg_response_time": 0,
                    "min_response_time": float('inf'),
                    "max_response_time": 0
                }
            
            stats = endpoint_stats[endpoint]
            stats["total_tests"] += 1
            
            if result["success"]:
                stats["successful_tests"] += 1
            else:
                stats["failed_tests"] += 1
            
            response_time = result["response_time_ms"]
            stats["min_response_time"] = min(stats["min_response_time"], response_time)
            stats["max_response_time"] = max(stats["max_response_time"], response_time)
        
        # 計算平均回應時間
        for endpoint, stats in endpoint_stats.items():
            endpoint_results = [r for r in successful_tests if r["endpoint"] == endpoint]
            if endpoint_results:
                stats["avg_response_time"] = round(
                    sum(r["response_time_ms"] for r in endpoint_results) / len(endpoint_results), 2
                )
            if stats["min_response_time"] == float('inf'):
                stats["min_response_time"] = 0
        
        report = {
            "test_overview": {
                "total_tests": len(self.results),
                "successful_tests": len(successful_tests),
                "failed_tests": len(failed_tests),
                "success_rate": round(len(successful_tests) / len(self.results) * 100, 2),
                "total_response_time_ms": round(total_response_time, 2),
                "average_response_time_ms": round(avg_response_time, 2),
                "test_timestamp": datetime.now().isoformat(),
                "test_base_url": self.base_url
            },
            "endpoint_statistics": endpoint_stats,
            "successful_tests": [
                {
                    "endpoint": r["endpoint"],
                    "description": r["description"],
                    "response_time_ms": r["response_time_ms"],
                    "data_points": len(r["data"]) if isinstance(r["data"], list) else 1 if r["data"] else 0,
                    "params": r["params"]
                }
                for r in successful_tests
            ],
            "failed_tests": [
                {
                    "endpoint": r["endpoint"],
                    "description": r["description"],
                    "error": r["error"],
                    "status_code": r["status_code"],
                    "params": r["params"]
                }
                for r in failed_tests
            ],
            "detailed_results": self.results
        }
        
        return report
    
    def print_detailed_summary(self):
        """列印詳細測試摘要"""
        report = self.generate_comprehensive_report()
        
        if "error" in report:
            print(f"❌ {report['error']}")
            return
        
        overview = report["test_overview"]
        
        print("\n" + "=" * 100)
        print("                        ClickHouse API 完整測試報告")
        print("=" * 100)
        print(f"測試時間: {overview['test_timestamp']}")
        print(f"測試 URL: {overview['test_base_url']}")
        print(f"總測試數: {overview['total_tests']}")
        print(f"成功測試: {overview['successful_tests']}")
        print(f"失敗測試: {overview['failed_tests']}")
        print(f"成功率: {overview['success_rate']}%")
        print(f"平均回應時間: {overview['average_response_time_ms']}ms")
        
        # 端點統計
        print(f"\n📊 端點統計:")
        print(f"{'端點':<20} {'成功/總數':<12} {'成功率':<8} {'平均回應時間':<12} {'最快':<8} {'最慢':<8}")
        print("-" * 80)
        for endpoint, stats in report["endpoint_statistics"].items():
            success_rate = round(stats["successful_tests"] / stats["total_tests"] * 100, 1)
            print(f"{endpoint:<20} {stats['successful_tests']}/{stats['total_tests']:<11} {success_rate}%{'':<4} "
                  f"{stats['avg_response_time']}ms{'':<6} {stats['min_response_time']}ms{'':<3} {stats['max_response_time']}ms")
        
        if report["successful_tests"]:
            print(f"\n✅ 成功的測試 ({len(report['successful_tests'])}個):")
            for test in report["successful_tests"]:
                data_info = f" ({test['data_points']} 個資料點)" if test['data_points'] > 0 else ""
                print(f"  • {test['description']} - {test['response_time_ms']}ms{data_info}")
        
        if report["failed_tests"]:
            print(f"\n❌ 失敗的測試 ({len(report['failed_tests'])}個):")
            for test in report["failed_tests"]:
                print(f"  • {test['description']}")
                print(f"    錯誤: {test['error']}")
        
        print("=" * 100)


async def main():
    """主函數"""
    print("🚀 開始 ClickHouse API 完整測試")
    
    # 在容器內部測試
    base_url = "http://localhost:8000"
    
    async with ClickHouseAPITester(base_url) as tester:
        # 執行所有測試
        await tester.test_all_endpoints()
        tester.print_detailed_summary()
        
        # 儲存詳細測試報告
        report = tester.generate_comprehensive_report()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"clickhouse_api_comprehensive_report_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f"\n📊 詳細測試報告已儲存: {filename}")
        
        # 顯示一些關鍵統計
        overview = report["test_overview"]
        if overview["success_rate"] >= 90:
            print(f"🎉 測試結果優秀！成功率: {overview['success_rate']}%")
        elif overview["success_rate"] >= 80:
            print(f"✅ 測試結果良好！成功率: {overview['success_rate']}%")
        else:
            print(f"⚠️  測試結果需要改進，成功率: {overview['success_rate']}%")


if __name__ == "__main__":
    asyncio.run(main())