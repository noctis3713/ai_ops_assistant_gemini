#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
指令執行路由模組

提供指令執行相關的 API 端點：
- 單一設備指令執行
- AI 智能查詢 
- 同步批次執行
- 非同步批次執行

Created: 2025-08-04
Author: Claude Code Assistant
"""

import asyncio
import logging
from typing import Dict, List, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from starlette import status

# 導入依賴和核心服務
from .dependencies import get_ai_service_dep, get_config_manager_dep
from async_task_manager import TaskType, get_task_manager
from core.network_tools import CommandValidator
from core.error_codes import NetworkErrorCodes, AIErrorCodes, classify_network_error, classify_ai_error
from core.exceptions import (
    DeviceNotFoundError, DeviceConnectionError, DeviceAuthenticationError, DeviceTimeoutError,
    CommandValidationError, CommandExecutionError, CommandTimeoutError,
    AIServiceError, AINotAvailableError, AIQuotaExceededError, AIAPIError
)

# 導入 Pydantic 模型
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 導入統一的 BaseResponse 模型
from models.common import BaseResponse

# 設定日誌
logger = logging.getLogger(__name__)

# 建立路由器實例
router = APIRouter(
    prefix="/api",
    tags=["指令執行"]
)

# =============================================================================
# Pydantic 模型定義 (指令執行相關)
# =============================================================================

class ExecuteRequest(BaseModel):
    """設備指令執行請求模型"""
    device_ip: str
    command: str

class AIQueryRequest(BaseModel):
    """AI 查詢請求模型"""
    device_ip: str
    query: str

class BatchExecuteRequest(BaseModel):
    """批次執行請求模型"""
    devices: List[str]
    command: str
    mode: str  # "command" or "ai"

class BatchExecutionResult(BaseModel):
    """批次執行結果模型"""
    deviceName: str
    deviceIp: str
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    executionTime: float

class TaskCreationResponse(BaseModel):
    """任務建立回應模型"""
    task_id: str
    message: str

class BatchExecuteResponse(BaseModel):
    """批次執行回應模型"""
    results: List[BatchExecutionResult]
    summary: Dict[str, Any]

# 企業級型別別名定義 - 增強 IDE 支援和程式碼可讀性
BatchExecuteResponseTyped = BaseResponse[BatchExecuteResponse]
TaskCreationResponseTyped = BaseResponse[TaskCreationResponse]

# =============================================================================
# AI 處理輔助函數 (從 main.py 遷移)
# =============================================================================

# 移除本地的 _handle_ai_request 函數，統一使用 AIService.handle_ai_request
# 這樣可以消除程式碼重複，提升維護性

# =============================================================================
# 指令執行 API 端點
# =============================================================================

@router.post(
    "/execute",
    response_model=BaseResponse[str],
    summary="💻 單一設備指令執行",
    description="在指定設備上執行網路指令，返回標準化格式的執行結果，只允許安全的 show 指令",
    response_description="指令執行結果（BaseResponse[str] 格式）",
    responses={
        200: {
            "description": "指令執行成功",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": "Cisco IOS XE Software, Version 17.03.04a\nCopyright (c) 1986-2021 by Cisco Systems, Inc.\n...",
                        "message": "指令執行成功",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        400: {"description": "指令不安全或格式錯誤"},
        404: {"description": "設備未找到"},
        408: {"description": "連線超時"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def execute_command(
    request: ExecuteRequest, 
    config_manager=Depends(get_config_manager_dep)
) -> BaseResponse[str]:
    """執行網路設備指令

    Args:
        request: 包含設備 IP 和指令的請求
        config_manager: 配置管理器實例（依賴注入）

    Returns:
        BaseResponse[str]: 指令執行結果（標準化格式）

    Raises:
        HTTPException: 當指令不安全、設備不存在或執行失敗時
    """
    logger.info(f"收到指令執行請求: {request.device_ip} -> {request.command}")

    # 指令安全性驗證
    is_safe, error_message = CommandValidator.validate_command(request.command)
    if not is_safe:
        logger.warning(f"拒絕執行不安全指令: {request.command}, 原因: {error_message}")
        raise CommandValidationError(request.command, error_message)

    # 驗證設備IP
    try:
        device_config = config_manager.get_device_by_ip(request.device_ip)

        if not device_config:
            logger.error(f"設備 {request.device_ip} 不在配置列表中")
            raise DeviceNotFoundError(request.device_ip)

    except DeviceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驗證設備配置失敗"
        )

    # 執行指令
    try:
        from core.network_tools import run_readonly_show_command
        
        output = run_readonly_show_command(
            device_ip=request.device_ip,
            command=request.command,
            device_config=device_config,
        )

        logger.info(f"指令執行成功: {request.device_ip} -> {request.command}")
        
        # 返回標準化的 BaseResponse 格式
        return BaseResponse[str](
            success=True,
            data=output,
            message="指令執行成功",
            error_code=None
        )

    except Exception as e:
        from core.nornir_integration import classify_error
        
        error_str = str(e)
        error_detail = classify_error(error_str)
        logger.error(f"指令執行失敗: {error_str}")

        # 使用統一的錯誤分類系統
        error_code = classify_network_error(error_str)
        
        # 根據錯誤代碼拋出適當的異常
        if error_code == NetworkErrorCodes.CONNECTION_TIMEOUT:
            raise DeviceTimeoutError(request.device_ip, "指令執行", 30)
        elif error_code in [NetworkErrorCodes.AUTH_FAILED, NetworkErrorCodes.CREDENTIALS_INVALID]:
            raise DeviceAuthenticationError(request.device_ip)
        elif error_code == NetworkErrorCodes.CONNECTION_REFUSED:
            raise DeviceConnectionError(request.device_ip, error_str)
        else:
            raise CommandExecutionError(request.command, request.device_ip, error_str)

@router.post(
    "/ai-query",
    response_model=BaseResponse[str],
    summary="🤖 AI 智能查詢",
    description="使用 AI 對設備進行智能分析和查詢，支援自然語言問題理解",
    response_description="AI 分析結果（BaseResponse[str] 格式）",
    responses={
        200: {
            "description": "AI 分析成功完成",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": "# 設備狀態分析報告\n\n## 系統版本\n- IOS XE: 17.03.04a\n- 平台: ASR1001-X\n\n## 建議\n- 系統運作正常\n- 建議定期備份配置",
                        "message": "AI 分析完成",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        404: {"description": "設備未找到"},
        503: {"description": "AI 服務不可用"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def ai_query(
    request: AIQueryRequest,
    config_manager=Depends(get_config_manager_dep),
    ai_service=Depends(get_ai_service_dep),
) -> BaseResponse[str]:
    """AI 查詢端點（重構版）

    Args:
        request: 包含設備 IP 和查詢內容的請求
        config_manager: 配置管理器實例（依賴注入）
        ai_service: AI 服務實例（依賴注入）

    Returns:
        BaseResponse[str]: AI 分析結果（標準化格式）

    Raises:
        HTTPException: 當設備不存在或 AI 查詢失敗時
    """
    logger.info(f"收到 AI 查詢請求: {request.device_ip} -> {request.query}")

    # 驗證設備IP
    try:
        device_config = config_manager.get_device_by_ip(request.device_ip)

        if not device_config:
            logger.error(f"設備 {request.device_ip} 不在配置列表中")
            raise DeviceNotFoundError(request.device_ip)

    except DeviceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驗證設備配置失敗"
        )

    # 使用 AIService 的統一 AI 請求處理方法
    try:
        ai_result = await ai_service.handle_ai_request(
            query=request.query, device_ips=[request.device_ip]
        )
        
        # 返回標準化的 BaseResponse 格式
        return BaseResponse[str](
            success=True,
            data=ai_result,
            message="AI 分析完成",
            error_code=None
        )
        
    except Exception as e:
        # 解析錯誤訊息和狀態碼
        error_parts = str(e).split('|')
        if len(error_parts) == 2:
            error_msg, status_code_str = error_parts
            status_code = int(status_code_str)
        else:
            error_msg = str(e)
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        
        logger.error(f"AI 查詢失敗: {error_msg}")
        
        # 根據狀態碼拋出適當的 AI 服務異常
        if status_code == 429:
            raise AIQuotaExceededError("AI")
        elif status_code == 401:
            raise AIAPIError("AI", "認證失敗")
        elif status_code == 503:
            raise AINotAvailableError(error_msg)
        else:
            raise AIServiceError(error_msg)

@router.post(
    "/batch-execute",
    response_model=BatchExecuteResponseTyped,
    summary="🚀 同步批次執行",
    description="在多個設備上同步執行指令或 AI 查詢，立即返回結果",
    response_description="批次執行結果和統計摘要的標準化回應格式",
    responses={
        200: {
            "description": "批次執行成功完成",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "results": [
                                {
                                    "deviceName": "SIS-LY-C0609",
                                    "deviceIp": "202.3.182.202",
                                    "success": True,
                                    "output": "show version 輸出...",
                                    "error": None,
                                    "executionTime": 2.5
                                }
                            ],
                            "summary": {
                                "total": 1,
                                "successful": 1,
                                "failed": 0,
                                "totalTime": 2.5
                            }
                        },
                        "message": "批次執行完成: 1 成功, 0 失敗",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        400: {"description": "請求參數錯誤或指令不安全"},
        404: {"description": "設備未找到"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def batch_execute(
    request: BatchExecuteRequest,
    config_manager=Depends(get_config_manager_dep)
) -> BatchExecuteResponseTyped:
    """批次執行指令"""
    logger.info(f"收到批次執行請求: {len(request.devices)} 個設備 -> {request.command}")

    # 指令安全性驗證 - AI 模式不需要預先驗證，讓 AI Agent 自行選擇安全指令
    if request.mode != "ai":
        is_safe, error_message = CommandValidator.validate_command(request.command)
        if not is_safe:
            logger.warning(
                f"拒絕執行不安全指令: {request.command}, 原因: {error_message}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=error_message
            )

    # 驗證所有設備IP是否在配置中
    try:
        valid_devices, invalid_devices = config_manager.validate_device_ips(
            request.devices
        )

        if invalid_devices:
            error_msg = f"以下設備不在配置列表中: {', '.join(invalid_devices)}"
            logger.error(error_msg)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驗證設備配置失敗"
        )

    # 使用 Nornir 執行批次指令
    try:
        logger.info(f"開始批次執行指令: {request.devices} -> {request.command}")

        if request.mode == "ai":
            # AI 模式批次執行 - 使用統一處理函數
            logger.info(f"AI 模式批次執行: {request.devices} -> {request.command}")

            from ai_service import get_ai_service
            # 使用 AIService 的統一 AI 請求處理方法
            ai_service = get_ai_service()
            try:
                ai_response = await ai_service.handle_ai_request(
                    query=request.command, device_ips=request.devices
                )
            except Exception as e:
                # 解析錯誤訊息和狀態碼
                error_parts = str(e).split('|')
                if len(error_parts) == 2:
                    error_msg, status_code_str = error_parts
                    status_code = int(status_code_str)
                else:
                    error_msg = str(e)
                    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                
                logger.error(f"AI 批次執行失敗: {error_msg}")
                raise HTTPException(status_code=status_code, detail=error_msg)

            # 構建AI模式的回應格式 - 每個設備顯示相同的 AI 分析結果
            results = []
            for device_ip in request.devices:
                device_config = config_manager.get_device_by_ip(device_ip)
                device_name = config_manager.get_device_name_safe(
                    device_config, device_ip
                )

                results.append(
                    BatchExecutionResult(
                        deviceName=device_name,
                        deviceIp=device_ip,
                        success=True,
                        output=ai_response,
                        error=None,
                        executionTime=2.0,
                    )
                )
        else:
            # 指令模式批次執行 - 直接調用 Nornir 管理器
            from core.nornir_integration import get_nornir_manager

            manager = get_nornir_manager()
            batch_result = await asyncio.to_thread(
                manager.run_batch_command, request.command, request.devices
            )

            # 轉換 Nornir 結果格式為 API 回應格式
            results = []
            for device_ip, device_output in batch_result.results.items():
                device_config = config_manager.get_device_by_ip(device_ip)
                device_name = config_manager.get_device_name_safe(
                    device_config, device_ip
                )

                results.append(
                    BatchExecutionResult(
                        deviceName=device_name,
                        deviceIp=device_ip,
                        success=True,  # 如果在 results 中說明執行成功
                        output=device_output,
                        error=None,
                        executionTime=batch_result.execution_time
                        / batch_result.total_devices,
                    )
                )

            # 處理失敗的設備
            for device_ip, error_msg in batch_result.errors.items():
                device_config = config_manager.get_device_by_ip(device_ip)
                device_name = config_manager.get_device_name_safe(
                    device_config, device_ip
                )

                # 獲取詳細錯誤分類
                error_detail = batch_result.error_details.get(device_ip, {})
                formatted_error = f"{error_msg}"
                if error_detail:
                    formatted_error += f"\n分類: {error_detail.get('category', '未知')} ({error_detail.get('type', 'unknown')})"
                    formatted_error += (
                        f"\n嚴重性: {error_detail.get('severity', 'unknown')}"
                    )
                    formatted_error += (
                        f"\n建議: {error_detail.get('suggestion', '請檢查設備狀態')}"
                    )

                results.append(
                    BatchExecutionResult(
                        deviceName=device_name,
                        deviceIp=device_ip,
                        success=False,
                        output=None,
                        error=formatted_error,
                        executionTime=0.0,
                    )
                )

        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        total_time = sum(r.executionTime for r in results)

        logger.info(f"批次執行完成: {successful} 成功, {failed} 失敗")

        # 構建摘要，包含快取統計（如果可用）
        summary = {
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "totalTime": total_time,
        }

        # 如果不是 AI 模式，加入快取統計
        if request.mode != "ai" and "batch_result" in locals():
            if hasattr(batch_result, "cache_hits") and hasattr(
                batch_result, "cache_misses"
            ):
                cache_total = batch_result.cache_hits + batch_result.cache_misses
                if cache_total > 0:
                    summary["cacheStats"] = {
                        "hits": batch_result.cache_hits,
                        "misses": batch_result.cache_misses,
                        "hitRate": round(
                            (batch_result.cache_hits / cache_total) * 100, 1
                        ),
                    }

        # 構建標準化的 BatchExecuteResponse
        batch_data = BatchExecuteResponse(results=results, summary=summary)
        
        return BatchExecuteResponseTyped(
            success=True,
            data=batch_data,
            message=f"批次執行完成: {successful} 成功, {failed} 失敗",
            error_code=None
        )

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e)
        logger.error(f"批次執行失敗: {error_str}")

        # 分析錯誤類型
        if "timeout" in error_str.lower():
            error_msg = f"批次執行超時 - 部分設備連接超時，請檢查網路狀況"
            status_code = status.HTTP_408_REQUEST_TIMEOUT
        elif "authentication" in error_str.lower():
            error_msg = f"批次執行認證失敗 - 請檢查設備憑證設定"
            status_code = status.HTTP_401_UNAUTHORIZED
        else:
            error_msg = f"批次執行失敗: {error_str}"
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

        raise HTTPException(status_code=status_code, detail=error_msg)

@router.post(
    "/batch-execute-async",
    response_model=TaskCreationResponseTyped,
    summary="⚡ 非同步批次執行",
    description="建立非同步批次執行任務，立即返回任務 ID，適用於長時間操作",
    response_description="任務建立確認和任務 ID 的標準化回應格式",
    responses={
        200: {
            "description": "任務成功建立",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "task_id": "task_1691145015_abcd1234",
                            "message": "任務已成功建立並在背景執行"
                        },
                        "message": "非同步批次任務已建立: task_1691145015_abcd1234",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        400: {"description": "請求參數錯誤或指令不安全"},
        404: {"description": "設備未找到"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def batch_execute_async(
    request: BatchExecuteRequest, 
    background_tasks: BackgroundTasks,
    config_manager=Depends(get_config_manager_dep)
) -> TaskCreationResponseTyped:
    """
    非同步批次執行指令，立即返回任務 ID

    這個端點適用於長時間執行的批次操作，避免 HTTP 超時問題。
    用戶可以通過返回的 task_id 查詢任務進度和結果。
    """
    logger.info(
        f"收到非同步批次執行請求",
        extra={
            "devices_count": len(request.devices),
            "command": (
                request.command[:50] + "..."
                if len(request.command) > 50
                else request.command
            ),
            "mode": request.mode,
        },
    )

    # 指令安全性驗證 - AI 模式不需要預先驗證
    if request.mode != "ai":
        is_safe, error_message = CommandValidator.validate_command(request.command)
        if not is_safe:
            logger.warning(
                f"拒絕執行不安全指令: {request.command}, 原因: {error_message}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=error_message
            )

    # 驗證所有設備IP是否在配置中
    try:
        valid_devices, invalid_devices = config_manager.validate_device_ips(
            request.devices
        )

        if invalid_devices:
            error_msg = f"以下設備不在配置列表中: {', '.join(invalid_devices)}"
            logger.error(error_msg)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驗證設備配置失敗"
        )

    try:
        # 建立非同步任務
        task_manager = get_task_manager()
        task = await task_manager.create_task(
            task_type=TaskType.BATCH_EXECUTE,
            params={
                "devices": request.devices,
                "command": request.command,
                "mode": request.mode,
            },
        )

        # 將實際工作交給背景任務
        from background_tasks import run_batch_task_worker  # 從背景任務模組導入
        background_tasks.add_task(
            run_batch_task_worker,
            task.task_id,
            request.devices,
            request.command,
            request.mode,
        )

        logger.info(
            f"非同步批次任務已建立",
            extra={"task_id": task.task_id, "devices_count": len(request.devices)},
        )

        # 構建標準化的 TaskCreationResponse
        task_data = TaskCreationResponse(
            task_id=task.task_id, 
            message="任務已成功建立並在背景執行"
        )
        
        return TaskCreationResponseTyped(
            success=True,
            data=task_data,
            message=f"非同步批次任務已建立: {task.task_id}",
            error_code=None
        )

    except Exception as e:
        error_msg = f"建立非同步任務失敗: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_msg
        )