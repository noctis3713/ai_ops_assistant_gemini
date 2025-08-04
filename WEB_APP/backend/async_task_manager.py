#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
非同步任務管理器
處理長時間執行的網路設備操作和 AI 查詢任務
支援任務狀態追蹤、進度更新和結果管理

Created: 2025-07-31
Author: Claude Code Assistant
"""

import asyncio
import logging
import os
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional

# 統一配置管理系統
from core.settings import settings
# 使用統一的日誌系統
from utils import LoggerConfig

# 建立任務管理專用日誌記錄器
task_logger = LoggerConfig.setup_logger("task_manager", "app.log")


class TaskStatus(Enum):
    """任務狀態枚舉"""

    PENDING = "pending"  # 等待執行
    RUNNING = "running"  # 執行中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 執行失敗
    CANCELLED = "cancelled"  # 已取消


class TaskType(Enum):
    """任務類型枚舉"""

    BATCH_EXECUTE = "batch_execute"  # 批次設備執行
    AI_QUERY = "ai_query"  # AI 查詢分析
    HEALTH_CHECK = "health_check"  # 健康檢查


@dataclass
class TaskProgress:
    """任務進度資訊"""

    percentage: float = 0.0  # 進度百分比 (0-100)
    current_stage: str = "等待開始..."  # 當前階段描述
    details: Dict[str, Any] = field(default_factory=dict)  # 其他進度細節

    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式，用於序列化"""
        return asdict(self)

    def update(self, percentage: float = None, stage: str = None, **details):
        """更新進度資訊"""
        if percentage is not None:
            self.percentage = max(0.0, min(100.0, percentage))
        if stage is not None:
            self.current_stage = stage
        if details:
            self.details.update(details)


