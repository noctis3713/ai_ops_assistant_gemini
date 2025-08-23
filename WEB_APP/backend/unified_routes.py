#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統一路由模組

整合所有 API 路由功能：
- 任務管理 (原 task_routes.py)
- 設備管理 (原 task_routes.py)
- 系統管理 (原 admin_routes.py)
- 配置管理 (原 admin_routes.py)

Created: 2025-08-23
Author: Claude Code Assistant
"""

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ai_service import get_ai_service

# 導入統一的 BaseResponse 模型
from common import BaseResponse

# 導入統一異常處理
from exceptions import (
    AuthenticationError,
    ServiceError,
    device_error,
    convert_to_service_error,
)

# 導入核心服務 - 直接導入，移除依賴注入層
from settings import Settings, get_settings

# 導入任務管理器
from task_manager import TaskStatus, get_task_manager

# 設定日誌
logger = logging.getLogger(__name__)

# 建立路由器實例
router = APIRouter(prefix="/api", tags=["統一API"])
admin_router = APIRouter(prefix="/api/admin", tags=["系統管理"])
health_router = APIRouter(tags=["健康檢查"])  # 無前綴的健康檢查路由

# =============================================================================
# Pydantic 模型定義
# =============================================================================


# 任務相關模型
class TaskRequest(BaseModel):
    """任務請求模型"""

    operation_type: str = Field(description="操作類型: device_command 或 ai_query")
    devices: List[str] = Field(description="設備IP列表")
    command: Optional[str] = Field(
        default=None, description="指令內容（device_command必填）"
    )
    query: Optional[str] = Field(default=None, description="AI查詢內容（ai_query必填）")
    webhook_url: Optional[str] = Field(default=None, description="完成時的回調URL")


class TaskCreateResponse(BaseModel):
    """任務建立回應"""

    task_id: str
    status: str
    created_at: str
    polling_url: str


class TaskStatusResponse(BaseModel):
    """任務狀態回應"""

    task_id: str
    status: str
    operation_type: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: Dict[str, Any]
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# 設備相關模型
class DeviceInfo(BaseModel):
    """設備資訊模型"""

    ip: str = Field(description="設備 IP 位址")
    name: str = Field(description="設備名稱")
    location: Optional[str] = Field(default=None, description="設備位置")
    device_type: Optional[str] = Field(default=None, description="設備類型")
    is_enabled: bool = Field(default=True, description="是否啟用")


class DeviceGroup(BaseModel):
    """設備群組模型"""

    group_name: str = Field(description="群組名稱")
    devices: List[str] = Field(description="群組內設備 IP 列表")
    description: Optional[str] = Field(default=None, description="群組描述")


class DeviceStatusInfo(BaseModel):
    """設備狀態資訊模型"""

    device_ip: str = Field(description="設備 IP 位址")
    device_name: str = Field(description="設備名稱")
    is_healthy: bool = Field(description="設備健康狀態")
    response_time_ms: Optional[float] = Field(
        default=None, description="回應時間(毫秒)"
    )
    checked_at: str = Field(description="檢查時間")


# 管理功能相關模型


class AIStatusResponse(BaseModel):
    """AI 狀態查詢回應模型"""

    ai_initialized: bool
    api_keys: Dict[str, Any]
    recommendations: List[str]
    current_provider: str


# 配置相關模型
class FrontendConfig(BaseModel):
    """前端動態配置模型"""

    polling: Dict[str, Any]
    ui: Dict[str, Any]
    api: Dict[str, Any]




# =============================================================================
# 任務管理路由
# =============================================================================


@router.post("/tasks", response_model=BaseResponse[TaskCreateResponse])
async def create_task(request: TaskRequest):
    """建立新任務 - 設備指令執行或AI查詢"""

    # 驗證請求
    if request.operation_type == "device_command":
        if not request.command:
            return BaseResponse.error_response(
                "device_command 操作需要提供 command 參數", "MISSING_COMMAND"
            )
        payload = {"devices": request.devices, "command": request.command}
    elif request.operation_type == "ai_query":
        if not request.query:
            return BaseResponse.error_response(
                "ai_query 操作需要提供 query 參數", "MISSING_QUERY"
            )
        payload = {
            "devices": request.devices,  # AI查詢可以針對特定設備
            "query": request.query,
        }
    else:
        return BaseResponse.error_response(
            "operation_type 必須是 device_command 或 ai_query", "INVALID_OPERATION_TYPE"
        )

    if not request.devices:
        return BaseResponse.error_response("devices 列表不能為空", "EMPTY_DEVICES")

    try:
        task_manager = get_task_manager()
        task_id = await task_manager.create_task(
            operation_type=request.operation_type,
            payload=payload,
            webhook_url=request.webhook_url,
        )

        data = TaskCreateResponse(
            task_id=task_id,
            status="pending",
            created_at=str(task_manager.tasks[task_id].created_at),
            polling_url=f"/api/tasks/{task_id}",
        )

        return BaseResponse.success_response(data, "任務建立成功")

    except Exception as e:
        logger.error(f"建立任務失敗: {e}")
        return BaseResponse.error_response(
            f"建立任務失敗: {str(e)}", "TASK_CREATION_FAILED"
        )


@router.get("/tasks/{task_id}", response_model=BaseResponse[TaskStatusResponse])
async def get_task_status(task_id: str):
    """查詢任務狀態"""

    task_manager = get_task_manager()
    task = await task_manager.get_task(task_id)

    if not task:
        return BaseResponse.error_response("任務不存在", "TASK_NOT_FOUND")

    data = TaskStatusResponse(
        task_id=task.task_id,
        status=task.status.value,
        operation_type=task.operation_type,
        created_at=str(task.created_at),
        started_at=str(task.started_at) if task.started_at else None,
        completed_at=str(task.completed_at) if task.completed_at else None,
        progress=task.progress.to_dict(),
        results=task.results,
        error=task.error,
    )

    message = "任務查詢成功"
    if task.status == TaskStatus.COMPLETED:
        message = "任務執行完成"
    elif task.status == TaskStatus.FAILED:
        message = "任務執行失敗"
    elif task.status == TaskStatus.RUNNING:
        message = "任務執行中"

    return BaseResponse.success_response(data, message)


# =============================================================================
# 設備管理路由
# =============================================================================


@router.get("/devices", response_model=BaseResponse[List[DeviceInfo]])
async def get_devices():
    """取得所有設備清單"""
    logger.info("收到設備清單請求")

    try:
        # 取得設備配置
        from settings import get_settings

        settings = get_settings()
        devices_config = settings.get_devices_config()

        # 轉換為 DeviceInfo 模型
        device_list = []
        for device in devices_config:
            device_info = DeviceInfo(
                ip=device.get("ip", ""),
                name=device.get("name", device.get("ip", "Unknown")),
                location=device.get("location"),
                device_type=device.get("device_type"),
                is_enabled=device.get("enabled", True),
            )
            device_list.append(device_info)

        logger.info(f"成功返回 {len(device_list)} 台設備資訊")
        return BaseResponse.success_response(
            device_list, f"成功取得 {len(device_list)} 台設備"
        )

    except Exception as e:
        logger.error(f"取得設備清單失敗: {e}")
        return BaseResponse.error_response(
            f"取得設備清單失敗: {str(e)}", "DEVICE_LIST_ERROR"
        )


@router.get("/device-groups", response_model=BaseResponse[List[DeviceGroup]])
async def get_device_groups():
    """取得設備群組清單"""
    logger.info("收到設備群組請求")

    try:
        # 取得群組配置
        from settings import get_settings

        settings = get_settings()
        groups_config = settings.get_groups_config()

        # 轉換為 DeviceGroup 模型
        group_list = []
        for group_name, group_info in groups_config.items():
            device_group = DeviceGroup(
                group_name=group_name,
                devices=group_info.get("devices", []),
                description=group_info.get("description"),
            )
            group_list.append(device_group)

        logger.info(f"成功返回 {len(group_list)} 個設備群組")
        return BaseResponse.success_response(
            group_list, f"成功取得 {len(group_list)} 個群組"
        )

    except Exception as e:
        logger.error(f"取得設備群組失敗: {e}")
        return BaseResponse.error_response(
            f"取得設備群組失敗: {str(e)}", "GROUP_LIST_ERROR"
        )


@router.get("/devices/status", response_model=BaseResponse[List[DeviceStatusInfo]])
async def get_devices_status():
    """取得所有設備狀態"""
    logger.info("收到設備狀態檢查請求")

    try:
        # 取得設備清單
        from settings import get_settings

        settings = get_settings()
        devices_config = settings.get_devices_config()
        device_ips = [device.get("ip") for device in devices_config if device.get("ip")]

        if not device_ips:
            return BaseResponse.success_response([], "沒有設備需要檢查")

        # 使用異步批次執行器進行健康檢查
        from network import async_batch_executor

        start_time = time.time()
        health_results = await async_batch_executor.health_check_devices(device_ips)
        end_time = time.time()

        # 建立狀態回應
        status_list = []
        checked_at = datetime.now().isoformat()

        for device_ip in device_ips:
            device_config = settings.get_device_by_ip(device_ip) or {}
            device_name = device_config.get("name", device_ip)

            is_healthy = health_results.get(device_ip, False)
            response_time = (end_time - start_time) * 1000 if is_healthy else None

            device_status = DeviceStatusInfo(
                device_ip=device_ip,
                device_name=device_name,
                is_healthy=is_healthy,
                response_time_ms=response_time,
                checked_at=checked_at,
            )
            status_list.append(device_status)

        healthy_count = sum(1 for s in status_list if s.is_healthy)
        total_count = len(status_list)

        message = f"設備狀態檢查完成: {healthy_count}/{total_count} 台設備正常"
        logger.info(message)

        return BaseResponse.success_response(status_list, message)

    except Exception as e:
        logger.error(f"設備狀態檢查失敗: {e}")
        return BaseResponse.error_response(
            f"設備狀態檢查失敗: {str(e)}", "DEVICE_STATUS_ERROR"
        )


# =============================================================================
# AI 服務狀態路由
# =============================================================================


@router.get("/ai-status", response_model=BaseResponse[AIStatusResponse])
async def get_ai_status():
    """獲取 AI 服務狀態和配額資訊"""
    logger.info("收到 AI 狀態檢查請求")

    try:
        # 直接獲取服務實例
        app_settings = get_settings()
        ai_service = get_ai_service()

        # 獲取 AI 服務詳細狀態
        ai_status = ai_service.get_ai_status()

        # 檢查 API 金鑰狀態
        api_key_status = {
            "gemini_configured": app_settings.get_gemini_configured(),
            "claude_configured": app_settings.get_claude_configured(),
            "current_provider": app_settings.AI_PROVIDER,
        }

        # 構建建議清單
        recommendations = []
        if not ai_status["ai_initialized"]:
            recommendations.append("請檢查 AI API Key 設定是否正確")

        if (
            not api_key_status["gemini_configured"]
            and not api_key_status["claude_configured"]
        ):
            recommendations.append("請設定至少一個 AI 提供者的 API Key")

        logger.info(
            f"AI 狀態檢查完成: 初始化={ai_status['ai_initialized']}, 提供者={api_key_status['current_provider']}"
        )

        # 構建標準化的 AIStatusResponse
        ai_status_data = AIStatusResponse(
            ai_initialized=ai_status["ai_initialized"],
            api_keys=api_key_status,
            recommendations=recommendations,
            current_provider=api_key_status["current_provider"],
        )

        return BaseResponse.success_response(
            data=ai_status_data, message="AI 服務狀態檢查完成"
        )

    except Exception as e:
        logger.error(f"AI 狀態檢查失敗: {e}")
        raise convert_to_service_error(e, "AI 服務狀態檢查")


# =============================================================================
# 配置管理路由
# =============================================================================


@router.get("/frontend-config", response_model=BaseResponse[FrontendConfig])
async def get_frontend_config():
    """取得前端動態配置"""
    logger.info("收到前端動態配置查詢請求")

    try:
        # 直接獲取設定實例
        app_settings = get_settings()

        # 從配置檔案載入前端配置
        config_data = app_settings.get_frontend_config()

        # 構建前端配置物件
        frontend_config = FrontendConfig(
            polling=config_data.get("polling", {}),
            ui=config_data.get("ui", {}),
            api=config_data.get("api", {}),
        )

        logger.info("前端動態配置從配置檔案載入完成")

        return BaseResponse.success_response(
            data=frontend_config, message="前端配置獲取成功 (從 frontend_settings.yaml)"
        )

    except Exception as e:
        error_msg = f"獲取前端配置失敗: {str(e)}"
        logger.error(error_msg)
        raise convert_to_service_error(e, "前端配置處理")




# =============================================================================
# 管理功能路由 (需要 API Key)
# =============================================================================






# =============================================================================
# 監控和健康檢查路由
# =============================================================================


@health_router.get("/health")
async def simple_health_check():
    """簡單健康檢查端點（用於 Docker 健康檢查）"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}




@admin_router.get("/tasks/stats", response_model=BaseResponse[Dict[str, Any]])
async def get_task_statistics():
    """取得任務統計資訊"""
    try:
        task_manager = get_task_manager()

        # 計算任務統計
        all_tasks = list(task_manager.tasks.values())

        stats = {
            "total_tasks": len(all_tasks),
            "pending_tasks": len([t for t in all_tasks if t.status.value == "pending"]),
            "running_tasks": len([t for t in all_tasks if t.status.value == "running"]),
            "completed_tasks": len(
                [t for t in all_tasks if t.status.value == "completed"]
            ),
            "failed_tasks": len([t for t in all_tasks if t.status.value == "failed"]),
            "last_updated": datetime.now().isoformat(),
        }

        return BaseResponse.success_response(stats, "任務統計查詢成功")

    except Exception as e:
        logger.error(f"任務統計查詢失敗: {e}")
        return BaseResponse.error_response(
            f"任務統計查詢失敗: {str(e)}", "TASK_STATS_ERROR"
        )
