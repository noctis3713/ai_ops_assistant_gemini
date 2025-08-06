#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任務管理路由模組

提供任務管理相關的 API 端點：
- 任務狀態查詢
- 任務列表查詢
- 任務取消操作
- 任務管理器統計

Created: 2025-08-04
Author: Claude Code Assistant
"""

import logging
import sys
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from starlette import status

# 導入任務管理相關模組
from async_task_manager import TaskStatus, TaskType, get_task_manager

# 導入 Pydantic 模型
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime

# 導入統一的 BaseResponse 模型
from models.common import BaseResponse

# 設定日誌
logger = logging.getLogger(__name__)

# 建立路由器實例
router = APIRouter(
    prefix="/api",
    tags=["任務管理"]
)

# =============================================================================
# Pydantic 模型定義 (任務管理相關)
# =============================================================================

class TaskProgressResponse(BaseModel):
    """任務進度回應模型"""
    percentage: float
    current_stage: str
    details: Dict[str, Any] = {}

class TaskResponse(BaseModel):
    """任務狀態回應模型"""
    task_id: str
    task_type: str
    status: str
    params: Dict[str, Any]
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: TaskProgressResponse
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None

class TaskListResponse(BaseModel):
    """任務列表回應模型"""
    tasks: List[TaskResponse]
    total_count: int
    filters_applied: Dict[str, Any]

class TaskCancelResponse(BaseModel):
    """任務取消回應模型"""
    message: str
    task_id: str

class TaskManagerStatsResponse(BaseModel):
    """任務管理器統計回應模型"""
    task_manager_stats: Dict[str, Any]
    system_info: Dict[str, Any]

# 企業級型別別名定義 - 增強 IDE 支援和程式碼可讀性
TaskResponseTyped = BaseResponse[TaskResponse]
TaskListResponseTyped = BaseResponse[TaskListResponse]
TaskCancelResponseTyped = BaseResponse[TaskCancelResponse]
TaskManagerStatsResponseTyped = BaseResponse[TaskManagerStatsResponse]

# =============================================================================
# 任務管理 API 端點
# =============================================================================

@router.get(
    "/task/{task_id}",
    response_model=TaskResponseTyped,
    summary="🔍 查詢任務狀態",
    description="根據任務 ID 查詢特定任務的詳細狀態和結果，包含進度和執行時間",
    response_description="完整的任務狀態資訊和標準化回應格式",
    responses={
        200: {
            "description": "成功獲取任務狀態",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "task_id": "task_1691145015_abcd1234",
                            "task_type": "batch_execute",
                            "status": "completed",
                            "params": {"devices": ["202.3.182.202"], "command": "show version"},
                            "created_at": "2025-08-04T10:30:15.123456",
                            "completed_at": "2025-08-04T10:32:20.654321",
                            "progress": {"percentage": 100.0, "current_stage": "已完成"},
                            "result": {"success": True, "output": "..."},
                            "execution_time": 125.5
                        },
                        "message": "任務狀態查詢成功",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:35:30.789012"
                    }
                }
            }
        },
        404: {"description": "任務不存在"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_task_status(task_id: str) -> TaskResponseTyped:
    """
    查詢特定任務的狀態和結果

    Args:
        task_id: 任務唯一識別符

    Returns:
        TaskResponse: 完整的任務狀態資訊
        
    Raises:
        HTTPException: 當任務不存在時
    """
    task_manager = get_task_manager()
    task = await task_manager.get_task(task_id)

    if not task:
        logger.warning(f"查詢不存在的任務: {task_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="找不到該任務"
        )

    # 將 AsyncTask 轉換為 TaskResponse 格式
    task_dict = task.to_dict()

    # 構建標準化的 TaskResponse
    task_response = TaskResponse(
        task_id=task_dict["task_id"],
        task_type=task_dict["task_type"],
        status=task_dict["status"],
        params=task_dict["params"],
        created_at=task_dict["created_at"],
        started_at=task_dict["started_at"],
        completed_at=task_dict["completed_at"],
        progress=TaskProgressResponse(
            percentage=task_dict["progress"]["percentage"],
            current_stage=task_dict["progress"]["current_stage"],
            details=task_dict["progress"]["details"],
        ),
        result=task_dict["result"],
        error=task_dict["error"],
        execution_time=task_dict["execution_time"],
    )
    
    return TaskResponseTyped.success_response(
        data=task_response,
        message="任務狀態查詢成功"
    )

@router.get(
    "/tasks",
    response_model=TaskListResponseTyped,
    summary="📋 列出任務",
    description="列出所有任務，支援狀態和類型篩選、分頁功能，提供完整的任務管理概覽",
    response_description="符合條件的任務列表和統計資訊的標準化回應格式",  
    responses={
        200: {
            "description": "成功獲取任務列表",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "tasks": [
                                {
                                    "task_id": "task_1691145015_abcd1234",
                                    "task_type": "batch_execute",
                                    "status": "completed",
                                    "created_at": "2025-08-04T10:30:15.123456",
                                    "progress": {"percentage": 100.0, "current_stage": "已完成"}
                                }
                            ],
                            "total_count": 1,
                            "filters_applied": {"status": None, "task_type": None, "limit": 50}
                        },
                        "message": "成功獲取 1 個任務",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:35:30.789012"
                    }
                }
            }
        },
        400: {"description": "篩選參數無效"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def list_tasks(
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    limit: Optional[int] = 50,
) -> TaskListResponseTyped:
    """
    列出任務，支援篩選和分頁

    Args:
        status: 狀態篩選 (pending, running, completed, failed, cancelled)
        task_type: 類型篩選 (batch_execute, ai_query, health_check)
        limit: 返回數量限制，預設 50

    Returns:
        TaskListResponse: 符合條件的任務列表
        
    Raises:
        HTTPException: 當篩選參數無效時
    """
    task_manager = get_task_manager()

    # 轉換篩選參數
    status_filter = None
    if status:
        try:
            status_filter = TaskStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"無效的狀態值: {status}",
            )

    task_type_filter = None
    if task_type:
        try:
            task_type_filter = TaskType(task_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"無效的任務類型: {task_type}",
            )

    # 查詢任務
    tasks = await task_manager.list_tasks(
        status_filter=status_filter, task_type_filter=task_type_filter, limit=limit
    )

    # 轉換為回應格式
    task_responses = []
    for task in tasks:
        task_dict = task.to_dict()
        task_responses.append(
            TaskResponse(
                task_id=task_dict["task_id"],
                task_type=task_dict["task_type"],
                status=task_dict["status"],
                params=task_dict["params"],
                created_at=task_dict["created_at"],
                started_at=task_dict["started_at"],
                completed_at=task_dict["completed_at"],
                progress=TaskProgressResponse(
                    percentage=task_dict["progress"]["percentage"],
                    current_stage=task_dict["progress"]["current_stage"],
                    details=task_dict["progress"]["details"],
                ),
                result=task_dict["result"],
                error=task_dict["error"],
                execution_time=task_dict["execution_time"],
            )
        )

    # 構建標準化的 TaskListResponse
    task_list_data = TaskListResponse(
        tasks=task_responses,
        total_count=len(task_responses),
        filters_applied={"status": status, "task_type": task_type, "limit": limit}
    )
    
    return TaskListResponseTyped.success_response(
        data=task_list_data,
        message=f"成功獲取 {len(task_responses)} 個任務"
    )

@router.delete(
    "/task/{task_id}",
    response_model=TaskCancelResponseTyped,
    summary="❌ 取消任務",
    description="取消指定的任務（僅對進行中或等待中的任務有效），立即停止任務執行",
    response_description="任務取消操作結果的標準化回應格式",
    responses={
        200: {
            "description": "任務成功取消",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "message": "任務已成功取消",
                            "task_id": "task_1691145015_abcd1234"
                        },
                        "message": "任務 task_1691145015_abcd1234 已成功取消",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:35:30.789012"
                    }
                }
            }
        },
        400: {"description": "任務無法取消（已完成或不存在）"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def cancel_task(task_id: str) -> TaskCancelResponseTyped:
    """
    取消指定任務

    Args:
        task_id: 任務唯一識別符

    Returns:
        TaskCancelResponse: 取消操作結果
        
    Raises:
        HTTPException: 當任務無法取消時
    """
    task_manager = get_task_manager()

    success = await task_manager.cancel_task(task_id, "用戶手動取消")

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="任務無法取消（可能已完成或不存在）",
        )

    logger.info(f"任務已被用戶取消: {task_id}")

    # 構建標準化的 TaskCancelResponse
    cancel_data = TaskCancelResponse(message="任務已成功取消", task_id=task_id)
    
    return TaskCancelResponseTyped.success_response(
        data=cancel_data,
        message=f"任務 {task_id} 已成功取消"
    )

@router.get(
    "/task-manager/stats",
    response_model=TaskManagerStatsResponseTyped,
    summary="📊 任務管理器統計",
    description="取得任務管理器的統計資訊和系統狀態，包含任務數量、成功率等指標",
    response_description="任務管理器統計和系統資訊的標準化回應格式",
    responses={
        200: {
            "description": "成功獲取統計資訊",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "task_manager_stats": {
                                "total_tasks": 25,
                                "completed_tasks": 20,
                                "failed_tasks": 3,
                                "running_tasks": 2,
                                "success_rate": 80.0
                            },
                            "system_info": {
                                "python_version": [3, 11, 0],
                                "platform": "win32"
                            }
                        },
                        "message": "統計資訊獲取成功",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:35:30.789012"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_task_manager_stats() -> TaskManagerStatsResponseTyped:
    """
    取得任務管理器統計資訊

    Returns:
        TaskManagerStatsResponse: 任務管理器的統計資訊
    """
    task_manager = get_task_manager()
    stats = await task_manager.get_stats()

    # 構建標準化的 TaskManagerStatsResponse
    stats_data = TaskManagerStatsResponse(
        task_manager_stats=stats,
        system_info={
            "python_version": sys.version_info[:3],
            "platform": sys.platform,
        }
    )
    
    return TaskManagerStatsResponseTyped.success_response(
        data=stats_data,
        message="統計資訊獲取成功"
    )