@dataclass
class AsyncTask:
    """非同步任務資料結構"""

    task_id: str
    task_type: TaskType
    status: TaskStatus = TaskStatus.PENDING
    params: Dict[str, Any] = field(default_factory=dict)  # 儲存任務參數

    # 時間資訊
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # 進度和結果
    progress: TaskProgress = field(default_factory=TaskProgress)
    result: Optional[Any] = None
    error: Optional[str] = None

    # 執行統計
    execution_time: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式，用於 API 回應"""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type.value,
            "status": self.status.value,
            "params": self.params,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": (
                self.completed_at.isoformat() if self.completed_at else None
            ),
            "progress": self.progress.to_dict(),
            "result": self.result,
            "error": self.error,
            "execution_time": self.execution_time,
        }

    def is_active(self) -> bool:
        """檢查任務是否為活動狀態"""
        return self.status in [TaskStatus.PENDING, TaskStatus.RUNNING]

    def is_finished(self) -> bool:
        """檢查任務是否已結束"""
        return self.status in [
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED,
        ]


class AsyncTaskManager:
    """非同步任務管理器

    負責管理所有非同步任務的生命週期，包括：
    - 任務建立和狀態追蹤
    - 進度更新和結果管理
    - 自動清理過期任務
    - 錯誤處理和恢復
    """

    def __init__(self, cleanup_interval: int = None, task_ttl: int = None):
        """
        初始化任務管理器

        Args:
            cleanup_interval: 清理檢查的間隔時間（秒），None 時從 Settings 載入
            task_ttl: 任務過期時間（秒），None 時從 Settings 載入
        """
        # 從統一 Settings 配置載入參數
        config = settings.get_task_manager_config()
        self.cleanup_interval = cleanup_interval or config["cleanup_interval"]
        task_ttl_seconds = task_ttl or config["task_ttl"]

        self.tasks: Dict[str, AsyncTask] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None
        self.task_ttl = timedelta(seconds=task_ttl_seconds)
        self.start_time = datetime.now()  # 記錄任務管理器啟動時間

        # 統計資訊
        self._stats = {
            "total_created": 0,
            "total_completed": 0,
            "total_failed": 0,
            "total_cancelled": 0,
            "cleanup_runs": 0,
            "tasks_cleaned": 0,
        }

        task_logger.info(
            "AsyncTaskManager 已初始化",
            extra={
                "cleanup_interval": self.cleanup_interval,
                "task_ttl": task_ttl_seconds,
                "settings_config": {
                    "ASYNC_TASK_CLEANUP_INTERVAL": settings.ASYNC_TASK_CLEANUP_INTERVAL,
                    "ASYNC_TASK_TTL": settings.ASYNC_TASK_TTL,
                },
            },
        )

    async def start_cleanup_loop(self):
        """啟動自動清理過期任務的循環"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
            task_logger.info("自動清理任務已啟動")
        else:
            task_logger.warning("清理任務已在運行中")

    async def stop_cleanup_loop(self):
        """停止自動清理任務"""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            task_logger.info("自動清理任務已停止")

    async def _periodic_cleanup(self):
        """定期清理過期任務"""
        task_logger.info("定期清理任務已開始運行")

        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                await self._cleanup_expired_tasks()
                self._stats["cleanup_runs"] += 1

            except asyncio.CancelledError:
                task_logger.info("定期清理任務被取消")
                break
            except Exception as e:
                task_logger.error(f"定期清理任務發生錯誤: {e}", exc_info=True)
                # 繼續運行，避免清理任務停止

    async def _cleanup_expired_tasks(self):
        """清理過期的已完成任務"""
        current_time = datetime.now()
        expired_tasks = []

        async with self._lock:
            for task_id, task in list(self.tasks.items()):
                # 只清理已完成且超過TTL的任務
                if (
                    task.is_finished()
                    and (current_time - task.created_at) > self.task_ttl
                ):
                    expired_tasks.append(task_id)
                    del self.tasks[task_id]

        if expired_tasks:
            self._stats["tasks_cleaned"] += len(expired_tasks)
            task_logger.info(
                f"已清理 {len(expired_tasks)} 個過期任務",
                extra={
                    "expired_task_ids": expired_tasks[:5],  # 只記錄前5個ID
                    "total_cleaned": self._stats["tasks_cleaned"],
                },
            )

    async def create_task(
        self, task_type: TaskType, params: Dict[str, Any]
    ) -> AsyncTask:
        """
        建立新任務並返回任務物件

        Args:
            task_type: 任務類型
            params: 任務參數

        Returns:
            AsyncTask: 建立的任務物件
        """
        task_id = str(uuid.uuid4())
        task = AsyncTask(
            task_id=task_id,
            task_type=task_type,
            params=params.copy(),  # 複製參數以避免修改原始資料
        )

        async with self._lock:
            self.tasks[task_id] = task
            self._stats["total_created"] += 1

        task_logger.info(
            f"已建立任務",
            extra={
                "task_id": task_id,
                "task_type": task_type.value,
                "params_keys": list(params.keys()),
            },
        )

        return task

    async def get_task(self, task_id: str) -> Optional[AsyncTask]:
        """
        取得任務資訊

        Args:
            task_id: 任務ID

        Returns:
            Optional[AsyncTask]: 任務物件，如果不存在則返回 None
        """
        async with self._lock:
            return self.tasks.get(task_id)

    async def list_tasks(
        self,
        status_filter: Optional[TaskStatus] = None,
        task_type_filter: Optional[TaskType] = None,
        limit: Optional[int] = None,
    ) -> List[AsyncTask]:
        """
        列出任務，支援篩選

        Args:
            status_filter: 狀態篩選
            task_type_filter: 類型篩選
            limit: 返回數量限制

        Returns:
            List[AsyncTask]: 符合條件的任務列表
        """
        async with self._lock:
            tasks = list(self.tasks.values())

        # 應用篩選條件
        if status_filter:
            tasks = [t for t in tasks if t.status == status_filter]
        if task_type_filter:
            tasks = [t for t in tasks if t.task_type == task_type_filter]

        # 按建立時間排序（最新的在前）
        tasks.sort(key=lambda t: t.created_at, reverse=True)

        # 應用數量限制
        if limit:
            tasks = tasks[:limit]

        return tasks

    async def update_task_status(self, task_id: str, status: TaskStatus):
        """
        更新任務狀態

        Args:
            task_id: 任務ID
            status: 新狀態
        """
        async with self._lock:
            task = self.tasks.get(task_id)
            if not task:
                task_logger.warning(f"嘗試更新不存在的任務狀態: {task_id}")
                return

            old_status = task.status
            task.status = status

            # 更新時間戳
            if status == TaskStatus.RUNNING and task.started_at is None:
                task.started_at = datetime.now()
            elif status in [
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
            ]:
                if task.completed_at is None:
                    task.completed_at = datetime.now()
                if task.started_at:
                    task.execution_time = (
                        task.completed_at - task.started_at
                    ).total_seconds()

                # 更新統計
                if status == TaskStatus.COMPLETED:
                    self._stats["total_completed"] += 1
                elif status == TaskStatus.FAILED:
                    self._stats["total_failed"] += 1
                elif status == TaskStatus.CANCELLED:
                    self._stats["total_cancelled"] += 1

        task_logger.debug(
            f"任務狀態已更新",
            extra={
                "task_id": task_id,
                "old_status": old_status.value,
                "new_status": status.value,
                "execution_time": task.execution_time if task else None,
            },
        )

    async def update_progress(
        self, task_id: str, percentage: float = None, stage: str = None, **details
    ):
        """
        更新任務進度

        Args:
            task_id: 任務ID
            percentage: 進度百分比 (0-100)
            stage: 當前階段描述
            **details: 其他進度細節
        """
        async with self._lock:
            task = self.tasks.get(task_id)
            if not task:
                task_logger.warning(f"嘗試更新不存在任務的進度: {task_id}")
                return

            if task.status != TaskStatus.RUNNING:
                task_logger.warning(
                    f"嘗試更新非運行狀態任務的進度: {task_id}, 狀態: {task.status.value}"
                )
                return

            # 更新進度
            if percentage is not None:
                task.progress.percentage = round(max(0.0, min(100.0, percentage)), 2)
            if stage is not None:
                task.progress.current_stage = stage
            if details:
                task.progress.details.update(details)

        task_logger.debug(
            f"任務進度已更新",
            extra={
                "task_id": task_id,
                "percentage": task.progress.percentage if task else None,
                "stage": stage,
                "details": details,
            },
        )

    async def complete_task(self, task_id: str, result: Any):
        """
        標記任務成功並儲存結果

        Args:
            task_id: 任務ID
            result: 執行結果
        """
        async with self._lock:
            task = self.tasks.get(task_id)
            if not task:
                task_logger.warning(f"嘗試完成不存在的任務: {task_id}")
                return

            task.result = result
            task.status = TaskStatus.COMPLETED
            task.progress.percentage = 100.0
            task.progress.current_stage = "執行完成"

            if task.completed_at is None:
                task.completed_at = datetime.now()
            if task.started_at:
                task.execution_time = (
                    task.completed_at - task.started_at
                ).total_seconds()

            self._stats["total_completed"] += 1

        task_logger.info(
            f"任務已完成",
            extra={
                "task_id": task_id,
                "execution_time": task.execution_time if task else None,
                "result_type": type(result).__name__ if result else None,
            },
        )

    async def fail_task(self, task_id: str, error: str):
        """
        標記任務失敗並儲存錯誤訊息

        Args:
            task_id: 任務ID
            error: 錯誤訊息
        """
        async with self._lock:
            task = self.tasks.get(task_id)
            if not task:
                task_logger.warning(f"嘗試標記不存在任務為失敗: {task_id}")
                return

            task.error = error
            task.status = TaskStatus.FAILED
            task.progress.current_stage = "執行失敗"

            if task.completed_at is None:
                task.completed_at = datetime.now()
            if task.started_at:
                task.execution_time = (
                    task.completed_at - task.started_at
                ).total_seconds()

            self._stats["total_failed"] += 1

        task_logger.error(
            f"任務執行失敗",
            extra={
                "task_id": task_id,
                "error": error,
                "execution_time": task.execution_time if task else None,
            },
        )

    async def cancel_task(self, task_id: str, reason: str = "用戶取消"):
        """
        取消任務

        Args:
            task_id: 任務ID
            reason: 取消原因
        """
        async with self._lock:
            task = self.tasks.get(task_id)
            if not task:
                task_logger.warning(f"嘗試取消不存在的任務: {task_id}")
                return False

            if task.is_finished():
                task_logger.warning(
                    f"嘗試取消已完成的任務: {task_id}, 狀態: {task.status.value}"
                )
                return False

            task.status = TaskStatus.CANCELLED
            task.error = f"任務已取消: {reason}"
            task.progress.current_stage = "已取消"

            if task.completed_at is None:
                task.completed_at = datetime.now()
            if task.started_at:
                task.execution_time = (
                    task.completed_at - task.started_at
                ).total_seconds()

            self._stats["total_cancelled"] += 1

        task_logger.info(f"任務已取消", extra={"task_id": task_id, "reason": reason})
        return True

    async def get_stats(self) -> Dict[str, Any]:
        """
        取得任務管理器統計資訊

        Returns:
            Dict[str, Any]: 統計資訊
        """
        async with self._lock:
            active_tasks = len([t for t in self.tasks.values() if t.is_active()])
            finished_tasks = len([t for t in self.tasks.values() if t.is_finished()])

            stats = {
                **self._stats,
                "current_tasks": len(self.tasks),
                "active_tasks": active_tasks,
                "finished_tasks": finished_tasks,
                "cleanup_interval": self.cleanup_interval,
                "task_ttl_hours": self.task_ttl.total_seconds() / 3600,
                "uptime_seconds": (datetime.now() - self.start_time).total_seconds(),
            }

        return stats


