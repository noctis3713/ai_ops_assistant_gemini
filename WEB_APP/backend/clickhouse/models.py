#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse 資料模型定義

定義 Akvorado 流量資料的 Pydantic 模型：
- 統計彙總模型 (FlowSummary)
- Top-N 分析模型 (TopTalker, TopProtocol 等)
- 地理位置分析模型 (GeolocationStats)
- ASN 分析模型 (ASNStats)

Created: 2025-08-30
Author: Claude Code Assistant
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator


class FlowSummary(BaseModel):
    """流量概覽統計模型"""

    total_flows: int = Field(..., description="總流量數")
    total_bytes: int = Field(..., description="總位元組數")
    total_packets: int = Field(..., description="總封包數")
    time_range_start: datetime = Field(..., description="統計時間範圍開始")
    time_range_end: datetime = Field(..., description="統計時間範圍結束")
    duration_seconds: int = Field(..., description="統計時間長度（秒）")
    avg_bytes_per_flow: float = Field(0.0, description="平均每流量位元組數")
    avg_packets_per_flow: float = Field(0.0, description="平均每流量封包數")

    @model_validator(mode="after")
    def calculate_averages(self):
        """計算平均值"""
        if self.total_flows > 0:
            self.avg_bytes_per_flow = round(self.total_bytes / self.total_flows, 2)
            self.avg_packets_per_flow = round(self.total_packets / self.total_flows, 2)
        return self


class TopTalker(BaseModel):
    """Top N 流量來源模型"""

    address: str = Field(..., description="IP 位址")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    flows: int = Field(..., description="流量條數")
    percentage: float = Field(..., description="佔總流量百分比")

    @field_validator("percentage")
    @classmethod
    def round_percentage(cls, v):
        """百分比四捨五入到小數點後2位"""
        return round(v, 2)


class TopProtocol(BaseModel):
    """Top N 協定統計模型"""

    protocol_number: int = Field(..., description="協定編號")
    protocol_name: str = Field(..., description="協定名稱")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")

    @field_validator("percentage")
    @classmethod
    def round_percentage(cls, v):
        """百分比四捨五入到小數點後2位"""
        return round(v, 2)


class GeolocationStats(BaseModel):
    """地理位置統計模型"""

    country: str = Field(..., description="國家/地區")
    city: Optional[str] = Field(None, description="城市")
    state: Optional[str] = Field(None, description="州/省")
    granularity: str = Field(..., description="資料粒度 (country/state/city/unknown)")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    unique_ips: int = Field(..., description="唯一 IP 數量")
    percentage: float = Field(..., description="佔總流量百分比")

    @field_validator("percentage")
    @classmethod
    def round_percentage(cls, v):
        return round(v, 2)


class ASNStats(BaseModel):
    """ASN 自治系統統計模型"""

    asn: int = Field(..., description="ASN 編號")
    asn_name: str = Field(..., description="ASN 名稱")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")
    unique_ips: int = Field(..., description="唯一 IP 數量")

    @field_validator("percentage")
    @classmethod
    def round_percentage(cls, v):
        return round(v, 2)


class TimeSeriesData(BaseModel):
    """時間序列資料模型"""

    timestamp: datetime = Field(..., description="時間戳")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    unique_src_ips: int = Field(..., description="唯一來源 IP 數量")
    unique_dst_ips: int = Field(..., description="唯一目的 IP 數量")


class PortStats(BaseModel):
    """埠號統計模型"""

    port: int = Field(..., description="埠號")
    port_name: str = Field(..., description="埠號名稱")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")

    @field_validator("percentage")
    @classmethod
    def round_percentage(cls, v):
        return round(v, 2)


class InterfaceStats(BaseModel):
    """網路介面統計模型"""

    interface_name: str = Field(..., description="介面名稱")
    interface_description: str = Field(..., description="介面描述")
    direction: str = Field(..., description="流量方向 (input/output)")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")

    @field_validator("percentage")
    @classmethod
    def round_percentage(cls, v):
        return round(v, 2)


class QueryResponse(BaseModel):
    """查詢回應模型"""

    success: bool = Field(..., description="查詢是否成功")
    data: List[Dict[str, Any]] = Field(..., description="查詢結果資料")
    total_records: int = Field(..., description="總記錄數")
    execution_time_ms: float = Field(..., description="執行時間（毫秒）")
    query_info: Dict[str, Any] = Field(..., description="查詢資訊")


class ErrorResponse(BaseModel):
    """錯誤回應模型"""

    error: str = Field(..., description="錯誤訊息")
    detail: Optional[str] = Field(None, description="錯誤詳情")


class HealthCheckResponse(BaseModel):
    """健康檢查回應模型"""

    status: str = Field(..., description="狀態")
    database: str = Field(..., description="資料庫名稱")
    version: Optional[str] = Field(None, description="ClickHouse 版本")
    uptime_seconds: Optional[int] = Field(None, description="運行時間（秒）")
    tables: Optional[List[Dict[str, Any]]] = Field(None, description="資料表資訊")
    error: Optional[str] = Field(None, description="錯誤訊息")


# 排序選項
class SortOrder(str, Enum):
    """排序順序枚舉"""

    ASC = "asc"
    DESC = "desc"


class PaginationParams(BaseModel):
    """分頁參數模型"""

    page: int = Field(1, ge=1, description="頁數")
    limit: int = Field(100, ge=1, le=1000, description="每頁筆數")

    @property
    def offset(self) -> int:
        """計算偏移量"""
        return (self.page - 1) * self.limit


class TrafficAnalysisReport(BaseModel):
    """網路流量分析報告"""

    period_days: int = Field(..., description="分析時間範圍（天數）")
    time_range: Dict[str, datetime] = Field(..., description="時間範圍")

    overview: FlowSummary = Field(..., description="流量總覽")
    top_sources: List[TopTalker] = Field(..., description="主要來源")
    top_destinations: List[TopTalker] = Field(..., description="主要目的") 
    protocol_distribution: List[TopProtocol] = Field(..., description="協議分布")

    geographic_distribution: List[GeolocationStats] = Field(..., description="地理分布")
    asn_analysis: List[ASNStats] = Field(..., description="ASN 分析")
    
    cross_border_traffic: Dict[str, Any] = Field(default_factory=dict, description="跨境流量")
    interface_stats: List[InterfaceStats] = Field(default_factory=list, description="介面統計")
    tcp_flags_analysis: List = Field(default_factory=list, description="TCP 旗標")
    vlan_analysis: List = Field(default_factory=list, description="VLAN 分析")
    application_protocols: List = Field(default_factory=list, description="應用協議")
    traffic_direction: List = Field(default_factory=list, description="流量方向")
    bandwidth_metrics: Dict[str, float] = Field(default_factory=lambda: {
        "avg_bytes_per_second": 0.0,
        "avg_packets_per_second": 0.0,
        "peak_bytes_per_second": 0.0,
        "peak_packets_per_second": 0.0,
        "avg_flow_duration_seconds": 0.0,
        "bandwidth_utilization_percent": 0.0
    }, description="頻寬指標")
    long_connections: List = Field(default_factory=list, description="長連線")

    daily_trends: List[Dict[str, Any]] = Field(..., description="每日趨勢")
    hourly_patterns: List[Dict[str, Any]] = Field(..., description="每小時模式")

    key_findings: List[str] = Field(..., description="關鍵發現")
    anomalies: List[str] = Field(..., description="異常檢測結果")
    
    generated_at: datetime = Field(default_factory=datetime.now, description="報告生成時間")
    query_time_ms: float = Field(..., description="查詢執行時間（毫秒）")