#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse API 路由端點

提供 Akvorado 流量資料分析的 REST API 端點：
- 流量概覽統計 (/api/flows/summary)
- Top-N 分析 (/api/flows/top-*)
- 地理位置分析 (/api/flows/geolocation) 
- ASN 分析 (/api/flows/asn)
- 時間序列分析 (/api/flows/timeseries)
- 健康檢查 (/api/flows/health)

Created: 2025-08-30
Author: Claude Code Assistant
"""

import logging
from typing import List, Optional, Union, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Query, HTTPException, Path, Depends
from fastapi.responses import JSONResponse

from clickhouse_service import get_clickhouse_service, ClickHouseQueryError
from clickhouse_models import (
    FlowSummary, TopTalker, TopProtocol, GeolocationStats,
    ASNStats, TimeSeriesData, PortStats, InterfaceStats,
    QueryResponse, ErrorResponse, HealthCheckResponse,
    PaginationParams, SortOrder, TimeRange
)

logger = logging.getLogger(__name__)

# 建立路由器
router = APIRouter(
    prefix="/api/flows",
    tags=["Network Flow Analysis"],
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"},
        400: {"model": ErrorResponse, "description": "Bad request"}
    }
)

# 依賴注入：獲取服務實例
def get_service():
    """依賴注入：獲取 ClickHouse 服務實例"""
    return get_clickhouse_service()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="ClickHouse 健康檢查",
    description="檢查 ClickHouse 連接狀態和基本資訊"
)
async def health_check(service = Depends(get_service)) -> HealthCheckResponse:
    """ClickHouse 健康檢查端點"""
    try:
        return service.get_health_status()
    except Exception as e:
        logger.error(f"健康檢查失敗: {e}", exc_info=True)
        return HealthCheckResponse(
            status='error',
            database='akvorado',
            error=str(e)
        )


@router.get(
    "/summary",
    response_model=Union[FlowSummary, Dict[str, Any]],
    summary="流量概覽統計",
    description="獲取指定時間範圍內的流量概覽統計資訊"
)
async def get_flow_summary(
    hours: int = Query(
        24,
        ge=1,
        le=168,
        description="統計時間範圍（小時），最大7天"
    ),
    include_details: bool = Query(
        False,
        description="是否包含執行時間等詳細資訊"
    ),
    service = Depends(get_service)
) -> Union[FlowSummary, Dict[str, Any]]:
    """獲取流量概覽統計"""
    try:
        return service.get_flow_summary(hours, include_details)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取流量概覽失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/top-talkers",
    response_model=List[TopTalker],
    summary="Top N 流量來源/目的地",
    description="獲取流量最大的 N 個 IP 位址統計"
)
async def get_top_talkers(
    limit: int = Query(
        10,
        ge=1,
        le=100,
        description="返回前 N 筆記錄"
    ),
    hours: int = Query(
        1,
        ge=1,
        le=24,
        description="統計時間範圍（小時）"
    ),
    by_field: str = Query(
        "bytes",
        regex="^(bytes|packets|flows)$",
        description="排序欄位：bytes, packets, flows"
    ),
    src_or_dst: str = Query(
        "src",
        regex="^(src|dst)$",
        description="統計來源或目的地：src, dst"
    ),
    service = Depends(get_service)
) -> List[TopTalker]:
    """獲取 Top N 流量來源/目的地"""
    try:
        return service.get_top_talkers(limit, hours, by_field, src_or_dst)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取 Top Talkers 失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/protocols",
    response_model=List[TopProtocol],
    summary="協定流量分佈",
    description="獲取網路協定的流量分佈統計"
)
async def get_protocol_distribution(
    hours: int = Query(
        1,
        ge=1,
        le=24,
        description="統計時間範圍（小時）"
    ),
    limit: int = Query(
        10,
        ge=1,
        le=50,
        description="返回前 N 個協定"
    ),
    service = Depends(get_service)
) -> List[TopProtocol]:
    """獲取協定流量分佈"""
    try:
        return service.get_protocol_distribution(hours, limit)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取協定分佈失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/geolocation",
    response_model=List[GeolocationStats],
    summary="地理位置流量分析",
    description="獲取按地理位置分組的流量統計"
)
async def get_geolocation_stats(
    hours: int = Query(
        1,
        ge=1,
        le=24,
        description="統計時間範圍（小時）"
    ),
    limit: int = Query(
        10,
        ge=1,
        le=50,
        description="返回前 N 個位置"
    ),
    by_country_only: bool = Query(
        True,
        description="是否只按國家統計（不包含城市）"
    ),
    service = Depends(get_service)
) -> List[GeolocationStats]:
    """獲取地理位置流量統計"""
    try:
        return service.get_geolocation_stats(hours, limit, by_country_only)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取地理位置統計失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/asn",
    response_model=List[ASNStats],
    summary="ASN 自治系統分析",
    description="獲取自治系統編號的流量分析統計"
)
async def get_asn_analysis(
    hours: int = Query(
        1,
        ge=1,
        le=24,
        description="統計時間範圍（小時）"
    ),
    limit: int = Query(
        10,
        ge=1,
        le=50,
        description="返回前 N 個 ASN"
    ),
    src_or_dst: str = Query(
        "src",
        regex="^(src|dst)$",
        description="分析來源或目的 ASN：src, dst"
    ),
    service = Depends(get_service)
) -> List[ASNStats]:
    """獲取 ASN 自治系統分析"""
    try:
        return service.get_asn_analysis(hours, limit, src_or_dst)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取 ASN 分析失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/timeseries",
    response_model=List[TimeSeriesData],
    summary="時間序列流量資料",
    description="獲取指定時間範圍和間隔的時間序列流量資料"
)
async def get_time_series_data(
    hours: int = Query(
        24,
        ge=1,
        le=168,
        description="統計時間範圍（小時）"
    ),
    interval_minutes: int = Query(
        5,
        ge=1,
        le=60,
        description="時間間隔（分鐘）"
    ),
    service = Depends(get_service)
) -> List[TimeSeriesData]:
    """獲取時間序列流量資料"""
    try:
        return service.get_time_series_data(hours, interval_minutes)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取時間序列資料失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/ports",
    response_model=List[PortStats],
    summary="埠號流量統計",
    description="獲取埠號的流量統計分析"
)
async def get_port_statistics(
    hours: int = Query(
        1,
        ge=1,
        le=24,
        description="統計時間範圍（小時）"
    ),
    limit: int = Query(
        10,
        ge=1,
        le=50,
        description="返回前 N 個埠號"
    ),
    src_or_dst: str = Query(
        "dst",
        regex="^(src|dst)$",
        description="統計來源或目的埠號：src, dst"
    ),
    service = Depends(get_service)
) -> List[PortStats]:
    """獲取埠號流量統計"""
    try:
        return service.get_port_statistics(hours, limit, src_or_dst)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取埠號統計失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/interfaces",
    response_model=List[InterfaceStats],
    summary="網路介面流量統計",
    description="獲取網路介面的流量統計分析"
)
async def get_interface_statistics(
    hours: int = Query(
        1,
        ge=1,
        le=24,
        description="統計時間範圍（小時）"
    ),
    limit: int = Query(
        10,
        ge=1,
        le=50,
        description="返回前 N 個介面"
    ),
    direction: str = Query(
        "input",
        regex="^(input|output)$",
        description="統計方向：input, output"
    ),
    service = Depends(get_service)
) -> List[InterfaceStats]:
    """獲取網路介面流量統計"""
    try:
        return service.get_interface_statistics(hours, limit, direction)
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"獲取介面統計失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


@router.get(
    "/search",
    response_model=QueryResponse,
    summary="搜尋流量記錄",
    description="根據條件搜尋具體的流量記錄"
)
async def search_flows(
    src_addr: Optional[str] = Query(
        None,
        description="來源 IP 位址",
        regex=r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$"
    ),
    dst_addr: Optional[str] = Query(
        None,
        description="目的 IP 位址",
        regex=r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$"
    ),
    protocol: Optional[int] = Query(
        None,
        ge=0,
        le=255,
        description="協定編號 (0-255)"
    ),
    src_port: Optional[int] = Query(
        None,
        ge=0,
        le=65535,
        description="來源埠號 (0-65535)"
    ),
    dst_port: Optional[int] = Query(
        None,
        ge=0,
        le=65535,
        description="目的埠號 (0-65535)"
    ),
    hours: int = Query(
        1,
        ge=1,
        le=24,
        description="搜尋時間範圍（小時）"
    ),
    page: int = Query(
        1,
        ge=1,
        description="頁數"
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description="每頁筆數"
    ),
    service = Depends(get_service)
) -> QueryResponse:
    """搜尋流量記錄"""
    try:
        pagination = PaginationParams(page=page, limit=limit)
        
        return service.search_flows(
            src_addr=src_addr,
            dst_addr=dst_addr,
            protocol=protocol,
            src_port=src_port,
            dst_port=dst_port,
            hours=hours,
            pagination=pagination
        )
    except ClickHouseQueryError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"搜尋流量記錄失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")


# 注意：錯誤處理器應該在 FastAPI 應用程式層級註冊，而不是在 APIRouter 層級


# 添加路由資訊日誌
logger.info("ClickHouse API 路由註冊完成:")
for route in router.routes:
    if hasattr(route, 'methods') and hasattr(route, 'path'):
        methods = ', '.join(route.methods)
        logger.info(f"  {methods:<10} {route.path}")