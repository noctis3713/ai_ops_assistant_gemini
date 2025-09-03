#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse 資料模型定義

定義 Akvorado 流量資料的 Pydantic 模型：
- 流量記錄模型 (FlowRecord)
- 統計彙總模型 (FlowSummary)
- Top-N 分析模型 (TopTalker, TopProtocol 等)
- 地理位置分析模型 (GeolocationStats)
- ASN 分析模型 (ASNStats)

Created: 2025-08-30
Author: Claude Code Assistant
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from typing import Optional, List, Union, Dict, Any
from enum import Enum


class TimeRange(str, Enum):
    """時間範圍枚舉"""
    HOUR_1 = "1h"
    HOUR_6 = "6h" 
    HOUR_12 = "12h"
    DAY_1 = "1d"
    DAY_7 = "7d"
    DAY_30 = "30d"


class ProtocolType(BaseModel):
    """網路協定類型模型"""
    protocol_number: int = Field(..., description="協定編號")
    protocol_name: str = Field(..., description="協定名稱")
    
    @field_validator('protocol_name', mode='before')
    @classmethod
    def map_protocol_name(cls, v, info):
        """將協定編號映射為協定名稱"""
        protocol_map = {
            1: "ICMP",
            6: "TCP", 
            17: "UDP",
            47: "GRE",
            50: "ESP",
            51: "AH",
            89: "OSPF",
            132: "SCTP"
        }
        if info.data and 'protocol_number' in info.data:
            protocol_num = info.data['protocol_number']
            return protocol_map.get(protocol_num, f"Protocol-{protocol_num}")
        return v or "Unknown"


class FlowRecord(BaseModel):
    """
    網路流量記錄完整模型
    
    對應 Akvorado ClickHouse flows 表的完整架構
    """
    # 時間相關欄位
    TimeReceived: datetime = Field(..., description="接收時間")
    TimeFlowStart: Optional[datetime] = Field(None, description="流量開始時間")
    TimeFlowEnd: Optional[datetime] = Field(None, description="流量結束時間")
    
    # 網路地址
    SrcAddr: str = Field(..., description="來源 IP 位址")
    DstAddr: str = Field(..., description="目的 IP 位址")
    NextHop: Optional[str] = Field(None, description="下一跳 IP 位址")
    
    # 埠號資訊
    SrcPort: int = Field(..., description="來源埠號")
    DstPort: int = Field(..., description="目的埠號")
    
    # 協定和服務
    Proto: int = Field(..., description="協定編號")
    
    # 流量統計
    Bytes: int = Field(..., description="位元組數")
    Packets: int = Field(..., description="封包數")
    
    # AS 資訊
    SrcAS: Optional[int] = Field(None, description="來源自治系統編號")
    DstAS: Optional[int] = Field(None, description="目的自治系統編號")
    
    # 地理位置資訊
    SrcCountry: Optional[str] = Field(None, description="來源國家/地區")
    DstCountry: Optional[str] = Field(None, description="目的國家/地區")
    SrcGeoCity: Optional[str] = Field(None, description="來源城市")
    DstGeoCity: Optional[str] = Field(None, description="目的城市")
    SrcGeoState: Optional[str] = Field(None, description="來源州/省")
    DstGeoState: Optional[str] = Field(None, description="目的州/省")
    
    # 網路介面
    InIfName: Optional[str] = Field(None, description="輸入介面名稱")
    OutIfName: Optional[str] = Field(None, description="輸出介面名稱")
    InIfDescription: Optional[str] = Field(None, description="輸入介面描述")
    OutIfDescription: Optional[str] = Field(None, description="輸出介面描述")
    
    # SNMP 介面索引
    InIfIndex: Optional[int] = Field(None, description="輸入介面索引")
    OutIfIndex: Optional[int] = Field(None, description="輸出介面索引")
    
    # 服務類型
    Tos: Optional[int] = Field(None, description="服務類型")
    
    # VLAN 資訊
    SrcVlan: Optional[int] = Field(None, description="來源 VLAN ID")
    DstVlan: Optional[int] = Field(None, description="目的 VLAN ID")
    
    # 取樣資訊
    SamplingRate: Optional[int] = Field(None, description="取樣率")
    
    # 流量方向
    FlowDirection: Optional[int] = Field(None, description="流量方向")
    
    # BGP 資訊
    BGPNextHop: Optional[str] = Field(None, description="BGP 下一跳")
    BGPSrcAS: Optional[int] = Field(None, description="BGP 來源 AS")
    BGPDstAS: Optional[int] = Field(None, description="BGP 目的 AS")
    
    # TCP 旗標
    TCPFlags: Optional[int] = Field(None, description="TCP 旗標")
    
    # MPLS 標籤
    MPLSLabels: Optional[str] = Field(None, description="MPLS 標籤")


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
    
    @model_validator(mode='after')
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
    
    @field_validator('percentage')
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
    
    @field_validator('protocol_name', mode='before')
    @classmethod
    def map_protocol_name(cls, v, info):
        """將協定編號映射為協定名稱"""
        protocol_map = {
            1: "ICMP",
            6: "TCP",
            17: "UDP", 
            47: "GRE",
            50: "ESP",
            51: "AH",
            89: "OSPF",
            132: "SCTP"
        }
        if info.data and 'protocol_number' in info.data:
            protocol_num = info.data['protocol_number']
            return protocol_map.get(protocol_num, f"Protocol-{protocol_num}")
        return v or "Unknown"
    
    @field_validator('percentage')
    @classmethod
    def round_percentage(cls, v):
        """百分比四捨五入到小數點後2位"""
        return round(v, 2)


