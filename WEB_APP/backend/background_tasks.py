#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
背景任務模組

提供非同步背景任務的執行函數

Created: 2025-08-04
Author: Claude Code Assistant
"""

import asyncio
import logging
from typing import List

from ai_service import get_ai_service
from async_task_manager import TaskStatus, get_task_manager
from core.nornir_integration import BatchResult, get_nornir_manager

logger = logging.getLogger(__name__)

# 移除本地的 _handle_ai_request 函數，統一使用 AIService.handle_ai_request
# 這樣可以消除程式碼重複，提升維護性

async def run_batch_task_worker(
    task_id: str, devices: List[str], command: str, mode: str
):
    """
    執行批次任務的背景工作函數

    Args:
        task_id: 任務ID
        devices: 設備列表
        command: 執行指令
        mode: 執行模式 ("command" 或 "ai")
    """
    task_manager = get_task_manager()

    try:
        # 更新任務狀態為執行中
        await task_manager.update_task_status(task_id, TaskStatus.RUNNING)
        await task_manager.update_progress(task_id, 5.0, "開始執行批次任務...")

        logger.info(
            f"開始執行背景批次任務",
            extra={
                "task_id": task_id,
                "mode": mode,
                "devices_count": len(devices),
                "command": command[:50] + "..." if len(command) > 50 else command,
            },
        )

        if mode == "ai":
            # AI 模式執行
            await task_manager.update_progress(task_id, 10.0, "AI 正在分析需求...")

            try:
                # 使用 AIService 的統一 AI 請求處理方法
                ai_service = get_ai_service()
                result = await ai_service.handle_ai_request(query=command, device_ips=devices)
                await task_manager.update_progress(task_id, 90.0, "AI 分析完成")

                # 使用統一的格式化函數處理 AI 結果
                from formatters import format_ai_results

                final_result = format_ai_results(devices, result, execution_time=2.0)

            except Exception as ai_error:
                # AIService.handle_ai_request 已經包含錯誤分類，直接處理
                error_msg = str(ai_error).split('|')[0] if '|' in str(ai_error) else str(ai_error)
                logger.error(f"AI 模式執行失敗: {error_msg}")
                raise Exception(error_msg)

        else:
            # 指令模式執行
            await task_manager.update_progress(
                task_id, 20.0, "Nornir 正在執行批次指令..."
            )

            try:
                manager = get_nornir_manager()

                # 使用 asyncio.to_thread 在執行緒中運行同步函數
                batch_result: BatchResult = await asyncio.to_thread(
                    manager.run_batch_command, command, devices
                )

                await task_manager.update_progress(task_id, 80.0, "處理執行結果...")

                # 使用 BatchResult 的新方法轉換為 API 回應格式
                final_result = batch_result.to_api_response()

            except Exception as cmd_error:
                logger.error(f"指令模式執行失敗: {cmd_error}")
                raise cmd_error

        # 標記任務完成
        await task_manager.complete_task(task_id, final_result)

        logger.info(
            f"背景批次任務執行完成",
            extra={
                "task_id": task_id,
                "successful_devices": final_result["summary"]["successful"],
                "failed_devices": final_result["summary"]["failed"],
                "total_time": final_result["summary"]["totalTime"],
            },
        )

    except Exception as e:
        # 標記任務失敗
        error_msg = str(e)
        await task_manager.fail_task(task_id, error_msg)

        logger.error(
            f"背景批次任務執行失敗",
            extra={"task_id": task_id, "error": error_msg},
            exc_info=True,
        )