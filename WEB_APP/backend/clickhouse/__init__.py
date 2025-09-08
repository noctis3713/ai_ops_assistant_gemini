#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse 模組初始化

統一管理所有 ClickHouse 相關功能的匯出介面
"""

# 主要類別和函數匯出
from .client import (
    ClickHouseClient,
    ClickHouseConnectionError,
    ClickHouseQueryError,
    get_clickhouse_client,
)
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
from .routes import router as clickhouse_router
from .service import ClickHouseService, get_clickhouse_service

__all__ = [
    # Client
    "ClickHouseClient",
    "get_clickhouse_client",
    "ClickHouseConnectionError",
    "ClickHouseQueryError",
    # Service
    "ClickHouseService",
    "get_clickhouse_service",
    # Models
    "FlowSummary",
    "TopTalker",
    "TopProtocol",
    "GeolocationStats",
    "ASNStats",
    "TimeSeriesData",
    "PortStats",
    "InterfaceStats",
    "QueryResponse",
    "HealthCheckResponse",
    "SortOrder",
    "PaginationParams",
    "TrafficAnalysisReport",
    # Routes
    "clickhouse_router",
]