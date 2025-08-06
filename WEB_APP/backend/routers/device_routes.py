#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
設備管理路由模組

提供設備相關的 API 端點：
- 設備清單查詢
- 設備群組管理  
- 設備狀態檢查
- 單一設備狀態查詢

Created: 2025-08-04
Author: Claude Code Assistant
"""

import asyncio
import logging
import time
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

# 導入依賴和模型
from .dependencies import get_config_manager_dep
from core.nornir_integration import get_nornir_manager

# 導入 Pydantic 模型 (從 main.py 中複製，後續可考慮建立獨立的 models 模組)
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

# 導入統一的 BaseResponse 模型
from models.common import BaseResponse

# 設定日誌
logger = logging.getLogger(__name__)

# 建立路由器實例
router = APIRouter(
    prefix="/api", 
    tags=["設備管理"]
)

# =============================================================================
# Pydantic 模型定義 (設備相關)
# =============================================================================


class DeviceInfo(BaseModel):
    """設備資訊模型"""
    ip: str
    name: str
    model: str
    description: str

class DeviceGroupInfo(BaseModel):
    """設備群組資訊模型"""
    name: str
    description: str
    device_count: int
    platform: str

class DeviceStatusInfo(BaseModel):
    """設備狀態資訊模型"""
    ip: str
    name: str
    model: str
    status: str  # "online" or "offline"
    last_checked: float
    details: Optional[Dict[str, Any]] = None

class DeviceStatusSummary(BaseModel):
    """設備狀態摘要模型"""
    total: int
    online: int
    offline: int
    checked_at: float

class DevicesStatusResponse(BaseModel):
    """設備狀態檢查回應模型"""
    devices: List[DeviceStatusInfo]
    summary: DeviceStatusSummary

# 企業級型別別名定義 - 增強 IDE 支援和程式碼可讀性
DeviceListResponse = BaseResponse[List[DeviceInfo]]
DeviceGroupListResponse = BaseResponse[List[DeviceGroupInfo]]
DeviceStatusResponse = BaseResponse[DeviceStatusInfo]
DevicesHealthResponse = BaseResponse[DevicesStatusResponse]

# =============================================================================
# 設備管理 API 端點
# =============================================================================

@router.get(
    "/devices",
    response_model=DeviceListResponse,
    summary="📋 取得設備清單",
    description="獲取所有已註冊的網路設備列表，包含設備基本資訊和型號",
    response_description="包含所有設備資訊的標準化回應格式",
    responses={
        200: {
            "description": "成功獲取設備清單",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": [
                            {
                                "ip": "202.3.182.202",
                                "name": "SIS-LY-C0609",
                                "model": "Cisco ASR 1001-X",
                                "description": "LY SIS設備"
                            }
                        ],
                        "message": "成功載入 1 個設備",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_devices(
    config_manager=Depends(get_config_manager_dep),
) -> DeviceListResponse:
    """取得所有設備列表

    Args:
        config_manager: 配置管理器實例（依賴注入）

    Returns:
        BaseResponse[List[DeviceInfo]]: 包含設備列表的統一回應格式

    Raises:
        HTTPException: 當載入設備配置失敗時
    """
    logger.info("收到獲取設備列表請求")

    try:
        config = config_manager.load_devices_config()
        devices = []

        for device_obj in config.devices:
            devices.append(
                DeviceInfo(
                    ip=device_obj.ip,
                    name=device_obj.name,
                    model=device_obj.model,
                    description=device_obj.description,
                )
            )

        logger.info(f"成功回傳 {len(devices)} 個設備")
        return DeviceListResponse.success_response(
            data=devices,
            message=f"成功載入 {len(devices)} 個設備"
        )

    except Exception as e:
        logger.error(f"獲取設備列表失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取設備列表失敗: {str(e)}",
        )

@router.get(
    "/device-groups",
    response_model=DeviceGroupListResponse,
    summary="📋 取得設備群組清單",
    description="獲取所有設備群組及其統計資訊，包含每個群組的設備數量",
    response_description="包含設備群組列表的標準化回應格式",
    responses={
        200: {
            "description": "成功獲取設備群組清單",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": [
                            {
                                "name": "cisco_xe_devices",
                                "description": "所有 Cisco IOS-XE 設備",
                                "device_count": 3,
                                "platform": "cisco_xe"
                            }
                        ],
                        "message": "成功載入 1 個設備群組",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_device_groups(
    config_manager=Depends(get_config_manager_dep),
) -> DeviceGroupListResponse:
    """取得所有設備群組列表

    Args:
        config_manager: 配置管理器實例（依賴注入）

    Returns:
        Dict[str, List[DeviceGroupInfo]]: 包含設備群組列表的字典

    Raises:
        HTTPException: 當載入群組配置失敗時
    """
    logger.info("收到獲取設備群組列表請求")

    try:
        groups_config = config_manager.load_groups_config()
        devices_config = config_manager.load_devices_config()

        groups = []

        for group_obj in groups_config.groups:
            # 計算群組中的設備數量
            if group_obj.name == "cisco_xe_devices":
                # cisco_xe_devices 群組包含所有 Cisco IOS-XE 設備
                device_count = len(
                    [
                        device
                        for device in devices_config.devices
                        if device.device_type == "cisco_xe" or device.os == "cisco_xe"
                    ]
                )
            else:
                # 其他群組的計算邏輯（目前只有 cisco_xe_devices）
                device_count = 0

            groups.append(
                DeviceGroupInfo(
                    name=group_obj.name,
                    description=group_obj.description,
                    device_count=device_count,
                    platform=group_obj.platform,
                )
            )

        logger.info(f"成功回傳 {len(groups)} 個設備群組")
        return DeviceGroupListResponse.success_response(
            data=groups,
            message=f"成功載入 {len(groups)} 個設備群組"
        )

    except Exception as e:
        logger.error(f"獲取設備群組列表失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取設備群組列表失敗: {str(e)}",
        )

@router.get(
    "/devices/status",
    response_model=DevicesHealthResponse,
    summary="📊 設備健康檢查",
    description="檢查所有設備的連線狀態和健康狀況，提供詳細的在線/離線統計",
    response_description="包含所有設備狀態和統計摘要的標準化回應格式",
    responses={
        200: {
            "description": "成功完成設備健康檢查",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "devices": [
                                {
                                    "ip": "202.3.182.202",
                                    "name": "SIS-LY-C0609",
                                    "model": "Cisco ASR 1001-X",
                                    "status": "online",
                                    "last_checked": 1691145015.123,
                                    "details": {"ping_successful": True, "ssh_accessible": True}
                                }
                            ],
                            "summary": {
                                "total": 1,
                                "online": 1,
                                "offline": 0,
                                "checked_at": 1691145015.123
                            }
                        },
                        "message": "設備健康檢查完成: 1/1 台設備在線",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_devices_status(
    config_manager=Depends(get_config_manager_dep),
) -> DevicesHealthResponse:
    """檢查所有設備的連線狀態
    
    Args:
        config_manager: 配置管理器實例（依賴注入）
        
    Returns:
        DevicesStatusResponse: 包含設備狀態和統計摘要
        
    Raises:
        HTTPException: 當設備狀態檢查失敗時
    """
    logger.info("收到設備狀態檢查請求")

    try:
        config = config_manager.load_devices_config()
        devices_status = []

        # 使用 Nornir 管理器進行健康檢查
        manager = get_nornir_manager()
        device_ips = [device.ip for device in config.devices]

        # 執行健康檢查
        health_results = await asyncio.to_thread(
            manager.health_check_devices, device_ips
        )

        # 構建回應
        for device in config.devices:
            device_ip = device.ip
            is_healthy = health_results.get(device_ip, False)

            devices_status.append(
                DeviceStatusInfo(
                    ip=device_ip,
                    name=device.name,
                    model=device.model,
                    status="online" if is_healthy else "offline",
                    last_checked=time.time(),
                    details={"ping_successful": is_healthy, "ssh_accessible": is_healthy}
                )
            )

        online_count = sum(
            1 for status in devices_status if status.status == "online"
        )
        total_count = len(devices_status)

        logger.info(f"設備狀態檢查完成: {online_count}/{total_count} 台設備在線")

        # 構建標準化的 DevicesStatusResponse
        status_data = DevicesStatusResponse(
            devices=devices_status,
            summary=DeviceStatusSummary(
                total=total_count,
                online=online_count,
                offline=total_count - online_count,
                checked_at=time.time(),
            )
        )
        
        return DevicesHealthResponse.success_response(
            data=status_data,
            message=f"設備健康檢查完成: {online_count}/{total_count} 台設備在線"
        )

    except Exception as e:
        logger.error(f"設備狀態檢查失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"設備狀態檢查失敗: {str(e)}",
        )

@router.get(
    "/devices/{device_ip}/status",
    response_model=DeviceStatusResponse,
    summary="🔍 單一設備狀態查詢",
    description="檢查特定設備的連線狀態和詳細資訊，包含 SSH 連線和 Ping 測試結果",
    response_description="指定設備的狀態資訊和詳細檢查結果",
    responses={
        200: {
            "description": "成功獲取設備狀態",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "ip": "202.3.182.202",
                            "name": "SIS-LY-C0609",
                            "model": "Cisco ASR 1001-X",
                            "status": "online",
                            "last_checked": 1691145015.123,
                            "details": {"ping_successful": True, "ssh_accessible": True}
                        },
                        "message": "設備 202.3.182.202 狀態檢查完成: 在線",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        404: {"description": "設備未找到"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_device_status(
    device_ip: str,
    config_manager=Depends(get_config_manager_dep),
) -> DeviceStatusResponse:
    """檢查特定設備的連線狀態
    
    Args:
        device_ip: 要檢查的設備 IP 地址
        config_manager: 配置管理器實例（依賴注入）
        
    Returns:
        DeviceStatusInfo: 設備狀態資訊
        
    Raises:
        HTTPException: 當設備不存在或狀態檢查失敗時
    """
    logger.info(f"收到設備 {device_ip} 狀態檢查請求")

    try:
        # 驗證設備是否在配置中
        device_config = config_manager.get_device_by_ip(device_ip)
        if not device_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"設備 {device_ip} 不在配置列表中",
            )

        # 使用 Nornir 管理器進行健康檢查
        manager = get_nornir_manager()
        health_results = await asyncio.to_thread(
            manager.health_check_devices, [device_ip]
        )

        is_healthy = health_results.get(device_ip, False)

        result = DeviceStatusInfo(
            ip=device_ip,
            name=device_config["name"],
            model=device_config["model"],
            status="online" if is_healthy else "offline",
            last_checked=time.time(),
            details={"ping_successful": is_healthy, "ssh_accessible": is_healthy},
        )

        status_msg = "在線" if is_healthy else "離線"
        logger.info(f"設備 {device_ip} 狀態檢查完成: {status_msg}")
        
        return DeviceStatusResponse.success_response(
            data=result,
            message=f"設備 {device_ip} 狀態檢查完成: {status_msg}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"設備 {device_ip} 狀態檢查失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"設備狀態檢查失敗: {str(e)}",
        )