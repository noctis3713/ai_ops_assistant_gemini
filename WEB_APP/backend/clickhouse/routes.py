#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse API 路由

網路流量分析 API 端點
"""

import logging

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .models import (
    ErrorResponse,
    HealthCheckResponse,
    TrafficAnalysisReport,
)
from .service import ClickHouseQueryError, get_clickhouse_service

logger = logging.getLogger(__name__)

# 建立路由器
router = APIRouter(
    prefix="/api/flows",
    tags=["Network Flow Analysis"],
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"},
        400: {"model": ErrorResponse, "description": "Bad request"},
    },
)


def get_service():
    """獲取 ClickHouse 服務實例"""
    return get_clickhouse_service()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="健康檢查",
    description="檢查 ClickHouse 連接狀態",
)
async def health_check(service=Depends(get_service)) -> HealthCheckResponse:
    """ClickHouse 健康檢查"""
    try:
        return service.get_health_status()
    except Exception as e:
        logger.error(f"健康檢查失敗: {e}", exc_info=True)
        return HealthCheckResponse(status="error", database="akvorado", error=str(e))


@router.get(
    "/analysis",
    response_model=TrafficAnalysisReport,
    summary="流量分析",
    description="執行網路流量分析，包含來源/目的統計、協議分布、地理位置等",
)
async def get_traffic_analysis(
    days: int = Query(3, ge=1, le=30, description="分析時間範圍（天數）"),
    device: Optional[str] = Query(None, description="設備名稱過濾器 (例如: SIS-HD-H7A08-1)"),
    service=Depends(get_service),
) -> TrafficAnalysisReport:
    """
    網路流量分析
    
    分析項目：
    - 流量總覽
    - 主要來源/目的 IP
    - 協議和端口分析
    - 地理位置分布
    - 安全洞察
    - 時間趨勢
    """
    try:
        return service.get_traffic_analysis(days, device)
    except ClickHouseQueryError as e:
        logger.error(f"流量分析查詢失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"流量分析執行失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="內部服務錯誤")