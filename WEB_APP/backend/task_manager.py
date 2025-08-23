#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
非同步任務管理器

專注於兩個核心功能：
1. 設備指令執行 + 非同步處理
2. AI 查詢 + 非同步處理

採用 YAGNI 原則

Created: 2025-08-22
Author: Claude Code Assistant
"""

import asyncio
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

# 導入自定義異常
from exceptions import ServiceError, task_error

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """任務狀態枚舉"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TaskProgress:
    """任務進度資訊"""

    percentage: float = 0.0
    current_stage: str = "等待開始..."
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def update(self, percentage: float = None, stage: str = None, **details):
        if percentage is not None:
            self.percentage = max(0.0, min(100.0, percentage))
        if stage is not None:
            self.current_stage = stage
        if details:
            self.details.update(details)


@dataclass
class Task:
    """任務資料結構"""

    task_id: str
    operation_type: str  # "device_command" or "ai_query"
    payload: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    progress: TaskProgress = field(default_factory=TaskProgress)
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    webhook_url: Optional[str] = None


class AsyncTaskManager:
    """非同步任務管理器"""

    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self._lock = asyncio.Lock()

    async def create_task(
        self,
        operation_type: str,
        payload: Dict[str, Any],
        webhook_url: Optional[str] = None,
    ) -> str:
        """建立新任務並返回 task_id"""
        task_id = str(uuid.uuid4())

        task = Task(
            task_id=task_id,
            operation_type=operation_type,
            payload=payload,
            webhook_url=webhook_url,
        )

        async with self._lock:
            self.tasks[task_id] = task

        logger.info(f"建立任務: {task_id}, 類型: {operation_type}")

        # 立即開始執行任務
        asyncio.create_task(self._execute_task(task_id))

        return task_id

    async def get_task(self, task_id: str) -> Optional[Task]:
        """取得任務資訊"""
        async with self._lock:
            return self.tasks.get(task_id)

    async def _execute_task(self, task_id: str):
        """執行任務的核心邏輯"""
        async with self._lock:
            task = self.tasks.get(task_id)
            if not task:
                return

            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now()
            task.progress.update(0, "開始執行...")

        try:
            logger.info(f"開始執行任務: {task_id}")

            if task.operation_type == "device_command":
                result = await self._execute_device_command(task)
            elif task.operation_type == "ai_query":
                result = await self._execute_ai_query(task)
            else:
                raise ValueError(f"未知的操作類型: {task.operation_type}")

            async with self._lock:
                task.status = TaskStatus.COMPLETED
                task.completed_at = datetime.now()
                task.results = result
                task.progress.update(100, "執行完成")

            logger.info(f"任務執行完成: {task_id}")

            # 發送 webhook 通知
            if task.webhook_url:
                await self._send_webhook(task)

        except Exception as e:
            logger.error(f"任務執行失敗: {task_id}, 錯誤: {e}")
            async with self._lock:
                task.status = TaskStatus.FAILED
                task.completed_at = datetime.now()
                task.error = str(e)
                task.progress.update(0, f"執行失敗: {e}")

    async def _execute_device_command(self, task: Task) -> Dict[str, Any]:
        """執行設備指令"""
        devices = task.payload.get("devices", [])
        command = task.payload.get("command", "")

        if not devices or not command:
            raise ValueError("設備列表或指令不能為空")

        # 更新進度
        await self._update_progress(task.task_id, 25, "驗證設備連線...")

        # 導入網路工具
        from network import async_batch_executor

        await self._update_progress(task.task_id, 50, "執行指令中...")

        # 執行批次指令
        result = await async_batch_executor.run_batch_command(command, devices)

        await self._update_progress(task.task_id, 75, "處理結果...")

        # 格式化結果
        from settings import get_settings

        settings = get_settings()

        # 直接格式化結果，處理 AsyncBatchResult 結構
        formatted_results = []
        successful_count = 0

        # result 是 AsyncBatchResult 對象，包含 results 列表
        execution_results = result.results if hasattr(result, "results") else []

        for execution_result in execution_results:
            device_ip = execution_result.device_ip
            device_config = settings.get_device_by_ip(device_ip) or {}
            device_name = execution_result.device_name or device_config.get(
                "name", device_ip
            )

            if execution_result.success:
                successful_count += 1
                formatted_results.append(
                    {
                        "deviceName": device_name,
                        "deviceIp": device_ip,
                        "success": True,
                        "output": execution_result.output,
                    }
                )
            else:
                formatted_results.append(
                    {
                        "deviceName": device_name,
                        "deviceIp": device_ip,
                        "success": False,
                        "error": execution_result.error or "執行失敗",
                    }
                )

        return {
            "results": formatted_results,
            "summary": {
                "total": len(execution_results),
                "successful": successful_count,
                "failed": len(execution_results) - successful_count,
            },
        }

    async def _execute_ai_query(self, task: Task) -> Dict[str, Any]:
        """執行 AI 查詢"""
        devices = task.payload.get("devices", [])
        query = task.payload.get("query", "")

        if not query:
            raise ValueError("AI 查詢不能為空")

        await self._update_progress(task.task_id, 25, "準備 AI 查詢...")

        # 導入 AI 服務
        from ai_service import get_ai_service

        ai_service = get_ai_service()

        await self._update_progress(task.task_id, 50, "執行 AI 分析...")

        # 執行 AI 查詢
        ai_response = await ai_service.query_ai(prompt=query, device_ips=devices)

        await self._update_progress(task.task_id, 75, "格式化 AI 回應...")

        # AI 結果格式化
        from settings import get_settings

        settings = get_settings()

        # 直接格式化 AI 結果，移除複雜的格式化器
        formatted_results = []

        # ai_response 是字符串，不是字典
        ai_output = ai_response if isinstance(ai_response, str) else str(ai_response)

        if devices:
            # 有指定設備的 AI 查詢
            for device_ip in devices:
                device_config = settings.get_device_by_ip(device_ip) or {}
                device_name = device_config.get("name", device_ip)

                formatted_results.append(
                    {
                        "deviceName": device_name,
                        "deviceIp": device_ip,
                        "success": True,
                        "output": ai_output,
                    }
                )
        else:
            # 通用 AI 查詢（不針對特定設備）
            formatted_results.append(
                {
                    "deviceName": "AI 助理",
                    "deviceIp": "ai_assistant",
                    "success": True,
                    "output": ai_output,
                }
            )

        return {
            "results": formatted_results,
            "ai_response": ai_response,
            "summary": {"total": len(devices) if devices else 1, "query": query},
        }

    async def _update_progress(self, task_id: str, percentage: float, stage: str):
        """更新任務進度"""
        async with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.progress.update(percentage, stage)

    async def _send_webhook(self, task: Task):
        """發送 webhook 通知"""
        if not task.webhook_url:
            return

        try:
            import aiohttp

            payload = {
                "task_id": task.task_id,
                "status": task.status.value,
                "operation_type": task.operation_type,
                "results": task.results,
                "completed_at": (
                    task.completed_at.isoformat() if task.completed_at else None
                ),
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    task.webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:
                    if response.status == 200:
                        logger.info(f"Webhook 通知成功: {task.task_id}")
                    else:
                        logger.warning(
                            f"Webhook 通知失敗: {task.task_id}, 狀態碼: {response.status}"
                        )

        except Exception as e:
            logger.error(f"發送 webhook 失敗: {task.task_id}, 錯誤: {e}")


# 全域任務管理器實例
_task_manager = None


def get_task_manager() -> AsyncTaskManager:
    """取得全域任務管理器實例"""
    global _task_manager
    if _task_manager is None:
        _task_manager = AsyncTaskManager()
    return _task_manager