# =============================================================================
# 全域單例模式實現
# =============================================================================

_task_manager_instance: Optional[AsyncTaskManager] = None
_manager_lock = threading.Lock()


def get_task_manager() -> AsyncTaskManager:
    """
    取得全域任務管理器實例 (執行緒安全)

    使用單例模式確保整個應用程式中只有一個任務管理器實例

    Returns:
        AsyncTaskManager: 任務管理器實例
    """
    global _task_manager_instance

    if _task_manager_instance is None:
        with _manager_lock:
            # 雙重檢查鎖定模式
            if _task_manager_instance is None:
                _task_manager_instance = AsyncTaskManager()
                task_logger.info("全域任務管理器實例已建立")

    return _task_manager_instance


async def shutdown_task_manager():
    """
    關閉任務管理器，清理資源

    這個函數應該在應用程式關閉時調用
    """
    global _task_manager_instance

    if _task_manager_instance:
        await _task_manager_instance.stop_cleanup_loop()
        task_logger.info("任務管理器已關閉")
        _task_manager_instance = None


# =============================================================================
# 任務執行輔助函數
# =============================================================================


async def create_and_run_task(
    task_type: TaskType, params: Dict[str, Any], worker_func: Callable
) -> str:
    """
    建立任務並在背景執行

    這是一個便利函數，用於簡化任務建立和執行的流程

    Args:
        task_type: 任務類型
        params: 任務參數
        worker_func: 工作函數

    Returns:
        str: 任務ID
    """
    task_manager = get_task_manager()
    task = await task_manager.create_task(task_type, params)

    # 在背景啟動任務
    asyncio.create_task(worker_func(task.task_id))

    return task.task_id


def task_progress_wrapper(task_id: str):
    """
    任務進度更新裝飾器工廠

    用於裝飾工作函數，自動處理進度更新

    Args:
        task_id: 任務ID

    Returns:
        裝飾器函數
    """

    def decorator(func):
        async def wrapper(*args, **kwargs):
            task_manager = get_task_manager()

            try:
                await task_manager.update_task_status(task_id, TaskStatus.RUNNING)
                result = await func(task_id, *args, **kwargs)
                await task_manager.complete_task(task_id, result)
                return result
            except Exception as e:
                await task_manager.fail_task(task_id, str(e))
                raise

        return wrapper

    return decorator
