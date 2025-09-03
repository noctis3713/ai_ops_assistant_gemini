#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse 業務邏輯服務層

提供 Akvorado 流量資料分析的高層次業務邏輯：
- 流量概覽統計分析
- Top-N 分析（來源IP、協定、埠號等）
- 地理位置分佈分析
- ASN 自治系統分析
- 時間序列趨勢分析
- 網路介面流量分析

Created: 2025-08-30
Author: Claude Code Assistant
"""

import logging
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, timedelta
import time

from .client import get_clickhouse_client, ClickHouseQueryError
from .models import (
    FlowSummary, TopTalker, TopProtocol, GeolocationStats,
    ASNStats, TimeSeriesData, PortStats, InterfaceStats,
    QueryResponse, ErrorResponse, HealthCheckResponse,
    PaginationParams, SortOrder
)

logger = logging.getLogger(__name__)


class ClickHouseService:
    """
    ClickHouse 業務邏輯服務類
    
    封裝所有與 Akvorado 流量資料分析相關的業務邏輯，
    提供高層次的 API 給路由層使用。
    """
    
    def __init__(self):
        """初始化服務"""
        self.client = get_clickhouse_client()
        logger.info("ClickHouse 服務初始化完成")
    
    def get_flow_summary(
        self, 
        hours: int = 24,
        include_details: bool = True
    ) -> Union[FlowSummary, Dict[str, Any]]:
        """
        獲取流量概覽統計
        
        Args:
            hours: 統計時間範圍（小時）
            include_details: 是否包含詳細計算資訊
            
        Returns:
            FlowSummary: 流量概覽統計物件
            
        Raises:
            ClickHouseQueryError: 查詢失敗時拋出
        """
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
            
            parameters = {'hours': hours}
            result = self.client.execute_query(query, parameters)
            
            if not result:
                # 如果沒有資料，返回空統計
                return FlowSummary(
                    total_flows=0,
                    total_bytes=0, 
                    total_packets=0,
                    time_range_start=datetime.now() - timedelta(hours=hours),
                    time_range_end=datetime.now(),
                    duration_seconds=hours * 3600
                )
            
            data = result[0]
            
            # 建立 FlowSummary 物件
            summary = FlowSummary(
                total_flows=data['total_flows'],
                total_bytes=data['total_bytes'],
                total_packets=data['total_packets'],
                time_range_start=data['time_range_start'],
                time_range_end=data['time_range_end'],
                duration_seconds=int(data['duration_seconds'])
            )
            
            execution_time = (time.time() - start_time) * 1000
            logger.info(f"流量概覽查詢完成，耗時 {execution_time:.2f}ms")
            
            if include_details:
                return {
                    'summary': summary,
                    'execution_time_ms': execution_time,
                    'query_parameters': parameters
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
            
            parameters = {'hours': hours}
            result = self.client.execute_query(query, parameters)
            
            if not result or not result[0]['total_bytes']:
                logger.warning(f"查詢時間範圍內無資料或總位元組數為空: {hours} 小時")
                return 0
                
            return int(result[0]['total_bytes'])
            
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
            
            parameters = {'hours': hours}
            result = self.client.execute_query(query, parameters)
            
            if not result or not result[0]['total_packets']:
                logger.warning(f"查詢時間範圍內無資料或總封包數為空: {hours} 小時")
                return 0
                
            return int(result[0]['total_packets'])
            
        except Exception as e:
            logger.error(f"獲取總封包數失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取總封包數失敗: {e}")
    
    def get_top_talkers(
        self, 
        limit: int = 10,
        hours: int = 1,
        by_field: str = 'bytes',
        src_or_dst: str = 'src'
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
            
            addr_field = 'SrcAddr' if src_or_dst == 'src' else 'DstAddr'
            
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
            
            parameters = {'limit': limit, 'hours': hours}
            results = self.client.execute_query(query, parameters)
            
            # 在 Python 層計算百分比
            top_talkers = []
            for result in results:
                percentage = (result['bytes'] / total_bytes * 100) if total_bytes > 0 else 0.0
                top_talkers.append(TopTalker(
                    address=result['address'],
                    bytes=result['bytes'],
                    packets=result['packets'],
                    flows=result['flows'],
                    percentage=round(percentage, 2)
                ))
            
            return top_talkers
            
        except Exception as e:
            logger.error(f"獲取 Top Talkers 失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取 Top Talkers 失敗: {e}")
    
    def get_protocol_distribution(
        self, 
        hours: int = 1,
        limit: int = 10
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
            
            parameters = {'hours': hours, 'limit': limit}
            results = self.client.execute_query(query, parameters)
            
            # 在 Python 層計算百分比
            protocols = []
            for result in results:
                percentage = (result['bytes'] / total_bytes * 100) if total_bytes > 0 else 0.0
                protocols.append(TopProtocol(
                    protocol_number=result['protocol_number'],
                    protocol_name=result['protocol_name'],
                    flows=result['flows'],
                    bytes=result['bytes'],
                    packets=result['packets'],
                    percentage=round(percentage, 2)
                ))
            
            return protocols
            
        except Exception as e:
            logger.error(f"獲取協定分佈失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取協定分佈失敗: {e}")
    
    def get_geolocation_stats(
        self,
        hours: int = 1,
        limit: int = 10,
        by_country_only: bool = True
    ) -> List[GeolocationStats]:
        """
        獲取地理位置流量統計
        
        Args:
            hours: 統計時間範圍（小時）
            limit: 返回前 N 個位置
            by_country_only: 是否只按國家統計（不包含城市）
            
        Returns:
            List[GeolocationStats]: 地理位置統計列表
        """
        try:
            if by_country_only:
                # 獲取只有國家資料的總位元組數用於百分比計算
                query_total = """
                SELECT sum(Bytes) as total_bytes
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
                  AND SrcCountry != ''
                """
                parameters = {'hours': hours}
                total_result = self.client.execute_query(query_total, parameters)
                total_bytes = int(total_result[0]['total_bytes']) if total_result and total_result[0]['total_bytes'] else 0
                
                query = """
                SELECT
                    SrcCountry as country,
                    '' as city,
                    count() as flows,
                    sum(Bytes) as bytes,
                    sum(Packets) as packets
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
                  AND SrcCountry != ''
                GROUP BY SrcCountry
                ORDER BY bytes DESC
                LIMIT {limit:UInt32}
                """
            else:
                # 獲取有城市資料的總位元組數用於百分比計算
                query_total = """
                SELECT sum(Bytes) as total_bytes
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
                  AND SrcCountry != ''
                  AND SrcGeoCity != ''
                """
                parameters = {'hours': hours}
                total_result = self.client.execute_query(query_total, parameters)
                total_bytes = int(total_result[0]['total_bytes']) if total_result and total_result[0]['total_bytes'] else 0
                
                query = """
                SELECT
                    SrcCountry as country,
                    SrcGeoCity as city,
                    count() as flows,
                    sum(Bytes) as bytes,
                    sum(Packets) as packets
                FROM flows
                WHERE TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR
                  AND SrcCountry != ''
                  AND SrcGeoCity != ''
                GROUP BY SrcCountry, SrcGeoCity
                ORDER BY bytes DESC
                LIMIT {limit:UInt32}
                """
            
            parameters = {'hours': hours, 'limit': limit}
            results = self.client.execute_query(query, parameters)
            
            # 在 Python 層計算百分比
            geo_stats = []
            for result in results:
                percentage = (result['bytes'] / total_bytes * 100) if total_bytes > 0 else 0.0
                geo_stats.append(GeolocationStats(
                    country=result['country'],
                    city=result['city'] if result['city'] else None,
                    flows=result['flows'],
                    bytes=result['bytes'],
                    packets=result['packets'],
                    percentage=round(percentage, 2)
                ))
            
            return geo_stats
            
        except Exception as e:
            logger.error(f"獲取地理位置統計失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取地理位置統計失敗: {e}")
    
    def get_asn_analysis(
        self,
        hours: int = 1,
        limit: int = 10,
        src_or_dst: str = 'src'
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
            asn_field = 'SrcAS' if src_or_dst == 'src' else 'DstAS'
            addr_field = 'SrcAddr' if src_or_dst == 'src' else 'DstAddr'
            
            # 獲取有 ASN 資料的總位元組數用於百分比計算
            query_total = f"""
            SELECT sum(Bytes) as total_bytes
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {{hours:UInt32}} HOUR
              AND {asn_field} != 0
            """
            parameters = {'hours': hours}
            total_result = self.client.execute_query(query_total, parameters)
            total_bytes = int(total_result[0]['total_bytes']) if total_result and total_result[0]['total_bytes'] else 0
            
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
            
            parameters = {'hours': hours, 'limit': limit}
            results = self.client.execute_query(query, parameters)
            
            # 在 Python 層計算百分比
            asn_stats = []
            for result in results:
                percentage = (result['bytes'] / total_bytes * 100) if total_bytes > 0 else 0.0
                asn_stats.append(ASNStats(
                    asn=result['asn'],
                    asn_name=result['asn_name'],
                    flows=result['flows'],
                    bytes=result['bytes'],
                    packets=result['packets'],
                    percentage=round(percentage, 2),
                    unique_ips=result['unique_ips']
                ))
            
            return asn_stats
            
        except Exception as e:
            logger.error(f"獲取 ASN 分析失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取 ASN 分析失敗: {e}")
    
    def get_time_series_data(
        self,
        hours: int = 24,
        interval_minutes: int = 5
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
            
            parameters = {'hours': hours, 'interval': interval_minutes}
            results = self.client.execute_query(query, parameters)
            
            return [TimeSeriesData(**result) for result in results]
            
        except Exception as e:
            logger.error(f"獲取時間序列資料失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取時間序列資料失敗: {e}")
    
    def get_port_statistics(
        self,
        hours: int = 1,
        limit: int = 10,
        src_or_dst: str = 'dst'
    ) -> List[PortStats]:
        """
        獲取埠號流量統計
        
        Args:
            hours: 統計時間範圍（小時）
            limit: 返回前 N 個埠號
            src_or_dst: 統計來源或目的埠號 ('src', 'dst')
            
        Returns:
            List[PortStats]: 埠號統計列表
        """
        try:
            # 獲取總位元組數用於百分比計算
            total_bytes = self._get_total_bytes_in_range(hours)
            
            port_field = 'SrcPort' if src_or_dst == 'src' else 'DstPort'
            
            query = f"""
            SELECT
                {port_field} as port,
                '' as port_name,
                count() as flows,
                sum(Bytes) as bytes,
                sum(Packets) as packets
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {{hours:UInt32}} HOUR
            GROUP BY {port_field}
            ORDER BY bytes DESC
            LIMIT {{limit:UInt32}}
            """
            
            parameters = {'hours': hours, 'limit': limit}
            results = self.client.execute_query(query, parameters)
            
            # 在 Python 層計算百分比
            port_stats = []
            for result in results:
                percentage = (result['bytes'] / total_bytes * 100) if total_bytes > 0 else 0.0
                port_stats.append(PortStats(
                    port=result['port'],
                    port_name=result['port_name'],
                    flows=result['flows'],
                    bytes=result['bytes'],
                    packets=result['packets'],
                    percentage=round(percentage, 2)
                ))
            
            return port_stats
            
        except Exception as e:
            logger.error(f"獲取埠號統計失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取埠號統計失敗: {e}")
    
    def get_interface_statistics(
        self,
        hours: int = 1,
        limit: int = 10,
        direction: str = 'input'
    ) -> List[InterfaceStats]:
        """
        獲取網路介面流量統計
        
        Args:
            hours: 統計時間範圍（小時）
            limit: 返回前 N 個介面
            direction: 統計方向 ('input', 'output')
            
        Returns:
            List[InterfaceStats]: 介面統計列表
        """
        try:
            if direction == 'input':
                if_name_field = 'InIfName'
                if_desc_field = 'InIfDescription'
            else:
                if_name_field = 'OutIfName'
                if_desc_field = 'OutIfDescription'
            
            # 獲取有介面名稱資料的總位元組數用於百分比計算
            query_total = f"""
            SELECT sum(Bytes) as total_bytes
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {{hours:UInt32}} HOUR
              AND {if_name_field} != ''
            """
            parameters = {'hours': hours}
            total_result = self.client.execute_query(query_total, parameters)
            total_bytes = int(total_result[0]['total_bytes']) if total_result and total_result[0]['total_bytes'] else 0
            
            query = f"""
            SELECT
                {if_name_field} as interface_name,
                {if_desc_field} as interface_description,
                '{direction}' as direction,
                count() as flows,
                sum(Bytes) as bytes,
                sum(Packets) as packets
            FROM flows
            WHERE TimeReceived >= now() - INTERVAL {{hours:UInt32}} HOUR
              AND {if_name_field} != ''
            GROUP BY {if_name_field}, {if_desc_field}
            ORDER BY bytes DESC
            LIMIT {{limit:UInt32}}
            """
            
            parameters = {'hours': hours, 'limit': limit}
            results = self.client.execute_query(query, parameters)
            
            # 在 Python 層計算百分比
            interface_stats = []
            for result in results:
                percentage = (result['bytes'] / total_bytes * 100) if total_bytes > 0 else 0.0
                interface_stats.append(InterfaceStats(
                    interface_name=result['interface_name'],
                    interface_description=result['interface_description'],
                    direction=result['direction'],
                    flows=result['flows'],
                    bytes=result['bytes'],
                    packets=result['packets'],
                    percentage=round(percentage, 2)
                ))
            
            return interface_stats
            
        except Exception as e:
            logger.error(f"獲取介面統計失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"獲取介面統計失敗: {e}")
    
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
                status='error',
                database='akvorado',
                error=str(e)
            )
    
    def search_flows(
        self,
        src_addr: Optional[str] = None,
        dst_addr: Optional[str] = None,
        protocol: Optional[int] = None,
        src_port: Optional[int] = None,
        dst_port: Optional[int] = None,
        hours: int = 1,
        pagination: PaginationParams = PaginationParams()
    ) -> QueryResponse:
        """
        搜尋流量記錄
        
        Args:
            src_addr: 來源 IP 位址
            dst_addr: 目的 IP 位址  
            protocol: 協定編號
            src_port: 來源埠號
            dst_port: 目的埠號
            hours: 搜尋時間範圍（小時）
            pagination: 分頁參數
            
        Returns:
            QueryResponse: 查詢回應物件
        """
        start_time = time.time()
        
        try:
            # 建立查詢條件
            conditions = ["TimeReceived >= now() - INTERVAL {hours:UInt32} HOUR"]
            parameters = {'hours': hours}
            
            if src_addr:
                conditions.append("SrcAddr = {src_addr:String}")
                parameters['src_addr'] = src_addr
            
            if dst_addr:
                conditions.append("DstAddr = {dst_addr:String}")
                parameters['dst_addr'] = dst_addr
            
            if protocol is not None:
                conditions.append("Proto = {protocol:UInt8}")
                parameters['protocol'] = protocol
            
            if src_port is not None:
                conditions.append("SrcPort = {src_port:UInt16}")
                parameters['src_port'] = src_port
            
            if dst_port is not None:
                conditions.append("DstPort = {dst_port:UInt16}")
                parameters['dst_port'] = dst_port
            
            where_clause = " AND ".join(conditions)
            
            # 計數查詢
            count_query = f"""
            SELECT count() as total
            FROM flows
            WHERE {where_clause}
            """
            
            count_result = self.client.execute_query(count_query, parameters)
            total_records = count_result[0]['total'] if count_result else 0
            
            # 資料查詢
            data_query = f"""
            SELECT 
                TimeReceived,
                toString(SrcAddr) as SrcAddr,
                toString(DstAddr) as DstAddr,
                SrcPort,
                DstPort,
                Proto,
                Bytes,
                Packets,
                SrcAS,
                DstAS,
                SrcCountry,
                DstCountry,
                SrcGeoCity,
                DstGeoCity,
                SrcGeoState,
                DstGeoState
            FROM flows
            WHERE {where_clause}
            ORDER BY TimeReceived DESC
            LIMIT {pagination.limit} OFFSET {pagination.offset}
            """
            
            data_results = self.client.execute_query(data_query, parameters)
            
            execution_time = (time.time() - start_time) * 1000
            
            return QueryResponse(
                success=True,
                data=data_results,
                total_records=total_records,
                execution_time_ms=execution_time,
                query_info={
                    'conditions': conditions,
                    'pagination': pagination.dict()
                }
            )
            
        except Exception as e:
            logger.error(f"搜尋流量記錄失敗: {e}", exc_info=True)
            execution_time = (time.time() - start_time) * 1000
            
            return QueryResponse(
                success=False,
                data=[],
                total_records=0,
                execution_time_ms=execution_time,
                query_info={'error': str(e)}
            )


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