class GeolocationStats(BaseModel):
    """地理位置統計模型"""
    country: str = Field(..., description="國家/地區")
    city: Optional[str] = Field(None, description="城市")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")
    
    @field_validator('percentage')
    @classmethod
    def round_percentage(cls, v):
        """百分比四捨五入到小數點後2位"""
        return round(v, 2)


class ASNStats(BaseModel):
    """自治系統編號統計模型"""
    asn: int = Field(..., description="自治系統編號")
    asn_name: Optional[str] = Field(None, description="AS 名稱")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")
    unique_ips: int = Field(..., description="唯一 IP 數量")
    
    @field_validator('percentage')
    @classmethod
    def round_percentage(cls, v):
        """百分比四捨五入到小數點後2位"""
        return round(v, 2)


class TimeSeriesData(BaseModel):
    """時間序列資料模型"""
    timestamp: datetime = Field(..., description="時間戳記")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    unique_src_ips: Optional[int] = Field(None, description="唯一來源 IP 數")
    unique_dst_ips: Optional[int] = Field(None, description="唯一目的 IP 數")


class PortStats(BaseModel):
    """埠號統計模型"""
    port: int = Field(..., description="埠號")
    port_name: Optional[str] = Field(None, description="埠號名稱")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")
    
    @field_validator('port_name', mode='before')
    @classmethod
    def map_port_name(cls, v, info):
        """將埠號映射為服務名稱"""
        port_map = {
            20: "FTP-DATA", 21: "FTP", 22: "SSH", 23: "TELNET",
            25: "SMTP", 53: "DNS", 67: "DHCP", 68: "DHCP",
            80: "HTTP", 110: "POP3", 119: "NNTP", 123: "NTP",
            143: "IMAP", 161: "SNMP", 162: "SNMP", 179: "BGP",
            194: "IRC", 389: "LDAP", 443: "HTTPS", 465: "SMTPS",
            514: "SYSLOG", 587: "SMTP", 636: "LDAPS", 993: "IMAPS",
            995: "POP3S", 1433: "MSSQL", 1521: "ORACLE", 3306: "MYSQL",
            3389: "RDP", 5432: "POSTGRESQL", 5671: "AMQPS", 5672: "AMQP",
            6379: "REDIS", 8080: "HTTP-ALT", 8443: "HTTPS-ALT", 9200: "ELASTICSEARCH"
        }
        if info.data and 'port' in info.data:
            port_num = info.data['port']
            return port_map.get(port_num, f"Port-{port_num}")
        return v or "Unknown"
    
    @field_validator('percentage')
    @classmethod
    def round_percentage(cls, v):
        """百分比四捨五入到小數點後2位"""
        return round(v, 2)


class InterfaceStats(BaseModel):
    """網路介面統計模型"""
    interface_name: str = Field(..., description="介面名稱")
    interface_description: Optional[str] = Field(None, description="介面描述")
    direction: str = Field(..., description="方向（input/output）")
    flows: int = Field(..., description="流量條數")
    bytes: int = Field(..., description="位元組數")
    packets: int = Field(..., description="封包數")
    percentage: float = Field(..., description="佔總流量百分比")
    
    @field_validator('percentage')
    @classmethod
    def round_percentage(cls, v):
        """百分比四捨五入到小數點後2位"""
        return round(v, 2)


class QueryResponse(BaseModel):
    """通用查詢回應模型"""
    success: bool = Field(..., description="查詢是否成功")
    data: Union[List[Dict[str, Any]], Dict[str, Any]] = Field(..., description="查詢結果資料")
    total_records: int = Field(..., description="總記錄數")
    execution_time_ms: float = Field(..., description="查詢執行時間（毫秒）")
    query_info: Optional[Dict[str, Any]] = Field(None, description="查詢相關資訊")


class ErrorResponse(BaseModel):
    """錯誤回應模型"""
    success: bool = Field(False, description="查詢失敗")
    error: str = Field(..., description="錯誤訊息")
    error_code: Optional[str] = Field(None, description="錯誤代碼")
    timestamp: datetime = Field(default_factory=datetime.now, description="錯誤發生時間")


class HealthCheckResponse(BaseModel):
    """健康檢查回應模型"""
    status: str = Field(..., description="連接狀態")
    database: str = Field(..., description="資料庫名稱")
    version: Optional[str] = Field(None, description="ClickHouse 版本")
    uptime_seconds: Optional[int] = Field(None, description="運行時間（秒）")
    tables: Optional[List[Dict[str, Any]]] = Field(None, description="資料表資訊")
    error: Optional[str] = Field(None, description="錯誤訊息")


# 輸出格式選項
class OutputFormat(str, Enum):
    """輸出格式枚舉"""
    JSON = "json"
    CSV = "csv"
    TSV = "tsv"
    
    
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