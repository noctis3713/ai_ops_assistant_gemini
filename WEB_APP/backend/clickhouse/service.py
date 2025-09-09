#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse 網路流量分析服務

提供網路流量統計與分析功能：
- 流量總覽與統計
- Top-N 分析
- 地理位置與 ASN 分析
- 時間序列分析
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union

from .client import ClickHouseQueryError, get_clickhouse_client
from .models import (
    ASNStats,
    FlowSummary,
    GeolocationStats,
    HealthCheckResponse,
    InterfaceStats,
    PaginationParams,
    PortStats,
    QueryResponse,
    SortOrder,
    TimeSeriesData,
    TopProtocol,
    TopTalker,
    TrafficAnalysisReport,
)

logger = logging.getLogger(__name__)


class ClickHouseService:
    """ClickHouse 網路流量分析服務"""

    def __init__(self):
        """初始化服務"""
        self.client = get_clickhouse_client()
        logger.info("ClickHouse 服務初始化完成")

    def get_flow_summary(
        self, hours: int = 24, include_details: bool = True
    ) -> Union[FlowSummary, Dict[str, Any]]:
        """取得流量概覽統計"""
        start_time = time.time()

        try:
            query = """
            SELECT 
                count() as total_flows,
                sum(Bytes) as total_bytes,
                sum(Packets) as total_packets,
                min(TimeReceived) as time_range_start,
                max(TimeReceived) as time_range_end,
                max(TimeReceived) - min(TimeReceived) as duration_seconds
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
            """

            parameters = {"hours": hours}
            result = self.client.execute_query(query, parameters)

            if not result:
                # 如果沒有資料，返回空統計
                return FlowSummary(
                    total_flows=0,
                    total_bytes=0,
                    total_packets=0,
                    time_range_start=datetime.now() - timedelta(hours=hours),
                    time_range_end=datetime.now(),
                    duration_seconds=hours * 3600,
                )

            data = result[0]

            # 建立 FlowSummary 物件
            summary = FlowSummary(
                total_flows=data["total_flows"],
                total_bytes=data["total_bytes"],
                total_packets=data["total_packets"],
                time_range_start=data["time_range_start"],
                time_range_end=data["time_range_end"],
                duration_seconds=int(data["duration_seconds"]),
            )

            execution_time = (time.time() - start_time) * 1000
            logger.info(f"流量概覽查詢完成，耗時 {execution_time:.2f}ms")

            if include_details:
                return {
                    "summary": summary,
                    "execution_time_ms": execution_time,
                    "query_parameters": parameters,
                }

            return summary

        except Exception as e:
            logger.error(f"獲取流量概覽失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取流量概覽失敗: {e}")

    def _get_total_bytes_in_range(self, hours: int) -> int:
        """
        獲取指定時間範圍內的總位元組數（用於百分比計算）

        Args:
            hours: 統計時間範圍（小時）

        Returns:
            int: 總位元組數

        Raises:
            ClickHouseQueryError: 查詢失敗時拋出
        """
        try:
            query = """
            SELECT sum(Bytes) as total_bytes
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
            """

            parameters = {"hours": hours}
            result = self.client.execute_query(query, parameters)

            if not result or not result[0]["total_bytes"]:
                logger.warning(f"查詢時間範圍內無資料或總位元組數為空: {hours} 小時")
                return 0

            return int(result[0]["total_bytes"])

        except Exception as e:
            logger.error(f"獲取總位元組數失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取總位元組數失敗: {e}")

    def _get_total_packets_in_range(self, hours: int) -> int:
        """
        獲取指定時間範圍內的總封包數（用於百分比計算）

        Args:
            hours: 統計時間範圍（小時）

        Returns:
            int: 總封包數

        Raises:
            ClickHouseQueryError: 查詢失敗時拋出
        """
        try:
            query = """
            SELECT sum(Packets) as total_packets
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
            """

            parameters = {"hours": hours}
            result = self.client.execute_query(query, parameters)

            if not result or not result[0]["total_packets"]:
                logger.warning(f"查詢時間範圍內無資料或總封包數為空: {hours} 小時")
                return 0

            return int(result[0]["total_packets"])

        except Exception as e:
            logger.error(f"獲取總封包數失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取總封包數失敗: {e}")

    def get_top_talkers(
        self,
        limit: int = 10,
        hours: int = 1,
        by_field: str = "bytes",
        src_or_dst: str = "src",
    ) -> List[TopTalker]:
        """
        獲取 Top N 流量來源或目的地

        Args:
            limit: 返回前 N 筆記錄
            hours: 統計時間範圍（小時）
            by_field: 排序欄位 ('bytes', 'packets', 'flows')
            src_or_dst: 統計來源或目的地 ('src', 'dst')

        Returns:
            List[TopTalker]: Top N 流量來源/目的地列表
        """
        try:
            # 獲取總位元組數用於百分比計算
            total_bytes = self._get_total_bytes_in_range(hours)

            addr_field = "SrcAddr" if src_or_dst == "src" else "DstAddr"

            query = f"""
            SELECT 
                toString({addr_field}) as address,
                sum(Bytes) as bytes,
                sum(Packets) as packets,
                count() as flows
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {{hours:UInt32}} HOUR
            GROUP BY {addr_field}
            ORDER BY {by_field} DESC
            LIMIT {{limit:UInt32}}
            """

            parameters = {"limit": limit, "hours": hours}
            results = self.client.execute_query(query, parameters)

            # 在 Python 層計算百分比
            top_talkers = []
            for result in results:
                percentage = (
                    (result["bytes"] / total_bytes * 100) if total_bytes > 0 else 0.0
                )
                top_talkers.append(
                    TopTalker(
                        address=result["address"],
                        bytes=result["bytes"],
                        packets=result["packets"],
                        flows=result["flows"],
                        percentage=round(percentage, 2),
                    )
                )

            return top_talkers

        except Exception as e:
            logger.error(f"獲取 Top Talkers 失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取 Top Talkers 失敗: {e}")

    def get_protocol_distribution(
        self, hours: int = 1, limit: int = 10
    ) -> List[TopProtocol]:
        """
        獲取協定分佈統計

        Args:
            hours: 統計時間範圍（小時）
            limit: 返回前 N 個協定

        Returns:
            List[TopProtocol]: 協定統計列表
        """
        try:
            # 獲取總位元組數用於百分比計算
            total_bytes = self._get_total_bytes_in_range(hours)

            query = """
            SELECT
                Proto as protocol_number,
                '' as protocol_name,
                count() as flows,
                sum(Bytes) as bytes,
                sum(Packets) as packets
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
            GROUP BY Proto
            ORDER BY bytes DESC
            LIMIT {limit:UInt32}
            """

            parameters = {"hours": hours, "limit": limit}
            results = self.client.execute_query(query, parameters)

            # 在 Python 層計算百分比
            protocols = []
            for result in results:
                percentage = (
                    (result["bytes"] / total_bytes * 100) if total_bytes > 0 else 0.0
                )
                protocols.append(
                    TopProtocol(
                        protocol_number=result["protocol_number"],
                        protocol_name=result["protocol_name"],
                        flows=result["flows"],
                        bytes=result["bytes"],
                        packets=result["packets"],
                        percentage=round(percentage, 2),
                    )
                )

            return protocols

        except Exception as e:
            logger.error(f"獲取協定分佈失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取協定分佈失敗: {e}")

    def get_geolocation_stats(
        self, hours: int = 1, limit: int = 10, by_country_only: bool = False
    ) -> List[GeolocationStats]:
        """
        獲取地理位置流量統計（城市級智能退回版）

        Args:
            hours: 統計時間範圍（小時）
            limit: 返回前 N 個位置  
            by_country_only: 是否只按國家統計（預設False，優先使用城市級資料）

        Returns:
            List[GeolocationStats]: 地理位置統計列表
        """
        try:
            # 獲取總位元組數用於百分比計算
            query_total = """
            SELECT sum(Bytes) as total_bytes
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
            """
            parameters = {"hours": hours, "limit": limit}
            total_result = self.client.execute_query(query_total, parameters)
            total_bytes = (
                int(total_result[0]["total_bytes"])
                if total_result and total_result[0]["total_bytes"]
                else 0
            )

            if by_country_only:
                # 只顯示國家級資料
                query = """
                SELECT
                    SrcCountry as country,
                    NULL as city,
                    NULL as state,
                    'country' as granularity,
                    count() as flows,
                    sum(Bytes) as bytes,
                    sum(Packets) as packets,
                    uniq(SrcAddr) as unique_ips
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
                  AND SrcCountry <> ''
                GROUP BY SrcCountry
                ORDER BY bytes DESC
                LIMIT {limit:UInt32}
                """
            else:
                # 智能地理分析：城市優先，退回國家
                query = """
                SELECT 
                    SrcCountry as country,
                    CASE WHEN SrcGeoCity <> '' THEN SrcGeoCity ELSE NULL END as city,
                    CASE WHEN SrcGeoState <> '' THEN SrcGeoState ELSE NULL END as state,
                    CASE 
                        WHEN SrcGeoCity <> '' THEN 'city'
                        WHEN SrcCountry <> '' THEN 'country'
                        ELSE 'unknown'
                    END as granularity,
                    COUNT(*) as flows,
                    SUM(Bytes) as bytes,
                    SUM(Packets) as packets,
                    uniq(SrcAddr) as unique_ips
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
                GROUP BY country, city, state, granularity
                ORDER BY bytes DESC
                LIMIT {limit:UInt32}
                """

            results = self.client.execute_query(query, parameters)

            # 在 Python 層計算百分比和建立物件
            geo_stats = []
            for result in results:
                percentage = (
                    (result["bytes"] / total_bytes * 100) if total_bytes > 0 else 0.0
                )
                geo_stats.append(
                    GeolocationStats(
                        country=result["country"] or "",
                        city=result["city"],
                        state=result["state"],
                        granularity=result.get("granularity", "unknown"),
                        flows=result["flows"],
                        bytes=result["bytes"],
                        packets=result["packets"],
                        unique_ips=result.get("unique_ips", 0),
                        percentage=round(percentage, 2),
                    )
                )

            return geo_stats

        except Exception as e:
            logger.error(f"獲取地理位置統計失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取地理位置統計失敗: {e}")

    def get_asn_analysis(
        self, hours: int = 1, limit: int = 10, src_or_dst: str = "src"
    ) -> List[ASNStats]:
        """
        獲取 ASN 自治系統分析

        Args:
            hours: 統計時間範圍（小時）
            limit: 返回前 N 個 ASN
            src_or_dst: 分析來源或目的 ASN ('src', 'dst')

        Returns:
            List[ASNStats]: ASN 統計列表
        """
        try:
            asn_field = "SrcAS" if src_or_dst == "src" else "DstAS"
            addr_field = "SrcAddr" if src_or_dst == "src" else "DstAddr"

            # 獲取有 ASN 資料的總位元組數用於百分比計算
            query_total = f"""
            SELECT sum(Bytes) as total_bytes
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {{hours:UInt32}} HOUR
              AND {asn_field} != 0
            """
            parameters = {"hours": hours}
            total_result = self.client.execute_query(query_total, parameters)
            total_bytes = (
                int(total_result[0]["total_bytes"])
                if total_result and total_result[0]["total_bytes"]
                else 0
            )

            query = f"""
            SELECT
                {asn_field} as asn,
                '' as asn_name,
                count() as flows,
                sum(Bytes) as bytes,
                sum(Packets) as packets,
                uniq({addr_field}) as unique_ips
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {{hours:UInt32}} HOUR
              AND {asn_field} != 0
            GROUP BY {asn_field}
            ORDER BY bytes DESC
            LIMIT {{limit:UInt32}}
            """

            parameters = {"hours": hours, "limit": limit}
            results = self.client.execute_query(query, parameters)

            # 在 Python 層計算百分比
            asn_stats = []
            for result in results:
                percentage = (
                    (result["bytes"] / total_bytes * 100) if total_bytes > 0 else 0.0
                )
                asn_stats.append(
                    ASNStats(
                        asn=result["asn"],
                        asn_name=result["asn_name"],
                        flows=result["flows"],
                        bytes=result["bytes"],
                        packets=result["packets"],
                        percentage=round(percentage, 2),
                        unique_ips=result["unique_ips"],
                    )
                )

            return asn_stats

        except Exception as e:
            logger.error(f"獲取 ASN 分析失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取 ASN 分析失敗: {e}")

    def get_time_series_data(
        self, hours: int = 24, interval_minutes: int = 5
    ) -> List[TimeSeriesData]:
        """
        獲取時間序列流量資料

        Args:
            hours: 統計時間範圍（小時）
            interval_minutes: 時間間隔（分鐘）

        Returns:
            List[TimeSeriesData]: 時間序列資料列表
        """
        try:
            query = """
            SELECT
                toStartOfInterval(TimeReceived, INTERVAL {interval:UInt32} MINUTE) as timestamp,
                count() as flows,
                sum(Bytes) as bytes,
                sum(Packets) as packets,
                uniq(SrcAddr) as unique_src_ips,
                uniq(DstAddr) as unique_dst_ips
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
            GROUP BY timestamp
            ORDER BY timestamp
            """

            parameters = {"hours": hours, "interval": interval_minutes}
            results = self.client.execute_query(query, parameters)

            return [TimeSeriesData(**result) for result in results]

        except Exception as e:
            logger.error(f"獲取時間序列資料失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取時間序列資料失敗: {e}")



    def get_health_status(self) -> HealthCheckResponse:
        """
        獲取 ClickHouse 健康狀態

        Returns:
            HealthCheckResponse: 健康檢查回應
        """
        try:
            health_info = self.client.test_connection()
            return HealthCheckResponse(**health_info)

        except Exception as e:
            logger.error(f"健康檢查失敗: {e}", exc_info=True)
            return HealthCheckResponse(
                status="error", database="akvorado", error=str(e)
            )


    def get_traffic_analysis(self, days: int = 3, device: Optional[str] = None) -> TrafficAnalysisReport:
        """執行網路流量分析"""
        start_time = time.time()
        
        try:
            parameters = {"days": days, "device": device or ""}
            
            # 1. 流量總覽統計
            overview_results = self.client.execute_query("""
            SELECT 
                COUNT(*) as total_flows,
                SUM(Bytes) as total_bytes,
                SUM(Packets) as total_packets,
                min(TimeReceived) as time_range_start,
                max(TimeReceived) as time_range_end,
                max(TimeReceived) - min(TimeReceived) as duration_seconds
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
              AND ({device:String} = '' OR ExporterName = {device:String})
            """, parameters)
            
            # 執行基本查詢並計算百分比（內存優化）
            logger.info(f"開始執行流量分析查詢 - {days} 天範圍")
            
            # 獲取總流量用於百分比計算
            if overview_results and overview_results[0]:
                total_bytes = overview_results[0]["total_bytes"] or 0
            else:
                total_bytes = 0
            
            # 2. Top 10 流量來源
            top_sources_results = self.client.execute_query("""
            SELECT 
                IPv6NumToString(SrcAddr) as address,
                COUNT(*) as flows,
                SUM(Bytes) as bytes,
                SUM(Packets) as packets
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
              AND ({device:String} = '' OR ExporterName = {device:String})
            GROUP BY SrcAddr
            ORDER BY bytes DESC
            LIMIT 10
            """, parameters)
            
            # 3. Top 10 流量目的地
            top_destinations_results = self.client.execute_query("""
            SELECT 
                IPv6NumToString(DstAddr) as address,
                COUNT(*) as flows,
                SUM(Bytes) as bytes,
                SUM(Packets) as packets
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
              AND ({device:String} = '' OR ExporterName = {device:String})
            GROUP BY DstAddr
            ORDER BY bytes DESC
            LIMIT 10
            """, parameters)
            
            # 4. Top 10 協議及應用程式分布
            protocols_results = self.client.execute_query("""
            SELECT 
                Proto as protocol_number,
                CASE 
                    WHEN Proto = 1 THEN 'ICMP'
                    WHEN Proto = 6 THEN 'TCP'
                    WHEN Proto = 17 THEN 'UDP'
                    WHEN Proto = 47 THEN 'GRE'
                    WHEN Proto = 50 THEN 'ESP'
                    WHEN Proto = 51 THEN 'AH'
                    WHEN Proto = 89 THEN 'OSPF'
                    WHEN Proto = 132 THEN 'SCTP'
                    WHEN Proto = 41 THEN 'IPv6-in-IPv4'
                    WHEN Proto = 2 THEN 'IGMP'
                    ELSE concat('Protocol-', toString(Proto))
                END as protocol_name,
                COUNT(*) as flows,
                SUM(Bytes) as bytes,
                SUM(Packets) as packets
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
              AND ({device:String} = '' OR ExporterName = {device:String})
            GROUP BY Proto
            ORDER BY bytes DESC
            LIMIT 10
            """, parameters)
            
            # 每日趨勢
            daily_trends_results = self.client.execute_query("""
            SELECT 
                toDate(TimeReceived) as date,
                COUNT(*) as flows,
                SUM(Bytes) as bytes,
                SUM(Packets) as packets,
                round(SUM(Bytes) / 1024 / 1024, 2) as bytes_mb
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
              AND ({device:String} = '' OR ExporterName = {device:String})
            GROUP BY date
            ORDER BY date
            """, parameters)
            
            # 24小時模式
            hourly_patterns_results = self.client.execute_query("""
            SELECT 
                toHour(TimeReceived) as hour,
                COUNT(*) as flows,
                SUM(Bytes) as bytes,
                SUM(Packets) as packets,
                round(SUM(Bytes) / 1024 / 1024, 2) as bytes_mb
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
              AND ({device:String} = '' OR ExporterName = {device:String})
            GROUP BY hour
            ORDER BY hour
            """, parameters)
            
            # 地理位置分析
            geo_results = self.client.execute_query("""
            WITH country_city_check AS (
                SELECT 
                    SrcCountry,
                    countIf(SrcGeoCity <> '') as has_city_data,
                    count(*) as total_flows
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
                  AND SrcCountry <> ''
                  AND ({device:String} = '' OR ExporterName = {device:String})
                GROUP BY SrcCountry
            ),
            location_data AS (
                SELECT 
                    CASE 
                        WHEN SrcCountry <> '' THEN SrcCountry
                        ELSE 'Unknown'
                    END as country,
                    CASE 
                        WHEN SrcGeoCity <> '' THEN SrcGeoCity
                        ELSE NULL
                    END as city,
                    CASE 
                        WHEN SrcGeoState <> '' THEN SrcGeoState
                        ELSE NULL
                    END as state,
                    CASE 
                        WHEN SrcGeoCity <> '' THEN 'city'
                        WHEN SrcGeoState <> '' AND SrcGeoCity = '' THEN 'state'
                        WHEN SrcCountry <> '' THEN 'country'
                        ELSE 'unknown'
                    END as granularity,
                    COUNT(*) as flows,
                    SUM(Bytes) as bytes,
                    SUM(Packets) as packets,
                    uniq(SrcAddr) as unique_ips
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY
                  AND ({device:String} = '' OR ExporterName = {device:String})
                GROUP BY country, city, state, granularity
            )
            SELECT 
                country,
                city,
                state,
                granularity,
                flows,
                bytes,
                packets,
                unique_ips
            FROM location_data l
            WHERE 
                -- 顯示城市級資料
                granularity = 'city'
                OR granularity = 'state' 
                OR granularity = 'unknown'
                -- 只有在該國家完全沒有城市資料時才顯示國家級
                OR (granularity = 'country' AND country NOT IN (
                    SELECT DISTINCT country 
                    FROM location_data 
                    WHERE granularity IN ('city', 'state')
                ))
            ORDER BY bytes DESC
            LIMIT 15
            """, parameters)
            
            # Top 10 ASN 分析（含組織名稱）
            asn_results = self.client.execute_query("""
            SELECT 
                SrcAS as asn,
                dictGet('asns', 'name', SrcAS) as asn_name,
                COUNT(*) as flows,
                SUM(Bytes) as bytes,
                SUM(Packets) as packets,
                uniq(SrcAddr) as unique_ips
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {days:UInt32} DAY AND SrcAS != 0
              AND ({device:String} = '' OR ExporterName = {device:String})
            GROUP BY SrcAS
            ORDER BY bytes DESC
            LIMIT 10
            """, parameters)
            
            # 處理查詢結果並計算百分比
            execution_time = (time.time() - start_time) * 1000
            
            return self._build_optimized_report(
                days, total_bytes,
                overview_results, top_sources_results, top_destinations_results,
                protocols_results, 
                daily_trends_results, hourly_patterns_results,
                geo_results, asn_results,
                execution_time
            )
            
        except Exception as e:
            logger.error(f"流量分析失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"流量分析執行失敗: {e}")
    
    def _build_optimized_report(self, days, total_bytes, overview_results, 
                              top_sources_results, top_destinations_results,
                              protocols_results,
                              daily_trends_results, hourly_patterns_results,
                              geo_results, asn_results,
                              execution_time) -> TrafficAnalysisReport:
        """構建流量分析報告"""
        
        # 處理總覽資料
        overview_data = None
        if overview_results:
            row = overview_results[0]
            overview_data = FlowSummary(
                total_flows=row["total_flows"],
                total_bytes=row["total_bytes"],
                total_packets=row["total_packets"],
                time_range_start=row["time_range_start"],
                time_range_end=row["time_range_end"],
                duration_seconds=row["duration_seconds"]
            )
        
        # 計算百分比
        def calculate_percentage(bytes_value, total):
            return round((bytes_value / total * 100) if total > 0 else 0, 2)
            
        # 處理各項結果
        top_sources = [TopTalker(
            address=row["address"], flows=row["flows"], bytes=row["bytes"],
            packets=row["packets"], percentage=calculate_percentage(row["bytes"], total_bytes)
        ) for row in top_sources_results]
        
        top_destinations = [TopTalker(
            address=row["address"], flows=row["flows"], bytes=row["bytes"],
            packets=row["packets"], percentage=calculate_percentage(row["bytes"], total_bytes)
        ) for row in top_destinations_results]
        
        protocol_distribution = [TopProtocol(
            protocol_number=row["protocol_number"], protocol_name=row["protocol_name"],
            flows=row["flows"], bytes=row["bytes"], packets=row["packets"],
            percentage=calculate_percentage(row["bytes"], total_bytes)
        ) for row in protocols_results]
        
        # 地理位置分析
        geographic_distribution = [GeolocationStats(
            country=row["country"], 
            city=row.get("city", None),
            state=row.get("state", None),
            granularity=row.get("granularity", "unknown"),
            flows=row["flows"], 
            bytes=row["bytes"], 
            packets=row["packets"],
            unique_ips=row.get("unique_ips", 0),
            percentage=calculate_percentage(row["bytes"], total_bytes)
        ) for row in geo_results]
        
        # ASN 分析
        asn_analysis = [ASNStats(
            asn=row["asn"], asn_name=row.get("asn_name", ""),
            flows=row["flows"], bytes=row["bytes"], packets=row["packets"],
            percentage=calculate_percentage(row["bytes"], total_bytes),
            unique_ips=row["unique_ips"]
        ) for row in asn_results]
        
        # 時間趨勢
        daily_trends = [{
            "date": row["date"].strftime("%Y-%m-%d"),
            "flows": row["flows"], "bytes": row["bytes"],
            "packets": row["packets"], "bytes_mb": row["bytes_mb"]
        } for row in daily_trends_results]
        
        hourly_patterns = [{
            "hour": row["hour"], "flows": row["flows"], 
            "bytes": row["bytes"], "packets": row["packets"], "bytes_mb": row["bytes_mb"]
        } for row in hourly_patterns_results]
        
        # 生成分析摘要
        key_findings = self._generate_enhanced_key_findings(
            overview_data, top_sources, top_destinations, protocol_distribution,
            geographic_distribution, asn_analysis
        )
        anomalies = self._detect_enhanced_anomalies(
            overview_data, top_sources, daily_trends
        )
        
        return TrafficAnalysisReport(
            period_days=days,
            time_range={
                "start": overview_data.time_range_start if overview_data else datetime.now() - timedelta(days=days),
                "end": overview_data.time_range_end if overview_data else datetime.now()
            },
            overview=overview_data or FlowSummary(
                total_flows=0, total_bytes=0, total_packets=0,
                time_range_start=datetime.now() - timedelta(days=days),
                time_range_end=datetime.now(), duration_seconds=days * 86400
            ),
            top_sources=top_sources,
            top_destinations=top_destinations,
            protocol_distribution=protocol_distribution,
            geographic_distribution=geographic_distribution,
            asn_analysis=asn_analysis,
            daily_trends=daily_trends,
            hourly_patterns=hourly_patterns,
            key_findings=key_findings,
            anomalies=anomalies,
            query_time_ms=execution_time
        )
            

    def _generate_enhanced_key_findings(
        self, 
        overview: Optional[FlowSummary], 
        top_sources: List[TopTalker],
        top_destinations: List[TopTalker],
        protocols: List[TopProtocol],
        geographic_distribution: List[GeolocationStats],
        asn_analysis: List[ASNStats]
    ) -> List[str]:
        """生成關鍵發現"""
        findings = []
        
        if not overview or not top_sources:
            return ["無足夠資料進行分析"]
            
        # 1. 基本流量統計
        total_gb = overview.total_bytes / (1024**3)
        total_mbps = (overview.total_bytes * 8) / (1024**2) / overview.duration_seconds if overview.duration_seconds > 0 else 0
        findings.append(f"總流量: {overview.total_flows:,} 筆記錄，{total_gb:.2f} GB，平均 {total_mbps:.1f} Mbps")
        
        # 2. 流量來源分析
        if top_sources:
            top_source = top_sources[0]
            findings.append(f"最大流量來源: {top_source.address} ({top_source.percentage:.1f}%，{top_source.bytes/(1024**2):.0f} MB)")
            
        if top_destinations:
            top_dest = top_destinations[0]
            findings.append(f"最大流量目的: {top_dest.address} ({top_dest.percentage:.1f}%，{top_dest.bytes/(1024**2):.0f} MB)")
            
        # 3. 協議分布分析
        if protocols:
            tcp_pct = next((p.percentage for p in protocols if p.protocol_name == "TCP"), 0)
            udp_pct = next((p.percentage for p in protocols if p.protocol_name == "UDP"), 0)
            icmp_pct = next((p.percentage for p in protocols if p.protocol_name == "ICMP"), 0)
            findings.append(f"協議分布: TCP {tcp_pct:.1f}%, UDP {udp_pct:.1f}%, ICMP {icmp_pct:.1f}%")
            
        # 4. 地理位置分析
        if geographic_distribution:
            top_country = geographic_distribution[0]
            total_countries = len(geographic_distribution)
            findings.append(f"地理分布: 來自 {total_countries} 個國家/地區，主要來源 {top_country.country} ({top_country.percentage:.1f}%)")
            
        # 5. ASN 分析
        if asn_analysis:
            top_asn = asn_analysis[0]
            total_asns = len(asn_analysis)
            findings.append(f"ASN 分析: {total_asns} 個自治系統，主要來源 AS{top_asn.asn} ({top_asn.percentage:.1f}%，{top_asn.unique_ips} 個 IP)")
            
        # 6. 流量模式
        avg_bytes_per_flow = overview.total_bytes / overview.total_flows if overview.total_flows > 0 else 0
        avg_packets_per_flow = overview.total_packets / overview.total_flows if overview.total_flows > 0 else 0
        findings.append(f"流量模式: 平均每流量 {avg_bytes_per_flow:.0f} 位元組，{avg_packets_per_flow:.1f} 封包")
            
        return findings[:15]  # 限制最多15個發現
    
    def _detect_enhanced_anomalies(
        self,
        overview: Optional[FlowSummary],
        top_sources: List[TopTalker],
        daily_trends: List[Dict]
    ) -> List[str]:
        """檢測異常流量"""
        anomalies = []
        
        # 1. 流量集中度異常
        if top_sources:
            if top_sources[0].percentage > 50:
                anomalies.append(f"⚠️ 流量高度集中: {top_sources[0].address} 占 {top_sources[0].percentage:.1f}% (超過50%)")
            
            # 檢查前3名流量來源是否佔比過高
            if len(top_sources) >= 3:
                top3_total = sum(source.percentage for source in top_sources[:3])
                if top3_total > 80:
                    anomalies.append(f"⚠️ 前3名來源流量集中: 總計 {top3_total:.1f}% (超過80%)")
                    
        # 2. 每日流量異常
        if len(daily_trends) > 1:
            bytes_values = [day["bytes"] for day in daily_trends]
            if bytes_values:
                avg_bytes = sum(bytes_values) / len(bytes_values)
                max_bytes = max(bytes_values)
                min_bytes = min(bytes_values)
                
                # 檢測異常高流量日
                for day in daily_trends:
                    if day["bytes"] > avg_bytes * 3:
                        anomalies.append(f"🔴 異常高流量日: {day['date']} ({day['bytes_mb']:.0f} MB，超過平均值3倍)")
                        
                # 檢測異常低流量日  
                for day in daily_trends:
                    if day["bytes"] < avg_bytes * 0.1 and day["bytes"] > 0:
                        anomalies.append(f"🔵 異常低流量日: {day['date']} ({day['bytes_mb']:.0f} MB，低於平均值90%)")
                        
                # 檢測流量變化異常
                if max_bytes > min_bytes * 10 and min_bytes > 0:
                    anomalies.append(f"⚡ 流量波動異常: 最高與最低日流量比率超過 10:1")
                    
        # 3. 流量規模異常
        if overview:
            hourly_avg_flows = overview.total_flows / (overview.duration_seconds / 3600) if overview.duration_seconds > 0 else 0
            if hourly_avg_flows > 1000000:  # 每小時超過100萬條流量記錄
                anomalies.append(f"📊 超高流量密度: 每小時平均 {hourly_avg_flows:.0f} 條記錄")
                
        # 5. 協議異常（如果有的話）
        # 這裡可以添加更多協議相關的異常檢測
        
        return anomalies[:10]  # 限制最多10個異常

    def _generate_key_findings(
        self, 
        overview: Optional[FlowSummary], 
        top_sources: List[TopTalker],
        top_destinations: List[TopTalker],
        protocols: List[TopProtocol]
    ) -> List[str]:
        """生成關鍵發現（兼容舊方法）"""
        return self._generate_enhanced_key_findings(
            overview, top_sources, top_destinations, protocols, [], []
        )
    
    def _detect_anomalies(
        self,
        overview: Optional[FlowSummary],
        top_sources: List[TopTalker],
        daily_trends: List[Dict]
    ) -> List[str]:
        """檢測異常流量（兼容舊方法）"""
        return self._detect_enhanced_anomalies(overview, top_sources, daily_trends)


# 全域服務實例
_clickhouse_service: Optional[ClickHouseService] = None


def get_clickhouse_service() -> ClickHouseService:
    """
    獲取全域 ClickHouse 服務實例

    Returns:
        ClickHouseService: ClickHouse 服務實例
    """
    global _clickhouse_service
    if _clickhouse_service is None:
        _clickhouse_service = ClickHouseService()
    return _clickhouse_service
