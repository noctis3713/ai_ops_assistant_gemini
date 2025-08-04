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

# 導入 Pydantic 模型
from pydantic import BaseModel
from typing import Optional, TypeVar, Generic
from datetime import datetime

# 設定日誌
logger = logging.getLogger(__name__)

# 建立路由器實例
router = APIRouter(
    prefix="/api",
    tags=["指令執行"]
)

# =============================================================================
# Pydantic 模型定義 (指令執行相關) - 企業級 Generic[T] 型別安全
# =============================================================================

T = TypeVar("T")

class BaseResponse(BaseModel, Generic[T]):
    """統一的 API 回應格式 - 企業級 Generic[T] 實現
    
    特色功能:
    - 完整的型別安全支援
    - 自動時間戳記產生  
    - 標準化錯誤代碼
    - IDE 智能提示支援
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: str = None

    def __init__(self, **data):
        # 自動產生時間戳記，確保每個回應都有時間資訊
        if "timestamp" not in data or data["timestamp"] is None:
            data["timestamp"] = datetime.now().isoformat()
        super().__init__(**data)
    
    class Config:
        """Pydantic 配置類別"""
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
        schema_extra = {
            "example": {
                "success": True,
                "data": "<Generic[T] type data>",
                "message": "操作成功完成",
                "error_code": None,
                "timestamp": "2025-08-04T10:30:15.123456"
            }
        }

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

async def _handle_ai_request(
    ai_service, query: str, device_ips: List[str] = None
) -> str:
    """統一處理所有 AI 相關請求的輔助函數
    
    重要更新 (v2.1.0):
    - 修復依賴注入問題：正確傳入 ai_service 參數
    - 支援 batch_execute 和 run_batch_task_worker 統一調用
    - 增強錯誤分類和回應格式標準化
    
    Args:
        ai_service: AI 服務實例 (必須正確傳入)
        query: 用戶查詢內容
        device_ips: 目標設備 IP 列表（可選）
        
    Returns:
        str: AI 分析結果
        
    Raises:
        HTTPException: 當 AI 處理失敗時
    """
    try:
        logger.info(f"AI 請求處理開始: query='{query[:50]}...', devices={device_ips}")
        
        # 檢查 AI 服務可用性
        if not ai_service.ai_initialized:
            logger.error("AI 服務未初始化")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI 服務未啟用或初始化失敗，請檢查 API 金鑰配置"
            )
        
        # 執行 AI 查詢
        ai_response = await ai_service.query_ai(
            prompt=query,
            device_ips=device_ips
        )
        
        logger.info(f"AI 請求處理完成: response_length={len(ai_response)}")
        return ai_response

    except Exception as e:
        # 使用 AIService 的錯誤分類機制
        error_msg, status_code = ai_service.classify_ai_error(str(e))
        logger.error(f"AI 請求處理失敗: {error_msg} (Query: {query[:50]}...)")
        raise HTTPException(status_code=status_code, detail=error_msg)

# =============================================================================
# 指令執行 API 端點
# =============================================================================

@router.post(
    "/execute",
    response_class=PlainTextResponse,
    summary="💻 單一設備指令執行",
    description="在指定設備上執行網路指令，返回純文字執行結果，只允許安全的 show 指令",
    response_description="指令執行結果（純文字格式）",
    responses={
        200: {
            "description": "指令執行成功",
            "content": {
                "text/plain": {
                    "example": "Cisco IOS XE Software, Version 17.03.04a\nCopyright (c) 1986-2021 by Cisco Systems, Inc.\n..."
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
) -> str:
    """執行網路設備指令

    Args:
        request: 包含設備 IP 和指令的請求
        config_manager: 配置管理器實例（依賴注入）

    Returns:
        str: 指令執行結果（純文字格式）

    Raises:
        HTTPException: 當指令不安全、設備不存在或執行失敗時
    """
    logger.info(f"收到指令執行請求: {request.device_ip} -> {request.command}")

    # 指令安全性驗證
    is_safe, error_message = CommandValidator.validate_command(request.command)
    if not is_safe:
        logger.warning(f"拒絕執行不安全指令: {request.command}, 原因: {error_message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=error_message
        )

    # 驗證設備IP
    try:
        device_config = config_manager.get_device_by_ip(request.device_ip)

        if not device_config:
            error_msg = f"設備 {request.device_ip} 不在配置列表中"
            logger.error(error_msg)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)

    except HTTPException:
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
        return output

    except Exception as e:
        from core.nornir_integration import classify_error
        
        error_str = str(e)
        error_detail = classify_error(error_str)
        logger.error(f"指令執行失敗: {error_str}")

        # 根據錯誤類型設定 HTTP 狀態碼
        if error_detail["type"] == "connection_timeout":
            status_code = status.HTTP_408_REQUEST_TIMEOUT
        elif error_detail["type"] == "authentication_failed":
            status_code = status.HTTP_401_UNAUTHORIZED
        else:
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

        # 構建詳細錯誤訊息
        error_msg = f"設備 {request.device_ip} 執行失敗: {error_str}\n"
        error_msg += f"分類: {error_detail['category']} ({error_detail['type']})\n"
        error_msg += f"嚴重性: {error_detail['severity']}\n"
        error_msg += f"建議: {error_detail['suggestion']}"

        raise HTTPException(status_code=status_code, detail=error_msg)

@router.post(
    "/ai-query",
    response_class=PlainTextResponse,
    summary="🤖 AI 智能查詢",
    description="使用 AI 對設備進行智能分析和查詢，支援自然語言問題理解",
    response_description="AI 分析結果（Markdown 格式）",
    responses={
        200: {
            "description": "AI 分析成功完成",
            "content": {
                "text/plain": {
                    "example": "# 設備狀態分析報告\n\n## 系統版本\n- IOS XE: 17.03.04a\n- 平台: ASR1001-X\n\n## 建議\n- 系統運作正常\n- 建議定期備份配置"
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
) -> str:
    """AI 查詢端點（重構版）

    Args:
        request: 包含設備 IP 和查詢內容的請求
        config_manager: 配置管理器實例（依賴注入）
        ai_service: AI 服務實例（依賴注入）

    Returns:
        str: AI 分析結果（Markdown 格式）

    Raises:
        HTTPException: 當設備不存在或 AI 查詢失敗時
    """
    logger.info(f"收到 AI 查詢請求: {request.device_ip} -> {request.query}")

    # 驗證設備IP
    try:
        device_config = config_manager.get_device_by_ip(request.device_ip)

        if not device_config:
            error_msg = f"設備 {request.device_ip} 不在配置列表中"
            logger.error(error_msg)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驗證設備配置失敗"
        )

    # 直接呼叫統一的 AI 處理函數
    return await _handle_ai_request(
        ai_service, query=request.query, device_ips=[request.device_ip]
    )

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
            # 直接呼叫 _handle_ai_request，不再需要 execute_ai_mode
            ai_service = get_ai_service()
            ai_response = await _handle_ai_request(
                ai_service, query=request.command, device_ips=request.devices
            )

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